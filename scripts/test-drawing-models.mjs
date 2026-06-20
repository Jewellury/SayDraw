/**
 * SayDraw — 画图模型对比测试
 *
 * 让三个候选模型画同一幅图（"一只小猫坐在月亮上"），对比：
 *   - 延迟（ms）
 *   - SVG 合法性（能不能解析、元素数、是否 sanitize 安全）
 *   - 输出质量（你肉眼判断）
 *
 * 候选：
 *   1. 豆包 lite  (ep-20260619160218-5m76d, doubao-seed-2-0-lite)
 *   2. DeepSeek chat (deepseek-chat / V3)
 *   3. DeepSeek pro (deepseek-pro / deepseek-reasoner)
 *
 * 用法（项目根目录）：
 *   node scripts/test-drawing-models.mjs
 *
 * 输出：每个模型的 SVG 单独保存到 docs/tasks/artifacts/TASK-017-doubao-svg-model/drawing-bakeoff/
 * 你用浏览器打开 .html 文件看效果。
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';

// ---------- 读 env ----------
function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    if (line.trim().startsWith('#')) continue;
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?(.*?)"?\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const env = parseEnv(await readFile('.env.local', 'utf8'));

const DEEPSEEK_KEY = env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE = env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
const DOUBAO_KEY = env.DOUBAO_API_KEY;
const DOUBAO_BASE = env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
const DOUBAO_MODEL = env.DOUBAO_MODEL; // 应该是 ep-20260619160218-5m76d (LITE)

// 复用 SayDraw 真实 prompt（确保测试有效）
const { COMBINED_SYS, INK } = await import('./../lib/ai/prompts.ts')
  .catch(() => ({ COMBINED_SYS: null, INK: '#211e18' }));

// 如果 TS import 失败，回退到直接复制 prompt（保持测试独立）
const SYSTEM_PROMPT = COMBINED_SYS || `你是儿童绘本插画师。输出一个 JSON 对象：{"narration":"...","svg":"<svg viewBox=\\"0 0 400 300\\">...</svg>"}
SVG 规则：stroke="${INK}"，fill="none"，viewBox="0 0 400 300"，元素 8-14 个，主角 stroke-width="3"，细节 stroke-width="2"，背景 stroke-width="1.5"，禁止 fill 颜色/text 元素/彩色。只输出 JSON。`;

const USER_MESSAGE = '目前的故事：\n\n最新这一句是宝宝说的：一只小猫坐在月亮上';

// ---------- 模型配置 ----------
const models = [
  {
    name: '豆包 lite',
    short: 'doubao-lite',
    enabled: !!(DOUBAO_KEY && DOUBAO_MODEL),
    call: () => callOpenAICompatible({
      baseUrl: DOUBAO_BASE,
      path: '/chat/completions',
      apiKey: DOUBAO_KEY,
      model: DOUBAO_MODEL,
      // 火山方舟用 max_tokens 不是 max_completion_tokens
      maxTokensField: 'max_tokens',
    }),
  },
  {
    name: 'DeepSeek chat (V3)',
    short: 'deepseek-chat',
    enabled: !!DEEPSEEK_KEY,
    call: () => callOpenAICompatible({
      baseUrl: DEEPSEEK_BASE,
      path: '/v1/chat/completions',
      apiKey: DEEPSEEK_KEY,
      model: 'deepseek-chat',
      maxTokensField: 'max_tokens',
    }),
  },
  {
    name: 'DeepSeek pro (Reasoner)',
    short: 'deepseek-pro',
    enabled: !!DEEPSEEK_KEY,
    call: () => callOpenAICompatible({
      baseUrl: DEEPSEEK_BASE,
      path: '/v1/chat/completions',
      apiKey: DEEPSEEK_KEY,
      model: 'deepseek-reasoner',
      maxTokensField: 'max_tokens',
      // reasoner 模型不支持 response_format json_object
      noJsonMode: true,
    }),
  },
];

async function callOpenAICompatible({ baseUrl, path, apiKey, model, maxTokensField, noJsonMode }) {
  const body = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: USER_MESSAGE },
    ],
    [maxTokensField]: 1500,
    temperature: 0.75,
  };
  if (!noJsonMode) body.response_format = { type: 'json_object' };

  const start = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000); // 60s 上限（不限 Vercel 30s，测真实模型能力）

  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const elapsed = Date.now() - start;

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, elapsed, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return { ok: false, elapsed, error: 'empty response', raw: JSON.stringify(data).slice(0, 300) };
    }

    // 尝试解析 JSON 提取 SVG
    let svg = '';
    let narration = '';
    try {
      const o = JSON.parse(content);
      svg = o.svg || '';
      narration = o.narration || '';
    } catch {
      // 提取 markdown 里的 svg
      const m = content.match(/<svg[\s\S]*<\/svg>/);
      if (m) svg = m[0];
      narration = content.slice(0, 100);
    }

    return {
      ok: true,
      elapsed,
      svg,
      narration,
      raw: content,
      usage: data.usage,
    };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, elapsed: Date.now() - start, error: e.message };
  }
}

// ---------- SVG 质量分析 ----------
function analyzeSvg(svg) {
  if (!svg) return { valid: false, reason: 'no svg' };
  if (!svg.includes('<svg') || !svg.includes('</svg>')) {
    return { valid: false, reason: 'missing svg tags' };
  }
  const elementCount = (svg.match(/<(?:path|circle|rect|ellipse|line|polyline|polygon|g|defs|use)\b/g) || []).length;
  const hasColor = /stroke\s*=\s*["'](?!#211e18|#000|#fff|none|"')/i.test(svg) ||
                   /fill\s*=\s*["'](?!none|"')/i.test(svg);
  const hasScript = /<script/i.test(svg);
  const hasText = /<text\b/i.test(svg);
  const viewBoxMatch = svg.match(/viewBox\s*=\s*["']([^"']+)["']/);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : null;
  return {
    valid: true,
    elementCount,
    hasColor,
    hasScript,
    hasText,
    viewBox,
    size: svg.length,
  };
}

// ---------- 主流程 ----------
const OUT_DIR = 'docs/tasks/artifacts/TASK-017-doubao-svg-model/drawing-bakeoff';
if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true });

console.log('=== SayDraw 画图模型对比测试 ===');
console.log(`prompt 长度: ${SYSTEM_PROMPT.length} 字符`);
console.log(`测试场景: "${USER_MESSAGE.split('：').pop()}"`);
console.log('');

const results = [];

for (const model of models) {
  if (!model.enabled) {
    console.log(`[${model.name}] 跳过（缺 key 或 endpoint）`);
    results.push({ ...model, result: { ok: false, error: 'skipped (no key)', elapsed: 0 } });
    continue;
  }

  console.log(`[${model.name}] 调用中...`);
  const result = await model.call();
  console.log(`  耗时: ${(result.elapsed / 1000).toFixed(2)}s`);

  if (!result.ok) {
    console.log(`  ❌ 失败: ${result.error}`);
    if (result.raw) console.log(`  原始: ${result.raw}`);
    results.push({ ...model, result });
    console.log('');
    continue;
  }

  const analysis = analyzeSvg(result.svg);
  console.log(`  SVG: ${analysis.valid ? '✓ 合法' : '✗ ' + analysis.reason}`);
  if (analysis.valid) {
    console.log(`    元素数: ${analysis.elementCount}（目标 8-14）`);
    console.log(`    viewBox: ${analysis.viewBox}（目标 0 0 400 300）`);
    console.log(`    有彩色: ${analysis.hasColor ? '⚠️ 是' : '✓ 否'}`);
    console.log(`    有 script: ${analysis.hasScript ? '⚠️ 是' : '✓ 否'}`);
    console.log(`    有 text: ${analysis.hasText ? '⚠️ 是' : '✓ 否'}`);
    console.log(`    字节数: ${analysis.size}`);
  }
  if (result.usage) {
    console.log(`    tokens: ${result.usage.total_tokens} (prompt ${result.usage.prompt_tokens} + completion ${result.usage.completion_tokens})`);
  }

  // 保存 SVG 供肉眼检查
  if (result.svg) {
    const svgPath = `${OUT_DIR}/${model.short}.svg`;
    await writeFile(svgPath, result.svg, 'utf8');
    console.log(`  已保存: ${svgPath}`);
  }

  results.push({ ...model, result, analysis });
  console.log('');
}

// ---------- 生成对比 HTML ----------
const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>SayDraw 画图模型对比</title>
<style>
body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; padding: 20px; background: #fafaf7; }
h1 { color: #211e18; }
table { border-collapse: collapse; margin: 20px 0; }
th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
th { background: #211e18; color: white; }
.row { display: grid; grid-template-columns: repeat(${results.filter(r => r.result?.ok).length || 1}, 1fr); gap: 20px; margin: 30px 0; }
.frame { background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.frame h3 { margin: 0 0 10px; color: #211e18; }
.frame svg { width: 100%; height: auto; background: #fff; border: 1px solid #eee; }
.metric { font-size: 13px; color: #666; margin: 4px 0; }
.metric strong { color: #211e18; }
</style></head><body>
<h1>SayDraw 画图模型对比</h1>
<p>场景："一只小猫坐在月亮上" · 测试时间：${new Date().toISOString()}</p>

<table>
<tr><th>模型</th><th>耗时</th><th>SVG 合法</th><th>元素数</th><th>viewBox</th><th>无彩色</th><th>tokens</th></tr>
${results.map(r => {
  if (!r.result?.ok) {
    return `<tr><td>${r.name}</td><td colspan="6">❌ ${r.result?.error || 'skipped'}</td></tr>`;
  }
  const a = r.analysis;
  return `<tr>
    <td>${r.name}</td>
    <td><strong>${(r.result.elapsed / 1000).toFixed(2)}s</strong></td>
    <td>${a.valid ? '✓' : '✗'}</td>
    <td>${a.elementCount || '-'}</td>
    <td>${a.viewBox || '-'}</td>
    <td>${a.hasColor ? '⚠️' : '✓'}</td>
    <td>${r.result.usage?.total_tokens || '-'}</td>
  </tr>`;
}).join('')}
</table>

<h2>画面效果对比</h2>
<div class="row">
${results.filter(r => r.result?.ok && r.result.svg).map(r => `
  <div class="frame">
    <h3>${r.name}</h3>
    ${r.result.svg}
    <div class="metric">耗时: <strong>${(r.result.elapsed / 1000).toFixed(2)}s</strong></div>
    <div class="metric">元素数: ${r.analysis.elementCount} / viewBox: ${r.analysis.viewBox}</div>
  </div>
`).join('')}
</div>

</body></html>`;

const htmlPath = `${OUT_DIR}/comparison.html`;
await writeFile(htmlPath, html, 'utf8');
console.log('=== 对比报告 ===');
console.log(`已生成 HTML 报告：${htmlPath}`);
console.log('用浏览器打开看效果对比。');
console.log('');
console.log('=== 速览 ===');
results.forEach(r => {
  if (!r.result?.ok) {
    console.log(`  ${r.name}: ❌ ${r.result?.error || 'skipped'}`);
  } else {
    console.log(`  ${r.name}: ${(r.result.elapsed/1000).toFixed(2)}s · 元素 ${r.analysis.elementCount} · ${r.analysis.hasColor ? '⚠️彩色' : '✓无彩色'}`);
  }
});
