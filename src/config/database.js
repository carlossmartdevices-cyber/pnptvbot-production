const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

let sequelize = null;

/**
 * Initialize PostgreSQL connection with Sequelize
 * @returns {Sequelize} Sequelize instance
 */
const initializeDatabase = () => {
  if (sequelize) {
    return sequelize;
  }

  try {
    const config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'pnptv_bot',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      dialect: 'postgres',
      logging: process.env.NODE_ENV === 'development' ? (msg) => logger.debug(msg) : false,
      pool: {
        max: parseInt(process.env.DB_POOL_MAX || '10', 10),
        min: parseInt(process.env.DB_POOL_MIN || '2', 10),
        acquire: 30000,
        idle: 10000,
      },
      define: {
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    };

    sequelize = new Sequelize(config);

    logger.info('PostgreSQL connection initialized');
    return sequelize;
  } catch (error) {
    logger.error('Failed to initialize PostgreSQL:', error);
    throw error;
  }
};

/**
 * Get Sequelize instance
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
 * @returns {Promise<boolean>}
 */
const testConnection = async () => {
  try {
    const db = getDatabase();
    await db.authenticate();
    logger.info('PostgreSQL connection established successfully');
    return true;
  } catch (error) {
    logger.error('Unable to connect to PostgreSQL:', error);
    return false;
  }
};

/**
 * Sync all models (use only in development)
 * @param {Object} options - Sync options
 * @returns {Promise<void>}
 */
const syncDatabase = async (options = {}) => {
  try {
    const db = getDatabase();
    await db.sync(options);
    logger.info('Database synchronized successfully');
  } catch (error) {
    logger.error('Error synchronizing database:', error);
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
    logger.info('PostgreSQL connection closed');
  }
};

module.exports = {
  initializeDatabase,
  getDatabase,
  testConnection,
  syncDatabase,
  closeDatabase,
  Sequelize,
};
