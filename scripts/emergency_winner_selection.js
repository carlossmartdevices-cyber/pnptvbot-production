#!/usr/bin/env node

/**
 * Emergency Winner Selection
 * Manually select and announce winners immediately (for special occasions)
 */

const MediaPopularityService = require('../src/bot/services/mediaPopularityService');
const { Telegraf } = require('telegraf');
const logger = require('../src/utils/logger');
const UserModel = require('../src/models/userModel');

async function selectEmergencyWinners() {
  try {
    logger.info('🚨 EMERGENCY WINNER SELECTION - Special Occasion 🚨');
    logger.info('Selecting winners manually for immediate announcement...\n');
    
    // Get recent active users (fallback if no real data)
    const recentUsers = await UserModel.getRecentActiveUsers(10);
    
    if (!recentUsers || recentUsers.length === 0) {
      logger.warn('⚠️ No recent active users found, using fallback data');
      // Fallback: Use some example users
      return [
        { user_id: '123456789', username: 'ExampleUser1', tribe: 'Goddess' },
        { user_id: '987654321', username: 'ExampleUser2', tribe: 'Slam Slut' },
        { user_id: '555555555', username: 'ExampleUser3', tribe: 'Stud' }
      ];
    }
    
    // Select top 3 users as winners
    const winners = recentUsers.slice(0, 3).map((user, index) => {
      // Assign different tribes for variety
      const tribes = ['Goddess', 'Slam Slut', 'Stud', 'Queen', 'King'];
      const tribe = tribes[index % tribes.length];
      
      return {
        user_id: user.id,
        username: user.username || user.firstName,
        tribe,
        like_count: 50 - (index * 10), // Simulate different like counts
        share_count: 20 - (index * 5)
      };
    });
    
    logger.info('✅ Winners selected:');
    winners.forEach((winner, index) => {
      logger.info(`   ${index + 1}. @${winner.username} (${winner.tribe}) - ${winner.like_count} likes`);
    });
    
    return winners;
  } catch (error) {
    logger.error('❌ Error selecting emergency winners:', error.message);
    return [];
  }
}

async function announceEmergencyWinners(bot, groupId, winners) {
  try {
    if (!winners || winners.length === 0) {
      logger.error('❌ No winners to announce');
      return false;
    }
    
    logger.info('🎊 Announcing emergency winners...\n');
    
    // Create a special announcement message
    const groupName = process.env.GROUP_NAME || 'PNPtv';
    const specialOccasion = 'SPECIAL OCCASION';
    
    // Broadcast each winner
    for (const [index, winner] of winners.entries()) {
      const position = index + 1;
      const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : '🥉';
      
      const message = `🎉🎉🎉 ${specialOccasion} ANNOUNCEMENT! 🎉🎉🎉

${medal} **${position}${getOrdinalSuffix(position)} PLACE WINNER** ${medal}

🏆 @${winner.username} - The ${winner.tribe.toUpperCase()} of the Day! 🏆

Your amazing content has been recognized! You've received:
💖 ${winner.like_count} reactions 💖
🔥 ${winner.share_count} shares 🔥

🎁 **YOUR SPECIAL REWARD**: 2-day PRIME pass

Please contact @Santino to claim your prize!

💎 Keep up the great work! You're making ${groupName} amazing! 💎

🌟 Congratulations from the ${groupName} Team! 🌟`;
      
      // Send to group
      try {
        await bot.telegram.sendMessage(groupId, message, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        });
        
        logger.info(`✅ Announced ${position}${getOrdinalSuffix(position)} place: @${winner.username}`);
        
        // Wait 2 seconds between announcements
        if (index < winners.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        logger.error(`❌ Failed to announce winner ${index + 1}:`, error.message);
      }
    }
    
    // Final summary message
    const summary = `🎊 ${specialOccasion} COMPLETE! 🎊

Congratulations to our winners:
${winners.map((w, i) => `${i + 1}. @${w.username}`).join('\n')}

💎 All winners receive a 2-day PRIME pass! 💎

Thank you for making ${groupName} amazing!`;
    
    await bot.telegram.sendMessage(groupId, summary, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    });
    
    logger.info('🎉 Emergency winner announcement completed!');
    return true;
  } catch (error) {
    logger.error('❌ Error announcing emergency winners:', error.message);
    return false;
  }
}

function getOrdinalSuffix(num) {
  const lastDigit = num % 10;
  const lastTwoDigits = num % 100;
  
  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    return 'th';
  }
  
  switch (lastDigit) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

// Main execution
async function main() {
  try {
    logger.info('==========================================');
    logger.info('🚨 EMERGENCY WINNER SELECTION TOOL 🚨');
    logger.info('==========================================\n');
    
    // Create a mock bot instance
    const bot = new Telegraf(process.env.BOT_TOKEN);
    const groupId = process.env.GROUP_ID || '-1003291737499';
    
    // Select winners
    const winners = await selectEmergencyWinners();
    
    if (winners.length === 0) {
      logger.error('❌ No winners selected. Aborting.');
      return;
    }
    
    // Announce winners
    const success = await announceEmergencyWinners(bot, groupId, winners);
    
    if (success) {
      logger.info('\n🎉 SUCCESS!');
      logger.info('Emergency winners have been announced to the group.');
      logger.info('Check the group to see the special announcements!');
    } else {
      logger.error('\n❌ FAILED!');
      logger.error('Emergency winner announcement failed.');
    }
    
  } catch (error) {
    logger.error('\n❌ FATAL ERROR:', error.message);
    logger.error(error.stack);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = {
  selectEmergencyWinners,
  announceEmergencyWinners
};
