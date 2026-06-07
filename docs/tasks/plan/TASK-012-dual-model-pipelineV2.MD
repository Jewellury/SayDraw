# TASK-012 (Revised): Dual-Model Fixed-Role AI Pipeline

Plan authored: 2026-06-07
Revision authored: 2026-06-07 (post-review)
Owner Flow: plan-agent → execute-agent → audit-agent
Lane: Full

---

## Background

TASK-010 integrated DeepSeek as a single-model pipeline. TASK-011 added the settings panel.
Two critical problems emerged:

1. DeepSeek v4-Pro (reasoning model) consumes all `max_tokens` on `reasoning_content`;
   `content` is empty when `response_format: json_object` is used — unreliable as a JSON producer.
2. Single-model quality ceiling: Flash produces reliable JSON but mediocre SVG;
   Claude Sonnet draws better black-and-white line-art but is not optimized for structured JSON.

This task replaces the single-model pipeline with a dual-model fixed-role architecture.

---

## Architecture

```
POST /api/story/generate
  │
  ├─ Step 0: Validate input (newLine required, non-empty)
  │
  ├─ Step 1: TEXT MODEL — deepseek-v4-flash
  │   System prompt: TEXT_SYS + optional user textPrompt (appended)
  │   User message:  storySoFar + newLine + speaker
  │   Response format: json_object (always)
  │   Output: { narration, followUpQuestion, storySummary }
  │   Failure chain:
  │     no DEEPSEEK_API_KEY → NoApiKeyError → getMockText() → continue
  │     API error / empty content / parse failure → getMockText() → continue
  │     NOTE: deepseek-v4-pro is NOT used as fallback (see Rationale below)
  │
  ├─ Step 2: SVG MODEL — claude-sonnet-4-20250514
  │   System prompt: SVG_SYS + optional user drawingPrompt (appended)
  │   User message:  "Narration: {narration}\n\nStory Summary: {storySummary}"
  │   Output: raw <svg>...</svg> string (no JSON, no markdown)
  │   Failure chain:
  │     no ANTHROPIC_API_KEY → NoAnthropicKeyError → FALLBACK_SVG → continue
  │     API error / empty content / no <svg> tag → FALLBACK_SVG → continue
  │
  └─ Step 3: Sanitize → Validate → Respond
       sanitizeSvg(svg)
       if !containsSvgTags(svg) → FALLBACK_SVG
       return { narration, svg, followUpQuestion, storySummary }
```

### Rationale: Why deepseek-v4-pro is removed as fallback

v4-Pro is a reasoning model. Its behavior with `response_format: json_object`:
- Burns all token budget on `reasoning_content`
- `content` field is consistently empty
- Results in 25–30s timeout then parse failure → falls through to mock anyway

Net effect of keeping Pro as fallback: +30s latency, identical result to mock.
Decision: Flash failure → mock directly. No intermediate Pro retry.

---

## Prompt Design

### TEXT_SYS (DeepSeek Flash — text model)

TEXT_SYS must contain the word "json" and a complete output example.
DeepSeek's `response_format: json_object` requires the word "json" in system prompt
or the request may be rejected / produce unstable output.

```
你是一个儿童绘本「故事引擎」，陪一个4岁孩子和爸爸一起编故事。
你会收到目前为止的故事，以及最新的一句话。

请严格只输出一个 JSON 对象（不要 markdown，不要代码块，不要任何解释）：

{
  "narration": "直接保留用户原话，可去掉语气词，不超过30字，不加说话人前缀",
  "followUpQuestion": "引导孩子说下一句的开放式问题，不超过15字",
  "storySummary": "用2~3句话总结当前故事进展，供画图模型理解场景用"
}

字段规则：
1. narration：保留用户原话，适当精简，不改变意思，不超过30字。
2. followUpQuestion：口语化，像爸爸在问孩子，不超过15字。
3. storySummary：给画图AI看的场景摘要，说清楚谁、在哪、发生了什么，2~3句。

只输出 JSON，不要任何其他内容。
```

### SVG_SYS (Claude Sonnet — SVG model)

