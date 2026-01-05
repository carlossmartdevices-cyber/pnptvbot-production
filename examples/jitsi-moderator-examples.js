/**
 * Jitsi Moderator Bot - Usage Examples
 *
 * This file demonstrates various ways to use the Jitsi Moderator Bot
 * in your application. Copy examples and adapt to your needs.
 */

const JitsiModeratorBot = require('../src/bot/services/jitsiModeratorBot');

// ==============================================================================
// EXAMPLE 1: Basic Setup and Room Management
// ==============================================================================

async function example1_basicSetup() {
    console.log('\n=== Example 1: Basic Setup ===\n');

    // Create a bot instance
    const bot = new JitsiModeratorBot({
        jitsiDomain: 'meet.jit.si',
        mucDomain: 'conference.jit.si',
        botNickname: 'MyModerator',
        autoModeration: true,
        muteThreshold: 3,
        kickThreshold: 5
    });

    // Join a room
    const result = await bot.joinRoom('my-meeting-room');
    console.log('✓ Joined room:', result.room);

    // Get room statistics
    const stats = bot.getRoomStats('my-meeting-room');
    console.log('Room stats:', {
        participants: stats.participantCount,
        locked: stats.isLocked,
        autoModerationEnabled: stats.autoModerationEnabled
    });

    // Simulate participants joining
    bot.addParticipant('my-meeting-room', { id: 'user1', name: 'Alice' });
    bot.addParticipant('my-meeting-room', { id: 'user2', name: 'Bob' });

    // Get participants
    const participants = bot.getParticipants('my-meeting-room');
    console.log('Participants:', participants.map(p => p.name));

    // Leave the room
    await bot.leaveRoom('my-meeting-room');
    console.log('✓ Left room');
}

// ==============================================================================
// EXAMPLE 2: Moderation Actions
// ==============================================================================

async function example2_moderationActions() {
    console.log('\n=== Example 2: Moderation Actions ===\n');

    const bot = new JitsiModeratorBot();

    // Join room
    await bot.joinRoom('team-standup');
    console.log('✓ Joined: team-standup');

    // Add some participants
    bot.addParticipant('team-standup', { id: 'dev1', name: 'Developer 1' });
    bot.addParticipant('team-standup', { id: 'dev2', name: 'Developer 2' });
    bot.addParticipant('team-standup', { id: 'dev3', name: 'Developer 3' });

    // Mute a specific user
    await bot.muteParticipant('team-standup', 'dev1', 'audio');
    console.log('✓ Muted: Developer 1');

    // Mute all users
    await bot.muteParticipant('team-standup', null, 'audio');
    console.log('✓ Muted: All participants');

    // Send announcement
    await bot.sendMessage('team-standup', 'Please mute when not speaking');
    console.log('✓ Sent message to room');

    // Lock the room (no more joins)
    await bot.lockRoom('team-standup', true);
    console.log('✓ Room locked');

    // Remove disruptive participant
    await bot.kickParticipant('team-standup', 'dev3', 'Not following guidelines');
    console.log('✓ Kicked: Developer 3');

    await bot.leaveRoom('team-standup');
}

// ==============================================================================
// EXAMPLE 3: Auto-Moderation and Violations
// ==============================================================================

async function example3_autoModeration() {
    console.log('\n=== Example 3: Auto-Moderation ===\n');

    const bot = new JitsiModeratorBot({
        autoModeration: true,
        muteThreshold: 3,      // Mute after 3 violations
        kickThreshold: 5       // Kick after 5 violations
    });

    await bot.joinRoom('moderated-room');
    bot.addParticipant('moderated-room', { id: 'troublemaker', name: 'Troublemaker' });

    // Simulate multiple violations
    console.log('Recording violations...');
    for (let i = 1; i <= 5; i++) {
        const result = await bot.recordViolation('moderated-room', 'troublemaker', 'spam');
        console.log(`Violation ${i}:`, {
            participant: result.participantId,
            count: result.violationCount,
            action: result.violationCount === 3 ? 'AUTO-MUTED' :
                    result.violationCount === 5 ? 'AUTO-KICKED' : 'tracked'
        });
    }

    await bot.leaveRoom('moderated-room');
}

