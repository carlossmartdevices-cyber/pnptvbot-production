// path: backend/src/middleware/auth.test.ts
import { Request, Response, NextFunction } from 'express';
import { authRequired, requireTerms, requireRole, requireAction } from './auth';
import { verifyToken } from '../modules/auth/jwt';
import { getUserById } from '../db/users';

// Mock dependencies
jest.mock('../modules/auth/jwt');
jest.mock('../db/users');

describe('Auth Middleware Tests', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  describe('authRequired', () => {
    it('should return 401 if no Authorization header', async () => {
      await authRequired(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Authorization token required' })
      );
    });

    it('should return 401 if Authorization header is malformed', async () => {
      mockReq.headers = {
        authorization: 'InvalidToken'
      };

      await authRequired(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return 401 if token is invalid', async () => {
      mockReq.headers = {
        authorization: 'Bearer invalid.token.here'
      };

      (verifyToken as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await authRequired(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Invalid or expired token' })
      );
    });

    it('should return 401 if user not found', async () => {
      mockReq.headers = {
        authorization: 'Bearer valid.token.here'
      };

      (verifyToken as jest.Mock).mockReturnValue({
        sub: 'user-id-123'
      });

      (getUserById as jest.Mock).mockResolvedValue(null);

      await authRequired(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'User not found' })
      );
    });

    it('should attach user to request and call next if valid', async () => {
      mockReq.headers = {
        authorization: 'Bearer valid.token.here'
      };

      const mockUser = {
        id: 'user-id-123',
        telegramId: 'telegram-123',
        username: 'testuser',
        role: 'FREE',
        acceptedTermsAt: new Date()
      };

      (verifyToken as jest.Mock).mockReturnValue({
        sub: 'user-id-123',
        role: 'FREE',
        termsAccepted: true
      });

      (getUserById as jest.Mock).mockResolvedValue(mockUser);

      await authRequired(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockReq.user).toEqual({
        ...mockUser,
        termsAccepted: true
      });
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireTerms', () => {
    it('should return 403 if terms not accepted', () => {
      mockReq.user = {
        termsAccepted: false
      };

      requireTerms(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Terms and conditions not accepted' })
      );
    });

    it('should call next if terms accepted', () => {
      mockReq.user = {
        termsAccepted: true
      };

      requireTerms(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    it('should return 401 if no user', () => {
      const middleware = requireRole(['ADMIN']);

      middleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return 403 if role not in required roles', () => {
      const middleware = requireRole(['ADMIN']);

      mockReq.user = {
        role: 'FREE'
      };

      middleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should call next if role is in required roles', () => {
      const middleware = requireRole(['ADMIN', 'PRIME']);

      mockReq.user = {
        role: 'PRIME'
      };

      middleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireAction', () => {
    it('should return 401 if no user', async () => {
      const middleware = requireAction('hangouts.create');

      await middleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return 403 if action not allowed', async () => {
      const middleware = requireAction('hangouts.create');

      mockReq.user = {
        role: 'FREE'
      };

      await middleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Insufficient permissions for this action',
          requiredAction: 'hangouts.create'
        })
      );
    });

    it('should call next if action is allowed', async () => {
      const middleware = requireAction('hangouts.create');

      mockReq.user = {
        role: 'PRIME'
      };

      await middleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle resource-based permissions', async () => {
      const middleware = requireAction('videorama.editOwn', { ownerId: 'current-user-id' });

      mockReq.user = {
        role: 'PRIME',
        id: 'current-user-id'
      };

      await middleware(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });
  });
});