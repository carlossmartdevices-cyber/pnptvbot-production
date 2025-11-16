const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

let sequelize = null;

/**
 * Initialize Sequelize database connection
 * @returns {Sequelize} Sequelize instance
 */
const initializeDatabase = () => {
  try {
    if (sequelize) {
      return sequelize;
    }

    const config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      dialect: 'postgres',
      logging: (msg) => logger.debug(msg),
      pool: {
        min: parseInt(process.env.DB_POOL_MIN || '2', 10),
        max: parseInt(process.env.DB_POOL_MAX || '10', 10),
        acquire: 30000,
        idle: 10000,
      },
      define: {
        timestamps: true,
        underscored: true,
      },
    };

    // Add SSL configuration if needed
    if (process.env.DB_SSL === 'true') {
      config.dialectOptions = {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      };
    }

    const database = process.env.DB_NAME || 'pnptv_bot';
    const username = process.env.DB_USER || 'pnptv_user';
    const password = process.env.DB_PASSWORD || '';

    sequelize = new Sequelize(database, username, password, config);

    // Test the connection
    sequelize
      .authenticate()
      .then(() => {
        logger.info('Database connection established successfully');
      })
      .catch((err) => {
        logger.error('Unable to connect to database:', err);
      });

    return sequelize;
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
};

/**
 * Get Sequelize database instance
 * @returns {Sequelize}
 */
const getDatabase = () => {
  if (!sequelize) {
    return initializeDatabase();
  }
  return sequelize;
};

/**
 * Close database connection
 */
const closeDatabase = async () => {
  if (sequelize) {
    await sequelize.close();
    sequelize = null;
    logger.info('Database connection closed');
  }
};

/**
 * Sync database models
 * @param {Object} options - Sequelize sync options
 * @returns {Promise<void>}
 */
const syncDatabase = async (options = {}) => {
  try {
    const db = getDatabase();
    await db.sync(options);
    logger.info('Database models synchronized');
  } catch (error) {
    logger.error('Error synchronizing database:', error);
    throw error;
  }
};

module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase,
  syncDatabase,
};
