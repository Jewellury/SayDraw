# SayDraw 模型调用管线技术文档

> 最后更新：2026-06-07 | 对应代码版本：TASK-012B 单模型回退

---

## 1. 总体流程

```
用户说话 / 打字
    │
    ▼
┌─────────────────────────────────┐
│  语音输入 (Web Speech API)        │  ← 浏览器 native SpeechRecognition
│  lang=zh-CN, continuous=true    │
│  文本回填到 <input>              │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  addScene() — 组装请求            │
│  storyText() 压缩上下文           │
│  POST /api/story/generate       │
│  body: { storySoFar, newLine,   │
│          speaker, textPrompt }  │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  API Route (server-side)         │
│  ① 校验输入                       │
│  ② 拼 system prompt              │
│  ③ 调用 DeepSeek V4 Flash        │
│  ④ 解析 JSON → 提取各字段          │
│  ⑤ extractSvg → sanitize → 校验   │
│  ⑥ 返回 { narration, svg, ... } │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Page 接收响应                    │
│  存入 scenes[] + localStorage    │
│  DrawnSvg 渲染 → stroke-dasharray │
│  动画（线条自绘）                   │
└─────────────────────────────────┘
```

---

## 2. 语音 → 文字

### 技术选型

使用浏览器内置的 **Web Speech API** (`SpeechRecognition`)。零依赖，纯浏览器能力。

### 配置参数

| 参数 | 值 | 原因 |
|------|-----|------|
| `lang` | `zh-CN` | 中文识别 |
| `interimResults` | `true` | 实时显示识别中间结果 |
| `continuous` | `true` | 支持连续说话，不自动终止 |

### 交互方式

**按住说话、松开结束**：
- `onMouseDown` / `onTouchStart` → `startVoice()` 开始录音
- `onMouseUp` / `onMouseLeave` / `onTouchEnd` / `onTouchCancel` → `stopVoice()` 结束录音
- 录音中 `.hb-mic.live` 橙色脉冲动画提示

### 兼容性

`window.SpeechRecognition || window.webkitSpeechRecognition`。不支持时提示用户打字。

### 代码位置

`app/page.tsx:263-292` (startVoice / stopVoice)，类型定义在第 12-57 行。

---

## 3. 文字 → SVG（当前方案：单模型 DeepSeek V4 Flash）

### 3.1 模型信息

| 项目 | 值 |
|------|-----|
| 模型名 | `deepseek-v4-flash` |
| API 端点 | `https://api.deepseek.com/v1/chat/completions` |
| 调用方式 | 原生 `fetch`（无第三方 SDK） |
| 超时 | 30 秒 `AbortController` |
| max_tokens | 2000 |
| temperature | 0.75 |
| response_format | `{ type: "json_object" }` |

### 3.2 一次调用返回所有字段

DeepSeek 单次 API 调用同时返回 narration + SVG + followUpQuestion + storySummary：

```json
{
  "narration": "小恐龙追蝴蝶",
  "followUpQuestion": "蝴蝶飞到哪去了？",
  "storySummary": "小恐龙在草地上看到一只蝴蝶飞过，它站起来去追蝴蝶。",
  "svg": "<svg viewBox=\"0 0 400 300\" ...>...</svg>"
}
```

### 3.3 System Prompt（COMBINED_SYS）

定义在 `lib/ai/prompts.ts`，包含：
- "json" 关键词（DeepSeek `json_object` 模式强制要求）
- 完整输出示例（4 个字段均有值）
- 字段规则（narration ≤30字，followUpQuestion ≤15字，storySummary 2-3句）
- SVG 画图规则：B&W 线条、stroke 层级（3/2/1.5）、12-22 元素、构图顺序
- 角色画法指南：恐龙（椭圆身+三角背鳍）、月球（弧线+坑洞圆）、陨石（不规则多边形+速度线）、晕倒（横躺+螺旋线）、蝴蝶（椭圆翅+触角）

### 3.4 Route 处理链路

文件：`app/api/story/generate/route.ts`

