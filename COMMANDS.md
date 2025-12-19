# PNPtv Bot - Complete Command List

This document contains all available commands for the PNPtv Telegram Bot, organized by category.

## User Commands

These commands are available to all users:

| Command | Description | Location |
|---------|-------------|----------|
| `/start` | Begin onboarding or show main menu | src/bot/handlers/user/onboarding.js:15 |
| `/menu` | Show main menu | src/bot/handlers/user/menu.js:79 |
| `/cristina` | Start AI support chat with Cristina | src/bot/handlers/user/menu.js:57 |
| `/subscribe` | Show subscription plans | src/bot/handlers/payments/index.js:20 |
| `/activate` | Activate subscription with activation code | src/bot/handlers/payments/activation.js:16 |
| `/packages` | Show available call packages | src/bot/handlers/user/callPackages.js:12 |
| `/payments` | View payment history | src/bot/handlers/user/paymentHistory.js:11 |
| `/mycalls` | View call history | src/bot/handlers/user/callManagement.js:61 |
| `/language` | Change language preference | src/bot/handlers/user/settings.js:131 |
| `/support` | Open support ticket | src/bot/handlers/media/support.js:803 |
| `/jitsi` | Quick access to Jitsi video calls | src/bot/handlers/media/jitsi.js:584 |
| `/livestream` | Quick access to livestream | src/bot/handlers/media/livestream.js:444 |

## Group Commands

These commands work in group chats:

| Command | Description | Location |
|---------|-------------|----------|
| `/rules` | Show group rules | src/bot/handlers/moderation/index.js:12 |
| `/warnings` | Show your warnings in the group | src/bot/handlers/moderation/index.js:15 |
| `/leaderboard` | Show group leaderboard | src/bot/handlers/group/leaderboard.js:115 |
| `/ranking` | Show group leaderboard (alias) | src/bot/handlers/group/leaderboard.js:116 |
| `/top` | Show group leaderboard (alias) | src/bot/handlers/group/leaderboard.js:117 |
| `/startcall` | Start call (only works in topic 3809) | src/bot/handlers/media/topicMenu.js:17 |

## Admin Commands

These commands require admin permissions:

| Command | Description | Location |
|---------|-------------|----------|
| `/admin` | Open admin panel | src/bot/handlers/admin/index.js:103 |
| `/viewas` | Preview mode - view as free/prime/normal user | src/bot/handlers/admin/index.js:120 |
| `/stats` | Show real-time statistics | src/bot/handlers/admin/index.js:179 |
| `/analytics` | Show analytics dashboard | src/bot/handlers/admin/paymentAnalytics.js:20 |
| `/available` | Set availability status (shortcut) | src/bot/handlers/admin/callManagement.js:225 |
| `/broadcast` | Quick broadcast to users (shortcut) | src/bot/handlers/admin/callManagement.js:260 |
| `/checkcode` | Check activation code status | src/bot/handlers/payments/activation.js:203 |

## Moderation Commands (Admin)

These commands are for moderators and admins in groups:

| Command | Description | Location |
|---------|-------------|----------|
| `/moderation` | Toggle moderation on/off for group | src/bot/handlers/moderation/adminCommands.js:12 |
| `/ban` | Ban a user from the group | src/bot/handlers/moderation/adminCommands.js:15 |
| `/unban` | Unban a user from the group | src/bot/handlers/moderation/adminCommands.js:18 |
| `/warn` | Warn a user | src/bot/handlers/moderation/moderationCommands.js:481 |
| `/clearwarnings` | Clear user warnings | src/bot/handlers/moderation/adminCommands.js:21 |
| `/kick` | Kick a user from the group | src/bot/handlers/moderation/moderationCommands.js:487 |
| `/mute` | Mute a user | src/bot/handlers/moderation/moderationCommands.js:484 |
| `/unmute` | Unmute a user | src/bot/handlers/moderation/moderationCommands.js:485 |
| `/modlogs` | View moderation logs | src/bot/handlers/moderation/adminCommands.js:24 |
| `/modstats` | View moderation statistics | src/bot/handlers/moderation/adminCommands.js:27 |
| `/setlinks` | Configure link policy for group | src/bot/handlers/moderation/adminCommands.js:30 |
| `/userhistory` | View username history | src/bot/handlers/moderation/adminCommands.js:33 |
| `/usernamechanges` | View recent username changes in group | src/bot/handlers/moderation/adminCommands.js:36 |

## Access Control Commands (Admin)

These commands manage roles and permissions:

| Command | Description | Location |
|---------|-------------|----------|
| `/grantrole` | Grant role to a user | src/bot/handlers/moderation/accessControlCommands.js:306 |
| `/revokerole` | Revoke role from a user | src/bot/handlers/moderation/accessControlCommands.js:307 |
| `/checkrole` | Check user's role | src/bot/handlers/moderation/accessControlCommands.js:308 |
| `/rolestats` | View role statistics | src/bot/handlers/moderation/accessControlCommands.js:309 |
| `/approvalqueue` | View content approval queue | src/bot/handlers/moderation/accessControlCommands.js:310 |
| `/approvalstats` | View approval statistics | src/bot/handlers/moderation/accessControlCommands.js:311 |

## Support Group Commands (Admin)

These commands work only in the support group:

| Command | Description | Location |
|---------|-------------|----------|
| `/cerrar` | Close support ticket | src/bot/handlers/media/support.js:1118 |
| `/reabrir` | Reopen support ticket | src/bot/handlers/media/support.js:1176 |

## Username Detection Commands (Admin)

These commands help manage username changes:

| Command | Description | Location |
|---------|-------------|----------|
| `/checkuserstatus` | Check user name change status | src/bot/handlers/admin/usernameChangeDetectionAdmin.js:11 |
| `/unblockuser` | Unblock user | src/bot/handlers/admin/usernameChangeDetectionAdmin.js:77 |

## Command Usage Examples

### User Commands
```
/start - Start the bot and see onboarding
/menu - Open the main menu
/subscribe - View subscription plans and upgrade
/cristina - Chat with the AI assistant
/payments - View your payment history
```

### Admin Commands
```
/admin - Open the admin panel
/stats - View real-time bot statistics
/viewas free - Preview bot as a free user
/viewas prime - Preview bot as a premium user
/viewas normal - Return to normal admin view
```

### Moderation Commands
```
/warn @username - Warn a user
/ban @username - Ban a user
/clearwarnings @username - Clear user's warnings
/modstats - View moderation statistics
```

## Notes

- Most commands support both English and Spanish languages
- Admin commands require proper permissions set in the permission system
- Some commands are context-specific (e.g., only work in groups or specific topics)
- Commands in groups are automatically deleted after 3 minutes to keep chats clean
- The bot uses middleware to handle command redirection and auto-deletion

## Command Registration

Commands are registered in the following handler files:
- User handlers: `src/bot/handlers/user/`
- Admin handlers: `src/bot/handlers/admin/`
- Moderation handlers: `src/bot/handlers/moderation/`
- Media handlers: `src/bot/handlers/media/`
- Payment handlers: `src/bot/handlers/payments/`
- Group handlers: `src/bot/handlers/group/`
