// path: backend/src/modules/auth/auth.routes.ts
import express from 'express';
import { telegramAuth, getMe, acceptTerms, logout } from './auth.controller';
import { authRequired } from '../../middleware/auth';
import { requireTerms } from '../../middleware/requireTerms';

const router = express.Router();

// Telegram authentication
router.post('/telegram', telegramAuth);

// Get current user (protected)
router.get('/me', authRequired, getMe);

// Accept terms and conditions (protected)
router.post('/accept-terms', authRequired, acceptTerms);

// Logout (protected)
router.post('/logout', authRequired, logout);

export default router;