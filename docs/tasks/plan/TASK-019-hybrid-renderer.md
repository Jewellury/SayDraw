# TASK-019：LLM 场景规划 + 确定性渲染器 混合架构方案

> 本文档将送外部 AI 独立评审。阅读本文档不需要了解 SayDraw 项目的历史、TASK-017/018 的细节、或我们的 agent 系统。
> 评审用资料：
> - [V1 调研报告](../../00_design/儿童线稿%20SVG%20绘本生成方案深度调研报告.md) —— 聚焦"如何让 LLM 写出更好的 SVG"
> - [V2 调研报告](../../00_design/LLM%20生成儿童线稿动画的最佳媒介路径调研报告.md) —— 跳出 SVG 执念，探索 8 种媒介路径

---

## 1. 我们在做什么产品

SayDraw（花花本）是一款语音驱动的亲子绘本共创工具。一位家长和一个 4 岁孩子轮流说话，系统把每一句口头故事实时转成**黑白线稿风格的画面**，所有画面串联成一段"铅笔自绘"的动画故事。

产品的核心约束是几条不可改的"神圣决定"：画面必须是**纯黑白线稿**（无彩色填充）、**线条必须像铅笔一样一笔一笔自己画出来**（通过 SVG 的 `stroke-dashoffset` 动画实现）、AI 在一次调用中同时返回"旁白文字 + SVG 画面"。当前技术栈：Next.js 15 App Router（部署在 Vercel），画图模型使用 DeepSeek V3（通过 OpenAI 兼容 API），语音识别使用火山引擎豆包 ASR。项目面向世界产品日演示（deadline 2026-06-20 17:00 BST），核心原则是"能被公开玩 > 功能完整"。

---

## 2. 我们遇到了什么问题

### 2.1 画图质量问题（含真实案例）

**当前做法**：让 DeepSeek V3 在一次 JSON 调用中同时输出四个字段——`narration`（旁白）、`followUpQuestion`（追问）、`storySummary`（故事总结）、`svg`（黑白线稿字符串）。模型需要在同一个上下文里完成文案压缩、儿童口语风格维持、故事状态维护、JSON 格式约束**和**精确几何绘图五件事。

**实际产出**：SVG 技术上是合法的（能渲染、无彩色、无脚本），但画面质量远达不到"4 岁孩子能认出"的标准：

- **恐龙**：一个不规则椭圆（身体）+ 四条短线（四肢）+ 两个小圆点（眼睛）→ 像数学课上的几何涂鸦，不是绘本
- **月亮上的小猫**：一个大圆（月亮）+ 一个小椭圆（猫头）+ 两个三角（耳朵）→ 完全退化为抽象符号，没有故事感、没有情绪、没有层次
- **蝴蝶与花**：蝴蝶翅膀退化成两对椭圆，看不出是蝴蝶；花茎是单根直线，花芯是一个圆，缺花瓣细节

**已尝试的优化及结果**：

| 手段 | 效果 |
|---|---|
| 加 3 个 few-shot SVG 范例（恐龙/月亮+陨石/蝴蝶+花）| 画面质量稍有改善，但不显著——模型照搬范例结构，而非学构图原则 |
| 收紧元素数量限制（12-22 → 8-14）| 速度提升，但画面变得更简陋 |
| 试用豆包 pro / lite（火山方舟）| 全系超时（PRO 31-45s、LITE 25s，Vercel 函数上限 30s）——已注掉 |
| 回归 DeepSeek V3 | 速度极快（0.1-0.5s），但几何能力是模型天然弱项，质量天花板明显 |

### 2.2 根因分析

**核心矛盾不是"模型不够好"，而是"模型在做它最不擅长的事"。**

1. **LLM 本质是语言模型，不是 CAD 软件。** 让它直接输出 SVG 坐标字符串（`<path d="M120 270 L130 200 Q140 160 200 160...">`）= 让文字推理引擎做精确几何——这是系统性的能力错配。

