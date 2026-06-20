// Latency measurement harness for TASK-017 (Objective B).
// Artifact only — NOT shipped product code. Run with:
//   node --env-file=.env.local docs/tasks/artifacts/TASK-017-doubao-svg-model/measure-latency.mjs [provider] [runs]
// provider: "doubao" | "deepseek" | "both" (default both)
// runs: number of sequential calls per provider (default 3)
//
// Loads .env.local via Node's --env-file. Reads the *current* COMBINED_SYS
// prompt by dynamically importing the TypeScript source through a tiny inline
// transpile shim. Never logs env values.

import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const PROVIDER = process.argv[2] || 'both';
const RUNS = parseInt(process.argv[3] || '3', 10);

// ---------- Inline transpile so we can `import` the prompts.ts verbatim ----------
// tsx is not installed (no new deps allowed), so use Node's built-in --experimental-strip-types
// fallback by reading the .ts source and stripping the trivial `export` keyword.

async function loadCombinedSys() {
  const src = await readFile('./lib/ai/prompts.ts', 'utf8');
  // Quick-and-dirty strip: turn `export const COMBINED_SYS =` into `const COMBINED_SYS =`
  // and `export const INK =` likewise. Wrap in an IIFE that returns COMBINED_SYS.
  const stripped = src
    .replace(/export\s+const\s+COMBINED_SYS\s*=/, 'const COMBINED_SYS =')
    .replace(/export\s+const\s+INK\s*=/, 'const INK =');
  // Drop the other exports (TEXT_SYS, SVG_SYS, HINT_SYS, HINT_SYS_EN, SCENE_SYS)
  // by stripping their `export` keyword too — they're still valid as plain consts.
  const allStripped = stripped.replace(/export\s+const\s+/g, 'const ');
  const dataUrl = 'data:text/javascript;base64,' + Buffer.from(allStripped + '\nexport { COMBINED_SYS };\n').toString('base64');
  const mod = await import(dataUrl);
  return mod.COMBINED_SYS;
}

// ---------- Call shape mirrors lib/ai/doubao.ts exactly ----------

async function callDoubao(systemPrompt, userMessage, timeoutMs = 30_000) {
  const apiKey = process.env.DOUBAO_API_KEY;
  const baseUrl = process.env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
  const model = process.env.DOUBAO_MODEL;
  if (!apiKey) throw new Error('DOUBAO_API_KEY not set');
  if (!model) throw new Error('DOUBAO_MODEL not set');
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        // Volcano Ark honours `max_completion_tokens`, not the legacy
        // `max_tokens` (which it silently ignores). Mirrors lib/ai/doubao.ts.
        max_completion_tokens: 1500,
        temperature: 0.75,
        response_format: { type: 'json_object' },
      }),
      signal: abort.signal,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`Doubao HTTP ${res.status}: ${t.slice(0, 150)}`);
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Doubao empty content');
    return { content, usage: data.usage };
  } finally {
    clearTimeout(timer);
  }
}

async function callDeepseek(systemPrompt, userMessage, timeoutMs = 30_000) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  const model = 'deepseek-v4-flash';
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY not set');
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
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
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`DeepSeek HTTP ${res.status}: ${t.slice(0, 150)}`);
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('DeepSeek empty content');
    return { content, usage: data.usage };
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Runner ----------

const USER_MSG =
  '目前的故事：\n\n' +
  '最新这一句是宝宝说的：一只小恐龙在花园里散步';

function fmt(ms) { return `${ms.toFixed(0)}ms`; }

function stats(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const median = sorted[Math.floor(sorted.length / 2)];
  const mean = arr.reduce((s, x) => s + x, 0) / arr.length;
  return { min, median, max, mean, n: arr.length };
}

async function runProvider(name, fn) {
  const sys = await loadCombinedSys();
  const promptChars = sys.length;
  console.log(`\n=== ${name} === (system prompt: ${promptChars} chars, ${RUNS} runs)`);
  const times = [];
  const completionTokens = [];
  const promptTokens = [];
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    try {
      const { usage } = await fn(sys, USER_MSG);
      const dt = performance.now() - t0;
      times.push(dt);
      if (usage) {
        completionTokens.push(usage.completion_tokens);
        promptTokens.push(usage.prompt_tokens);
      }
      console.log(`  run ${i + 1}: ${fmt(dt)}  (prompt_tokens=${usage?.prompt_tokens ?? '?'}, completion_tokens=${usage?.completion_tokens ?? '?'})`);
    } catch (e) {
      const dt = performance.now() - t0;
      console.log(`  run ${i + 1}: FAIL after ${fmt(dt)} — ${e.message}`);
    }
  }
  if (times.length === 0) {
    console.log('  (no successful runs)');
    return null;
  }
  const s = stats(times);
  console.log(`  -> min=${fmt(s.min)}  median=${fmt(s.median)}  mean=${fmt(s.mean)}  max=${fmt(s.max)}`);
  if (completionTokens.length) {
    const ct = stats(completionTokens);
    const pt = stats(promptTokens);
    console.log(`  -> prompt_tokens median=${pt.median}  completion_tokens median=${ct.median} (min=${ct.min}, max=${ct.max})`);
  }
  return { name, ...s, promptChars, promptTokensMedian: promptTokens.length ? stats(promptTokens).median : null, completionTokensMedian: completionTokens.length ? stats(completionTokens).median : null };
}

const results = [];
if (PROVIDER === 'doubao' || PROVIDER === 'both') {
  if (process.env.DOUBAO_API_KEY) {
    results.push(await runProvider('Doubao', callDoubao));
  } else {
    console.log('\n(Doubao skipped: DOUBAO_API_KEY not set)');
  }
}
if (PROVIDER === 'deepseek' || PROVIDER === 'both') {
  if (process.env.DEEPSEEK_API_KEY) {
    results.push(await runProvider('DeepSeek', callDeepseek));
  } else {
    console.log('\n(DeepSeek skipped: DEEPSEEK_API_KEY not set)');
  }
}

console.log('\n=== Summary ===');
for (const r of results) {
  if (!r) continue;
  console.log(`${r.name}: median=${fmt(r.median)} mean=${fmt(r.mean)} prompt_chars=${r.promptChars} prompt_tokens≈${r.promptTokensMedian} completion_tokens≈${r.completionTokensMedian}`);
}
