const { getFirestore, Collections } = require('../config/firebase');
const logger = require('../../utils/logger');

class UserService {
  constructor() {
    this.db = getFirestore();
    this.usersCollection = this.db.collection(Collections.USERS);
  }

  /**
   * Create a new user
   */
  async createUser(userId, userData) {
    try {
      const userRef = this.usersCollection.doc(userId.toString());
      const user = {
        id: userId,
        username: userData.username || null,
        firstName: userData.firstName || null,
        lastName: userData.lastName || null,
        language: userData.language || 'en',
        plan: 'free',
        subscriptionStatus: 'inactive',
        planExpiry: null,
        location: null,
        bio: null,
        age: null,
        termsAccepted: false,
        onboardingCompleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await userRef.set(user);
      logger.info(`User created: ${userId}`);
      return user;
    } catch (error) {
      logger.error(`Error creating user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUser(userId) {
    try {
      const userDoc = await this.usersCollection.doc(userId.toString()).get();
      if (!userDoc.exists) {
        return null;
      }
      return { id: userDoc.id, ...userDoc.data() };
    } catch (error) {
      logger.error(`Error getting user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get or create user
   */
  async getOrCreateUser(userId, userData) {
    let user = await this.getUser(userId);
    if (!user) {
      user = await this.createUser(userId, userData);
    }
    return user;
  }

  /**
   * Update user data
   */
  async updateUser(userId, updates) {
    try {
      const userRef = this.usersCollection.doc(userId.toString());
      await userRef.update({
        ...updates,
        updatedAt: new Date(),
      });
      logger.info(`User updated: ${userId}`);
      return await this.getUser(userId);
    } catch (error) {
      logger.error(`Error updating user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Update user subscription
   */
  async updateSubscription(userId, planId, expiryDate) {
    try {
      await this.updateUser(userId, {
        plan: planId,
        subscriptionStatus: 'active',
        planExpiry: expiryDate,
      });
      logger.info(`Subscription updated for user ${userId}: ${planId}`);
    } catch (error) {
      logger.error(`Error updating subscription for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Check if user subscription is active
   */
  async isSubscriptionActive(userId) {
    const user = await this.getUser(userId);
    if (!user || user.subscriptionStatus !== 'active') {
      return false;
    }
    if (user.planExpiry && new Date(user.planExpiry) < new Date()) {
      await this.updateUser(userId, { subscriptionStatus: 'expired' });
      return false;
    }
    return true;
  }

  /**
   * Get all users (for broadcasting)
   */
  async getAllUsers() {
    try {
      const snapshot = await this.usersCollection.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      logger.error('Error getting all users:', error);
      throw error;
    }
  }

  /**
   * Search users by username
   */
  async searchUserByUsername(username) {
    try {
      const snapshot = await this.usersCollection
        .where('username', '==', username)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      logger.error(`Error searching user by username ${username}:`, error);
      throw error;
    }
  }

  /**
   * Get nearby users
   */
  async getNearbyUsers(lat, lng, radiusKm = 10) {
    try {
      // Simple bounding box calculation
      // For production, use geohashing or GeoFirestore
      const latDelta = radiusKm / 111.32; // 1 degree latitude ≈ 111.32 km
      const lngDelta = radiusKm / (111.32 * Math.cos(lat * Math.PI / 180));

      const snapshot = await this.usersCollection
        .where('location.lat', '>=', lat - latDelta)
        .where('location.lat', '<=', lat + latDelta)
        .get();

      const nearbyUsers = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(user => {
          if (!user.location) return false;
          const userLng = user.location.lng;
          return userLng >= lng - lngDelta && userLng <= lng + lngDelta;
        });

      return nearbyUsers;
    } catch (error) {
      logger.error('Error getting nearby users:', error);
      throw error;
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats() {
    try {
      const allUsers = await this.getAllUsers();
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const stats = {
        totalUsers: allUsers.length,
        activeSubscriptions: allUsers.filter(u => u.subscriptionStatus === 'active').length,
        newUsersLast30Days: allUsers.filter(u => new Date(u.createdAt) >= thirtyDaysAgo).length,
        byPlan: {},
      };

      allUsers.forEach(user => {
        const plan = user.plan || 'free';
        stats.byPlan[plan] = (stats.byPlan[plan] || 0) + 1;
      });

      return stats;
    } catch (error) {
      logger.error('Error getting user stats:', error);
      throw error;
    }
  }
}

module.exports = new UserService();
