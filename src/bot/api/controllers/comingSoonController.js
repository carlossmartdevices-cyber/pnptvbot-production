const ComingSoonService = require('../../services/ComingSoonService');
const logger = require('../../utils/logger');

/**
 * POST /api/coming-soon/waitlist
 * Sign up for coming soon feature waitlist
 */
exports.signupWaitlist = async (req, res) => {
  try {
    const { email, feature } = req.body;
    const { user } = req;

    // Validate input
    if (!email || !feature) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Email and feature are required' },
      });
    }

    // Get client info
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    // Sign up
    const result = await ComingSoonService.signupWaitlist(email, feature, {
      userId: user?.id || null,
      ipAddress,
      userAgent,
      source: req.body.source || 'web',
    });

    logger.info('Waitlist signup successful', { email, feature, userId: user?.id });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Waitlist signup error', { error: error.message });

    if (error.message.includes('Invalid email')) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_EMAIL', message: error.message },
      });
    }

    return res.status(500).json({
      success: false,
      error: { code: 'SIGNUP_FAILED', message: 'Failed to sign up for waitlist' },
    });
  }
};

/**
 * GET /api/coming-soon/count/:feature
 * Get waitlist count for feature
 */
exports.getWaitlistCount = async (req, res) => {
  try {
    const { feature } = req.params;

    if (!['live', 'hangouts'].includes(feature)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_FEATURE', message: 'Invalid feature type' },
      });
    }

    const count = await ComingSoonService.getWaitlistCount(feature);

    return res.status(200).json({
      success: true,
      data: { feature, count },
    });
  } catch (error) {
    logger.error('Get waitlist count error', { error: error.message });

    return res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to fetch waitlist count' },
    });
  }
};

/**
 * POST /api/coming-soon/unsubscribe
 * Unsubscribe from waitlist
 */
exports.unsubscribe = async (req, res) => {
  try {
    const { email, feature } = req.body;

    if (!email || !feature) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Email and feature are required' },
      });
    }

    const success = await ComingSoonService.unsubscribe(email, feature);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Email not found on waitlist' },
      });
    }

    logger.info('Unsubscribe successful', { email, feature });

    return res.status(200).json({
      success: true,
      data: { message: 'Successfully unsubscribed' },
    });
  } catch (error) {
    logger.error('Unsubscribe error', { error: error.message });

    return res.status(500).json({
      success: false,
      error: { code: 'UNSUBSCRIBE_FAILED', message: 'Failed to unsubscribe' },
    });
  }
};

/**
 * GET /api/coming-soon/stats/:feature
 * Get waitlist statistics (admin)
 */
exports.getStats = async (req, res) => {
  try {
    const { user } = req;
    const { feature } = req.params;

    // Admin only
    if (!user || !['admin', 'superadmin'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin access required' },
      });
    }

    if (!['live', 'hangouts'].includes(feature)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_FEATURE', message: 'Invalid feature type' },
      });
    }

    const stats = await ComingSoonService.getStats(feature);

    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Get stats error', { error: error.message });

    return res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to fetch statistics' },
    });
  }
};

/**
 * GET /api/coming-soon/pending/:feature
 * Get pending entries for feature (admin)
 */
exports.getPendingEntries = async (req, res) => {
  try {
    const { user } = req;
    const { feature } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    // Admin only
    if (!user || !['admin', 'superadmin'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin access required' },
      });
    }

    if (!['live', 'hangouts'].includes(feature)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_FEATURE', message: 'Invalid feature type' },
      });
    }

    const entries = await ComingSoonService.getPendingEntries(
      feature,
      parseInt(limit),
      parseInt(offset)
    );

    return res.status(200).json({
      success: true,
      data: { feature, count: entries.length, entries },
    });
  } catch (error) {
    logger.error('Get pending entries error', { error: error.message });

    return res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to fetch pending entries' },
    });
  }
};

/**
 * POST /api/coming-soon/notify
 * Mark entries as notified (admin)
 */
exports.markAsNotified = async (req, res) => {
  try {
    const { user } = req;
    const { entryIds } = req.body;

    // Admin only
    if (!user || !['admin', 'superadmin'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin access required' },
      });
    }

    if (!Array.isArray(entryIds) || entryIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Entry IDs array is required' },
      });
    }

    const count = await ComingSoonService.markAsNotified(entryIds);

    logger.info('Marked entries as notified', { count, userId: user.id });

    return res.status(200).json({
      success: true,
      data: { message: `Marked ${count} entries as notified`, count },
    });
  } catch (error) {
    logger.error('Mark as notified error', { error: error.message });

    return res.status(500).json({
      success: false,
      error: { code: 'UPDATE_FAILED', message: 'Failed to mark entries as notified' },
    });
  }
};

/**
 * GET /api/coming-soon/export/:feature
 * Export waitlist (admin)
 */
exports.exportWaitlist = async (req, res) => {
  try {
    const { user } = req;
    const { feature } = req.params;
    const { status = 'pending' } = req.query;

    // Admin only
    if (!user || !['admin', 'superadmin'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin access required' },
      });
    }

    if (!['live', 'hangouts'].includes(feature)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_FEATURE', message: 'Invalid feature type' },
      });
    }

    const data = await ComingSoonService.exportWaitlist(feature, status);

    // Return as CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="waitlist-${feature}-${Date.now()}.csv"`);

    if (data.length === 0) {
      res.send('email,user_id,signup_date,source\n');
      return;
    }

    // Build CSV
    const headers = ['email', 'user_id', 'signup_date', 'source'];
    const rows = data.map(row => [
      `"${row.email}"`,
      row.user_id || '',
      new Date(row.signup_date).toISOString(),
      row.source || '',
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    res.send(csv);

    logger.info('Exported waitlist', { feature, status, count: data.length, userId: user.id });
  } catch (error) {
    logger.error('Export waitlist error', { error: error.message });

    return res.status(500).json({
      success: false,
      error: { code: 'EXPORT_FAILED', message: 'Failed to export waitlist' },
    });
  }
};
