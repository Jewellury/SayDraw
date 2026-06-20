// Phase 5 final Doubao probe: 60s timeout to characterize full latency.
import { readFile } from 'node:fs/promises';
async function loadCombinedSys() {
  const src = await readFile('./lib/ai/prompts.ts', 'utf8');
  const stripped = src.replace(/export\s+const\s+/g, 'const ');
  const dataUrl = 'data:text/javascript;base64,' + Buffer.from(stripped + '\nexport { COMBINED_SYS };\n').toString('base64');
  return (await import(dataUrl)).COMBINED_SYS;
}

async function probe(label, bodyExtra, timeoutMs = 60_000) {
  const apiKey = process.env.DOUBAO_API_KEY;
  const baseUrl = process.env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
  const model = process.env.DOUBAO_MODEL;
  const sys = await loadCombinedSys();
  const userMsg = '目前的故事：\n\n最新这一句是宝宝说的：一只小恐龙在花园里散步';
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
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
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    const finish = data.choices?.[0]?.finish_reason;
    const svgComplete = content.includes('<svg') && content.includes('</svg>');
    console.log(`[${label}] ${dt.toFixed(0)}ms finish=${finish} prompt_tokens=${data.usage?.prompt_tokens} completion_tokens=${data.usage?.completion_tokens} svgComplete=${svgComplete}`);
    return { content, dt, finish, completionTokens: data.usage?.completion_tokens, svgComplete };
  } catch (e) {
    const dt = performance.now() - t0;
    console.log(`[${label}] ERR after ${dt.toFixed(0)}ms: ${e.message}`);
  } finally {
    clearTimeout(timer);
  }
}

console.log('Doubao latency characterization with new prompt (few-shot + 8-14 rule):');
console.log('(timeout=60s to capture full behavior)\n');
const r = await probe('max_completion_tokens=1500', { max_completion_tokens: 1500 });
if (r && r.svgComplete) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync('docs/tasks/artifacts/TASK-017-doubao-svg-model/doubao-post-trim-sample.json', r.content);
  console.log(`Saved complete sample (latency=${r.dt.toFixed(0)}ms, tokens=${r.completionTokens})`);
}
