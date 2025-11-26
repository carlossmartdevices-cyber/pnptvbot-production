const { Pool } = require('pg');
const logger = require('../utils/logger');

let pool = null;

/**
 * Initialize PostgreSQL connection pool
 * @returns {Pool} PostgreSQL pool instance
 */
const initializePostgres = () => {
  if (pool) {
    return pool;
  }

  try {
    // Build connection string if DATABASE_URL is not set
    let connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      const host = process.env.POSTGRES_HOST || 'localhost';
      const port = process.env.POSTGRES_PORT || '5432';
      const database = process.env.POSTGRES_DATABASE || 'pnptvbot';
      const user = process.env.POSTGRES_USER || 'pnptvbot';
      const password = process.env.POSTGRES_PASSWORD || '';
      connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}`;
    }
    pool = new Pool({
      connectionString,
      ssl: process.env.POSTGRES_SSL === 'true'
        ? (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test'
            ? { rejectUnauthorized: false }
            : true)
        : false,
      max: process.env.POSTGRES_POOL_MAX ? parseInt(process.env.POSTGRES_POOL_MAX) : 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      logger.error('Unexpected PostgreSQL pool error:', err);
    });

    logger.info('PostgreSQL pool initialized successfully');
    return pool;
  } catch (error) {
    logger.error('Failed to initialize PostgreSQL pool:', error);
    throw error;
  }
};

/**
 * Get PostgreSQL pool instance
 * @returns {Pool} PostgreSQL pool instance
 */
const getPool = () => {
  if (!pool) {
    return initializePostgres();
  }
  return pool;
};

/**
 * Test PostgreSQL connection
 * @returns {Promise<boolean>} true if connection successful
 */
const testConnection = async () => {
  try {
    const client = await getPool().connect();
    await client.query('SELECT NOW()');
    client.release();
    logger.info('PostgreSQL connection successful');
    return true;
  } catch (error) {
    logger.error('PostgreSQL connection failed:', error);
    return false;
  }
};

/**
 * Close PostgreSQL pool
 * @returns {Promise<void>}
 */
const closePool = async () => {
  if (pool) {
    try {
      await pool.end();
      pool = null;
      logger.info('PostgreSQL pool closed');
    } catch (error) {
      logger.error('Error closing PostgreSQL pool:', error);
    }
  }
};

/**
 * Get a client from the pool with error handling
 * @returns {Promise<Object>} PostgreSQL client
 */
const getClient = async () => {
  try {
    const client = await getPool().connect();
    return client;
  } catch (error) {
    logger.error('Failed to get PostgreSQL client:', error);
    throw new Error('Database connection error');
  }
};

/**
 * Execute a query
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
const query = async (text, params) => {
  const start = Date.now();
  const result = await getPool().query(text, params);
  const duration = Date.now() - start;
  logger.debug('Executed query', { duration, rows: result.rowCount });
  return result;
};

module.exports = {
  initializePostgres,
  getPool,
  getClient,
  testConnection,
  closePool,
  query,
};
