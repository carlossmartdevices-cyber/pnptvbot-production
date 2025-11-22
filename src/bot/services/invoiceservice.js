const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');

class InvoiceService {
  /**
   * Generate professional Spanish invoice for Easy Bots Store
   * @param {Object} data - Invoice data
   * @returns {Promise<Object>} Invoice details { id, pdf, buffer }
   */
  static async generateInvoice({
    customerName,
    customerEmail,
    planSku,
    planDescription = null,
    amount,
    currency = 'USD',
    exchangeRate = 4200 // USD to COP exchange rate (default)
  }) {
    try {
      // Ensure invoices directory exists
      const invoicesDir = path.join(__dirname, '../../../invoices');
      if (!fs.existsSync(invoicesDir)) {
        fs.mkdirSync(invoicesDir, { recursive: true });
      }

      const doc = new PDFDocument({ margin: 50, size: 'letter' });
      const invoiceNumber = `INV-${Date.now()}`;
      const invoiceDate = new Date();
      const filePath = path.join(invoicesDir, `${invoiceNumber}.pdf`);

      // Store buffer for email attachment
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));

      // Also save to file
      doc.pipe(fs.createWriteStream(filePath));

      // Calculate amounts
      const amountUSD = parseFloat(amount);
      const amountCOP = Math.round(amountUSD * exchangeRate);

      // Default description if not provided
      const description = planDescription ||
        'Servicios de Inteligencia Artificial - Desarrollo y mantenimiento de bots automatizados y herramientas de IA para gestión empresarial';

      // HEADER
      doc.fontSize(20)
         .fillColor('#2D8CFF')
         .text('FACTURA DE VENTA', { align: 'center' });

      doc.moveDown(0.5);
      doc.fontSize(12)
         .fillColor('#000000')
         .text(`Factura No: ${invoiceNumber}`, { align: 'center' });

      doc.moveDown();

      // Company Info (Left side)
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .text('Easy Bots Store', 50, 140);

      doc.font('Helvetica')
         .fontSize(9)
         .text('Email: no-reply@easybots.store', 50, 155)
         .text('Tel: +57 302 857 3797', 50, 168)
         .text('Bucaramanga, Colombia', 50, 181);

      // Customer Info (Right side)
      doc.font('Helvetica-Bold')
         .fontSize(10)
         .text('CLIENTE:', 350, 140);

      doc.font('Helvetica')
         .fontSize(9)
         .text(customerName || 'N/A', 350, 155)
         .text(customerEmail || 'N/A', 350, 168);

      // Date
      doc.text(`Fecha: ${invoiceDate.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })}`, 350, 181);

      // Horizontal line
      doc.moveDown(2);
      doc.strokeColor('#2D8CFF')
         .lineWidth(2)
         .moveTo(50, doc.y)
         .lineTo(562, doc.y)
         .stroke();

      doc.moveDown();

      // TABLE HEADER
      const tableTop = doc.y;
      const col1X = 50;
      const col2X = 150;
      const col3X = 400;
      const col4X = 470;

      doc.font('Helvetica-Bold')
         .fontSize(10)
         .fillColor('#2D8CFF')
         .text('SKU', col1X, tableTop)
         .text('DESCRIPCIÓN', col2X, tableTop)
         .text('CANT.', col3X, tableTop)
         .text('PRECIO', col4X, tableTop);

      // Line under header
      doc.strokeColor('#CCCCCC')
         .lineWidth(1)
         .moveTo(50, tableTop + 15)
         .lineTo(562, tableTop + 15)
         .stroke();

      // TABLE BODY
      const rowY = tableTop + 25;

      doc.font('Helvetica')
         .fontSize(9)
         .fillColor('#000000')
         .text(planSku, col1X, rowY, { width: 90 })
         .text(description, col2X, rowY, { width: 240 })
         .text('1', col3X, rowY)
         .text(`$${amountUSD.toFixed(2)}`, col4X, rowY);

      // Move down after description (which might wrap)
      const descriptionHeight = doc.heightOfString(description, { width: 240 });
      doc.y = rowY + Math.max(descriptionHeight, 20) + 10;

      // Line under item
      doc.strokeColor('#CCCCCC')
         .lineWidth(1)
         .moveTo(50, doc.y)
         .lineTo(562, doc.y)
         .stroke();

      doc.moveDown();

      // TOTALS SECTION
      const totalsX = 350;
      const totalsY = doc.y + 20;

      doc.font('Helvetica-Bold')
         .fontSize(10);

      doc.text('Subtotal USD:', totalsX, totalsY, { continued: false, align: 'left' });
      doc.font('Helvetica')
         .text(`$${amountUSD.toFixed(2)}`, totalsX + 150, totalsY, { align: 'right' });

      doc.font('Helvetica-Bold')
         .text('Subtotal COP:', totalsX, totalsY + 15, { continued: false, align: 'left' });
      doc.font('Helvetica')
         .text(`$${amountCOP.toLocaleString('es-CO')}`, totalsX + 150, totalsY + 15, { align: 'right' });

      doc.moveDown();

      doc.font('Helvetica-Bold')
         .fontSize(12)
         .fillColor('#2D8CFF')
         .text('TOTAL USD:', totalsX, totalsY + 35, { continued: false, align: 'left' });
      doc.text(`$${amountUSD.toFixed(2)}`, totalsX + 150, totalsY + 35, { align: 'right' });

      doc.font('Helvetica-Bold')
         .fontSize(12)
         .fillColor('#2D8CFF')
         .text('TOTAL COP:', totalsX, totalsY + 53, { continued: false, align: 'left' });
      doc.text(`$${amountCOP.toLocaleString('es-CO')}`, totalsX + 150, totalsY + 53, { align: 'right' });

      // NOTES SECTION
      doc.fillColor('#000000')
         .fontSize(9)
         .font('Helvetica')
         .text('Tasa de cambio: $1 USD = $' + exchangeRate.toLocaleString('es-CO') + ' COP', 50, totalsY + 80);

      doc.fontSize(8)
         .fillColor('#666666')
         .text('Nota: Los servicios de IA incluyen desarrollo, implementación y mantenimiento continuo de soluciones automatizadas.',
               50, totalsY + 100, { width: 500 });

      // FOOTER (at bottom of page)
      const footerY = 720;

      doc.strokeColor('#2D8CFF')
         .lineWidth(1)
         .moveTo(50, footerY)
         .lineTo(562, footerY)
         .stroke();

      doc.fontSize(7)
         .fillColor('#666666')
         .font('Helvetica')
         .text('Easy Bots Store - KR33 86-76 Bucaramanga, Colombia - Carlos Humberto Jimenez Manrique NIT 1098643746-2',
               50, footerY + 10, { align: 'center', width: 512 });

      doc.end();

      // Wait for PDF to finish
      await new Promise((resolve, reject) => {
        doc.on('end', () => {
          const buffer = Buffer.concat(chunks);
          logger.info('Invoice generated successfully', { invoiceNumber, customerEmail });
          resolve();
        });
        doc.on('error', reject);
      });

      const buffer = Buffer.concat(chunks);

      return {
        id: invoiceNumber,
        pdf: filePath,
        buffer,
        fileName: `Factura_${invoiceNumber}.pdf`
      };
    } catch (error) {
      logger.error('Error generating invoice:', error);
      throw error;
    }
  }
}

module.exports = InvoiceService;
