# TASK-016: Add Payload Type Constraints to Novus Analytics Events

**Lifecycle:** audit
**Auditor:** audit-agent
**Plan File:** `docs/tasks/plan/TASK-016-novus-event-payload-types.md`
**Execution Log:** `docs/tasks/execution-log/TASK-016-novus-event-payload-types.md`
**Audit Date:** 2026-06-08
**Result:** ✅ pass

## Summary

TASK-016 added typed payload interfaces for all 8 reserved Novus analytics events and updated `track()` to enforce them via a generic mapped type. Zero runtime behavior change. All 8 call sites compiled with no modifications needed to `app/page.tsx`. The implementation is clean, minimal, and fully compliant with the plan.

## Checks

| Check | Result | Details |
|-------|--------|---------|
| `npx tsc --noEmit` | ✅ Pass | 0 exit code, 0 errors |
| `npm run build` | ✅ Pass | Compiled successfully, all 6 routes generated |
| `git diff --stat` scope | ✅ Pass | Execute-agent changed 2 files (`events.ts`, `track.ts`); `page.tsx` had pre-existing TASK-016A changes and required 0 modifications for this task |
| Forbidden: auto-injected fields | ✅ Pass | No `timestamp`, `session_id`, `story_id` anywhere in payloads or `track()` |
| Forbidden: hook extraction | ✅ Pass | All `track()` calls remain inline in `app/page.tsx` |
| Forbidden: UI changes | ✅ Pass | No UI modifications |
| Forbidden: API route changes | ✅ Pass | No changes to `app/api/**` |
| Forbidden: `lib/ai/`, `lib/story/`, `lib/svg/` | ✅ Pass | No modifications |
| SVG sanitization | N/A | No SVG paths touched |
| Key exposure scan | N/A | No API routes, env vars, or AI calls touched |

## Acceptance Criteria Compliance

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Each of 8 event names has a specific payload interface exported from `lib/analytics/events.ts` | ✅ All 8 interfaces present (lines 1-34) |
| 2 | `EventPayloadMap` maps every event name constant to its payload interface | ✅ Present at lines 49-58, all 8 keys mapped |
| 3 | `track()` signature is generic: `track<K extends EventName>(eventName: K, payload: EventPayloadMap[K]): void` | ✅ Line 3 of `track.ts`; `?` removed from `payload` |
| 4 | All 8 call sites in `app/page.tsx` compile without errors | ✅ `tsc --noEmit` passes |
| 5 | `story_hint_requested` call site at page.tsx:742 with payload `{}` compiles | ✅ Matches `StoryHintRequestedPayload` (`{}`) |
| 6 | `npx tsc --noEmit` passes (0 exit code) | ✅ |
| 7 | `npm run build` passes | ✅ |
| 8 | `track()` function body unchanged | ✅ Body identical — only signature and import changed |
| 9 | `git diff --stat` shows 3 files changed | ⚠️ P2 — Execute-agent changed only 2 files (`events.ts`, `track.ts`); `page.tsx` required 0 changes as existing call sites already matched the new types (documented in execution log). Plan overestimated; functionally better. |

## Type Quality

- **8/8 payload interfaces** exported from `events.ts` — complete coverage
- **`EventPayloadMap`** correctly uses `typeof EVENTS` keys as a mapped type
- **`track<K extends EventName>`** generic constrains `eventName` and `payload` via `EventPayloadMap[K]`
- **All call sites** pass correctly-typed inline objects:
  - `speaker` field at voice/turn/generation sites: `'dad' | 'kid'` (from `useState<'dad' | 'kid'>`)
  - `frameCount`: `number` (from `scenes.length`)
  - `frameIndex`: `number` (from `index` parameter)
  - `error`: `string`
  - `STORY_HINT_REQUESTED`: `{}` (empty object)

## Findings

| Severity | Location | Problem | Fix |
|----------|----------|---------|-----|
| P2 | Plan AC #9 | Execute-agent changed 2 files, not 3. `page.tsx` needed no changes — existing call sites already satisfied new types. Execution log documents this. | No fix needed. Fewer changes is better. Plan's estimate was conservative. |

## Verification

- `tsc --noEmit`: 0 errors
- `npm run build`: compiled successfully (SWC architecture warning is pre-existing, not scope-related)
- `lib/analytics/events.ts`: 8 payload interfaces + `EventPayloadMap` + unchanged `EVENTS`/`EventName`
- `lib/analytics/track.ts`: generic signature, body unchanged, import updated
- `app/page.tsx`: 8 call sites, all compile under new types, 0 modifications needed by this task
- No forbidden files touched

## Required Fixes

None. Task is ready to close.

## Follow-up

None.
