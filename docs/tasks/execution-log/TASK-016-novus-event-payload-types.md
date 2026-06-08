# TASK-016 Execution Log — Add Payload Type Constraints to Novus Analytics Events

**Agent:** execute-agent  
**Date:** 2026-06-08  
**Plan:** `docs/tasks/plan/TASK-016-novus-event-payload-types.md`

## Summary

Added typed payload interfaces for all 8 reserved Novus analytics events and updated `track()` to enforce them via a generic mapped type. Zero runtime behavior change. All 8 existing call sites in `app/page.tsx` passed TypeScript type-checking with no modifications needed.

## Files Changed

| File | Lines Changed | Notes |
|------|--------------|-------|
| `lib/analytics/events.ts` | +46 | Added 8 payload interfaces + `EventPayloadMap` type. `EVENTS` and `EventName` unchanged. |
| `lib/analytics/track.ts` | +2 / -2 | Changed import to include `EventPayloadMap`; changed signature to `track<K extends EventName>(eventName: K, payload: EventPayloadMap[K]): void`. Removed `?` from `payload`. Body unchanged. |
| `app/page.tsx` | 0 | No changes needed — all 8 existing `track()` call sites already pass inline objects matching the new payload interfaces. |

## Implementation Details

### Phase 1: Payload Interfaces (`lib/analytics/events.ts`)

Added 8 exported interfaces:

- `StoryTurnSubmittedPayload` — `{ speaker: 'dad' | 'kid', frameCount: number }`
- `StoryFrameGeneratedPayload` — `{ speaker: 'dad' | 'kid', frameCount: number }`
- `StoryHintRequestedPayload` — `{}` (intentionally empty)
- `StoryPlayStartedPayload` — `{ frameCount: number }`
- `StoryFrameRevisitedPayload` — `{ frameIndex: number }`
- `StoryGenerationFailedPayload` — `{ speaker: 'dad' | 'kid', error: string }`
- `VoiceInputStartedPayload` — `{ speaker: 'dad' | 'kid' }`
- `VoiceInputCompletedPayload` — `{ speaker: 'dad' | 'kid' }`

Added `EventPayloadMap` mapped type mapping each `EVENTS.*` constant to its payload interface.

### Phase 2: Generic `track()` (`lib/analytics/track.ts`)

Changed signature from:
```ts
track(eventName: EventName, payload?: Record<string, unknown>): void
```
to:
```ts
track<K extends EventName>(eventName: K, payload: EventPayloadMap[K]): void
```

### Phase 3: Call Sites (`app/page.tsx`)

All 8 call sites passed `npx tsc --noEmit` with zero errors and zero changes required:

1. `track(EVENTS.STORY_TURN_SUBMITTED, { speaker: mySpeaker, frameCount: scenes.length })` — line 320
2. `track(EVENTS.STORY_FRAME_GENERATED, { speaker: mySpeaker, frameCount: scenes.length + 1 })` — line 361
3. `track(EVENTS.STORY_GENERATION_FAILED, { speaker: mySpeaker, error: e instanceof Error ? e.message : 'Unknown' })` — line 372
4. `track(EVENTS.VOICE_INPUT_STARTED, { speaker })` — line 387
5. `track(EVENTS.VOICE_INPUT_COMPLETED, { speaker })` — line 407
6. `track(EVENTS.STORY_FRAME_REVISITED, { frameIndex: index })` — line 431
7. `track(EVENTS.STORY_PLAY_STARTED, { frameCount: scenes.length })` — line 436
8. `track(EVENTS.STORY_HINT_REQUESTED, {})` — line 742

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | Passed (0 exit code, 0 errors) |
| `npm.cmd run build` | Passed (compiled successfully, all pages generated) |
| `git diff --stat` files in scope | 2 files by execute-agent (`events.ts`, `track.ts`); `page.tsx` has pre-existing TASK-016A changes |

## Issues Encountered

None. The implementation was straightforward. All existing call sites were already passing correctly-typed data that matched the new payload interfaces. No workarounds or deviations from the plan were needed.

## Acceptance Criteria Check

1. ✅ Each of the 8 event names has a specific TypeScript payload interface exported from `lib/analytics/events.ts`
2. ✅ `EventPayloadMap` maps every event name constant to its payload interface
3. ✅ `track()` signature is generic: `track<K extends EventName>(eventName: K, payload: EventPayloadMap[K]): void`
4. ✅ All 8 existing `track()` call sites in `app/page.tsx` compile without errors under the new types
5. ✅ `story_hint_requested` call site with payload `{}` compiles under `StoryHintRequestedPayload`
6. ✅ `npx tsc --noEmit` passes (0 exit code)
7. ✅ `npm.cmd run build` passes
8. ✅ No new runtime behavior — `track()` function body is unchanged
9. ✅ 2 files changed by execute-agent; `page.tsx` has pre-existing TASK-016A changes only
