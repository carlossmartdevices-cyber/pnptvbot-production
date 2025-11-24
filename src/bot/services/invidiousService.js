const axios = require('axios');
const logger = require('../../utils/logger');
const { cacheService } = require('./cacheService');
const { URL } = require('url');

/**
 * Invidious Service
 * Integrates with Invidious instances for video search and streaming
 * Supports multiple instances with automatic fallback
 * SECURITY: All URLs are validated to prevent SSRF attacks
 */

// Public Invidious instances with fallback support
const INVIDIOUS_INSTANCES = [
  'https://invidious.io',
  'https://inv.nadeko.net',
  'https://invidious.snopyta.org',
  'https://iv.ggtyler.dev',
  'https://invidious.nerdvpn.org',
];

// Allowed domains for Invidious API calls (SSRF protection)
const ALLOWED_DOMAINS = [
  'invidious.io',
  'inv.nadeko.net',
  'invidious.snopyta.org',
  'iv.ggtyler.dev',
  'invidious.nerdvpn.org',
];

// Configure custom Invidious instance (if needed)
let CUSTOM_INSTANCE = process.env.INVIDIOUS_INSTANCE || null;

/**
 * Validate URL to prevent SSRF attacks
 * @param {string} urlString - URL to validate
 * @returns {boolean} - True if URL is safe
 */
const isValidInvidiousUrl = (urlString) => {
  try {
    const url = new URL(urlString);
    
    // Only allow HTTPS
    if (url.protocol !== 'https:') {
      logger.warn(`Invalid protocol for Invidious URL: ${url.protocol}`);
      return false;
    }
    
    // Check if domain is in allowed list
    const hostname = url.hostname.toLowerCase();
    const isAllowed = ALLOWED_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
    
    if (!isAllowed) {
      logger.warn(`Domain not in allowed list: ${hostname}`);
      return false;
    }
    
    // Prevent internal network addresses
    if (hostname === 'localhost' || 
        hostname.startsWith('127.') || 
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.16.')) {
      logger.warn(`Blocked internal network address: ${hostname}`);
      return false;
    }
    
    return true;
  } catch (error) {
    logger.error(`Invalid URL format: ${urlString}`, error.message);
    return false;
  }
};

/**
 * Get the current working Invidious instance
 */
let currentInstance = null;

/**
 * Test if an instance is working
 * @param {string} instance - Instance URL to test
 * @returns {Promise<boolean>} - True if instance is working
 */
const testInstance = async (instance) => {
  try {
    // SECURITY: Validate URL before making request
    if (!isValidInvidiousUrl(instance)) {
      logger.warn(`Blocked invalid Invidious URL: ${instance}`);
      return false;
    }
    
    const response = await axios.get(`${instance}/api/v1/stats`, {
      timeout: 5000,
      maxRedirects: 0, // Prevent redirect-based SSRF
    });
    return response.status === 200;
  } catch (error) {
    logger.warn(`Invidious instance ${instance} is not responding:`, error.message);
    return false;
  }
};

/**
 * Get a working Invidious instance
 */
const getWorkingInstance = async () => {
  // Return cached instance if available and recently tested
  if (currentInstance) {
    return currentInstance;
  }

  // Try custom instance first if configured
  if (CUSTOM_INSTANCE) {
    if (await testInstance(CUSTOM_INSTANCE)) {
      currentInstance = CUSTOM_INSTANCE;
      return currentInstance;
    }
    logger.warn('Custom Invidious instance not responding, falling back to public instances');
  }

  // Try each public instance
  for (const instance of INVIDIOUS_INSTANCES) {
    if (await testInstance(instance)) {
      currentInstance = instance;
      logger.info(`Using Invidious instance: ${instance}`);
      return currentInstance;
    }
  }

  throw new Error('No working Invidious instances available');
};

/**
 * Make safe API request with SSRF protection
 * @param {string} url - Full URL to request
 * @param {object} config - Axios config
 * @returns {Promise<object>} - Response data
 */
