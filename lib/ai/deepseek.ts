import { NoApiKeyError } from '@/lib/ai/errors';

export { NoApiKeyError };

const BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
const MODEL = 'deepseek-chat'; // V3 — bakeoff 2026-06-20 实测 0.1-0.5s（含 prompt cache）
const FETCH_TIMEOUT_MS = 30_000;

export async function generateStoryFrame(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new NoApiKeyError();
  }

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 2000,
        temperature: 0.75,
        response_format: { type: 'json_object' },
      }),
      signal: abort.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`DeepSeek API error ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('DeepSeek returned empty response');
    }

    return content;
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error(`DeepSeek request timed out after ${FETCH_TIMEOUT_MS / 1000}s`);
    }
    throw e;
  }
}
