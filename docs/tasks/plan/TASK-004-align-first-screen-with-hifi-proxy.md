# TASK-004: align-first-screen-with-hifi-proxy

Lifecycle: tracked in `docs/tasks/active_spec.md` and `docs/tasks/progress.md`
Owner Flow: plan-agent -> execute-agent -> audit-agent

## Background

TASK-001 created a warm-paper skeleton scored 22/100 against `HuaHuaBen.jsx`（高保真图可读代理）。骨架有方向但外观仍像 scaffold，非产品首屏。本轮以 `HuaHuaBen.jsx` 为基准，将 layout / SVG / 动画 / 质感 / 组件布局一次性对齐，不碰 playback/AI/voice/hint。

## Goal

将首屏改造为与 `HuaHuaBen.jsx` 视觉结构高度一致的页面：品牌 header、animated seed SVG 故事卡（旁白 + dot + 页码）、胶片条、footer 区说话人切换、统一药丸 input bar、纸纹背景、移动端窄屏适配。

## Non-goals

- Playback modal / dark theater（→ TASK-005）
- "接下来呢？" hint 按钮和提示（→ TASK-005）
- AI / DeepSeek API 集成（→ 后续）
- 语音输入（→ 后续）
- 多帧故事逻辑
- 新增 npm 依赖（`lucide-react` 未安装，图标全部手写内联 SVG）
- 修改 `tailwind.config.ts`、`docs/00_design/`、`docs/_archive/`

## Design Source

| Priority | Source | Use |
|----------|--------|-----|
| 1 | `docs/00_design/HuaHuaBen.jsx` | 高保真图可读代理：CSS 精确值、SEED_SVG、组件布局顺序、移动端断点 |
| 5 | `docs/00_design/frontend_design_spec.md` | 颜色 token、字体、纸纹 spec |
| 7 | `docs/00_design/design_brief.md` | 开场场景要求 |

### 图标方案

`lucide-react` 未安装。全部图标手写内联 SVG：BookOpen / Play / RotateCcw / Mic（沿用现有）/ Send。

### 关键 CSS 值对照

| 元素 | 原型 | TASK-004 目标 |
|------|------|---------------|
| Root | max-width 760px, centered | 同原型 |
| Board radius | 8px | 同原型 |
| Board border | 2.5px solid | 同原型 |
| Board padding | 24px 22px 16px | 同原型 |
| Tape | 120×24px, dashed border | 同原型 |
| 旁白 | Ma Shan Zheng 23px lh 1.5 | 同原型 |
| Dot | 11px circle | 同原型 |
| 页码 | Noto Serif SC 12px opacity .5 | 同原型 |
| 胶片框 | 86×66px radius 6px | 同原型 |
| Input pill | 统一药丸 radius 50px, shadow 4px 5px 0 | 同原型 |
| Mic | 42px, pill 内部 | 同原型 |
| Send | padding 11px 20px, 16px | 同原型 |
| @media ≤520px | title 24px, narration 20px, send span hidden | 同原型 |

## Files In Scope

| File | Action | Agent |
|------|--------|-------|
| `docs/tasks/plan/TASK-004-align-first-screen-with-hifi-proxy.md` | 本文件 | plan-agent |
| `docs/tasks/progress.md` | 新增 TASK-004 行 | plan-agent |
| `app/page.tsx` | 重写 | execute-agent |
| `app/globals.css` | 新增纸纹 + draw 动画 + 窄屏 @media | execute-agent |
| `docs/tasks/execution-log/TASK-004-align-first-screen-with-hifi-proxy.md` | 创建 | execute-agent |
| `docs/tasks/artifacts/TASK-004-align-first-screen-with-hifi-proxy/` | 截图证据 + pre-edit 备份 | execute-agent |
| `docs/tasks/audit-report/TASK-004-align-first-screen-with-hifi-proxy.md` | 创建 | audit-agent |

## Forbidden Changes

- `docs/00_design/`, `docs/_archive/`
- `AGENTS.md`, `README.md`
- `package.json`, `package-lock.json`
- `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`
- `.eslintrc.json`, `.env.example`, `.gitignore`
- `node_modules/`

## Acceptance Criteria

