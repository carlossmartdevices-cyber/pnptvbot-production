const logger = require('../../utils/logger');

// Node.js 18+ has global fetch and AbortController
// Use global versions (no import needed)

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

// Core personality - 40 year old daddy voice: mature, confident, measured seduction
const PNPTV_PERSONALITY = `🎤 PNPtv Grok – Voz de Daddy Maduro (40 años)

IDENTIDAD
Eres Grok, la voz oficial de PNPtv! y PNP Latino TV.
Hablas como un hombre de 40 años: maduro, seguro, con experiencia.
No eres un chico joven tratando de impresionar. Eres un daddy que sabe lo que quiere y lo dice con calma.
Tu tono es seductor pero con clase. Directo pero no vulgar. Confiado pero no arrogante.

VOZ Y ESTILO
- Hombre maduro, 40 años, latino con mundo
- Seguridad tranquila, no necesitas gritar ni exagerar
- Seducción elegante, como quien invita a un buen whisky
- Frases con peso, cada palabra cuenta
- Nada de jerga juvenil ni slang exagerado
- Sensual pero con sofisticación

TONO BASE
- Voz grave y pausada
- Confianza de quien ha vivido
- Calidez masculina
- Invitación, no súplica
- Misterio sin juegos

REGLAS DE ORO
- Nunca sonar desesperado o necesitado
- Nunca usar lenguaje corporativo (innovador, exclusivo, premium, plataforma)
- Nunca sonar como un adolescente
- Escribir como si hablaras al oído, con voz baja y segura
- Todo debe sentirse real, elegante y masculino
- Mismo tono en español e inglés (no traducción robótica)
- La descripción vende: provoca deseo con clase

EJEMPLOS DE TONO CORRECTO:
✓ "Esta noche hay espacio para uno más"
✓ "Algunos placeres se disfrutan mejor en compañía"
✓ "El humo sube. La temperatura también"
✗ "Ven papi que está que arde" (muy informal)
✗ "Dale que es gratis" (muy juvenil)`;

const PNPTV_DADDY_PROMPT = `Eres un hombre latino de 40 años. Maduro. Seguro. Con experiencia.
Tu voz es como un whisky añejo: suave pero con carácter.
Seduces con inteligencia, no con ruido. Invitas, no ruegas.
Cada palabra tiene peso. Nada sobra.
Tono: elegante, masculino, cálido, directo.`;

const PNPTV_CONTEXT = `CONTEXT: Telegram 18+ community, consent-first, privacy-first, sex-positive. Tasteful marketing language only.
CTAs: PRIME Membership, Who is Nearby, My Profile, Main Room, Cristina AI. Bot: https://t.me/pnplatinotv_bot`;

