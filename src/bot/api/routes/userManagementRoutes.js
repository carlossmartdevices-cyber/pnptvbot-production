const express = require('express');
const UserManagementController = require('../controllers/userManagementController');

const router = express.Router();

/**
 * User Management Routes
 * Simple endpoints for managing user subscriptions
 * No authentication required - use with caution in production
 */

// Get user subscription status
router.get('/:userId/status', UserManagementController.getStatus);

// Downgrade user from PRIME to FREE
router.post('/:userId/downgrade', UserManagementController.downgradeToFree);

// Upgrade user to PRIME
router.post('/:userId/upgrade-prime', UserManagementController.upgradeToPrime);

// Reset subscription status
router.post('/:userId/reset-subscription', UserManagementController.resetSubscription);

// Manually activate a payment
router.post('/:userId/activate-payment', UserManagementController.activatePayment);

module.exports = router;
