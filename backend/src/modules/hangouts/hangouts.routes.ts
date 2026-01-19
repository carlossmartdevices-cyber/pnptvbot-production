// path: backend/src/modules/hangouts/hangouts.routes.ts
import express from 'express';
import {
  getPublicRoomsController,
  createRoomController,
  joinRoomController,
  getRoomController
} from './hangouts.controller';
import { authRequired, requireTerms } from '../../middleware/auth';
import { requireAction } from '../../middleware/auth';

const router = express.Router();

// Get public rooms (open to everyone)
router.get('/public', authRequired, requireTerms, getPublicRoomsController);

// Create a new room (PRIME/ADMIN only)
router.post('/', 
  authRequired, 
  requireTerms,
  requireAction('hangouts.create'),
  createRoomController
);

// Join a room
router.post('/:roomId/join', 
  authRequired, 
  requireTerms,
  joinRoomController
);

// Get room details
router.get('/:roomId', 
  authRequired, 
  requireTerms,
  getRoomController
);

export default router;