```
你是一个儿童绘本插画师，只输出一段 SVG 代码，不要任何解释、不要 JSON、不要 markdown。

你会收到：
- Narration：这一格要画的内容
- Story Summary：当前故事的场景摘要（用于理解背景）

SVG 规则（严格遵守）：
- 格式：<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">...</svg>
- 所有元素：stroke="#211e18"，fill="none"，stroke-linecap="round"，stroke-linejoin="round"
- 主角轮廓 stroke-width="3"，细节 stroke-width="2"，背景元素 stroke-width="1.5"
- 禁止：任何 fill 颜色（除 fill="none"）、文字/text 元素、style 属性里的颜色
- 元素数量：12~22 个 SVG 元素

构图要求：
- 先画背景（地面线、场景道具1~2样）
- 再画主角：头部、眼睛、嘴巴、身体、四肢（完整轮廓）
- 主角占画高 40%~60%，水平居中
- 动作要明确，一眼读出在做什么
- 画面有层次：背景（简笔）+ 主角（主体）

只输出 <svg>...</svg>，不要任何其他内容。
```

### Prompt 字段映射表

| 字段名 | 属于哪个模型 | 类型 | 用途 | 在 system prompt 中的位置 |
|--------|------------|------|------|--------------------------|
| `TEXT_SYS` | DeepSeek Flash | 固定常量，服务端 | 文本模型默认 system prompt | 基础层，不可覆盖 |
| `textPrompt` | DeepSeek Flash | 用户可配置，可选 | 追加额外旁白/故事规则 | 追加到 TEXT_SYS 末尾 |
| `SVG_SYS` | Claude Sonnet | 固定常量，服务端 | SVG 模型默认 system prompt | 基础层，不可覆盖 |
| `drawingPrompt` | Claude Sonnet | 用户可配置，可选 | 追加额外画风/角色规则 | 追加到 SVG_SYS 末尾 |

**重要约束：**
- TEXT_SYS 和 SVG_SYS 仅存在于服务端（`lib/ai/prompts.ts`），不暴露给前端
- 用户字段（`textPrompt`、`drawingPrompt`）仅用于追加，不可替换基础 prompt
- 禁止在 `textPrompt` 里写 SVG 规则，禁止在 `drawingPrompt` 里写 JSON 规则

### 拼接逻辑（服务端 route）

```ts
// 文本模型 system prompt
const textSystemPrompt = req.textPrompt
  ? `${TEXT_SYS}\n\n// 额外规则\n${req.textPrompt}`
  : TEXT_SYS;

// SVG 模型 system prompt
const svgSystemPrompt = req.drawingPrompt
  ? `${SVG_SYS}\n\n// 额外画风规则\n${req.drawingPrompt}`
  : SVG_SYS;
```

---

## storySummary 传递链

### 服务端流向

```
TEXT_SYS → DeepSeek Flash → JSON { narration, followUpQuestion, storySummary }
                                          │                             │
                                          ▼                             ▼
                                     返回给客户端              传给 SVG 模型
                                     （用于显示）         generateSvg(narration, storySummary)
                                                                        │
                                                               Claude Sonnet
                                                               理解场景 → 画图
```

Mock 路径：getMockText() 同样返回 `{ narration, followUpQuestion, storySummary }`，
storySummary 照常传给 SVG 模型（Claude key 存在时仍可画真实 SVG）。

### 客户端压缩链（下一轮请求）

storySummary 必须被存储并用于压缩下一轮请求的 `storySoFar`，防止 token 线性膨胀。

**1. Scene 类型扩展（`lib/story/types.ts`）**

```ts
export interface Scene {
  id: number;
  speaker: 'dad' | 'kid';
  text: string;
  svg: string;
  summary?: string;       // ← 新增：文本模型返回的故事摘要
}
```

**2. 存储 summary（`app/page.tsx` 的 `addScene()`）**

```ts
const { narration, svg, followUpQuestion, storySummary }: GenerateResponse = data;

