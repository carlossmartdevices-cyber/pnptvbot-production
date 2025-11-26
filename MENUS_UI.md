# Menus & User Interface System

Comprehensive menu system with intelligent routing, private chat redirects, and AI support integration.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Menu Structure](#menu-structure)
4. [Commands](#commands)
5. [Behaviors](#behaviors)
6. [Topic-Specific Menus](#topic-specific-menus)
7. [Cristina AI Assistant](#cristina-ai-assistant)
8. [Configuration](#configuration)
9. [Deep Links](#deep-links)
10. [Testing](#testing)
11. [Troubleshooting](#troubleshooting)

---

## Overview

The Menu & UI system provides a comprehensive interface for users to navigate bot features through:
- Interactive inline keyboards in private chat
- Smart redirect to private messages from groups
- Topic-specific menu variations (e.g., topic 3809)
- AI-powered support through Cristina
- Deep link support for direct navigation
- Bilingual support (English/Spanish)

---

## Features

### ✅ Implemented Features

- **Group Menu Display**: `/menu` command displays same interface as `/start` in bot
- **DM Redirect**: Bot replies in group: "@username I sent you a direct message about your [option] request" with inline button to open bot
- **Menu Redirect to Private Chat**: Seamless transition from group to private conversation
- **Topic 3809 Exception**: Special menu showing only live streams and video calls
- **Cristina AI**: `/cristina` command for AI support agent
- **Deep Links**: Direct navigation to specific menu sections
- **Auto-cleanup**: Group messages auto-delete after 90 seconds
- **Bilingual Support**: Automatic language detection (English/Spanish)

---

## Menu Structure

### Main Categories

#### 📱 Subscription & Access
- ✨ Subscribe Now
- 📊 Subscription Status
- 🔄 Renew Subscription
- 💳 Payment Methods

#### 🎬 Content & Media
- 🔴 Live Streams
- 📹 Video Calls
- 📸 Exclusive Photos
- 🎥 Exclusive Videos
- 🎙️ Podcasts

#### 👥 Community & Engagement
- 🌟 Join Group
- 🏆 Your Badges
- 📊 Leaderboard
- 🎉 Events

#### 💬 Support & Help
- ❓ FAQ
- 🆘 Contact Support
- 🤖 Cristina AI Assistant
- 📜 Community Rules

#### ⚙️ Settings & Profile
- 👤 My Profile
- 🔔 Notification Settings
- 🌍 Language / Idioma
- 🔒 Privacy Settings

---

## Commands

### `/menu`

Displays the main menu interface.

**Behavior by context:**

1. **Private Chat**:
   - Shows full menu with all categories
   - Same as `/start` command
   - Interactive inline keyboard

2. **Group Chat (except topic 3809)**:
   - Sends DM to user with full menu
   - Replies in group: "@username I sent you a direct message about your Main Menu request!"
   - Provides "Open Bot" button with deep link
   - Auto-deletes both messages after 90 seconds

3. **Topic 3809 (Content Menu)**:
   - Shows special menu with only:
     - 🔴 Live Streams
     - 📹 Video Calls
   - Displayed directly in topic (no redirect)

**Examples:**
```
User in private chat:
/menu
→ Shows full menu with 5 categories

User in group:
/menu
→ Group: "@john I sent you a direct message about your Main Menu request!"
→ DM: Full menu interface

User in topic 3809:
/menu
→ Shows: "🎬 Content Menu" with Live Streams and Video Calls only
```

### `/cristina [question]`

Interact with Cristina AI support agent.

**Usage:**

```bash
# Show introduction
/cristina

# Ask a question
/cristina How do I renew my subscription?
/cristina ¿Cuándo es la próxima transmisión?
```

**Features:**
- Natural language understanding
- Bilingual support (English/Spanish)
- Context-aware responses
- Quick access buttons for common topics
- Conversation tracking

**Topics Cristina understands:**
- Subscriptions and access
- Payment methods and billing
- Live streams scheduling
- Video calls booking
- Group access and invitations
- Community rules
- Profile and settings
- Technical support

---

## Behaviors

### Private Chat Flow

```
User: /menu
↓
Bot displays full menu with inline keyboard
↓
User clicks option (e.g., "📱 Subscription")
↓
Bot shows relevant information/submenu
```

### Group Chat Flow

```
User in group: /menu
↓
Bot attempts to send DM
↓
If successful:
  - DM sent with full menu
  - Group reply: "@user I sent you a direct message..."
  - "Open Bot" button with deep link
  - Auto-delete after 90 seconds
↓
If user hasn't started bot:
  - Group reply: "Please start a private chat with me first!"
  - "Open Bot" button to start conversation
  - Auto-delete after 90 seconds
```

### Topic 3809 Flow

```
User in topic 3809: /menu
↓
Bot displays special content menu
↓
Shows only:
  - 🔴 Live Streams
  - 📹 Video Calls
↓
User clicks option
↓
Bot shows relevant content
```

---

## Topic-Specific Menus

### Topic 3809: Content Menu

**Configuration:**
```javascript
TOPIC_3809_MENU: {
  title: {
    en: '🎬 Content Menu',
    es: '🎬 Menú de Contenido'
  },
  options: [
    'Live Streams',
    'Video Calls'
  ]
}
```

**Behavior:**
- Only shows live streams and video calls
- No redirect to DM
- Displayed directly in topic
- Same auto-delete rules apply

**Example:**
```
User in topic 3809:
/menu

Bot responds:
🎬 Content Menu

Access our exclusive content:

[🔴 Live Streams] [📹 Video Calls]
```

---

## Cristina AI Assistant

### Overview

Cristina is an AI-powered support agent that helps users with common questions and issues.

### Features

- **Natural Language Processing**: Understands questions in English and Spanish
- **Context Awareness**: Maintains conversation history
- **Quick Actions**: Pre-built buttons for common topics
- **Smart Routing**: Escalates to human support when needed
- **Bilingual**: Automatic language detection

### Usage Examples

**Getting Started:**
```
/cristina

Response:
🤖 Hi! I'm Cristina, your AI assistant

I'm here to help you with any questions or issues you have.

How to use me:
📝 Simply type: /cristina your question here

[📱 Subscription] [🎬 Content]
[💳 Payments] [⚙️ Settings]
[🆘 Technical Support]
```

**Asking Questions:**
```
/cristina How do I subscribe?

Response:
📱 About Subscription

To subscribe, use the /menu command and select "Subscription".

Your subscription gives you access to:
• Exclusive content
• Live streams
• Video calls
• Private group

Need more information about something specific?
```

**Spanish Support:**
```
/cristina ¿Cómo renuevo mi suscripción?

Response:
🔄 Renovar Suscripción

Aquí puedes renovar tu suscripción.
...
```

### Supported Topics

1. **Subscription & Access**
   - How to subscribe
   - Subscription status
   - Renewal process
   - Cancellation

2. **Payments**
   - Payment methods
   - Billing issues
   - Refunds
   - Pricing

3. **Content**
   - Live streams schedule
   - Video calls booking
   - Exclusive media access
   - Podcasts

4. **Community**
   - Group access
   - Community rules
   - Events
   - Badges

5. **Technical Support**
   - Access issues
   - Message problems
   - Multimedia issues
   - General troubleshooting

### Escalation

When Cristina cannot help, she'll suggest:
```
Use /support to contact a human support agent
```

---

## Configuration

### Menu Configuration File

**Location:** `src/config/menuConfig.js`

**Key Sections:**

```javascript
MENU_CONFIG = {
  // Main menu categories
  MAIN_CATEGORIES: {
    SUBSCRIPTION: { ... },
    CONTENT: { ... },
    COMMUNITY: { ... },
    SUPPORT: { ... },
    SETTINGS: { ... }
  },

  // Topic-specific menus
  TOPIC_3809_MENU: { ... },

  // Messages
  MESSAGES: {
    MAIN_MENU: { en, es },
    GROUP_REDIRECT: { en, es },
    ...
  },

  // Topics
  TOPICS: {
    CONTENT_MENU: 3809
  }
}
```

### Adding New Menu Options

1. **Add to configuration:**

```javascript
// In menuConfig.js
MAIN_CATEGORIES: {
  NEW_CATEGORY: {
    id: 'new_category',
    title: {
      en: '🆕 New Category',
      es: '🆕 Nueva Categoría'
    },
    options: [
      {
        id: 'new_option',
        title: { en: '✨ New Option', es: '✨ Nueva Opción' },
        callback: 'menu:new_option',
        deepLink: 'new_option'
      }
    ]
  }
}
```

2. **Add handler function:**

```javascript
// In menuHandler.js
async function handleNewOption(ctx, lang) {
  const message = lang === 'es'
    ? '🆕 *Nueva Opción*\n\nContenido aquí...'
    : '🆕 *New Option*\n\nContent here...';

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(
      lang === 'es' ? '⬅️ Volver' : '⬅️ Back',
      'menu:back'
    )]
  ]);

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}
```

3. **Register in switch statement:**

```javascript
// In handleMenuCallback function
case 'new_option':
  await handleNewOption(ctx, lang);
  break;
```

### Environment Variables

```bash
# Required
BOT_USERNAME=your_bot_username

# Optional
GROUP_INVITE_LINK=https://t.me/your_group
```

---

## Deep Links

### What are Deep Links?

Deep links allow direct navigation to specific menu sections from outside the bot (e.g., websites, other messages).

### Format

```
https://t.me/BOT_USERNAME?start=menu_OPTION_ID
```

### Examples

**Subscribe:**
```
https://t.me/pnptvbot?start=menu_subscribe
```

**Live Streams:**
```
https://t.me/pnptvbot?start=menu_live_streams
```

**Cristina AI:**
```
https://t.me/pnptvbot?start=menu_cristina_ai
```

### Usage in Messages

**HTML:**
```html
<a href="https://t.me/pnptvbot?start=menu_subscribe">Subscribe Now</a>
```

**Markdown:**
```markdown
[Subscribe Now](https://t.me/pnptvbot?start=menu_subscribe)
```

**Telegram:**
```
Check out our subscription options: https://t.me/pnptvbot?start=menu_subscribe
```

### Generating Deep Links

```javascript
const { generateDeepLink } = require('./config/menuConfig');

// Generate link for specific option
const subscribeLink = generateDeepLink('subscribe');
// Returns: https://t.me/BOT_USERNAME?start=menu_subscribe
```

---

## Testing

### Test Checklist

#### Private Chat Tests

- [ ] `/menu` displays full menu with all categories
- [ ] Clicking subscription options works
- [ ] Clicking content options works
- [ ] Clicking community options works
- [ ] Clicking support options works
- [ ] Clicking settings options works
- [ ] Back button returns to main menu
- [ ] Language selection works (English/Spanish)

#### Group Chat Tests

- [ ] `/menu` sends DM and group message
- [ ] Group message shows "@username I sent you a DM..."
- [ ] "Open Bot" button works
- [ ] Messages auto-delete after 90 seconds
- [ ] Works when user hasn't started bot
- [ ] Works when user has started bot

#### Topic 3809 Tests

- [ ] `/menu` shows content menu only
- [ ] Only live streams and video calls displayed
- [ ] No redirect to DM
- [ ] Options are clickable and functional

#### Cristina AI Tests

- [ ] `/cristina` shows introduction
- [ ] `/cristina question` processes question
- [ ] English questions work
- [ ] Spanish questions work
- [ ] Quick action buttons work
- [ ] Subscription topic responses work
- [ ] Payment topic responses work
- [ ] Content topic responses work
- [ ] Support topic responses work
- [ ] Unknown questions get helpful response

#### Deep Link Tests

- [ ] `?start=menu_subscribe` opens subscribe menu
- [ ] `?start=menu_live_streams` opens live streams
- [ ] `?start=menu_cristina_ai` opens Cristina intro
- [ ] Invalid deep links fallback to main menu

### Manual Testing Commands

```bash
# Test private chat menu
/menu

# Test Cristina introduction
/cristina

# Test Cristina with question
/cristina How do I subscribe?

# Test Spanish
/cristina ¿Cómo funciona?

# Test in group
# Go to group and run:
/menu

# Test in topic 3809
# Go to topic 3809 and run:
/menu

# Test language selection
/menu
# Click Settings → Language
# Select Español or English
```

---

## Troubleshooting

### Issue: Menu not showing in private chat

**Symptoms:**
- `/menu` doesn't respond
- No keyboard appears

**Solutions:**
1. Check bot is running: `pm2 status` or check logs
2. Verify handlers registered: Check bot.js includes `registerMenuHandlers(bot)`
3. Check for errors in logs: `pm2 logs pnptvbot`
4. Restart bot: `pm2 restart pnptvbot`

### Issue: DM not sent from group

**Symptoms:**
- User doesn't receive DM when using `/menu` in group
- Only "Please start bot first" message shown

**Solutions:**
1. User must start bot first: Click "Open Bot" button
2. Check bot has permission to send DMs
3. Verify user hasn't blocked bot
4. Check logs for specific error

### Issue: Topic 3809 menu not working

**Symptoms:**
- `/menu` in topic 3809 shows full menu instead of content-only

**Solutions:**
1. Verify topic ID is correct: Check `TOPICS.CONTENT_MENU` in config
2. Check message includes `message_thread_id`
3. Verify topic exists in group
4. Check middleware order in bot.js

### Issue: Cristina not responding

**Symptoms:**
- `/cristina` doesn't respond
- Questions not processed

**Solutions:**
1. Check handler registered: `registerMenuHandlers(bot)` in bot.js
2. Verify callback action registered: `bot.action(/^cristina:/)`
3. Check for errors in logs
4. Test with simple question: `/cristina help`

### Issue: Messages not auto-deleting

**Symptoms:**
- Group messages stay beyond 90 seconds
- No cleanup occurring

**Solutions:**
1. Check chatCleanup middleware is active
2. Verify bot has delete message permissions
3. Check for errors in setTimeout callbacks
4. Verify message IDs are being tracked

### Issue: Deep links not working

**Symptoms:**
- Deep link opens bot but doesn't show specific menu
- Fallback to main menu always

**Solutions:**
1. Verify deep link format: `?start=menu_OPTION_ID`
2. Check option ID exists in config
3. Verify `handleDeepLinkStart` overrides `/start`
4. Check logs for parsing errors

### Issue: Wrong language displayed

**Symptoms:**
- Menu shows wrong language
- Language detection not working

**Solutions:**
1. Check Telegram language setting
2. Verify `detectLanguage` utility works
3. Test manual language selection: /menu → Settings → Language
4. Check language preference saved in database (if implemented)

### Issue: Back button not working

**Symptoms:**
- Clicking "Back" does nothing
- Error when navigating

**Solutions:**
1. Check callback handler registered: `bot.action(/^menu:/)`
2. Verify `menu:back` case in switch statement
3. Check message can be edited (not too old)
4. Verify keyboard markup is correct

---

## Files Structure

```
src/
├── config/
│   └── menuConfig.js                    # Menu configuration
├── bot/
│   ├── handlers/
│   │   ├── menu/
│   │   │   ├── index.js                 # Menu handlers registration
│   │   │   └── menuHandler.js           # Main menu logic
│   │   └── support/
│   │       └── cristinaAI.js            # Cristina AI handler
│   └── core/
│       └── bot.js                       # Bot initialization (updated)
└── utils/
    └── languageDetector.js              # Language detection utility

MENUS_UI.md                              # This documentation
```

---

## API Reference

### menuConfig.js

#### `getMenuOptions(context, lang)`
Get menu options based on context.

**Parameters:**
- `context` (string): 'main' or 'topic_3809'
- `lang` (string): 'en' or 'es'

**Returns:** Menu options array or categories object

#### `getOptionById(optionId)`
Get specific menu option by ID.

**Parameters:**
- `optionId` (string): Option identifier

**Returns:** Option object or null

#### `getOptionTitle(optionId, lang)`
Get option title in specified language.

**Parameters:**
- `optionId` (string): Option identifier
- `lang` (string): 'en' or 'es'

**Returns:** Localized title string

#### `generateDeepLink(optionId)`
Generate deep link for menu option.

**Parameters:**
- `optionId` (string): Option identifier

**Returns:** Full deep link URL

#### `getMessage(key, lang, replacements)`
Get localized message with placeholder replacement.

**Parameters:**
- `key` (string): Message key
- `lang` (string): 'en' or 'es'
- `replacements` (object): Placeholder values

**Returns:** Formatted message string

### languageDetector.js

#### `detectLanguage(ctx)`
Detect user's preferred language.

**Parameters:**
- `ctx` (object): Telegraf context

**Returns:** Promise<string> - 'en' or 'es'

#### `getLocalizedText(textObject, lang)`
Get localized text from multilingual object.

**Parameters:**
- `textObject` (object): Object with language keys
- `lang` (string): Language code

**Returns:** Localized string

---

## Future Enhancements

### Planned Features

1. **Database Language Persistence**
   - Save user language preference
   - Remember across sessions

2. **Menu Analytics**
   - Track menu option clicks
   - Popular features analysis
   - User journey mapping

3. **Enhanced Cristina AI**
   - Integration with GPT-4 or similar
   - More sophisticated responses
   - Context retention across sessions
   - Learning from interactions

4. **Custom Menu Builder**
   - Admin command to customize menus
   - Per-topic menu configurations
   - Dynamic menu generation

5. **Menu Permissions**
   - Role-based menu visibility
   - Subscription-tier menus
   - Feature gating

6. **Rich Media Menus**
   - Inline images in menus
   - Video previews
   - Audio samples

7. **Favorites System**
   - Quick access to frequently used options
   - Personalized menu shortcuts

---

## Support

For issues or questions:

1. Check [Troubleshooting](#troubleshooting) section
2. Review bot logs: `pm2 logs pnptvbot`
3. Test individual components
4. Contact development team

---

## Changelog

### Version 1.0.0 (Current)
- ✅ Initial menu system implementation
- ✅ Private chat full menu
- ✅ Group chat DM redirect
- ✅ Topic 3809 content menu
- ✅ Cristina AI assistant
- ✅ Deep link support
- ✅ Bilingual support (English/Spanish)
- ✅ Auto-cleanup (90 seconds)
- ✅ Language detection
- ✅ Quick action buttons
- ✅ Back navigation
- ✅ Category organization

---

## License

Internal use only - PNPtv Telegram Bot
