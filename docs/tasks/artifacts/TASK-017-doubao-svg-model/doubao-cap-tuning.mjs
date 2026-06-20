// Find optimal max_completion_tokens cap for Doubao (latency vs completeness).
// Artifact only — NOT shipped.
import { readFile } from 'node:fs/promises';
async function loadCombinedSys() {
  const src = await readFile('./lib/ai/prompts.ts', 'utf8');
  const stripped = src.replace(/export\s+const\s+/g, 'const ');
  const dataUrl = 'data:text/javascript;base64,' + Buffer.from(stripped + '\nexport { COMBINED_SYS };\n').toString('base64');
  return (await import(dataUrl)).COMBINED_SYS;
}

async function probe(cap) {
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
        max_completion_tokens: cap,
      }),
      signal: abort.signal,
    });
    const dt = performance.now() - t0;
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    const finish = data.choices?.[0]?.finish_reason;
    // Check if SVG looks complete
    const hasSvgOpen = content.includes('<svg');
    const hasSvgClose = content.includes('</svg>');
    const svgComplete = hasSvgOpen && hasSvgClose;
    const completionTokens = data.usage?.completion_tokens;
    console.log(`cap=${String(cap).padStart(5)} -> ${dt.toFixed(0).padStart(7)}ms finish=${finish} tokens=${completionTokens} svgComplete=${svgComplete}`);
    if (!svgComplete) {
      console.log(`   tail: ...${content.slice(-150)}`);
    }
    return { cap, dt, finish, completionTokens, svgComplete, content };
  } catch (e) {
    const dt = performance.now() - t0;
    console.log(`cap=${String(cap).padStart(5)} -> ERR after ${dt.toFixed(0)}ms: ${e.message}`);
  } finally {
    clearTimeout(timer);
  }
}

console.log('Tuning max_completion_tokens (each call is sequential)...');
const results = [];
for (const cap of [1000, 1200, 1400, 1600, 2000]) {
  const r = await probe(cap);
  if (r) results.push(r);
}

console.log('\n=== Summary ===');
console.log('cap     latency   tokens  finish   svgComplete');
for (const r of results) {
  console.log(`${String(r.cap).padStart(5)}  ${r.dt.toFixed(0).padStart(6)}ms  ${String(r.completionTokens).padStart(4)}  ${r.finish}  ${r.svgComplete}`);
}

// Save one full good response as a sample SVG artifact
const good = results.find(r => r.svgComplete && r.finish === 'stop');
if (good) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync('docs/tasks/artifacts/TASK-017-doubao-svg-model/doubao-sample-response.json', good.content);
  console.log(`\nSaved sample complete response (cap=${good.cap}) to doubao-sample-response.json`);
}
