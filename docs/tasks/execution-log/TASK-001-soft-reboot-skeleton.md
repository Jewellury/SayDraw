# TASK-001: soft-reboot-skeleton

Status: audit
Executor: execute-agent
Plan File: docs/tasks/plan/TASK-001-soft-reboot-skeleton.md
Started: 2026-06-06 18:27
Completed: 2026-06-06 18:34

## Files Changed

| File | Action |
|------|--------|
| `app/layout.tsx` | Created — root layout with metadata, viewport, Google Fonts |
| `app/page.tsx` | Created — static warm paper skeleton (story card, filmstrip, input bar, speaker toggle) |
| `app/globals.css` | Created — Tailwind directives, CSS custom properties, Google Fonts @import, dot grid |
| `README.md` | Rewritten — current skeleton state, removed stale refs and MVP [x] checklist |
| `.gitignore` | Edited — added `*.tsbuildinfo` under # build |
| `tsconfig.tsbuildinfo` | Deleted — build cache artifact |
| `docs/_archive/pre-tooling-scaffold-20260606/app/` | Created — archived old app/ via move |
| `docs/_archive/pre-tooling-scaffold-20260606/components/` | Created — archived old components/ via move |
| `docs/_archive/pre-tooling-scaffold-20260606/lib/` | Created — archived old lib/ via move |
| `docs/tasks/active_spec.md` | Edited — status: approved → in_progress |
| `docs/tasks/progress.md` | Edited — TASK-001 status: approved → in_progress |
| `docs/tasks/artifacts/TASK-001-soft-reboot-skeleton/` | Created — evidence directory |

## Commands Run

| Step | Command | Result |
|------|---------|--------|
| Safety check | `Test-Path docs/_archive/pre-tooling-scaffold-20260606` | False — safe to proceed |
| Baseline tsc | `node .\node_modules\typescript\bin\tsc --noEmit` | Errors as expected (old scaffold) |
| Archive | `Move-Item app/ components/ lib/` | Success, 3 directories moved |
| Post-archive tsc | `node .\node_modules\typescript\bin\tsc --noEmit` | Errors from archive (tsconfig includes `**/*`) |
| npm install | `npm install` | Restored node_modules bin links (4 added, 2 removed, 27 changed) |
| Build | `npm run build` | Failed — archive files in tsconfig scope, type errors from broken imports |
| Dev server | `npm run dev -- -p 3001` | Started successfully on http://localhost:3001. Ready in 3.3s. |
| Final tsc | `node .\node_modules\typescript\bin\tsc --noEmit` | Errors — all from archive directories (tsconfig `**/*` includes `docs/_archive/`) |

## Implementation Notes

- All three skeleton files (`globals.css`, `layout.tsx`, `page.tsx`) written from scratch per design spec tokens. No code inherited from old scaffold.
- Design tokens (--paper, --paper-card, --ink, --ink-soft, --accent, --kid, --dad) defined as CSS custom properties in globals.css only. tailwind.config.ts NOT modified.
- Fonts: ZCOOL KuaiLe, Ma Shan Zheng, Noto Serif SC imported via Google Fonts CDN.
- All touch targets ≥ 56px (speaker pills, mic button, draw button, text pill).
- Skeleton is purely static — zero useState, useEffect, event handlers. Renders warm paper background, dot grid, story card with tape and shadow, filmstrip row, speaker toggle, input bar.
- `npm install` was run to restore missing `node_modules/.bin` links (not a new dependency — same package.json). Without this, neither `next build` nor `next dev` could find the Next binary.

## Deviations From Plan

### D1: tsconfig.json includes archive directories
**Severity:** Medium  
**Detail:** `tsconfig.json` has `"include": ["**/*.ts", "**/*.tsx"]` which captures all files under `docs/_archive/` (both `raw-ai-scaffold-20260606-1724/` and the new `pre-tooling-scaffold-20260606/`). After moving `lib/` to archive, the archived code produces ~70 type errors (broken imports, missing modules). This causes `tsc --noEmit` to fail and breaks `npm run build` type-checking phase.  
**Resolution needed:** Add `"exclude": ["docs/_archive"]` to tsconfig.json. This file is in the Forbidden Files list for TASK-001 — requires plan-agent approval or a follow-up task.  
**Impact on AC13:** tsc --noEmit does not pass. All errors originate from archive files, not from the new skeleton. The new skeleton's only tsc error is `TS7016: Could not find declaration file for module 'next'` — a pre-existing issue also present in the baseline.

### D2: npm install required to restore node_modules bin links
**Severity:** Low  
**Detail:** `node_modules/.bin` directory was missing, causing `next` command not found. Ran `npm install` to restore — this is the same package.json, no new packages added. Without this, neither build nor dev could execute.

### D3: SWC native binary not compatible with Win32
**Severity:** Low (falls back to WASM)  
**Detail:** `@next/swc-win32-x64-msvc` module reports "not a valid Win32 application". Next.js falls back to WASM compilation successfully. Build compilation step passes; dev server works.

### D4: npm run build fails on tsc phase due to archive files
**Severity:** Environment block  
**Detail:** Per D1, archive files cause build type-checking to fail. SWC compilation succeeded ("✓ Compiled successfully in 5.8s"). Recorded as environment block per plan.

## Test Results

| AC | Description | Result |
|----|-------------|--------|
| AC1 | dev server boots on :3001 | PASS — Ready in 3.3s, http://localhost:3001 |
| AC2 | warm paper background + dot grid | VISUAL — coded, pending browser verification |
| AC3 | CSS custom properties defined | PASS — globals.css lines 7-11 |
| AC4 | Google Fonts load | PASS — @import in globals.css line 4 |
| AC5 | story card with shadow + tape | VISUAL — coded, pending browser verification |
| AC6 | filmstrip row | VISUAL — coded, pending browser verification |
| AC7 | input bar with mic + text pill | VISUAL — coded, pending browser verification |
| AC8 | speaker toggle (爸爸说/宝宝说) | VISUAL — coded, pending browser verification |
| AC9 | README.md clean | PASS — no product-brief/technical-plan refs, no MVP [x] |
| AC10 | tsconfig.tsbuildinfo deleted | PASS |
| AC11 | .gitignore has *.tsbuildinfo | PASS |
| AC12 | old files archived | PASS — app/, components/, lib/ moved |
| AC13 | tsc --noEmit passes | DEVIATION — archive files cause errors (see D1) |
| AC14 | viewport meta | PASS — layout.tsx line 11 |
| AC15 | touch targets ≥ 56px | PASS — all interactive elements 56px min |

## Artifacts

- `docs/tasks/artifacts/TASK-001-soft-reboot-skeleton/` — created (empty, ready for screenshots)

## Handoff To Audit

TASK-001 is ready for audit-agent review. Key items for audit:

1. D1 (tsconfig includes archives) is the primary unresolved issue — blocking AC13 and build
2. npm install was a necessary deviation to restore bin links (same package.json, no new packages)
3. 5 ACs require visual verification (AC2, AC5, AC6, AC7, AC8) — browser screenshot recommended
4. SWC fallback to WASM works but the warning should be noted
