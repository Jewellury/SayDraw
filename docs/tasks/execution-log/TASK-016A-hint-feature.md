# Execution Log: TASK-016A — Hint Feature

**Date:** 2026-06-08
**Agent:** execute-agent
**Status:** complete

## Summary

Implemented the "接下来呢？" Hint Feature — a text-only `POST /api/story/hint` API route, mock fallback, UI wiring, and Novus event tracking.

## Files Changed

| File | Change | Lines |
|------|--------|-------|
| `app/api/story/hint/route.ts` | **NEW** — lightweight hint API route | +56 |
| `lib/story/types.ts` | Added `HintRequest` and `HintResponse` interfaces | +9 |
| `lib/ai/prompts.ts` | Added `HINT_SYS` and `HINT_SYS_EN` prompts | +30 |
| `lib/ai/mock.ts` | Added `getMockHint()` with 5 zh + 5 en rotating hints | +23 |
| `app/page.tsx` | Added hint state, STRINGS, onClick wiring, hint display UI | +42 |

## Implementation Notes

1. **API Route** follows the exact same `generateStoryFrame()` + `NoApiKeyError` catch pattern as `/api/story/generate/route.ts`. JSON mode parses `{ hint: ... }` from the AI response. Falls back to `getMockHint(lang)` on API key absence or parsing failure.

2. **Prompts** created separate `HINT_SYS` (zh) and `HINT_SYS_EN` (en) with JSON-only output instructions, language-specific rule descriptions, and 80-char limit guidance.

3. **Mock hints** use a rotating pool of 5 hints per language with a module-level counter (`mockHintCounter`).

4. **UI** uses `hintText` and `hintLoading` state. The hint button is `disabled` during loading. Guard `if (hintLoading) return;` prevents duplicate requests. The hint display div uses inline styles to avoid touching CSS files outside scope.

5. **Novus** `story_hint_requested` event fires after successful API response (not on button click), per plan.

6. **No changes** to `lib/ai/deepseek.ts`, `lib/analytics/events.ts`, `lib/analytics/track.ts`, CSS files, or any files outside the Files In Scope table.

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS (0 errors) |
| `npm.cmd run build` | PASS (compiled successfully, 6 static pages, 3 dynamic routes including `/api/story/hint`) |
| Product files changed | 5 (matches Files In Scope) |

## Deviations

None. Implemented exactly to plan specification.

## Artifacts

None.
