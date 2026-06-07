# TASK-006: match-huahuaben-screenshot-first-screen

Lifecycle: tracked in `docs/tasks/active_spec.md` and `docs/tasks/progress.md`
Owner Flow: plan-agent -> execute-agent -> audit-agent

## Background

TASK-004 aligned the first screen with HuaHuaBen.jsx code values, but user screenshot comparison reveals remaining visual gaps. The reference screenshot shows: a board that dominates the page, 3 filmstrip frames, a "接下来呢？" hint button, disabled grey send, and proportions/spacing that don't match the current output. This task targets the remaining mismatches.

## Goal

Close the visual gap between the current page and the HuaHuaBen.jsx reference screenshot. Six specific changes: hint button, 3-frame filmstrip, page number "第 1 / 3 格", disabled send button, board/SVG proportions, vertical rhythm.

## Non-goals

- Real hint generation (AI call)
- Real playback modal
- Real story generation or multi-frame state logic
- Voice recording
- AI/DeepSeek integration
- New npm dependencies
- Modifying `tailwind.config.ts`, `docs/00_design/`, `docs/_archive/`

## Design Source

| Priority | Source | Use |
|----------|--------|-----|
| 1 | User-provided HuaHuaBen.jsx reference screenshot | Visual oracle for proportions, spacing, component states |
| 2 | `docs/00_design/HuaHuaBen.jsx` | CSS values for hint button, frame styling, disabled send |

## Files In Scope

| File | Action | Agent |
|------|--------|-------|
| `app/page.tsx` | Edit: add hint button, 3-frame filmstrip, page number, disabled send, proportion tuning | execute-agent |
| `app/globals.css` | Edit: hint button styles, filmstrip adjustments, send disabled style, board proportion | execute-agent |
| `docs/tasks/artifacts/TASK-006-match-huahuaben-screenshot-first-screen/reference-huahuaben-gemini.png` | 保存用户提供的参考截图，作为 audit 对比基准 | execute-agent |
| `docs/tasks/plan/TASK-006-match-huahuaben-screenshot-first-screen.md` | 本文件 | plan-agent |
| `docs/tasks/progress.md` | 新增 TASK-006 行 | plan-agent |
| `docs/tasks/execution-log/TASK-006-match-huahuaben-screenshot-first-screen.md` | 创建 | execute-agent |
| `docs/tasks/artifacts/TASK-006-match-huahuaben-screenshot-first-screen/` | 截图证据 | execute-agent |
| `docs/tasks/audit-report/TASK-006-match-huahuaben-screenshot-first-screen.md` | 创建 | audit-agent |

## Forbidden Changes

- `docs/00_design/`, `docs/_archive/`
- `AGENTS.md`, `README.md`
- `package.json`, `package-lock.json`
- `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`
- `.eslintrc.json`, `.env.example`, `.gitignore`
- `node_modules/`

## Acceptance Criteria

### 组件
- [AC1] "接下来呢？" ghost button 出现在 speaker row 右侧：sparkle 内联 SVG 图标 + 文字，与 爸爸说/宝宝说 pills 同排对齐。
- [AC2] Filmstrip 有 3 个 frame：frame 1 高亮（ink border + shadow + translateY -2px），frame 2/3 未高亮（opacity 降低 + 浅色 border），每个 frame 显示编号（1/2/3）。
- [AC3] Frame 2/3 的缩略图使用与 frame 1 不同的简单黑白线稿 SVG（避免三帧完全相同），可用 FALLBACK_SVG（笑脸弧线）或简化的第二/三格 placeholder。
- [AC4] 页码显示 "第 1 / 3 格"（非 "第 1 / 1 格"）。
- [AC5] Send 按钮默认为 grey/disabled 外观：opacity ~0.4, 无 pointer cursor，视觉上不可点击（实际仍为 no-op）。

