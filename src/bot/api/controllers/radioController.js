const radioStreamManager = require('../../../services/radio/radioStreamManager');
const logger = require('../../../utils/logger');

/**
 * Radio Controller - Handles radio streaming endpoints
 */
class RadioController {
  /**
   * Get now playing information
   * GET /api/radio/now-playing
   */
  static async getNowPlaying(req, res) {
    try {
      const nowPlaying = await radioStreamManager.getNowPlaying();

      if (!nowPlaying) {
        return res.status(200).json({
          status: 'no_track',
          message: 'No track currently playing',
          track: null,
        });
      }

      res.status(200).json({
        status: 'ok',
        data: nowPlaying,
      });
    } catch (error) {
      logger.error('Error getting now playing:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get now playing information',
        error: error.message,
      });
    }
  }

  /**
   * Get radio channel info
   * GET /api/radio/channel-info
   */
  static async getChannelInfo(req, res) {
    try {
      const channelInfo = radioStreamManager.getChannelInfo();
      res.status(200).json({
        status: 'ok',
        data: channelInfo,
      });
    } catch (error) {
      logger.error('Error getting channel info:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get channel info',
        error: error.message,
      });
    }
  }

  /**
   * Get listener token for Agora RTC
   * POST /api/radio/get-token
   * Body: { userId: string }
   */
  static async getListenerToken(req, res) {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({
          status: 'error',
          message: 'userId is required',
        });
      }

      const tokens = await radioStreamManager.generateListenerToken(userId);

      res.status(200).json({
        status: 'ok',
        data: tokens,
      });
    } catch (error) {
      logger.error('Error generating listener token:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to generate listener token',
        error: error.message,
      });
    }
  }

  /**
   * Handle listener disconnect
   * POST /api/radio/disconnect
   * Body: { userId: string }
   */
  static async handleListenerDisconnect(req, res) {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({
          status: 'error',
          message: 'userId is required',
        });
      }

      await radioStreamManager.handleListenerDisconnect(userId);

      res.status(200).json({
        status: 'ok',
        message: 'Listener disconnected successfully',
      });
    } catch (error) {
      logger.error('Error handling listener disconnect:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to handle disconnect',
        error: error.message,
      });
    }
  }

  /**
   * Get radio status
   * GET /api/radio/status
   */
  static async getStatus(req, res) {
    try {
      const channelInfo = radioStreamManager.getChannelInfo();
      const nowPlaying = await radioStreamManager.getNowPlaying();

      res.status(200).json({
        status: 'ok',
        data: {
          isPlaying: channelInfo.isPlaying,
          channel: channelInfo.channelName,
          queueLength: channelInfo.queueLength,
          nowPlaying: nowPlaying || null,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Error getting radio status:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get radio status',
        error: error.message,
      });
    }
  }

  /**
   * Get radio stream URL
   * GET /api/radio/stream
   * This endpoint returns information about where to stream from
   */
  static async getStreamInfo(req, res) {
    try {
      const channelName = process.env.RADIO_CHANNEL_NAME || 'pnptv_radio_247';
      const agora = {
        appId: process.env.AGORA_APP_ID,
        channelName: channelName,
      };

      res.status(200).json({
        status: 'ok',
        data: {
          message: 'Radio stream information',
          channel: channelName,
          agora: agora,
          endpoints: {
            nowPlaying: '/api/radio/now-playing',
            channelInfo: '/api/radio/channel-info',
            getToken: '/api/radio/get-token',
            status: '/api/radio/status',
          },
        },
      });
    } catch (error) {
      logger.error('Error getting stream info:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get stream information',
        error: error.message,
      });
    }
  }
}

module.exports = RadioController;
