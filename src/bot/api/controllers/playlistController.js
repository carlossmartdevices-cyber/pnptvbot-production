const MediaPlayerModel = require('../../../models/mediaPlayerModel');
const logger = require('../../../utils/logger');

/**
 * Playlist API Controller
 * Handles playlist management for web interface
 */

/**
 * Get user playlists
 * Expects userId in query parameter or header
 */
const getUserPlaylists = async (req, res) => {
  try {
    const userId = req.query.userId || req.headers['x-user-id'];

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const playlists = await MediaPlayerModel.getUserPlaylists(userId);
    res.json(playlists);
  } catch (error) {
    logger.error('Error getting user playlists:', error);
    res.status(500).json({ error: 'Failed to get playlists' });
  }
};

/**
 * Get public playlists
 */
const getPublicPlaylists = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const playlists = await MediaPlayerModel.getPublicPlaylists(limit);
    res.json(playlists);
  } catch (error) {
    logger.error('Error getting public playlists:', error);
    res.status(500).json({ error: 'Failed to get public playlists' });
  }
};

/**
 * Create playlist
 */
const createPlaylist = async (req, res) => {
  try {
    const userId = req.body.userId || req.headers['x-user-id'];
    const { name, description, isPublic } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Playlist name is required' });
    }

    const playlist = await MediaPlayerModel.createPlaylist(userId, {
      name: name.trim(),
      description: description || '',
      isPublic: isPublic === true,
    });

    if (!playlist) {
      return res.status(500).json({ error: 'Failed to create playlist' });
    }

    res.status(201).json(playlist);
  } catch (error) {
    logger.error('Error creating playlist:', error);
    res.status(500).json({ error: 'Failed to create playlist' });
  }
};

/**
 * Add video to playlist
 */
const addToPlaylist = async (req, res) => {
  try {
    const { playlistId } = req.params;
    const { videoId } = req.body;

    if (!videoId) {
      return res.status(400).json({ error: 'Video ID is required' });
    }

    const success = await MediaPlayerModel.addToPlaylist(playlistId, videoId);

    if (!success) {
      return res.status(500).json({ error: 'Failed to add video to playlist' });
    }

    res.json({ success: true, message: 'Video added to playlist' });
  } catch (error) {
    logger.error('Error adding to playlist:', error);
    res.status(500).json({ error: 'Failed to add video to playlist' });
  }
};

/**
 * Remove video from playlist
 */
const removeFromPlaylist = async (req, res) => {
  try {
    const { playlistId, videoId } = req.params;

    const success = await MediaPlayerModel.removeFromPlaylist(playlistId, videoId);

    if (!success) {
      return res.status(500).json({ error: 'Failed to remove video from playlist' });
    }

    res.json({ success: true, message: 'Video removed from playlist' });
  } catch (error) {
    logger.error('Error removing from playlist:', error);
    res.status(500).json({ error: 'Failed to remove video from playlist' });
  }
};

/**
 * Delete playlist
 */
const deletePlaylist = async (req, res) => {
  try {
    const { playlistId } = req.params;

    const success = await MediaPlayerModel.deletePlaylist(playlistId);

    if (!success) {
      return res.status(500).json({ error: 'Failed to delete playlist' });
    }

    res.json({ success: true, message: 'Playlist deleted' });
  } catch (error) {
    logger.error('Error deleting playlist:', error);
    res.status(500).json({ error: 'Failed to delete playlist' });
  }
};

module.exports = {
  getUserPlaylists,
  getPublicPlaylists,
  createPlaylist,
  addToPlaylist,
  removeFromPlaylist,
  deletePlaylist,
};