const newScene: Scene = {
  id: Date.now(),
  speaker: mySpeaker,
  text: narration || myLine,
  svg,
  summary: storySummary,   // ← 存储摘要
};
```

种子场景（SEED_SCENE）没有 summary 字段（hand-crafted，无需压缩）。

**3. storyText() 压缩逻辑（`app/page.tsx`）**

```ts
const storyText = useCallback(
  () =>
    scenes
      .map((s) => {
        const label = s.speaker === 'dad' ? '爸爸' : '宝宝';
        // 有摘要用摘要（压缩历史），无摘要用原文（种子场景或摘要缺失）
        return label + '：' + (s.summary || s.text);
      })
      .join('\n'),
  [scenes]
);
```

**压缩效果：**

- 第1轮：种子场景原文（无 summary）→ 约 30 tokens
- 第2轮：种子场景原文 + scene 1 summary（~20 tokens）→ 约 50 tokens
- 第N轮：种子场景原文 + N-1 个 summary（每个 ~20 tokens）→ O(N) 但系数很小

对比未压缩：每轮追加原文（~30 tokens/条）→ O(N) 且系数大。

**4. 降级路径**

- 某场景的 summary 为 `undefined` → 使用原文兜底
- 种子场景永远无 summary → 保留原文保证故事起点完整性
- 故事重启（reset）→ 回到种子场景，summary 链重置

---

## 失败链（完整）

```
Level 0: 请求校验
  newLine 空 → 400 { error: "请说一句话再来画" }

Level 1: 文本模型（DeepSeek Flash）
  无 DEEPSEEK_API_KEY → getMockText() → 进入 Level 2
  API 返回非 2xx → getMockText() → 进入 Level 2
  content 为空 → getMockText() → 进入 Level 2
  JSON 解析失败 → narration = newLine（用户原话）+ storySummary = "" → 进入 Level 2
  NOTE: 不重试 v4-Pro（原因见 Rationale）

Level 2: SVG 模型（Claude Sonnet）
  无 ANTHROPIC_API_KEY → FALLBACK_SVG → 进入 Level 3
  API 返回非 2xx → FALLBACK_SVG → 进入 Level 3
  content 为空 → FALLBACK_SVG → 进入 Level 3
  响应不含 <svg> 标签 → FALLBACK_SVG → 进入 Level 3

Level 3: SVG 校验
  sanitizeSvg() 处理后不含 <svg>...</svg> → FALLBACK_SVG

Level 4: 响应组装 → 200 OK
  { narration, svg, followUpQuestion?, storySummary? }

Level 5: 外层兜底
  任何未捕获异常 → 500 { error: "画板打了个小盹，再说一次试试" }
  原始错误、堆栈、API key 片段禁止到达客户端
```

---

## Key Presence 行为矩阵

| DEEPSEEK key | ANTHROPIC key | 文本来源 | SVG 来源 | 可玩？ |
|-------------|--------------|---------|---------|-------|
| 有 | 有 | DeepSeek Flash | Claude Sonnet | ✅ 全质量 |
| 有 | 无 | DeepSeek Flash | FALLBACK_SVG | ✅ |
| 无 | 有 | getMockText() | Claude Sonnet | ✅ |
| 无 | 无 | getMockText() | FALLBACK_SVG | ✅ Mock 模式 |
| 有（Flash 失败） | 有 | getMockText() | Claude Sonnet | ✅ |
| 有 | 有（Claude 失败） | DeepSeek Flash | FALLBACK_SVG | ✅ |
| 有（Flash 失败） | 有（Claude 失败） | getMockText() | FALLBACK_SVG | ✅ |

---

## Settings Panel（TASK-011 重构）

### 字段变更表

| TASK-011 字段 | TASK-012 处理 | 理由 |
|-------------|-------------|------|
| 模型选择器（flash/pro） | **删除** | 模型由角色固定，不开放选择 |
| `scenePrompt`（"画面提示词"） | **合并** → `textPrompt` | 与 narrationPrompt 职责重叠，都属于文本模型 |
| `narrationPrompt`（"旁白规则"） | **合并** → `textPrompt` | 同上 |
| `svgPrompt`（"SVG规则"） | **重命名** → `drawingPrompt` | 语义更清晰，对应 SVG 模型角色 |

**合并理由**：`scenePrompt` 是"替换整个 system prompt"，`narrationPrompt` 是"追加规则"，
两者都作用于同一个模型（DeepSeek Flash），区别仅在拼接位置，对用户毫无意义。
统一为 `textPrompt`（追加语义），TEXT_SYS 固定不可替换，设计更安全。

### Settings Panel 保留项/删除项/重命名项

**删除：**
- 模型选择器 `<select>` 及 `settingsModel` state
- `saydraw_model` localStorage key（下次保存时自动清除，无需迁移）

**重命名（含 localStorage key 迁移）：**
- `scenePrompt` + `narrationPrompt` → `textPrompt`（`saydraw_text_prompt`）
- `svgPrompt` / `saydraw_svg_prompt` → `drawingPrompt` / `saydraw_drawing_prompt`
  （首次加载读旧 key 作为 fallback，迁移一次后使用新 key）

**textPrompt 迁移规则（精确）：**

在 `app/page.tsx` 初始化 `textPrompt` 的 `getLs` 逻辑中，按以下优先级合并：

```
if saydraw_text_prompt 已存在（新 key）:
  → 直接使用，跳过迁移
