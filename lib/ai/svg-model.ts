import { SVG_SYS } from './prompts';

const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
const FETCH_TIMEOUT_MS = 25_000;

export class NoAnthropicKeyError extends Error {
  constructor() {
    super('ANTHROPIC_API_KEY is not set');
    this.name = 'NoAnthropicKeyError';
  }
}

export function extractSvg(raw: string): string {
  const stripped = raw.replace(/```(?:svg)?\n?/gi, '').trim();
  const match = stripped.match(/<svg[\s\S]*?<\/svg>/i);
  return match ? match[0] : '';
}

export async function generateSvg(
  narration: string,
  storySummary: string,
  drawingPrompt?: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new NoAnthropicKeyError();
  }

  const systemPrompt = drawingPrompt
    ? `${SVG_SYS}\n\n${drawingPrompt}`
    : SVG_SYS;

  const userContent = `Narration: ${narration}\n\nStory Summary: ${storySummary}`;

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${ANTHROPIC_BASE_URL}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userContent },
        ],
      }),
      signal: abort.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Anthropic API error ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    const content = data.content?.[0]?.text;
    if (!content || !content.trim()) {
      throw new Error('Anthropic returned empty response');
    }

    return content;
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error(`Anthropic request timed out after ${FETCH_TIMEOUT_MS / 1000}s`);
    }
    throw e;
  }
}