// ==============================================================================
// EXAMPLE 4: Event Listening
// ==============================================================================

async function example4_eventListening() {
    console.log('\n=== Example 4: Event Listening ===\n');

    const bot = new JitsiModeratorBot();

    // Listen for participants joining
    bot.on('participant:joined', (data) => {
        console.log(`🎯 Participant joined: ${data.name} in ${data.room}`);
    });

    // Listen for participants leaving
    bot.on('participant:left', (data) => {
        console.log(`👋 Participant left: ${data.name} from ${data.room}`);
    });

    // Listen for mute actions
    bot.on('action:mute', (data) => {
        console.log(`🔇 Muted ${data.target} in ${data.room}`);
    });

    // Listen for kick actions
    bot.on('action:kick', (data) => {
        console.log(`🚫 Kicked ${data.participant} from ${data.room}: ${data.reason}`);
    });

    // Listen for violations
    bot.on('violation:recorded', (data) => {
        console.log(`⚠️  Violation in ${data.room}: ${data.participant} (${data.count} total)`);
    });

    // Listen for room events
    bot.on('room:joined', (data) => {
        console.log(`✓ Bot joined room: ${data.room}`);
    });

    bot.on('room:left', (data) => {
        console.log(`✓ Bot left room: ${data.room}`);
    });

    // Test events
    await bot.joinRoom('event-test-room');
    bot.addParticipant('event-test-room', { id: 'user1', name: 'Event Tester' });
    await bot.muteParticipant('event-test-room', 'user1');
    bot.removeParticipant('event-test-room', 'user1');
    await bot.leaveRoom('event-test-room');
}

// ==============================================================================
// EXAMPLE 5: Monitor Multiple Rooms
// ==============================================================================

async function example5_multipleRooms() {
    console.log('\n=== Example 5: Multiple Rooms ===\n');

    const bot = new JitsiModeratorBot();

    // Room names to monitor
    const rooms = ['office-main', 'development-team', 'marketing-huddle'];

    // Join all rooms
    for (const room of rooms) {
        await bot.joinRoom(room);
        console.log(`✓ Joined: ${room}`);
    }

    // Add participants to simulate activity
    bot.addParticipant('office-main', { id: 'u1', name: 'Manager' });
    bot.addParticipant('development-team', { id: 'u2', name: 'Dev Lead' });
    bot.addParticipant('marketing-huddle', { id: 'u3', name: 'Marketing Head' });

    // Get status of all rooms
    const allRooms = bot.getActiveRooms();
    console.log('\nActive rooms:');
    allRooms.forEach(room => {
        console.log(`  ${room.name}: ${room.stats.participantCount} participants`);
    });

    // Get overall bot status
    const status = bot.getStatus();
    console.log('\nBot status:', {
        connected: status.isConnected,
        activeRooms: status.activeRooms,
        rooms: status.rooms
    });

    // Leave all rooms
    for (const room of rooms) {
        await bot.leaveRoom(room);
    }
    console.log('\n✓ Left all rooms');
}

// ==============================================================================
// EXAMPLE 6: Custom Admin Notifications
// ==============================================================================

