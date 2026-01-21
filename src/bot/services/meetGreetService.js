const { query } = require('../../config/postgres');
const ModelService = require('./modelService');
const AvailabilityService = require('./availabilityService');
const logger = require('../../utils/logger');

/**
 * Meet & Greet Service - Handles bookings and payments
 */
class MeetGreetService {
  // Pricing structure
  static PRICING = {
    30: 60,    // 30 minutes: $60
    60: 100,   // 60 minutes: $100
    90: 250    // 90 minutes: $250
  };

  /**
   * Create a new booking
   * @param {string} userId - User ID
   * @param {number} modelId - Model ID
   * @param {number} durationMinutes - Duration in minutes (30, 60, or 90)
   * @param {Date} bookingTime - Booking time
   * @param {string} paymentMethod - Payment method
   * @returns {Promise<Object>} Created booking
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
        `SELECT * FROM meet_greet_bookings
         WHERE user_id = $1
         AND booking_time = $2
         AND status != 'cancelled'`,
        [userId, bookingTime]
      );

      if (existingBooking.length > 0) {
        throw new Error('You already have a booking at this time');
      }

      // Create booking
      const booking = await query(
        `INSERT INTO meet_greet_bookings 
         (user_id, model_id, duration_minutes, price_usd, booking_time, payment_method)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [userId, modelId, durationMinutes, price, bookingTime, paymentMethod]
      );

      logger.info('Booking created successfully', {
        bookingId: booking[0].id,
        userId,
        modelId,
        durationMinutes,
        price
      });

      return booking[0];
    } catch (error) {
      logger.error('Error creating booking:', error);
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
        `SELECT * FROM meet_greet_bookings WHERE id = $1`,
        [bookingId]
      );

      return result.length > 0 ? result[0] : null;
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
      let queryText = `SELECT * FROM meet_greet_bookings WHERE user_id = $1`;
      let params = [userId];

      if (status) {
        queryText += ` AND status = $2`;
        params.push(status);
      }

      queryText += ` ORDER BY booking_time DESC`;

      const result = await query(queryText, params);
      return result;
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
      let queryText = `SELECT * FROM meet_greet_bookings WHERE model_id = $1`;
      let params = [modelId];

      if (status) {
        queryText += ` AND status = $2`;
        params.push(status);
      }

      queryText += ` ORDER BY booking_time DESC`;

      const result = await query(queryText, params);
      return result;
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
        `UPDATE meet_greet_bookings
         SET status = $2, updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [bookingId, status]
      );

      if (result.length === 0) {
        throw new Error('Booking not found');
      }

      logger.info('Booking status updated', {
        bookingId,
        status
      });

      return result[0];
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

      let queryText = `UPDATE meet_greet_bookings
                       SET payment_status = $2, updated_at = NOW()`;
      let params = [bookingId, paymentStatus];

      if (transactionId) {
        queryText += `, transaction_id = $3`;
        params.push(transactionId);
      }

      queryText += ` WHERE id = $1 RETURNING *`;

      const result = await query(queryText, params);

      if (result.length === 0) {
        throw new Error('Booking not found');
      }

      logger.info('Payment status updated', {
        bookingId,
        paymentStatus
      });

      return result[0];
    } catch (error) {
      logger.error('Error updating payment status:', error);
      throw new Error('Failed to update payment status');
    }
  }

  /**
   * Cancel booking
   * @param {number} bookingId - Booking ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise<Object>} Cancelled booking
   */
  static async cancelBooking(bookingId, reason = '') {
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

      // Update booking status
      const updatedBooking = await this.updateBookingStatus(bookingId, 'cancelled');

      // Update payment status if paid
      if (booking.payment_status === 'paid') {
        await this.updatePaymentStatus(bookingId, 'refunded');
      }

      // Release availability if it was booked
      if (booking.availability_id) {
        await AvailabilityService.releaseAvailability(booking.availability_id);
      }

      logger.info('Booking cancelled', {
        bookingId,
        reason
      });

      return updatedBooking;
    } catch (error) {
      logger.error('Error cancelling booking:', error);
      throw new Error('Failed to cancel booking');
    }
  }

  /**
   * Complete booking
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
   * Get available time slots for a model
   * @param {number} modelId - Model ID
   * @param {Date} date - Date to check
   * @param {number} durationMinutes - Duration needed
   * @returns {Promise<Array>} Available time slots
   */
  static async getAvailableSlots(modelId, date, durationMinutes) {
    try {
      // Get start and end of day
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Get available slots
      const slots = await AvailabilityService.getAvailableSlots(modelId, startOfDay, endOfDay);

      // Filter slots that are long enough for the requested duration
      const validSlots = slots.filter(slot => {
        const slotDuration = (new Date(slot.available_to) - new Date(slot.available_from)) / (1000 * 60);
        return slotDuration >= durationMinutes;
      });

      return validSlots;
    } catch (error) {
      logger.error('Error getting available slots:', error);
      throw new Error('Failed to get available slots');
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
         FROM meet_greet_bookings
         WHERE created_at >= $1 AND created_at <= $2`,
        [startDate, endDate]
      );

      return result[0];
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
         FROM models m
         LEFT JOIN meet_greet_bookings b ON m.id = b.model_id
         WHERE b.created_at >= $1 AND b.created_at <= $2
         GROUP BY m.id, m.name
         ORDER BY paid_revenue DESC`,
        [startDate, endDate]
      );

      return result;
    } catch (error) {
      logger.error('Error getting revenue by model:', error);
      throw new Error('Failed to get revenue by model');
    }
  }
}

module.exports = MeetGreetService;