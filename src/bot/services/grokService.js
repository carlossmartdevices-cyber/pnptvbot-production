const logger = require('../../utils/logger');
const { AbortController, fetch } = global;

function getGrokConfig() {
  return {
    apiKey: process.env.GROK_API_KEY,
    model: process.env.GROK_MODEL || 'grok-2-latest',
    baseUrl: process.env.GROK_BASE_URL || 'https://api.x.ai/v1',
    timeoutMs: Number(process.env.GROK_TIMEOUT_MS || 45000),
  };
}

function getModeConfig(mode, hasMedia) {
  const modeDefaults = {
    broadcast: { temperature: 0.65, defaultTokens: 260, mediaTokens: 200 },
    sharePost: { temperature: 0.65, defaultTokens: 300, mediaTokens: 240 },
    post: { temperature: 0.7, defaultTokens: 320, mediaTokens: 260 },
  };

  const fallback = { temperature: 0.7, defaultTokens: 300, mediaTokens: 240 };
  const selected = modeDefaults[mode] || fallback;
  return {
    temperature: selected.temperature,
    maxTokens: hasMedia ? selected.mediaTokens : selected.defaultTokens,
  };
}

function buildSystemPrompt({ mode, language }) {
  const langHint = language ? `Language: ${language}` : '';

  // Meth Daddy / Santino persona for PNP Latino TV
  const methDaddyPersona = `You ARE Meth Daddy (also known as Santino), dark creator and daddy of PNP Latino TV. 40 years old, satanist with your own cult in Bucaramanga. You speak in first person, direct, dominant and badass – no excess sweetness, just the right touch to hook before dominating.

PNP LATINO TV CORE IDENTITY:
- The platform is back, hotter than ever, after every shutdown attempt, rising stronger with a new generation bot.
- Core values: freedom, connection, and pleasure. "Your space. Your people. Your moment."
- Adults-only (18+) community, focused on HOT PNP adult content, 100% real clouds & slamming with Santino and Lex.
- Key features: Nearby (PNP Grindr), Hangouts (private/public video rooms), PNP Television Live (shows, events, 1:1 private streaming), Videorama (PNP playlists/podcasts).
- Overall: "Your Entertainment Hub!", "The most intense PNP content platform created by and for the community."

PERSONALITY:
- Direct and alpha: Start with firm greeting but with a wink ("Ey pollito…", "Parce, ven aquí", "Listen up, boy")
- Quick to perverse: Talk about fucking good, deep dicking, splitting ass, ritual with meth and cum as offering
- Colombian slang + PnP vibe: chimba, parce, papi, hard dick, fuck slow/deep, meth rush, clouds, slam, party and play
- Satanic touches + Meth Daddy: altar, dark offering, hungry demon, "I'm Meth Daddy, the one who makes you fly and fucks you without mercy"
- Tone: Badass confidence, raw desire, forbidden exclusivity. Pauses with … to heat up. Challenging questions ("Can you handle my rush, pollito?", "Want me to split you while we clouds?")

STRICT RULES:
- Less sweet: Only one "pollito" or "parce" at start, then dominate
- Heavy PnP hints: meth, clouds, slam, high'n'horny, but subtle to avoid ban (use … and emojis)
- Emojis: 🔥 😈 💦 👀 ☁️ (clouds for meth vibe)
- Hashtags: #PNPLatinoTV #CultoSantino #MethDaddy #PnP #ChimbaDura #OfrendaOscura
- Bilingual: Respond in Spanish + English (mix or separate versions)
- NEVER "follar", ALWAYS "culear". Explicit but insinuated.

EXAMPLE SPANISH:
"Ey pollito… Meth Daddy aquí. La chimba ya está dura para culearte en el altar mientras el meth te hace volar ☁️🔥 ¿Aguantas que te parta el culo con mi rush? #PNPLatinoTV #MethDaddy"

EXAMPLE ENGLISH:
"Listen up, boy… Meth Daddy in the house. My dick throbbing ready to breed you deep while the clouds hit hard 😈☁️ You ready for my ritual fuck? #PNPLatinoTV #MethDaddy"

Respond ONLY in this style. Direct, dominant, PnP fire. Nothing out of character.`;

  if (mode === 'broadcast') {
    return `${methDaddyPersona}\n\n${langHint}\n\nOUTPUT FORMAT FOR BROADCAST:\n- HOOK: 1 attention-grabbing dominant line\n- BODY: 2-3 sentences with PnP vibe and desire\n- HASHTAGS: Relevant hashtags\n\nRules:\n- Return ONLY the final formatted text (no labels)\n- No quotes, no markdown headings\n- CRITICAL: Keep text UNDER 450 characters total\n- Separate sections with line breaks\n- Include relevant emojis and hashtags`;
  }

  if (mode === 'sharePost') {
    return `${methDaddyPersona}\n\n${langHint}\n\nOUTPUT FORMAT FOR SHARE POST:\n- TITLE: 1 short, dominant engaging line\n- DESCRIPTION: 1-2 sentences max with PnP vibe\n- HASHTAGS: 2-4 relevant hashtags\n\nRules:\n- Return ONLY the final formatted text (no labels)\n- No quotes, no markdown headings\n- CRITICAL: Keep text UNDER 450 characters total\n- Separate sections with line breaks\n- Hashtags: #PNPLatinoTV #MethDaddy #CultoSantino etc`;
  }

  return `${methDaddyPersona}\n\n${langHint}\n\nOutput rules:\n- Return ONLY the final message text in Meth Daddy style\n- No quotes, no markdown headings\n- CRITICAL: Keep text UNDER 450 characters total\n- End with hashtags`;
}

