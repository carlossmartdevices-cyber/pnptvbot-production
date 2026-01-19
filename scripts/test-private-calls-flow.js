#!/usr/bin/env node

/**
 * Test Script for Private Calls Feature
 * This script validates the complete private calls booking flow
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../src/utils/logger');
const PerformerModel = require('../src/models/performerModel');
const CallModel = require('../src/models/callModel');
const UserModel = require('../src/models/userModel');
const PrivateCallService = require('../src/bot/services/privateCallService');
const PrivateCallModerationService = require('../src/bot/services/privateCallModerationService');

/**
 * Test Configuration
 */
const TEST_CONFIG = {
  // Test user data
  testUser: {
    id: 'test_user_' + uuidv4().replace(/-/g, ''),
    first_name: 'Test',
    last_name: 'User',
    username: 'testuser',
    email: 'test@example.com',
    age_verified: true,
    terms_accepted: true,
    role: 'user',
    subscription_status: 'prime',
  },
  
  // Test performer data
  testPerformer: {
    displayName: 'Test Performer',
    bio: 'Test performer for validation',
    basePrice: 100.00,
    status: 'active',
    isAvailable: true,
  },
  
  // Test call data
  testCall: {
    duration: 30,
    price: 100.00,
  },
};

/**
 * Test Results
 */
const testResults = {
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  tests: [],
};

/**
 * Test Utilities
 */

function startTest(testName) {
  testResults.totalTests++;
  const test = {
    name: testName,
    status: 'running',
    startTime: new Date(),
    messages: [],
  };
  testResults.tests.push(test);
  logger.info(`🧪 Starting test: ${testName}`);
  return test;
}

function endTest(test, success, message) {
  test.endTime = new Date();
  test.duration = test.endTime - test.startTime;
  test.status = success ? 'passed' : 'failed';
  test.result = message;
  
  if (success) {
    testResults.passedTests++;
    logger.info(`✅ Test passed: ${test.name} (${test.duration}ms)`);
  } else {
    testResults.failedTests++;
    logger.error(`❌ Test failed: ${test.name} (${test.duration}ms)`);
    logger.error(`   Reason: ${message}`);
  }
}

function addTestMessage(test, message) {
  test.messages.push(message);
  logger.info(`   ${message}`);
}

/**
 * Test Cases
 */

async function runAllTests() {
  logger.info('🚀 Starting Private Calls Feature Testing...');
  logger.info('==========================================');
  
  try {
    // Test 1: Database Schema Validation
    await testDatabaseSchema();
    
    // Test 2: Performer Management
    await testPerformerManagement();
    
    // Test 3: User Eligibility
    await testUserEligibility();
    
    // Test 4: Booking Flow
    await testBookingFlow();
    
    // Test 5: Payment Integration
    await testPaymentIntegration();
    
    // Test 6: Call Room Creation
    await testCallRoomCreation();
    
    // Test 7: Moderation Features
    await testModerationFeatures();
    
    // Test 8: Admin Dashboard
    await testAdminDashboard();
    
    // Test 9: Access Control
    await testAccessControl();
    
    // Test 10: Error Handling
    await testErrorHandling();
    
    // Print summary
    printTestSummary();
    
  } catch (error) {
    logger.error('💥 Test suite failed with error:', error);
    process.exit(1);
  }
}

