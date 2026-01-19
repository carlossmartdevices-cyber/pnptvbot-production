// path: backend/src/modules/auth/auth.controller.ts
import { Request, Response } from 'express';
import { verifyTelegramAuth, isAuthDateValid } from './telegramVerify';
import { generateToken } from './jwt';
import { getUserByTelegramId, createUser, updateUserTerms } from '../../db/users';
import { Role } from '../../rbac/rbac';

export const telegramAuth = async (req: Request, res: Response) => {
  try {
    const { id, username, first_name, photo_url, auth_date, hash } = req.body;

    // Verify Telegram authentication
    if (!verifyTelegramAuth(req.body)) {
      return res.status(401).json({ error: 'Invalid Telegram authentication' });
    }

    // Check if auth_date is too old (5 minutes)
    if (!isAuthDateValid(auth_date)) {
      return res.status(401).json({ error: 'Authentication data is too old' });
    }

    // Get or create user
    let user = await getUserByTelegramId(id);
    if (!user) {
      // Determine initial role (default to FREE)
      const initialRole: Role = 'FREE';
      
      user = await createUser({
        telegramId: id,
        username,
        firstName: first_name,
        photoUrl: photo_url,
        role: initialRole,
        acceptedTermsAt: null
      });
    }

    // Generate JWT token
    const token = generateToken({
      sub: user.id,
      role: user.role,
      termsAccepted: !!user.acceptedTermsAt
    });

    res.json({
      accessToken: token,
      expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
      role: user.role,
      telegramUser: {
        id: user.telegramId,
        username: user.username,
        first_name: user.firstName
      },
      termsAccepted: !!user.acceptedTermsAt
    });
  } catch (error) {
    console.error('Telegram auth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    // User is set by auth middleware
    const user = req.user;

    res.json({
      user: {
        id: user.telegramId,
        username: user.username,
        role: user.role,
        termsAccepted: !!user.acceptedTermsAt
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const acceptTerms = async (req: Request, res: Response) => {
  try {
    const user = req.user; // Set by auth middleware

    await updateUserTerms(user.id, new Date());

    res.json({
      success: true,
      termsAccepted: true
    });
  } catch (error) {
    console.error('Accept terms error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    // In JWT, logout is typically handled client-side by removing the token
    // Server-side, we could add the token to a blacklist if needed
    res.json({
      success: true
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};