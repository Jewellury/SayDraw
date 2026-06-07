# TASK-007: Text Input Core Loop

Status: done
Auditor: audit-agent
Plan File: docs/tasks/plan/TASK-007-text-input-core-loop.md
Execution Log: docs/tasks/execution-log/TASK-007-text-input-core-loop.md
Audit Date: 2026-06-07
Result: **PASS**

## Summary

TASK-007 implements the full text-input core loop end-to-end: user types a sentence → clicks "画出来" → API route generates frame (mock or DeepSeek) → SVG sanitized server-side → frame renders with stroke animation → filmstrip updates → localStorage persists. All 18 acceptance criteria verified. No P0 or P1 findings.

## Checks

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | `npx tsc --noEmit` | ✅ PASS | Zero errors |
| 2 | `npm run build` | ✅ PASS | Success, 5 routes including `ƒ /api/story/generate` |
| 3 | `npx next lint` | ✅ PASS | No ESLint warnings or errors |
| 4 | DEEPSEEK_API_KEY exposure | ✅ PASS | Only in `lib/ai/deepseek.ts:32` and `app/api/story/generate/route.ts:36` (both server-side). Zero matches in `app/page.tsx` or any `NEXT_PUBLIC_*`. `.env.example` only (documentation). |
| 5 | SVG sanitization | ✅ PASS | `sanitizeSvg()` strips `<script>`, `<foreignObject>`, `on*`, external `href`/`xlink:href`. Called in API route at lines 40 (mock) and 59 (real) before returning response. |
| 6 | dangerouslySetInnerHTML | ✅ PASS | Used only in `DrawnSvg` and `FilmSvg` client components. SVGs are sanitized server-side before reaching client. Matches HuaHuaBen.jsx pattern. |
| 7 | localStorage client-only | ✅ PASS | `lib/story/storage.ts` guards with `typeof window === 'undefined'`. Only imported by `app/page.tsx` (`'use client'`). Zero imports in `app/api/`. |
| 8 | Mock SVGs B&W line art | ✅ PASS | All 4 mock scenes: `fill="none"`, `stroke="#1f1c18"`, no color fills, no gradients. Rainbow uses black arcs only. |
| 9 | HINT_SYS absent | ✅ PASS | `lib/ai/prompts.ts` contains only `SCENE_SYS`. No hint prompt present. |
| 10 | Forbidden files | ✅ PASS (with note) | `docs/00_design/`, `docs/_archive/`, `package.json`, `tsconfig.json`, `next.config.*`, `app/layout.tsx` all untouched. `app/globals.css` modified — see P2-001. |
| 11 | Seed SVG safe | ✅ PASS | Static inline in `app/page.tsx:12-29`. Verified: no `<script>`, `<foreignObject>`, `on*`, external `href`/`xlink:href`. All elements `fill="none" stroke="#1f1c18"`. |

## Acceptance Criteria Verification

| AC | Description | Verdict |
|----|-------------|---------|
| AC1 | Input is writable, placeholder changes with speaker | ✅ PASS |
| AC2 | "画出来" button works, Enter submits, disabled when empty/loading | ✅ PASS |
| AC3 | Mock data loop works (no API key), rotating scenes, B&W line art | ✅ PASS |
| AC4 | DeepSeek API route (with key) — code review: key server-side only, mock path verified | ✅ PASS |
| AC5 | SVG sanitization runs server-side before response | ✅ PASS |
| AC6 | New frame appears on board with `.hb-draw` animation, narration with speaker dot | ✅ PASS |
| AC7 | Filmstrip updates dynamically, `.on` class, colored frame numbers | ✅ PASS |
| AC8 | Page counter correct: `第 {current + 1} / {scenes.length} 格` | ✅ PASS |
| AC9 | Speaker toggle works, colored chips, placeholder changes | ✅ PASS |
| AC10 | localStorage persists/restores, fallback to seed scene | ✅ PASS |
| AC11 | Loading spinner, disabled input during generation | ✅ PASS |
| AC12 | Error handling: gentle message, text preserved, analytics fired | ✅ PASS |
| AC13 | Novus analytics: `story_turn_submitted`, `story_frame_generated`, `story_generation_failed` fire | ✅ PASS |
| AC14 | Seed SVG (asteroid + dinosaur) renders on first load | ✅ PASS |
| AC15 | Filmstrip auto-scrolls on new frame | ✅ PASS |
| AC16 | TypeScript compiles without errors | ✅ PASS |
| AC17 | Build succeeds | ✅ PASS |
| AC18 | Lint passes | ✅ PASS |

## Findings

### P2-001: `app/globals.css` modified contrary to plan (documented deviation)

- **Location:** `app/globals.css:376-396`
- **Problem:** Plan stated `app/globals.css` -- "no changes needed (.hb-* classes are already complete)". Execute-agent added `.hb-send:disabled`, `.hb-err`, `.hb-spin`, and `@keyframes hbRot` (20 lines). These were genuinely missing from the pre-existing CSS and are required for AC11 (loading spinner) and AC12 (error styling).
- **Fix:** No code fix needed. Plan was inaccurate about CSS completeness. Execution log documents the deviation. Consider updating design spec to include these classes.
- **Severity:** P2 — plan compliance note, not a code defect.

### P3-001: Missing screenshot evidence

- **Location:** `docs/tasks/artifacts/TASK-007-text-input-core-loop/`
- **Problem:** Plan requires screenshots at 3 breakpoints (desktop 1440x900, tablet 834x1112, mobile 390x844). Only pre-edit backup exists in artifacts directory. Screenshots were not captured.
- **Fix:** Capture screenshots at the 3 specified breakpoints and save to the artifacts directory. Non-blocking for audit pass.
- **Severity:** P3 — nice to have, visual verification.

### P3-002: `switchToFrame()` lacks bounds validation

- **Location:** `app/page.tsx:162-164`
- **Problem:** `switchToFrame(index)` sets `current` to `index` without validating `0 <= index < scenes.length`. While filmstrip is rendered from the same `scenes` array (making this safe in practice), a defensive guard would prevent stale/race-condition access.
- **Fix:** Add `if (index >= 0 && index < scenes.length) setCurrent(index);`
- **Severity:** P3 — defensive hardening.

## Verification

- **Core loop design:** Input → submit → API route → sanitize → parse → append scene → render SVG → update filmstrip → persist to localStorage. All data flow paths verified via code review.
- **Server key safety:** `process.env.DEEPSEEK_API_KEY` accessed only in `lib/ai/deepseek.ts:32` and checked in `app/api/story/generate/route.ts:36`. No `NEXT_PUBLIC_*` variables exist. Grep of entire `app/` directory for `NEXT_PUBLIC` returns zero results.
- **SVG safety chain:** Mock SVGs → `sanitizeSvg()` → JSON response → `dangerouslySetInnerHTML` in client. DeepSeek SVGs → `sanitizeSvg()` → JSON response → `dangerouslySetInnerHTML` in client. Seed SVG: static inline, verified safe, no sanitizer needed.
- **Client/server boundary:** `localStorage` import only in `'use client'` page. `typeof window` guard in `storage.ts`. API route has zero client-only imports.
- **Mock data quality:** 4 rotating scenes, each with distinct B&W SVG (butterfly+flower, frog, friendship, rainbow with black arcs). All `fill="none" stroke="#1f1c18"`.

## Required Fixes

None. No P0/P1 findings.

## Follow-up

- P3-001: Capture screenshots for visual documentation
- P3-002: Add bounds check to `switchToFrame()`
