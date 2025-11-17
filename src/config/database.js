const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

let sequelize = null;

/**
 * Initialize Sequelize connection to PostgreSQL
 * @returns {Sequelize} Sequelize instance
 */
const initializeDatabase = () => {
  try {
    if (sequelize) {
      return sequelize;
    }

    const {
      DB_HOST = 'localhost',
      DB_PORT = 5432,
      DB_NAME = 'pnptv_bot',
      DB_USER = 'pnptv_user',
      DB_PASSWORD = 'pnptv_password',
      DB_SSL = 'false',
    } = process.env;

    sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
      host: DB_HOST,
      port: parseInt(DB_PORT, 10),
      dialect: 'postgres',
      logging: false, // Set to console.log for debugging
      pool: {
        max: parseInt(process.env.DB_POOL_MAX || 10, 10),
        min: parseInt(process.env.DB_POOL_MIN || 2, 10),
        acquire: 30000,
        idle: 10000,
      },
      dialectOptions: {
        ssl: DB_SSL === 'true' ? { require: true, rejectUnauthorized: false } : false,
      },
      define: {
        timestamps: true,
        underscored: true,
      },
    });

    logger.info('Sequelize database connection configured');
    return sequelize;
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
};

/**
 * Get Sequelize instance
 * Creates connection if not already created
 * @returns {Sequelize}
 */
const getDatabase = () => {
  if (!sequelize) {
    return initializeDatabase();
  }
  return sequelize;
};

/**
 * Test database connection
 * @returns {Promise<boolean>} true if connection successful
 */
const testConnection = async () => {
  try {
    const db = getDatabase();
    await db.authenticate();
    logger.info(' Database connection successful');
    return true;
  } catch (error) {
    logger.error('Database connection failed:', error);
    return false;
  }
};

/**
 * Sync all models with database
 * @param {Object} options - Sync options (e.g., { alter: true })
 * @returns {Promise<void>}
 */
const syncDatabase = async (options = {}) => {
  try {
    const db = getDatabase();
    await db.sync({ ...options });
    logger.info(' Database models synced successfully');
  } catch (error) {
    logger.error('Failed to sync database models:', error);
    throw error;
  }
};

/**
 * Close database connection
 * @returns {Promise<void>}
 */
const closeDatabase = async () => {
  if (sequelize) {
    await sequelize.close();
    sequelize = null;
    logger.info('Database connection closed');
  }
};

module.exports = {
  initializeDatabase,
  getDatabase,
  testConnection,
  syncDatabase,
  closeDatabase,
};
