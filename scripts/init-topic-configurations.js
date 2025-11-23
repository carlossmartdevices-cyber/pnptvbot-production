/**
 * Initialize Topic Configurations
 *
 * This script sets up all topic-specific configurations for the PNPtv community group
 */

require('dotenv').config();
const TopicConfigModel = require('../src/models/topicConfigModel');
const logger = require('../src/utils/logger');

const GROUP_ID = process.env.GROUP_ID || '-1003291737499';

/**
 * Topic configurations for PNPtv community group
 */
const TOPIC_CONFIGURATIONS = [
  {
    topic_id: 3131,
    group_id: GROUP_ID,
    topic_name: 'PNPtv News!',

    // Access Control
    can_post: 'admin_only',
    can_reply: 'all',
    can_react: 'all',

    // Content Rules
    media_required: false,
    allow_text_only: true,
    allow_caption: true,
    allowed_media: ['photo', 'video', 'document', 'animation'],
    allow_stickers: true,

    // Replies
    allow_replies: true,
    reply_must_quote: false,
    allow_text_in_replies: true,

    // Moderation
    auto_moderate: false,
    anti_spam_enabled: false,
    anti_flood_enabled: false,
    anti_links_enabled: false,
    allow_commands: false,

    // Features
    notify_all_on_new_post: true,
    auto_pin_admin_messages: true,
    auto_pin_duration: 259200, // 3 days

    // Analytics
    enable_leaderboard: false,
    track_reactions: false,
    track_posts: false
  },

  {
    topic_id: 3132,
    group_id: GROUP_ID,
    topic_name: 'PNPtv Gallery!',

    // Access Control
    can_post: 'all',
    can_reply: 'all',
    can_react: 'all',

    // Content Rules - MEDIA ONLY
    media_required: true,
    allow_text_only: false,
    allow_caption: true,
    allowed_media: ['photo', 'video', 'animation'],
    allow_stickers: true,
    allow_documents: false,

    // Replies
    allow_replies: true,
    reply_must_quote: false,
    allow_text_in_replies: true,

    // Moderation
    auto_moderate: false,
    anti_spam_enabled: true,
    anti_flood_enabled: true,
    anti_links_enabled: false,
    allow_commands: true,

    // Rate Limiting
    max_posts_per_hour: 20,
    cooldown_between_posts: 15,

    // Mirror Settings - AUTO-MIRROR FROM GENERAL
    auto_mirror_enabled: true,
    mirror_from_general: true,
    mirror_format: '📸 From: @{username}\n\n{caption}',

    // Features - LEADERBOARD
    enable_leaderboard: true,
    track_reactions: true,
    track_posts: true
  },

  {
    topic_id: 3134,
    group_id: GROUP_ID,
    topic_name: 'Podcasts & Thoughts',

    // Access Control - APPROVAL REQUIRED
    can_post: 'approval_required',
    can_reply: 'all',
    can_react: 'all',

    // Content Rules
    media_required: false,
    allow_text_only: true,
    allow_caption: true,
    allowed_media: ['photo', 'video', 'audio', 'voice', 'document'],
    allow_stickers: false,

    // Replies
    allow_replies: true,
    reply_must_quote: false,
    allow_text_in_replies: true,

    // Moderation
    auto_moderate: false,
    anti_spam_enabled: false,
    anti_flood_enabled: false,
    anti_links_enabled: false,
    allow_commands: false,

    // Features
    notify_all_on_new_post: false,
    auto_pin_admin_messages: false,

    // Analytics
    enable_leaderboard: false,
    track_reactions: false,
    track_posts: false
  },

  {
    topic_id: 3135,
    group_id: GROUP_ID,
    topic_name: 'Notifications',

    // Access Control
    can_post: 'all',
    can_reply: 'all',
    can_react: 'all',

    // Content Rules
    media_required: false,
    allow_text_only: true,
    allow_caption: true,
    allowed_media: ['photo', 'video', 'document', 'animation', 'sticker'],
    allow_stickers: true,

    // Moderation
    auto_moderate: false,
    anti_spam_enabled: false,
    anti_flood_enabled: false,
    allow_commands: true,

    // Bot Behavior - COMMAND REDIRECTION & AUTO-DELETE
    redirect_bot_responses: true,
    auto_delete_enabled: true,
    auto_delete_after: 300, // 5 minutes
    override_global_deletion: true,

    // Features
    enable_leaderboard: false,
    track_reactions: false,
    track_posts: false
  }
];

/**
 * Initialize topic configurations
 */
async function initializeTopicConfigurations() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('        TOPIC CONFIGURATIONS INITIALIZATION');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // Initialize tables
    console.log('📋 Creating topic configuration tables...');
    await TopicConfigModel.initTables();
    console.log('✅ Tables created successfully\n');

    // Insert configurations
    console.log('📝 Inserting topic configurations...\n');

    for (const config of TOPIC_CONFIGURATIONS) {
      console.log(`   Configuring: ${config.topic_name} (ID: ${config.topic_id})`);

      const result = await TopicConfigModel.upsert(config);

      console.log(`   ✅ ${config.topic_name} configured successfully`);
      console.log(`      - Access: ${config.can_post}`);
      console.log(`      - Media required: ${config.media_required}`);
      console.log(`      - Auto-mirror: ${config.auto_mirror_enabled || false}`);
      console.log(`      - Leaderboard: ${config.enable_leaderboard || false}`);
      console.log(`      - Auto-delete: ${config.auto_delete_enabled || false}\n`);
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('               CONFIGURATION COMPLETE');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('📊 Summary:\n');
    console.log(`   Total topics configured: ${TOPIC_CONFIGURATIONS.length}`);
    console.log(`   Group ID: ${GROUP_ID}\n`);

    console.log('🎯 Topic Features:\n');
    console.log('   📰 PNPtv News! (3131)');
    console.log('      - Admin-only posting');
    console.log('      - Auto-pin for 3 days');
    console.log('      - Notify all on post\n');

    console.log('   🎨 PNPtv Gallery! (3132)');
    console.log('      - Media-only content');
    console.log('      - Auto-mirror from general chat');
    console.log('      - Leaderboard enabled');
    console.log('      - Rate limit: 20 posts/hour\n');

    console.log('   🎙️ Podcasts & Thoughts (3134)');
    console.log('      - Admin approval required');
    console.log('      - All media types allowed\n');

    console.log('   🔔 Notifications (3135)');
    console.log('      - Bot command responses');
    console.log('      - Auto-delete after 5 minutes\n');

    console.log('✅ All configurations initialized successfully!\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error initializing topic configurations:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run initialization
initializeTopicConfigurations();