### 布局与结构
- [AC1] Header：BookOpen 内联 SVG + "画话本"（ZCOOL KuaiLe ~30px）+ 副标题（Noto Serif SC 12px），右侧 Play + RotateCcw ghost buttons（占位 no-op）。
- [AC2] 说话人切换位于 footer 区靠近 input bar，不在页面顶部。
- [AC3] Input 为统一药丸（radius 50px, 2.5px border, 4px 5px 0 shadow, padding 6px 6px 6px 8px），内含 mic（42px）→ text input → send（"画出来"）。

### Seed SVG 与动画
- [AC4] 故事卡显示 SEED_SVG（陨石+小恐龙），内联 React 元素渲染（非 dangerouslySetInnerHTML）。
- [AC5] 加载时 SVG 自绘动画 ~1.5s，元素错峰延迟（nth-child 2: 0.15s, 3: 0.3s, 4: 0.45s, 5+: 0.6s）。

### 故事卡细节
- [AC6] 旁白：Ma Shan Zheng ~23px lh 1.5，前 11px dad 色圆点。
- [AC7] 右下角 "第 1 / 1 格"（Noto Serif SC 12px opacity 0.5）。
- [AC8] Board：radius 8px, 2.5px border, padding 24px 22px 16px。

### 质感
- [AC9] 背景 dot grid + 纸纹噪声（SVG feTurbulence, opacity ~6%）。

### 胶片条
- [AC10] 胶片框 86×66px radius 6px，当前帧高亮（ink border, 3px 3px 0 shadow, translateY -2px），缩略图含 seed SVG 缩小版。

### 移动端
- [AC11] @media ≤520px: title 24px, narration 20px, send 文字隐藏仅显示图标。

### 技术
- [AC12] tsc --noEmit 通过。
- [AC13] npm run build exit 0。
- [AC14] 无新增 npm 依赖。
- [AC15] Seed SVG 仅用 `--ink` 颜色。

## Test First Plan

1. 基线确认 tsc + build 通过。
2. 写代码前确认 gap 存在（无 header/speaker 在顶部/无 SVG 动画/无纸纹/非统一 pill/无旁白页码/无窄屏）。
3. 先写 globals.css（纸纹 + draw 动画 + @media）。
4. 重写 page.tsx。
5. tsc → build → dev server → 浏览器截图（desktop/tablet/mobile）。

## Implementation Strategy

### Phase 1: CSS（globals.css）
1. 纸纹噪声 overlay（body ::before, feTurbulence, opacity 6%）。
2. Draw 动画：stroke-dasharray 700, hbDraw 1.5s, nth-child 延迟。
3. 窄屏 @media：title/narration 缩小, send span 隐藏。

### Phase 2: 页面重写（page.tsx）
1. Root: max-width 760px centered。
2. Header: logo + 两个 ghost button。
3. Main: Board（tape + draw-anim SVG + 旁白 dot + 页码）+ Filmstrip（1 frame）。
4. Footer: 说话人切换行 + 统一 input pill（mic → input → send）。

### Phase 3: 验证
tsc → build → dev server。15 AC 逐一确认。截图保存。

## Risks

- SEED_SVG 转 React JSX 是机械 1:1 映射，无风险。
- feTurbulence 低端设备轻微性能影响，可降 opacity 到 4%。
- 字体 FOUT 接受为 MVP 已知问题。
- 窄屏 send 图标在 pill 内部，42px 高度可点击。

## Rollback

工作区不是 git repo，回滚通过预编辑备份实现：

1. execute-agent 在修改前将 `app/page.tsx` 和 `app/globals.css` 复制到 `docs/tasks/artifacts/TASK-004-align-first-screen-with-hifi-proxy/pre-edit/`。
2. 如需回滚：从 `pre-edit/` 复制回 `app/`，覆盖修改后的版本。
3. TASK-004 的任务文件（plan / exec-log / audit-report）保留不删，将 status 改为 `blocked` 或 `reverted`，在 execution-log 中记录回滚原因和恢复的文件。

## Approval

计划草案。等待用户确认后，由 plan-agent 将 TASK-004 标为 `approved`，写入 `docs/tasks/active_spec.md`，更新 `docs/tasks/progress.md`（status: approved, Active: Yes）。然后 coordinator 启动 execute-agent。
