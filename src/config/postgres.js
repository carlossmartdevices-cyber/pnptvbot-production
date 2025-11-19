const { Pool } = require('pg');
const logger = require('../utils/logger');

// PostgreSQL connection pool
let pool = null;

/**
 * Initialize PostgreSQL connection pool
 */
function initializePostgres() {
  if (pool) return pool;

  try {
    pool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.POSTGRES_PORT || 55432,
      database: process.env.POSTGRES_DATABASE || 'pnptvbot',
      user: process.env.POSTGRES_USER || 'pnptvbot',
      password: process.env.POSTGRES_PASSWORD || 'pnptvbot_secure_pass_2025',
      max: 20, // maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      logger.error('Unexpected PostgreSQL pool error:', err);
    });

    pool.on('connect', () => {
      logger.debug('New PostgreSQL client connected');
    });

    logger.info('PostgreSQL pool initialized successfully');
    return pool;
  } catch (error) {
    logger.error('Failed to initialize PostgreSQL pool:', error);
    throw error;
  }
}

/**
 * Get PostgreSQL pool
 */
function getPool() {
  if (!pool) {
    return initializePostgres();
  }
  return pool;
}

/**
 * Execute a query
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function query(text, params) {
  const start = Date.now();
  if (!pool) {
    initializePostgres();
  }
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    logger.error('Query error:', { text, error: error.message, stack: error.stack, fullError: error });
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 * @returns {Promise<Object>} PostgreSQL client
 */
async function getClient() {
  return await pool.connect();
}

/**
 * Close the pool
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('PostgreSQL pool closed');
  }
}

/**
 * Test database connection
 */
async function testConnection() {
  try {
    const result = await query('SELECT NOW()');
    logger.info('PostgreSQL connection test successful', { time: result.rows[0].now });
    return true;
  } catch (error) {
    logger.error('PostgreSQL connection test failed:', error);
    return false;
  }
}

module.exports = {
  initializePostgres,
  getPool,
  query,
  getClient,
  closePool,
  testConnection,
};
