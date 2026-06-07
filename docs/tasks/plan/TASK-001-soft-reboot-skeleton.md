# TASK-001: soft-reboot-skeleton

Lifecycle: tracked in `docs/tasks/active_spec.md` and `docs/tasks/progress.md`
Owner Flow: plan-agent -> execute-agent -> audit-agent

## Background

The root directory contains a premature AI scaffold (2026-06-06 17:24, mirrored in `docs/_archive/raw-ai-scaffold-20260606-1724/`). This scaffold was built before the hi-fi design spec was finalized, before the task management system was established, and uses a generic gray mobile layout that does not match the warm paper sketchbook direction. The codebase already documents this: `docs/reference/codex_long_term_memory.md` line 35 says "should not continue refining the premature gray mobile scaffold as the production UI."

The active README.md references `docs/product-brief.md` and `docs/technical-plan.md` which no longer exist in the active `docs/` root (only in `_archive`). The `tsconfig.tsbuildinfo` build artifact is present but not git-ignored.

Per user decisions from the audit:
- `lib/svg/sanitizeSvg.ts`, `lib/analytics/events.ts`, `lib/analytics/track.ts` are reference only — do NOT inherit files into new implementation.
- Old `product-brief.md` / `technical-plan.md` stay in `_archive` — do NOT merge back.
- New implementation rebuilds fresh from `docs/00_design/`.

## Goal

1. Archive the current implementation layer into `docs/_archive/pre-tooling-scaffold-20260606/`.
2. Create a clean, minimal Next.js skeleton that boots, renders a single page, and demonstrates the warm paper design tokens from `docs/00_design/frontend_design_spec.md`.
3. Clean stale files: README.md, tsconfig.tsbuildinfo, .gitignore.

## Non-goals

- Implementing any story logic, DeepSeek calls, SVG generation, voice input, or Novus tracking.
- Changing `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `.eslintrc.json`, `.env.example` — these configs are fine as-is.
- Installing new npm dependencies.
- Deleting `node_modules/`.
- Modifying `docs/00_design/`, `docs/_archive/raw-ai-scaffold-*`, `docs/tasks/README.md`, `docs/tasks/` template files, other task plans, `AGENTS.md`.
- Preserving or inheriting any code from the old `lib/`, `app/`, `components/` — the new skeleton is written from scratch.

## Design Source

| Priority | Source | Use |
|----------|--------|-----|
| 4 | `docs/00_design/高保真静态图.jpg` | Visual reference for layout |
| 5 | `docs/00_design/frontend_design_spec.md` | Color tokens, fonts, styling rules |
| 6 | `docs/00_design/HuaHuaBen.jsx` | Original React prototype logic (reference only, not inherited) |
| 7 | `docs/00_design/design_brief.md` | Product constraints |

Key design tokens to embed in the skeleton:

```
--paper:        #f1ebdb;
--paper-card:   #fdfaf0;
--ink:          #211e18;
--ink-soft:     rgba(33,30,24,.55);
--accent:       #d9622b;
--kid:          #d9622b;
--dad:          #2b5d7e;
```

Fonts: ZCOOL KuaiLe (titles/buttons), Ma Shan Zheng (narration/story text), Noto Serif SC (secondary text).

## Files In Scope

### Archive (move, not delete)

| From | To |
|------|-----|
| `app/` (entire directory) | `docs/_archive/pre-tooling-scaffold-20260606/app/` |
| `components/` (entire directory) | `docs/_archive/pre-tooling-scaffold-20260606/components/` |
| `lib/` (entire directory) | `docs/_archive/pre-tooling-scaffold-20260606/lib/` |

### Create (new skeleton)

| File | Purpose |
|------|---------|
| `app/layout.tsx` | Root layout: HTML metadata, Google Fonts import, viewport meta, wrap children in paper background |
| `app/page.tsx` | Single page: draws the "warm paper" skeleton — paper background, dot grid, one centered story-card placeholder with tape strip, empty filmstrip row, pinned input bar, speaker toggle. No logic, no state, no interactivity beyond static rendering. |
| `app/globals.css` | Tailwind directives + CSS custom properties for design tokens + Google Fonts `@import` |

### Edit / Clean

| File | Change |
|------|--------|
| `README.md` | Replace stale content. Must reflect current skeleton state — do NOT write as if MVP is complete. Remove references to `docs/product-brief.md` and `docs/technical-plan.md`. Remove MVP `[x]` checklist. Point readers to `docs/00_design/` and `AGENTS.md`. |
| `.gitignore` | Add `*.tsbuildinfo` under `# build` section |
| `tsconfig.tsbuildinfo` | Delete (build cache artifact) |

