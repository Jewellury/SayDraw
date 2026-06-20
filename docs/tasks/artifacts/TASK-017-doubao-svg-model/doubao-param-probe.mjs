// Probe whether Doubao honors a different param name for output cap.
// Artifact only — NOT shipped.
import { readFile } from 'node:fs/promises';
async function loadCombinedSys() {
  const src = await readFile('./lib/ai/prompts.ts', 'utf8');
  const stripped = src.replace(/export\s+const\s+/g, 'const ');
  const dataUrl = 'data:text/javascript;base64,' + Buffer.from(stripped + '\nexport { COMBINED_SYS };\n').toString('base64');
  return (await import(dataUrl)).COMBINED_SYS;
}

async function probe(label, bodyExtra) {
  const apiKey = process.env.DOUBAO_API_KEY;
  const baseUrl = process.env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
  const model = process.env.DOUBAO_MODEL;
  const sys = await loadCombinedSys();
  const userMsg = '目前的故事：\n\n最新这一句是宝宝说的：一只小恐龙在花园里散步';
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 60_000);
  const t0 = performance.now();
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.75,
        response_format: { type: 'json_object' },
        ...bodyExtra,
      }),
      signal: abort.signal,
    });
    const dt = performance.now() - t0;
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      console.log(`[${label}] HTTP ${res.status} in ${dt.toFixed(0)}ms: ${t.slice(0, 200)}`);
      return;
    }
    const data = await res.json();
    const finish = data.choices?.[0]?.finish_reason;
    console.log(`[${label}] OK in ${dt.toFixed(0)}ms finish=${finish} prompt_tokens=${data.usage?.prompt_tokens} completion_tokens=${data.usage?.completion_tokens}`);
  } catch (e) {
    const dt = performance.now() - t0;
    console.log(`[${label}] ERR after ${dt.toFixed(0)}ms: ${e.message}`);
  } finally {
    clearTimeout(timer);
  }
}

console.log('Probing param-name variants for output-token cap...');
await probe('max_tokens-300',     { max_tokens: 300 });
await probe('max_output_tokens-300', { max_output_tokens: 300 });
await probe('max_completion_tokens-300', { max_completion_tokens: 300 });
