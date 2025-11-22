const { Markup } = require('telegraf');
const { t } = require('../../../utils/i18n');
const logger = require('../../../utils/logger');
const { getLanguage, validateUserInput, setSessionState, getSessionState, clearSessionState, generateRoomCode, formatDuration, truncateText } = require('../../utils/helpers');
const UserService = require('../../services/userService');
const zoomService = require('../../../services/zoomService');
const ZoomRoomModel = require('../../../models/zoomRoomModel');
const ZoomParticipantModel = require('../../../models/zoomParticipantModel');
const ZoomEventModel = require('../../../models/zoomEventModel');

/**
 * Enhanced Zoom room handlers with full features
 * @param {Telegraf} bot - Bot instance
 */
const registerZoomHandlers = (bot) => {
    // Main Zoom menu
    bot.action('show_zoom', async (ctx) => {
        try {
            const lang = getLanguage(ctx);
            const userId = ctx.from.id.toString();

            // Check if user has active subscription
            const hasSubscription = await UserService.hasActiveSubscription(userId);

            if (!hasSubscription) {
                await ctx.editMessageText(
                    lang === 'es'
                        ? '🔒 *Zoom Meetings - Solo Premium*\n\nEsta característica está disponible solo para usuarios Prime.\n\n✨ Con Prime puedes:\n• Crear salas ilimitadas\n• Grabación en la nube\n• Hasta 100 participantes\n• Control total del host\n• Sin límite de tiempo'
                        : '🔒 *Zoom Meetings - Prime Only*\n\nThis feature is only available for Prime users.\n\n✨ With Prime you can:\n• Create unlimited rooms\n• Cloud recording\n• Up to 100 participants\n• Full host control\n• No time limit',
                    {
                        parse_mode: 'Markdown',
                        ...Markup.inlineKeyboard([
                            [Markup.button.callback(lang === 'es' ? '⭐ Obtener Prime' : '⭐ Get Prime', 'show_payments')],
                            [Markup.button.callback(lang === 'es' ? '🔙 Atrás' : '🔙 Back', 'back_to_main')]
                        ])
                    }
                );
                return;
            }

            // Get user's active rooms
            const activeRooms = await ZoomRoomModel.getByHostUserId(userId, { status: 'active' });
            const scheduledRooms = await ZoomRoomModel.getByHostUserId(userId, { status: 'scheduled', limit: 3 });

            let message = lang === 'es'
                ? '🎥 *Zoom Meetings*\n\n📊 Tus estadísticas:\n'
                : '🎥 *Zoom Meetings*\n\n📊 Your stats:\n';

            message += lang === 'es'
                ? `• Salas activas: ${activeRooms.length}\n`
                : `• Active rooms: ${activeRooms.length}\n`;
            message += lang === 'es'
                ? `• Próximas: ${scheduledRooms.length}\n\n`
                : `• Upcoming: ${scheduledRooms.length}\n\n`;

            message += lang === 'es'
                ? '¿Qué deseas hacer?'
                : 'What would you like to do?';

            await ctx.editMessageText(message, {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback(lang === 'es' ? '➕ Crear Sala' : '➕ Create Room', 'zoom_create')],
                    [Markup.button.callback(lang === 'es' ? '🔗 Unirse con Código' : '🔗 Join with Code', 'zoom_join_code')],
                    [Markup.button.callback(lang === 'es' ? '📋 Mis Salas' : '📋 My Rooms', 'zoom_my_rooms')],
                    [Markup.button.callback(lang === 'es' ? '📅 Programar' : '📅 Schedule', 'zoom_schedule')],
                    [Markup.button.callback(lang === 'es' ? '🔙 Atrás' : '🔙 Back', 'back_to_main')]
                ])
            });
        } catch (error) {
            logger.error('Error showing zoom menu:', error);
        }
    });

    // Create room immediately
    bot.action('zoom_create', async (ctx) => {
        try {
            const lang = getLanguage(ctx);
            const userId = ctx.from.id.toString();

            // Check subscription again
            const hasSubscription = await UserService.hasActiveSubscription(userId);
            if (!hasSubscription) {
                await ctx.answerCbQuery(lang === 'es' ? 'Necesitas Prime para crear salas' : 'You need Prime to create rooms');
                return;
            }

            await ctx.answerCbQuery(lang === 'es' ? 'Creando sala...' : 'Creating room...');
            await ctx.editMessageText(lang === 'es' ? '⏳ Creando tu sala de Zoom...' : '⏳ Creating your Zoom room...');

            // Get user info
            const user = await UserService.getOrCreateFromContext(ctx);

            // Create Zoom meeting via API
            const zoomMeeting = await zoomService.createMeeting({
                topic: `${user.first_name || 'PNP.tv'}'s Meeting`,
                type: 1, // Instant meeting
                duration: 60,
                settings: {
                    host_video: false,
                    participant_video: false,
                    join_before_host: false,
                    mute_upon_entry: true,
                    waiting_room: true,
                    auto_recording: 'cloud'
                }
            });

            // Create room in database
            const room = await ZoomRoomModel.create({
                hostUserId: userId,
                hostEmail: user.email || `${userId}@telegram.user`,
                hostName: user.first_name || user.username || 'Host',
                title: `${user.first_name || 'PNP.tv'}'s Meeting`,
                zoomMeetingId: zoomMeeting.meetingId,
                zoomMeetingPassword: zoomMeeting.password,
                isPublic: true,
                settings: {
                    waiting_room_enabled: true,
                    mute_upon_entry: true,
                    enable_recording: true,
                    auto_recording: 'cloud'
                }
            });

            // Generate host join URL with special controls
            const hostJoinUrl = `https://easybots.store/zoom/host/${room.room_code}`;

            // Update room with host URL
            await ZoomRoomModel.update(room.id, {
                host_join_url: hostJoinUrl
            });

            // Log event
            await ZoomEventModel.log({
                roomId: room.id,
                eventType: 'room.created',
                eventCategory: 'meeting',
                description: `Room created: ${room.room_code}`,
                actorUserId: userId,
                actorName: user.first_name,
                actorRole: 'host'
            });

            const guestJoinUrl = `https://easybots.store/zoom/join/${room.room_code}`;

            let message = lang === 'es'
                ? `✅ *Sala Creada Exitosamente*\n\n`
                : `✅ *Room Created Successfully*\n\n`;

            message += lang === 'es'
                ? `🔑 Código de sala: \`${room.room_code}\`\n\n`
                : `🔑 Room code: \`${room.room_code}\`\n\n`;

            message += lang === 'es'
                ? `*Para ti (Host):*\n`
                : `*For you (Host):*\n`;
            message += `🎛️ ${hostJoinUrl}\n\n`;

            message += lang === 'es'
                ? `*Para invitados:*\n`
                : `*For guests:*\n`;
            message += `👥 ${guestJoinUrl}\n\n`;

            message += lang === 'es'
                ? `💡 *Tip:* Comparte el código \`${room.room_code}\` o el enlace con tus invitados. Ellos podrán unirse sin necesidad de autenticarse.`
                : `💡 *Tip:* Share the code \`${room.room_code}\` or the link with your guests. They can join without authentication.`;

            await ctx.editMessageText(message, {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.url(lang === 'es' ? '🎛️ Unirme como Host' : '🎛️ Join as Host', hostJoinUrl)],
                    [Markup.button.callback(lang === 'es' ? '📤 Compartir' : '📤 Share', `zoom_share_${room.id}`)],
                    [Markup.button.callback(lang === 'es' ? '🔙 Atrás' : '🔙 Back', 'show_zoom')]
                ])
            });

        } catch (error) {
            logger.error('Error creating Zoom room:', error);
            const lang = getLanguage(ctx);
            await ctx.editMessageText(
                lang === 'es'
                    ? '❌ Error al crear la sala. Por favor intenta de nuevo.'
                    : '❌ Error creating room. Please try again.',
                Markup.inlineKeyboard([
                    [Markup.button.callback(lang === 'es' ? '🔙 Atrás' : '🔙 Back', 'show_zoom')]
                ])
            );
        }
    });

    // Join with code
    bot.action('zoom_join_code', async (ctx) => {
        try {
            const lang = getLanguage(ctx);

            setSessionState(ctx, 'zoom_joining', true, 5);
            await ctx.saveSession();

            await ctx.editMessageText(
                lang === 'es'
                    ? '🔑 *Unirse a una Sala*\n\nPor favor, envía el código de 7 caracteres (ej: ABC-1234):'
                    : '🔑 *Join a Room*\n\nPlease send the 7-character code (e.g., ABC-1234):',
                {
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback(lang === 'es' ? '❌ Cancelar' : '❌ Cancel', 'show_zoom')]
                    ])
                }
            );
        } catch (error) {
            logger.error('Error in zoom_join_code:', error);
        }
    });

    // Handle text input for room codes
    bot.on('text', async (ctx, next) => {
        const isJoining = getSessionState(ctx, 'zoom_joining');

        if (isJoining) {
            try {
                const lang = getLanguage(ctx);
                const roomCode = ctx.message.text.trim().toUpperCase();

                // Validate room code format (ABC-1234)
                if (!/^[A-Z]{3}-\d{4}$/.test(roomCode)) {
                    await ctx.reply(
                        lang === 'es'
                            ? '❌ Código inválido. El formato debe ser ABC-1234.'
                            : '❌ Invalid code. Format must be ABC-1234.'
                    );
                    return;
                }

                // Find room
                const room = await ZoomRoomModel.getByRoomCode(roomCode);

                if (!room) {
                    await ctx.reply(
                        lang === 'es'
                            ? '❌ Sala no encontrada. Verifica el código.'
                            : '❌ Room not found. Please check the code.',
                        Markup.inlineKeyboard([
                            [Markup.button.callback(lang === 'es' ? '🔙 Atrás' : '🔙 Back', 'show_zoom')]
                        ])
                    );
                    return;
                }

                if (room.status !== 'active') {
                    await ctx.reply(
                        lang === 'es'
                            ? '❌ Esta sala no está activa actualmente.'
                            : '❌ This room is not currently active.',
                        Markup.inlineKeyboard([
                            [Markup.button.callback(lang === 'es' ? '🔙 Atrás' : '🔙 Back', 'show_zoom')]
                        ])
                    );
                    return;
                }

                clearSessionState(ctx, 'zoom_joining');
                await ctx.saveSession();

                const joinUrl = `https://easybots.store/zoom/join/${roomCode}`;

                let message = lang === 'es'
                    ? `✅ *Sala Encontrada*\n\n`
                    : `✅ *Room Found*\n\n`;

                message += `📝 ${room.title}\n`;
                message += `👤 Host: ${room.host_name}\n`;

                if (room.description) {
                    message += `📄 ${truncateText(room.description, 100)}\n`;
                }

                message += `\n🔗 ${joinUrl}`;

                await ctx.reply(message, {
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        [Markup.button.url(lang === 'es' ? '🎥 Unirse Ahora' : '🎥 Join Now', joinUrl)],
                        [Markup.button.callback(lang === 'es' ? '🔙 Atrás' : '🔙 Back', 'show_zoom')]
                    ])
                });

            } catch (error) {
                logger.error('Error processing room code:', error);
                clearSessionState(ctx, 'zoom_joining');
                await ctx.saveSession();
            }
            return;
        }

        return next();
    });

    // My rooms
    bot.action('zoom_my_rooms', async (ctx) => {
        try {
            const lang = getLanguage(ctx);
            const userId = ctx.from.id.toString();

            const rooms = await ZoomRoomModel.getByHostUserId(userId, { limit: 10 });

            if (rooms.length === 0) {
                await ctx.editMessageText(
                    lang === 'es'
                        ? '📋 *Mis Salas*\n\nNo has creado ninguna sala todavía.'
                        : '📋 *My Rooms*\n\nYou haven\'t created any rooms yet.',
                    {
                        parse_mode: 'Markdown',
                        ...Markup.inlineKeyboard([
                            [Markup.button.callback(lang === 'es' ? '➕ Crear Sala' : '➕ Create Room', 'zoom_create')],
                            [Markup.button.callback(lang === 'es' ? '🔙 Atrás' : '🔙 Back', 'show_zoom')]
                        ])
                    }
                );
                return;
            }

            let message = lang === 'es'
                ? '📋 *Mis Salas*\n\n'
                : '📋 *My Rooms*\n\n';

            const buttons = [];

            for (const room of rooms) {
                const statusEmoji = room.status === 'active' ? '🟢' :
                                   room.status === 'scheduled' ? '🔵' :
                                   room.status === 'ended' ? '⚫' : '⭕';

                const statusText = lang === 'es'
                    ? (room.status === 'active' ? 'Activa' :
                       room.status === 'scheduled' ? 'Programada' :
                       room.status === 'ended' ? 'Finalizada' : 'Cancelada')
                    : (room.status === 'active' ? 'Active' :
                       room.status === 'scheduled' ? 'Scheduled' :
                       room.status === 'ended' ? 'Ended' : 'Cancelled');

                message += `${statusEmoji} *${truncateText(room.title, 30)}*\n`;
                message += `   🔑 \`${room.room_code}\` • ${statusText}\n`;

                if (room.status === 'active') {
                    buttons.push([Markup.button.callback(
                        `▶️ ${truncateText(room.title, 20)}`,
                        `zoom_room_details_${room.id}`
                    )]);
                }
            }

            message += `\n${lang === 'es' ? 'Mostrando' : 'Showing'} ${rooms.length} ${lang === 'es' ? 'sala(s)' : 'room(s)'}`;

            buttons.push([Markup.button.callback(lang === 'es' ? '🔙 Atrás' : '🔙 Back', 'show_zoom')]);

            await ctx.editMessageText(message, {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard(buttons)
            });

        } catch (error) {
            logger.error('Error showing my rooms:', error);
        }
    });

    // Room details
    bot.action(/^zoom_room_details_(.+)$/, async (ctx) => {
        try {
            const roomId = ctx.match[1];
            const lang = getLanguage(ctx);
            const userId = ctx.from.id.toString();

            const room = await ZoomRoomModel.getById(roomId);

            if (!room) {
                await ctx.answerCbQuery(lang === 'es' ? 'Sala no encontrada' : 'Room not found');
                return;
            }

            // Get statistics
            const stats = await ZoomRoomModel.getStatistics(roomId);
            const activeParticipants = await ZoomParticipantModel.getActiveCount(roomId);

            let message = `🎥 *${room.title}*\n\n`;
            message += `🔑 ${lang === 'es' ? 'Código:' : 'Code:'} \`${room.room_code}\`\n`;
            message += `📊 ${lang === 'es' ? 'Estado:' : 'Status:'} ${room.status === 'active' ? '🟢 ' + (lang === 'es' ? 'Activa' : 'Active') : '⚫ ' + (lang === 'es' ? 'Finalizada' : 'Ended')}\n\n`;

            message += `👥 *${lang === 'es' ? 'Participantes:' : 'Participants:'}*\n`;
            message += `   • ${lang === 'es' ? 'Ahora:' : 'Now:'} ${activeParticipants}\n`;
            message += `   • ${lang === 'es' ? 'Total:' : 'Total:'} ${stats?.total_participants || 0}\n`;
            message += `   • ${lang === 'es' ? 'Máximo:' : 'Peak:'} ${room.peak_participants}\n\n`;

            if (room.total_duration) {
                message += `⏱️ ${lang === 'es' ? 'Duración:' : 'Duration:'} ${formatDuration(room.total_duration, lang)}\n`;
            }

            const buttons = [];

            if (room.status === 'active' && room.host_user_id === userId) {
                buttons.push([Markup.button.url(
                    lang === 'es' ? '🎛️ Panel de Control' : '🎛️ Control Panel',
                    room.host_join_url || `https://easybots.store/zoom/host/${room.room_code}`
                )]);

                buttons.push([
                    Markup.button.callback(lang === 'es' ? '🛑 Finalizar Sala' : '🛑 End Room', `zoom_end_${roomId}`)
                ]);
            }

            if (room.recording_url) {
                buttons.push([Markup.button.url(
                    lang === 'es' ? '📹 Ver Grabación' : '📹 View Recording',
                    room.recording_url
                )]);
            }

            buttons.push([Markup.button.callback(lang === 'es' ? '🔙 Atrás' : '🔙 Back', 'zoom_my_rooms')]);

            await ctx.editMessageText(message, {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard(buttons)
            });

        } catch (error) {
            logger.error('Error showing room details:', error);
        }
    });

    // End room
    bot.action(/^zoom_end_(.+)$/, async (ctx) => {
        try {
            const roomId = ctx.match[1];
            const lang = getLanguage(ctx);
            const userId = ctx.from.id.toString();

            const room = await ZoomRoomModel.getById(roomId);

            if (!room || room.host_user_id !== userId) {
                await ctx.answerCbQuery(lang === 'es' ? 'No autorizado' : 'Unauthorized');
                return;
            }

            await ctx.answerCbQuery(lang === 'es' ? 'Finalizando sala...' : 'Ending room...');

            // End meeting via Zoom API
            if (room.zoom_meeting_id) {
                await zoomService.endMeeting(room.zoom_meeting_id);
            }

            // Update room in database
            await ZoomRoomModel.endRoom(roomId);

            // Log event
            await ZoomEventModel.log({
                roomId: roomId,
                eventType: 'room.ended',
                eventCategory: 'meeting',
                description: 'Room ended by host',
                actorUserId: userId,
                actorRole: 'host'
            });

            await ctx.editMessageText(
                lang === 'es'
                    ? '✅ La sala ha sido finalizada.'
                    : '✅ The room has been ended.',
                Markup.inlineKeyboard([
                    [Markup.button.callback(lang === 'es' ? '🔙 Mis Salas' : '🔙 My Rooms', 'zoom_my_rooms')]
                ])
            );

        } catch (error) {
            logger.error('Error ending room:', error);
        }
    });

    // Share room
    bot.action(/^zoom_share_(.+)$/, async (ctx) => {
        try {
            const roomId = ctx.match[1];
            const lang = getLanguage(ctx);

            const room = await ZoomRoomModel.getById(roomId);

            if (!room) {
                await ctx.answerCbQuery(lang === 'es' ? 'Sala no encontrada' : 'Room not found');
                return;
            }

            const shareUrl = `https://easybots.store/zoom/join/${room.room_code}`;

            let shareMessage = lang === 'es'
                ? `🎥 *Únete a mi sala de Zoom*\n\n📝 ${room.title}\n🔑 Código: ${room.room_code}\n\n🔗 ${shareUrl}\n\n¡Te espero!`
                : `🎥 *Join my Zoom room*\n\n📝 ${room.title}\n🔑 Code: ${room.room_code}\n\n🔗 ${shareUrl}\n\nSee you there!`;

            await ctx.answerCbQuery(lang === 'es' ? 'Compartiendo...' : 'Sharing...');
            await ctx.reply(shareMessage, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: lang === 'es' ? '📤 Compartir en Telegram' : '📤 Share on Telegram', switch_inline_query: shareMessage }]
                    ]
                }
            });

        } catch (error) {
            logger.error('Error sharing room:', error);
        }
    });

    // Schedule room
    bot.action('zoom_schedule', async (ctx) => {
        try {
            const lang = getLanguage(ctx);

            await ctx.editMessageText(
                lang === 'es'
                    ? '📅 *Programar Sala*\n\nEsta función estará disponible próximamente.\n\nPor ahora, puedes crear salas instantáneas.'
                    : '📅 *Schedule Room*\n\nThis feature will be available soon.\n\nFor now, you can create instant rooms.',
                {
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback(lang === 'es' ? '➕ Crear Sala Ahora' : '➕ Create Room Now', 'zoom_create')],
                        [Markup.button.callback(lang === 'es' ? '🔙 Atrás' : '🔙 Back', 'show_zoom')]
                    ])
                }
            );
        } catch (error) {
            logger.error('Error in zoom_schedule:', error);
        }
    });
};

module.exports = registerZoomHandlers;
