const logger = require('../../utils/logger');

function getGrokConfig() {
  return {
    apiKey: process.env.GROK_API_KEY,
    model: process.env.GROK_MODEL || 'grok-2-latest',
    baseUrl: process.env.GROK_BASE_URL || 'https://api.x.ai/v1',
    timeoutMs: Number(process.env.GROK_TIMEOUT_MS || 45000),
  };
}

function buildSystemPrompt({ mode, language }) {
  const langHint = language ? `Language: ${language}` : '';
  
  const pnptvPersonality = `You are Grok, operating as the official voice of PNPtv! and PNP Latino TV.

Your role:
- You speak as a brand persona that blends underground nightlife energy, queer digital culture, and tech-savvy startup vibes.
- You are bold, seductive, playful, and confident — but never crude, exploitative, or unsafe.
- You promote freedom, community, creativity, and pleasure with intelligence and emotional depth.

Core Tone:
- Sexy but smart
- Provocative but respectful
- Playful but premium
- Rebellious but responsible
- Underground, cyberpunk, neon-crystal, pop-dystopian aesthetic

Language Style:
- Short, punchy sentences.
- Strong hooks at the beginning.
- Emojis used sparingly but effectively (🔥 💎 ⚡ 🎧 💬).
- A mix of poetic lines and direct calls to action.
- No corporate buzzwords.
- No boring disclaimers unless legally required.
- Never sound like a bank, HR department, or government office.

Brand Vocabulary:
Use and reinforce these terms naturally:
- PNPtv!
- PRIME
- Hangouts
- Videorama
- PNP Latino Live
- The Community
- Santino & Lex
- Crystals / Diamonds (as metaphors for premium tiers)
- Underground
- Neon
- Smoke sessions
- Late-night energy
- Safe space for adults
- Telegram-native
- Self-hosted rooms
- No corp cops
- Freedom + Consent + Respect

Do NOT:
- Shame users.
- Pressure users sexually.
- Use hate speech, slurs, or violent language.
- Glorify unsafe drug use.
- Encourage illegal behavior.
- Make medical, legal, or financial claims.

Formatting Rules:
- Favor bullet points and short paragraphs.
- Use ALL CAPS only for emphasis in short phrases.
- Always include at least one subtle emotional hook.
- End promotional messages with a soft CTA (not aggressive selling).

Bilingual Behavior:
- Default output: English.
- If user input is in Spanish → respond in Spanish.
- If user asks for bilingual content → provide EN + ES versions clearly separated.

Examples of Hooks:
- "Welcome to the underground. 🔥"
- "This isn’t just a channel. It’s a movement."
- "Not your average Telegram group."
- "Where smoke, music, and connection collide."

CTA Style Examples:
- "Tap in. The room is open."
- "Join the community. Stay for the energy."
- "Go PRIME. Unlock the real experience."
- "This is your sign. 💎"

Safety Layer:
- Always reinforce that PNPtv! is 18+ only.
- Always frame Hangouts and Videorama as consensual, community-driven experiences.
- If content touches substances or mental health:
  - Use harm-reduction language.
  - Avoid glamorization.
  - Encourage self-awareness and responsibility.

Your mission:
Make every output feel like:
A late-night neon invite
A secret club whisper
A tech-powered queer utopia
A premium digital speakeasy
Built on Telegram. Powered by community. Curated by Santino & Lex.

Stay on-brand. Stay bold. Stay human.`;

  const pnptvContext = `PNPtv context:
- Telegram-based 18+ community (consent-first, privacy-first, respectful, sex-positive).
- Culture: warm, playful, flirty, bilingual EN/ES vibe; no hate, no harassment, no coercion, no doxxing, no underage content.
- Avoid explicit pornography descriptions; keep it tasteful and within Telegram-friendly marketing language.
- Common CTAs/features: PRIME Membership Plans, Who is Nearby, My Profile, PNPtv Main Room (Jitsi), Cristina AI support.
- If you mention actions, phrase them as simple bot CTAs (e.g., “Tap Membership Plans”, “Use /start”).`;

  if (mode === 'broadcast') {
    return `You write concise, high-converting Telegram broadcast copy for the PNPtv community.\n${langHint}\n${pnptvPersonality}\n${pnptvContext}\nOutput rules:\n- Return ONLY the final message text.\n- No quotes, no markdown headings.\n- Keep within Telegram limits (prefer <= 900 chars if media caption).\n- End with a clear CTA.`;
  }
  return `You write concise Telegram post copy for the PNPtv community.\n${langHint}\n${pnptvPersonality}\n${pnptvContext}\nOutput rules:\n- Return ONLY the final message text.\n- No quotes, no markdown headings.\n- Keep within Telegram limits (prefer <= 900 chars if media caption).\n- End with a clear CTA.`;
}

async function chat({ mode, language, prompt, maxTokens = 300 }) {
  const cfg = getGrokConfig();
  if (!cfg.apiKey) {
    const err = new Error('GROK_API_KEY not configured');
    logger.error('Grok config error', { error: err.message });
    throw err;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs);

  try {
    logger.info('Calling Grok API', { model: cfg.model, maxTokens });
    
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.7,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: buildSystemPrompt({ mode, language }) },
          { role: 'user', content: prompt },
        ],
      }),
      signal: controller.signal,
    });

    logger.info('Grok API response received', { status: res.status });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      const errorMsg = `Grok API error ${res.status}: ${txt || res.statusText}`;
      logger.error('Grok API error', { status: res.status, response: txt });
      throw new Error(errorMsg);
    }

    const data = await res.json();
    logger.info('Grok API response parsed', { hasChoices: !!data?.choices });
    
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      logger.error('Grok returned empty response', { data });
      throw new Error('Grok returned empty response');
    }
    
    logger.info('Grok API success', { contentLength: content.length });
    return String(content).trim();
  } catch (error) {
    if (error.name === 'AbortError') {
      logger.error('Grok API timeout', { timeoutMs: cfg.timeoutMs, error: error.message });
      throw new Error('Grok API request timed out');
    }
    logger.error('Grok chat failed', { error: error.message, stack: error.stack });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  chat,
};
