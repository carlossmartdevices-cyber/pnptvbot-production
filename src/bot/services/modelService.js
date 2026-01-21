const { query } = require('../../config/postgres');
const logger = require('../../utils/logger');

/**
 * Model Service - Manages models for Meet & Greet system
 */
class ModelService {
  /**
   * Create a new model
   * @param {Object} modelData - Model data
   * @returns {Promise<Object>} Created model
   */
  static async createModel(modelData) {
    try {
      const { name, username, bio, profile_image_url, is_active = true } = modelData;
      
      const result = await query(
        `INSERT INTO models (name, username, bio, profile_image_url, is_active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [name, username, bio, profile_image_url, is_active]
      );
      
      logger.info('Model created successfully', { modelId: result.id, username });
      return result;
    } catch (error) {
      logger.error('Error creating model:', error);
      throw new Error('Failed to create model');
    }
  }

  /**
   * Get model by ID
   * @param {number} modelId - Model ID
   * @returns {Promise<Object|null>} Model or null if not found
   */
  static async getModelById(modelId) {
    try {
      const result = await query(
        `SELECT * FROM models WHERE id = $1`,
        [modelId]
      );
      
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      logger.error('Error getting model by ID:', error);
      throw new Error('Failed to get model');
    }
  }

  /**
   * Get model by username
   * @param {string} username - Model username
   * @returns {Promise<Object|null>} Model or null if not found
   */
  static async getModelByUsername(username) {
    try {
      const result = await query(
        `SELECT * FROM models WHERE username = $1`,
        [username]
      );
      
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      logger.error('Error getting model by username:', error);
      throw new Error('Failed to get model');
    }
  }

  /**
   * Get all active models
   * @returns {Promise<Array>} Array of active models
   */
  static async getAllActiveModels() {
    try {
      const result = await query(
        `SELECT * FROM models WHERE is_active = TRUE ORDER BY name`
      );
      
      return result;
    } catch (error) {
      logger.error('Error getting active models:', error);
      throw new Error('Failed to get active models');
    }
  }

  /**
   * Update model
   * @param {number} modelId - Model ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated model
   */
  static async updateModel(modelId, updateData) {
    try {
      const { name, username, bio, profile_image_url, is_active } = updateData;
      
      const result = await query(
        `UPDATE models
         SET name = COALESCE($1, name),
             username = COALESCE($2, username),
             bio = COALESCE($3, bio),
             profile_image_url = COALESCE($4, profile_image_url),
             is_active = COALESCE($5, is_active),
             updated_at = NOW()
         WHERE id = $6
         RETURNING *`,
        [name, username, bio, profile_image_url, is_active, modelId]
      );
      
      if (result.length === 0) {
        throw new Error('Model not found');
      }
      
      logger.info('Model updated successfully', { modelId });
      return result[0];
    } catch (error) {
      logger.error('Error updating model:', error);
      throw new Error('Failed to update model');
    }
  }

  /**
   * Delete model (soft delete - mark as inactive)
   * @param {number} modelId - Model ID
   * @returns {Promise<boolean>} True if successful
   */
  static async deleteModel(modelId) {
    try {
      const result = await query(
        `UPDATE models
         SET is_active = FALSE, updated_at = NOW()
         WHERE id = $1
         RETURNING id`,
        [modelId]
      );
      
      if (result.length === 0) {
        throw new Error('Model not found');
      }
      
      logger.info('Model deleted successfully', { modelId });
      return true;
    } catch (error) {
      logger.error('Error deleting model:', error);
      throw new Error('Failed to delete model');
    }
  }

  /**
   * Get models with availability
   * @param {Date} startDate - Start date for availability
   * @param {Date} endDate - End date for availability
   * @returns {Promise<Array>} Models with availability
   */
  static async getModelsWithAvailability(startDate, endDate) {
    try {
      const result = await query(
        `SELECT m.*,
                COUNT(ma.id) AS available_slots
         FROM models m
         LEFT JOIN model_availability ma 
           ON m.id = ma.model_id 
           AND ma.is_booked = FALSE
           AND ma.available_from >= $1
           AND ma.available_to <= $2
         WHERE m.is_active = TRUE
         GROUP BY m.id
         HAVING COUNT(ma.id) > 0
         ORDER BY m.name`,
        [startDate, endDate]
      );
      
      return result;
    } catch (error) {
      logger.error('Error getting models with availability:', error);
      throw new Error('Failed to get models with availability');
    }
  }
}

module.exports = ModelService;