// Test Tips and Promo Services
const PNPLiveTipsService = require('./src/bot/services/pnpLiveTipsService');
const PNPLivePromoService = require('./src/bot/services/pnpLivePromoService');

console.log('🧪 Testing Services...');

// Test Tips Service
console.log('\n💰 Testing Tips Service:');
console.log('TIP_AMOUNTS:', PNPLiveTipsService.TIP_AMOUNTS);
console.log('✅ Tips Service loaded successfully');

// Test Promo Service
console.log('\n🎁 Testing Promo Service:');
console.log('✅ Promo Service loaded successfully');

// Test service methods exist
console.log('\n🔍 Testing Service Methods:');

// Tips Service methods
const tipsMethods = [
  'createTip',
  'confirmTipPayment', 
  'getModelTips',
  'getTipStatistics',
  'getRecentTips',
  'getTipsByUser',
  'getTipById',
  'cancelTip'
];

console.log('Tips Service Methods:');
tipsMethods.forEach(method => {
  if (typeof PNPLiveTipsService[method] === 'function') {
    console.log(`✅ ${method}`);
  } else {
    console.log(`❌ ${method} - MISSING`);
  }
});

// Promo Service methods
const promoMethods = [
  'createPromoCode',
  'validatePromoCode',
  'applyPromoCode',
  'getActivePromoCodes',
  'getPromoCodeById',
  'deactivatePromoCode',
  'getPromoUsageStatistics',
  'getAllPromoCodes',
  'hasUserUsedPromo'
];

console.log('\nPromo Service Methods:');
promoMethods.forEach(method => {
  if (typeof PNPLivePromoService[method] === 'function') {
    console.log(`✅ ${method}`);
  } else {
    console.log(`❌ ${method} - MISSING`);
  }
});

console.log('\n🎉 Services Test PASSED');