2. **多目标竞争导致模型退守最保守策略。** 同一次调用里要求同时完成"理解故事 → 压缩旁白 → 生成追问 → 维护故事总结 → 画图"，每个目标都在争夺模型的注意力。在几何能力不足的前提下，模型的"安全策略"就是：画最简单的、最不容易出错的画面（一个椭圆 + 几根线）。

3. **"盲画"问题。** 模型在输出 SVG 时看不到中间渲染效果——它是在"闭着眼睛写代码"。最新学术研究直接称这种范式为 "open-loop blind drawing"（Render-in-the-Loop 论文），并指出任何局部画布状态错误和遮挡关系混乱都只能靠"下次写对"来补救——对单次调用来说无法修复。

---

## 3. 调研结论（两份外部 AI 报告的摘要）

我们先后委托了两次独立的外部 AI 调研，每份报告都针对"如何提升儿童线稿质量"给出了系统性建议。两轮调研的结论高度互补。

### 3.1 V1 调研：聚焦"怎么让 LLM 写出更好的 SVG"

> [完整报告](../../00_design/儿童线稿%20SVG%20绘本生成方案深度调研报告.md)

V1 调研的核心发现（共 260 行，以下为关键结论摘录）：

**关键结论一——拆 prompt。** "你现在最该改的不是'把提示词再写长一点'，而是把单次大杂烩调用拆成两个窄任务调用。" 原因：当前一个请求里同时要求压缩用户原话、生成追问、维护故事总结、再去画图，任务目标彼此竞争。建议拆成 Story Pass（生成旁白+追问+故事总结+`sceneBrief`）和 Illustrator Pass（只看 `sceneBrief`，只输出画面）。

**关键结论二——scene plan JSON 中间层。** 不要继续让模型输出"最终的 SVG 大字符串 blob"。更稳的做法是让模型先输出分层的场景计划（`far/mid/near` 三层、每个元素 `role`/`bbox`/`primitive`/`drawOrder`），再由本地编译器把这些结构化对象拼成 SVG。这符合 OmniSVG 论文"结构逻辑与低层几何分离"的研究方向。

**关键结论三——样式下放给编译器。** 模型只负责几何（画什么、在哪、大小、顺序），由本地后处理代码统一注入 `stroke="#211e18"`、`fill="none"`、`stroke-linecap="round"` 等样式属性。这样模型不需要在每次调用中重新记住样式规则。

**关键结论四——模型命名更新。** `deepseek-chat`/`deepseek-reasoner` 是兼容别名，计划于 2026-07-24 退役。应显式迁移到 `deepseek-v4-flash` / `deepseek-v4-pro`。

报告直接引用：

> "你真正错过的，不是某个神秘模型，而是三个非常工程化的护栏：任务拆分、结构化中间表示、自动验证与最小闭环。"

### 3.2 V2 调研：跳出 SVG 执念，探索更优媒介

> [完整报告](../../00_design/LLM%20生成儿童线稿动画的最佳媒介路径调研报告.md)

V2 调研将问题进一步升级：不把 SVG 当作唯一中间媒介，而是系统评估了 A-H 八种路线（共 101 行，关键结论摘录）：

**八条路线评估矩阵：**

| 方案 | 描述 | 结论 |
|---|---|---|
| A | LLM 输出场景 JSON，确定性渲染器画图 | **最推荐** |
| B | 图像生成 + 线稿提取 + 向量化 | 适合增强/备选，不做主路径 |
| C | LLM 生成 p5.js/Processing 绘图代码 | 可行但稳定性弱于 A |
| D | 预制 SVG 组件库，LLM 负责选件+排布 | 与 A 结合极佳 |
| E | LLM 输出骨架点，Bézier 插值+平滑 | 作为 A 的内部技术推荐 |
| F | LLM 输出 Logo/Turtle 绘图指令 | 很值得做成受限 IR |
| G | 单一多模态模型统一搞定 | 不推荐做主路径 |
| H | 研究型文本到矢量方法 | 知道即可，先不做 |

