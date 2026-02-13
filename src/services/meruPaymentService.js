const puppeteer = require('puppeteer');
const logger = require('../utils/logger');
const meruLinkService = require('./meruLinkService');

/**
 * MeruPaymentService - Verifica pagos de Meru usando un navegador headless
 * Lee el contenido real de la página después de que JavaScript se ejecuta
 */
class MeruPaymentService {
  constructor() {
    this.browser = null;
  }

  /**
   * Inicializa el navegador una sola vez
   */
  async initBrowser() {
    if (this.browser) return this.browser;

    try {
      this.browser = await puppeteer.launch({
        headless: 'new',
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
      });
      logger.info('Puppeteer browser initialized');
      return this.browser;
    } catch (error) {
      logger.error('Failed to initialize Puppeteer browser:', error);
      throw error;
    }
  }

  /**
   * Verifica si un link de Meru fue pagado
   * @param {string} meruCode - El código del link (ej: "abc123xyz")
   * @param {string} userLanguage - Idioma del usuario ('es' o 'en')
   * @returns {Promise<{isPaid: boolean, message: string, rawContent: string}>}
   */
  async verifyPayment(meruCode, userLanguage = 'es') {
    let page = null;
    try {
      const browser = await this.initBrowser();
      page = await browser.newPage();

      // Establecer idioma del navegador según el usuario
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

      const meruUrl = `https://pay.getmeru.com/${meruCode}`;
      logger.info(`Verifying Meru payment link: ${meruUrl}`);

      // Ir a la página y esperar a que se cargue
      await page.goto(meruUrl, { waitUntil: 'networkidle2' });

      // Obtener el contenido HTML después de que JavaScript se ejecute
      const pageContent = await page.content();

      // Esperar un poco más para animaciones
      await page.waitForTimeout(1000);

      // Obtener el texto visible
      const visibleText = await page.evaluate(() => {
        return document.body.innerText;
      });

      logger.info(`Meru page loaded for code ${meruCode}`, {
        contentLength: pageContent.length,
        textLength: visibleText.length,
      });

      // Detectar si fue pagado según el idioma del usuario
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

      logger.info(`Payment verification for ${meruCode}: isPaid=${isPaid}`);

      return {
        isPaid,
        message: isPaid
          ? 'Payment link already used or expired'
          : 'Payment link is still active',
        rawContent: pageContent.substring(0, 2000), // Primeros 2000 caracteres
        visibleText: visibleText.substring(0, 1000), // Texto visible
      };
    } catch (error) {
      logger.error(`Error verifying Meru payment for ${meruCode}:`, error);
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