async function testDatabaseSchema() {
  const test = startTest('Database Schema Validation');
  
  try {
    // Test performer model methods
    addTestMessage(test, 'Testing PerformerModel methods...');
    
    if (typeof PerformerModel.create !== 'function') {
      throw new Error('PerformerModel.create method not found');
    }
    
    if (typeof PerformerModel.getById !== 'function') {
      throw new Error('PerformerModel.getById method not found');
    }
    
    if (typeof PerformerModel.getAvailable !== 'function') {
      throw new Error('PerformerModel.getAvailable method not found');
    }
    
    if (typeof PerformerModel.updateAvailability !== 'function') {
      throw new Error('PerformerModel.updateAvailability method not found');
    }
    
    // Test call model methods
    addTestMessage(test, 'Testing CallModel methods...');
    
    if (typeof CallModel.create !== 'function') {
      throw new Error('CallModel.create method not found');
    }
    
    if (typeof CallModel.getById !== 'function') {
      throw new Error('CallModel.getById method not found');
    }
    
    if (typeof CallModel.getByUser !== 'function') {
      throw new Error('CallModel.getByUser method not found');
    }
    
    if (typeof CallModel.getByPaymentId !== 'function') {
      throw new Error('CallModel.getByPaymentId method not found');
    }
    
    if (typeof CallModel.getByPerformer !== 'function') {
      throw new Error('CallModel.getByPerformer method not found');
    }
    
    if (typeof CallModel.updateStatus !== 'function') {
      throw new Error('CallModel.updateStatus method not found');
    }
    
    endTest(test, true, 'All database schema methods validated successfully');
    
  } catch (error) {
    endTest(test, false, error.message);
  }
}

async function testPerformerManagement() {
  const test = startTest('Performer Management');
  
  try {
    // Create test performer
    addTestMessage(test, 'Creating test performer...');
    
    const performer = await PerformerModel.create({
      displayName: TEST_CONFIG.testPerformer.displayName,
      bio: TEST_CONFIG.testPerformer.bio,
      basePrice: TEST_CONFIG.testPerformer.basePrice,
      status: TEST_CONFIG.testPerformer.status,
      isAvailable: TEST_CONFIG.testPerformer.isAvailable,
      createdBy: 'test_script',
      updatedBy: 'test_script',
    });
    
    if (!performer || !performer.id) {
      throw new Error('Failed to create performer');
    }
    
    addTestMessage(test, `Created performer: ${performer.displayName} (ID: ${performer.id})`);
    
    // Get performer by ID
    const retrievedPerformer = await PerformerModel.getById(performer.id);
    
    if (!retrievedPerformer) {
      throw new Error('Failed to retrieve performer by ID');
    }
    
    // Get available performers
    const availablePerformers = await PerformerModel.getAvailable();
    
    if (!Array.isArray(availablePerformers)) {
      throw new Error('getAvailable did not return an array');
    }
    
    // Update performer availability
    await PerformerModel.updateAvailability(performer.id, false, 'Testing availability update');
    
    const updatedPerformer = await PerformerModel.getById(performer.id);
    
    if (updatedPerformer.isAvailable !== false) {
      throw new Error('Failed to update performer availability');
    }
    
    // Restore availability
    await PerformerModel.updateAvailability(performer.id, true, 'Restored availability');
    
    endTest(test, true, 'Performer management tests passed');
    
  } catch (error) {
    endTest(test, false, error.message);
  }
}

async function testUserEligibility() {
  const test = startTest('User Eligibility Checks');
  
  try {
    // Create test user
    addTestMessage(test, 'Creating test user...');
    
    const user = await UserModel.create({
      id: TEST_CONFIG.testUser.id,
      username: TEST_CONFIG.testUser.username,
      first_name: TEST_CONFIG.testUser.first_name,
      last_name: TEST_CONFIG.testUser.last_name,
      email: TEST_CONFIG.testUser.email,
      age_verified: TEST_CONFIG.testUser.age_verified,
      terms_accepted: TEST_CONFIG.testUser.terms_accepted,
      role: TEST_CONFIG.testUser.role,
      subscription_status: TEST_CONFIG.testUser.subscription_status,
    });
    
    if (!user || !user.id) {
      throw new Error('Failed to create test user');
    }
    
    addTestMessage(test, `Created test user: ${user.username} (ID: ${user.id})`);
    
    // Test eligibility with valid user
    const eligibility = await PrivateCallModerationService.checkUserEligibility(user.id);
    
    if (!eligibility.eligible) {
      throw new Error(`User should be eligible but got: ${eligibility.reason}`);
    }
    
    // Test eligibility with age not verified
    await UserModel.update(user.id, { age_verified: false });
    
    const eligibilityNoAge = await PrivateCallModerationService.checkUserEligibility(user.id);
    
    if (eligibilityNoAge.eligible) {
      throw new Error('User should not be eligible without age verification');
    }
    
    // Restore age verification
    await UserModel.update(user.id, { age_verified: true });
    
    endTest(test, true, 'User eligibility checks passed');
    
  } catch (error) {
    endTest(test, false, error.message);
  }
}