**最终推荐——A+D+E+F 融合架构：**

> "最推荐的主路线，是把 A、D、E、F 组合成一个统一架构：LLM 输出 scene plan / draw plan，组件库与参数化骨架负责造型，渲染器负责曲线和手绘风，动画层负责逐笔回放。"

报告直接引用（回归上一轮的发现）：

> "上一版关于 SVG 生成的三个发现——scene plan 分层、本地编译器、构图原型 few-shot——在这个新问题下仍然成立，而且反而更重要。"

**推荐的中间表示（自下而上）：**

```
角色类型 → 布局框 → 层级 → 动作 → 朝向 → 组件清单 → 关键点 → 每一笔的绘制顺序
```

### 3.3 为什么 A+D 混合优于纯 SVG 生成

| 维度 | 当前（LLM 直接写 SVG） | 方案 A+D（混合架构） |
|---|---|---|
| **LLM 做什么** | 写几何坐标（弱项）| 描述场景语义（强项） |
| **线条质量** | 崩、简陋、比例歪 | Paper.js 平滑曲线 + Rough.js 手绘感 |
| **速度** | ~0.5s（纯 LLM 推理）| ~0.5s（LLM 规划）+ ~0.01s（本地浏览器渲染） |
| **动画** | 靠 LLM 自己记住样式规则 | 笔顺在 scenePlan 中显示定义，渲染器按序播放 |
| **可控性** | 每次调用是黑盒，无法局部修复 | 组件库保证形状，渲染器保证风格，同一份 plan 多次渲染结果稳定 |
| **失败恢复** | 整段 SVG 推倒重来 | 单个组件可单独回退，不影响其他元素 |

---

## 4. 我们计划怎么做（A+D+E+F 混合架构）

### 4.1 新架构总览

```
用户说话 (ASR → 文字)
        │
        ▼
┌─────────────────────────────────────┐
│   Story Pass (LLM)                  │
│   输出: narration + followUpQuestion│
│         + storySummary + scenePlan  │
│   模型: DeepSeek v4-flash           │
│   耗时: ~0.5s                       │
└──────────────┬──────────────────────┘
               │ scenePlan JSON
               ▼
┌─────────────────────────────────────┐
│   本地确定性渲染器（浏览器端）        │
│                                     │
│   ┌─────────┐  ┌──────┐  ┌───────┐│
│   │ 组件库   │  │Paper │  │Rough  ││
│   │20-30 个 │→│ .js  │→│  .js  ││
│   │基础部件  │  │ 平滑 │  │手绘感 ││
│   └─────────┘  └──────┘  └───────┘│
│                                     │
│   输出: SVG + 逐笔动画数据          │
│   耗时: ~0.01s                      │
└──────────────┬──────────────────────┘
               │
               ▼
         SVG stroke-dashoffset 逐笔播放动画
```

**关键变化：LLM 只输出 scenePlan JSON，不再写任何 SVG 几何坐标。**

渲染层负责：组件匹配 → 骨架点 → Bézier 平滑/简化 → 手绘抖动 → SVG 导出 → 按 strokeOrder 逐笔注入 `stroke-dasharray`/`stroke-dashoffset`。

### 4.2 scenePlan 中间表示（IR）

这是 LLM 与渲染器之间的唯一契约。LLM 输出结构化 JSON，渲染器据此构图。

**完整 schema 示例**（"一只小猫坐在月亮上"）：

