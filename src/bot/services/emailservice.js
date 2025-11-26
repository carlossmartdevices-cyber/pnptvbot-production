// Mock básico para pruebas unitarias
module.exports = {
  sendInvoiceEmail: async ({ to, subject, invoicePdf, invoiceNumber }) => {
    // Simula envío de email
    return { success: true, to, subject, invoicePdf, invoiceNumber };
  },
};