### 比例与节奏
- [AC6] Board 在 760×744 视口中高度约 430–470px（参考截图中 board 占屏幕高度 ~69%，y≈82 到 y≈517）。board 内 SVG 居中偏上，旁白紧贴 SVG 下方。filmstrip 顶部紧接 board 下方，底部 input pill 仍完整可见无需滚动。
- [AC7] 垂直顺序匹配参考截图：header → board → filmstrip → speaker/hint row → input pill，间距与截图接近。

### 技术
- [AC8] `tsc --noEmit` 通过。
- [AC9] `npm run build` exit 0。
- [AC10] 仅修改 `app/page.tsx` 和 `app/globals.css`，无 forbidden files 被改动。
- [AC11] 无新增 npm 依赖。

### 截图证据（强制）
- [AC12] Desktop 截图（720-760px 宽）保存到 `docs/tasks/artifacts/TASK-006-match-huahuaben-screenshot-first-screen/desktop-760.png`。
- [AC13] Mobile 截图（390×844）保存到 `docs/tasks/artifacts/TASK-006-match-huahuaben-screenshot-first-screen/mobile-390x844.png`。
- [AC14] 以 `reference-huahuaben-gemini.png` 为对比基准：desktop 截图（720–760px 宽）必须首屏内同时可见 header、完整 board、3-frame filmstrip、speaker/hint row、input pill。若任一项需要滚动才能看到 → AC14 不通过。checklist 逐项确认：组件顺序、board 比例（~69% 视口高度）、filmstrip 帧数（3）、hint 按钮位置（speaker row 右侧）、send disabled 外观（灰色 opacity 0.4）、页码（第 1 / 3 格）。

## Test First Plan

1. 基线：tsc + build 确认当前通过。
2. Pre-edit 备份 `app/page.tsx` 和 `app/globals.css` 到 `docs/tasks/artifacts/TASK-006-match-huahuaben-screenshot-first-screen/pre-edit/`。
3. 编辑 CSS：hint button、frame styling、send disabled、board 比例。
4. 编辑 JSX：hint button 组件、3 frame filmstrip、页码文字、send 状态。
5. tsc → build → dev server。
6. 截图 desktop 760×744 + mobile 390×844。
7. 对比参考截图 checklist。

## Implementation Strategy

### Phase 1: CSS（globals.css）
1. 新增 `.hb-spark` 样式：ghost button 右侧对齐，sparkle 图标 + 文字 "接下来呢？"。
2. 调整 `.hb-board`：增大 min-height 或 padding 使 board 占更大视觉比例。
3. `.hb-send` disabled 外观：opacity 0.4。
4. Frame 非高亮态：opacity 0.6, border-color var(--ink-soft)。

### Phase 2: JSX（page.tsx）
1. Speaker row 右侧添加 hint button：`<button className="hb-spark">` 含 sparkle SVG + "接下来呢？"。
2. Filmstrip 从 1 帧扩展为 3 帧：frame 1 = SEED_SVG, frame 2 = FALLBACK_SVG（笑脸弧线）, frame 3 = 简化的第三个 placeholder SVG。Frame 1 on class，frame 2/3 无 on class。
3. 页码改为 "第 1 / 3 格"。
4. Send button 默认 disabled 外观：`className="hb-send"` 无额外 class，靠 CSS opacity 0.4 控制。

### Phase 3: 截图验证
截图 → 对比检查清单 → 保存到 artifacts。

## Risks

- **Board 比例**：增大 board min-height 可能在窄屏撑破布局，需在 @media ≤520px 加限制。
- **Frame 2/3 SVG**：FALLBACK_SVG 比 SEED_SVG 简单很多（4 个元素 vs 17 个），board 和 filmstrip 内视觉差异明显是预期的。
- **HuaHuaBen.jsx 参考截图中 send 是 grey**：但原型 send 在 loading 时才 disabled。TASK-006 将 send 固定为 disabled 外观，这是静态视觉对齐，不影响未来加功能。

## Rollback

1. 从 `docs/tasks/artifacts/TASK-006-match-huahuaben-screenshot-first-screen/pre-edit/` 恢复 `app/page.tsx` 和 `app/globals.css`。
2. TASK-006 任务文件保留，status 改为 `blocked` 或 `reverted`。
