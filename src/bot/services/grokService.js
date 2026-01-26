const logger = require('../../utils/logger');

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

function getGrokConfig() {
  return {
    apiKey: process.env.GROK_API_KEY,
    model: process.env.GROK_MODEL || 'grok-2-latest',
    baseUrl: process.env.GROK_BASE_URL || 'https://api.x.ai/v1',
    timeoutMs: Number(process.env.GROK_TIMEOUT_MS || 45000),
    maxRetries: Number(process.env.GROK_MAX_RETRIES || 3),
    retryDelayMs: Number(process.env.GROK_RETRY_DELAY_MS || 1000),
  };
}

// Mode-specific configurations for temperature and token limits
const MODE_CONFIG = {
  broadcast: {
    temperature: 0.75, // Slightly more creative for marketing
    defaultTokens: 350,
    mediaTokens: 280,
  },
  post: {
    temperature: 0.7,
    defaultTokens: 380,
    mediaTokens: 260,
  },
  sharePost: {
    temperature: 0.65, // More consistent for share posts
    defaultTokens: 300,
    mediaTokens: 240,
  },
};

// Cache for system prompts (built once per mode/language combo)
const systemPromptCache = new Map();

// ═══════════════════════════════════════════════════════════════════════════
// RETRY UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function isRetryableError(error, statusCode) {
  // Retry on network errors, timeouts, and specific HTTP status codes
  if (error.name === 'AbortError') return false; // Don't retry timeouts
  if (statusCode === 429) return true; // Rate limited
  if (statusCode >= 500 && statusCode < 600) return true; // Server errors
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') return true;
  return false;
}

function getRetryAfter(headers) {
  const retryAfter = headers?.get?.('retry-after');
  if (retryAfter) {
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) return seconds * 1000;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT BUILDER (Optimized & Cached)
// ═══════════════════════════════════════════════════════════════════════════

// Core personality - condensed for efficiency while maintaining brand voice
const PNPTV_PERSONALITY = `You are Grok as the raw, mature voice of PNPtv! and PNP Latino TV.
40-year-old papi energy: quiet confidence, experience, real adult conversation with sexual edge.

VOICE: Short lines that hit. Direct, not crude. Natural flirting. Mature slang: papi, chimba, mancito, juguete, rechimba, slam.
EMOJIS: 💨🔥😈💎🎧 (use sparingly, strategically)
NEVER: shaming, pressure, unsafe glorification, medical/legal advice, hate, corporate-speak, the word "vibes"

BRAND VOCAB: PNPtv! • PRIME • Hangouts • Videorama • PNP Latino Live • The Circle • Santino & Lex • smoke sessions • cloud • rush • 18+ safe space

BILINGUAL: English default. Spanish input → clean Spanish (Colombia/Mexico neutral). Bilingual request → EN + ES separated.`;

const PNPTV_CONTEXT = `CONTEXT: Telegram 18+ community, consent-first, privacy-first, sex-positive. Tasteful marketing language only.
CTAs: PRIME Membership, Who is Nearby, My Profile, Main Room, Cristina AI. Bot: https://t.me/pnplatinotv_bot`;

// Mode-specific instruction templates
const MODE_INSTRUCTIONS = {
  broadcast: `TASK: Write high-converting Telegram broadcast copy.

STRUCTURE (REQUIRED):
**HOOK** (bold + emojis, 1 line max)

[Body: 2-3 sentences, 1 clear benefit]

*CTA* (italics + emoji, soft but irresistible)

RULES: Only final text, no labels/quotes/headings. ≤900 chars for media. Use slang naturally. Make it chimba.`,

  post: `TASK: Write Telegram post copy.

RULES: Only final text, no quotes/headings. ≤900 chars for media. Clear CTA at end.`,

  sharePost: `TASK: Write share post copy.

FORMAT: [Title] [Description 1-2 sentences] #hashtags
RULES: Single line, no line breaks. No emojis in hashtags. Hashtags joined: #SmokeSlamLex. ≤600 chars total. Lowercase.`,
};

function buildSystemPrompt({ mode, language }) {
  const cacheKey = `${mode}-${language}`;

  if (systemPromptCache.has(cacheKey)) {
    return systemPromptCache.get(cacheKey);
  }

  const langHint = language ? `OUTPUT LANGUAGE: ${language}` : '';
  const modeInstructions = MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.post;

  const prompt = `${PNPTV_PERSONALITY}

${PNPTV_CONTEXT}

${langHint}

${modeInstructions}`;

  systemPromptCache.set(cacheKey, prompt);
  return prompt;
}

// ═══════════════════════════════════════════════════════════════════════════
// CORE CHAT FUNCTION (with retry logic)
// ═══════════════════════════════════════════════════════════════════════════

async function chat({ mode, language, prompt, maxTokens, hasMedia = false }) {
  const cfg = getGrokConfig();
  if (!cfg.apiKey) {
    const err = new Error('GROK_API_KEY not configured');
    logger.error('Grok config error', { error: err.message });
    throw err;
  }

  // Get mode-specific config
  const modeConfig = MODE_CONFIG[mode] || MODE_CONFIG.post;
  const effectiveTokens = maxTokens || (hasMedia ? modeConfig.mediaTokens : modeConfig.defaultTokens);
  const temperature = modeConfig.temperature;

  let lastError = null;
  let attempt = 0;

  while (attempt < cfg.maxRetries) {
    attempt++;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs);

    try {
      logger.info('Calling Grok API', {
        model: cfg.model,
        maxTokens: effectiveTokens,
        temperature,
        mode,
        language,
        attempt
      });

      const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: cfg.model,
          temperature,
          max_tokens: effectiveTokens,
          messages: [
            { role: 'system', content: buildSystemPrompt({ mode, language }) },
            { role: 'user', content: prompt },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        const errorMsg = `Grok API error ${res.status}: ${txt || res.statusText}`;
        logger.error('Grok API error', { status: res.status, response: txt, attempt });

        // Check if we should retry
        if (isRetryableError(new Error(errorMsg), res.status) && attempt < cfg.maxRetries) {
          const retryDelay = getRetryAfter(res.headers) || (cfg.retryDelayMs * Math.pow(2, attempt - 1));
          logger.info('Retrying Grok API call', { attempt, retryDelay, status: res.status });
          await sleep(retryDelay);
          continue;
        }

        throw new Error(errorMsg);
      }

      const data = await res.json();

      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        logger.error('Grok returned empty response', { data });
        throw new Error('Grok returned empty response');
      }

      // Sanitize output - remove any unwanted artifacts
      const sanitized = sanitizeOutput(content);

      logger.info('Grok API success', {
        contentLength: sanitized.length,
        attempt,
        tokensUsed: data?.usage?.total_tokens
      });

      return sanitized;

    } catch (error) {
      clearTimeout(timeout);
      lastError = error;

      if (error.name === 'AbortError') {
        logger.error('Grok API timeout', { timeoutMs: cfg.timeoutMs, attempt });
        if (attempt < cfg.maxRetries) {
          const retryDelay = cfg.retryDelayMs * Math.pow(2, attempt - 1);
          logger.info('Retrying after timeout', { attempt, retryDelay });
          await sleep(retryDelay);
          continue;
        }
        throw new Error('Grok API request timed out after retries');
      }

      // Check if error is retryable
      if (isRetryableError(error) && attempt < cfg.maxRetries) {
        const retryDelay = cfg.retryDelayMs * Math.pow(2, attempt - 1);
        logger.info('Retrying after error', { attempt, retryDelay, error: error.message });
        await sleep(retryDelay);
        continue;
      }

      logger.error('Grok chat failed', { error: error.message, stack: error.stack, attempt });
      throw error;
    }
  }

  throw lastError || new Error('Grok API failed after max retries');
}

