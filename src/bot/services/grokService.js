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

function buildSystemPrompt({ mode, language }) {
  const langHint = language ? `Language: ${language}` : '';
  const pnptvContext = `PNPtv context:
- Telegram-based 18+ community (consent-first, privacy-first, respectful, sex-positive).
- Culture: warm, playful, flirty, bilingual EN/ES vibe; no hate, no harassment, no coercion, no doxxing, no underage content.
- Avoid explicit pornography descriptions; keep it tasteful and within Telegram-friendly marketing language.
- Common CTAs/features: PRIME Membership Plans, Who is Nearby, My Profile, PNPtv Main Room (Jitsi), Cristina AI support.
- If you mention actions, phrase them as simple bot CTAs (e.g., “Tap Membership Plans”, “Use /start”).`;

  if (mode === 'broadcast') {
    return `You write concise, high-converting Telegram broadcast copy for the PNPtv community.\n${langHint}\n${pnptvContext}\nOutput format:\n- HOOK: 1 attention-grabbing line (bold and engaging)\n- BODY: 2-3 sentences describing the offer/benefit\n- CALL TO ACTION: 1 clear line telling users what to do\n\nRules:\n- Return ONLY the final formatted text (no labels like "HOOK:", just the content)\n- No quotes, no markdown headings\n- Keep within Telegram limits (prefer <= 900 chars if media caption)\n- Separate sections with line breaks`;
  }
  
  if (mode === 'sharePost') {
    return `You write concise Telegram share post copy for the PNPtv community.\n${langHint}\n${pnptvContext}\nOutput format:\n- TITLE: 1 short, engaging line\n- DESCRIPTION: 2-3 sentences describing the content\n- CATEGORIES: 3-5 relevant hashtags\n\nRules:\n- Return ONLY the final formatted text (no labels like "TITLE:", just the content)\n- No quotes, no markdown headings\n- Keep within Telegram limits (prefer <= 600 chars)\n- Separate sections with line breaks\n- Hashtags should start with # and be space-separated`;
  }
  
  return `You write concise Telegram post copy for the PNPtv community.\n${langHint}\n${pnptvContext}\nOutput rules:\n- Return ONLY the final message text.\n- No quotes, no markdown headings.\n- Keep within Telegram limits (prefer <= 900 chars if media caption).\n- End with a clear CTA.`;
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

/**
 * Generate bilingual share post content
 * @param {Object} options - Generation options
 * @param {string} options.prompt - User prompt describing what to generate
 * @param {boolean} options.hasMedia - Whether the post has media attached
 * @returns {Promise<{combined: string, en: string, es: string}>}
 */
async function generateSharePost({ prompt, hasMedia = false }) {
  const maxChars = hasMedia ? 900 : 3000;

  // Generate English version
  const enPrompt = `Create a share post for: ${prompt}\n\nRequirements:\n- Language: English\n- Max ${maxChars} characters\n- Engaging, community-focused tone\n- Include relevant emojis\n- End with a call to action`;

  const enContent = await chat({
    mode: 'sharePost',
    language: 'English',
    prompt: enPrompt,
    maxTokens: 400,
  });

  // Generate Spanish version
  const esPrompt = `Create a share post for: ${prompt}\n\nRequirements:\n- Language: Spanish\n- Max ${maxChars} characters\n- Engaging, community-focused tone\n- Include relevant emojis\n- End with a call to action`;

  const esContent = await chat({
    mode: 'sharePost',
    language: 'Spanish',
    prompt: esPrompt,
    maxTokens: 400,
  });

  // Combine both versions
  const combined = `🇺🇸 English:\n${enContent}\n\n🇪🇸 Español:\n${esContent}`;

  return {
    combined,
    en: enContent,
    es: esContent,
  };
}

module.exports = {
  chat,
  generateSharePost,
};
