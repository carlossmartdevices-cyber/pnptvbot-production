const CallModel = require('../../../models/callModel');
const { query } = require('../../../config/postgres');
const logger = require('../../../utils/logger');

/**
 * Call Feedback Handlers - Post-call rating and feedback
 */
function registerCallFeedbackHandlers(bot) {
  /**
   * Start feedback process
   */
  bot.action(/^feedback_call:(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();

      const callId = ctx.match[1];
      const call = await CallModel.getById(callId);

      if (!call || call.userId.toString() !== ctx.from.id.toString()) {
        await ctx.reply('❌ Call not found or access denied.');
        return;
      }

      if (call.status !== 'completed') {
        await ctx.reply('❌ Feedback can only be submitted for completed calls.');
        return;
      }

      if (call.feedbackSubmitted) {
        await ctx.reply('✅ You have already submitted feedback for this call.');
        return;
      }

      ctx.session.temp.feedbackCallId = callId;
      await ctx.saveSession();

      await ctx.editMessageText(
        '⭐ *Rate Your Call*\n\n' +
        `How was your call with ${call.performer}?\n\n` +
        'Please select a rating:',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '⭐⭐⭐⭐⭐ (5)', callback_data: `rate_call:${callId}:5` },
              ],
              [
                { text: '⭐⭐⭐⭐ (4)', callback_data: `rate_call:${callId}:4` },
              ],
              [
                { text: '⭐⭐⭐ (3)', callback_data: `rate_call:${callId}:3` },
              ],
              [
                { text: '⭐⭐ (2)', callback_data: `rate_call:${callId}:2` },
              ],
              [
                { text: '⭐ (1)', callback_data: `rate_call:${callId}:1` },
              ],
              [
                { text: '❌ Cancel', callback_data: `manage_call:${callId}` },
              ],
            ],
          },
        }
      );
    } catch (error) {
      logger.error('Error starting feedback:', error);
      await ctx.reply('❌ Error loading feedback form.');
    }
  });

  /**
   * Handle rating selection
   */
  bot.action(/^rate_call:(.+):(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();

      const callId = ctx.match[1];
      const rating = parseInt(ctx.match[2]);

      ctx.session.temp.feedbackCallId = callId;
      ctx.session.temp.feedbackRating = rating;
      await ctx.saveSession();

      const stars = '⭐'.repeat(rating);

      await ctx.editMessageText(
        `${stars} *${rating}/5 Stars*\n\n` +
        'Thank you for your rating!\n\n' +
        'Would you like to add additional comments? (optional)\n\n' +
        'You can:\n' +
        '• Send your feedback as a message\n' +
        '• Or skip to submit your rating',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ Submit Rating (No Comment)', callback_data: `submit_feedback:${callId}:${rating}:` }],
              [{ text: '❌ Cancel', callback_data: `manage_call:${callId}` }],
            ],
          },
        }
      );
    } catch (error) {
      logger.error('Error processing rating:', error);
      await ctx.reply('❌ Error processing your rating.');
    }
  });

  /**
   * Handle feedback text input
   */
  bot.on('text', async (ctx, next) => {
    if (ctx.session?.temp?.feedbackCallId && ctx.session?.temp?.feedbackRating) {
      try {
        const callId = ctx.session.temp.feedbackCallId;
        const rating = ctx.session.temp.feedbackRating;
        const comment = ctx.message.text.trim();

        // Submit feedback
        await submitFeedback(callId, ctx.from.id, rating, comment);

        delete ctx.session.temp.feedbackCallId;
        delete ctx.session.temp.feedbackRating;
        await ctx.saveSession();

        const stars = '⭐'.repeat(rating);

        await ctx.reply(
          '✅ *Feedback Submitted!*\n\n' +
          `${stars} ${rating}/5 Stars\n\n` +
          'Thank you for your feedback! It helps us improve our service.\n\n' +
          '🎉 Your feedback has been shared with the performer.',
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '📞 Book Another Call', callback_data: 'book_private_call' }],
                [{ text: '📋 View My Calls', callback_data: 'back_to_mycalls' }],
              ],
            },
          }
        );

        logger.info('Feedback submitted with comment', {
          callId,
          userId: ctx.from.id,
          rating,
        });
      } catch (error) {
        logger.error('Error submitting feedback with comment:', error);
        await ctx.reply('❌ Error submitting feedback. Please try again.');
      }
    } else {
      return next();
    }
  });

  /**
   * Submit feedback without comment
   */
  bot.action(/^submit_feedback:(.+):(.+):(.*)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery('Submitting feedback...');

      const callId = ctx.match[1];
      const rating = parseInt(ctx.match[2]);
      const comment = ctx.match[3] || '';

      await submitFeedback(callId, ctx.from.id, rating, comment);

      delete ctx.session.temp.feedbackCallId;
      delete ctx.session.temp.feedbackRating;
      await ctx.saveSession();

      const stars = '⭐'.repeat(rating);

      await ctx.editMessageText(
        '✅ *Feedback Submitted!*\n\n' +
        `${stars} ${rating}/5 Stars\n\n` +
        'Thank you for your feedback! It helps us improve our service.',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📞 Book Another Call', callback_data: 'book_private_call' }],
              [{ text: '📋 View My Calls', callback_data: 'back_to_mycalls' }],
            ],
          },
        }
      );

      logger.info('Feedback submitted', {
        callId,
        userId: ctx.from.id,
        rating,
      });
    } catch (error) {
      logger.error('Error submitting feedback:', error);
      await ctx.reply('❌ Error submitting feedback. Please try again.');
    }
  });

  /**
   * Submit feedback to database
   */
  async function submitFeedback(callId, userId, rating, comment) {
    try {
      // Update call with feedback
      await CallModel.updateStatus(callId, 'completed', {
        feedbackSubmitted: true,
        feedbackRating: rating,
        feedbackComment: comment,
        feedbackSubmittedAt: new Date(),
      });

      // Store feedback in separate table for analytics
      await query(
        `INSERT INTO call_feedback (call_id, user_id, rating, comment, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [callId, String(userId), rating, comment || null, new Date()]
      );

      logger.info('Feedback saved to database', {
        callId,
        rating,
        hasComment: comment.length > 0,
      });
    } catch (error) {
      logger.error('Error saving feedback to database:', error);
      throw error;
    }
  }

  logger.info('Call feedback handlers registered');
}

module.exports = registerCallFeedbackHandlers;
