const logger = require('../utils/logger');
const { query } = require('../utils/db');
const meruLinkService = require('./meruLinkService');
const paymentHistoryService = require('./paymentHistoryService');

/**
 * PASO 1️⃣: INICIALIZACIÓN DEL SISTEMA
 *
 * MeruLinkInitializer - Inicializa el sistema de tracking de links de Meru
 * Se ejecuta al arrancar la aplicación
 *
 * Crea:
 * 1. Tabla meru_payment_links en BD
 * 2. Tabla payment_history en BD
 * 3. Carga los links conocidos de Meru
 *
 * Referencia: MERU_PAYMENT_FLOW_DETAILED.md - PASO 1️⃣
 */
class MeruLinkInitializer {
  /**
   * Inicializa todo el sistema de Meru en paralelo
   * @returns {Promise<boolean>}
   */
  async initialize() {
    try {
      logger.info('🔵 PASO 1️⃣: Inicializando sistema de tracking de Meru...');

      // Crear tablas en paralelo (sin bloquear)
      Promise.all([
        this.createPaymentHistoryTable().catch(e => logger.warn('⚠️  Creación de payment_history falló:', e.message)),
        this.createMeruLinksTable().catch(e => logger.warn('⚠️  Creación de meru_payment_links falló:', e.message)),
        this.initializeKnownLinks().catch(e => logger.warn('⚠️  Inicialización de links falló:', e.message))
      ]).then(() => {
        logger.info('✅ 1.1 Sistema de tracking de Meru inicializado');
      });

      return true;
    } catch (error) {
      logger.error('❌ Error inicializando sistema Meru:', error);
      return false;
    }
  }

  async createPaymentHistoryTable() {
    try {
      // Create payment_history table
      await query(`
        CREATE TABLE IF NOT EXISTS payment_history (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          payment_method VARCHAR(50) NOT NULL,
          amount DECIMAL(12, 2) NOT NULL,
          currency VARCHAR(10) DEFAULT 'USD',
          plan_id VARCHAR(100),
          plan_name VARCHAR(255),
          product VARCHAR(100),
          payment_reference VARCHAR(255) NOT NULL UNIQUE,
          provider_transaction_id VARCHAR(255),
          provider_payment_id VARCHAR(255),
          webhook_data JSONB,
          status VARCHAR(50) DEFAULT 'completed',
          payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          ip_address INET,
          user_agent TEXT,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes (run in parallel, don't wait for all)
      Promise.allSettled([
        query(`CREATE INDEX IF NOT EXISTS idx_payment_history_user_id ON payment_history(user_id)`),
        query(`CREATE INDEX IF NOT EXISTS idx_payment_history_payment_date ON payment_history(payment_date DESC)`),
        query(`CREATE INDEX IF NOT EXISTS idx_payment_history_reference ON payment_history(payment_reference)`)
      ]).catch(() => {});

      // Add columns to users table if they don't exist
      await query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMP,
        ADD COLUMN IF NOT EXISTS last_payment_amount DECIMAL(12, 2),
        ADD COLUMN IF NOT EXISTS last_payment_method VARCHAR(50),
        ADD COLUMN IF NOT EXISTS last_payment_reference VARCHAR(255)
      `);

      // Create index on users
      await query(`
        CREATE INDEX IF NOT EXISTS idx_users_last_payment_date ON users(last_payment_date)
      `);

      logger.info('✓ payment_history table created');
    } catch (error) {
      logger.error('Error creating payment_history table:', error);
      throw error;
    }
  }

  /**
   * PASO 1.1️⃣: Crear tabla meru_payment_links en BD
   *
   * Estructura:
   * - code: Código único del link (ej: "LSJUek")
   * - meru_link: URL completa del link (ej: "https://pay.getmeru.com/LSJUek")
   * - status: Estado actual ('active', 'used', 'expired', 'invalid')
   * - used_by: ID del usuario que activó el link
   * - used_by_username: Username del usuario que activó el link
   * - used_at: Timestamp de cuando se activó
   */
  async createMeruLinksTable() {
    try {
      logger.info('🔵 PASO 1.1️⃣: Creando tabla meru_payment_links...');

      // Crear tabla principal con estructura de tracking
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

      // Crear índices para búsquedas rápidas
      Promise.allSettled([
        query(`CREATE INDEX IF NOT EXISTS idx_meru_links_status ON meru_payment_links(status)`),
        query(`CREATE INDEX IF NOT EXISTS idx_meru_links_code ON meru_payment_links(code)`)
      ]).catch(() => {});

      logger.info('✅ 1.1 Tabla meru_payment_links creada');
    } catch (error) {
      logger.error('❌ Error creando tabla meru_payment_links:', error);
      throw error;
    }
  }

  /**
   * PASO 1.2️⃣: Cargar links conocidos en BD
   *
   * Se cargan 10 links predefinidos de Meru
   * Cada link:
   * - Tiene un código único (ej: "LSJUek")
   * - Se inserta con status = 'active'
   * - Está listo para ser usado por usuarios
   */
  async initializeKnownLinks() {
    try {
      logger.info('🔵 PASO 1.2️⃣: Cargando links conocidos de Meru...');

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

      logger.info(`✅ 1.2 Cargados ${addedCount}/${knownLinks.length} links de Meru`);
    } catch (error) {
      logger.error('❌ Error inicializando links de Meru:', error);
      throw error;
    }
  }
}

module.exports = new MeruLinkInitializer();