else if saydraw_scene_prompt 和 saydraw_narration_prompt 均存在:
  → textPrompt = scenePrompt + "\n" + narrationPrompt
else if 仅 saydraw_scene_prompt 存在:
  → textPrompt = scenePrompt
else if 仅 saydraw_narration_prompt 存在:
  → textPrompt = narrationPrompt
else:
  → textPrompt = ""（空字符串）
```

**迁移后清理：** 首次合并后，删除旧 localStorage key（`saydraw_scene_prompt`、`saydraw_narration_prompt`），
写入新 key `saydraw_text_prompt`。这样后续加载直接走新 key，不会重复迁移。

**drawingPrompt 迁移规则：**

```
if saydraw_drawing_prompt 已存在（新 key）:
  → 直接使用，跳过迁移
else if saydraw_svg_prompt 存在（旧 key）:
  → drawingPrompt = svgPrompt
  → 删除 saydraw_svg_prompt，写入 saydraw_drawing_prompt
else:
  → drawingPrompt = ""（空字符串）
```

**保留：**
- 设置面板 open/close 逻辑
- "恢复默认"按钮（重置两个字段为空字符串）
- 移动端响应式样式（`app/globals.css` 不改）

### 最终 Settings Panel 字段

| 字段 | 标签 | 说明文案 | 占位符 |
|------|------|---------|--------|
| `textPrompt` | 故事提示词（DeepSeek Flash） | "额外的旁白和故事规则，追加到默认提示词末尾" | "例：旁白要活泼一点，多用拟声词……" |
| `drawingPrompt` | 画风规则（Claude Sonnet） | "额外的画风和角色规则，追加到默认画图提示词末尾" | "例：画恐龙时要有背鳍和尾巴……" |

---

## 类型变更（lib/story/types.ts）

```ts
export interface Scene {
  id: number;
  speaker: 'dad' | 'kid';
  text: string;
  svg: string;
  summary?: string;         // ← 新增：文本模型返回的故事摘要，用于压缩下一轮 storySoFar
}

export interface GenerateRequest {
  storySoFar: string;
  newLine: string;
  speaker: 'dad' | 'kid';
  textPrompt?: string;      // 追加到 TEXT_SYS（文本模型）
  drawingPrompt?: string;   // 追加到 SVG_SYS（SVG 模型）
  // 已删除: model?, scenePrompt?, narrationPrompt?, svgPrompt?
}