```
POST /api/story/generate
  │
  ├─ Step 0: 校验 newLine 非空 → 否则 400
  │
  ├─ Step 1: 构建 system prompt
  │   COMBINED_SYS + (textPrompt 可选追加)
  │
  ├─ Step 2: 调用 generateStoryFrame(systemPrompt, userMessage)
  │   userMessage 格式：
  │   "目前的故事：\n{storySoFar}\n\n最新这一句是{爸爸/宝宝}说的：{newLine}"
  │
  ├─ Step 3: 解析 JSON (parseCombinedResponse)
  │   成功 → 提取 4 个字段
  │   失败 → narration = newLine, svg = ''
  │
  ├─ Step 4: SVG 处理
  │   extractSvg(rawSvg) → 剥离 markdown fence，提取 <svg>…</svg>
  │   validateSvg(extracted) → 检查含 <svg> 和 </svg> 标签
  │   无效 → FALLBACK_SVG (笑脸简笔画)
  │
  ├─ Step 5: sanitizeSvg(svg) → 安全过滤
  │
  └─ Step 6: 组装响应 → 200 OK
     { narration, svg, followUpQuestion?, storySummary? }
```

### 3.5 完整错误链

| 层级 | 失败场景 | 回退策略 | HTTP |
|------|---------|---------|------|
| L0 | newLine 为空 | `{"error":"请说一句话再来画"}` | 400 |
| L1 | 无 DEEPSEEK_API_KEY | getMockText() + FALLBACK_SVG | 200 |
| L1 | API 返回非 2xx | getMockText() + FALLBACK_SVG | 200 |
| L1 | 请求超时（30 秒） | getMockText() + FALLBACK_SVG | 200 |
| L2 | JSON parse 失败 | narration=newLine, svg='' → FALLBACK_SVG | 200 |
| L3 | svg 字段无 `<svg>` 标签 | FALLBACK_SVG | 200 |
| L5 | 任何未捕获异常 | `{"error":"画板打了个小盹"}` | 500 |

**核心原则**：任何失败都不阻塞页面，app 始终可玩。

### 3.6 Key 可用性矩阵

| DeepSeek Key | 文本来源 | SVG 来源 | 用户体验 |
|-------------|---------|---------|---------|
| 有 | DeepSeek Flash | DeepSeek Flash (svg 字段) | 完整质量 |
| 无 | getMockText() | FALLBACK_SVG | Mock 模式（可玩） |
| 有但 API 失败 | getMockText() | FALLBACK_SVG | Mock 模式（可玩） |

---

## 4. SVG 安全处理

### 4.1 sanitizeSvg（`lib/svg/sanitizeSvg.ts`）

对所有 AI 生成的 SVG 执行安全过滤：

| 移除内容 | 正则匹配 |
|---------|---------|
| `<script>` 块 | `/<script[\s\S]*?\/script>/gi` |
| `<foreignObject>` 块 | `/<foreignObject[\s\S]*?\/foreignObject>/gi` |
| `on*` 事件属性 | `/\s+on\w+\s*=\s*["'][^"']*["']/gi` |
| 外部 `href`（http/https） | `/\s+(xlink:)?href\s*=\s*["']https?:\/\/[^"']*["']/gi` |
| `javascript:` 协议 href | `/\s+(xlink:)?href\s*=\s*["']javascript:[^"']*["']/gi` |

### 4.2 extractSvg（`lib/ai/svg-model.ts`）

AI 有时会包裹 markdown code fence，需要剥离后提取：

