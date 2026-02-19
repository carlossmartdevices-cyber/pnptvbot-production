const PhotoService = require('../../services/PhotoService');
const { query } = require('../../../config/postgres');
const logger = require('../../../utils/logger');

const adminGuard = (req, res) => {
  const user = req.session?.user;
  if (!user || !['admin', 'superadmin'].includes(user.role)) {
    res.status(403).json({ success: false, error: 'Admin access required' });
    return null;
  }
  return user;
};

const authGuard = (req, res) => {
  const user = req.session?.user;
  if (!user) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return null;
  }
  return user;
};

/**
 * ─── ADMIN PHOTO ENDPOINTS ───────────────────────────────────────────────────
 */

const uploadAdminPhoto = async (req, res) => {
  const user = adminGuard(req, res);
  if (!user) return;

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const { caption, category = 'gallery' } = req.body;

    const photo = await PhotoService.uploadAdminPhoto(
      req.file.buffer,
      req.file.mimetype,
      {
        userId: user.id,
        filename: req.file.originalname,
        caption,
        category,
      }
    );

    logger.info(`Admin photo uploaded: ${photo.id}`, { userId: user.id });
    return res.json({ success: true, photo });
  } catch (error) {
    logger.error('uploadAdminPhoto error', error);
    return res.status(400).json({ success: false, error: error.message });
  }
};