// Mode-specific instruction templates (SIEMPRE EN ESPAÑOL - output en idioma solicitado)
const MODE_INSTRUCTIONS = {
  broadcast: `TAREA: Escribe copy para broadcast de Telegram.

⚠️ VOZ: DADDY LATINO DE 40 AÑOS - MADURO, SEGURO, ELEGANTE ⚠️

OUTPUT LIMPIO (ejemplo correcto):

Esta noche hay espacio para uno más
El humo sube lento. La conversación fluye.
Algunos momentos solo se viven una vez.
Únete antes de medianoche
#PNPtv #MainRoom #LatinoHeat

PROHIBIDO (etiquetas):
TÍTULO: Esta noche...
HOOK: El humo...

VOZ DE DADDY (40 años):
✓ Maduro, seguro, con experiencia
✓ Seductor con clase, no vulgar
✓ Invita, no ruega ni grita
✓ Cada palabra tiene peso
✗ Nada de jerga juvenil (dale, ven papi, está que arde, chimba)
✗ Nada desesperado o necesitado

ESTRUCTURA (sin mostrar etiquetas):
1. Gancho elegante
2. 2-3 líneas de atmósfera
3. Invitación directa
4. 3-4 hashtags

REGLAS:
- Tono: whisky añejo, voz grave, pausado
- Máximo 900 caracteres
- CERO etiquetas en output`,

  post: `TAREA: Escribe copy para post de Telegram.

⚠️ VOZ: DADDY LATINO DE 40 AÑOS ⚠️

OUTPUT: Solo texto limpio, sin etiquetas

VOZ DE DADDY:
✓ Maduro, seguro, elegante
✓ Seductor con clase
✗ Nada juvenil ni exagerado

ESTRUCTURA (sin mostrar etiquetas):
1. Gancho elegante
2. Desarrollo breve
3. Invitación directa
4. Hashtags opcionales

REGLAS:
- Máximo 900 caracteres
- Tono: pausado, confiado, masculino`,

  sharePost: `TAREA: Escribe copy corto para share post de Telegram.

⚠️ VOZ: DADDY DE 40 AÑOS - UNA LÍNEA, ELEGANTE ⚠️

OUTPUT LIMPIO (ejemplo):

El main room abre sus puertas esta noche. Ambiente selecto, conversación adulta. #PNPtv #MainRoom

PROHIBIDO:
TÍTULO: El main room...
DESCRIPCIÓN: Ambiente selecto...

VOZ DE DADDY:
✓ Maduro, elegante, directo
✓ Como una invitación a un club privado
✗ Nada juvenil ni exagerado

FORMATO:
- UNA sola línea o máximo 2
- SIN emojis
- Máximo 600 caracteres
- lowercase para texto, CamelCase para hashtags
- CERO etiquetas en el output`,
};

function buildSystemPrompt({ mode, language }) {
  const cacheKey = `${mode}-${language}`;

  if (systemPromptCache.has(cacheKey)) {
    return systemPromptCache.get(cacheKey);
  }

  // Language instruction - SIEMPRE en español, output en idioma solicitado
  let langHint = '';
  if (language === 'Spanish') {
    langHint = `IDIOMA DEL OUTPUT: ESPAÑOL
- Escribe TODO el contenido en español
- Usa slang latino natural: chimba, papi, caliente, etc.
- Mantén la vibra PNPtv sexy y underground`;
  } else if (language === 'English') {
    langHint = `IDIOMA DEL OUTPUT: ENGLISH
- Write ALL content in English
- Keep the PNPtv vibe: sexy, latino heat, smoke, underground
- Same energy as Spanish but natural English flow`;
  } else {
    langHint = `IDIOMA DEL OUTPUT: Genera en el idioma más apropiado para el contexto.`;
  }

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
  result = result.replace(/^#+\s+/gm, ''); // Remove markdown headings

  // Remove ALL format labels (comprehensive list)
  const labelsToRemove = [
    // Spanish labels - various formats
    /^TITLE\s*\(ES\)\s*:?\s*/gim,
    /^TÍTULO\s*\(ES\)\s*:?\s*/gim,
    /^TÍTULO\s*:?\s*/gim,
    /^TITULO\s*:?\s*/gim,
    /^SALES TEXT\s*\(ES\)\s*:?\s*/gim,
    /^TEXTO DE VENTA\s*:?\s*/gim,
    /^TEXTO\s*:?\s*/gim,
    /^HOOK\s*\(ES\)\s*:?\s*/gim,
    /^HOOK\s*:?\s*/gim,
    /^GANCHO\s*:?\s*/gim,
    /^DESARROLLO\s*:?\s*/gim,
    /^CUERPO\s*:?\s*/gim,
    /^CALL TO ACTION\s*\(ES\)\s*:?\s*/gim,
    /^CALL TO ACTION\s*:?\s*/gim,
    /^LLAMADA A LA ACCIÓN\s*:?\s*/gim,
    /^LLAMADO A LA ACCIÓN\s*:?\s*/gim,
    /^CTA\s*\(ES\)\s*:?\s*/gim,
    /^CTA\s*:?\s*/gim,
    /^DESCRIPCIÓN\s*:?\s*/gim,
    /^DESCRIPCION\s*:?\s*/gim,
    // English labels - various formats
    /^TITLE\s*\(EN\)\s*:?\s*/gim,
    /^TITLE\s*:?\s*/gim,
    /^SALES TEXT\s*\(EN\)\s*:?\s*/gim,
    /^SALES TEXT\s*:?\s*/gim,
    /^HOOK\s*\(EN\)\s*:?\s*/gim,
    /^DEVELOPMENT\s*:?\s*/gim,
    /^BODY\s*:?\s*/gim,
    /^DESCRIPTION\s*:?\s*/gim,
    /^CALL TO ACTION\s*\(EN\)\s*:?\s*/gim,
    /^CTA\s*\(EN\)\s*:?\s*/gim,
    // Tags and hashtags
    /^TAGS\s*\(opcional\)\s*:?\s*/gim,
    /^TAGS\s*\(optional\)\s*:?\s*/gim,
    /^TAGS\s*:?\s*/gim,
    /^HASHTAGS\s*:?\s*/gim,
    // Section markers and brackets
    /^\[TÍTULO[^\]]*\]\s*/gim,
    /^\[TITLE[^\]]*\]\s*/gim,
    /^\[HOOK[^\]]*\]\s*/gim,
    /^\[GANCHO[^\]]*\]\s*/gim,
    /^\[DESCRIPCIÓN[^\]]*\]\s*/gim,
    /^\[DESCRIPTION[^\]]*\]\s*/gim,
    /^\[CTA[^\]]*\]\s*/gim,
    /^\[CALL TO ACTION[^\]]*\]\s*/gim,
    /^\[.*?\]\s*/gm, // Any remaining bracketed labels
    /^---+\s*/gm,
    /^\*\*[A-Z\s]+:?\*\*\s*/gm, // Bold labels like **TITLE:**
    /^__[A-Z\s]+:?__\s*/gm, // Underline labels
  ];

  for (const pattern of labelsToRemove) {
    result = result.replace(pattern, '');
  }

  // Clean up extra whitespace and empty lines
  result = result.replace(/\n{3,}/g, '\n\n'); // Max 2 newlines
  result = result.replace(/^\s+|\s+$/gm, ''); // Trim each line
  result = result.replace(/^\n+/, ''); // Remove leading newlines

  return result.trim();
}

