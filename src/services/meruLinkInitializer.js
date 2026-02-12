const logger = require('../utils/logger');
const { query } = require('../utils/db');
const meruLinkService = require('./meruLinkService');

/**
 * Initialize Meru Link tracking system
 * Creates table and initializes with existing links from lifetime-pass.html
 */
class MeruLinkInitializer {
  async initialize() {
    try {
      logger.info('Initializing Meru Link tracking system...');

      // Create the table
      await this.createMeruLinksTable();

      // Initialize with known links from lifetime-pass.html
      await this.initializeKnownLinks();

      logger.info('✓ Meru Link tracking system initialized');
      return true;
    } catch (error) {
      logger.error('Error initializing Meru Link system:', error);
      return false;
    }
  }

  async createMeruLinksTable() {
    try {
      // Create the main table
      await query(`
        CREATE TABLE IF NOT EXISTS meru_payment_links (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          code VARCHAR(50) NOT NULL UNIQUE,
          meru_link VARCHAR(255) NOT NULL UNIQUE,
          product VARCHAR(100) DEFAULT 'lifetime-pass',
          status VARCHAR(50) DEFAULT 'active',
          activation_code VARCHAR(50),
          used_by VARCHAR(255),
          used_by_username VARCHAR(255),
          used_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          invalidated_at TIMESTAMP,
          invalidation_reason TEXT
        )
      `);

      // Create indexes
      await query(`
        CREATE INDEX IF NOT EXISTS idx_meru_links_status ON meru_payment_links(status);
        CREATE INDEX IF NOT EXISTS idx_meru_links_code ON meru_payment_links(code);
        CREATE INDEX IF NOT EXISTS idx_meru_links_used_by ON meru_payment_links(used_by);
        CREATE INDEX IF NOT EXISTS idx_meru_links_created_at ON meru_payment_links(created_at);
        CREATE INDEX IF NOT EXISTS idx_meru_links_activation_code ON meru_payment_links(activation_code)
      `);

      logger.info('✓ meru_payment_links table created');
    } catch (error) {
      logger.error('Error creating meru_payment_links table:', error);
      throw error;
    }
  }

  async initializeKnownLinks() {
    try {
      const knownLinks = [
        { code: 'LSJUek', url: 'https://pay.getmeru.com/LSJUek' },
        { code: 'FCqG-z', url: 'https://pay.getmeru.com/FCqG-z' },
        { code: 'MEz8OG', url: 'https://pay.getmeru.com/MEz8OG' },
        { code: '_DIFtk', url: 'https://pay.getmeru.com/_DIFtk' },
        { code: 'no4m1d', url: 'https://pay.getmeru.com/no4m1d' },
        { code: '9lDA6e', url: 'https://pay.getmeru.com/9lDA6e' },
        { code: 'SKYO2w', url: 'https://pay.getmeru.com/SKYO2w' },
        { code: 'm-3CVd', url: 'https://pay.getmeru.com/m-3CVd' },
        { code: 'daq_Ak', url: 'https://pay.getmeru.com/daq_Ak' },
        { code: '_26Hnr', url: 'https://pay.getmeru.com/_26Hnr' },
      ];

      let addedCount = 0;
      for (const link of knownLinks) {
        const success = await meruLinkService.addLink(link.code, link.url, 'lifetime-pass');
        if (success) addedCount++;
      }

      logger.info(`✓ Initialized ${addedCount}/${knownLinks.length} known Meru links`);
    } catch (error) {
      logger.error('Error initializing known Meru links:', error);
      throw error;
    }
  }
}

module.exports = new MeruLinkInitializer();
