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
  visaCybersource: {
    merchantId: process.env.VISA_CYBERSOURCE_MERCHANT_ID || 'your_merchant_id',
    apiKey: process.env.VISA_CYBERSOURCE_API_KEY || 'your_api_key',
    sharedSecret: process.env.VISA_CYBERSOURCE_SHARED_SECRET || 'your_shared_secret',
    endpoint: process.env.VISA_CYBERSOURCE_ENDPOINT || 'https://api.cybersource.com',
    webhookSecret: process.env.VISA_CYBERSOURCE_WEBHOOK_SECRET || 'your_webhook_secret',
    recurringPayment: true, // Enable recurring payment processing
    supportedPlans: ['monthly_crystal', 'monthly_diamond'], // Plans that use this provider
  },
};
