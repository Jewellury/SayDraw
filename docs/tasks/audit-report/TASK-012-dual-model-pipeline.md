# Audit Report: TASK-012 — Dual-Model Fixed-Role AI Pipeline

**Date:** 2026-06-07
**Agent:** audit-agent
**Plan:** `docs/tasks/plan/TASK-012-dual-model-pipelineV2.MD`
**Execution Log:** `docs/tasks/execution-log/TASK-012-dual-model-pipeline.md`

---

## Verdict: **PASS**

No P0 or P1 findings. One P2 (plan deviation on globals.css), two P3 informational notes. All 14 acceptance criteria (AC1–AC13 + AC5.1) are met. Build, typecheck, lint all pass. Key safety confirmed.

---

## Verification Summary

| Check | Result |
|---|---|
| `npm run build` | **PASS** — compiled successfully, all pages generated |
| `npx tsc --noEmit` | **PASS** — zero errors |
| `npm run lint` | **PASS** — no ESLint warnings or errors |

---

## Acceptance Criteria Results

### AC1: Dual-model full quality path — PASS
Route (`app/api/story/generate/route.ts:73-86`) calls `generateStoryFrame()` (DeepSeek Flash) for text, then `generateSvg()` (Claude Sonnet) for SVG. Response (`route.ts:106-111`) includes all four fields: `narration`, `svg`, `followUpQuestion`, `storySummary`.

### AC2: Text model failure → mock directly — PASS
`lib/ai/deepseek.ts`: Single hardcoded model `deepseek-v4-flash`, no Pro fallback, no `DEEPSEEK_FALLBACK_MODEL` reference. Route catch block (`route.ts:78-86`) calls `getMockText()` directly on any error — no intermediate Pro retry.

### AC3: SVG model failure → FALLBACK_SVG — PASS
Route (`route.ts:97-102`) catches `NoAnthropicKeyError` and all other errors → `FALLBACK_SVG`. Text fields (`narration`, `followUpQuestion`, `storySummary`) already assigned from previous step, preserved intact.

### AC4: No key still playable — PASS
All four key-presence states function (see plan matrix):
- No DeepSeek key → `NoApiKeyError` → `getMockText()` (`route.ts:78`)
- No Anthropic key → `NoAnthropicKeyError` → `FALLBACK_SVG` (`route.ts:97`)
- Both can be absent simultaneously; app stays fully operational.

### AC5: storySummary flows text → SVG and appears in response — PASS
`parseTextResponse()` (`route.ts:21-36`) extracts `storySummary` from DeepSeek JSON. Passed to `generateSvg()` at `route.ts:91` as second argument. Included in response at `route.ts:110`. Mock path also returns `storySummary` (`lib/ai/mock.ts:97-107`).

### AC5.1: storySummary compression chain (client) — PASS
- `lib/story/types.ts:6`: `Scene.summary?: string` added ✓
- `app/page.tsx:233`: `summary: storySummary` stored on new scene ✓
- `app/page.tsx:177`: `storyText()` uses `s.summary || s.text` for compression ✓
- `app/page.tsx:81-86`: SEED_SCENE has no `summary` field (uses `s.text` fallback) ✓
- Compression effect: subsequent requests use summaries for historical scenes, original text for seed scene.

### AC6: TEXT_SYS contains "json" keyword and full JSON example — PASS
`lib/ai/prompts.ts:3-16`: `TEXT_SYS` contains "JSON 对象" and a complete three-field output example (`narration`, `followUpQuestion`, `storySummary`). Field rules and instructions included.

### AC7: SVG output validation — PASS
`lib/ai/svg-model.ts:13-17`: `extractSvg()` strips markdown fences via regex then extracts `<svg>...</svg>`. Returns `''` if none found.
`route.ts:92-96`: `extractSvg()` called → `validateSvg()` re-checks `<svg>` tags → `FALLBACK_SVG` used when invalid.
`route.ts:104`: `sanitizeSvg()` applied to final SVG string before response.

### AC8: Anthropic API headers correct — PASS
`lib/ai/svg-model.ts:41-45`:
- `x-api-key`: correct
- `anthropic-version`: `2023-06-01` ✓
- `Content-Type`: `application/json` ✓
- `system` in top-level body field (`line 49`), not inside `messages` ✓

### AC9: Error messages safe for children — PASS
`route.ts:116`: Outer catch → `{ error: '画板打了个小盹，再说一次试试' }` (safe).
`route.ts:113`: Raw error logged server-side only (`console.error`), never reaches client.
`app/page.tsx:252`: Client shows same safe message on fetch failure.

### AC10: Settings panel restructure — PASS
- **Model selector removed**: No `<select>`, no `settingsModel` state, no `saydraw_model` key in `app/page.tsx` ✓
- **Fields**: `textPrompt` (故事提示词) + `drawingPrompt` (画风规则) — `page.tsx:691-717` ✓
- **localStorage migration**:
  - `initTextPrompt()` (`page.tsx:111-131`): Merges `scenePrompt` + `narrationPrompt` → `saydraw_text_prompt`, cleans old keys ✓
  - `initDrawingPrompt()` (`page.tsx:134-145`): Migrates `saydraw_svg_prompt` → `saydraw_drawing_prompt`, cleans old key ✓
  - `saveSettings()` (`page.tsx:183-189`): Clears all 4 old keys on every save ✓
- **恢复默认** (`page.tsx:722-726`): Resets both fields to `''` and calls `saveSettings('', '')` ✓

