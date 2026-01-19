// path: backend/src/modules/auth/auth.test.ts
import request from 'supertest';
import app from '../../index';
import { PrismaClient } from '@prisma/client';
import { generateToken } from './jwt';

const prisma = new PrismaClient();

describe('Auth API', () => {
  let testUserId: string;
  let testUserToken: string;

  beforeAll(async () => {
    // Create a test user
    const testUser = await prisma.user.create({
      data: {
        telegramId: 'test-user-123',
        username: 'testuser',
        firstName: 'Test',
        role: 'FREE',
        acceptedTermsAt: null // User hasn't accepted terms yet
      }
    });

    testUserId = testUser.id;
    testUserToken = generateToken({
      sub: testUser.id,
      role: 'FREE',
      termsAccepted: false
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: {
        telegramId: 'test-user-123'
      }
    });
  });

  describe('POST /api/auth/accept-terms', () => {
    it('should accept terms and update user', async () => {
      const res = await request(app)
        .post('/api/auth/accept-terms')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ accepted: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.termsAccepted).toBe(true);

      // Verify user was updated in database
      const updatedUser = await prisma.user.findUnique({
        where: { id: testUserId }
      });

      expect(updatedUser?.acceptedTermsAt).not.toBeNull();
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/auth/accept-terms')
        .send({ accepted: true });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user data with termsAccepted status', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user).toHaveProperty('username');
      expect(res.body.user).toHaveProperty('role');
      expect(res.body.user).toHaveProperty('termsAccepted');
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/auth/me');

      expect(res.status).toBe(401);
    });
  });

  describe('Terms enforcement', () => {
    it('should block access to protected routes if terms not accepted', async () => {
      // Try to access hangouts without accepting terms
      const res = await request(app)
        .get('/api/hangouts/public')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Terms and conditions not accepted');
    });

    it('should allow access after accepting terms', async () => {
      // First, accept terms
      await request(app)
        .post('/api/auth/accept-terms')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ accepted: true });

      // Generate new token with termsAccepted = true
      const updatedUser = await prisma.user.findUnique({
        where: { id: testUserId }
      });

      const newToken = generateToken({
        sub: testUserId,
        role: 'FREE',
        termsAccepted: !!updatedUser?.acceptedTermsAt
      });

      // Now try to access hangouts
      const res = await request(app)
        .get('/api/hangouts/public')
        .set('Authorization', `Bearer ${newToken}`);

      expect(res.status).toBe(200);
    });
  });
});