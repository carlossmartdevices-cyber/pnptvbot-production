#!/usr/bin/env node

/**
 * Initialize access control and permissions system database tables
 * Run this script once to set up the access control system
 */

require('dotenv-safe').config({ allowEmptyValues: true });
const RoleService = require('../src/services/roleService');
const ApprovalService = require('../src/services/approvalService');
const logger = require('../src/utils/logger');

async function initializeAccessControlTables() {
  try {
    logger.info('Initializing access control system database tables...');

    // Initialize role tables
    await RoleService.initializeTables();
    logger.info('✅ Role service tables initialized');

    // Initialize approval tables
    await ApprovalService.initializeTables();
    logger.info('✅ Approval service tables initialized');

    logger.info('\n✅ Access control system database tables initialized successfully!\n');
    logger.info('The following tables have been created:');
    logger.info('  • user_roles - Stores user roles (USER, CONTRIBUTOR, PERFORMER, ADMIN)');
    logger.info('  • approval_queue - Stores posts pending approval\n');

    logger.info('You can now use the access control commands:');
    logger.info('\n**Role Management:**');
    logger.info('  • /grantrole @user ROLE - Grant a role to a user');
    logger.info('  • /revokerole @user - Revoke a user\'s role');
    logger.info('  • /checkrole @user - Check a user\'s role');
    logger.info('  • /rolestats - View role statistics');

    logger.info('\n**Approval Management:**');
    logger.info('  • /approvalqueue - View pending approvals');
    logger.info('  • /approvalstats - View approval statistics');
    logger.info('  • Approve/Reject buttons in admin notifications\n');

    logger.info('Topic permissions are automatically enforced:');
    logger.info('  • Topic 3131: Admin-only (auto-delete unauthorized posts)');
    logger.info('  • Topic 3134: Requires approval (ADMIN, PERFORMER, CONTRIBUTOR)');
    logger.info('  • Topic 3135: Rate-limited (10 posts per 5 minutes)\n');

    process.exit(0);
  } catch (error) {
    logger.error('Error initializing access control tables:', error);
    process.exit(1);
  }
}

initializeAccessControlTables();
