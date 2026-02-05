/* eslint-disable no-console */
require('dotenv').config();

const { fetch, AbortController } = global;

const apiKey = process.env.GROK_API_KEY;
const baseUrl = process.env.GROK_BASE_URL || 'https://api.x.ai/v1';
const model = process.env.GROK_MODEL || 'grok-2-latest';
const timeoutMs = Number(process.env.GROK_TIMEOUT_MS || 15000);

if (!apiKey) {
  console.error('GROK_API_KEY not set');
  process.exit(1);
}

if (!fetch || !AbortController) {
  console.error('This script requires Node.js 18+ (global fetch/AbortController).');
  process.exit(1);
}

(async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 1,
        messages: [
          { role: 'system', content: 'You are a health check. Reply with OK.' },
          { role: 'user', content: 'OK?' },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error(`Grok health check failed (${res.status})`, txt.slice(0, 300));
      process.exit(1);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    const preview = typeof content === 'string' ? content.trim().slice(0, 60) : '';

    console.log('Grok health check OK', { model, baseUrl, preview });
    process.exit(0);
  } catch (error) {
    if (error?.name === 'AbortError') {
      console.error(`Grok health check timed out after ${timeoutMs}ms`);
      process.exit(1);
    }
    console.error('Grok health check error', error?.message || error);
    process.exit(1);
  } finally {
    clearTimeout(timeout);
  }
})();
