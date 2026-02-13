/**
 * BlockedUser Model
 * Tracks blocked user relationships for privacy
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BlockedUser = sequelize.define(
    'BlockedUser',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      blocked_user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      blocked_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    },
    {
      tableName: 'blocked_users',
      timestamps: false,
      indexes: [
        {
          fields: ['user_id']
        },
        {
          fields: ['blocked_user_id']
        },
        {
          unique: true,
          fields: ['user_id', 'blocked_user_id']
        }
      ]
    }
  );

  /**
   * Static Methods
   */

  /**
   * Block a user
   */
  BlockedUser.blockUser = async function(userId, userToBlockId) {
    if (userId === userToBlockId) {
      throw new Error('Cannot block yourself');
    }

    return this.findOrCreate({
      where: {
        user_id: userId,
        blocked_user_id: userToBlockId
      },
      defaults: {
        user_id: userId,
        blocked_user_id: userToBlockId,
        blocked_at: new Date()
      }
    });
  };

  /**
   * Unblock a user
   */
  BlockedUser.unblockUser = async function(userId, userToUnblockId) {
    return this.destroy({
      where: {
        user_id: userId,
        blocked_user_id: userToUnblockId
      }
    });
  };

  /**
   * Check if user is blocked
   */
  BlockedUser.isBlocked = async function(userId, blockedUserId) {
    const block = await this.findOne({
      where: {
        user_id: userId,
        blocked_user_id: blockedUserId
      }
    });

    return !!block;
  };

  /**
   * Get list of users blocked by a user
   */
  BlockedUser.getBlockedByUser = async function(userId) {
    return this.findAll({
      where: { user_id: userId },
      attributes: ['blocked_user_id', 'blocked_at'],
      include: [
        {
          association: 'blockedUserDetails',
          model: sequelize.models.User,
          foreignKey: 'blocked_user_id',
          attributes: ['id', 'username', 'first_name', 'avatar_url']
        }
      ]
    });
  };

  /**
   * Get list of users who blocked this user
   */
  BlockedUser.getBlockedByOthers = async function(userId) {
    return this.findAll({
      where: { blocked_user_id: userId },
      attributes: ['user_id', 'blocked_at'],
      include: [
        {
          association: 'blockerUserDetails',
          model: sequelize.models.User,
          foreignKey: 'user_id',
          attributes: ['id', 'username', 'first_name', 'avatar_url']
        }
      ]
    });
  };

  /**
   * Get all blocked relationships for a user (both directions)
   */
  BlockedUser.getBlockedRelationships = async function(userId) {
    return this.findAll({
      where: {
        [sequelize.Op.or]: [
          { user_id: userId },
          { blocked_user_id: userId }
        ]
      }
    });
  };

  /**
   * Clear old blocks (older than 30 days)
   */
  BlockedUser.clearOldBlocks = async function(daysOld = 30) {
    const cutoffTime = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    // Delete blocks, but keep recent ones (blocks stay active)
    // Uncomment if you want to auto-unblock after time:
    /*
    return this.destroy({
      where: {
        blocked_at: {
          [sequelize.Op.lt]: cutoffTime
        }
      }
    });
    */

    // For now, just return stats
    const count = await this.count({
      where: {
        blocked_at: {
          [sequelize.Op.lt]: cutoffTime
        }
      }
    });

    return { oldBlocksCount: count };
  };

  return BlockedUser;
};