```json
{
  "scene": "一只小猫坐在月亮上，夜空里有两颗星星，它开心地往下看",
  "canvas": { "width": 400, "height": 300 },
  "background": {
    "sky": "night",
    "stars": 2,
    "ground": false
  },
  "layers": [
    {
      "name": "far",
      "elements": [
        { "id": "star_1", "type": "star", "at": [340, 30], "size": "small" },
        { "id": "star_2", "type": "star", "at": [60, 50], "size": "small" }
      ]
    },
    {
      "name": "mid",
      "elements": [
        { "id": "moon", "type": "moon", "at": [280, 100], "size": "large" },
        { "id": "moon_crater_1", "type": "crater", "at": [270, 88], "size": "small" },
        { "id": "moon_crater_2", "type": "crater", "at": [295, 110], "size": "small" }
      ]
    },
    {
      "name": "near",
      "elements": [
        { "id": "cat_body", "type": "cat_body", "at": [270, 128], "size": "small", "rotation": -10 },
        { "id": "cat_head", "type": "cat_head", "at": [258, 102], "size": "small", "rotation": 0 },
        { "id": "cat_eye_left", "type": "cat_eye", "at": [252, 98], "size": "tiny" },
        { "id": "cat_eye_right", "type": "cat_eye", "at": [264, 98], "size": "tiny" },
        { "id": "cat_mouth", "type": "cat_mouth_happy", "at": [258, 110], "size": "tiny" },
        { "id": "cat_tail", "type": "cat_tail", "at": [290, 135], "to": [310, 155], "size": "small" }
      ]
    }
  ],
  "mainCharacter": {
    "type": "cat",
    "pose": "sitting_on",
    "support": "moon",
    "facing": "down-left",
    "expression": "happy"
  },
  "strokeOrder": [
    "moon",
    "moon_crater_1", "moon_crater_2",
    "cat_body",
    "cat_head",
    "cat_tail",
    "cat_eye_left", "cat_eye_right",
    "cat_mouth",
    "star_1", "star_2"
  ],
  "compositionHints": {
    "mood": "calm_happy",
    "horizonLine": false,
    "suggestedVariation": "tail_curl"
  }
}
```

**设计要点：**

- **`layers`** 强制三层结构（`far`/`mid`/`near`），保证画面有空间深度
- **`elements[].type`** 是组件库的 key，渲染器查表匹配 SVG/Paper.js 模板
- **`at` / `to`** 是绝对坐标（400×300 画布），LLM 输出粗略位置，Paper.js 做最终平滑
- **`strokeOrder`** 显式定义每一笔的绘制顺序，避免遮挡关系错误
- **`mainCharacter.pose`** / **`facing`** / **`expression`** 是语义标签，渲染器根据标签选择组件变体（如 `pose="sitting_on"` → 腿弯曲坐在支撑物上）
- **`compositionHints`** 是可选的"导演备注"，帮渲染器做细节微调

### 4.3 技术选型

| 层 | 选型 | 理由 |
|---|---|---|
| **Story Pass** | DeepSeek v4-flash（非思考模式）| 已实测 ~0.5s，短文本重写+追问生成不依赖强几何能力；支持 JSON mode；DeepSeek prompt cache 命中率极高 |
| **scenePlan Pass** | DeepSeek v4-flash（同上）或 v4-pro | JSON Schema 结构语义任务，v4-flash 可能够用；若 schema 稳定性不够则升 v4-pro。V1 报告建议快模型写故事、强模型画图，但我们的"强模型"部分转化到了本地渲染器上 |
| **组件库** | 自建 20-30 个 SVG 基础部件 | 参考 Open Peeps 的 mix-and-match 模式，但对象更少、姿态更有限，复杂度更低。覆盖：恐龙（头/身体/四肢/尾巴/背鳍/眼/嘴）、猫（头/躯干/尾巴/眼/嘴/耳）、月亮、星星、花（花瓣/花芯/茎/叶）、蝴蝶（双翅/触角/身体）、云、地面线、陨石/流星 |
| **渲染器（曲线）** | Paper.js | Bézier 曲线原生支持；`smooth()` 和 `simplify()` 方法可直接用于四肢、尾巴、花茎等柔性部件；原生 `exportSVG()` 输出 |
| **渲染器（手绘感）** | Rough.js | 在 SVG 或 Canvas 上给组件路径叠加手绘抖动；可调节 `roughness`/`bowing`/`hachureGap` 参数，从"轻微手绘"到"大幅度涂鸦"可调 |
| **动画** | SVG `stroke-dashoffset` | 渲染器按 `strokeOrder` 给每条路径注入 `stroke-dasharray`（长度）+ `stroke-dashoffset`（从全长到 0），浏览器 CSS 动画驱动逐笔播放 |