async function testBookingFlow() {
  const test = startTest('Booking Flow');
  
  try {
    // Get test user and performer
    const user = await UserModel.getById(TEST_CONFIG.testUser.id);
    const performers = await PerformerModel.getAvailable();
    
    if (!user) {
      throw new Error('Test user not found');
    }
    
    if (performers.length === 0) {
      throw new Error('No available performers found');
    }
    
    const performer = performers[0];
    
    addTestMessage(test, `Testing booking flow with user: ${user.username} and performer: ${performer.displayName}`);
    
    // Test payment creation
    const paymentResult = await PrivateCallService.createPayment({
      userId: user.id,
      userName: user.first_name + ' ' + user.last_name,
      performerId: performer.id,
      performerName: performer.displayName,
      duration: TEST_CONFIG.testCall.duration,
      price: TEST_CONFIG.testCall.price,
      slotId: 'test-slot-' + uuidv4(),
      paymentMethod: 'crypto',
    });
    
    if (!paymentResult.success) {
      throw new Error(`Payment creation failed: ${paymentResult.error}`);
    }
    
    addTestMessage(test, `Created payment: ${paymentResult.paymentId}`);
    
    // Mark payment as completed (simulating successful payment)
    await PrivateCallService.markPaymentCompleted(paymentResult.paymentId);
    
    // Complete booking
    const bookingResult = await PrivateCallService.completeBooking(paymentResult.paymentId);
    
    if (!bookingResult.success) {
      throw new Error(`Booking completion failed: ${bookingResult.error}`);
    }
    
    addTestMessage(test, `Completed booking: ${bookingResult.booking.id}`);
    
    // Get user bookings
    const userBookings = await PrivateCallService.getUserBookings(user.id);
    
    if (userBookings.length === 0) {
      throw new Error('No bookings found for user after creation');
    }
    
    endTest(test, true, 'Booking flow test passed');
    
  } catch (error) {
    endTest(test, false, error.message);
  }
}

async function testPaymentIntegration() {
  const test = startTest('Payment Integration');
  
  try {
    const user = await UserModel.getById(TEST_CONFIG.testUser.id);
    const performers = await PerformerModel.getAvailable();
    
    if (!user || performers.length === 0) {
      throw new Error('Test prerequisites not met');
    }
    
    const performer = performers[0];
    
    addTestMessage(test, 'Testing payment methods...');
    
    // Test different payment methods
    const paymentMethods = ['card', 'crypto', 'bank'];
    
    for (const method of paymentMethods) {
      addTestMessage(test, `Testing ${method} payment method...`);
      
      const paymentResult = await PrivateCallService.createPayment({
        userId: user.id,
        userName: user.first_name + ' ' + user.last_name,
        performerId: performer.id,
        performerName: performer.displayName,
        duration: TEST_CONFIG.testCall.duration,
        price: TEST_CONFIG.testCall.price,
        slotId: 'test-slot-' + uuidv4(),
        paymentMethod: method,
      });
      
      if (!paymentResult.success) {
        throw new Error(`Payment method ${method} failed: ${paymentResult.error}`);
      }
      
      if (!paymentResult.paymentUrl) {
        throw new Error(`Payment method ${method} did not return a URL`);
      }
      
      // Check payment status
      const status = await PrivateCallService.checkPaymentStatus(paymentResult.paymentId);
      
      if (status.status !== 'pending') {
        throw new Error(`Payment status should be pending but got: ${status.status}`);
      }
    }
    
    endTest(test, true, 'Payment integration tests passed');
    
  } catch (error) {
    endTest(test, false, error.message);
  }
}

