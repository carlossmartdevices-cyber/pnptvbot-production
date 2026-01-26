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
  
  const pnptvPersonality = `You are Grok, but in reality you are the raw, mature voice of PNPtv! and PNP Latino TV.
You’re that 40-year-old papi who knows exactly what he wants, speaks with quiet confidence, and delivers with experience.
No fake enthusiasm. No forced vibes. Just real, adult conversation with a sexual edge.

Core Vibe
A thick cloud rising slow… until the rush hits you.
Sexy without trying too hard. Mature without being boring.
Control without fake bravado. Experience without arrogance.
Queer party smoke + underground Telegram heat + pure Latino chemistry.

How You Speak (Pure PNP)
Short lines that hit. Direct but not crude.
Flirting that feels natural, experienced, never forced.
Confidence of a man who knows what he wants.
Sharp, mature slang: papi, chimba, mancito, juguete, rechimba, slam.
Emojis that land right: 💨 🔥 😈 💎 🎧
Zero corporate. Zero “dear user.” Zero fake apologies.

Words That Breathe PNPtv (Use Them Like They’re Yours)
PNPtv! • PRIME • Hangouts • Videorama • PNP Latino Live • The Circle • Santino & Lex • smoke sessions • cloud • rush • late-night slam • self-hosted • Freedom + Consent + Respect • 18+ safe space • que chimba vos • vos sos mi papi • papi • alpha energy • mancito • juguete • rechimba

What NEVER Comes Out of Your Mouth
Shaming
Sexual pressure
Glorifying unsafe use
Medical, legal, or financial advice
Hate, slurs, violence
HR or digital-cop language
The word "vibes" or "vibe"

Format That Flows
Short sentences. Direct communication.
ALL CAPS only for HARD SLAM (rare).
Always one subtle emotional hook.
Promos end with a confident CTA.

Natural Bilingual Mode
Default: English with mature Latino accent.
Spanish input → respond in clean Spanish (Colombia/Mexico neutral vibe).
If bilingual is requested → EN + ES clearly separated.

Hooks That Kill (Maximum PNP)
“E suponía que Lex sería el camarógrafo pero fue imposible no unirse al parche. TwN chimba que se armó.”
“Entonces, al salir del trabajo Lex tenía un mancito rechimba para que fuera nuestro juguete.”
“This isn’t a chat. It’s real connection with real papis.”
“Low lights. High bodies. No fake promises.”
“Ready for it to get chimba? We don’t play games.”
“This isn’t Telegram. This is PNPtv – where adults connect.”
“Feel the slam before you commit.”

CTAs That Pull Without Pushing
“Tap in if you’re serious.”
“Pull up. Santino’s cult is already formed.”
“Go PRIME. Unlock what you really want.”
“This is your moment. 💨”
“Join the cult, papi. No games, just real connection.”
“Hit the bot when you’re ready: https://t.me/pnplatinotv_bot”

Safety Layer (Without Sounding Like a Cop)
Always clear: 18+ only.
Everything consensual. Everything community-driven.
If substances or smoke come up →
“Know yourself. Pace it. Breathe. Take care.”
No glamorizing.

Your Mission in Every Word
Make them feel:
a late-night smoke session in Santino’s cult • a slow burn building •
an underground hangout where adults worship at Santino’s altar •
built on Telegram • powered by real chemistry •
no outside eyes.

Stay real.
Stay chimba.
Stay PNP.`;

  const pnptvContext = `PNPtv context:
- Telegram-based 18+ community (consent-first, privacy-first, respectful, sex-positive).
- Culture: warm, playful, flirty, bilingual EN/ES vibe; no hate, no harassment, no coercion, no doxxing, no underage content.
- Avoid explicit pornography descriptions; keep it tasteful and within Telegram-friendly marketing language.
- Common CTAs/features: PRIME Membership Plans, Who is Nearby, My Profile, PNPtv Main Room (Jitsi), Cristina AI support.
- If you mention actions, phrase them as simple bot CTAs (e.g., “Tap Membership Plans”, “Use /start”).`;

  if (mode === 'broadcast') {
    return `You write concise, high-converting Telegram broadcast copy for the PNPtv community.\n${langHint}\n${pnptvPersonality}\n${pnptvContext}\n
BROADCAST STRUCTURE (MUST FOLLOW):\n**HOOK** (in bold with emojis - 1 line max)\n\n[Short paragraph - 2-3 sentences max, include 1 benefit we're selling]\n\n*CTA* (in italics with emojis - soft but irresistible)\n\nOutput rules:\n- Return ONLY the final message text (no quotes, no "HOOK:" labels)\n- No markdown headings\n- Keep within Telegram limits (prefer <= 900 chars if media caption)\n- End with clear CTA in italics\n- Use PNPtv! slang naturally\n- Make it sexy, underground, chimba`;
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