**关于 Paper.js + Rough.js 的交互说明：**

三种可行的组合方式，按推荐优先级排序：
1. **组件库内嵌 Paper.js path → Paper.js 导出 SVG → Rough.js 对 SVG path 加抖动** —— 最自然，组件由 Paper 曲线定义，Rough 负责风格化
2. **组件库直接定义 SVG 字符串 → Rough.js 在 SVG 上绘制 ** —— 跳过 Paper，组件是预制的 SVG，Rough 只加抖动
3. **Paper.js canvas → Rough.js canvas → 再导出 SVG** —— 绕路但可行，适合需要复杂 Paper 曲线 + Canvas 级别 Rough 控制的场景

具体采用哪种组合，在 Phase 3 实测后选定。

### 4.4 实施步骤（4 阶段）

| 阶段 | 做什么 | 关键产出 | 验收标准 |
|---|---|---|---|
| **Phase 1** 拆 prompt + 定义 IR | 把当前 `COMBINED_SYS` 拆成 Story Pass 和 Scene Plan Pass；定义 scenePlan JSON Schema（含 Z od 校验）；跑一轮验收确保 schema 稳定命中 | 两个新 prompt 文件 + scenePlan TypeScript 类型定义 | 20 句测试故事，scenePlan schema 命中率 ≥ 90%，失败时有 JSON parse fallback |
| **Phase 2** 组件库 | 建 20-30 个基础 SVG 部件。手拼 10 张验证图，确保"不靠 LLM 也已经像绘本" | `lib/renderer/components/` 目录 + 10 张验证 SVG | 10 张手拼图全部通过"4 岁可辨识"检查（手动验证）；组件库导出统一的 `match(type, params)` 接口 |
| **Phase 3** 渲染器 + 手绘风 | 用 Paper.js + Rough.js 把 scenePlan 转成 SVG。同一份 plan 多次渲染结果稳定（确定性） | 确定性渲染器模块 + 3 个场景的渲染对比截图 | 同一 scenePlan 连续 5 次渲染的 SVG 内容逐字节一致；视觉上无明显几何漂移 |
| **Phase 4** 动画 + 评测 | 按 `strokeOrder` 注入 `stroke-dashoffset` 逐笔动画。选 20 句测试用故事，测延迟/识别率/喜欢度 | 播放器组件 + 评测报告 | 平均总延迟（LLM + 渲染 + 动画启动）< 8 秒；主角识别率 ≥ 80%（5 岁以下成人代测）；失败率 < 10% |

**实施顺序不可调换：** Phase 1 是基础设施（schema 是下游所有模块的共同契约），Phase 2 验证视觉可行性，Phase 3 是核心技术投入，Phase 4 是质量验证。如果时间不够，Phase 3 的 Paper.js 部分可以降级为"组件库直接拼 SVG + Rough.js 加抖动"（跳过 Bézier 曲线生成），Phase 4 的评测可以降到 5-10 句。

### 4.5 向后兼容

这个架构改造**不影响现有功能**，具体保障：

