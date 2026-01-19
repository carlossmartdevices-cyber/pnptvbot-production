// path: backend/src/middleware/requireTerms.ts
import { Request, Response, NextFunction } from 'express';

export const requireTerms = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.termsAccepted) {
    return res.status(403).json({
      error: 'Terms and conditions not accepted',
      redirectTo: process.env.TERMS_URL || '/terms'
    });
  }
  
  next();
};