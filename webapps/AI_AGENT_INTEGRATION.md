# AI Agent Integration for PNPtv

This guide covers integrating AI agents into PNPtv's Hangouts, Radio, and Live features using Agora's AI capabilities.

## 🤖 Overview

AI agents can enhance PNPtv with:
- **Radio DJ Bot**: Announces songs, takes requests, engages listeners
- **Call Moderator**: Manages discussions, mutes disruptive users
- **Content Moderator**: Scans chat for inappropriate content
- **Virtual Host**: Hosts live shows when human host is unavailable

## 📦 Installation

### 1. Install Agora AI SDK

Add to each web app:

```bash
cd webapps/hangouts  # or radio, or live
npm install @agora/ai-agent-sdk
```

### 2. Backend Service Setup

Create AI agent service in your backend:

```bash
# Create new service file
touch src/services/ai/aiAgentService.js
```

## 🎵 Radio DJ Bot Implementation

### Backend Service

```javascript
// src/services/ai/aiAgentService.js
const AgoraRTC = require('agora-rtc-sdk-ng');
const logger = require('../../utils/logger');

class AIAgentService {
  constructor() {
    this.agents = new Map();
  }

  /**
   * Create a Radio DJ agent
   * @param {string} channelName - Radio channel name
   * @param {string} agentRole - Agent personality/role
   */
  async createRadioDJ(channelName, agentRole = 'friendly_dj') {
    try {
      const agentConfig = {
        appId: process.env.AGORA_APP_ID,
        channel: channelName,
        role: 'host',
        personality: agentRole,
        voice: 'en-US-Neural2-J', // Google Cloud TTS voice
        tasks: [
          'announce_current_song',
          'take_song_requests',
          'engage_listeners',
          'tell_artist_facts',
        ],
        language: 'en',
      };

      const agent = await this.initializeAgent(agentConfig);
      this.agents.set(`radio_${channelName}`, agent);

      logger.info('Radio DJ agent created', { channelName, agentRole });
      return agent;
    } catch (error) {
      logger.error('Failed to create Radio DJ:', error);
      throw error;
    }
  }

  /**
   * Create a Call Moderator agent
   * @param {string} callId - Call/room ID
   */
  async createCallModerator(callId) {
    try {
      const agentConfig = {
        appId: process.env.AGORA_APP_ID,
        channel: `private_${callId}`,
        role: 'host',
        personality: 'professional_moderator',
        voice: 'en-US-Neural2-D',
        tasks: [
          'detect_off_topic',
          'manage_speaking_turns',
          'suggest_topics',
          'enforce_rules',
        ],
        permissions: ['mute', 'warn'],
        language: 'en',
      };

      const agent = await this.initializeAgent(agentConfig);
      this.agents.set(`moderator_${callId}`, agent);

      logger.info('Call moderator created', { callId });
      return agent;
    } catch (error) {
      logger.error('Failed to create moderator:', error);
      throw error;
    }
  }

  /**
   * Create a Content Moderator agent
   * @param {string} streamId - Live stream ID
   */
  async createContentModerator(streamId) {
    try {
      const agentConfig = {
        appId: process.env.AGORA_APP_ID,
        channel: `live_${streamId}`,
        role: 'audience',
        personality: 'safety_moderator',
        tasks: [
          'scan_chat_messages',
          'detect_personal_info',
          'detect_harassment',
          'block_spam',
          'auto_warn_users',
        ],
        languages: ['en', 'es'],
        autoActions: true,
      };

      const agent = await this.initializeAgent(agentConfig);
      this.agents.set(`content_mod_${streamId}`, agent);

      logger.info('Content moderator created', { streamId });
      return agent;
    } catch (error) {
      logger.error('Failed to create content moderator:', error);
      throw error;
    }
  }

  /**
   * Initialize AI agent (placeholder - implement with your AI service)
   */
  async initializeAgent(config) {
    // TODO: Implement with Agora AI or your preferred AI service
    // This is a placeholder structure
    return {
      id: `agent_${Date.now()}`,
      config,
      status: 'initialized',
      start: async () => {
        logger.info('AI agent started', { id: this.id });
      },
      stop: async () => {
        logger.info('AI agent stopped', { id: this.id });
      },
      sendMessage: async (message) => {
        logger.info('AI agent message', { id: this.id, message });
      },
    };
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId) {
    return this.agents.get(agentId);
  }

  /**
   * Stop and remove agent
   */
  async removeAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (agent) {
      await agent.stop();
      this.agents.delete(agentId);
      logger.info('AI agent removed', { agentId });
    }
  }

  /**
   * Stop all agents
   */
  async stopAll() {
    for (const [id, agent] of this.agents) {
      await agent.stop();
    }
    this.agents.clear();
    logger.info('All AI agents stopped');
  }
}

module.exports = new AIAgentService();
```

### Frontend Integration (Radio App)

Update `webapps/radio/src/components/RadioPlayer.jsx`:

```javascript
// Add AI DJ interaction
import { useState, useEffect } from 'react'

const RadioPlayerWithAI = ({ ...props }) => {
  const [aiDjActive, setAiDjActive] = useState(false)
  const [djMessages, setDjMessages] = useState([])

  useEffect(() => {
    // Connect to AI DJ websocket or API
    const connectAIDJ = async () => {
      try {
        // Example: WebSocket connection to AI agent
        const ws = new WebSocket(`wss://pnptv.app/api/ai-dj?channel=${props.room}`)

        ws.onmessage = (event) => {
          const message = JSON.parse(event.data)
          if (message.type === 'dj_announcement') {
            setDjMessages((prev) => [...prev, message.text])
            // Show notification or update UI
          }
        }

        setAiDjActive(true)
      } catch (error) {
        console.error('Failed to connect to AI DJ:', error)
      }
    }

    connectAIDJ()
  }, [props.room])

  // Add DJ messages display to your UI
  return (
    <>
      {/* Your existing RadioPlayer component */}
      {aiDjActive && (
        <div className="ai-dj-messages">
          <h4>🎙️ AI DJ</h4>
          {djMessages.map((msg, i) => (
            <div key={i} className="dj-message">{msg}</div>
          ))}
        </div>
      )}
    </>
  )
}
```

## 🎥 Live Stream Moderator

### Bot Handler Integration

Update `src/bot/handlers/media/live.js`:

```javascript
const AIAgentService = require('../../../services/ai/aiAgentService');

