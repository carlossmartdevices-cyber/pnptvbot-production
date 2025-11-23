/**
 * Database module - Re-exports PostgreSQL functions
 * This module provides a unified database interface
 */
const postgres = require('./postgres');

// Export pool-like interface for models that use pool.query()
const pool = {
  query: postgres.query,
  connect: async () => postgres.getPool().connect(),
  end: postgres.closePool
};

module.exports = pool;

// Also export named functions for flexibility
module.exports.query = postgres.query;
module.exports.getPool = postgres.getPool;
module.exports.testConnection = postgres.testConnection;
module.exports.closePool = postgres.closePool;
module.exports.initializePostgres = postgres.initializePostgres;
