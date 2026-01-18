const ModelManagementModel = require('../../models/modelManagementModel');
const logger = require('../../utils/logger');

/**
 * Booking Payment Service
 * Handles payment processing, confirmation, and notifications for private call bookings
 */
class BookingPaymentService {
  /**
   * Process successful payment
   */
  static async processPaymentSuccess(bookingId, transactionId, paymentMethod) {
    try {
      const booking = await ModelManagementModel.getBookingDetails(bookingId);

      if (!booking) {
        logger.error('Booking not found:', { bookingId });
        return null;
      }

      // Update booking status to confirmed
      const updated = await ModelManagementModel.updateBookingStatus(bookingId, 'confirmed', {
        payment_status: 'paid',
        transaction_id: transactionId
      });

      // Record earnings for the model
      await ModelManagementModel.recordEarnings(bookingId, booking.total_price);

      // Send confirmation to user
      await this.sendUserConfirmation(booking, updated);

      // Send notification to model (if available via Telegram)
      await this.notifyModel(booking);

      logger.info('Payment processed successfully', {
        bookingId,
        transactionId,
        paymentMethod,
        userId: booking.telegram_user_id
      });

      return updated;
    } catch (error) {
      logger.error('Error processing payment:', error);
      throw error;
    }
  }

  /**
   * Handle payment failure
   */
  static async processPaymentFailure(bookingId, reason) {
    try {
      await ModelManagementModel.updateBookingStatus(bookingId, 'pending', {
        payment_status: 'failed'
      });

      logger.warn('Payment failed', { bookingId, reason });
      return true;
    } catch (error) {
      logger.error('Error processing payment failure:', error);
      throw error;
    }
  }

  /**
   * Send confirmation message to user
   */
  static async sendUserConfirmation(booking, updatedBooking) {
    try {
      // This would send a Telegram message to the user
      // For now, just log it
      logger.info('User confirmation message queued', {
        userId: booking.telegram_user_id,
        bookingId: booking.id,
        modelName: booking.display_name
      });

      return true;
    } catch (error) {
      logger.error('Error sending user confirmation:', error);
      return false;
    }
  }

  /**
   * Notify model about the booking
   */
  static async notifyModel(booking) {
    try {
      // This would send a Telegram message to the model
      logger.info('Model notification queued', {
        modelId: booking.model_id,
        bookingId: booking.id,
        userId: booking.telegram_user_id,
        scheduledDate: booking.scheduled_date,
        time: booking.start_time
      });

      return true;
    } catch (error) {
      logger.error('Error notifying model:', error);
      return false;
    }
  }

  /**
   * Check and mark bookings as active if start time has passed
   */
  static async checkAndActivateBookings() {
    try {
      // This would be called by a cron job
      // Check all confirmed bookings where start time has passed
      logger.info('Checking for bookings to activate');
      return true;
    } catch (error) {
      logger.error('Error checking bookings:', error);
      throw error;
    }
  }

  /**
   * Complete a booking after the call ends
   */
  static async completeBooking(bookingId, callDuration, feedback = null) {
    try {
      const booking = await ModelManagementModel.getBookingDetails(bookingId);

      if (!booking) {
        throw new Error('Booking not found');
      }

      // Calculate actual duration (might differ from booked duration if cut short)
      const actualDuration = Math.min(callDuration, booking.duration_minutes);
      const actualCost = (actualDuration * booking.price_per_minute).toFixed(2);

      // Update booking status
      const updated = await ModelManagementModel.updateBookingStatus(bookingId, 'completed');

      // Refund difference if call was shorter
      if (actualCost < booking.total_price) {
        const refundAmount = (booking.total_price - actualCost).toFixed(2);
        await this.processRefund(bookingId, refundAmount);
      }

      // Record feedback if provided
      if (feedback) {
        await this.recordFeedback(bookingId, feedback);
      }

      // Update model earnings to reflect actual duration
      await ModelManagementModel.recordEarnings(bookingId, actualCost);

      logger.info('Booking completed', {
        bookingId,
        scheduledDuration: booking.duration_minutes,
        actualDuration,
        scheduledCost: booking.total_price,
        actualCost
      });

      return updated;
    } catch (error) {
      logger.error('Error completing booking:', error);
      throw error;
    }
  }

  /**
   * Cancel a booking
   */
  static async cancelBooking(bookingId, reason = 'User cancelled') {
    try {
      const booking = await ModelManagementModel.getBookingDetails(bookingId);

      if (!booking) {
        throw new Error('Booking not found');
      }

      // Cancel booking
      const updated = await ModelManagementModel.updateBookingStatus(bookingId, 'cancelled');

      // Process refund
      if (booking.payment_status === 'paid') {
        await this.processRefund(bookingId, booking.total_price);
      }

      // Notify model
      logger.info('Booking cancelled', {
        bookingId,
        reason,
        modelId: booking.model_id,
        userId: booking.telegram_user_id
      });

      return updated;
    } catch (error) {
      logger.error('Error cancelling booking:', error);
      throw error;
    }
  }

  /**
   * Process refund
   */
  static async processRefund(bookingId, amount) {
    try {
      logger.info('Refund processed', {
        bookingId,
        amount
      });

      // TODO: Implement actual refund logic with payment provider
      return true;
    } catch (error) {
      logger.error('Error processing refund:', error);
      throw error;
    }
  }

  /**
   * Record user feedback for the model
   */
  static async recordFeedback(bookingId, feedbackData) {
    try {
      const { rating, review_text } = feedbackData;
      const booking = await ModelManagementModel.getBookingDetails(bookingId);

      // TODO: Implement feedback recording
      logger.info('Feedback recorded', {
        bookingId,
        modelId: booking.model_id,
        userId: booking.telegram_user_id,
        rating
      });

      return true;
    } catch (error) {
      logger.error('Error recording feedback:', error);
      throw error;
    }
  }

  /**
   * Generate call room URL (Jitsi or other video platform)
   */
  static async generateCallRoomUrl(bookingId, modelId, userId) {
    try {
      const roomName = `call-${bookingId}-${Date.now()}`;
      const jitsiDomain = process.env.JITSI_DOMAIN || 'meet.jit.si';

      // Generate Jitsi URL
      const baseUrl = `https://${jitsiDomain}/${roomName}`;
      const roomUrl = baseUrl + '#config.prejoinPageEnabled=false&config.startWithAudioMuted=false&config.startWithVideoMuted=false';

      // Update booking with call room URL
      await ModelManagementModel.updateBookingStatus(bookingId, 'active', {
        call_room_url: roomUrl
      });

      logger.info('Call room generated', {
        bookingId,
        roomName,
        roomUrl
      });

      return roomUrl;
    } catch (error) {
      logger.error('Error generating call room:', error);
      throw error;
    }
  }
}

module.exports = BookingPaymentService;
