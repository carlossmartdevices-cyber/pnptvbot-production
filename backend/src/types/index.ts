// path: backend/src/types/index.ts
import { Role } from '../rbac/rbac';

export interface User {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  photoUrl: string | null;
  role: Role;
  acceptedTermsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TelegramAuthData {
  id: string;
  username?: string;
  first_name?: string;
  photo_url?: string;
  auth_date: string;
  hash: string;
}

export interface JwtPayload {
  sub: string;
  role: Role;
  termsAccepted: boolean;
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: User & { termsAccepted: boolean };
    }
  }
}