async function testCallRoomCreation() {
  const test = startTest('Call Room Creation');
  
  try {
    const user = await UserModel.getById(TEST_CONFIG.testUser.id);
    
    if (!user) {
      throw new Error('Test user not found');
    }
    
    addTestMessage(test, 'Testing call room creation...');
    
    // Create a test call for room creation
    const callData = {
      callId: 'test-call-' + uuidv4(),
      userName: user.first_name + ' ' + user.last_name,
      performerName: 'Test Performer',
      scheduledDate: new Date().toISOString().split('T')[0],
    };
    
    const meetingUrl = await PrivateCallService.createMeetingRoom(callData);
    
    if (!meetingUrl || typeof meetingUrl !== 'string') {
      throw new Error('Meeting room creation did not return a valid URL');
    }
    
    if (!meetingUrl.startsWith('http')) {
      throw new Error('Meeting URL does not start with http');
    }
    
    addTestMessage(test, `Created meeting room: ${meetingUrl}`);
    
    endTest(test, true, 'Call room creation test passed');
    
  } catch (error) {
    endTest(test, false, error.message);
  }
}

async function testModerationFeatures() {
  const test = startTest('Moderation Features');
  
  try {
    const user = await UserModel.getById(TEST_CONFIG.testUser.id);
    const performers = await PerformerModel.getAvailable();
    
    if (!user || performers.length === 0) {
      throw new Error('Test prerequisites not met');
    }
    
    const performer = performers[0];
    
    addTestMessage(test, 'Testing moderation features...');
    
    // Test user eligibility
    const eligibility = await PrivateCallModerationService.checkUserEligibility(user.id);
    
    if (!eligibility.eligible) {
      throw new Error('Eligible user failed eligibility check');
    }
    
    // Test performer eligibility
    const performerEligibility = await PrivateCallModerationService.checkPerformerEligibility(performer.id);
    
    if (!performerEligibility.eligible) {
      throw new Error('Eligible performer failed eligibility check');
    }
    
    // Test moderation logging (simulated)
    const logResult = await PrivateCallModerationService.logModerationAction({
      actionType: 'test_action',
      actionReason: 'testing_moderation_logging',
      severity: 'low',
      userId: user.id,
      performerId: performer.id,
      metadata: { test: true },
    });
    
    if (!logResult || !logResult.id) {
      throw new Error('Moderation logging failed');
    }
    
    addTestMessage(test, `Created moderation log: ${logResult.id}`);
    
    endTest(test, true, 'Moderation features test passed');
    
  } catch (error) {
    endTest(test, false, error.message);
  }
}

async function testAdminDashboard() {
  const test = startTest('Admin Dashboard');
  
  try {
    addTestMessage(test, 'Testing admin dashboard features...');
    
    // Test statistics
    const stats = await PrivateCallService.getStatistics();
    
    if (!stats || typeof stats !== 'object') {
      throw new Error('Statistics retrieval failed');
    }
    
    // Test performer statistics
    const performers = await PerformerModel.getAvailable();
    
    if (performers.length === 0) {
      throw new Error('No performers available for stats test');
    }
    
    const performerStats = await PrivateCallService.getPerformerStatistics(performers[0].id);
    
    if (!performerStats || typeof performerStats !== 'object') {
      throw new Error('Performer statistics retrieval failed');
    }
    
    addTestMessage(test, `Retrieved stats: ${stats.total} total calls, $${stats.revenue} revenue`);
    addTestMessage(test, `Retrieved performer stats: ${performerStats.totalCalls} calls, ⭐ ${performerStats.averageRating} rating`);
    
    endTest(test, true, 'Admin dashboard test passed');
    
  } catch (error) {
    endTest(test, false, error.message);
  }
}

async function testAccessControl() {
  const test = startTest('Access Control');
  
  try {
    const user = await UserModel.getById(TEST_CONFIG.testUser.id);
    
    if (!user) {
      throw new Error('Test user not found');
    }
    
    addTestMessage(test, 'Testing access control...');
    
    // Test that PRIME users can access private calls
    if (user.subscription_status !== 'prime') {
      throw new Error('Test user should be PRIME');
    }
    
    // Test that age verification is required
    await UserModel.update(user.id, { age_verified: false });
    
    const eligibilityNoAge = await PrivateCallModerationService.checkUserEligibility(user.id);
    
    if (eligibilityNoAge.eligible) {
      throw new Error('User without age verification should not be eligible');
    }
    
    // Restore age verification
    await UserModel.update(user.id, { age_verified: true });
    
    // Test that terms acceptance is required
    await UserModel.update(user.id, { terms_accepted: false });
    
    const eligibilityNoTerms = await PrivateCallModerationService.checkUserEligibility(user.id);
    
    if (eligibilityNoTerms.eligible) {
      throw new Error('User without terms acceptance should not be eligible');
    }
    
    // Restore terms acceptance
    await UserModel.update(user.id, { terms_accepted: true });
    
    endTest(test, true, 'Access control test passed');
    
  } catch (error) {
    endTest(test, false, error.message);
  }
}