### AC11: Type / Build / Lint — PASS
All three commands pass with zero errors/warnings (see Verification Summary above).

### AC12: No npm dependency changes — PASS
`package.json`: `next@^15.2.0`, `react@^19.0.0`, `react-dom@^19.0.0`. No new dependencies. File unchanged from baseline. Both providers use native `fetch`.

### AC13: Environment variables and runbook — PASS
- `.env.example`:
  - `DEEPSEEK_API_KEY=your_deepseek_key_here` (placeholder, no real key) ✓
  - `ANTHROPIC_API_KEY=your_anthropic_key_here` (placeholder, no real key) ✓
  - `DEEPSEEK_FALLBACK_MODEL` removed ✓
  - `DEEPSEEK_MODEL` not present in `.env.example` ✓
- `docs/reference/dev-server-runbook.md:3-21`:
  - "Environment Variables" section with table listing both keys, purpose, and source URLs ✓
  - Server-side-only warning at line 14 ✓

---

## Cross-Cutting Checks

### DeepSeek Key Safety — PASS
`DEEPSEEK_API_KEY` appears only in:
- `lib/ai/deepseek.ts:16` (server-side `process.env` read)
- `.env.example:2` (placeholder)
- `docs/reference/dev-server-runbook.md:9,18` (documentation)
Zero occurrences in `app/page.tsx`, any `NEXT_PUBLIC_*`, localStorage writes, POST body, or props.

### Anthropic Key Safety — PASS
`ANTHROPIC_API_KEY` appears only in:
- `lib/ai/svg-model.ts:24` (server-side `process.env` read)
- `.env.example:6` (placeholder)
- `docs/reference/dev-server-runbook.md:11,20` (documentation)
Zero occurrences in client code.

### Dual-Model Separation — PASS
- Text model: `lib/ai/deepseek.ts` (`generateStoryFrame`)
- SVG model: `lib/ai/svg-model.ts` (`generateSvg`)
- Separate files, separate error classes (`NoApiKeyError` vs `NoAnthropicKeyError`), no cross-contamination.

### Pro Fallback Removed — PASS
`lib/ai/deepseek.ts`: Single hardcoded model constant (`MODEL = 'deepseek-v4-flash'`, line 2). No `DEEPSEEK_FALLBACK_MODEL` env read, no Pro model reference, no retry logic. Codebase grep for `DEEPSEEK_FALLBACK_MODEL` in `.ts`/`.tsx` files returns zero source-code hits.

### SVG Safety — PASS
- `sanitizeSvg()` called at `route.ts:104` on final SVG before response ✓
- `extractSvg()` strips markdown fences then extracts `<svg>...</svg>` tag ✓
- `validateSvg()` double-checks for `<svg>` tags ✓
- `FALLBACK_SVG` used when SVG is invalid or model fails ✓
- No scripts, foreignObject, event handlers, or external links in `FALLBACK_SVG` constant (`route.ts:13-19`) ✓

### docs/00_design/ — PASS
Directory contents unchanged (4 files: `design_brief.md`, `frontend_design_spec.md`, `gaobaozhenjingtaitu.jpg`, `HuaHuaBen.jsx`). No files added, modified, or removed.

### AGENTS.md Updated — PASS
Lines 23–26 reflect dual-model fixed-role pipeline with both model names, fallback behavior, and no-fallback-models rule.

---

## Findings

### P0 — Block Ship
None.

### P1 — Must Fix
None.

### P2 — Should Fix

**P2-1: globals.css modified against plan**

- **Location:** `app/globals.css:602-608`
- **Problem:** The plan explicitly marked `app/globals.css` as "不改" (do not change) in the file change table. The execution added `.hb-settings-hint` CSS class. The execution log acknowledges this was done (needed by the new settings panel hint text).
- **Impact:** Low. The added 7-line CSS class is benign (font, color, opacity for settings hint text). No functional regression.
- **Fix:** Either (a) revert the CSS change and move `.hb-settings-hint` styling to inline/Tailwind classes in `page.tsx`, or (b) update the plan's file change table to acknowledge `globals.css` as modified. The intent matters more than the file-level tax — the plan author can decide.

### P3 — Informational

**P3-1: .env.local contains deprecated env vars**

- **Location:** `.env.local:4-5`
- **Problem:** `DEEPSEEK_MODEL` and `DEEPSEEK_FALLBACK_MODEL` are still present in the user's local `.env.local`. These env vars are no longer read by the code (deepseek.ts hardcodes `deepseek-v4-flash`). They are harmless but may confuse developers.
- **Impact:** None. `.env.local` is gitignored and user-managed.
- **Fix:** User may delete these lines from `.env.local`.

**P3-2: README.md references removed env vars**

- **Location:** `README.md:39-40`
- **Problem:** README still documents `DEEPSEEK_MODEL` and `DEEPSEEK_FALLBACK_MODEL`, which are no longer used.
- **Impact:** Documentation drift. Out of scope for this task (plan did not require README updates).

---

## Summary

| Category | Count |
|---|---|
| AC Passed | 14/14 |
| P0 | 0 |
| P1 | 0 |
| P2 | 1 |
| P3 | 2 |

**Task TASK-012 passes audit.** All acceptance criteria verified. The one P2 finding (globals.css deviation) does not block ship — the CSS change is benign and functionally correct. Recommend marking task `done` and clearing `active_spec.md`.
