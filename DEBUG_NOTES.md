# Admin Command Debugging - January 6, 2026

## Problem
Users reported that `/admin` command was not working, returning "Unknown slash command" error.

## Root Causes Identified and Fixed

### 1. Duplicate Handler Registrations (FIXED)
- **Issue**: Functions like `registerGamificationHandlers`, `registerRadioManagementHandlers`, and `registerLiveStreamManagementHandlers` were being registered **twice**:
  - Once inside `registerAdminHandlers()` in `src/bot/handlers/admin/index.js` (lines 111-115)
  - Again directly in `src/bot/core/bot.js` (lines 173-175)
- **Impact**: Could cause handler conflicts and broken command processing
- **Fix**: Removed duplicate registrations from bot.js, now handled solely by `registerAdminHandlers()`

### 2. Module Export Issue (FIXED)
- **Issue**: The admin/index.js file exports `finalRegisterAdminHandlers` function, which wraps the original `registerAdminHandlers` to include additional handlers
- **Status**: Now properly exported and imported
- **Verification**: Bot logs show `[DEBUG-INIT] registerAdminHandlers called - registering admin command handlers`

### 3. Enhanced Debug Logging (ADDED)
Added comprehensive logging at multiple levels to help diagnose command processing:

#### Level 1: Express Webhook Handler (`src/bot/core/bot.js` lines 326-332)
- Logs all incoming webhook messages
- Logs if message has `bot_command` entity
- Format: `>>> COMMAND MESSAGE detected: text="/admin", hasBotCommand=true`

#### Level 2: Telegraf Middleware (`src/bot/core/bot.js` lines 141-146)
- First middleware called immediately after bot instance creation
- Logs all commands before any other middleware
- Format: `[TELEGRAF] Command received: text="/admin", from=8365312597, chat=8365312597`

#### Level 3: Admin Handler (`src/bot/handlers/admin/index.js` line 119)
- Logs when the admin command handler actually executes
- Format: `[DEBUG] /admin command triggered for user 8365312597`

## Testing Admin Commands

To verify the `/admin` command is working:

1. **Send `/admin` command** to the bot from a private chat
2. **Check logs** for three log entries:
   ```
   >>> COMMAND MESSAGE detected: text="/admin", hasBotCommand=true
   [TELEGRAF] Command received: text="/admin", ...
   [DEBUG] /admin command triggered for user ...
   ```
3. **Expected Outcome**: Admin panel should appear with buttons for:
   - 👥 Usuarios (Users)
   - 🎁 Activar Membresía (Activate Membership)
   - 📻 Radio & 📺 Live
   - 📢 Broadcast & 🎮 Gamification
   - etc.

## Bot Status
- **Webhook**: Properly set to `https://easybots.store/webhook/telegram`
- **Mode**: Webhook mode (production)
- **Admin Handlers**: Registered successfully
- **Latest Restart**: PID 95635 with 0 restart loops

## If Command Still Not Working

1. **Check that user is admin**: Use `PermissionService.isAdmin(userId)` to verify
2. **Check logs for one of the three messages above**: If none appear, issue is at webhook level
3. **Verify message has bot_command entity**: Telegram should include this if text starts with /

## Files Modified
- `src/bot/core/bot.js` - Added debug logging and removed duplicate handler registrations
- `src/bot/handlers/admin/index.js` - Already had proper exports and debug logs