// When creating a live stream
const stream = await LiveStreamModel.createStream(...);

// Create AI content moderator
if (user.settings.enableAIModerator) {
  await AIAgentService.createContentModerator(stream.streamId);
}
```

### Frontend Integration (Live App)

```javascript
// webapps/live/src/components/LiveStream.jsx
const [moderationActive, setModerationActive] = useState(false)

// Auto-filter chat messages
const sendMessage = () => {
  if (messageInput.trim()) {
    // Send to AI moderator for checking
    fetch('/api/ai-moderate', {
      method: 'POST',
      body: JSON.stringify({ message: messageInput, streamId: stream }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.approved) {
          // Message is safe
          setMessages(prev => [...prev, { username, text: messageInput }])
        } else {
          // Message blocked
          alert('Your message was blocked by content moderation')
        }
      })
  }
}
```

## 📞 Call Moderator (Hangouts)

### Auto-Moderate Calls

```javascript
// src/bot/handlers/media/hangouts.js
const createPrivateCall = async (ctx) => {
  const call = await VideoCallModel.createCall(userId, 'private');

  // Enable AI moderator for large calls
  if (call.settings.enableModerator) {
    await AIAgentService.createCallModerator(call.callId);
  }

  // ...
}
```

## 🔧 Configuration

### Environment Variables

Add to `.env`:

```bash
# AI Agent Configuration
AI_AGENTS_ENABLED=true
AI_SERVICE_URL=https://api.agora.io/ai-agents  # or your AI service
AI_SERVICE_KEY=your_ai_service_key

# Voice Settings
AI_VOICE_PROVIDER=google  # google, azure, aws
AI_VOICE_API_KEY=your_voice_api_key

# Moderation Settings
AI_MODERATION_LEVEL=medium  # low, medium, high
AI_AUTO_ACTIONS=true  # Auto-mute, auto-ban, etc.
```

### Enable in Bot Menu

Add AI features to user settings:

```javascript
// src/bot/handlers/user/settings.js
bot.action('settings_ai_features', async (ctx) => {
  await ctx.editMessageText(
    'AI Features\n\n' +
    '🎵 Radio DJ Bot: Enabled\n' +
    '🛡️ Content Moderation: Enabled\n' +
    '👮 Call Moderator: Disabled',
    Markup.inlineKeyboard([
      [Markup.button.callback('Toggle Radio DJ', 'toggle_ai_dj')],
      [Markup.button.callback('Toggle Moderator', 'toggle_ai_mod')],
      [Markup.button.callback('Back', 'settings_menu')],
    ])
  );
});
```

## 🎯 Use Cases

### 1. Radio DJ Bot
- Announces current song and artist
- Takes song requests from chat
- Shares fun facts about music
- Engages with listeners
- Runs contests/giveaways

### 2. Call Moderator
- Detects off-topic conversations
- Manages speaking turns
- Suggests discussion topics
- Warns/mutes disruptive users
- Keeps conversations on track

### 3. Content Moderator
- Scans chat for personal info (emails, phone numbers)
- Detects harassment/bullying
- Blocks spam and links
- Auto-warns users for violations
- Supports multiple languages

### 4. Virtual Host
- Hosts live shows
- Interviews guests
- Manages Q&A sessions
- Presents sponsored content
- Fills in when human host unavailable

## 📊 Analytics & Monitoring

Track AI agent performance:

```javascript
// src/models/aiAgentAnalyticsModel.js
const trackAIInteraction = async (agentId, action, data) => {
  await db.query(
    `INSERT INTO ai_agent_analytics
    (agent_id, action_type, data, created_at)
    VALUES ($1, $2, $3, NOW())`,
    [agentId, action, JSON.stringify(data)]
  );
};

// Usage
await trackAIInteraction('radio_dj_001', 'song_announcement', {
  song: 'Amazing Song',
  listenerReactions: 42,
});
```

## 🚀 Next Steps

1. **Choose AI Provider**:
   - Agora AI (if available)
   - OpenAI GPT-4 + Google TTS
   - Custom AI model

2. **Implement Voice**:
   - Google Cloud Text-to-Speech
   - Azure Cognitive Services
   - AWS Polly

3. **Test Each Feature**:
   - Test DJ announcements
   - Test content moderation
   - Test call moderator

4. **Monitor Performance**:
   - Track AI response times
   - Measure user satisfaction
   - Adjust personalities

5. **Iterate & Improve**:
   - Gather user feedback
   - Fine-tune AI models
   - Add new capabilities

## 💡 Tips

- Start with one AI feature at a time
- Test thoroughly before enabling auto-actions
- Provide user controls to enable/disable AI
- Monitor AI behavior closely
- Have human oversight for critical actions

## 📞 Support

For AI agent integration help:
- Check Agora AI documentation
- Review backend logs: `pm2 logs pnptvbot`
- Test locally first
- Start with basic features

---

**Note**: This is a framework for AI integration. Actual implementation will depend on your chosen AI service provider and specific requirements.
