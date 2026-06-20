import { NoApiKeyError } from '@/lib/ai/errors';

export { NoApiKeyError };

const BASE_URL = process.env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
const FETCH_TIMEOUT_MS = 30_000;
// Volcano Ark (and newer OpenAI APIs) honour `max_completion_tokens`, not the
// legacy `max_tokens`. The legacy name is silently ignored by Doubao-pro, so
// the model would otherwise generate unbounded output (~2000+ tokens, 40-90s).
// 1500 caps generation at ~31s worst-case measured, fitting within the route's
// 30s `maxDuration` after subtracting network prefill.
const MAX_COMPLETION_TOKENS = 1500;

export async function generateStoryFrame(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const apiKey = process.env.DOUBAO_API_KEY;
  if (!apiKey) {
    throw new NoApiKeyError();
  }

  const model = process.env.DOUBAO_MODEL;
  if (!model) {
    throw new Error('DOUBAO_MODEL (endpoint id) is not set');
  }

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_completion_tokens: MAX_COMPLETION_TOKENS,
        temperature: 0.75,
        response_format: { type: 'json_object' },
      }),
      signal: abort.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Doubao API error ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Doubao returned empty response');
    }

    return content;
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error(`Doubao request timed out after ${FETCH_TIMEOUT_MS / 1000}s`);
    }
    throw e;
  }
}