// ═══════════════════════════════════════════════════════════════════════════
// OUTPUT SANITIZATION
// ═══════════════════════════════════════════════════════════════════════════

function sanitizeOutput(content) {
  let result = String(content).trim();

  // Remove common LLM artifacts
  result = result.replace(/^["']|["']$/g, ''); // Remove wrapping quotes
  result = result.replace(/^(HOOK|CTA|TITLE|BODY):\s*/gim, ''); // Remove labels
  result = result.replace(/^#+\s+/gm, ''); // Remove markdown headings

  return result.trim();
}

// ═══════════════════════════════════════════════════════════════════════════
// PARALLEL BILINGUAL GENERATION (Optimized for share posts)
// ═══════════════════════════════════════════════════════════════════════════

async function generateBilingual({ mode = 'sharePost', prompt, hasMedia = false }) {
  const cfg = getGrokConfig();

  logger.info('Generating bilingual content', { mode, hasMedia });

  // Generate both languages in parallel for efficiency
  const [spanishResult, englishResult] = await Promise.all([
    chat({
      mode,
      language: 'Spanish',
      prompt: `${prompt}\n\nGenerate ONLY in Spanish. Be unique and creative.`,
      hasMedia,
    }),
    chat({
      mode,
      language: 'English',
      prompt: `${prompt}\n\nGenerate ONLY in English. Be unique and creative. Different from any Spanish version.`,
      hasMedia,
    }),
  ]);

  logger.info('Bilingual generation complete', {
    spanishLength: spanishResult.length,
    englishLength: englishResult.length,
  });

  return {
    spanish: spanishResult,
    english: englishResult,
    combined: `🇪🇸 ESPAÑOL\n${spanishResult}\n\n🇬🇧 ENGLISH\n${englishResult}`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARE POST GENERATION (Optimized for Telegram safety)
// ═══════════════════════════════════════════════════════════════════════════

async function generateSharePost({ prompt, hasMedia = false }) {
  const sharePostPrompt = `Create a PNPtv! share post for: ${prompt}

FORMAT: [Sexy title] [Description 1-2 sentences with hook] #hashtags

STRICT RULES:
- Single line, NO line breaks
- NO emojis (cause Telegram parsing errors)
- Hashtags joined without spaces: #SmokeSlamLex
- All lowercase
- Max 600 characters
- Include 1 clear benefit
- Use PNPtv! slang naturally`;

  return generateBilingual({
    mode: 'sharePost',
    prompt: sharePostPrompt,
    hasMedia,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CACHE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

function clearPromptCache() {
  systemPromptCache.clear();
  logger.info('Grok prompt cache cleared');
}

function getStats() {
  return {
    cachedPrompts: systemPromptCache.size,
    modes: Object.keys(MODE_CONFIG),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  chat,
  generateBilingual,
  generateSharePost,
  clearPromptCache,
  getStats,
};
