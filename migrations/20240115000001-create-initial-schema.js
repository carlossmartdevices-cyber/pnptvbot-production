const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create users table
    await queryInterface.createTable('users', {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        allowNull: false,
        comment: 'Telegram user ID',
      },
      username: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      first_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      last_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: true,
        unique: true,
      },
      language: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'en',
      },
      bio: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      photo_file_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      location: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'JSON object with lat, lng, address',
      },
      interests: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
      },
      subscription_status: {
        type: DataTypes.ENUM('free', 'active', 'expired', 'deactivated'),
        allowNull: false,
        defaultValue: 'free',
      },
      plan_id: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      plan_expiry: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      onboarding_complete: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Create indexes for users table
    await queryInterface.addIndex('users', ['subscription_status', 'plan_expiry'], {
      name: 'idx_users_subscription',
    });
    await queryInterface.addIndex('users', ['email'], {
      name: 'idx_users_email',
      unique: true,
      where: {
        email: {
          [Sequelize.Op.ne]: null,
        },
      },
    });
    await queryInterface.addIndex('users', {
      fields: ['location'],
      using: 'GIN',
      name: 'idx_users_location',
    });

    // Create plans table
    await queryInterface.createTable('plans', {
      id: {
        type: DataTypes.STRING(50),
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      name_es: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      currency: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'USD',
      },
      duration: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 30,
        comment: 'Duration in days',
      },
      features: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false,
        defaultValue: [],
      },
      features_es: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false,
        defaultValue: [],
      },
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Create index for active plans
    await queryInterface.addIndex('plans', ['active', 'price'], {
      name: 'idx_plans_active_price',
    });

    // Create payments table
    await queryInterface.createTable('payments', {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      user_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      plan_id: {
        type: DataTypes.STRING(50),
        allowNull: false,
        references: {
          model: 'plans',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      currency: {
        type: DataTypes.STRING(10),
        allowNull: false,
      },
      provider: {
        type: DataTypes.ENUM('epayco', 'daimo'),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('pending', 'success', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      transaction_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
        unique: true,
      },
      payment_url: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      completed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      failed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Create indexes for payments table
    await queryInterface.addIndex('payments', ['user_id', 'created_at'], {
      name: 'idx_payments_user_created',
    });
    await queryInterface.addIndex('payments', ['status'], {
      name: 'idx_payments_status',
    });
    await queryInterface.addIndex('payments', ['transaction_id'], {
      name: 'idx_payments_transaction',
      unique: true,
      where: {
        transaction_id: {
          [Sequelize.Op.ne]: null,
        },
      },
    });
    await queryInterface.addIndex('payments', ['provider', 'status'], {
      name: 'idx_payments_provider_status',
    });

    // Create live_streams table
    await queryInterface.createTable('live_streams', {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      user_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      is_paid: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      stream_url: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('scheduled', 'live', 'ended'),
        allowNull: false,
        defaultValue: 'scheduled',
      },
      viewer_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      started_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      ended_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Create indexes for live_streams table
    await queryInterface.addIndex('live_streams', ['status', 'created_at'], {
      name: 'idx_live_streams_status_created',
    });
    await queryInterface.addIndex('live_streams', ['user_id'], {
      name: 'idx_live_streams_user',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('live_streams');
    await queryInterface.dropTable('payments');
    await queryInterface.dropTable('plans');
    await queryInterface.dropTable('users');
  },
};
