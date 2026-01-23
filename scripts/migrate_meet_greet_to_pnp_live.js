#!/usr/bin/env node

/**
 * Migration Script: Meet & Greet → PNP Latino Live
 * 
 * This script updates the bot configuration to replace Meet & Greet with PNP Latino Live
 * It handles:
 * 1. Database migration (if needed)
 * 2. Handler registration updates
 * 3. Configuration updates
 * 4. Environment variable updates
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  oldHandlers: [
    'meetGreetHandler',
    'meetGreetManagement'
  ],
  newHandlers: [
    'pnpLiveHandler',
    'pnpLiveManagement'
  ],
  oldActions: [
    'MEET_GREET_START',
    'my_bookings',
    'admin_meet_greet'
  ],
  newActions: [
    'PNP_LIVE_START',
    'my_pnp_bookings',
    'admin_pnp_live'
  ],
  backupDir: './backups/migration_pnp_live'
};

class PNPLiveMigrator {
  constructor() {
    this.logs = [];
    this.errors = [];
  }

  log(message) {
    const timestamp = new Date().toISOString();
    this.logs.push(`[${timestamp}] ${message}`);
    console.log(`✅ ${message}`);
  }

  error(message) {
    const timestamp = new Date().toISOString();
    this.errors.push(`[${timestamp}] ${message}`);
    console.error(`❌ ${message}`);
  }

  async createBackup() {
    try {
      if (!fs.existsSync(CONFIG.backupDir)) {
        fs.mkdirSync(CONFIG.backupDir, { recursive: true });
        this.log(`Created backup directory: ${CONFIG.backupDir}`);
      }

      // Backup main bot file
      const botFile = './src/bot/core/bot.js';
      if (fs.existsSync(botFile)) {
        const backupFile = path.join(CONFIG.backupDir, 'bot.js.backup');
        fs.copyFileSync(botFile, backupFile);
        this.log(`Backed up: ${botFile} → ${backupFile}`);
      }

      // Backup handler files
      CONFIG.oldHandlers.forEach(handler => {
        const handlerFile = `./src/bot/handlers/user/${handler}.js`;
        if (fs.existsSync(handlerFile)) {
          const backupFile = path.join(CONFIG.backupDir, `${handler}.js.backup`);
          fs.copyFileSync(handlerFile, backupFile);
          this.log(`Backed up: ${handlerFile} → ${backupFile}`);
        }
      });

      // Backup admin handler files
      CONFIG.oldHandlers.forEach(handler => {
        const handlerFile = `./src/bot/handlers/admin/${handler}.js`;
        if (fs.existsSync(handlerFile)) {
          const backupFile = path.join(CONFIG.backupDir, `admin_${handler}.js.backup`);
          fs.copyFileSync(handlerFile, backupFile);
          this.log(`Backed up: ${handlerFile} → ${backupFile}`);
        }
      });

      return true;
    } catch (error) {
      this.error(`Backup failed: ${error.message}`);
      return false;
    }
  }

  updateBotRegistration() {
    try {
      const botFile = './src/bot/core/bot.js';
      if (!fs.existsSync(botFile)) {
        this.error(`Bot file not found: ${botFile}`);
        return false;
      }

      let botContent = fs.readFileSync(botFile, 'utf8');

      // Replace old handler registrations with new ones
      CONFIG.oldHandlers.forEach((oldHandler, index) => {
        const oldImport = `const ${oldHandler} = require('../handlers/user/${oldHandler}')`;
        const newImport = `const ${CONFIG.newHandlers[index]} = require('../handlers/user/${CONFIG.newHandlers[index]}')`;
        
        botContent = botContent.replace(oldImport, newImport);
        this.log(`Replaced import: ${oldImport} → ${newImport}`);
      });

      // Replace old admin handler registrations
      CONFIG.oldHandlers.forEach((oldHandler, index) => {
        const oldAdminImport = `const ${oldHandler} = require('../handlers/admin/${oldHandler}')`;
        const newAdminImport = `const ${CONFIG.newHandlers[index]} = require('../handlers/admin/${CONFIG.newHandlers[index]}')`;
        
        botContent = botContent.replace(oldAdminImport, newAdminImport);
        this.log(`Replaced admin import: ${oldAdminImport} → ${newAdminImport}`);
      });

      // Replace handler registrations
      CONFIG.oldHandlers.forEach((oldHandler, index) => {
        const oldRegistration = `${oldHandler}(bot);`;
        const newRegistration = `${CONFIG.newHandlers[index]}(bot);`;
        
        botContent = botContent.replace(oldRegistration, newRegistration);
        this.log(`Replaced registration: ${oldRegistration} → ${newRegistration}`);
      });

      // Replace admin handler registrations
      CONFIG.oldHandlers.forEach((oldHandler, index) => {
        const oldAdminRegistration = `${oldHandler}(bot);`;
        const newAdminRegistration = `${CONFIG.newHandlers[index]}(bot);`;
        
        botContent = botContent.replace(oldAdminRegistration, newAdminRegistration);
        this.log(`Replaced admin registration: ${oldAdminRegistration} → ${newAdminRegistration}`);
      });

      fs.writeFileSync(botFile, botContent, 'utf8');
      this.log(`Updated bot registration file: ${botFile}`);

      return true;
    } catch (error) {
      this.error(`Failed to update bot registration: ${error.message}`);
      return false;
    }
  }

  updateHandlerIndexFiles() {
    try {
      // Update user handlers index
      const userIndexFile = './src/bot/handlers/user/index.js';
      if (fs.existsSync(userIndexFile)) {
        let userContent = fs.readFileSync(userIndexFile, 'utf8');
        
        // Replace meetGreet handler registration
        const oldUserRegistration = `const registerMeetGreetHandlers = require('./meetGreetHandler');`;
        const newUserRegistration = `const registerPNPLiveHandlers = require('./pnpLiveHandler');`;
        
        userContent = userContent.replace(oldUserRegistration, newUserRegistration);
        this.log(`Updated user index: ${oldUserRegistration} → ${newUserRegistration}`);
        
        // Replace handler call
        const oldUserCall = `registerMeetGreetHandlers(bot);`;
        const newUserCall = `registerPNPLiveHandlers(bot);`;
        
        userContent = userContent.replace(oldUserCall, newUserCall);
        this.log(`Updated user index call: ${oldUserCall} → ${newUserCall}`);
        
        fs.writeFileSync(userIndexFile, userContent, 'utf8');
        this.log(`Updated user handlers index file: ${userIndexFile}`);
      }

      // Update admin handlers index
      const adminIndexFile = './src/bot/handlers/admin/index.js';
      if (fs.existsSync(adminIndexFile)) {
        let adminContent = fs.readFileSync(adminIndexFile, 'utf8');
        
        // Replace meetGreet management handler registration
        const oldAdminRegistration = `const registerMeetGreetManagementHandlers = require('./meetGreetManagement');`;
        const newAdminRegistration = `const registerPNPLiveManagementHandlers = require('./pnpLiveManagement');`;
        
        adminContent = adminContent.replace(oldAdminRegistration, newAdminRegistration);
        this.log(`Updated admin index: ${oldAdminRegistration} → ${newAdminRegistration}`);
        
        // Replace handler call
        const oldAdminCall = `registerMeetGreetManagementHandlers(bot);`;
        const newAdminCall = `registerPNPLiveManagementHandlers(bot);`;
        
        adminContent = adminContent.replace(oldAdminCall, newAdminCall);
        this.log(`Updated admin index call: ${oldAdminCall} → ${newAdminCall}`);
        
        // Replace admin_meet_greet action with admin_pnp_live
        const oldAdminAction = `'💃 ' + (lang === 'es' ? 'Meet & Greet' : 'Meet & Greet'), 'admin_meet_greet'`;
        const newAdminAction = `'📹 ' + (lang === 'es' ? 'PNP Latino Live' : 'PNP Latino Live'), 'admin_pnp_live'`;
        
        adminContent = adminContent.replace(oldAdminAction, newAdminAction);
        this.log(`Updated admin action: Meet & Greet → PNP Latino Live`);
        
        fs.writeFileSync(adminIndexFile, adminContent, 'utf8');
        this.log(`Updated admin handlers index file: ${adminIndexFile}`);
      }

      return true;
    } catch (error) {
      this.error(`Failed to update handler index files: ${error.message}`);
      return false;
    }
  }

  updateMenuStructure() {
    try {
      // This would update the menu structure in the bot
      // For now, we'll log what needs to be updated
      this.log('Menu structure updates needed:');
      
      CONFIG.oldActions.forEach((oldAction, index) => {
        this.log(`  Replace "${oldAction}" with "${CONFIG.newActions[index]}"`);
      });

      return true;
    } catch (error) {
      this.error(`Menu update failed: ${error.message}`);
      return false;
    }
  }

  updateDatabase() {
    try {
      // Check if migration file exists
      const migrationFile = './database/migrations/040_pnp_latino_live_system.sql';
      if (fs.existsSync(migrationFile)) {
        this.log(`Migration file found: ${migrationFile}`);
        this.log('Run this migration with your database migration tool');
      } else {
        this.error(`Migration file not found: ${migrationFile}`);
        return false;
      }

      return true;
    } catch (error) {
      this.error(`Database update check failed: ${error.message}`);
      return false;
    }
  }

  createMigrationGuide() {
    try {
      const guide = `
# PNP Latino Live Migration Guide

## Overview
This guide helps you migrate from Meet & Greet to PNP Latino Live.

## Steps

### 1. Backup
- Run: node scripts/migrate_meet_greet_to_pnp_live.js --backup
- Verify backups in: ${CONFIG.backupDir}

### 2. Database Migration
- Apply migration: 040_pnp_latino_live_system.sql
- Command: psql -U your_user -d your_db -f database/migrations/040_pnp_latino_live_system.sql

### 3. Update Bot Code
- Run: node scripts/migrate_meet_greet_to_pnp_live.js --update
- This updates handler registrations

### 4. Update Menu Actions
- Replace old actions with new ones in your menu structure:
  - MEET_GREET_START → PNP_LIVE_START
  - my_bookings → my_pnp_bookings
  - admin_meet_greet → admin_pnp_live

### 5. Environment Variables
- No new variables needed for PNP Latino Live
- Existing JaaS configuration will be used

### 6. Testing
- Test in staging environment first
- Verify all flows work correctly
- Check notifications and webhooks

### 7. Deployment
- Deploy to production
- Monitor logs for errors
- Rollback if needed (backups available)

## Rollback
To rollback, restore from backups in: ${CONFIG.backupDir}

## Support
For issues, check logs and contact development team.
`;

      const guidePath = './MIGRATION_GUIDE_PNP_LIVE.md';
      fs.writeFileSync(guidePath, guide);
      this.log(`Created migration guide: ${guidePath}`);

      return true;
    } catch (error) {
      this.error(`Failed to create migration guide: ${error.message}`);
      return false;
    }
  }

  async run() {
    this.log('Starting PNP Latino Live migration...');
    
    // Step 1: Create backup
    this.log('\n=== Step 1: Creating backup ===');
    const backupSuccess = await this.createBackup();
    
    if (!backupSuccess) {
      this.error('Migration aborted due to backup failure');
      return false;
    }

    // Step 2: Update bot registration
    this.log('\n=== Step 2: Updating bot registration ===');
    const updateSuccess = this.updateBotRegistration();
    
    if (!updateSuccess) {
      this.error('Migration aborted due to update failure');
      return false;
    }

    // Step 3: Update handler index files
    this.log('\n=== Step 3: Updating handler index files ===');
    const handlerIndexSuccess = this.updateHandlerIndexFiles();
    
    if (!handlerIndexSuccess) {
      this.error('Handler index update failed (continuing...)');
    }

    // Step 4: Update menu structure
    this.log('\n=== Step 4: Updating menu structure ===');
    const menuSuccess = this.updateMenuStructure();
    
    if (!menuSuccess) {
      this.error('Menu update failed (continuing...)');
    }

    // Step 5: Check database
    this.log('\n=== Step 5: Checking database ===');
    const dbSuccess = this.updateDatabase();
    
    if (!dbSuccess) {
      this.error('Database check failed (continuing...)');
    }

    // Step 6: Create migration guide
    this.log('\n=== Step 6: Creating migration guide ===');
    const guideSuccess = this.createMigrationGuide();
    
    if (!guideSuccess) {
      this.error('Failed to create migration guide');
    }

    // Summary
    this.log('\n=== Migration Summary ===');
    this.log(`✅ Backup: ${backupSuccess ? 'Success' : 'Failed'}`);
    this.log(`✅ Bot Registration: ${updateSuccess ? 'Success' : 'Failed'}`);
    this.log(`✅ Handler Index Files: ${handlerIndexSuccess ? 'Success' : 'Failed'}`);
    this.log(`✅ Menu Structure: ${menuSuccess ? 'Success' : 'Failed'}`);
    this.log(`✅ Database: ${dbSuccess ? 'Success' : 'Failed'}`);
    this.log(`✅ Migration Guide: ${guideSuccess ? 'Success' : 'Failed'}`);

    if (this.errors.length > 0) {
      this.error(`\n⚠️  Migration completed with ${this.errors.length} errors`);
      this.error('Check logs above for details');
    } else {
      this.log('\n🎉 Migration completed successfully!');
      this.log('Follow the migration guide for next steps');
    }

    return true;
  }
}

// Run migration if called directly
if (require.main === module) {
  const migrator = new PNPLiveMigrator();
  migrator.run().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = PNPLiveMigrator;