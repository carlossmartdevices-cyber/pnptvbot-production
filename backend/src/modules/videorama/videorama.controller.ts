// path: backend/src/modules/videorama/videorama.controller.ts
import { Request, Response } from 'express';
import {
  createCollection,
  getCollectionsForUser,
  getCollectionById,
  updateCollection,
  deleteCollection,
  canUserEditCollection,
  canUserDeleteCollection
} from './videorama.service';
import { can } from '../../rbac/rbac';

export const getCollectionsController = async (req: Request, res: Response) => {
  try {
    const userRole = req.user!.role;
    const userId = req.user!.id;

    const collections = await getCollectionsForUser(userRole, userId);

    res.json(collections);
  } catch (error) {
    console.error('Get collections error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createCollectionController = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Check permission
    if (!can(req.user!.role as any, 'videorama.create')) {
      return res.status(403).json({ error: 'Not authorized to create collections' });
    }

    const collection = await createCollection({
      ...req.body,
      ownerId: userId
    });

    res.status(201).json(collection);
  } catch (error) {
    console.error('Create collection error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getCollectionController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const collection = await getCollectionById(id);

    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    // Check if user can access this collection based on visibility
    const userRole = req.user!.role;

    if (collection.visibility === 'PUBLIC') {
      // Anyone can access PUBLIC collections
    } else if (collection.visibility === 'PRIME') {
      // Only PRIME and ADMIN can access PRIME collections
      if (userRole === 'FREE') {
        return res.status(403).json({ error: 'Not authorized to access this collection' });
      }
    } else if (collection.visibility === 'PRIVATE') {
      // Only owner and ADMIN can access PRIVATE collections
      if (userRole !== 'ADMIN' && req.user!.id !== collection.ownerId) {
        return res.status(403).json({ error: 'Not authorized to access this collection' });
      }
    }

    res.json(collection);
  } catch (error) {
    console.error('Get collection error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateCollectionController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const collection = await getCollectionById(id);

    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    // Check if user can edit this collection
    const canEdit = await canUserEditCollection(
      userId,
      collection.ownerId,
      req.user!.role
    );

    if (!canEdit) {
      return res.status(403).json({ error: 'Not authorized to edit this collection' });
    }

    const updatedCollection = await updateCollection(id, req.body);

    res.json(updatedCollection);
  } catch (error) {
    console.error('Update collection error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteCollectionController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const collection = await getCollectionById(id);

    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    // Check if user can delete this collection
    const canDelete = await canUserDeleteCollection(
      userId,
      collection.ownerId,
      req.user!.role
    );

    if (!canDelete) {
      return res.status(403).json({ error: 'Not authorized to delete this collection' });
    }

    await deleteCollection(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete collection error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUserCollectionsController = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const collections = await getCollectionsByUser(userId);

    res.json(collections);
  } catch (error) {
    console.error('Get user collections error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};