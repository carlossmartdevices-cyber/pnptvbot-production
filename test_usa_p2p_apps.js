#!/usr/bin/env node

/**
 * Test Script: Verify USA Users See P2P Apps (CashApp, Venmo, Zelle)
 * 
 * This script tests that the payment configuration correctly shows
 * P2P payment apps to users in the USA region.
 */

const { createPaymentIntent, getDaimoConfig } = require('./src/config/daimo');
const DaimoService = require('./src/bot/services/daimoService');

console.log('🧪 Testing USA P2P Apps Visibility');
console.log('='.repeat(50));

/**
 * Test 1: Verify Configuration Includes USA P2P Apps
 */
function testConfiguration() {
  console.log('\n📋 Test 1: Configuration Check');
  console.log('-'.repeat(40));
  
  try {
    const config = getDaimoConfig();
    const expectedApps = ['CashApp', 'Venmo', 'Zelle'];
    const supportedApps = config.supportedPaymentApps;
    
    console.log('✅ Configuration loaded successfully');
    console.log('📊 Supported Payment Apps:', supportedApps);
    
    // Check if all expected USA P2P apps are present
    const missingApps = expectedApps.filter(app => !supportedApps.includes(app));
    
    if (missingApps.length === 0) {
      console.log('✅ All USA P2P apps are configured:');
      expectedApps.forEach(app => {
        console.log(`  ✓ ${app}`);
      });
      return true;
    } else {
      console.log('❌ Missing USA P2P apps:');
      missingApps.forEach(app => {
        console.log(`  ✗ ${app}`);
      });
      return false;
    }
  } catch (error) {
    console.log('❌ Configuration error:', error.message);
    return false;
  }
}

/**
 * Test 2: Verify Payment Intent Includes P2P Apps
 */
function testPaymentIntent() {
  console.log('\n💳 Test 2: Payment Intent Check');
  console.log('-'.repeat(40));
  
  try {
    const paymentIntent = createPaymentIntent({
      amount: 14.99,
      userId: 'test_user_usa',
      planId: 'week-trial-pass',
      chatId: 'test_chat_usa',
      description: 'PNPtv Week Trial Pass'
    });
    
    console.log('✅ Payment intent created successfully');
    console.log('🔗 Payment options in intent:', paymentIntent.paymentOptions);
    
    // Check for USA P2P apps
    const usaP2pApps = ['CashApp', 'Venmo', 'Zelle'];
    const intentApps = paymentIntent.paymentOptions;
    
    const usaAppsPresent = usaP2pApps.filter(app => intentApps.includes(app));
    
    if (usaAppsPresent.length === usaP2pApps.length) {
      console.log('✅ All USA P2P apps included in payment intent:');
      usaAppsPresent.forEach(app => {
        console.log(`  ✓ ${app}`);
      });
      return true;
    } else {
      console.log('❌ Some USA P2P apps missing from intent:');
      usaP2pApps.forEach(app => {
        const status = intentApps.includes(app) ? '✓' : '✗';
        console.log(`  ${status} ${app}`);
      });
      return false;
    }
  } catch (error) {
    console.log('❌ Payment intent error:', error.message);
    return false;
  }
}

/**
 * Test 3: Verify Service Layer Configuration
 */
function testServiceLayer() {
  console.log('\n🔧 Test 3: Service Layer Check');
  console.log('-'.repeat(40));
  
  try {
    const service = DaimoService;
    const serviceApps = service.supportedPaymentApps;
    
    console.log('✅ Service layer loaded successfully');
    console.log('🛠️ Service supported apps:', serviceApps);
    
    // Check USA P2P apps
    const usaP2pApps = ['CashApp', 'Venmo', 'Zelle'];
    const usaAppsPresent = usaP2pApps.filter(app => serviceApps.includes(app));
    
    if (usaAppsPresent.length === usaP2pApps.length) {
      console.log('✅ All USA P2P apps configured in service layer:');
      usaAppsPresent.forEach(app => {
        console.log(`  ✓ ${app}`);
      });
      return true;
    } else {
      console.log('❌ Some USA P2P apps missing from service layer:');
      usaP2pApps.forEach(app => {
        const status = serviceApps.includes(app) ? '✓' : '✗';
        console.log(`  ${status} ${app}`);
      });
      return false;
    }
  } catch (error) {
    console.log('❌ Service layer error:', error.message);
    return false;
  }
}

/**
 * Test 4: Simulate USA User Payment Flow
 */
