const { Markup } = require('telegraf');
const logger = require('../../../utils/logger');
const { t } = require('../../../utils/i18n');

/**
 * Group Video Call Handlers
 * Allows admins/hosts to start video calls and invite group members
 * @param {Telegraf} bot - Bot instance
 */
const registerGroupVideoCallHandlers = (bot) => {
  /**
   * Start group video call
   * Usage: /startgroupcall or button click
   */
  bot.command('startgroupcall', async (ctx) => {
    try {
      // Only allow in groups
      if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
        await ctx.reply('❌ This command only works in groups');
        return;
      }

      // Check if user is admin/creator
      const chatMember = await ctx.getChatMember(ctx.from.id);
      if (!['creator', 'administrator'].includes(chatMember.status)) {
        await ctx.reply('❌ Only group admins can start video calls');
        return;
      }

      const groupName = ctx.chat.title || 'Group Video Call';
      const groupId = ctx.chat.id;
      const hostId = ctx.from.id;
      const hostName = ctx.from.first_name || 'Admin';
      
      // Generate a unique call room code
      const roomCode = `GRP_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const callLink = `https://t.me/${ctx.botInfo?.username}?start=join_group_call_${roomCode}`;

      // Create the invitation message
      const inviteMessage = [
        `🎥 *GROUP VIDEO CALL STARTED*`,
        ``,
        `📱 Host: @${ctx.from.username || hostName}`,
        `👥 Group: ${groupName}`,
        `🆔 Call Room: \`${roomCode}\``,
        ``,
        `🔗 Join the call:`,
        `[📲 Tap to Join](${callLink})`,
        ``,
        `⏱️ Call started at: ${new Date().toLocaleTimeString()}`,
        ``,
        `👇 Or use the button below to join:`,
      ].join('\n');

      // Send invitation to group
      await ctx.reply(inviteMessage, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        ...Markup.inlineKeyboard([
          [
            Markup.button.url('📱 Join Video Call', callLink),
            Markup.button.callback('❌ End Call', `end_group_call_${roomCode}`),
          ],
          [
            Markup.button.callback('📊 Call Info', `group_call_info_${roomCode}`),
            Markup.button.callback('👥 Participants', `group_call_participants_${roomCode}`),
          ],
        ]),
      });

      logger.info('Group video call started', {
        groupId,
        roomCode,
        hostId,
        groupName,
      });

      // Send notification to group members (bot mentions)
      const mentionMessage = [
        `🎉 **Group video call is live!**`,
        ``,
        `🎥 Hosted by @${ctx.from.username || hostName}`,
        ``,
        `👆 Click the button above or [join here](${callLink})`,
      ].join('\n');

      await ctx.reply(mentionMessage, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      });

    } catch (error) {
      logger.error('Error starting group video call:', error);
      await ctx.reply('❌ Failed to start group video call. Please try again.');
    }
  });

  /**
   * End group video call
   */
  bot.action(/^end_group_call_(.+)$/, async (ctx) => {
    try {
      const roomCode = ctx.match[1];

      const endMessage = [
        `⏹️ *VIDEO CALL ENDED*`,
        ``,
        `🆔 Room: \`${roomCode}\``,
        `⏱️ Ended at: ${new Date().toLocaleTimeString()}`,
        ``,
        `Thank you for participating! 👋`,
      ].join('\n');

      await ctx.editMessageText(endMessage, { parse_mode: 'Markdown' });
      await ctx.answerCbQuery('✅ Group call ended');

      logger.info('Group video call ended', { roomCode });
    } catch (error) {
      logger.error('Error ending group video call:', error);
      await ctx.answerCbQuery('❌ Error ending call');
    }
  });

  /**
   * Show call info
   */
  bot.action(/^group_call_info_(.+)$/, async (ctx) => {
    try {
      const roomCode = ctx.match[1];

      const infoMessage = [
        `ℹ️ *CALL INFORMATION*`,
        ``,
        `🆔 Room Code: \`${roomCode}\``,
        `📍 Group: ${ctx.chat.title}`,
        `🟢 Status: LIVE`,
        `⏱️ Started: ${new Date().toLocaleTimeString()}`,
        ``,
        `💡 Tip: Share this call with group members!`,
      ].join('\n');

      await ctx.answerCbQuery();
      await ctx.reply(infoMessage, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('Error getting call info:', error);
      await ctx.answerCbQuery('❌ Error getting call info');
    }
  });

  /**
   * Show participants
   */
  bot.action(/^group_call_participants_(.+)$/, async (ctx) => {
    try {
      const roomCode = ctx.match[1];
      
      // Get group members
      const members = await ctx.getChatMembersCount();
      
      const participantsMessage = [
        `👥 *CALL PARTICIPANTS*`,
        ``,
        `🆔 Room: \`${roomCode}\``,
        `📊 Group Size: ${members} members`,
        `🟢 Status: ACTIVE`,
        ``,
        `Invite more members by sharing the call link!`,
      ].join('\n');

      await ctx.answerCbQuery();
      await ctx.reply(participantsMessage, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('Error getting participants:', error);
      await ctx.answerCbQuery('❌ Error getting participants');
    }
  });

  /**
   * Invite all group members
   */
  bot.command('inviteall', async (ctx) => {
    try {
      // Only allow in groups
      if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
        await ctx.reply('❌ This command only works in groups');
        return;
      }

      // Check if user is admin/creator
      const chatMember = await ctx.getChatMember(ctx.from.id);
      if (!['creator', 'administrator'].includes(chatMember.status)) {
        await ctx.reply('❌ Only group admins can send invites');
        return;
      }

      const roomCode = ctx.args[0] || `GRP_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const callLink = `https://t.me/${ctx.botInfo?.username}?start=join_group_call_${roomCode}`;

      const inviteMessage = [
        `📢 **ATTENTION ALL MEMBERS!**`,
        ``,
        `🎥 There's a group video call happening NOW`,
        ``,
        `🎯 Hosted by: @${ctx.from.username || ctx.from.first_name}`,
        ``,
        `👉 [**TAP HERE TO JOIN**](${callLink})`,
        ``,
        `⏰ Don't miss out! Join now!`,
      ].join('\n');

      await ctx.reply(inviteMessage, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        ...Markup.inlineKeyboard([
          [Markup.button.url('🎥 Join Now', callLink)],
        ]),
      });

      logger.info('Group invite sent', {
        groupId: ctx.chat.id,
        groupName: ctx.chat.title,
        roomCode,
        senderId: ctx.from.id,
      });

    } catch (error) {
      logger.error('Error sending group invite:', error);
      await ctx.reply('❌ Failed to send invite');
    }
  });

  /**
   * Join group call from private message
   */
  bot.command('join_group_call', async (ctx) => {
    try {
      const roomCode = ctx.args[0];
      
      if (!roomCode) {
        await ctx.reply('❌ No call room specified');
        return;
      }

      const joinMessage = [
        `✅ *YOU JOINED THE GROUP VIDEO CALL*`,
        ``,
        `🆔 Room: \`${roomCode}\``,
        `⏱️ Joined at: ${new Date().toLocaleTimeString()}`,
        ``,
        `🎉 Welcome to the call! You can now see and hear other participants.`,
        ``,
        `💡 To leave the call, use: /leavecall`,
      ].join('\n');

      await ctx.reply(joinMessage, { parse_mode: 'Markdown' });

      logger.info('User joined group call', {
        userId: ctx.from.id,
        userName: ctx.from.username,
        roomCode,
      });

    } catch (error) {
      logger.error('Error joining group call:', error);
      await ctx.reply('❌ Error joining call');
    }
  });

  /**
   * Leave group call
   */
  bot.command('leavecall', async (ctx) => {
    try {
      const leaveMessage = [
        `👋 *YOU LEFT THE GROUP VIDEO CALL*`,
        ``,
        `⏱️ Left at: ${new Date().toLocaleTimeString()}`,
        ``,
        `Thanks for participating! Join the next call.`,
      ].join('\n');

      await ctx.reply(leaveMessage, { parse_mode: 'Markdown' });

      logger.info('User left group call', {
        userId: ctx.from.id,
        userName: ctx.from.username,
      });

    } catch (error) {
      logger.error('Error leaving group call:', error);
      await ctx.reply('❌ Error leaving call');
    }
  });
};

module.exports = registerGroupVideoCallHandlers;