const safeMakeRequest = async (url, config = {}) => {
  // SECURITY: Validate URL before making request
  if (!isValidInvidiousUrl(url)) {
    throw new Error(`SSRF protection: Invalid or disallowed URL: ${url}`);
  }
  
  return axios.get(url, {
    ...config,
    maxRedirects: 0, // Prevent redirect-based SSRF
    validateStatus: (status) => status === 200, // Only accept 200 OK
  });
};

/**
 * Search for videos on Invidious
 */
const searchVideos = async (query, options = {}) => {
  try {
    const instance = await getWorkingInstance();
    const cacheKey = `invidious_search_${query}`;

    // Check cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const params = {
      q: query,
      page: options.page || 1,
      sort_by: options.sortBy || 'relevance',
      type: options.type || 'video',
    };

    const response = await safeMakeRequest(`${instance}/api/v1/search`, {
      params,
      timeout: 10000,
    });

    // Cache for 1 hour
    await cacheService.setex(cacheKey, 3600, JSON.stringify(response.data));

    return response.data;
  } catch (error) {
    logger.error('Error searching videos:', error.message);
    throw error;
  }
};

/**
 * Get video details
 */
const getVideoDetails = async (videoId) => {
  try {
    const instance = await getWorkingInstance();
    const cacheKey = `invidious_video_${videoId}`;

    // Check cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const response = await safeMakeRequest(`${instance}/api/v1/videos/${videoId}`, {
      timeout: 10000,
    });

    // Cache for 24 hours
    await cacheService.setex(cacheKey, 86400, JSON.stringify(response.data));

    return response.data;
  } catch (error) {
    logger.error(`Error getting video details for ${videoId}:`, error.message);
    throw error;
  }
};

/**
 * Get channel information
 */
const getChannelInfo = async (channelId) => {
  try {
    const instance = await getWorkingInstance();
    const cacheKey = `invidious_channel_${channelId}`;

    // Check cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const response = await safeMakeRequest(`${instance}/api/v1/channels/${channelId}`, {
      timeout: 10000,
    });

    // Cache for 24 hours
    await cacheService.setex(cacheKey, 86400, JSON.stringify(response.data));

    return response.data;
  } catch (error) {
    logger.error(`Error getting channel info for ${channelId}:`, error.message);
    throw error;
  }
};

/**
 * Get channel videos
 */
const getChannelVideos = async (channelId, options = {}) => {
  try {
    const instance = await getWorkingInstance();
    const cacheKey = `invidious_channel_videos_${channelId}_${options.page || 1}`;

    // Check cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const params = {
      page: options.page || 1,
      sort_by: options.sortBy || 'newest',
    };

    const response = await safeMakeRequest(
      `${instance}/api/v1/channels/${channelId}/videos`,
      { params, timeout: 10000 }
    );

    // Cache for 1 hour
    await cacheService.setex(cacheKey, 3600, JSON.stringify(response.data));

    return response.data;
  } catch (error) {
    logger.error(`Error getting channel videos for ${channelId}:`, error.message);
    throw error;
  }
};

/**
 * Get playlist information
 */
const getPlaylistInfo = async (playlistId) => {
  try {
    const instance = await getWorkingInstance();
    const cacheKey = `invidious_playlist_${playlistId}`;

    // Check cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const response = await safeMakeRequest(`${instance}/api/v1/playlists/${playlistId}`, {
      timeout: 10000,
    });

    // Cache for 24 hours
    await cacheService.setex(cacheKey, 86400, JSON.stringify(response.data));

    return response.data;
  } catch (error) {
    logger.error(`Error getting playlist info for ${playlistId}:`, error.message);
    throw error;
  }
};

/**
 * Get trending videos
 */
