module.exports = {
  daimoPayments: {
    apiKey: process.env.DAIMON_API_KEY || 'tu-api-key',
    endpoint: process.env.DAIMON_ENDPOINT || 'https://api.daimonpayments.com/v1',
    webhookSecret: process.env.DAIMON_WEBHOOK_SECRET || 'tu-webhook-secret',
  },
  bold: {
    apiKey: process.env.BOLD_API_KEY || 'tu-api-key',
    endpoint: process.env.BOLD_ENDPOINT || 'https://api.bold.co/v1',
    webhookSecret: process.env.BOLD_WEBHOOK_SECRET || 'tu-webhook-secret',
  },
};