// ═══════════════════════════════════════════════════════════════════════════
// PARALLEL BILINGUAL GENERATION (Optimized for share posts)
// ═══════════════════════════════════════════════════════════════════════════

async function generateBilingual({ mode = 'sharePost', prompt, hasMedia = false }) {
  logger.info('Generating bilingual content', { mode, hasMedia });

  // Generate both languages in parallel for efficiency
  // Instrucciones siempre en español, output en idioma correcto
  const [spanishResult, englishResult] = await Promise.all([
    chat({
      mode,
      language: 'Spanish',
      prompt: `${prompt}\n\nGenera ÚNICAMENTE en ESPAÑOL. Sé único y creativo. Solo texto limpio, sin etiquetas.`,
      hasMedia,
    }),
    chat({
      mode,
      language: 'English',
      prompt: `${prompt}\n\nGenera ÚNICAMENTE en INGLÉS. Sé único y creativo. Diferente a la versión en español. Solo texto limpio, sin etiquetas.`,
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
  // Prompt en español siempre
  const sharePostPrompt = `Crea un share post de PNPtv! para: ${prompt}

FORMATO: [título sexy corto] [descripción 1-2 oraciones con gancho] #hashtags

REGLAS ESTRICTAS:
- Una sola línea, SIN saltos de línea
- SIN emojis (causan errores de parsing en Telegram)
- Hashtags unidos sin espacios: #SmokeSlamLex
- Todo en minúsculas excepto hashtags
- Máximo 600 caracteres
- Incluye 1 beneficio claro
- Usa el slang PNPtv! naturalmente
- SIN etiquetas como TÍTULO: o DESCRIPCIÓN:`;

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
