#!/usr/bin/env node
/**
 * Script to sync channel/group members with database
 * Creates user records for members not in the database
 *
 * Usage: node scripts/sync-channel-members.js [--channel-id=CHANNEL_ID] [--dry-run]
 */

require('dotenv').config();
const { Telegraf } = require('telegraf');
const { query } = require('../src/config/database');
const logger = require('../src/utils/logger');

const isDryRun = process.argv.includes('--dry-run');
const channelIdArg = process.argv.find(arg => arg.startsWith('--channel-id='));
const CHANNEL_ID = channelIdArg
  ? channelIdArg.split('=')[1]
  : process.env.PRIME_CHANNEL_ID || process.env.GROUP_ID;

const bot = new Telegraf(process.env.BOT_TOKEN);

/**
 * Check if user exists in database
 */
async function userExists(userId) {
  const result = await query('SELECT id FROM users WHERE id = $1', [userId.toString()]);
  return result.rows.length > 0;
}

/**
 * Create basic user record
 */
async function createUser(member) {
  if (isDryRun) {
    console.log(`[DRY RUN] Would create user: ${member.user.id} (@${member.user.username || 'no_username'})`);
    return;
  }

  const userId = member.user.id.toString();

  try {
    await query(`
      INSERT INTO users (
        id,
        username,
        first_name,
        last_name,
        language,
        onboarding_complete,
        age_verified,
        terms_accepted,
        privacy_accepted,
        created_at,
        updated_at,
        subscription_status,
        is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), $10, $11)
      ON CONFLICT (id) DO NOTHING
    `, [
      userId,
      member.user.username || null,
      member.user.first_name || null,
      member.user.last_name || null,
      member.user.language_code || 'es',
      false, // onboarding_complete - force re-onboarding
      false, // age_verified
      false, // terms_accepted
      false, // privacy_accepted
      'inactive', // subscription_status
      true, // is_active
    ]);

    logger.info('Created user from channel sync', {
      userId,
      username: member.user.username,
    });

    return true;
  } catch (error) {
    logger.error('Error creating user:', error);
    return false;
  }
}

/**
 * Get channel administrators (we can enumerate them)
 */
async function getChannelAdmins(channelId) {
  try {
    const admins = await bot.telegram.getChatAdministrators(channelId);
    return admins;
  } catch (error) {
    console.error('Error getting channel admins:', error.message);
    return [];
  }
}

/**
 * Main sync function
 * Note: Telegram API doesn't allow enumerating all channel members
 * We can only get administrators. For regular members, they need to interact with the bot.
 */
async function syncChannelMembers() {
  console.log('='.repeat(60));
  console.log('Channel Member Sync Script');
  console.log('='.repeat(60));

  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }

  if (!CHANNEL_ID) {
    console.error('Error: No channel ID specified. Use --channel-id=CHANNEL_ID or set PRIME_CHANNEL_ID');
    process.exit(1);
  }

  console.log(`Channel ID: ${CHANNEL_ID}\n`);

  try {
    // Get channel info
    const chat = await bot.telegram.getChat(CHANNEL_ID);
    console.log(`Channel: ${chat.title || chat.username || CHANNEL_ID}`);
    console.log(`Type: ${chat.type}`);
    if (chat.members_count) {
      console.log(`Members: ${chat.members_count}`);
    }
    console.log('');

    // Get administrators
    console.log('Fetching administrators...');
    const admins = await getChannelAdmins(CHANNEL_ID);
    console.log(`Found ${admins.length} administrators\n`);

    let created = 0;
    let existing = 0;
    let bots = 0;

    for (const admin of admins) {
      // Skip bots
      if (admin.user.is_bot) {
        bots++;
        continue;
      }

      const exists = await userExists(admin.user.id);

      if (!exists) {
        console.log(`Creating user: ${admin.user.id} (@${admin.user.username || 'no_username'}) - ${admin.status}`);
        const success = await createUser(admin);
        if (success) created++;
      } else {
        existing++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('SYNC SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total admins: ${admins.length}`);
    console.log(`Bots skipped: ${bots}`);
    console.log(`Already in DB: ${existing}`);
    console.log(`Created: ${created}`);

    console.log('\n⚠️  NOTE: Telegram API does not allow enumerating regular channel members.');
    console.log('Regular members will be synced when they interact with the bot.');
    console.log('The userExistsMiddleware will create their records automatically.');

  } catch (error) {
    console.error('Error in sync:', error);
    process.exit(1);
  }
}

// Run sync
syncChannelMembers()
  .then(() => {
    console.log('\nSync completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Sync failed:', error);
    process.exit(1);
  });
