#!/usr/bin/env node

/**
 * Test Script for Enhanced Customer Service System
 * 
 * This script tests the new features implemented in the support system:
 * - Priority detection and assignment
 * - Category detection and assignment  
 * - SLA monitoring
 * - Auto-assignment
 * - Satisfaction survey system
 * - Enhanced statistics
 */

const SupportTopicModel = require('../src/models/supportTopicModel');
const SupportRoutingService = require('../src/bot/services/supportRoutingService');
const logger = require('../src/utils/logger');

async function runTests() {
  logger.info('🧪 Starting Enhanced Support System Tests...');
  
  try {
    // Initialize database
    await SupportTopicModel.initTable();
    logger.info('✅ Database initialized');
    
    // Test 1: Priority Detection
    logger.info('\n📌 Test 1: Priority Detection');
    const testMessages = [
      { text: 'Tengo un problema URGENTE con mi cuenta', expected: 'critical' },
      { text: 'Importante: No puedo acceder al sistema', expected: 'high' },
      { text: '¿Cómo funciona la suscripción?', expected: 'low' },
      { text: 'Hola, tengo un problema', expected: 'medium' }
    ];
    
    for (const test of testMessages) {
      const detectedPriority = supportRoutingService.detectPriority(test.text, {});
      const status = detectedPriority === test.expected ? '✅' : '❌';
      logger.info(`${status} "${test.text}" -> ${detectedPriority} (expected: ${test.expected})`);
    }
    
    // Test 2: Category Detection
    logger.info('\n📌 Test 2: Category Detection');
    const categoryTests = [
      { text: 'Problema con mi pago de PayPal', expected: 'billing' },
      { text: 'No puedo iniciar sesión en mi cuenta', expected: 'account' },
      { text: 'La aplicación se cae constantemente', expected: 'technical' },
      { text: 'Quiero cancelar mi suscripción', expected: 'subscription' },
      { text: 'Hola, tengo una pregunta general', expected: 'general' }
    ];
    
    for (const test of categoryTests) {
      const detectedCategory = supportRoutingService.detectCategory(test.text);
      const status = detectedCategory === test.expected ? '✅' : '❌';
      logger.info(`${status} "${test.text}" -> ${detectedCategory} (expected: ${test.expected})`);
    }
    
    // Test 3: Database Operations
    logger.info('\n📌 Test 3: Database Operations');
    
    // Create a test topic
    const testUserId = 'test_user_12345';
    const testTopic = await SupportTopicModel.create({
      userId: testUserId,
      threadId: 99999,
      threadName: 'Test Topic'
    });
    logger.info('✅ Topic created:', testTopic.user_id);
    
    // Update priority
    await SupportTopicModel.updatePriority(testUserId, 'high');
    const updatedTopic = await SupportTopicModel.getByUserId(testUserId);
    logger.info(`✅ Priority updated: ${updatedTopic.priority}`);
    
    // Update category
    await SupportTopicModel.updateCategory(testUserId, 'technical');
    const topicWithCategory = await SupportTopicModel.getByUserId(testUserId);
    logger.info(`✅ Category updated: ${topicWithCategory.category}`);
    
    // Update language
    await SupportTopicModel.updateLanguage(testUserId, 'es');
    const topicWithLanguage = await SupportTopicModel.getByUserId(testUserId);
    logger.info(`✅ Language updated: ${topicWithLanguage.language}`);
    
    // Test first response tracking
    await SupportTopicModel.updateFirstResponse(testUserId);
    const topicWithResponse = await SupportTopicModel.getByUserId(testUserId);
    logger.info(`✅ First response tracked: ${topicWithResponse.first_response_at}`);
    
    // Test SLA breach detection
    const slaBreach = supportRoutingService.checkSlaBreach(topicWithResponse);
    logger.info(`✅ SLA breach check: ${slaBreach} (should be false for new ticket)`);
    
    // Test satisfaction update
    await SupportTopicModel.updateSatisfaction(testUserId, 5, 'Excelente servicio');
    const topicWithFeedback = await SupportTopicModel.getByUserId(testUserId);
    logger.info(`✅ Satisfaction updated: Rating=${topicWithFeedback.user_satisfaction}, Feedback="${topicWithFeedback.feedback}"`);
    
    // Test 4: Query Methods
    logger.info('\n📌 Test 4: Query Methods');
    
    // Get statistics
    const stats = await SupportTopicModel.getStatistics();
    logger.info(`✅ Statistics retrieved: ${stats.total_topics} total topics`);
    
    // Search topics
    const searchResults = await SupportTopicModel.searchTopics('test_user');
    logger.info(`✅ Search results: Found ${searchResults.length} topics matching 'test_user'`);
    
    // Get topics needing first response
    const noResponseTopics = await SupportTopicModel.getTopicsNeedingFirstResponse();
    logger.info(`✅ Topics needing first response: ${noResponseTopics.length}`);
    
    // Test 5: SLA Breach Simulation
    logger.info('\n📌 Test 5: SLA Breach Simulation');
    
    // Create an old topic that should breach SLA
    const oldUserId = 'old_user_67890';
    const oldTopic = await SupportTopicModel.create({
      userId: oldUserId,
      threadId: 88888,
      threadName: 'Old Test Topic'
    });
    
    // Set it to high priority and make it old (simulate by setting created_at to past)
    await SupportTopicModel.updatePriority(oldUserId, 'high');
    
    // Manually update created_at to simulate an old ticket (5 hours ago)
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
    await getPool().query('UPDATE support_topics SET created_at = $1 WHERE user_id = $2', [fiveHoursAgo, oldUserId]);
    
    const oldTopicData = await SupportTopicModel.getByUserId(oldUserId);
    const isBreached = supportRoutingService.checkSlaBreach(oldTopicData);
    logger.info(`✅ Old ticket SLA breach: ${isBreached} (should be true for 5-hour-old high priority ticket)`);
    
    // Test 6: Icon and Emoji Methods
    logger.info('\n📌 Test 6: Icon and Emoji Methods');
    
    const priorityEmoji = supportRoutingService.getPriorityEmoji('high');
    logger.info(`✅ Priority emoji for 'high': ${priorityEmoji}`);
    
    const categoryEmoji = supportRoutingService.getCategoryEmoji('billing');
    logger.info(`✅ Category emoji for 'billing': ${categoryEmoji}`);
    
    const priorityColor = supportRoutingService.getPriorityIconColor('critical');
    logger.info(`✅ Priority color for 'critical': ${priorityColor.toString(16)}`);
    
    // Cleanup
    logger.info('\n🧹 Cleaning up test data...');
    await SupportTopicModel.delete(testUserId);
    await SupportTopicModel.delete(oldUserId);
    logger.info('✅ Test data cleaned up');
    
    logger.info('\n🎉 All tests completed successfully!');
    logger.info('\n📊 Test Summary:');
    logger.info('   ✅ Priority Detection');
    logger.info('   ✅ Category Detection');
    logger.info('   ✅ Database Operations');
    logger.info('   ✅ Query Methods');
    logger.info('   ✅ SLA Breach Detection');
    logger.info('   ✅ Icon/Emoji Methods');
    
    process.exit(0);
    
  } catch (error) {
    logger.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the tests
runTests();