### Task System Files (status transitions only)

| File | Change |
|------|--------|
| `docs/tasks/execution-log/TASK-001-soft-reboot-skeleton.md` | Create execution log as work progresses |
| `docs/tasks/artifacts/TASK-001-soft-reboot-skeleton/` | Create directory for evidence (screenshots, command output) |
| `docs/tasks/active_spec.md` | Update status only (planned → approved → in_progress → audit) |
| `docs/tasks/progress.md` | Update TASK-001 row status and Active column only |

### Excluded (do not touch)

- `docs/00_design/`
- `docs/_archive/raw-ai-scaffold-20260606-1724/`
- `docs/tasks/README.md`
- `docs/tasks/plan/TEMPLATE.md`
- `docs/tasks/execution-log/TEMPLATE.md`
- `docs/tasks/audit-report/TEMPLATE.md`
- `docs/tasks/plan/TASK-000-protect-source-documents.md`
- `docs/agent-charters/`
- `docs/agent-workflow.md`
- `docs/reference/`
- `AGENTS.md`
- `package.json`
- `tsconfig.json`
- `next.config.ts`
- `tailwind.config.ts` — TASK-001 does NOT modify this file. Design tokens go in `app/globals.css` only.
- `postcss.config.mjs`
- `.eslintrc.json`
- `.env.example`
- `node_modules/`
- `next-env.d.ts`

## Forbidden Changes

- ❌ No DeepSeek key exposure (no `.env.local`, no client-side API key reads)
- ❌ No database, no accounts, no color in story area
- ❌ No new npm dependencies (no `npm install`)
- ❌ No PNG/bitmap rendering pipeline
- ❌ No marketing landing page
- ❌ No modification of `docs/00_design/` or `docs/_archive/raw-ai-scaffold-20260606-1724/`
- ❌ No inherited code from old `lib/` or `components/` — all new files are written fresh

## Acceptance Criteria

- [AC1] `npm run dev -- -p 3001` boots without error and serves a page at `http://localhost:3001`.
- [AC2] The page renders with the warm paper background (`#f1ebdb`) and the dot grid overlay.
- [AC3] CSS custom properties matching the design spec are defined in `globals.css`.
- [AC4] Google Fonts (ZCOOL KuaiLe, Ma Shan Zheng, Noto Serif SC) load and apply.
- [AC5] One centered "story card" placeholder is visible — paper-card color, hard offset shadow (`6px 7px 0 rgba(33,30,24,.85)`), warm-orange tape strip at top.
- [AC6] A horizontal filmstrip row (empty, with placeholder labels) sits below the story card.
- [AC7] A pinned input bar with a large mic circle and text pill sits at the bottom.
- [AC8] A speaker toggle (two pills: 爸爸说 / 宝宝说) sits above or within the input bar.
- [AC9] `README.md` contains no references to `docs/product-brief.md` or `docs/technical-plan.md`, and no MVP `[x]` checklist.
- [AC10] `tsconfig.tsbuildinfo` no longer exists.
- [AC11] `.gitignore` contains `*.tsbuildinfo`.
- [AC12] Old `app/`, `components/`, `lib/` are moved to `docs/_archive/pre-tooling-scaffold-20260606/` (not deleted — archived).
- [AC13] No TypeScript errors (`node .\node_modules\typescript\bin\tsc --noEmit` passes).
- [AC14] Layout uses proper viewport meta for mobile (`width=device-width, initial-scale=1`).
- [AC15] Touch targets on the static skeleton are ≥ 56px (per design spec §7).

## Test First Plan

### Before writing any new code
1. Run `node .\node_modules\typescript\bin\tsc --noEmit` — must show errors from old scaffold (baseline).
2. Run `npm run build` — record result as baseline. If it fails, note the errors.

