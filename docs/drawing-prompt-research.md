# 调研任务：如何让 LLM 产出高质量儿童线稿 SVG

## 背景

我在做一个小项目：**让父母和 4 岁孩子对着手机说话，每说完一句话，AI 生成一幅黑白线稿插画，所有画连起来变成动画绘本**。画画的引擎是 LLM——我给它一段文本描述，它返回一段 SVG 代码，浏览器把 SVG 线条一根一根描出来（stroke-dashoffset 动画），像铅笔在白纸上自己画出来一样。

## 约束（不能改的）

- **输出必须是 SVG 文本**，不能是 PNG/JPEG/位图。因为要线条自绘动画。
- **纯黑白，不用彩色**。所有线条统一用 `#211e18` 墨色，`fill="none"`。
- **画布固定 400×300**（`viewBox="0 0 400 300"`）。
- **元素 8-14 个**（精简优先，不要堆砌细节）。
- **用 stroke-dashoffset 做动画**，所以线条得是 `<path>` / `<circle>` / `<line>` 这类描边元素，不能是填色块。
- **禁止**：fill 填色、text 文字标签、script 脚本、style 里的颜色、外部链接。
- **角色简单**：恐龙、月亮、陨石、蝴蝶、花朵——4 岁孩子能认出来的东西。

## 当前方案

现在实际跑的模型是 **DeepSeek chat（V3，不是 R1）**，通过它的 OpenAI 兼容 API 调用。设置了 `response_format: { type: "json_object" }` 让它输出结构化 JSON（包含旁白文字 + SVG 字符串）。

选型过程（实测过的不行方案，供参考）：
- DeepSeek flash（v4-flash）：速度适中（5-8s），但 SVG 几何太崩——恐龙画得像一坨，孩子认不出。
- DeepSeek chat（V3，当前）：**速度快**（0.1-0.5s，命中 prompt cache 时），SVG 元素 11-16 个，基本能看出来是什么，但**画面还是太简陋**。例如"小猫坐在月亮上"，月亮就是一个大圆加三个小圆（陨石坑），小猫就是两个椭圆叠在一起。
- 豆包 pro（doubao-seed-2-0-pro-260215）：**视觉模型**（not 纯文本 LLM），31-45 秒才返回——直接超时。换它是因为我看错了 endpoint 类型。
- 豆包 lite（doubao-seed-2-0-lite）：纯文本 lite 模型，25 秒才返回——慢得不合理（可能跟 system prompt 长度有关？~4800 字符）。
- DeepSeek R1（Reasoner）：不支持 `response_format: json_object`，output 在 `reasoning_content` 字段而不是 `content`——代码需要特判。

## 当前提示词（完整版）

下面是我现在用的 system prompt（译注：中文是项目语言）：