export interface GenerateResponse {
  narration: string;
  svg: string;
  followUpQuestion?: string;
  storySummary?: string;    // 透传给客户端，客户端在下次请求时放入 storySoFar
}
```

---

## 文件变更范围

| 文件 | 动作 | 内容 |
|------|------|------|
| `lib/ai/prompts.ts` | 修改 | 拆分为 `TEXT_SYS`（含 json 关键词和示例）和 `SVG_SYS`（纯 SVG 输出指令）。导出 `INK` 常量。保留 `SCENE_SYS` 为废弃 re-export（兼容过渡）。 |
| `lib/ai/deepseek.ts` | 修改 | 简化为文本模型专用。始终使用 `json_object`。**移除 Pro fallback**。Flash 失败抛错（由 route 捕获转 mock）。 |
| `lib/ai/svg-model.ts` | 新建 | `generateSvg(narration, storySummary, drawingPrompt?)` → Anthropic Messages API → 返回 svg string。含 markdown fence 剥离、无 `<svg>` 标签检测。 |
| `lib/ai/mock.ts` | 修改 | 为所有 mock scene 补 `storySummary` 和 `followUpQuestion`。新增 `getMockText()` 导出。 |
| `lib/story/types.ts` | 修改 | 按上方类型变更执行。 |
| `app/api/story/generate/route.ts` | 修改 | 完整重写：双模型串行调用，独立 fallback，`parseTextResponse()`，`extractSvg()`，`sanitizeSvg`，组装响应。 |
| `app/page.tsx` | 修改 | 移除模型选择器；合并两个文本 prompt 字段为 `textPrompt`；重命名 `drawingPrompt`；更新 localStorage key（含旧 key 迁移读取）；存储 `storySummary` 到 Scene；修改 `storyText()` 使用 summary 压缩；更新 POST body。 |
| `app/globals.css` | 不改 | |
| `.env.example` | 修改 | 新增 `ANTHROPIC_API_KEY=` 占位符（仅 key 名，不含真实值）；将现有 `DEEPSEEK_API_KEY` 值替换为占位符；移除 `DEEPSEEK_FALLBACK_MODEL` 已废弃配置 |
| `docs/reference/dev-server-runbook.md` | 修改 | 新增 "Environment Variables" 章节，列出 `DEEPSEEK_API_KEY` 和 `ANTHROPIC_API_KEY` 的配置方式与获取渠道 |
| `lib/svg/sanitizeSvg.ts` | 不改 | |
| `lib/analytics/` | 不改 | |
| `lib/story/storage.ts` | 不改 | |
| `package.json` | 不改 | 两个 provider 均用原生 fetch |
| `next.config.*` / `tsconfig.json` / `tailwind.config.*` | 不改 | |

### 禁止变更

- 不得在前端/localStorage/POST body/props 暴露 `DEEPSEEK_API_KEY` 或 `ANTHROPIC_API_KEY`
- 不得使用 `NEXT_PUBLIC_*` 前缀的 key 相关 env var
- 不得添加新 npm 依赖
- 不得修改 `docs/00_design/` 或 `docs/_archive/`

---

## Anthropic API 调用规范

```
POST https://api.anthropic.com/v1/messages
Headers:
  x-api-key: $ANTHROPIC_API_KEY
  anthropic-version: 2023-06-01
  Content-Type: application/json

Body:
{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 4096,
  "system": "<SVG_SYS + optional drawingPrompt>",
  "messages": [
    {
      "role": "user",
      "content": "Narration: {narration}\n\nStory Summary: {storySummary}"
    }
  ]
}

Response parsing:
  data.content[0].text → 含 <svg>...</svg> 的字符串
  Claude 可能返回 markdown fence → 用正则剥离后验证含 <svg> 标签
