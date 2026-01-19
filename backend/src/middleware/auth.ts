// path: backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../modules/auth/jwt';
import { getUserById } from '../db/users';

export const authRequired = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token required' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const payload = verifyToken(token);
    
    // Get user from database
    const user = await getUserById(payload.sub);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Attach user to request
    req.user = {
      ...user,
      // Ensure termsAccepted is boolean
      termsAccepted: !!user.acceptedTermsAt
    };
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const requireTerms = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.termsAccepted) {
    return res.status(403).json({
      error: 'Terms and conditions not accepted',
      redirectTo: '/terms'
    });
  }
  
  next();
};

export const requireRole = (requiredRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (!requiredRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};

export const requireAction = (action: string, resource?: any) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Import RBAC dynamically to avoid circular dependencies
    const { can } = await import('../rbac/rbac');
    
    if (!can(req.user.role as any, action as any, resource)) {
      return res.status(403).json({
        error: 'Insufficient permissions for this action',
        requiredAction: action
      });
    }
    
    next();
  };
};

export const requireTermsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.termsAccepted) {
    return res.status(403).json({
      error: 'Terms and conditions not accepted',
      redirectTo: '/terms'
    });
  }
  
  next();
};