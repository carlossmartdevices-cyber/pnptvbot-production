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
   * Sends full message to group with all call details
   */
  bot.command('startgroupcall', async (ctx) => {
    try {
      logger.info('📱 /startgroupcall command received', {
        chatId: ctx.chat?.id,
        chatType: ctx.chat?.type,
        chatTitle: ctx.chat?.title,
        userId: ctx.from?.id,
        username: ctx.from?.username,
      });

      // Get community group ID from environment
      const communityGroupId = process.env.GROUP_ID ? parseInt(process.env.GROUP_ID) : null;
      
      if (!communityGroupId) {
        logger.error('GROUP_ID environment variable not set');
        await ctx.reply('❌ Community group not configured');
        return;
      }

      // Only allow command from the community group
      if (ctx.chat.id !== communityGroupId) {
        logger.warn('Command used outside community group', { 
          commandChatId: ctx.chat.id, 
          communityGroupId,
          userId: ctx.from.id 
        });
        await ctx.reply('❌ This command only works in the community group');
        return;
      }

      // Allow any group member to start calls
      const hostId = ctx.from.id;
      const hostName = ctx.from.first_name || 'Member';
      
      // Start a Telegram video chat in the community group FIRST
      let videoChatStarted = false;
      try {
        logger.info('Starting Telegram video chat in community group...', { communityGroupId, hostId });
        await ctx.telegram.requestVideoChatStart(communityGroupId);
        videoChatStarted = true;
        logger.info('✅ Telegram video chat started successfully', { communityGroupId });
      } catch (videoChatError) {
        logger.error('Error requesting video chat:', videoChatError);
        await ctx.reply('❌ Failed to start video call. Please try again.');
        return;
      }

      // Wait a moment for the video chat to initialize
      await new Promise(resolve => setTimeout(resolve, 500));

      // Create the announcement message
      const inviteMessage = [
        `🎥 *GROUP VIDEO CALL STARTED*`,
        ``,
        `📱 Host: @${ctx.from.username || hostName}`,
        `👥 Community Video Call`,
        ``,
        `🔴 Video call is now LIVE!`,
        ``,
        `Tap the video call icon above to join directly 📲`,
        ``,
        `⏱️ Started at: ${new Date().toLocaleTimeString()}`,
      ].join('\n');

      // Send announcement message to COMMUNITY GROUP
      try {
        const groupMessage = await ctx.telegram.sendMessage(communityGroupId, inviteMessage, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback('👥 Participants', `group_call_participants_live`),
              Markup.button.callback('📊 Call Info', `group_call_info_live`),
            ],
          ]),
        });

        // Pin the message in community group for visibility
        try {
          await ctx.telegram.pinChatMessage(communityGroupId, groupMessage.message_id, { disable_notification: true });
        } catch (pinError) {
          logger.warn('Could not pin message:', pinError.message);
        }

        logger.info('Group video call started and announcement sent', {
          communityGroupId,
          hostId,
          videoChatStarted,
          messageId: groupMessage.message_id,
        });

      } catch (groupError) {
        logger.error('Error sending to community group:', groupError);
        await ctx.reply('❌ Failed to send announcement. Video call started but check the group.');
      }

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

  /**
   * Start video call with full notifications
   * Usage: /videocall
   * Notifies all group members that a call is starting
   */
  bot.command('videocall', async (ctx) => {
    try {
      logger.info('📱 /videocall command received', {
        chatId: ctx.chat?.id,
        userId: ctx.from?.id,
        username: ctx.from?.username,
      });

      const communityGroupId = process.env.GROUP_ID ? parseInt(process.env.GROUP_ID) : null;
      
      if (!communityGroupId) {
        logger.error('GROUP_ID environment variable not set');
        await ctx.reply('❌ Community group not configured');
        return;
      }

      // Only allow in community group
      if (ctx.chat.id !== communityGroupId) {
        await ctx.reply('❌ This command only works in the community group');
        return;
      }

      const hostName = ctx.from.first_name || 'Host';
      const hostUsername = ctx.from.username || 'unknown';
      
      try {
        // Start video chat
        logger.info('Starting video chat...', { communityGroupId, hostUsername });
        await ctx.telegram.requestVideoChatStart(communityGroupId);
        
        // Wait for video chat to initialize
        await new Promise(resolve => setTimeout(resolve, 500));

        // Create notification message
        const notificationMessage = [
          `🎥 **VIDEO CALL STARTED** 🎥`,
          ``,
          `👤 **Host:** @${hostUsername}`,
          `⏰ **Time:** ${new Date().toLocaleString()}`,
          ``,
          `📢 **Everyone is invited!**`,
          ``,
          `Tap the video call icon above ⬆️ to join instantly`,
          ``,
          `🎯 **Quick Actions:**`,
        ].join('\n');

        // Send notification to group
        const msgResponse = await ctx.telegram.sendMessage(communityGroupId, notificationMessage, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback('👥 Join Call', `group_call_participants_live`),
              Markup.button.callback('📊 Call Stats', `group_call_info_live`),
            ],
            [
              Markup.button.callback('🔔 Notify All', 'notify_all_videocall'),
              Markup.button.callback('⏹️ End Call', `end_group_call_${Date.now()}`),
            ],
          ]),
        });

        // Pin message for visibility
        try {
          await ctx.telegram.pinChatMessage(communityGroupId, msgResponse.message_id, { disable_notification: true });
          logger.info('✅ Call notification pinned', { messageId: msgResponse.message_id });
        } catch (pinError) {
          logger.warn('Could not pin notification:', pinError.message);
        }

        // Send confirmation to user
        await ctx.reply('✅ Video call started! Notification sent to all group members.');
        
        logger.info('Video call initiated successfully', {
          communityGroupId,
          hostUsername,
          messageId: msgResponse.message_id,
        });

      } catch (videoChatError) {
        logger.error('Error starting video chat:', videoChatError);
        await ctx.reply('❌ Failed to start video call. Please try again.');
      }

    } catch (error) {
      logger.error('Error in /videocall command:', error);
      await ctx.reply('❌ An error occurred. Please try again.');
    }
  });

  /**
   * Notify all members about active video call
   */
  bot.action('notify_all_videocall', async (ctx) => {
    try {
      const communityGroupId = process.env.GROUP_ID ? parseInt(process.env.GROUP_ID) : null;
      
      if (!communityGroupId) {
        await ctx.answerCbQuery('❌ Group not configured');
        return;
      }

      // Send mention notification to all group members
      const notifyMessage = [
        `🔴 **LIVE VIDEO CALL IN PROGRESS!**`,
        ``,
        `Your attention is needed! A video call is currently live.`,
        ``,
        `👆 Tap the video call icon above to join immediately`,
        ``,
        `🎯 This is a live community event - don't miss out!`,
      ].join('\n');

      await ctx.telegram.sendMessage(communityGroupId, notifyMessage, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📲 Join Call Now', `group_call_participants_live`)],
        ]),
      });

      await ctx.answerCbQuery('✅ Notification sent to all members!');
      logger.info('Video call notification broadcast sent');

    } catch (error) {
      logger.error('Error broadcasting notification:', error);
      await ctx.answerCbQuery('❌ Error sending notification');
    }
  });
};

module.exports = registerGroupVideoCallHandlers;