async function example6_adminNotifications() {
    console.log('\n=== Example 6: Admin Notifications ===\n');

    const bot = new JitsiModeratorBot({
        autoModeration: true
    });

    // In real use, this would send to actual admin
    const adminEmail = 'admin@example.com';

    // Listen for critical events
    bot.on('violation:recorded', (data) => {
        if (data.count >= 3) {
            console.log(`📧 NOTIFICATION: User ${data.participant} in ${data.room} has ${data.count} violations`);
            // In real app: sendEmailToAdmin(adminEmail, notification);
        }
    });

    bot.on('action:kick', (data) => {
        console.log(`📧 NOTIFICATION: User ${data.participant} was kicked from ${data.room}`);
        console.log(`   Reason: ${data.reason}`);
    });

    // Simulate scenario
    await bot.joinRoom('admin-test');
    bot.addParticipant('admin-test', { id: 'spam_user', name: 'Spammer' });

    // Record violations
    for (let i = 0; i < 4; i++) {
        await bot.recordViolation('admin-test', 'spam_user', 'spam');
    }

    await bot.leaveRoom('admin-test');
}

// ==============================================================================
// EXAMPLE 7: Scheduled Moderation Actions
// ==============================================================================

async function example7_scheduledActions() {
    console.log('\n=== Example 7: Scheduled Actions ===\n');

    const bot = new JitsiModeratorBot();

    async function scheduleRoomCleanup() {
        // Daily room maintenance
        setInterval(async () => {
            const activeRooms = bot.getActiveRooms();

            for (const room of activeRooms) {
                // Get room stats
                const stats = bot.getRoomStats(room.name);

                console.log(`📊 Daily check: ${room.name}`);
                console.log(`   Participants: ${stats.participantCount}`);
                console.log(`   Duration: ${stats.duration / 1000 / 60}m`);

                // Auto-lock room if no one is there
                if (stats.participantCount === 0) {
                    await bot.lockRoom(room.name, true);
                    console.log(`   ✓ Locked empty room`);
                }
            }
        }, 60 * 60 * 1000); // Every hour
    }

    // Schedule announcement
    async function scheduleAnnouncements() {
        setInterval(async () => {
            const activeRooms = bot.getActiveRooms();

            for (const room of activeRooms) {
                await bot.sendMessage(
                    room.name,
                    'Reminder: Please follow community guidelines'
                );
            }
        }, 30 * 60 * 1000); // Every 30 minutes
    }

    console.log('✓ Scheduled cleanup and announcements');
    // scheduleRoomCleanup();  // Uncomment to use
    // scheduleAnnouncements(); // Uncomment to use
}

// ==============================================================================
// EXAMPLE 8: Integration with Express/API
// ==============================================================================

