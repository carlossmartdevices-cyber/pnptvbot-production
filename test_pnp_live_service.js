// Test PNP Live Service - Dynamic Pricing
const PNPLiveService = require('./src/bot/services/pnpLiveService');

async function testDynamicPricing() {
  try {
    console.log('🧪 Testing Dynamic Pricing...');
    
    // Test with model ID 1 (Santino)
    const pricing30 = await PNPLiveService.getModelPricing(1, 30);
    const pricing60 = await PNPLiveService.getModelPricing(1, 60);
    const pricing90 = await PNPLiveService.getModelPricing(1, 90);
    
    console.log('✅ Model Pricing Results:');
    console.log('30 min:', pricing30);
    console.log('60 min:', pricing60);
    console.log('90 min:', pricing90);
    
    // Test with non-existent model (should fallback to defaults)
    const fallbackPricing = await PNPLiveService.getModelPricing(999, 30);
    console.log('✅ Fallback Pricing (non-existent model):', fallbackPricing);
    
    // Test invalid duration
    try {
      await PNPLiveService.getModelPricing(1, 120);
      console.log('❌ Should have thrown error for invalid duration');
    } catch (error) {
      console.log('✅ Correctly threw error for invalid duration:', error.message);
    }
    
    console.log('🎉 Dynamic Pricing Test PASSED');
  } catch (error) {
    console.error('❌ Dynamic Pricing Test FAILED:', error);
  }
}

// Run the test
testDynamicPricing();