```ts
// "```svg\n<svg>...</svg>\n```" → "<svg>...</svg>"
const stripped = raw.replace(/```(?:svg)?\n?/gi, '').trim();
const match = stripped.match(/<svg[\s\S]*?<\/svg>/i);
```

### 4.3 FALLBACK_SVG

当 SVG 字段为空 / 不合法时的兜底图 — 一个 4 元素的简单笑脸，纯黑白线条，保证页面始终有图可显示。

---

## 5. 上下文压缩（storySummary 传递链）

### 5.1 问题

如果每次请求都把完整故事发给 AI，token 用量会线性增长。例如 10 轮对话后可能达 500+ tokens 的 storySoFar。

### 5.2 方案

每轮响应中的 `storySummary`（2-3 句的故事浓缩）被存到 `Scene.summary` 字段上。下一轮请求时，`storyText()` 优先使用 summary：

```ts
// app/page.tsx:172-181
scenes.map((s) => {
  const label = s.speaker === 'dad' ? '爸爸' : '宝宝';
  return label + '：' + (s.summary || s.text);
})
```

### 5.3 效果

| 轮次 | 无压缩 token 数（估算） | 有压缩 token 数（估算） |
|------|----------------------|----------------------|
| 第 1 轮 | ~30 | ~30 |
| 第 5 轮 | ~150 | ~80 |
| 第 10 轮 | ~300 | ~130 |

---

## 6. SVG 自绘动画

### 6.1 原理（`app/globals.css` 中的 `.hb-draw`）

利用 SVG 的 **stroke-dasharray** + **stroke-dashoffset** CSS 动画模拟线条自绘：

1. 所有 stroke 元素设置 `stroke-dasharray: 700`（虚线总长）和 `stroke-dashoffset: 700`（起始偏移 = 全长 → 完全隐藏）
2. `@keyframes hbDraw { to { stroke-dashoffset: 0; } }` — 1.5 秒动画将偏移归零，线条"画出来"
3. **错峰延迟**：子元素依次延迟 0.15s / 0.3s / 0.45s / 0.6s 启动，产生逐笔绘制的效果

### 6.2 适用场景

- 主画板 `.hb-board` 内的 SVG：每次切换帧重新挂载，重新播放动画
- 播放剧场 `.hb-modal` 内的 SVG：每格自动播放动画，3.8 秒自动切下一格
- 胶卷缩略图 `.hb-film` 内的 SVG：**不播放动画**，静态展示

---

## 7. 设置面板

### 7.1 可见字段

| 字段 | 标签 | 作用 | localStorage key |
|------|------|------|-----------------|
| `textPrompt` | 故事提示词（DeepSeek Flash） | 追加到 COMBINED_SYS 末尾 | `saydraw_text_prompt` |

### 7.2 隐藏字段（为双模型预留）

| 字段 | 状态 | 作用 | localStorage key |
|------|------|------|-----------------|
| `drawingPrompt` | 隐藏 + 数据保留 | 切回双模型后传给 Claude 画图 | `saydraw_drawing_prompt` |

### 7.3 历史迁移逻辑

首次加载时自动从旧 key 合并迁移：
- `saydraw_scene_prompt` + `saydraw_narration_prompt` → `saydraw_text_prompt`
- `saydraw_svg_prompt` → `saydraw_drawing_prompt`
- 迁移后删除旧 key

---

## 8. API Key 管理

### 8.1 安全规则

- **所有 Key 仅服务端读取** (`process.env.*`)，绝不出现在客户端代码、localStorage、props 或序列化状态中
- **不使用 `NEXT_PUBLIC_*` 前缀**给任何真 Key

### 8.2 当前使用的 Key

| 环境变量 | 当前是否使用 | 负责功能 | 读取位置 |
|---------|------------|---------|---------|
| `DEEPSEEK_API_KEY` | ✅ 使用中 | DeepSeek 文本+SVG 调用 | `lib/ai/deepseek.ts` |
| `DEEPSEEK_BASE_URL` | ✅ 使用中 | DeepSeek API 端点 | `lib/ai/deepseek.ts` |
| `ANTHROPIC_API_KEY` | ⏸ 预留 | Claude 画 SVG（双模型时使用） | `lib/ai/svg-model.ts` |
| `ANTHROPIC_BASE_URL` | ⏸ 预留 | Anthropic API 端点 | `lib/ai/svg-model.ts` |

### 8.3 配置方式

`.env.local` 文件（不提交到 Git）：

```
DEEPSEEK_API_KEY=sk-xxx
DEEPSEEK_BASE_URL=https://api.deepseek.com
ANTHROPIC_API_KEY=sk-ant-xxx
ANTHROPIC_BASE_URL=https://api.anthropic.com
```

---

## 9. 未来方案：切回双模型

### 9.1 目标架构

当 Anthropic 账户恢复后，切回 TASK-012 的双模型管线：

```
POST /api/story/generate
  │
  ├─ Step 1: DeepSeek V4 Flash (TEXT_SYS)
  │   仅负责文字: narration + followUpQuestion + storySummary
  │   max_tokens: 1000, response_format: json_object
  │   失败 → getMockText()
  │
  ├─ Step 2: Claude Sonnet 4 (SVG_SYS + drawingPrompt)
  │   仅负责画图: 接收 narration + storySummary
  │   max_tokens: 4096
  │   失败 → FALLBACK_SVG
  │
  └─ Step 3: sanitize → validate → respond