### After archiving old files, before creating new
1. Run `node .\node_modules\typescript\bin\tsc --noEmit` — must show errors (missing app/page.tsx, etc.).
2. Confirm old files exist in `docs/_archive/pre-tooling-scaffold-20260606/`.
3. Confirm old files are gone from `app/`, `components/`, `lib/`.

### After creating new skeleton
1. `node .\node_modules\typescript\bin\tsc --noEmit` — must pass (zero errors).
2. `npm run build` — attempt build. If fails due to SWC or Windows permission errors (not code errors), record as environment block with full error output; do NOT claim the build passes.
3. `npm run dev -- -p 3001` — must start, `curl http://localhost:3001` returns 200 with HTML.
4. Visual check: page shows paper background, dot grid, story card with shadow, tape strip, filmstrip row, input bar, speaker toggle.

## Implementation Strategy

### Phase 1: Archive old implementation layer
1. **Safety check:** If `docs/_archive/pre-tooling-scaffold-20260606/` already exists, **STOP immediately** and report to plan-agent. Do NOT overwrite the existing archive.
2. Create directory `docs/_archive/pre-tooling-scaffold-20260606/`.
3. Move `app/` → `docs/_archive/pre-tooling-scaffold-20260606/app/`.
4. Move `components/` → `docs/_archive/pre-tooling-scaffold-20260606/components/`.
5. Move `lib/` → `docs/_archive/pre-tooling-scaffold-20260606/lib/`.

### Phase 2: Clean stale files
5. Delete `tsconfig.tsbuildinfo`.
6. Add `*.tsbuildinfo` to `.gitignore`.
7. Rewrite `README.md`.

### Phase 3: Create new skeleton
8. Write `app/globals.css` — Tailwind directives + CSS custom properties + Google Fonts `@import`.
9. Write `app/layout.tsx` — metadata, fonts, viewport, `<body>` with paper background class.
10. Write `app/page.tsx` — static skeleton with:
    - Full-viewport paper background with dot grid (CSS-only, no images)
    - Centered story card (paper-card bg, hard shadow, slight rotation 0.5deg, tape strip)
    - Placeholder SVG area inside the card (empty viewBox, "你的故事在这里画出来" watermark)
    - Filmstrip row (horizontal scroll container with 5 empty thumbnail slots)
    - Speaker toggle row (two pills: 爸爸说 active, 宝宝说 inactive)
    - Bottom input bar (mic circle + text pill + "画出来" button)
    - All with correct design tokens (no gray/modern defaults)

### Phase 4: Verify
11. Run `node .\node_modules\typescript\bin\tsc --noEmit` — must pass.
12. Run `npm run build` — attempt build. If SWC/permission error on Windows, record as environment block; do NOT claim pass.
13. Start `npm run dev -- -p 3001` and visually verify the skeleton renders correctly.

## Risks

- **Font loading:** Google Fonts CDN may be slow in some regions. Fallback to system fonts is acceptable.
- **Design tokens:** All design tokens are defined in `app/globals.css` as CSS custom properties. `tailwind.config.ts` is NOT modified — if Tailwind classes are needed for these tokens, they must be added via CSS only (e.g. `bg-[var(--paper)]`), not via Tailwind config extensions.
- **Build failure on Windows:** `npm run build` may fail on Windows due to SWC native binary or filesystem permission issues unrelated to code quality. If this occurs, the executor must record the full error output in the execution log and mark it as an environment block. The task is NOT failed — it is `blocked` until resolved.
- **Build breakage after archiving:** Moving `app/` will break the build temporarily until new files are written. This is expected — do Phase 3 immediately after Phase 2.
- **Archive collision:** If `docs/_archive/pre-tooling-scaffold-20260606/` already exists, the executor MUST stop and report. This prevents overwriting a prior archive.

## Rollback

1. Delete new `app/`, `components/`, `lib/`.
2. Restore old directories from `docs/_archive/pre-tooling-scaffold-20260606/`.
3. Revert `README.md`, `.gitignore`, and restore `tsconfig.tsbuildinfo` if it existed.

## Approval

To approve: plan-agent updates `docs/tasks/active_spec.md` with:
- Active Task: TASK-001-soft-reboot-skeleton
- Status: approved
- Plan File: docs/tasks/plan/TASK-001-soft-reboot-skeleton.md

Then update `docs/tasks/progress.md` TASK-001 status from `planned` → `approved`, Active from `No` → `Yes`.