const getTrendingVideos = async (options = {}) => {
  try {
    const instance = await getWorkingInstance();
    const cacheKey = 'invidious_trending';

    // Check cache first (5 minute cache for trending)
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const params = {
      region: options.region || 'US',
    };

    const response = await safeMakeRequest(`${instance}/api/v1/trending`, {
      params,
      timeout: 10000,
    });

    // Cache for 5 minutes
    await cacheService.setex(cacheKey, 300, JSON.stringify(response.data));

    return response.data;
  } catch (error) {
    logger.error('Error getting trending videos:', error.message);
    throw error;
  }
};

/**
 * Get popular videos
 */
const getPopularVideos = async (options = {}) => {
  try {
    const instance = await getWorkingInstance();
    const cacheKey = 'invidious_popular';

    // Check cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const response = await safeMakeRequest(`${instance}/api/v1/popular`, {
      timeout: 10000,
    });

    // Cache for 5 minutes
    await cacheService.setex(cacheKey, 300, JSON.stringify(response.data));

    return response.data;
  } catch (error) {
    logger.error('Error getting popular videos:', error.message);
    throw error;
  }
};

/**
 * Get video stream URL
 */
const getStreamUrl = async (videoId, options = {}) => {
  try {
    const instance = await getWorkingInstance();
    const videoDetails = await getVideoDetails(videoId);

    // Get the best quality format available
    const formats = videoDetails.formatStreams || [];
    const adaptiveFormats = videoDetails.adaptiveFormats || [];

    // Prefer regular formats (contain both audio and video)
    let bestFormat = formats[0];

    if (!bestFormat && adaptiveFormats.length > 0) {
      // If no regular format, use adaptive (video or audio only)
      bestFormat = adaptiveFormats[0];
    }

    if (!bestFormat) {
      throw new Error('No stream formats available');
    }

    return {
      url: bestFormat.url,
      quality: bestFormat.qualityLabel || bestFormat.bitrate,
      type: bestFormat.type,
      videoId,
      title: videoDetails.title,
    };
  } catch (error) {
    logger.error(`Error getting stream URL for ${videoId}:`, error.message);
    throw error;
  }
};

/**
 * Get subtitles for a video
 */
const getSubtitles = async (videoId) => {
  try {
    const instance = await getWorkingInstance();
    const cacheKey = `invidious_subtitles_${videoId}`;

    // Check cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const response = await safeMakeRequest(`${instance}/api/v1/captions/${videoId}`, {
      timeout: 10000,
    });

    // Cache for 24 hours
    await cacheService.setex(cacheKey, 86400, JSON.stringify(response.data));

    return response.data;
  } catch (error) {
    logger.error(`Error getting subtitles for ${videoId}:`, error.message);
    return null;
  }
};

/**
 * Configure custom Invidious instance
 * @param {string} instanceUrl - Custom instance URL
 */
const setCustomInstance = (instanceUrl) => {
  // SECURITY: Validate custom instance URL
  if (!isValidInvidiousUrl(instanceUrl)) {
    throw new Error(`SSRF protection: Invalid custom instance URL: ${instanceUrl}`);
  }
  
  // Add domain to allowed list if not already present
  try {
    const url = new URL(instanceUrl);
    if (!ALLOWED_DOMAINS.includes(url.hostname)) {
      ALLOWED_DOMAINS.push(url.hostname);
      logger.info(`Added custom domain to allowed list: ${url.hostname}`);
    }
  } catch (error) {
    logger.error('Error adding custom domain:', error.message);
  }
  
  CUSTOM_INSTANCE = instanceUrl;
  currentInstance = null; // Reset to test new instance
  logger.info(`Custom Invidious instance configured: ${instanceUrl}`);
};

/**
 * Get current instance status
 */
const getInstanceStatus = async () => {
  try {
    const instance = await getWorkingInstance();
    return {
      instance,
      status: 'OK',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      instance: null,
      status: 'ERROR',
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
};

module.exports = {
  searchVideos,
  getVideoDetails,
  getChannelInfo,
  getChannelVideos,
  getPlaylistInfo,
  getTrendingVideos,
  getPopularVideos,
  getStreamUrl,
  getSubtitles,
  setCustomInstance,
  getInstanceStatus,
  getWorkingInstance,
};
