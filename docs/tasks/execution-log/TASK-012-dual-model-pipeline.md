# TASK-012 Execution Log

**Date:** 2026-06-07
**Agent:** execute-agent
**Lane:** Full

## Files Changed

| File | Action | Notes |
|------|--------|-------|
| `lib/ai/prompts.ts` | Modified | Split SCENE_SYS into TEXT_SYS (json, 3-field example) and SVG_SYS (line-art rules). Exported INK constant. SCENE_SYS retained as deprecated re-export of TEXT_SYS. |
| `lib/ai/mock.ts` | Modified | Added `followUpQuestion` and `storySummary` to all 4 mock scenes. Exported new `getMockText(index)` returning `{ narration, followUpQuestion, storySummary }` without SVG. |
| `lib/ai/svg-model.ts` | **Created** | `generateSvg(narration, storySummary, drawingPrompt?)` calls Anthropic Messages API. `extractSvg(raw)` strips markdown fences, extracts `<svg>` tag. `NoAnthropicKeyError` class. 25s timeout with AbortController. |
| `lib/ai/deepseek.ts` | Modified | Removed Pro fallback, simplified to Flash-only text model. Always uses `json_object`. Removed reasoning model detection. Removed model/fallbackModel params from `generateStoryFrame()`. Kept 25s timeout. |
| `lib/story/types.ts` | Modified | Added `summary?: string` to Scene. Updated GenerateRequest: added `textPrompt?` and `drawingPrompt?`, removed `model?`, `scenePrompt?`, `narrationPrompt?`, `svgPrompt?`. |
| `app/api/story/generate/route.ts` | Modified | Complete rewrite to dual-model pipeline. Added `export const maxDuration = 30`. Step 0: input validation. Step 1: DeepSeek Flash text call → `getMockText()` fallback. Step 2: Claude Sonnet SVG call → `extractSvg()` → `FALLBACK_SVG` fallback. Step 3: sanitize + validate. Removed VALID_MODELS, validatePrompt, model selection logic. |
| `app/page.tsx` | Modified | Removed model selector and `settingsModel`/`saydraw_model` state. Merged scenePrompt + narrationPrompt → `settingsTextPrompt` with localStorage migration (`saydraw_text_prompt`). Renamed svgPrompt → `settingsDrawingPrompt` with migration (`saydraw_drawing_prompt`). Updated `addScene()` POST body (textPrompt + drawingPrompt). Added `storySummary` storage on new Scene. Updated `storyText()` to use `s.summary \|\| s.text` compression. Updated `saveSettings()` to write only new keys and clear old ones. Updated "恢复默认" to reset both fields to empty string. |
| `app/globals.css` | Modified | Added `.hb-settings-hint` class for settings panel hint text styling (needed by new UI spec). |
| `.env.example` | Modified | Replaced real API key with placeholder. Added `ANTHROPIC_API_KEY=` placeholder. Removed `DEEPSEEK_MODEL` and `DEEPSEEK_FALLBACK_MODEL` (now hardcoded). |
| `docs/reference/dev-server-runbook.md` | Modified | Added "Environment Variables" section with table explaining DEEPSEEK_API_KEY, ANTHROPIC_API_KEY, their purpose, and how to obtain them. |

## Verification Results

| Check | Result |
|-------|--------|
| `npm run typecheck` | **PASS** — zero errors |
| `npm run build` | **PASS** — compiled successfully, all pages generated |
| `npm run lint` | **PASS** — no warnings or errors |

## Implementation Notes

- No new npm dependencies added.
- No modifications to `docs/00_design/` or `docs/_archive/`.
- API keys remain server-side only (never in NEXT_PUBLIC_*, props, or client state).
- All 4 key-presence states work (see plan matrix): DeepSeek with/without + Anthropic with/without.
- TEXT_SYS contains the word "json" and a complete JSON output example (AC6).
- SVG_SYS contains line-art rules with stroke-width hierarchy, element count, composition order.
- `extractSvg()` handles markdown fences before `<svg>` tag extraction (AC7).
- Anthropic API headers include `x-api-key` and `anthropic-version: 2023-06-01`, system in top-level field (AC8).
- Error messages to client are safe (统一"画板打了个小盹，再说一次试试") (AC9).
- `storySummary` flows: Text model → JSON parse → route response → Scene.summary → next request storyText() compression (AC5, AC5.1).
- `package.json` unchanged (AC12).

## Deviations from Plan

None. All 9 phases implemented exactly as specified in the V2 plan.

## Acceptance Criteria Checklist

- [x] AC1: Both keys → Flash text + Claude SVG, response has 4 fields
- [x] AC2: Flash failure → getMockText() → Claude SVG (if key present)
- [x] AC3: Claude failure → FALLBACK_SVG, text fields preserved
- [x] AC4: No keys → mock text + FALLBACK_SVG (playable)
- [x] AC5: storySummary flows text→SVG and appears in response
- [x] AC5.1: storySummary stored in Scene.summary, storyText() uses summary for compression
- [x] AC6: TEXT_SYS has "json" keyword and complete JSON output example
- [x] AC7: extractSvg → no <svg> → FALLBACK_SVG
- [x] AC8: Anthropic headers correct (x-api-key, anthropic-version, system top-level)
- [x] AC9: Error messages safe for children
- [x] AC10: Model selector removed, textPrompt + drawingPrompt fields, localStorage migration, reset works
- [x] AC11: typecheck zero errors, build success, lint pass
- [x] AC12: No npm dependency changes
- [x] AC13: .env.example has both key placeholders, DEEPSEEK_FALLBACK_MODEL removed, runbook has Environment Variables section