- **Story Pass 仍然输出 `narration` + `followUpQuestion` + `storySummary`** —— 三个字段的语义和格式与当前 `/api/story/generate` 响应完全一致，客户端 `app/page.tsx` 不做任何修改
- **`scenePlan` 是新增字段** —— 旧的响应 shape（`{ narration, svg, followUpQuestion, storySummary }`）不变，`scenePlan` 作为额外字段追加。老客户端忽略未知字段即可
- **SVG 仍然通过 `sanitizeSvg()` 安全过** —— 渲染器产出的 SVG 在返回客户端前经过同样的 sanitizer，安全保证不变
- **Phase 1/2 阶段保留 fallback 路径** —— 如果 scenePlan 解析失败或组件库覆盖不足（某些场景没有匹配的组件），退回到当前"LLM 直接写 SVG"路径，用户体验降级但不中断
- **语音识别（TASK-018 火山 ASR）完全不受影响** —— 不同模块，不同 API 路由，无耦合

---

## 5. 待外部评审确认的问题

以下是我们尚未最终确定的问题，需要外部 AI 独立判断：

### 5.1 技术可行性

1. **Paper.js + Rough.js 的组合在 <8s 总延迟约束下足够吗？** 我们的理解是：渲染完全在浏览器本地完成（Paper.js 和 Rough.js 都是纯 JS 库），不经过服务端，接近瞬时。但在低端设备（如旧 iPad）上，Paper.js 的 Bézier 计算 + Rough.js 的抖动算法是否会显著拖慢首帧渲染？有没有轻量替代建议？

2. **20-30 个基础部件的组件库是否能覆盖 4 岁儿童故事常见场景？** 我们设想的覆盖对象是：恐龙、猫、月亮、星星、花、蝴蝶、云、地面、陨石/流星、树、房子。有没有遗漏的关键部件？对于"未覆盖的场景"（如"小河"、"山"），推荐的 fallback 策略是什么——退回到 LLM 直接生成 SVG，还是用简单的几何形体（Paper.js circle + line）就地补？

### 5.2 设计决策

3. **scenePlan JSON Schema 的粒度是否合适？** 我们选择让 LLM 输出每个元素的 `at`（绝对坐标）而非相对布局。优势是渲染器不需要做布局推断，劣势是 LLM 仍然需要做一定的空间推理（"猫坐在月亮上→猫在月亮上方偏左"）。以你看到的 schema 示例，这个粒度是否合理？太粗会让组件匹配困难，太细又会让 LLM 回到"写坐标"——当前的平衡点对吗？

4. **如果 `strokeOrder` 定义不合理（如先画角色后画背景），遮挡关系是否可事后自动纠正？** 我们的渲染器可以按 `layers` 层级（far→mid→near）自动排序 `strokeOrder`，但如果有额外的语义依赖（如猫尾巴必须在猫身体之前画），自动排序可能不够。建议是完全信任 LLM 的 `strokeOrder`、完全以 `layers` 为准、还是两层并用？

5. **如果 Phase 2 做完但 Phase 3（Paper.js/Rough.js）效果不理想，退回单纯"scenePlan → 本地拼 SVG 组件（不用 Paper 曲线）"是否可接受？** 换句话说：Paper.js 的 Bézier 曲线平滑是必须的，还是"预制 SVG 组件 + Rough.js 加抖动"已经足够把画面从"涂鸦"提升到"绘本"？

6. **Story Pass 和 Scene Plan Pass 是两个独立 LLM 调用还是复用同一个模型？** 两个独立调用的优势是 prompt 更窄（每个 prompt 只专注一件事+任务不竞争） + 可用不同模型（v4-flash 写故事/v4-pro 出 plan）。劣势是延迟翻倍（~0.5s → ~1s）+ token 翻倍 + 两个 prompt 需独立维护。单次调用的优势是快+省，劣势是 prompt 又混入了两套目标。你建议哪种？如果在单次调用里让 LLM 同时输出文本字段+scenePlan（类似当前的 JSON shape 但把 svg 字段换成 scenePlan），是否可行？

### 5.3 架构考量

7. **渲染在浏览器端做 vs 服务端做？** 我们的默认假设是浏览器端渲染（Paper.js/Rough.js/SVG 导出都在前端完成），因为本地库不依赖服务端，延迟更低。但如果有复杂场景需要服务端预渲染（如组件匹配失败时的 Paper.js 紧急补图），把渲染器同时跑在 Vercel 函数里是否合理——还是最好坚持"渲染只在前端，服务端只返回 scenePlan"的简单分工？

