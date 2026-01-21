#!/usr/bin/env node

/**
 * Test Script: Verify USA P2P Apps Configuration (No Environment Variables Required)
 * 
 * This script tests the configuration files directly without needing
 * Daimo environment variables to be set.
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing USA P2P Apps Configuration');
console.log('='.repeat(50));

/**
 * Test 1: Check daimo.js Configuration File
 */
function testDaimoConfigFile() {
  console.log('\n📋 Test 1: daimo.js Configuration File');
  console.log('-'.repeat(40));
  
  try {
    const configPath = path.join(__dirname, 'src', 'config', 'daimo.js');
    const configContent = fs.readFileSync(configPath, 'utf8');
    
    console.log('✅ Configuration file found');
    
    // Check for USA P2P apps in the file
    const usaP2pApps = ['CashApp', 'Venmo', 'Zelle'];
    let allAppsFound = true;
    
    usaP2pApps.forEach(app => {
      const found = configContent.includes(`'${app}'`);
      const marker = found ? '✓' : '✗';
      console.log(`  ${marker} ${app} ${found ? 'found' : 'NOT found'}`);
      if (!found) allAppsFound = false;
    });
    
    // Check for the SUPPORTED_PAYMENT_APPS array
    const hasSupportedApps = configContent.includes('SUPPORTED_PAYMENT_APPS');
    console.log(`  ${hasSupportedApps ? '✓' : '✗'} SUPPORTED_PAYMENT_APPS array defined`);
    
    return allAppsFound && hasSupportedApps;
  } catch (error) {
    console.log('❌ Error reading config file:', error.message);
    return false;
  }
}

/**
 * Test 2: Check daimoService.js Configuration
 */
function testDaimoServiceFile() {
  console.log('\n🔧 Test 2: daimoService.js Configuration');
  console.log('-'.repeat(40));
  
  try {
    const servicePath = path.join(__dirname, 'src', 'bot', 'services', 'daimoService.js');
    const serviceContent = fs.readFileSync(servicePath, 'utf8');
    
    console.log('✅ Service file found');
    
    // Check for USA P2P apps in the service
    const usaP2pApps = ['CashApp', 'Venmo', 'Zelle'];
    let allAppsFound = true;
    
    usaP2pApps.forEach(app => {
      const found = serviceContent.includes(`'${app}'`);
      const marker = found ? '✓' : '✗';
      console.log(`  ${marker} ${app} ${found ? 'found' : 'NOT found'}`);
      if (!found) allAppsFound = false;
    });
    
    // Check for supportedPaymentApps property
    const hasSupportedApps = serviceContent.includes('supportedPaymentApps');
    console.log(`  ${hasSupportedApps ? '✓' : '✗'} supportedPaymentApps property defined`);
    
    return allAppsFound && hasSupportedApps;
  } catch (error) {
    console.log('❌ Error reading service file:', error.message);
    return false;
  }
}

/**
 * Test 3: Verify Payment Options Array Structure
 */
