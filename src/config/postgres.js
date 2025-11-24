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
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
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
    await pool.end();
    pool = null;
    logger.info('PostgreSQL pool closed');
  }
};

/**
 * Get a client from the pool
 * @returns {Promise<Object>} PostgreSQL client
 */
const getClient = async () => {
  return await getPool().connect();
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
  logger.debug('Executed query', { text, duration, rows: result.rowCount });
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
