// 验证 DeepSeek chat 是不是真的这么快，换个 prompt 不让缓存
const DEEPSEEK_KEY = (await import('node:fs/promises')).readFile('.env.local', 'utf8')
  .then(t => (t.match(/DEEPSEEK_API_KEY\s*=\s*([^\r\n]+)/) || [])[1]);

const key = await DEEPSEEK_KEY;
const baseUrl = 'https://api.deepseek.com';

// 用全新的 prompt 不让缓存命中
const prompts = [
  '一只小恐龙在森林里吃苹果',
  '一只小兔子在草地上跳',
  '月亮上的小猫在钓鱼',
];

for (const p of prompts) {
  const start = Date.now();
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是儿童绘本插画师。输出 JSON: {"narration":"...","svg":"<svg viewBox=\\"0 0 400 300\\">...</svg>"}。SVG 规则：stroke="#211e18"，fill="none"，viewBox 0 0 400 300，8-14 元素，禁止彩色/text/script。只输出 JSON。' },
        { role: 'user', content: `宝宝说：${p}` },
      ],
      max_tokens: 1500,
      temperature: 0.75,
      response_format: { type: 'json_object' },
    }),
  });
  const elapsed = Date.now() - start;
  const data = await res.json();
  console.log(`"${p}": ${elapsed}ms, tokens=${data.usage?.total_tokens}, content_len=${data.choices?.[0]?.message?.content?.length || 0}`);
}