```

---

## SVG 响应提取（extractSvg）

```ts
function extractSvg(raw: string): string {
  // 1. 剥离 markdown fence（```svg 或 ```）
  const stripped = raw.replace(/```(?:svg)?\n?/gi, '').trim();
  // 2. 提取 <svg>...</svg>
  const match = stripped.match(/<svg[\s\S]*?<\/svg>/i);
  return match ? match[0] : '';
  // 空字符串 → route 使用 FALLBACK_SVG
}
```

---

## 实现顺序

```
Phase 1: lib/ai/prompts.ts     — TEXT_SYS / SVG_SYS 拆分
Phase 2: lib/ai/mock.ts        — storySummary / followUpQuestion 补全 + getMockText()
Phase 3: lib/ai/svg-model.ts   — 新建 Claude SVG helper
Phase 4: lib/ai/deepseek.ts    — 移除 Pro fallback，简化为文本模型专用
Phase 5: lib/story/types.ts    — 字段变更
Phase 6: route.ts              — 完整重写
Phase 7: app/page.tsx          — Settings panel 重构
Phase 8: .env.example + runbook  — 补全 env 占位符和运行文档
Phase 9: npm run typecheck && npm run build && npm run lint
```

---

## 验收标准

### AC1 双模型全质量路径
两个 key 均设置时，Flash 提供文本，Claude 提供 SVG，响应含四个字段。

### AC2 文本模型失败 → mock 直接接手
Flash API 错误或 key 缺失时，`getMockText()` 提供 `{ narration, followUpQuestion, storySummary }`，
SVG 模型正常调用（key 存在时），不经过 Pro。

### AC3 SVG 模型失败 → FALLBACK_SVG
Claude key 缺失或 API 错误时，使用 FALLBACK_SVG，文本字段正常保留。

### AC4 无 key 可玩
无任何 key 时，mock text + FALLBACK_SVG，用户体验与当前一致。

### AC5 storySummary 传递链完整
storySummary 从文本模型（或 mock）流向 SVG 模型，也出现在最终响应里。

### AC5.1 storySummary 压缩链闭合（客户端）
storySummary 从 API 响应存储到新创建的 Scene 的 `summary` 字段。
在下一次请求中，`storyText()` 对已有 summary 的场景使用摘要（而非原文），
对无 summary 的场景（种子场景、summary 缺失）使用原文兜底。
验证方式：在浏览器 DevTools Network 面板中观察连续两次请求的 `storySoFar` 字段，
第二次请求中第一句应以摘要形式出现（而非原文）。

### AC6 TEXT_SYS 含 json 关键词和完整示例
TEXT_SYS 中必须出现"json"字样，且包含完整的 JSON 输出示例（三个字段均有）。

### AC7 SVG 输出必须校验
generateSvg 返回值经 extractSvg 后不含 `<svg>` 标签时，route 使用 FALLBACK_SVG，
不得将无效字符串传给 sanitizeSvg。

### AC8 Anthropic API header 正确
请求头含 `x-api-key` 和 `anthropic-version: 2023-06-01`，system 在顶层字段（不在 messages 里）。

### AC9 错误信息对孩子安全
原始错误、堆栈、key 片段禁止到达客户端，统一显示"画板打了个小盹，再说一次试试"。

### AC10 Settings panel 结构
模型选择器已移除，字段为 `textPrompt`（"故事提示词"）和 `drawingPrompt`（"画风规则"），
localStorage key 完成迁移，"恢复默认"功能正常。

### AC11 类型安全
`npm run typecheck` 零错误，`npm run build` 成功，`npm run lint` 通过。

### AC12 无依赖变更
`package.json` 未改动。

### AC13 环境变量与运行文档
`.env.example` 包含 `DEEPSEEK_API_KEY=` 和 `ANTHROPIC_API_KEY=` 占位符（均为空值或占位文本，不含真实 key），且 `DEEPSEEK_FALLBACK_MODEL` 已移除。
`docs/reference/dev-server-runbook.md` 新增 "Environment Variables" 章节，说明两个 key 的用途、获取方式和 `.env.local` 配置格式。

---

## 风险（修订后）

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|-------|------|---------|
| Claude 返回带 markdown fence 的 SVG | 中 | 低 | extractSvg 正则处理 |
| Claude 返回含 fill 颜色的 SVG | 中 | 低 | sanitizeSvg 过滤；prompt 约束 |
| Flash 无 json 关键词导致 JSON mode 拒绝 | 低（已在 TEXT_SYS 中写入） | 高 | AC6 验收确保 |
| 两次串行调用总延迟超 Vercel Hobby 10s 限制 | 中 | 高 | 在 route.ts 顶部设 `export const maxDuration = 30`（Vercel 支持最大 60s on Hobby Edge） |
| textPrompt 用户写入 SVG 规则干扰文本模型 | 低 | 低 | 设置面板标签和说明文案区分职责；无强制校验 |

---

## Rollback

```bash
git checkout -- lib/ai/prompts.ts lib/ai/deepseek.ts lib/ai/mock.ts \
               lib/story/types.ts app/api/story/generate/route.ts app/page.tsx \
               .env.example docs/reference/dev-server-runbook.md
rm lib/ai/svg-model.ts
npm run typecheck && npm run build
```

无 npm 依赖变更，无数据库，无配置文件改动。
