/**
 * Nearby Routes
 * Geolocation API endpoints
 *
 * Routes:
 * - POST /api/nearby/update-location - Update user location
 * - GET /api/nearby/search - Search nearby users
 * - GET /api/nearby/stats - Get statistics
 * - POST /api/nearby/clear - Clear user location
 * - POST /api/nearby/batch-update - Batch update (testing)
 */

const express = require('express');
const router = express.Router();

const NearbyController = require('../controllers/nearbyController');
const { authenticateUser } = require('../middleware/auth');

// Middleware
router.use(authenticateUser);

// Update user location
router.post('/update-location', (req, res) => {
  NearbyController.updateLocation(req, res);
});

// Search nearby users
router.get('/search', (req, res) => {
  NearbyController.searchNearby(req, res);
});

// Get statistics
router.get('/stats', (req, res) => {
  NearbyController.getStats(req, res);
});

// Clear user location (go offline)
router.post('/clear', (req, res) => {
  NearbyController.clearLocation(req, res);
});

// Batch update locations (for testing/admin)
router.post('/batch-update', (req, res) => {
  NearbyController.batchUpdate(req, res);
});

module.exports = router;
