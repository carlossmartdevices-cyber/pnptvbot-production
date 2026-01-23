const { query } = require('../../config/postgres');
const ModelService = require('./modelService');
const AvailabilityService = require('./availabilityService');
const PNPLiveTimeSlotService = require('./pnpLiveTimeSlotService');
const JaaSService = require('./jaasService');
const logger = require('../../utils/logger');

/**
 * PNP Television Live Service - Handles private show bookings and video sessions
 * Replaces MeetGreetService with enhanced features
 */
class PNPLiveService {
  // Updated pricing structure for PNP Television Live
  static PRICING = {
    30: 60,    // 30 minutes: $60
    60: 100,   // 60 minutes: $100  
    90: 250    // 90 minutes: $250 (includes extra model)
  };

  /**
   * Create a new PNP Live booking with JaaS video room integration
   * @param {string} userId - User ID
   * @param {number} modelId - Model ID
   * @param {number} durationMinutes - Duration in minutes (30, 60, or 90)
   * @param {Date} bookingTime - Booking time
   * @param {string} paymentMethod - Payment method
   * @returns {Promise<Object>} Created booking with video room details
   */
  static async createBooking(userId, modelId, durationMinutes, bookingTime, paymentMethod) {
    try {
      // Validate duration
      if (!this.PRICING[durationMinutes]) {
        throw new Error('Invalid duration. Must be 30, 60, or 90 minutes.');
      }

      // Get price
      const price = this.PRICING[durationMinutes];

      // Check if model exists
      const model = await ModelService.getModelById(modelId);
      if (!model) {
        throw new Error('Model not found');
      }

      // Check if user already has a booking at this time
      const existingBooking = await query(
        `SELECT * FROM pnp_bookings
         WHERE user_id = $1
         AND booking_time = $2
         AND status != 'cancelled'`,
        [userId, bookingTime]
      );

      if (existingBooking.rows && existingBooking.rows.length > 0) {
        throw new Error('You already have a booking at this time');
      }

      // Create booking
      const booking = await query(
        `INSERT INTO pnp_bookings
         (user_id, model_id, duration_minutes, price_usd, booking_time, payment_method)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [userId, modelId, durationMinutes, price, bookingTime, paymentMethod]
      );

      const newBooking = booking.rows && booking.rows[0];
      
      // Generate JaaS video room for this booking
      const roomName = `pnp-live-${newBooking.id}-${Date.now()}`;
      const jaasRoom = JaaSService.generatePNPLiveRoom(
        roomName,
        newBooking.id,
        model.name
      );

      // Update booking with video room details
      await query(
        `UPDATE pnp_bookings
         SET video_room_name = $1, video_room_url = $2, video_room_token = $3
         WHERE id = $4`,
        [roomName, jaasRoom.clientUrl, jaasRoom.tokens.client]
      );

      logger.info('PNP Live booking created successfully', {
        bookingId: newBooking?.id,
        userId,
        modelId,
        durationMinutes,
        price,
        videoRoom: roomName
      });

      return {
        ...newBooking,
        videoRoom: {
          roomName,
          clientUrl: jaasRoom.clientUrl,
          modelUrl: jaasRoom.modelUrl
        }
      };
    } catch (error) {
      logger.error('Error creating PNP Live booking:', error);
      throw new Error('Failed to create booking: ' + error.message);
    }
  }

  /**
   * Get booking by ID
   * @param {number} bookingId - Booking ID
   * @returns {Promise<Object|null>} Booking or null if not found
   */
  static async getBookingById(bookingId) {
    try {
      const result = await query(
        `SELECT * FROM pnp_bookings WHERE id = $1`,
        [bookingId]
      );

      return result.rows && result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error('Error getting booking by ID:', error);
      throw new Error('Failed to get booking');
    }
  }

  /**
   * Get bookings for a user
   * @param {string} userId - User ID
   * @param {string} status - Filter by status (optional)
   * @returns {Promise<Array>} User's bookings
   */
  static async getBookingsForUser(userId, status = null) {
    try {
      let queryText = `SELECT * FROM pnp_bookings WHERE user_id = $1`;
      let params = [userId];

      if (status) {
        queryText += ` AND status = $2`;
        params.push(status);
      }

      queryText += ` ORDER BY booking_time DESC`;

      const result = await query(queryText, params);
      return result.rows || [];
    } catch (error) {
      logger.error('Error getting bookings for user:', error);
      throw new Error('Failed to get bookings');
    }
  }

  /**
   * Get bookings for a model
   * @param {number} modelId - Model ID
   * @param {string} status - Filter by status (optional)
   * @returns {Promise<Array>} Model's bookings
   */
  static async getBookingsForModel(modelId, status = null) {
    try {
      let queryText = `SELECT * FROM pnp_bookings WHERE model_id = $1`;
      let params = [modelId];

      if (status) {
        queryText += ` AND status = $2`;
        params.push(status);
      }

      queryText += ` ORDER BY booking_time DESC`;

      const result = await query(queryText, params);
      return result.rows || [];
    } catch (error) {
      logger.error('Error getting bookings for model:', error);
      throw new Error('Failed to get bookings');
    }
  }

  /**
   * Update booking status
   * @param {number} bookingId - Booking ID
   * @param {string} status - New status
   * @returns {Promise<Object>} Updated booking
   */
  static async updateBookingStatus(bookingId, status) {
    try {
      const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'refunded'];
      if (!validStatuses.includes(status)) {
        throw new Error('Invalid status');
      }

      const result = await query(
        `UPDATE pnp_bookings
         SET status = $2, updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [bookingId, status]
      );

      if (!result.rows || result.rows.length === 0) {
        throw new Error('Booking not found');
      }

      logger.info('Booking status updated', {
        bookingId,
        status
      });

      return result.rows[0];
    } catch (error) {
      logger.error('Error updating booking status:', error);
      throw new Error('Failed to update booking status');
    }
  }

