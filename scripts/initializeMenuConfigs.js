#!/usr/bin/env node

/**
 * Initialize Menu Configurations Script
 *
 * This script initializes the default menu configurations in Firebase.
 * Run this script:
 * - On first deployment
 * - After updating default menu structure
 * - To reset menus to default state (use --reset flag)
 *
 * Usage:
 *   node scripts/initializeMenuConfigs.js
 *   node scripts/initializeMenuConfigs.js --reset
 */

require('dotenv').config();
const logger = require('../src/utils/logger');

/**
 * Main initialization function
 */
async function initializeMenus(reset = false) {
  try {
    console.log('🚀 Starting menu configuration initialization...\n');

    if (reset) {
      console.log('⚠️  RESET MODE: Will overwrite existing menu configurations\n');
    }

    // Get current menus from database
    const existingMenus = await MenuConfigModel.getAll();
    console.log(`📋 Found ${existingMenus.length} existing menu configurations\n`);

    // Get default menus
    const defaultMenus = MenuConfigModel.getDefaultMenus();
    console.log(`📦 Preparing to initialize ${defaultMenus.length} default menus:\n`);

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const menu of defaultMenus) {
      const exists = existingMenus.find((m) => m.id === menu.id);

      if (exists && !reset) {
        console.log(`⏭️  Skipped: ${menu.icon} ${menu.name} (already exists)`);
        skipped++;
      } else {
        await MenuConfigModel.createOrUpdate(menu.id, menu);

        if (exists) {
          console.log(`🔄 Updated: ${menu.icon} ${menu.name}`);
          updated++;
        } else {
          console.log(`✅ Created: ${menu.icon} ${menu.name}`);
          created++;
        }
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SUMMARY:');
    console.log(`   ✅ Created: ${created}`);
    console.log(`   🔄 Updated: ${updated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   📋 Total:   ${created + updated + skipped}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Prewarm cache
    console.log('🔥 Prewarming cache...');
    await MenuConfigModel.prewarmCache();
    console.log('✅ Cache prewarmed successfully\n');

    console.log('🎉 Menu configuration initialization completed!\n');

    // Display menu structure
    console.log('📋 Current Menu Structure:\n');
    const allMenus = await MenuConfigModel.getAll();

    allMenus.forEach((menu, index) => {
      const statusIcon = menu.status === 'active' ? '✅' : menu.status === 'disabled' ? '❌' : '🎯';
      const typeIcon = menu.type === 'custom' ? '🔧' : '⚙️';

      console.log(`${index + 1}. ${menu.icon} ${menu.name}`);
      console.log(`   Status: ${statusIcon} ${menu.status}`);
      console.log(`   Type: ${typeIcon} ${menu.type}`);
      console.log(`   Action: ${menu.action}`);
      if (menu.status === 'tier_restricted' && menu.allowedTiers.length > 0) {
        console.log(`   Tiers: ${menu.allowedTiers.join(', ')}`);
      }
      console.log('');
    });

    logger.info('Menu configurations initialized successfully');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR: Failed to initialize menu configurations\n');
    console.error(error);
    logger.error('Error initializing menu configs:', error);
    process.exit(1);
  }
}

/**
 * Display menu information
 */
async function displayMenuInfo() {
  try {
    console.log('📋 Menu Configuration Information\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const allMenus = await MenuConfigModel.getAll();
    const customMenus = allMenus.filter((m) => m.type === 'custom');
    const systemMenus = allMenus.filter((m) => m.type === 'default');

    console.log(`Total Menus: ${allMenus.length}`);
    console.log(`System Menus: ${systemMenus.length}`);
    console.log(`Custom Menus: ${customMenus.length}\n`);

    console.log('Status Breakdown:');
    const active = allMenus.filter((m) => m.status === 'active').length;
    const disabled = allMenus.filter((m) => m.status === 'disabled').length;
    const restricted = allMenus.filter((m) => m.status === 'tier_restricted').length;

    console.log(`  ✅ Active: ${active}`);
    console.log(`  ❌ Disabled: ${disabled}`);
    console.log(`  🎯 Tier Restricted: ${restricted}\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error displaying menu info:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const reset = args.includes('--reset') || args.includes('-r');
const info = args.includes('--info') || args.includes('-i');
const help = args.includes('--help') || args.includes('-h');

if (help) {
  console.log(`
Menu Configuration Initialization Script

Usage:
  node scripts/initializeMenuConfigs.js [options]

Options:
  --reset, -r    Reset all menu configurations to defaults (overwrite existing)
  --info, -i     Display current menu configuration information
  --help, -h     Display this help message

Examples:
  node scripts/initializeMenuConfigs.js           # Initialize menus (skip existing)
  node scripts/initializeMenuConfigs.js --reset   # Reset all menus to defaults
  node scripts/initializeMenuConfigs.js --info    # Show menu information
  `);
  process.exit(0);
}

if (info) {
  displayMenuInfo();
} else {
  initializeMenus(reset);
}
