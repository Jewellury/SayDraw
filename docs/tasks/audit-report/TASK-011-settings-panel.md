# TASK-011: Settings Panel

Lifecycle: `audit` → `done`
Auditor: audit-agent
Plan File: `docs/tasks/plan/TASK-011-settings-panel.md`
Execution Log: `docs/tasks/execution-log/TASK-011-settings-panel.md`
Audit Date: 2026-06-07
Result: **PASS**

## Summary

All 16 acceptance criteria pass. Build, TypeScript, lint all green. DeepSeek API key remains server-only. SVG sanitization intact in all code paths. Fallback model is computed server-side and never sent from client. Prompt validation (`typeof`, `.trim()`, length caps) is correctly implemented in the route. Hydration race is avoided via lazy `useState` initializer. Mobile responsive works (full-width drawer at ≤520px). No forbidden files or dependencies changed. One P2 finding (SSR hydration mismatch) is a known tradeoff documented in the execution log; it does not block ship.

## Checks

| # | Check | Result |
|---|-------|--------|
| 1 | Build (`npx next build`) | PASS — compiled, types checked, static pages generated |
| 2 | TypeScript (`tsc --noEmit`) | PASS — zero errors |
| 3 | Lint (`npx next lint`) | PASS — zero warnings |
| 4 | SVG sanitization | PASS — `sanitizeSvg()` called in all 3 code paths (mock, real, fallback) in `route.ts` |
| 5 | DeepSeek key safety | PASS — `DEEPSEEK_API_KEY` only in `lib/ai/deepseek.ts` and `app/api/story/generate/route.ts` (server-side); no `NEXT_PUBLIC_*` usage; no client exposure |
| 6 | localStorage SSR guard | PASS — `getLs()` helper (`app/page.tsx:123-126`) checks `typeof window === 'undefined'` before accessing localStorage |
| 7 | Model fallback | PASS — `fallbackModel` computed server-side at `route.ts:81`; never in `types.ts`; never sent from client |
| 8 | Prompt validation | PASS — `validatePrompt()` (`route.ts:58-63`): `typeof` check, `.trim()`, length caps (4000/1000/1000); invalid → `null` → defaults |
| 9 | Hydration race | PASS — lazy `useState` init reads localStorage synchronously; `addScene()` reads current settings state immediately |
| 10 | Mobile responsive | PASS — `.hb-settings-drawer` set to `width: 100%` inside existing `@media (max-width: 520px)` at `globals.css:694-696` |
| 11 | No forbidden changes | PASS — `package.json` unchanged (no new deps); `docs/00_design/` untouched; `lib/ai/prompts.ts` unchanged; no `next.config.ts` changes |
| 12 | Novus events | PASS — `story_turn_submitted`, `story_frame_generated`, `story_generation_failed` tracked in existing `addScene()`; settings panel requires no new events per plan |

## Acceptance Criteria — Detailed

| AC | Description | Verdict |
|----|-------------|---------|
| 1 | Gear button in `.hb-head-btns` alongside 播放故事 / reset | PASS (`page.tsx:351`) |
| 2 | Drawer opens/closes via X, backdrop, Escape | PASS (`page.tsx:352,647,651-653`; Escape: `302-307`) |
| 3 | Model dropdown: flash + pro, persisted | PASS (`page.tsx:664-674`, localStorage write at L669) |
| 4 | Scene prompt textarea, pre-filled SCENE_SYS, persisted | PASS (`page.tsx:130,678-686`) |
| 5 | Narration rules input, empty default, persisted | PASS (`page.tsx:131,690-699`) |
| 6 | SVG rules input, empty default, persisted | PASS (`page.tsx:132,703-712`) |
| 7 | "恢复默认" resets all 4 fields to hardcoded defaults | PASS (`page.tsx:717-723`) |
| 8 | Settings sent in POST body of every generate call | PASS (`page.tsx:179-187`) |
| 9 | Server uses custom settings (scene replacement, narration/svg append, model override, fallback computed server-side) | PASS (`route.ts:75-85`) |
| 10 | API key stays server-only | PASS (only in `deepseek.ts` and `route.ts`) |
| 11 | Settings survive page refresh (localStorage) | PASS (`saveSettings()` + lazy init from `getLs()`) |
| 12 | Mobile responsive (full-width drawer at ≤520px) | PASS (`globals.css:694-696`) |
| 13 | Build passes | PASS (`next build` successful) |
| 14 | No new lint warnings | PASS (`next lint` clean) |
| 15 | Server validates prompts (type, trim, length caps) | PASS (`validatePrompt()` at `route.ts:58-63`) |
| 16 | No hydration race (lazy useState init) | PASS (`page.tsx:129-132`; synchronous localStorage read) |

## Findings

### P2: SSR Hydration Mismatch on Settings Form Fields

- **Location:** `app/page.tsx:129-132`
- **Problem:** The lazy `useState` initializer returns the fallback string (e.g. `SCENE_SYS`, `''`) on the server but the user's saved localStorage value on the client. When a user has customized settings and refreshes the page, React emits a hydration warning in the browser console and the form fields briefly flash with default text before React reconciles to the saved values.
- **Fix:** This is a known tradeoff — the alternative (`useEffect` for localStorage loading) would violate AC-16 (hydration race with `addScene()`). The impact is a console warning and a brief visual flash; no functionality is broken. Can be addressed post-MVP by using `suppressHydrationWarning` on the form elements or by implementing a `hydrated` state flag.
- **Severity:** P2 (should fix, does not block ship)

### P2: Settings drawer `overflow-y: auto` may cause double scrollbars on some browsers

- **Location:** `app/globals.css:507`
- **Problem:** The `.hb-settings-drawer` has `overflow-y: auto` while the body may also be scrollable. In practice this is fine because the overlay has `position: fixed; inset: 0`, which prevents body scrolling. Not observed as an actual bug.
- **Fix:** No action required unless observed. Consider `overflow-y: auto` on the body when the drawer is open, or add `overscroll-behavior: contain` to the drawer.
- **Severity:** P2 (should fix, does not block ship)

## Verification

- `npx next build`: Success (compiled, types checked, static pages generated)
- `npx tsc --noEmit`: Success (zero errors)
- `npx next lint`: Success (zero warnings)
- Grep `DEEPSEEK_API_KEY`: Only in `lib/ai/deepseek.ts` and `app/api/story/generate/route.ts` (server-side)
- Grep `NEXT_PUBLIC.*DEEPSEEK`: Zero matches
- Grep `sanitizeSvg` in `route.ts`: Called in all 3 paths (mock L98, real L107, fallback L120)
- Grep `fallbackModel` in `types.ts` and `page.tsx`: Not present (computed server-only)

## Required Fixes

None. No P0 or P1 findings. The two P2 findings are non-blocking.

## Follow-up

- P3: Add `suppressHydrationWarning` to settings form fields to eliminate the hydration console warning.
- P3: Add a character counter below the scene prompt textarea to give the user feedback before the server caps at 4000 characters.
