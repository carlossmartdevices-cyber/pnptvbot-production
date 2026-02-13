const puppeteer = require('puppeteer');
const logger = require('../utils/logger');
const meruLinkService = require('./meruLinkService');

/**
 * PASO 4️⃣: BOT VERIFICA PAGO CON PUPPETEER
 *
 * MeruPaymentService - Verifica pagos de Meru usando navegador headless
 * Accede a la URL de Meru y analiza el contenido HTML/visible
 * para determinar si el link fue pagado
 *
 * Flujo:
 * 1. Inicia navegador Puppeteer headless
 * 2. Navega a https://pay.getmeru.com/{codigo}
 * 3. Espera a que se cargue JavaScript
 * 4. Busca patrones de pago en el contenido
 * 5. Retorna isPaid: true/false
 *
 * Referencia: MERU_PAYMENT_FLOW_DETAILED.md - PASO 4️⃣
 */
class MeruPaymentService {
  constructor() {
    this.browser = null;
  }

  /**
   * Subpaso A: Inicializar navegador headless
   * Se ejecuta una sola vez (singleton pattern)
   *
   * Configuración:
   * - headless: 'new' (modo sin interfaz gráfica)
   * - --no-sandbox: Desactiva sandbox para Docker
   * - --disable-dev-shm-usage: Evita problemas de memoria
   */
  async initBrowser() {
    if (this.browser) return this.browser;

    try {
      logger.info('🔵 Subpaso A: Inicializando navegador Puppeteer...');

      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage', // Necesario para Docker
        ],
      });
      logger.info('✅ Navegador Puppeteer inicializado');
      return this.browser;
    } catch (error) {
      logger.error('❌ Error inicializando navegador Puppeteer:', error);
      throw error;
    }
  }

  /**
   * Verifica si un link de Meru fue pagado
   *
   * Flujo:
   * 1. Subpaso B: Crear nueva pestaña del navegador
   * 2. Subpaso C: Navegar a la URL de Meru
   * 3. Subpaso D: Esperar a que se cargue JavaScript
   * 4. Subpaso 4.3: Analizar la respuesta
   *
   * @param {string} meruCode - Código del link (ej: "LSJUek")
   * @param {string} userLanguage - Idioma del usuario ('es' o 'en')
   * @returns {Promise<{isPaid: boolean, message: string, rawContent: string, visibleText: string}>}
   */
  async verifyPayment(meruCode, userLanguage = 'es') {
    let page = null;
    try {
      logger.info(`🔵 PASO 4️⃣: Verificando pago de Meru para código: ${meruCode}`);

      const browser = await this.initBrowser();

      // Subpaso B: Crear nueva pestaña
      logger.info('🔵 Subpaso B: Creando nueva pestaña del navegador...');
      page = await browser.newPage();

      // Configurar idioma según el usuario
      const languageMap = {
        es: 'es-ES,es;q=0.9,en;q=0.8',
        en: 'en-US,en;q=0.9,es;q=0.8',
      };
      const acceptLanguage = languageMap[userLanguage] || 'es-ES,es;q=0.9,en;q=0.8';

      await page.setExtraHTTPHeaders({
        'Accept-Language': acceptLanguage,
      });

      // Timeout de 15 segundos para la página
      await page.setDefaultTimeout(15000);

      // Subpaso C: Navegar a la URL de Meru
      logger.info('🔵 Subpaso C: Navegando a la URL de Meru...');
      const meruUrl = `https://pay.getmeru.com/${meruCode}`;
      logger.info(`📍 URL: ${meruUrl}`);

      await page.goto(meruUrl, { waitUntil: 'networkidle2' });

      // Subpaso D: Esperar a que se cargue JavaScript
      logger.info('🔵 Subpaso D: Leyendo contenido HTML después de JavaScript...');
      const pageContent = await page.content();

      // Esperar 1 segundo más para animaciones
      await page.waitForTimeout(1000);

      // Obtener texto visible en la página
      const visibleText = await page.evaluate(() => {
        return document.body.innerText;
      });

      logger.info(`✅ Página de Meru cargada`, {
        contentLength: pageContent.length,
        textLength: visibleText.length,
      });

      // Subpaso 4.3: Analizar la respuesta
      logger.info('🔵 Subpaso 4.3: Analizando patrones de pago...');
      let paidPatterns = [];

      if (userLanguage === 'es') {
        paidPatterns = [
          'El enlace de pago ha caducado o ya ha sido pagado',
          'El link de pago ha caducado',
          'ya ha sido pagado',
        ];
      } else {
        paidPatterns = [
          'Payment link expired or already paid',
          'payment link has expired',
          'already paid',
        ];
      }

      const isPaid = paidPatterns.some(
        (pattern) =>
          pageContent.includes(pattern) || visibleText.includes(pattern)
      );

      if (isPaid) {
        logger.info(`✅ Pago confirmado para ${meruCode}: isPaid=true`);
      } else {
        logger.info(`⚠️  Link aún activo para ${meruCode}: isPaid=false`);
      }

      return {
        isPaid,
        message: isPaid
          ? 'Payment link already used or expired'
          : 'Payment link is still active',
        rawContent: pageContent.substring(0, 2000),
        visibleText: visibleText.substring(0, 1000),
      };
    } catch (error) {
      logger.error(`❌ Error verificando pago Meru ${meruCode}:`, error);
      return {
        isPaid: false,
        message: `Error checking payment: ${error.message}`,
        rawContent: null,
        visibleText: null,
      };
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
    }
  }

  /**
   * Cierra el navegador (llamar cuando se apague la aplicación)
   */
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.info('Puppeteer browser closed');
    }
  }
}

// Singleton
const meruPaymentService = new MeruPaymentService();

// Cleanup al apagar
process.on('SIGTERM', async () => {
  await meruPaymentService.closeBrowser();
});

process.on('SIGINT', async () => {
  await meruPaymentService.closeBrowser();
});

module.exports = meruPaymentService;