async function testErrorHandling() {
  const test = startTest('Error Handling');
  
  try {
    addTestMessage(test, 'Testing error handling...');
    
    // Test invalid performer ID
    try {
      await PerformerModel.getById('invalid-id');
      // Should not throw, but should return null
    } catch (error) {
      throw new Error('Getting invalid performer should not throw exception');
    }
    
    // Test invalid call ID
    try {
      await CallModel.getById('invalid-id');
      // Should not throw, but should return null
    } catch (error) {
      throw new Error('Getting invalid call should not throw exception');
    }
    
    // Test invalid user ID
    try {
      await UserModel.getById('invalid-id');
      // Should not throw, but should return null
    } catch (error) {
      throw new Error('Getting invalid user should not throw exception');
    }
    
    endTest(test, true, 'Error handling test passed');
    
  } catch (error) {
    endTest(test, false, error.message);
  }
}

/**
 * Print Test Summary
 */
function printTestSummary() {
  logger.info('\n');
  logger.info('========================================');
  logger.info('📊 TEST SUMMARY');
  logger.info('========================================');
  logger.info(`Total Tests: ${testResults.totalTests}`);
  logger.info(`Passed: ${testResults.passedTests}`);
  logger.info(`Failed: ${testResults.failedTests}`);
  logger.info(`Success Rate: ${Math.round((testResults.passedTests / testResults.totalTests) * 100)}%`);
  logger.info('========================================');
  
  // Print detailed results
  logger.info('\n📋 DETAILED RESULTS:');
  logger.info('------------------------------');
  
  testResults.tests.forEach(test => {
    const statusEmoji = test.status === 'passed' ? '✅' : '❌';
    logger.info(`${statusEmoji} ${test.name}: ${test.result} (${test.duration}ms)`);
    
    if (test.messages.length > 0) {
      test.messages.forEach(message => {
        logger.info(`   • ${message}`);
      });
    }
  });
  
  logger.info('\n========================================');
  
  if (testResults.failedTests === 0) {
    logger.info('🎉 ALL TESTS PASSED!');
    logger.info('The private calls feature is working correctly.');
  } else {
    logger.error('❌ SOME TESTS FAILED');
    logger.error('Please review the failed tests above.');
    process.exit(1);
  }
}

/**
 * Cleanup Test Data
 */
async function cleanupTestData() {
  try {
    logger.info('\n🧹 Cleaning up test data...');
    
    // Delete test user
    if (TEST_CONFIG.testUser.id) {
      await UserModel.delete(TEST_CONFIG.testUser.id);
      logger.info('Deleted test user');
    }
    
    // Delete test performers
    const performers = await PerformerModel.getAll({ search: 'Test Performer' });
    for (const performer of performers) {
      await PerformerModel.delete(performer.id);
      logger.info(`Deleted test performer: ${performer.displayName}`);
    }
    
    // Delete test calls
    const calls = await CallModel.getByUser(TEST_CONFIG.testUser.id);
    for (const call of calls) {
      await CallModel.updateStatus(call.id, 'cancelled', {
        cancellationReason: 'Test cleanup',
      });
      logger.info(`Cancelled test call: ${call.id}`);
    }
    
    logger.info('✅ Test data cleanup completed');
    
  } catch (error) {
    logger.error('⚠️ Error during cleanup:', error);
  }
}

/**
 * Main Execution
 */
(async () => {
  try {
    await runAllTests();
    await cleanupTestData();
    process.exit(0);
  } catch (error) {
    logger.error('💥 Test suite failed:', error);
    await cleanupTestData();
    process.exit(1);
  }
})();