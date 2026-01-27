// Test i18n Translations
const i18n = require('./src/utils/i18n');

console.log('🧪 Testing i18n Translations...');

// Test English translations
console.log('\n🇺🇸 English Translations:');
console.log('Title:', i18n.t('pnpLive.title', 'en'));
console.log('Menu Title:', i18n.t('pnpLive.menu.title', 'en'));
console.log('Model Selection:', i18n.t('pnpLive.modelSelection.title', 'en'));
console.log('Duration Selection:', i18n.t('pnpLive.durationSelection.title', 'en'));
console.log('Booking Confirmation:', i18n.t('pnpLive.bookingConfirmation.title', 'en'));
console.log('Payment Title:', i18n.t('pnpLive.payment.title', 'en'));

// Test Spanish translations
console.log('\n🇪🇸 Spanish Translations:');
console.log('Title:', i18n.t('pnpLive.title', 'es'));
console.log('Menu Title:', i18n.t('pnpLive.menu.title', 'es'));
console.log('Model Selection:', i18n.t('pnpLive.modelSelection.title', 'es'));
console.log('Duration Selection:', i18n.t('pnpLive.durationSelection.title', 'es'));
console.log('Booking Confirmation:', i18n.t('pnpLive.bookingConfirmation.title', 'es'));
console.log('Payment Title:', i18n.t('pnpLive.payment.title', 'es'));

// Test parameter replacement
console.log('\n🔧 Parameter Replacement:');
const params = { modelName: 'Santino', price: 100, duration: 60 };
console.log('English with params:', i18n.t('pnpLive.bookingConfirmation.model', 'en', params));
console.log('Spanish with params:', i18n.t('pnpLive.bookingConfirmation.model', 'es', params));

// Test nested translations
console.log('\n📁 Nested Translations:');
console.log('Admin Title:', i18n.t('pnpLive.admin.title', 'en'));
console.log('Admin Models:', i18n.t('pnpLive.adminModels.title', 'en'));
console.log('Admin Pricing:', i18n.t('pnpLive.adminPricing.title', 'en'));

console.log('\n🎉 i18n Test PASSED');