function testUsaUserFlow() {
  console.log('\n🌍 Test 4: USA User Flow Simulation');
  console.log('-'.repeat(40));
  
  try {
    // Simulate a USA user payment scenario
    const userData = {
      userId: 'usa_user_12345',
      chatId: 'usa_user_12345',
      planId: 'monthly-pass',
      amount: 24.99,
      paymentId: 'test_payment_usa_001'
    };
    
    console.log('👤 Simulating USA user:', userData.userId);
    console.log('💰 Plan:', userData.planId, '($' + userData.amount + ')');
    
    // Generate payment link (what the user would see)
    const paymentLink = DaimoService.generatePaymentLink(userData);
    
    console.log('✅ Payment link generated:');
    console.log('🔗 Link:', paymentLink.substring(0, 80) + '...');
    
    // Extract payment options from the link
    const url = new URL(paymentLink);
    const intentParam = url.searchParams.get('intent');
    
    if (intentParam) {
      const intent = JSON.parse(decodeURIComponent(intentParam));
      const paymentOptions = intent.paymentOptions || [];
      
      console.log('📋 Payment options available to USA user:');
      paymentOptions.forEach((app, index) => {
        const isUsaApp = ['CashApp', 'Venmo', 'Zelle'].includes(app);
        const marker = isUsaApp ? '🇺🇸' : '🌍';
        console.log(`  ${index + 1}. ${marker} ${app}`);
      });
      
      // Verify USA P2P apps are present
      const usaApps = ['CashApp', 'Venmo', 'Zelle'];
      const usaAppsAvailable = usaApps.filter(app => paymentOptions.includes(app));
      
      if (usaAppsAvailable.length === usaApps.length) {
        console.log('✅ All USA P2P apps visible to user:');
        usaAppsAvailable.forEach(app => {
          console.log(`  ✓ ${app}`);
        });
        return true;
      } else {
        console.log('❌ Some USA P2P apps not visible:');
        usaApps.forEach(app => {
          const status = paymentOptions.includes(app) ? '✓' : '✗';
          console.log(`  ${status} ${app}`);
        });
        return false;
      }
    } else {
      console.log('❌ Could not extract payment options from link');
      return false;
    }
  } catch (error) {
    console.log('❌ USA user flow error:', error.message);
    return false;
  }
}

/**
 * Test 5: Geographic App Availability Check
 */
function testGeographicAvailability() {
  console.log('\n🗺️ Test 5: Geographic App Availability');
  console.log('-'.repeat(40));
  
  const geographicApps = {
    'USA': ['CashApp', 'Venmo', 'Zelle'],
    'International': ['Wise', 'Revolut'],
    'Crypto': ['Coinbase', 'Binance', 'MiniPay']
  };
  
  console.log('🌐 App Availability by Region:');
  
  for (const [region, apps] of Object.entries(geographicApps)) {
    console.log(`\n${region}:`);
    apps.forEach(app => {
      console.log(`  • ${app}`);
    });
  }
  
  // Check if our configuration matches expected availability
  const config = getDaimoConfig();
  const ourApps = config.supportedPaymentApps;
  
  console.log('\n✅ Our configuration includes:');
  const allApps = [...geographicApps.USA, ...geographicApps.International, ...geographicApps.Crypto];
  
  const coverage = allApps.map(app => {
    const available = ourApps.includes(app);
    return { app, available };
  });
  
  let allAvailable = true;
  coverage.forEach(({ app, available }) => {
    const marker = available ? '✓' : '✗';
    console.log(`  ${marker} ${app}`);
    if (!available) allAvailable = false;
  });
  
  return allAvailable;
}

/**
 * Run All Tests
 */
function runAllTests() {
  console.log('\n🚀 Running USA P2P Apps Tests');
  console.log('='.repeat(50));
  
  const results = {
    configuration: testConfiguration(),
    paymentIntent: testPaymentIntent(),
    serviceLayer: testServiceLayer(),
    usaUserFlow: testUsaUserFlow(),
    geographicAvailability: testGeographicAvailability()
  };
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));
  
  const testNames = [
    'Configuration Check',
    'Payment Intent Check', 
    'Service Layer Check',
    'USA User Flow',
    'Geographic Availability'
  ];
  
  let allPassed = true;
  Object.values(results).forEach((result, index) => {
    const marker = result ? '✅' : '❌';
    console.log(`${marker} ${testNames[index]}: ${result ? 'PASS' : 'FAIL'}`);
    if (!result) allPassed = false;
  });
  
  console.log('\n' + '='.repeat(50));
  if (allPassed) {
    console.log('🎉 ALL TESTS PASSED!');
    console.log('✅ USA users WILL see CashApp, Venmo, and Zelle');
    console.log('✅ Payment configuration is correct');
    console.log('✅ System is ready for USA users');
  } else {
    console.log('❌ SOME TESTS FAILED');
    console.log('⚠️  USA users may NOT see all P2P apps');
    console.log('⚠️  Configuration needs review');
  }
  console.log('='.repeat(50));
  
  return allPassed;
}

// Run tests if this script is executed directly
if (require.main === module) {
  const success = runAllTests();
  process.exit(success ? 0 : 1);
}

module.exports = {
  testConfiguration,
  testPaymentIntent,
  testServiceLayer,
  testUsaUserFlow,
  testGeographicAvailability,
  runAllTests
};
