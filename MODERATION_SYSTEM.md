# PNPtv Moderation System

A comprehensive, easy-to-use moderation system for the PNPtv Telegram bot.

## Features

### ✅ Community Rules
- `/rules` - Display community rules in English and Spanish
- Customizable rules in `src/config/moderationConfig.js`

### ✅ Warning System (3-Strike)
- Automatic escalation: Warning → Mute → Ban
- Track warnings per user
- Auto-expire warnings after 30 days
- Commands:
  - `/warn <user> [reason]` - Issue a warning
  - `/warnings <user>` - View user's warnings
  - `/clearwarnings <user>` - Clear all warnings for a user

### ✅ Moderation Commands
- `/mute <user> [duration] [reason]` - Mute a user (default: 24h)
  - Duration examples: `30m`, `2h`, `1d`
- `/unmute <user>` - Unmute a user
- `/kick <user> [reason]` - Kick a user from the group
- `/ban <user> [reason]` - Ban a user permanently
- `/unban <userId>` - Unban a user

### ✅ Auto-Moderation Filters

#### Spam Detection
- Detects duplicate messages
- Configurable threshold (default: 3 duplicates in 1 minute)
- Auto-warns violators

#### Flood Protection
- Prevents message flooding
- Configurable threshold (default: 10 messages in 30 seconds)
- Auto-mutes for 5 minutes

#### Link Filtering
- Blocks unauthorized external links
- Whitelist for approved domains
- Exempts admins and PRIME members

#### Profanity Filter
- Enabled to block illegal activity terms
- Allows adult language but bans words related to illegal activities (zoophilia, pedophilia, etc.)
- Custom blacklist for zero-tolerance terms
- Auto-warns violators and deletes messages

### ✅ Username Enforcement
- Validates usernames against moderation rules:
  - Minimum/maximum length
  - Blacklisted words
  - Emoji restrictions
- Auto-kicks users with invalid usernames
- Allows them to rejoin after fixing

## Setup

### 1. Initialize Database Tables

```bash
node scripts/initModerationTables.js
```

This creates the following tables:
- `warnings` - Stores user warnings
- `moderation_actions` - Stores moderation actions

### 2. Configure Settings

Edit `src/config/moderationConfig.js` to customize:

```javascript
// Community Rules
RULES: {
  en: [...],  // English rules
  es: [...],  // Spanish rules
}

// Warning System
WARNING_SYSTEM: {
  MAX_WARNINGS: 3,
  WARNING_EXPIRY_DAYS: 30,
  ACTIONS: {
    1: { type: 'warning', message: '...' },
    2: { type: 'mute', duration: 24h, message: '...' },
    3: { type: 'ban', message: '...' },
  }
}

// Auto-Moderation Filters
FILTERS: {
  SPAM: { enabled: true, ... },
  FLOOD: { enabled: true, ... },
  LINKS: { enabled: true, allowedDomains: [...], ... },
  PROFANITY: { enabled: true, blacklist: [illegal activity terms], ... },
  USERNAME: { enabled: true, blacklist: [...], ... },
}
```

### 3. Test the System

1. Send `/rules` to see community rules
2. Test auto-moderation by:
   - Sending duplicate messages (spam)
   - Sending many messages quickly (flood)
   - Posting unauthorized links
3. Test commands with admin account:
   - `/warn @user test warning`
   - `/warnings @user`
   - `/mute @user 5m test mute`

## Usage

### For Admins

**Issue a Warning:**
```
/warn @username Violating rule #3
```

**Check User Warnings:**
```
/warnings @username
```

**Mute a User:**
```
/mute @username 2h Spamming the chat
```

**Kick a User:**
```
/kick @username Inappropriate behavior
```

**Ban a User:**
```
/ban @username Multiple rule violations
```

### For Users

**View Rules:**
```
/rules
```

## Auto-Moderation Behavior

### Spam Detection
1. User sends 3+ duplicate messages within 1 minute
2. Message is deleted
3. User receives auto-warning
4. Warning counts toward 3-strike limit

### Flood Protection
1. User sends 10+ messages within 30 seconds
2. Messages are deleted
3. User is auto-muted for 5 minutes
4. Action is logged

### Link Filtering
1. User posts link to unauthorized domain
2. Message is deleted
3. User receives auto-warning
4. PRIME members and admins are exempt

### Username Enforcement
1. User joins with invalid username
2. User receives warning message
3. User is kicked after 5 seconds
4. Can rejoin after fixing username

## Configuration Options

### Exempt Users

Users exempt from auto-moderation:
- Group creators
- Group administrators
- PRIME members (for link filtering only)

### Auto-Delete Messages

Moderation messages auto-delete after 2 minutes by default.

Configure in `src/config/moderationConfig.js`:
```javascript
AUTO_DELETE_MOD_MESSAGES: true,
MOD_MESSAGE_DELAY: 2 * 60 * 1000, // 2 minutes
```

### Warning Expiration

Warnings automatically expire after 30 days.

Configure in `src/config/moderationConfig.js`:
```javascript
WARNING_EXPIRY_DAYS: 30
```

## Database Schema

### `warnings` Table
- `id` - Auto-incrementing primary key
- `user_id` - Telegram user ID
- `admin_id` - Admin who issued warning (or 'system')
- `reason` - Reason for warning
- `group_id` - Group ID
- `created_at` - Timestamp
- `cleared` - Boolean (false by default)
- `cleared_by` - Admin who cleared warning
- `cleared_at` - Timestamp when cleared

### `moderation_actions` Table
- `id` - Auto-incrementing primary key
- `user_id` - Telegram user ID
- `admin_id` - Admin who performed action (or 'system')
- `action` - Action type (warn, mute, kick, ban, unmute, unban)
- `reason` - Reason for action
- `duration` - Duration in milliseconds (for mutes)
- `group_id` - Group ID
- `created_at` - Timestamp

## Troubleshooting

### Commands Not Working

1. Verify bot has admin permissions in the group
2. Check that moderation handlers are registered in `src/bot/core/bot.js`
3. Ensure database tables are initialized

### Auto-Moderation Not Working

1. Check middleware is registered in `src/bot/core/bot.js`
2. Verify filters are enabled in `src/config/moderationConfig.js`
3. Check logs for errors

### Database Errors

1. Ensure PostgreSQL is running
2. Verify database credentials in `.env`
3. Re-run `node scripts/initModerationTables.js`

## Architecture

```
src/
├── config/
│   └── moderationConfig.js         # Moderation configuration
├── services/
│   └── warningService.js           # Warning system logic
├── bot/
│   ├── handlers/
│   │   └── moderation/
│   │       ├── index.js            # Register moderation handlers
│   │       └── moderationCommands.js # Command handlers
│   └── core/
│       └── middleware/
│           ├── autoModeration.js   # Auto-moderation filters
│           └── usernameEnforcement.js # Username validation
└── scripts/
    └── initModerationTables.js     # Database setup script
```

## Contributing

To add new moderation features:

1. Add configuration in `src/config/moderationConfig.js`
2. Implement logic in appropriate service/middleware
3. Add command handler if needed
4. Update this documentation

## Support

For issues or questions about the moderation system:
- Check logs: `pm2 logs pnptvbot`
- Review configuration: `src/config/moderationConfig.js`
- Test with `/rules` command
