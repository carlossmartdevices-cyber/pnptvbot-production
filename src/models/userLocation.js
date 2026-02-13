/**
 * UserLocation Model
 * Stores current user locations for geolocation features
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserLocation = sequelize.define(
    'UserLocation',
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
        onDelete: 'CASCADE',
        unique: true
      },
      latitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: false,
        validate: {
          min: -90,
          max: 90
        }
      },
      longitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: false,
        validate: {
          min: -180,
          max: 180
        }
      },
      accuracy: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0,
          max: 10000
        },
        comment: 'GPS accuracy in meters'
      },
      is_online: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      last_seen: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    },
    {
      tableName: 'user_locations',
      timestamps: false,
      indexes: [
        {
          fields: ['user_id']
        },
        {
          fields: ['updated_at']
        },
        {
          fields: ['is_online']
        }
      ]
    }
  );

  /**
   * Instance Methods
   */

  /**
   * Get distance to another user location
   */
  UserLocation.prototype.getDistanceTo = function(otherLatitude, otherLongitude) {
    const R = 6371; // Earth radius in km
    const dLat = ((otherLatitude - this.latitude) * Math.PI) / 180;
    const dLon = ((otherLongitude - this.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((this.latitude * Math.PI) / 180) *
        Math.cos((otherLatitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  };

  /**
   * Get accuracy description
   */
  UserLocation.prototype.getAccuracyDescription = function() {
    if (this.accuracy < 10) return 'Excellent';
    if (this.accuracy < 50) return 'Good';
    if (this.accuracy < 100) return 'Fair';
    if (this.accuracy < 500) return 'Poor';
    return 'Very Poor';
  };

  /**
   * Mark user as online
   */
  UserLocation.prototype.markOnline = async function() {
    this.is_online = true;
    this.last_seen = new Date();
    return this.save();
  };

  /**
   * Mark user as offline
   */
  UserLocation.prototype.markOffline = async function() {
    this.is_online = false;
    this.last_seen = new Date();
    return this.save();
  };

  /**
   * Static Methods
   */

  /**
   * Find or create user location
   */
  UserLocation.findOrCreate = async function(userId, latitude, longitude, accuracy) {
    const [location, created] = await this.findOrCreate({
      where: { user_id: userId },
      defaults: {
        user_id: userId,
        latitude,
        longitude,
        accuracy,
        is_online: true
      }
    });
    return { location, created };
  };

  /**
   * Update user location
   */
  UserLocation.updateUserLocation = async function(userId, latitude, longitude, accuracy) {
    const [location, created] = await this.upsert({
      user_id: userId,
      latitude,
      longitude,
      accuracy,
      is_online: true,
      last_seen: new Date()
    });
    return location;
  };

  /**
   * Get nearby users (using raw SQL with PostGIS)
   */
  UserLocation.getNearbyUsers = async function(
    latitude,
    longitude,
    radiusKm = 5,
    limit = 50
  ) {
    const query = `
      SELECT
        ul.id,
        ul.user_id,
        ul.latitude,
        ul.longitude,
        ul.accuracy,
        ul.is_online,
        u.first_name,
        u.username,
        u.avatar_url,
        ST_Distance(
          ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326),
          ul.geom
        ) * 111 AS distance_km
      FROM user_locations ul
      JOIN users u ON ul.user_id = u.id
      WHERE ul.is_online = TRUE
      AND ST_DWithin(
        ul.geom,
        ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326),
        :radius * 1000 / 111000
      )
      ORDER BY distance_km ASC
      LIMIT :limit
    `;

    return sequelize.query(query, {
      replacements: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radius: radiusKm,
        limit
      },
      type: sequelize.QueryTypes.SELECT
    });
  };

  /**
   * Get online users count
   */
  UserLocation.getOnlineCount = async function() {
    return this.count({
      where: { is_online: true }
    });
  };

  /**
   * Clear old locations (older than 24 hours and offline)
   */
  UserLocation.clearOldLocations = async function(hoursOld = 24) {
    const cutoffTime = new Date(Date.now() - hoursOld * 60 * 60 * 1000);

    return this.destroy({
      where: {
        is_online: false,
        last_seen: {
          [sequelize.Op.lt]: cutoffTime
        }
      }
    });
  };

  return UserLocation;
};