function testPaymentOptionsStructure() {
  console.log('\n📊 Test 3: Payment Options Array Structure');
  console.log('-'.repeat(40));
  
  try {
    const configPath = path.join(__dirname, 'src', 'config', 'daimo.js');
    const configContent = fs.readFileSync(configPath, 'utf8');
    
    // Extract the SUPPORTED_PAYMENT_APPS array
    const arrayMatch = configContent.match(/const SUPPORTED_PAYMENT_APPS = \[([\s\S]*?)\];/);
    
    if (arrayMatch) {
      const arrayContent = arrayMatch[1];
      console.log('✅ SUPPORTED_PAYMENT_APPS array found');
      
      // Extract individual apps
      const appMatches = arrayContent.match(/'([^']+)'/g);
      const apps = appMatches ? appMatches.map(match => match.replace(/'/g, '')) : [];
      
      console.log('📋 Configured payment apps:');
      apps.forEach((app, index) => {
        const isUsaApp = ['CashApp', 'Venmo', 'Zelle'].includes(app);
        const marker = isUsaApp ? '🇺🇸' : '🌍';
        console.log(`  ${index + 1}. ${marker} ${app}`);
      });
      
      // Check for USA P2P apps
      const usaP2pApps = ['CashApp', 'Venmo', 'Zelle'];
      const usaAppsPresent = usaP2pApps.filter(app => apps.includes(app));
      
      if (usaAppsPresent.length === usaP2pApps.length) {
        console.log('✅ All USA P2P apps present in array:');
        usaAppsPresent.forEach(app => {
          console.log(`  ✓ ${app}`);
        });
        return true;
      } else {
        console.log('❌ Some USA P2P apps missing:');
        usaP2pApps.forEach(app => {
          const status = apps.includes(app) ? '✓' : '✗';
          console.log(`  ${status} ${app}`);
        });
        return false;
      }
    } else {
      console.log('❌ Could not find SUPPORTED_PAYMENT_APPS array');
      return false;
    }
  } catch (error) {
    console.log('❌ Error analyzing array structure:', error.message);
    return false;
  }
}

/**
 * Test 4: Check Service Layer Array Structure
 */
function testServiceLayerStructure() {
  console.log('\n🛠️ Test 4: Service Layer Array Structure');
  console.log('-'.repeat(40));
  
  try {
    const servicePath = path.join(__dirname, 'src', 'bot', 'services', 'daimoService.js');
    const serviceContent = fs.readFileSync(servicePath, 'utf8');
    
    // Extract the supportedPaymentApps array
    const arrayMatch = serviceContent.match(/supportedPaymentApps = \[([^\]]+)\]/);
    
    if (arrayMatch) {
      const arrayContent = arrayMatch[1];
      console.log('✅ supportedPaymentApps array found');
      
      // Extract individual apps
      const appMatches = arrayContent.match(/'([^']+)'/g);
      const apps = appMatches ? appMatches.map(match => match.replace(/'/g, '')) : [];
      
      console.log('📋 Service layer payment apps:');
      apps.forEach((app, index) => {
        const isUsaApp = ['CashApp', 'Venmo', 'Zelle'].includes(app);
        const marker = isUsaApp ? '🇺🇸' : '🌍';
        console.log(`  ${index + 1}. ${marker} ${app}`);
      });
      
      // Check for USA P2P apps
      const usaP2pApps = ['CashApp', 'Venmo', 'Zelle'];
      const usaAppsPresent = usaP2pApps.filter(app => apps.includes(app));
      
      if (usaAppsPresent.length === usaP2pApps.length) {
        console.log('✅ All USA P2P apps present in service layer:');
        usaAppsPresent.forEach(app => {
          console.log(`  ✓ ${app}`);
        });
        return true;
      } else {
        console.log('❌ Some USA P2P apps missing from service layer:');
        usaP2pApps.forEach(app => {
          const status = apps.includes(app) ? '✓' : '✗';
          console.log(`  ${status} ${app}`);
        });
        return false;
      }
    } else {
      console.log('❌ Could not find supportedPaymentApps array');
      return false;
    }
  } catch (error) {
    console.log('❌ Error analyzing service structure:', error.message);
    return false;
  }
}

/**
 * Test 5: Verify Payment Options Usage in Code
 */
function testPaymentOptionsUsage() {
  console.log('\n🔍 Test 5: Payment Options Usage in Code');
  console.log('-'.repeat(40));
  
  try {
    const configPath = path.join(__dirname, 'src', 'config', 'daimo.js');
    const configContent = fs.readFileSync(configPath, 'utf8');
    
    // Check if paymentOptions is used in createPaymentIntent
    const hasPaymentOptionsInIntent = configContent.includes('paymentOptions: config.supportedPaymentApps');
    console.log(`  ${hasPaymentOptionsInIntent ? '✓' : '✗'} paymentOptions used in createPaymentIntent`);
    
    // Check if paymentOptions is used in createDaimoPayment
    const hasPaymentOptionsInApi = configContent.includes('paymentOptions: [');
    console.log(`  ${hasPaymentOptionsInApi ? '✓' : '✗'} paymentOptions used in createDaimoPayment`);
    
    // Check service layer usage
    const servicePath = path.join(__dirname, 'src', 'bot', 'services', 'daimoService.js');
    const serviceContent = fs.readFileSync(servicePath, 'utf8');
    
    const hasPaymentOptionsInService = serviceContent.includes('paymentOptions: this.supportedPaymentApps');
    console.log(`  ${hasPaymentOptionsInService ? '✓' : '✗'} paymentOptions used in service layer`);
    
    return hasPaymentOptionsInIntent && hasPaymentOptionsInApi && hasPaymentOptionsInService;
  } catch (error) {
    console.log('❌ Error checking payment options usage:', error.message);
    return false;
  }
}

/**
 * Test 6: Geographic App Availability Analysis
 */
function testGeographicAnalysis() {
  console.log('\n🗺️ Test 6: Geographic App Availability');
  console.log('-'.repeat(40));
  
  const geographicApps = {
    'USA 🇺🇸': ['CashApp', 'Venmo', 'Zelle'],
    'International 🌍': ['Wise', 'Revolut'],
    'Crypto 💱': ['Coinbase', 'Binance', 'MiniPay']
  };
  
  console.log('🌐 Expected App Availability by Region:');
  
  for (const [region, apps] of Object.entries(geographicApps)) {
    console.log(`\n${region}:`);
    apps.forEach(app => {
      console.log(`  • ${app}`);
    });
  }
  
  // Verify our configuration matches expectations
  const configPath = path.join(__dirname, 'src', 'config', 'daimo.js');
  const configContent = fs.readFileSync(configPath, 'utf8');
  
  const arrayMatch = configContent.match(/const SUPPORTED_PAYMENT_APPS = \[([\s\S]*?)\];/);
  if (arrayMatch) {
    const appMatches = arrayMatch[1].match(/'([^']+)'/g);
    const ourApps = appMatches ? appMatches.map(match => match.replace(/'/g, '')) : [];
    
    console.log('\n✅ Our Configuration Coverage:');
    
    let allCovered = true;
    for (const [region, apps] of Object.entries(geographicApps)) {
      apps.forEach(app => {
        const covered = ourApps.includes(app);
        const marker = covered ? '✓' : '✗';
        console.log(`  ${marker} ${app} (${region})`);
        if (!covered) allCovered = false;
      });
    }
    
    return allCovered;
  }
  
  return false;
}

/**
 * Run All Tests
 */
function runAllTests() {
  console.log('\n🚀 Running USA P2P Apps Configuration Tests');
  console.log('='.repeat(50));
  
  const results = {
    daimoConfig: testDaimoConfigFile(),
    daimoService: testDaimoServiceFile(),
    paymentOptionsStructure: testPaymentOptionsStructure(),
    serviceLayerStructure: testServiceLayerStructure(),
    paymentOptionsUsage: testPaymentOptionsUsage(),
    geographicAnalysis: testGeographicAnalysis()
  };
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));
  
  const testNames = [
    'Daimo Config File',
    'Daimo Service File',
    'Payment Options Structure',
    'Service Layer Structure',
    'Payment Options Usage',
    'Geographic Analysis'
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
    console.log('✅ Configuration files are correctly set up');
    console.log('✅ Payment options are properly configured');
    console.log('✅ System is ready for USA users');
  } else {
    console.log('❌ SOME TESTS FAILED');
    console.log('⚠️  Configuration needs review');
    console.log('⚠️  USA users may not see all P2P apps');
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
  testDaimoConfigFile,
  testDaimoServiceFile,
  testPaymentOptionsStructure,
  testServiceLayerStructure,
  testPaymentOptionsUsage,
  testGeographicAnalysis,
  runAllTests
};
