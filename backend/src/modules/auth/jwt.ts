// path: backend/src/modules/auth/jwt.ts
import jwt from 'jsonwebtoken';
import { Role } from '../../rbac/rbac';

interface JwtPayload {
  sub: string; // telegram user id
  role: Role;
  termsAccepted: boolean;
  iat?: number;
  exp?: number;
}

export function generateToken(payload: {
  sub: string;
  role: Role;
  termsAccepted: boolean;
}): string {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not set');
  }
  
  const token = jwt.sign(
    {
      sub: payload.sub,
      role: payload.role,
      termsAccepted: payload.termsAccepted,
    },
    jwtSecret,
    {
      expiresIn: '1h', // 1 hour expiration
    }
  );
  
  return token;
}

export function verifyToken(token: string): JwtPayload {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not set');
  }
  
  try {
    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

export function decodeToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.decode(token) as JwtPayload | null;
    return decoded;
  } catch (error) {
    return null;
  }
}