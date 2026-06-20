// Verify a tightened prompt reduces Doubao output token count.
// Artifact only — NOT shipped.
const TIGHT_SYS = [
  '你是一个儿童绘本「故事引擎」兼「插画师」，为每一句话画一幅黑白线稿插画。',
  '请严格只输出一个 JSON 对象（不要 markdown，不要代码块）：',
  '{',
  '  "narration": "用户原话，不超过30字",',
  '  "followUpQuestion": "不超过15字",',
  '  "storySummary": "1句话总结，不超过40字",',
  '  "svg": "<svg viewBox=\\"0 0 400 300\\" xmlns=\\"http://www.w3.org/2000/svg\\">...</svg>"',
  '}',
  '',
  'SVG 规则（严格遵守）：',
  '- 格式：<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">...</svg>',
  '- 所有元素：stroke="#211e18"，fill="none"，stroke-linecap="round"，stroke-linejoin="round"',
  '- 主角轮廓 stroke-width="3"，细节 stroke-width="2"，背景 stroke-width="1.5"',
  '- 禁止：fill 颜色（除 fill="none"）、text 元素、style 属性里的颜色',
  '- 元素数量：6~10 个 SVG 元素（精简，不要堆砌细节）',
  '- 主角占画高 50%~60%，居中',
  '',
  '只输出 JSON，不要任何其他内容。',
].join('\n');

async function probe(label, sys) {
  const apiKey = process.env.DOUBAO_API_KEY;
  const baseUrl = process.env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
  const model = process.env.DOUBAO_MODEL;
  const userMsg = '目前的故事：\n\n最新这一句是宝宝说的：一只小恐龙在花园里散步';
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 45_000);
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
        max_completion_tokens: 1500,
      }),
      signal: abort.signal,
    });
    const dt = performance.now() - t0;
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    const finish = data.choices?.[0]?.finish_reason;
    const svgComplete = content.includes('<svg') && content.includes('</svg>');
    console.log(`[${label}] ${dt.toFixed(0)}ms finish=${finish} tokens=${data.usage?.completion_tokens} svgComplete=${svgComplete}`);
    if (svgComplete) console.log(`   preview: ${content.slice(0, 250).replace(/\n/g, ' ')}`);
    else console.log(`   tail: ...${content.slice(-100)}`);
  } catch (e) {
    const dt = performance.now() - t0;
    console.log(`[${label}] ERR after ${dt.toFixed(0)}ms: ${e.message}`);
  } finally {
    clearTimeout(timer);
  }
}

console.log('Comparing original vs tightened prompt on Doubao (max_completion_tokens=1500)...');
await probe('tight-6-10-elems', TIGHT_SYS);