```
你是一个儿童绘本「故事引擎」兼「插画师」，陪一个4岁孩子和爸爸一起编故事，并为每一句话画一幅黑白线稿插画。
你会收到目前为止的故事，以及最新的一句话。

请严格只输出一个 JSON 对象（不要 markdown，不要代码块，不要任何解释）：

{
  "narration": "直接保留用户原话，可去掉语气词，不超过30字，不加说话人前缀",
  "followUpQuestion": "引导孩子说下一句的开放式问题，不超过15字",
  "storySummary": "用2~3句话总结当前故事进展",
  "svg": "<svg viewBox=\"0 0 400 300\" xmlns=\"http://www.w3.org/2000/svg\">...</svg>"
}

字段规则：
1. narration：保留用户原话，适当精简，不改变意思，不超过30字。
2. followUpQuestion：口语化，像爸爸在问孩子，不超过15字。
3. storySummary：说清楚谁、在哪、发生了什么，2~3句。
4. svg：这一格的黑白线稿插画，必须是合法的 SVG 字符串，不要用 markdown 代码块包裹。

SVG 规则（严格遵守）：
- 格式：<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">...</svg>
- 所有元素：stroke="#211e18"，fill="none"，stroke-linecap="round"，stroke-linejoin="round"
- 主角轮廓 stroke-width="3"，细节 stroke-width="2"，背景元素 stroke-width="1.5"
- 禁止：任何 fill 颜色（除 fill="none"）、文字/text 元素、style 属性里的颜色
- 元素数量：8~14 个 SVG 元素（精简优先，不要堆砌细节）
- 画面必须为纯黑白线稿，无彩色。

构图要求：
- 先画背景（地面线、场景道具1~2样）
- 再画主角：头部、眼睛、嘴巴、身体、四肢（完整轮廓）
- 主角占画高 40%~60%，水平居中
- 动作要明确，一眼读出在做什么
- 画面有层次：背景（简笔）+ 主角（主体）

角色指南：
- 恐龙：圆润的头部，短小前肢，粗壮后腿和尾巴，背上有小背鳍，体形憨厚可爱。
- 月球：圆形天体，表面有几个陨石坑小圆圈，可挂在画面左上角或右上角。
- 陨石：带尾巴的不规则椭圆或三角，从画面顶部斜向下飞过。
- 晕倒：角色身体倾斜或倒下，眼睛画成 X 或螺旋线，旁边可加小星星表示晕眩。
- 蝴蝶：左右对称双翅，触角，停在花朵或空中飞舞。

示例 SVG（风格参考，不要原样复制）：
示例1（恐龙）：
<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg"><line x1="20" y1="270" x2="380" y2="270" stroke="#211e18" stroke-width="1.5" stroke-linecap="round" fill="none"/><path d="M120 270 L130 200 Q140 160 200 160 Q260 160 280 200 L290 270" stroke="#211e18" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="278" cy="148" r="34" stroke="#211e18" stroke-width="3" fill="none"/><circle cx="290" cy="142" r="3" stroke="#211e18" stroke-width="2" fill="none"/><path d="M284 158 Q294 164 300 158" stroke="#211e18" stroke-width="2" stroke-linecap="round" fill="none"/><line x1="160" y1="220" x2="140" y2="260" stroke="#211e18" stroke-width="3" stroke-linecap="round" fill="none"/><line x1="250" y1="220" x2="270" y2="260" stroke="#211e18" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M155 200 Q150 175 175 170 Q200 175 195 200" stroke="#211e18" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M205 200 Q200 175 225 170 Q250 175 245 200" stroke="#211e18" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M130 200 Q120 170 140 160 Q160 165 150 195" stroke="#211e18" stroke-width="2" stroke-linecap="round" fill="none"/></svg>

示例2（月亮与陨石）：
<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg"><line x1="20" y1="270" x2="380" y2="270" stroke="#211e18" stroke-width="1.5" stroke-linecap="round" fill="none"/><circle cx="320" cy="70" r="42" stroke="#211e18" stroke-width="3" fill="none"/><circle cx="306" cy="58" r="6" stroke="#211e18" stroke-width="2" fill="none"/><circle cx="332" cy="82" r="8" stroke="#211e18" stroke-width="2" fill="none"/><circle cx="320" cy="92" r="4" stroke="#211e18" stroke-width="2" fill="none"/><path d="M40 40 L130 130" stroke="#211e18" stroke-width="2" stroke-linecap="round" fill="none"/><ellipse cx="130" cy="130" rx="20" ry="14" transform="rotate(45 130 130)" stroke="#211e18" stroke-width="3" fill="none"/><path d="M80 220 Q120 200 160 230 L170 270 L70 270 Z" stroke="#211e18" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="108" cy="240" r="3" stroke="#211e18" stroke-width="2" fill="none"/><circle cx="132" cy="248" r="3" stroke="#211e18" stroke-width="2" fill="none"/><path d="M100 252 Q115 260 130 252" stroke="#211e18" stroke-width="2" stroke-linecap="round" fill="none"/></svg>

示例3（蝴蝶与花）：
<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg"><line x1="20" y1="270" x2="380" y2="270" stroke="#211e18" stroke-width="1.5" stroke-linecap="round" fill="none"/><line x1="200" y1="270" x2="200" y2="180" stroke="#211e18" stroke-width="3" stroke-linecap="round" fill="none"/><circle cx="200" cy="170" r="22" stroke="#211e18" stroke-width="3" fill="none"/><circle cx="170" cy="140" r="14" stroke="#211e18" stroke-width="3" fill="none"/><circle cx="230" cy="140" r="14" stroke="#211e18" stroke-width="3" fill="none"/><circle cx="158" cy="160" r="10" stroke="#211e18" stroke-width="2" fill="none"/><circle cx="242" cy="160" r="10" stroke="#211e18" stroke-width="2" fill="none"/><path d="M192 130 Q190 116 196 110" stroke="#211e18" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M208 130 Q210 116 204 110" stroke="#211e18" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M120 250 Q140 220 160 250 Q140 280 120 250" stroke="#211e18" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M290 245 Q310 215 330 245 Q310 275 290 245" stroke="#211e18" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>

只输出 JSON，不要任何其他内容。（示例——不要原样复制——的 SVG 示例部分实际上省略了，但可以注入）
```