  /**
   * Update payment status
   * @param {number} bookingId - Booking ID
   * @param {string} paymentStatus - New payment status
   * @param {string} transactionId - Transaction ID (optional)
   * @returns {Promise<Object>} Updated booking
   */
  static async updatePaymentStatus(bookingId, paymentStatus, transactionId = null) {
    try {
      const validStatuses = ['pending', 'paid', 'failed', 'refunded'];
      if (!validStatuses.includes(paymentStatus)) {
        throw new Error('Invalid payment status');
      }

      let queryText = `UPDATE pnp_bookings
                       SET payment_status = $2, updated_at = NOW()`;
      let params = [bookingId, paymentStatus];

      if (transactionId) {
        queryText += `, transaction_id = $3`;
        params.push(transactionId);
      }

      queryText += ` WHERE id = $1 RETURNING *`;

      const result = await query(queryText, params);

      if (!result.rows || result.rows.length === 0) {
        throw new Error('Booking not found');
      }

      logger.info('Payment status updated', {
        bookingId,
        paymentStatus
      });

      return result.rows[0];
    } catch (error) {
      logger.error('Error updating payment status:', error);
      throw new Error('Failed to update payment status');
    }
  }

  /**
   * Cancel booking with enhanced refund logic
   * @param {number} bookingId - Booking ID
   * @param {string} reason - Cancellation reason
   * @param {boolean} isAdmin - Whether cancellation is by admin
   * @returns {Promise<Object>} Cancelled booking
   */
  static async cancelBooking(bookingId, reason = '', isAdmin = false) {
    try {
      // Get current booking
      const booking = await this.getBookingById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.status === 'cancelled') {
        throw new Error('Booking already cancelled');
      }

      if (booking.status === 'completed') {
        throw new Error('Cannot cancel completed booking');
      }

      // Check if booking is within refund window (15 minutes before start)
      const now = new Date();
      const bookingTime = new Date(booking.booking_time);
      const timeUntilBooking = (bookingTime - now) / (1000 * 60); // minutes
      const canRefund = timeUntilBooking >= 15;

      // Update booking status
      const updatedBooking = await this.updateBookingStatus(bookingId, 'cancelled');

      // Update payment status if paid
      if (booking.payment_status === 'paid') {
        if (canRefund || isAdmin) {
          await this.updatePaymentStatus(bookingId, 'refunded');
          
          // Create refund record
          await query(
            `INSERT INTO pnp_refunds
             (booking_id, amount_usd, reason, status, processed_by)
             VALUES ($1, $2, $3, $4, $5)`,
            [bookingId, booking.price_usd, reason, 'completed', isAdmin ? 'admin' : 'system']
          );
        } else {
          await this.updatePaymentStatus(bookingId, 'failed');
        }
      }

      // Release availability if it was booked
      if (booking.availability_id) {
        await AvailabilityService.releaseAvailability(booking.availability_id);
      }

      logger.info('Booking cancelled', {
        bookingId,
        reason,
        refunded: canRefund || isAdmin
      });

      return updatedBooking;
    } catch (error) {
      logger.error('Error cancelling booking:', error);
      throw new Error('Failed to cancel booking');
    }
  }

  /**
   * Complete booking and generate feedback request
   * @param {number} bookingId - Booking ID
   * @returns {Promise<Object>} Completed booking
   */
  static async completeBooking(bookingId) {
    try {
      const booking = await this.getBookingById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.status === 'completed') {
        return booking;
      }

      if (booking.status === 'cancelled') {
        throw new Error('Cannot complete cancelled booking');
      }

      if (booking.payment_status !== 'paid') {
        throw new Error('Booking not paid');
      }

      const updatedBooking = await this.updateBookingStatus(bookingId, 'completed');

      logger.info('Booking completed', {
        bookingId
      });

      return updatedBooking;
    } catch (error) {
      logger.error('Error completing booking:', error);
      throw new Error('Failed to complete booking');
    }
  }

  /**
   * Get available time slots for a model with PNP constraints
   * @param {number} modelId - Model ID
   * @param {Date} date - Date to check
   * @param {number} durationMinutes - Duration needed
   * @returns {Promise<Array>} Available time slots
   */
  static async getAvailableSlots(modelId, date, durationMinutes) {
    try {
      // Use the enhanced time slot service with PNP constraints
      const slots = await PNPLiveTimeSlotService.getAvailableSlots(
        modelId, 
        date, 
        date, // Same start and end date for single day
        durationMinutes
      );

      return slots;
    } catch (error) {
      logger.error('Error getting available slots:', error);
      throw new Error('Failed to get available slots: ' + error.message);
    }
  }

  /**
   * Calculate booking price
   * @param {number} durationMinutes - Duration in minutes
   * @returns {number} Price in USD
   */
  static calculatePrice(durationMinutes) {
    if (!this.PRICING[durationMinutes]) {
      throw new Error('Invalid duration. Must be 30, 60, or 90 minutes.');
    }
    return this.PRICING[durationMinutes];
  }

  /**
   * Get booking statistics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} Statistics
   */
  static async getStatistics(startDate, endDate) {
    try {
      const result = await query(
        `SELECT 
            COUNT(*) as total_bookings,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_bookings,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_bookings,
            SUM(price_usd) as total_revenue,
            SUM(CASE WHEN payment_status = 'paid' THEN price_usd ELSE 0 END) as paid_revenue
         FROM pnp_bookings
         WHERE created_at >= $1 AND created_at <= $2`,
        [startDate, endDate]
      );

      return result.rows && result.rows[0] ? result.rows[0] : null;
    } catch (error) {
      logger.error('Error getting statistics:', error);
      throw new Error('Failed to get statistics');
    }
  }

  /**
   * Get revenue by model
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} Revenue by model
   */
  static async getRevenueByModel(startDate, endDate) {
    try {
      const result = await query(
        `SELECT
            m.id as model_id,
            m.name as model_name,
            COUNT(b.id) as booking_count,
            SUM(b.price_usd) as total_revenue,
            SUM(CASE WHEN b.payment_status = 'paid' THEN b.price_usd ELSE 0 END) as paid_revenue
         FROM pnp_models m
         LEFT JOIN pnp_bookings b ON m.id = b.model_id
         WHERE b.created_at >= $1 AND b.created_at <= $2
         GROUP BY m.id, m.name
         ORDER BY paid_revenue DESC`,
        [startDate, endDate]
      );

      return result.rows || [];
    } catch (error) {
      logger.error('Error getting revenue by model:', error);
      throw new Error('Failed to get revenue by model');
    }
  }

  /**
   * Get model's current online status
   * @param {number} modelId - Model ID
   * @returns {Promise<Object>} Online status info
   */
  static async getModelOnlineStatus(modelId) {
    try {
      const result = await query(
        `SELECT id, name, is_online, last_online FROM pnp_models WHERE id = $1`,
        [modelId]
      );

      if (!result.rows || result.rows.length === 0) {
        throw new Error('Model not found');
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Error getting model online status:', error);
      // Re-throw the original error if it's a specific error we want to expose
      if (error.message === 'Model not found') {
        throw error;
      }
      throw new Error('Failed to get online status');
    }
  }

  /**
   * Update model's online status
   * @param {number} modelId - Model ID
   * @param {boolean} isOnline - Online status
   * @returns {Promise<Object>} Updated model
   */
  static async updateModelOnlineStatus(modelId, isOnline) {
    try {
      const result = await query(
        `UPDATE pnp_models SET is_online = $2, last_online = CASE WHEN $2 = TRUE THEN NOW() ELSE last_online END WHERE id = $1 RETURNING *`,
        [modelId, isOnline]
      );

      if (!result.rows || result.rows.length === 0) {
        throw new Error('Model not found');
      }

      logger.info('Model online status updated', {
        modelId,
        isOnline
      });

      return result.rows[0];
    } catch (error) {
      logger.error('Error updating model online status:', error);
      // Re-throw the original error if it's a specific error we want to expose
      if (error.message === 'Model not found') {
        throw error;
      }
      throw new Error('Failed to update online status');
    }
  }

  /**
   * Get upcoming bookings for a model
   * @param {number} modelId - Model ID
   * @param {number} hoursAhead - How many hours ahead to look
   * @returns {Promise<Array>} Upcoming bookings
   */
  static async getUpcomingBookingsForModel(modelId, hoursAhead = 24) {
    try {
      const now = new Date();
      const endTime = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

      const result = await query(
        `SELECT * 
         FROM pnp_bookings
         WHERE model_id = $1
         AND booking_time >= $2
         AND booking_time <= $3
         AND status != 'cancelled'
         ORDER BY booking_time ASC`,
        [modelId, now, endTime]
      );

      return result.rows || [];
    } catch (error) {
      logger.error('Error getting upcoming bookings:', error);
      throw new Error('Failed to get upcoming bookings');
    }
  }

  /**
   * Submit feedback for a completed booking
   * @param {number} bookingId - Booking ID
   * @param {string} userId - User ID
   * @param {number} rating - Rating (1-5)
   * @param {string} comments - Feedback comments
   * @returns {Promise<Object>} Created feedback
   */
  static async submitFeedback(bookingId, userId, rating, comments = '') {
    try {
      // Validate rating first (before any database calls)
      if (rating < 1 || rating > 5) {
        const error = new Error('Rating must be between 1 and 5');
        error.name = 'ValidationError';
        throw error;
      }

      // Validate booking exists and is completed
      const booking = await this.getBookingById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.status !== 'completed') {
        throw new Error('Can only submit feedback for completed bookings');
      }

      if (booking.user_id !== userId) {
        throw new Error('Only the booking user can submit feedback');
      }

      const result = await query(
        `INSERT INTO pnp_feedback (booking_id, user_id, rating, comments) VALUES ($1, $2, $3, $4) RETURNING *`,
        [bookingId, userId, rating, comments]
      );

      logger.info('Feedback submitted', {
        bookingId,
        userId,
        rating
      });

      return result.rows[0];
    } catch (error) {
      logger.error('Error submitting feedback:', error);
      // Re-throw specific errors we want to expose
      if (error.message === 'Booking not found' || 
          error.message === 'Can only submit feedback for completed bookings' ||
          error.message === 'Only the booking user can submit feedback' ||
          error.message.includes('Rating must be between 1 and 5')) {
        throw error;
      }
      throw new Error('Failed to submit feedback');
    }
  }

  /**
   * Request refund for a booking
   * @param {number} bookingId - Booking ID
   * @param {string} userId - User ID
   * @param {string} reason - Refund reason
   * @returns {Promise<Object>} Created refund request
   */
  static async requestRefund(bookingId, userId, reason) {
    try {
      const booking = await this.getBookingById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.user_id !== userId) {
        throw new Error('Only the booking user can request refund');
      }

      if (booking.status === 'cancelled' || booking.status === 'refunded') {
        throw new Error('Booking already cancelled or refunded');
      }

      // Check if within refund window (15 minutes after booking time)
      const bookingTime = new Date(booking.booking_time);
      const now = new Date();
      const minutesSinceBooking = (now - bookingTime) / (1000 * 60);
      
      if (minutesSinceBooking > 15 && booking.status !== 'pending') {
        throw new Error('Refund can only be requested within 15 minutes of booking time');
      }

      const result = await query(
        `INSERT INTO pnp_refunds (booking_id, amount_usd, reason, status) VALUES ($1, $2, $3, $4) RETURNING *`,
        [bookingId, booking.price_usd, reason, 'pending']
      );

      logger.info('Refund requested', {
        bookingId,
        userId,
        reason
      });

      return result.rows[0];
    } catch (error) {
      logger.error('Error requesting refund:', error);
      // Re-throw specific errors we want to expose
      if (error.message === 'Booking not found' || 
          error.message === 'Only the booking user can request refund' ||
          error.message === 'Booking already cancelled or refunded' ||
          error.message === 'Refund can only be requested within 15 minutes of booking time') {
        throw error;
      }
      throw new Error('Failed to request refund');
    }
  }

  /**
   * Process refund request (admin function)
   * @param {number} refundId - Refund ID
   * @param {string} status - Approved or rejected
   * @param {string} processedBy - Admin user ID
   * @returns {Promise<Object>} Updated refund
   */
  static async processRefund(refundId, status, processedBy) {
    try {
      const validStatuses = ['approved', 'rejected'];
      if (!validStatuses.includes(status)) {
        throw new Error('Invalid status');
      }

      const result = await query(
        `UPDATE pnp_refunds SET status = $2, processed_by = $3, processed_at = NOW() WHERE id = $1 RETURNING *`,
        [refundId, status, processedBy]
      );

      if (!result.rows || result.rows.length === 0) {
        const error = new Error('Refund not found');
        error.name = 'NotFoundError';
        throw error;
      }

      const refund = result.rows[0];

      // If approved, update booking and payment status
      if (status === 'approved') {
        await this.updateBookingStatus(refund.booking_id, 'refunded');
        await this.updatePaymentStatus(refund.booking_id, 'refunded');
      }

      logger.info('Refund processed', {
        refundId,
        status,
        processedBy
      });

      return refund;
    } catch (error) {
      logger.error('Error processing refund:', error);
      // Re-throw specific errors we want to expose
      if (error.message === 'Invalid status' || 
          error.message === 'Refund not found' ||
          error.name === 'NotFoundError') {
        throw error;
      }
      throw new Error('Failed to process refund');
    }
  }
}

module.exports = PNPLiveService;