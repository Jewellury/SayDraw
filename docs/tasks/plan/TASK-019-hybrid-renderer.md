# TASK-019 v2：语义锚点 + 确定性布局（最小可行版）

## 外部评审核心反馈

> TASK-019 把"画 SVG"改名成"做空间规划"，LLM 仍然在背绝对坐标。真正脆弱的部分没消失。
> 建议：保留 DeepSeek 直出 SVG 为主路径，混合渲染只做少数高频失败场景的补强。
> IR 缩到"语义锚点 + 组件 id + 顺序"，渲染器负责坐标和间距。
> 先做一个可独立交付的最小阶段——只验一类场景混合渲染是否显著优于直出，再决定扩不扩。

## 修订后的方案

### 核心变化

| TASK-019 v1（被否决） | v2（修订） |
|---|---|
| LLM 输出 scenePlan JSON（含 bbox / layers / 坐标） | LLM 输出**纯语义描述**（角色 + 动作 + 从哪里来到哪里去 + 跟随什么 + 顺序） |
| 渲染器需要 Paper.js（新依赖） | 渲染器用**原生 SVG + Rough.js**（轻量） |
| 4 阶段全做（组件库 20-30 个） | **只做一个 MVP 阶段**：验一类场景 |
| 替换全链路 | **补强**直出 SVG 的高频失败场景 |\n\n### 新 IR：语义锚点（不是空间锚点）\n\nLLM 只输出这些：\n\n```json\n{\n  \"scene\": \"小猫坐在月亮上\",\n  \"components\": [\n    { \"id\": \"moon\",     \"role\": \"support\",   \"drawOrder\": 1 },\n    { \"id\": \"cat_body\", \"role\": \"character\", \"drawOrder\": 2 },\n    { \"id\": \"cat_head\", \"role\": \"character\", \"drawOrder\": 3 },\n    { \"id\": \"cat_eyes\", \"role\": \"detail\",    \"drawOrder\": 4 },\n    { \"id\": \"cat_tail\", \"role\": \"character\", \"drawOrder\": 5 },\n    { \"id\": \"star\",     \"role\": \"background\",\"drawOrder\": 0 }\n  ]\n}\n```\n\n**LLM 不再写任何坐标**。渲染器根据 `role` 规则自动布局：\n- `support` → 画布中下\n- `character` → 居中叠加在 support 上方\n- `detail` → 跟随最近的 character\n- `background` → 随机分布上半画布\n\n```\nRenderer 做的事：\n  components[]  +  role rules  →  自动布局  →  Rough.js 手绘风格  →  SVG  +  stroke-dashoffset 逐笔\n```\n\n### MVP 阶段：只验一类场景\n\n**范围**：只做"角色坐在支撑物上"这一种构图（猫坐月亮、恐龙坐石头、蝴蝶停花朵）\n\n**要做的**：\n1. 建 8-10 个基础 SVG 部件（猫头/猫身/猫尾、恐龙、月亮、石头、花朵、蝴蝶翅膀、星星、地面）\n2. 写一个轻量渲染器：读 components[] + role rules → 自动布局 → Rough.js 风格 → SVG String\n3. 写一个新的 prompt 段（只让 LLM 输出 components[]，不需要坐标）\n4. 做一个 side-by-side 对比：同一句话，直出 SVG vs 语义锚点渲染\n\n**不要做的**：\n- 不建 Paper.js 依赖（用原生 SVG）\n- 不做 20-30 个部件（8-10 个够了）\n- 不替换主路径（直出 SVG 仍在，新路径是旁路）\n\n### 向后兼容\n\n- 现有 `/api/story/generate` 不变。新版加一个 `?strategy=semantic` query param，不传就走旧直出路径\n- 如果渲染器组件不够覆盖，fallback 到直出 SVG\n- 语音识别（TASK-018）完全不受影响\n\n## 验收标准\n\n1. 同一句话（如"小猫坐在月亮上"），语义锚点路径产出的 SVG 在肉眼上明显优于直出 SVG\n2. 渲染器在浏览器本地运行，不增加 API 调用\n3. 不影响现有直出 SVG 路径\n4. 组件数 < 12，方便维护\n\n## 修改后的文件范围（比 v1 更小）\n\n| File | Action | Purpose |\n|------|--------|---------|\n| `lib/ai/prompts.ts` | MODIFY | 加一段 SEMANTIC_SYS prompt，让 LLM 输出 components[] |\n| `lib/ai/provider.ts` | MODIFY | 加 semantic 分支（复用现有 resolver） |\n| `app/api/story/generate/route.ts` | MODIFY | 读 `?strategy=semantic`，走新路径 |\n| `lib/svg/componentLib.ts` | NEW | 8-10 个 SVG 部件的纯函数库 |\n| `lib/svg/semanticRenderer.ts` | NEW | 读 components[] + role rules → 自动布局 → 加 Rough.js 扰动 → 出 SVG string |\n| `lib/svg/roughSvg.ts` | NEW | Rough.js 包装（对 SVG 路径加手绘抖动） |\n| `package.json` | MODIFY | 加 `roughjs` 依赖（约 15KB，无其他依赖） |\n\n**新依赖**：仅 `roughjs`（15KB，用于给 SVG 线条加手绘抖动感）。不做 Paper.js。\n\n## 不做的（明确排除）\n\n- Paper.js 依赖\n- 组件库 > 12 个部件\n- 替换主路径（直出 SVG 仍是默认）\n- scenePlan 含坐标的 IR\n- 20 句评测套件\n\n## 审批\n\n方案经外部 AI 评审后修订。TASK-019 目前未设置 active_spec，等待用户确认后进入执行。