// path: backend/src/modules/videorama/videorama.routes.ts
import express from 'express';
import {
  getCollectionsController,
  createCollectionController,
  getCollectionController,
  updateCollectionController,
  deleteCollectionController,
  getUserCollectionsController
} from './videorama.controller';
import { authRequired, requireTerms } from '../../middleware/auth';
import { requireAction } from '../../middleware/auth';

const router = express.Router();

// Get collections available to user (based on role)
router.get('/', authRequired, requireTerms, getCollectionsController);

// Create a new collection (PRIME/ADMIN only)
router.post('/', 
  authRequired, 
  requireTerms,
  requireAction('videorama.create'),
  createCollectionController
);

// Get a specific collection
router.get('/:id', 
  authRequired, 
  requireTerms,
  getCollectionController
);

// Update a collection
router.put('/:id', 
  authRequired, 
  requireTerms,
  updateCollectionController
);

// Delete a collection
router.delete('/:id', 
  authRequired, 
  requireTerms,
  deleteCollectionController
);

// Get collections owned by current user
router.get('/mine', 
  authRequired, 
  requireTerms,
  getUserCollectionsController
);

export default router;