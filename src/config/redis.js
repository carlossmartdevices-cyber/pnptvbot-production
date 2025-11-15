const Redis = require('ioredis');
const logger = require('../utils/logger');

let redisClient = null;

/**
 * Initialize Redis client
 * @returns {Redis} Redis client instance
 */
const initializeRedis = () => {
  try {
    if (redisClient) {
      return redisClient;
    }

    const config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      db: parseInt(process.env.REDIS_DB || '0', 10),
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    };

    if (process.env.REDIS_PASSWORD) {
      config.password = process.env.REDIS_PASSWORD;
    }

    redisClient = new Redis(config);

    redisClient.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    redisClient.on('error', (err) => {
      logger.error('Redis connection error:', err);
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    return redisClient;
  } catch (error) {
    logger.error('Failed to initialize Redis:', error);
    throw error;
  }
};

/**
 * Get Redis client instance
 * @returns {Redis}
 */
const getRedis = () => {
  if (!redisClient) {
    return initializeRedis();
  }
  return redisClient;
};

/**
 * Cache helper functions
 */
const cache = {
  /**
   * Get cached value
   * @param {string} key - Cache key
   * @returns {Promise<any>} Cached value or null
   */
  async get(key) {
    try {
      const client = getRedis();
      const value = await client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  },

  /**
   * Set cache value with optional TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds (default from env)
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value, ttl = null) {
    try {
      const client = getRedis();
      const stringValue = JSON.stringify(value);
      const cacheTTL = ttl || parseInt(process.env.REDIS_TTL || '300', 10);

      await client.set(key, stringValue, 'EX', cacheTTL);
      return true;
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  },

  /**
   * Delete cached value
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Success status
   */
  async del(key) {
    try {
      const client = getRedis();
      await client.del(key);
      return true;
    } catch (error) {
      logger.error('Cache delete error:', error);
      return false;
    }
  },

  /**
   * Delete all keys matching pattern
   * @param {string} pattern - Key pattern (e.g., 'user:*')
   * @returns {Promise<number>} Number of deleted keys
   */
  async delPattern(pattern) {
    try {
      const client = getRedis();
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(...keys);
        return keys.length;
      }
      return 0;
    } catch (error) {
      logger.error('Cache delete pattern error:', error);
      return 0;
    }
  },

  /**
   * Check if key exists
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Existence status
   */
  async exists(key) {
    try {
      const client = getRedis();
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error:', error);
      return false;
    }
  },

  /**
   * Increment counter
   * @param {string} key - Cache key
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<number>} New value
   */
  async incr(key, ttl = 3600) {
    try {
      const client = getRedis();
      const value = await client.incr(key);
      if (value === 1) {
        await client.expire(key, ttl);
      }
      return value;
    } catch (error) {
      logger.error('Cache increment error:', error);
      return 0;
    }
  },

  /**
   * Set a key only if it doesn't exist (idempotency)
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<boolean>} True if key was set, false if already exists
   */
  async setNX(key, value, ttl = 3600) {
    try {
      const client = getRedis();
      const stringValue = JSON.stringify(value);
      const result = await client.set(key, stringValue, 'EX', ttl, 'NX');
      return result === 'OK';
    } catch (error) {
      logger.error('Cache setNX error:', error);
      return false;
    }
  },

  /**
   * Acquire a lock for idempotent operations
   * @param {string} lockKey - Lock identifier
   * @param {number} ttl - Lock duration in seconds (default 300s = 5 min)
   * @returns {Promise<boolean>} True if lock acquired, false if already locked
   */
  async acquireLock(lockKey, ttl = 300) {
    return this.setNX(`lock:${lockKey}`, { acquiredAt: new Date().toISOString() }, ttl);
  },

  /**
   * Release a lock
   * @param {string} lockKey - Lock identifier
   * @returns {Promise<boolean>} Success status
   */
  async releaseLock(lockKey) {
    return this.del(`lock:${lockKey}`);
  },
};

/**
 * Close Redis connection
 */
const closeRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
};

module.exports = {
  initializeRedis,
  getRedis,
  cache,
  closeRedis,
};