async function example8_apiIntegration() {
    console.log('\n=== Example 8: API Integration ===\n');

    const bot = new JitsiModeratorBot();

    // Simulating Express route handlers
    const moderatorAPI = {
        // POST /api/rooms/:roomId/join
        joinRoom: async (roomId) => {
            try {
                const result = await bot.joinRoom(roomId);
                return { success: true, message: `Joined ${roomId}` };
            } catch (error) {
                return { success: false, error: error.message };
            }
        },

        // POST /api/rooms/:roomId/mute
        muteAll: async (roomId) => {
            try {
                await bot.muteParticipant(roomId, null, 'audio');
                return { success: true, message: 'All participants muted' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        },

        // POST /api/rooms/:roomId/kick/:participantId
        kickParticipant: async (roomId, participantId, reason) => {
            try {
                await bot.kickParticipant(roomId, participantId, reason);
                return { success: true, message: `Kicked ${participantId}` };
            } catch (error) {
                return { success: false, error: error.message };
            }
        },

        // GET /api/rooms/:roomId/stats
        getRoomStats: (roomId) => {
            try {
                return { success: true, stats: bot.getRoomStats(roomId) };
            } catch (error) {
                return { success: false, error: error.message };
            }
        },

        // GET /api/rooms
        listRooms: () => {
            return { success: true, rooms: bot.getActiveRooms() };
        }
    };

    // Test API
    console.log('API Methods:');
    console.log('  - joinRoom(roomId)');
    console.log('  - muteAll(roomId)');
    console.log('  - kickParticipant(roomId, participantId, reason)');
    console.log('  - getRoomStats(roomId)');
    console.log('  - listRooms()');
}

// ==============================================================================
// EXAMPLE 9: Error Handling
// ==============================================================================

async function example9_errorHandling() {
    console.log('\n=== Example 9: Error Handling ===\n');

    const bot = new JitsiModeratorBot();

    // Listen for errors
    bot.on('error', (error) => {
        console.error('❌ Bot Error:', error.message);
        // In real app: log to monitoring service
    });

    try {
        // This will work
        await bot.joinRoom('valid-room');
        console.log('✓ Successfully joined room');

        // This will fail (not in room)
        await bot.muteParticipant('non-existent-room', 'user1');
    } catch (error) {
        console.error('Caught error:', error.message);
    }

    try {
        // Clean up
        await bot.leaveRoom('valid-room');
    } catch (error) {
        console.error('Leave error:', error.message);
    }
}

// ==============================================================================
// EXAMPLE 10: Complete Workflow
// ==============================================================================

async function example10_completeWorkflow() {
    console.log('\n=== Example 10: Complete Workflow ===\n');

    const bot = new JitsiModeratorBot({
        autoModeration: true,
        muteThreshold: 3,
        kickThreshold: 5
    });

    // Setup listeners
    bot.on('violation:recorded', (data) => {
        if (data.count === 3) {
            console.log(`⚠️  Auto-muting ${data.participant}`);
        }
        if (data.count === 5) {
            console.log(`🚫 Auto-kicking ${data.participant}`);
        }
    });

    // Step 1: Join room
    console.log('Step 1: Joining room...');
    await bot.joinRoom('webinar-2024');

    // Step 2: Add participants
    console.log('Step 2: Welcoming participants...');
    const participants = [
        { id: 'p1', name: 'Speaker' },
        { id: 'p2', name: 'Attendee 1' },
        { id: 'p3', name: 'Attendee 2' },
        { id: 'p4', name: 'Disruptive User' }
    ];

    for (const p of participants) {
        bot.addParticipant('webinar-2024', p);
    }
    console.log(`✓ ${participants.length} participants joined`);

    // Step 3: Send welcome message
    console.log('Step 3: Sending welcome message...');
    await bot.sendMessage('webinar-2024', 'Welcome to the webinar! Please mute when not speaking.');

    // Step 4: Monitor for violations
    console.log('Step 4: Monitoring violations...');
    for (let i = 0; i < 6; i++) {
        await bot.recordViolation('webinar-2024', 'p4', 'spam');
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
    }

    // Step 5: Get final stats
    console.log('Step 5: Final statistics...');
    const stats = bot.getRoomStats('webinar-2024');
    console.log(`Room: ${stats.room}`);
    console.log(`Participants: ${stats.participantCount}`);
    console.log(`Duration: ${stats.duration / 1000}s`);

    // Step 6: Cleanup
    console.log('Step 6: Cleanup...');
    await bot.leaveRoom('webinar-2024');
    console.log('✓ Webinar moderation complete');
}

// ==============================================================================
// Run Examples
// ==============================================================================

async function runAll() {
    try {
        // Uncomment examples you want to run:

        await example1_basicSetup();
        // await example2_moderationActions();
        // await example3_autoModeration();
        // await example4_eventListening();
        // await example5_multipleRooms();
        // await example6_adminNotifications();
        // await example7_scheduledActions();
        // await example8_apiIntegration();
        // await example9_errorHandling();
        // await example10_completeWorkflow();

        console.log('\n✅ Examples completed!\n');
    } catch (error) {
        console.error('Error running examples:', error);
    }
}

// Export for testing
module.exports = {
    example1_basicSetup,
    example2_moderationActions,
    example3_autoModeration,
    example4_eventListening,
    example5_multipleRooms,
    example6_adminNotifications,
    example7_scheduledActions,
    example8_apiIntegration,
    example9_errorHandling,
    example10_completeWorkflow,
    runAll
};

// Run if executed directly
if (require.main === module) {
    runAll().catch(console.error);
}