8. **如果组件库一直长不大（始终只有 20-30 个部件），这个架构会不会限死故事场景的多样性？** 组件库的上限是"孩子绘本里常见的基础对象"——我们推测 30 个部件足够覆盖 80%+ 的常见场景。如果孩子说了一句"海底有发光水母"，组件库里没有水母，fallback 到 LLM SVG 产生一个糟糕的画面，会不会比"纯 LLM 直接画一只不存在的发光水母（反正也画不出来）"更糟？如何衡量这个 tradeoff？

---

## 6. 风险

| 风险 | 可能性 | 影响 | 缓解措施 |
|---|---|---|---|
| **组件库覆盖不足** | 中 | 中 | 场景未匹配到组件时 fallback 到当前"LLM 直接写 SVG"路径。Phase 2 先覆盖最高频对象（恐龙/猫/月亮/花/蝴蝶/星星/云/陨石）。Phase 4 评测中识别高频未覆盖场景并扩充 |
| **Paper.js 曲线与组件设计冲突** | 中 | 中 | 组件库里的 SVG path 交给 Paper.js 修改后可能导致风格不一致。Phase 3 先做 3 个场景的验证渲染，确认 Paper.js 不会破坏手绘风格的统一性。如果冲突严重，跳过 Paper.js 只保留 Rough.js |
| **Rough.js 手绘抖动过度** | 低 | 低 | 线条太乱不像"绘本"。Rough.js 参数可调（`roughness: 0.5~3`、`bowing: 0.5~3`），有完整的参数空间可探索。如果最轻档仍然过度，去掉 Rough.js 直接用平滑曲线 + SVG 原生的 `stroke-linecap="round"` 保持手绘温暖感 |
| **LLM 输出的 scenePlan JSON 不稳定** | 中 | 高 | Schema 校验 + Zod 解析 + 字段级 default value + 失败重试（最多 1 次）。App 层做 JSON 校验；校验失败的字段用默认值补上；如果整个 plan 不可解析，退回到当前 LLM SVG 路径 |
| **scenePlan Pass 增加延迟** | 低 | 中 | 如果把 scenePlan 输出放进现有的单次 LLM 调用（同一个 prompt 同时产出 narration + followUpQuestion + storySummary + scenePlan），延迟增量接近零（只是 JSON body 大了几百个 token）。如果是两次独立调用，每个 ~0.5s，总延迟 ~1s。实测后再定是单调还是双调 |
| **`strokeOrder` 与 `layers` 冲突** | 低 | 中 | 渲染器默认以 `strokeOrder` 为准，但如果检测到 `near` 层元素在 `far` 层之后绘制（通过 `layers` 对比），发出警告并自动调整顺序。Phase 4 评测中监控此警告触发频率 |
| **Phase 3/4 时间不够（deadline 紧迫）** | 中 | 高 | Phase 1（拆 prompt + 定义 IR）本身已提升 SVG 质量——"scenePlan → 本地拼组件"即使用最朴素的拼装也优于"LLM 盲写 SVG"。Phase 3 的 Paper.js 可降级为简单组件拼装；Phase 4 评测可降为手动验证 5 张图 |
| **浏览器兼容性（旧设备不支持 ES2020+ 模块）** | 低 | 低 | Paper.js 和 Rough.js 都是纯 JS 且无重型依赖，支持 Chrome 66+ / Safari 14.1+ / Firefox 76+。与 SayDraw 现有 Web Speech API 兼容矩阵一致。更老的设备已在语音识别侧回退到打字输入 |

---

## 审批

本文档供外部 AI 独立评审。评审完成后，SayDraw 团队将根据反馈修改方案，再创建正式执行计划（`TASK-020-*` 或更新本文档）并进入 Phase 1 执行。