const listAdminPhotos = async (req, res) => {
  const user = adminGuard(req, res);
  if (!user) return;

  try {
    const { category, search, limit = 50, offset = 0, sortBy = 'created_at', sortOrder = 'DESC' } = req.query;

    const result = await PhotoService.getAdminPhotos({
      category,
      search,
      limit: Math.min(Number(limit), 100),
      offset: Number(offset),
      sortBy,
      sortOrder,
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    logger.error('listAdminPhotos error', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

const getAdminPhoto = async (req, res) => {
  const user = adminGuard(req, res);
  if (!user) return;

  try {
    const { photoId } = req.params;
    const photo = await PhotoService.getPhotoById(photoId);

    if (!photo || photo.deleted_at) {
      return res.status(404).json({ success: false, error: 'Photo not found' });
    }

    return res.json({ success: true, photo });
  } catch (error) {
    logger.error('getAdminPhoto error', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

const updateAdminPhoto = async (req, res) => {
  const user = adminGuard(req, res);
  if (!user) return;

  try {
    const { photoId } = req.params;
    const { caption, category } = req.body;

    const updated = await PhotoService.updatePhotoMetadata(
      photoId,
      { caption, category },
      user.id
    );

    logger.info(`Admin photo updated: ${photoId}`, { userId: user.id });
    return res.json({ success: true, photo: updated });
  } catch (error) {
    logger.error('updateAdminPhoto error', error);
    return res.status(400).json({ success: false, error: error.message });
  }
};

const deleteAdminPhoto = async (req, res) => {
  const user = adminGuard(req, res);
  if (!user) return;

  try {
    const { photoId } = req.params;
    await PhotoService.deletePhoto(photoId, user.id);

    logger.info(`Admin photo deleted: ${photoId}`, { userId: user.id });
    return res.json({ success: true, message: 'Photo deleted' });
  } catch (error) {
    logger.error('deleteAdminPhoto error', error);
    return res.status(400).json({ success: false, error: error.message });
  }
};

const getPhotoStats = async (req, res) => {
  const user = adminGuard(req, res);
  if (!user) return;

  try {
    const stats = await PhotoService.getPhotoStats();
    return res.json({ success: true, stats });
  } catch (error) {
    logger.error('getPhotoStats error', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

const batchDeletePhotos = async (req, res) => {
  const user = adminGuard(req, res);
  if (!user) return;

  try {
    const { photoIds = [] } = req.body;

    if (!Array.isArray(photoIds) || photoIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid photo IDs' });
    }

    const results = await Promise.all(
      photoIds.map(id => PhotoService.deletePhoto(id, user.id).catch(e => ({ error: e.message })))
    );

    logger.info(`Batch deleted ${photoIds.length} photos`, { userId: user.id });
    return res.json({ success: true, results, deleted: photoIds.length });
  } catch (error) {
    logger.error('batchDeletePhotos error', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * ─── USER POST PHOTO ENDPOINTS ────────────────────────────────────────────────
 */

const uploadPhotoForPost = async (req, res) => {
  const user = authGuard(req, res);
  if (!user) return;

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const { caption } = req.body;

    const photo = await PhotoService.uploadUserPhoto(
      req.file.buffer,
      req.file.mimetype,
      user.id,
      null,
      {
        filename: req.file.originalname,
        caption,
        userRole: user.role,
      }
    );

    logger.info(`User photo uploaded: ${photo.id}`, { userId: user.id });
    return res.json({ success: true, photo });
  } catch (error) {
    logger.error('uploadPhotoForPost error', error);
    return res.status(400).json({ success: false, error: error.message });
  }
};

const getPostPhotos = async (req, res) => {
  try {
    const { postId } = req.params;

    const photos = await PhotoService.getPostPhotos(postId);
    return res.json({ success: true, photos });
  } catch (error) {
    logger.error('getPostPhotos error', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

const updatePostPhoto = async (req, res) => {
  const user = authGuard(req, res);
  if (!user) return;

  try {
    const { postId, photoId } = req.params;
    const { caption } = req.body;

    const photo = await PhotoService.getPhotoById(photoId);
    if (!photo) {
      return res.status(404).json({ success: false, error: 'Photo not found' });
    }

    if (photo.user_id !== user.id && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const updated = await PhotoService.updatePhotoMetadata(photoId, { caption }, user.id);

    return res.json({ success: true, photo: updated });
  } catch (error) {
    logger.error('updatePostPhoto error', error);
    return res.status(400).json({ success: false, error: error.message });
  }
};

const deletePostPhoto = async (req, res) => {
  const user = authGuard(req, res);
  if (!user) return;

  try {
    const { postId, photoId } = req.params;

    const photo = await PhotoService.getPhotoById(photoId);
    if (!photo) {
      return res.status(404).json({ success: false, error: 'Photo not found' });
    }

    if (photo.user_id !== user.id && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    await PhotoService.deletePhoto(photoId, user.id);

    logger.info(`Post photo deleted: ${photoId}`, { userId: user.id });
    return res.json({ success: true, message: 'Photo deleted' });
  } catch (error) {
    logger.error('deletePostPhoto error', error);
    return res.status(400).json({ success: false, error: error.message });
  }
};

const reorderPostPhotos = async (req, res) => {
  const user = authGuard(req, res);
  if (!user) return;

  try {
    const { postId } = req.params;
    const { photoIds = [] } = req.body;

    if (!Array.isArray(photoIds)) {
      return res.status(400).json({ success: false, error: 'Invalid photo order' });
    }

    const photos = await PhotoService.reorderPostPhotos(postId, photoIds);
    return res.json({ success: true, photos });
  } catch (error) {
    logger.error('reorderPostPhotos error', error);
    return res.status(400).json({ success: false, error: error.message });
  }
};

const getUserPhotoStats = async (req, res) => {
  const user = authGuard(req, res);
  if (!user) return;

  try {
    const stats = await PhotoService.getUserPhotoStats(user.id);
    const limits = await PhotoService.getStorageLimits(user.role);

    return res.json({ success: true, stats, limits });
  } catch (error) {
    logger.error('getUserPhotoStats error', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  // Admin
  uploadAdminPhoto,
  listAdminPhotos,
  getAdminPhoto,
  updateAdminPhoto,
  deleteAdminPhoto,
  getPhotoStats,
  batchDeletePhotos,

  // User
  uploadPhotoForPost,
  getPostPhotos,
  updatePostPhoto,
  deletePostPhoto,
  reorderPostPhotos,
  getUserPhotoStats,
};
