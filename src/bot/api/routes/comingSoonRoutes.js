const express = require('express');
const router = express.Router();
const comingSoonController = require('../controllers/comingSoonController');
const { authenticate, optional } = require('../middleware/auth');

/**
 * Public routes
 */

// Sign up for coming soon waitlist
router.post('/waitlist', optional, comingSoonController.signupWaitlist);

// Get waitlist count for feature
router.get('/count/:feature', comingSoonController.getWaitlistCount);

// Unsubscribe from waitlist
router.post('/unsubscribe', comingSoonController.unsubscribe);

/**
 * Admin-only routes
 */

// Get waitlist statistics
router.get('/stats/:feature', authenticate, comingSoonController.getStats);

// Get pending entries
router.get('/pending/:feature', authenticate, comingSoonController.getPendingEntries);

// Mark entries as notified
router.post('/notify', authenticate, comingSoonController.markAsNotified);

// Export waitlist
router.get('/export/:feature', authenticate, comingSoonController.exportWaitlist);

module.exports = router;
