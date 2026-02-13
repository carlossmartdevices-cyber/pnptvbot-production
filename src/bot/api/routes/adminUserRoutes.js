const express = require('express');
const AdminUserController = require('../controllers/adminUserController');

const router = express.Router();

/**
 * Admin User Management Routes
 * All routes require admin authentication via middleware
 */

// Search users
router.get('/search', AdminUserController.searchUsers);

// Get user details
router.get('/:userId', AdminUserController.getUser);

// Update user (username, email, subscription, tier)
router.put('/:userId', AdminUserController.updateUser);

// Ban/Unban user
router.post('/:userId/ban', AdminUserController.toggleBan);

// Send direct message via customer service
router.post('/:userId/send-message', AdminUserController.sendDirectMessage);

module.exports = router;