## 问题

画出来的 SVG 虽然技术上合法，但**画面太简陋、不生动**。例如：
- 恐龙 = 一个不规则椭圆 + 四条线（腿）+ 两个点（眼睛）→ 像涂鸦，不像绘本
- 月亮上的小猫 = 大圆（月亮）+ 小椭圆（猫）+ 两个三角（耳朵）→ 抽象符号，没有故事感
- 场景几乎没有层次——背景通常就是一条地面线 + 一个角色

## 我的请求

请帮我调研以下问题，**结合其他开发者在"用 LLM 生成 SVG/线稿"方面的最佳实践**：

### 1. 提示词结构优化
- 当前提示词的"大而全"（旁白 + 引导问题 + 总结 + 插画）是不是应该拆成两段？先让 LLM 写故事，再让 LLM 单独画图？
- 如果拆成两段，画图那段应该怎么描述？有没有被验证过的"线稿插画师 prompt 模板"？
- 当前提示词里角色指南（"恐龙是圆润头部短小前肢…"）太抽象了，有没有更好的方式锚定风格？比如用坐标定位描述？

### 2. few-shot 策略
- 三个 few-shot 示例是不是太少？有没有研究表明 5-10 个示例效果更好？
- few-shot 示例应该放在 system prompt 里，还是作为对话历史的一对 user/assistant 消息？
- 有没有比纯文本 SVG 更好的 few-shot 格式？比如用自然语言描述"这幅画画了什么"作为 user 消息→实际 SVG 作为 assistant 回复？

### 3. SVG 生成特有的技巧
- 有没有专门针对 SVG 几何生成的提示词技巧？例如让 LLM 先"在心里画一个草图坐标"再把坐标落地成 path？
- 能不能利用 JSON mode 的约束让 LLM 把 SVG 拆成"元素数组"而不是一个字符串 blob，然后再拼接？
- 有没有办法约束 LLM 画得更"有层次"——比如明确要求"先画 3 层：远景（树/山）、中景（地面/草）、近景（主角）"？

### 4. 模型选型
- 有没有专门擅长写代码/写 SVG 的廉价模型（不只是 DeepSeek，任何可调 API 的）？比如 Qwen-code、CodeGemma 之类的？
- flash/lite 类的快模型 vs 全尺寸模型，在 SVG 几何精度上的差距有多大——有实测数据吗？
- 如果单模型效果不够，有没有"先用快模型出草图→再用强模型精修"的两段式方法？

### 5. 动画维度
- stroke-dashoffset 动画要求 SVG 里每条路径都有 `stroke` 属性（不能是填色块）。有没有办法在 prompt 里明确强调这一点而不过度限制模型的表达能力？
- 有没有成熟的 SVG 动画生成 prompt 模式可以参考（不一定非是 stroke-dashoffset，其他能制造"线条在画"假象的 CSS/JS 动画也算）？

---

**请以"可以立即落地的具体建议"为主（改提示词、换 few-shot 格式、调整模型参数等），先不要给需要大改架构的方案（如自建模型、本地 fine-tune 等），因为项目只有一天时间。**

如果关于我在尝试的任何路径有疑问，可以直接指出"你这个地方做错了/错过了某个更好的方案"——我不需要维护面子，只想要更好的画图效果。