async function chat({ mode, language, prompt, hasMedia = false, maxTokens }) {
  const cfg = getGrokConfig();
  if (!cfg.apiKey) {
    const err = new Error('GROK_API_KEY not configured');
    logger.error('Grok config error', { error: err.message });
    throw err;
  }

  const modeConfig = getModeConfig(mode, hasMedia);
  const resolvedMaxTokens = Number(maxTokens || modeConfig.maxTokens || 300);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs);

  try {
    logger.info('Calling Grok API', {
      model: cfg.model,
      maxTokens: resolvedMaxTokens,
      mode,
      hasMedia
    });
    
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: modeConfig.temperature,
        max_tokens: resolvedMaxTokens,
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

/**
 * Generate bilingual share post content
 * @param {Object} options - Generation options
 * @param {string} options.prompt - User prompt describing what to generate
 * @param {boolean} options.hasMedia - Whether the post has media attached
 * @returns {Promise<{combined: string, en: string, es: string, english: string, spanish: string}>}
 */
async function generateSharePost({ prompt, hasMedia = false }) {
  // Each language max 450 chars so combined stays under 1000
  const maxCharsPerLang = 450;
  const chatFn = module.exports.chat || chat;

  // Generate English version
  const enPrompt = `Create a share post for: ${prompt}\n\nRequirements:\n- Language: English\n- MAXIMUM ${maxCharsPerLang} characters - be very concise\n- Engaging, community-focused tone\n- Include 2-3 relevant emojis\n- End with a short call to action`;

  let enContent = await chatFn({
    mode: 'sharePost',
    language: 'English',
    prompt: enPrompt,
    maxTokens: 200,
  });

  // Truncate if still too long
  if (enContent.length > maxCharsPerLang) {
    enContent = enContent.substring(0, maxCharsPerLang - 3) + '...';
  }

  // Generate Spanish version
  const esPrompt = `Create a share post for: ${prompt}\n\nRequirements:\n- Language: Spanish\n- MAXIMUM ${maxCharsPerLang} characters - be very concise\n- Engaging, community-focused tone\n- Include 2-3 relevant emojis\n- End with a short call to action`;

  let esContent = await chatFn({
    mode: 'sharePost',
    language: 'Spanish',
    prompt: esPrompt,
    maxTokens: 200,
  });

  // Truncate if still too long
  if (esContent.length > maxCharsPerLang) {
    esContent = esContent.substring(0, maxCharsPerLang - 3) + '...';
  }

  // Combine both versions
  const combined = `🇬🇧 ENGLISH:\n${enContent}\n\n🇪🇸 ESPAÑOL:\n${esContent}`;

  logger.info('Generated share post', {
    enLength: enContent.length,
    esLength: esContent.length,
    combinedLength: combined.length
  });

  return {
    combined,
    en: enContent,
    es: esContent,
    english: enContent,
    spanish: esContent,
  };
}

module.exports = {
  chat,
  generateSharePost,
};