```

### 9.2 为切换预留的"口子"

| 预留项 | 状态 | 位置 |
|--------|------|------|
| `TEXT_SYS` 导出 | 已保留，注释 "备用" | `lib/ai/prompts.ts` |
| `SVG_SYS` 导出 | 已保留，注释 "备用" | `lib/ai/prompts.ts` |
| `generateSvg()` 函数 | 完整保留，未被调用 | `lib/ai/svg-model.ts` |
| `NoAnthropicKeyError` | 保留 | `lib/ai/svg-model.ts` |
| `ANTHROPIC_API_KEY` | 已配置在 `.env.local` | 项目根目录 |
| `drawingPrompt` 数据 | localStorage 持续保存 | `saydraw_drawing_prompt` |
| `drawingPrompt` 字段 | 前端已隐藏，数据流完整 | `app/page.tsx` |

### 9.3 切换步骤

1. **`lib/ai/prompts.ts`**：移除 `COMBINED_SYS`，恢复 `TEXT_SYS`/`SVG_SYS` 为主要导出
2. **`lib/ai/deepseek.ts`**：`max_tokens` 回退到 1000
3. **`app/api/story/generate/route.ts`**：
   - 重新引入 `generateSvg`/`NoAnthropicKeyError`
   - 拆分为两步调用：文本模型 → SVG 模型
   - `drawingPrompt` 传给 `generateSvg()`
4. **`app/page.tsx`**：恢复 drawingPrompt 字段为可见状态
5. **`AGENTS.md`**：更新 AI 模型描述为双模型

---

## 10. 文件索引

| 文件 | 职责 |
|------|------|
| `app/page.tsx` | 前端主页面：语音/文字输入、场景管理、设置面板、动画渲染、上下文压缩 |
| `app/api/story/generate/route.ts` | API 路由：单模型调用编排、JSON 解析、SVG 提取/校验/消毒、错误回退 |
| `lib/ai/prompts.ts` | AI prompt 定义：COMBINED_SYS（当前）、TEXT_SYS/SVG_SYS（双模型备用）、INK 常量 |
| `lib/ai/deepseek.ts` | DeepSeek API 客户端：fetch 调用、超时控制、API key 检查 |
| `lib/ai/svg-model.ts` | Claude API 客户端（预留）：generateSvg + extractSvg 工具函数 |
| `lib/ai/mock.ts` | Mock 数据：getMockText() 在无 key/失败时提供回退故事 |
| `lib/svg/sanitizeSvg.ts` | SVG 安全过滤：去除 script、foreignObject、事件属性、外部链接 |
| `lib/story/types.ts` | TypeScript 类型：Scene、GenerateRequest、GenerateResponse |
| `lib/story/storage.ts` | localStorage 持久化：场景数据的保存和加载 |
| `app/globals.css` | 全局样式：.hb-draw 自绘动画、.hb-mic 脉冲、.hb-settings 面板 |
| `.env.local` | 环境变量（不提交 Git）：API keys、base URLs |
