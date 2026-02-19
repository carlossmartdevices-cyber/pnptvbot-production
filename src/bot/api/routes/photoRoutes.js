const express = require('express');
const multer = require('multer');
const photoController = require('../controllers/photoController');

const router = express.Router();

// Configure multer for photo uploads
const photoStorage = multer.memoryStorage();
const photoUpload = multer({
  storage: photoStorage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
});

/**
 * ─── ADMIN PHOTO ROUTES ───────────────────────────────────────────────────
 */

// POST /api/admin/photos/upload - Upload a new admin photo
router.post('/admin/photos/upload', photoUpload.single('file'), photoController.uploadAdminPhoto);

// GET /api/admin/photos/list - List admin photos with filters
router.get('/admin/photos/list', photoController.listAdminPhotos);

// GET /api/admin/photos/stats - Get photo statistics
router.get('/admin/photos/stats', photoController.getPhotoStats);

// GET /api/admin/photos/:photoId - Get admin photo details
router.get('/admin/photos/:photoId', photoController.getAdminPhoto);

// PUT /api/admin/photos/:photoId - Update admin photo metadata
router.put('/admin/photos/:photoId', photoController.updateAdminPhoto);

// DELETE /api/admin/photos/:photoId - Delete admin photo
router.delete('/admin/photos/:photoId', photoController.deleteAdminPhoto);

// POST /api/admin/photos/batch/delete - Batch delete photos
router.post('/admin/photos/batch/delete', photoController.batchDeletePhotos);

/**
 * ─── USER POST PHOTO ROUTES ───────────────────────────────────────────────
 */

// POST /api/photos/upload - Upload photo for post (temporary, not attached to post yet)
router.post('/photos/upload', photoUpload.single('file'), photoController.uploadPhotoForPost);

// GET /api/photos/stats - Get user's photo statistics and limits
router.get('/photos/stats', photoController.getUserPhotoStats);

// GET /api/posts/:postId/photos - Get all photos in a post
router.get('/posts/:postId/photos', photoController.getPostPhotos);

// PUT /api/posts/:postId/photos/:photoId - Update photo caption
router.put('/posts/:postId/photos/:photoId', photoController.updatePostPhoto);

// DELETE /api/posts/:postId/photos/:photoId - Delete photo from post
router.delete('/posts/:postId/photos/:photoId', photoController.deletePostPhoto);

// PUT /api/posts/:postId/photos/reorder - Reorder photos in post
router.put('/posts/:postId/photos/reorder', photoController.reorderPostPhotos);

module.exports = router;
