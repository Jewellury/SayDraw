# TASK-016: Add Payload Type Constraints to Novus Analytics Events

Owner Flow: plan-agent -> execute-agent -> audit-agent
Lifecycle: tracked in `docs/tasks/active_spec.md` and `docs/tasks/progress.md`

## Background

The project has 8 reserved Novus event names in `lib/analytics/events.ts` and a lightweight `track()` wrapper in `lib/analytics/track.ts`. All 8 wired call sites in `app/page.tsx` pass ad-hoc `Record<string, unknown>` payloads with no compile-time shape validation. The 8th event (`story_hint_requested`) was previously reserved but was wired by TASK-016A — the hint button at `app/page.tsx:742` now calls `track(EVENTS.STORY_HINT_REQUESTED, {})` after successful hint generation.

External reviewer feedback (authoritative for this plan) flags this as a **P1 item**: low cost, high benefit. Explicit payload types prevent field drift when Novus SDK is later integrated.

## Goal

Add typed payload interfaces for every reserved event, update `track()` to enforce them via a generic mapped type, and update existing call sites in `app/page.tsx` to compile under the new types. Minimal change, zero new runtime behavior.

## Non-goals

- Auto-injecting common fields (timestamp, session_id, story_id)
- Creating custom hooks (`useVoiceInput`, `useStoryTurn`, etc.)
- Any UI changes
- Any API route changes
- Refactoring `app/page.tsx` beyond updating `track()` call arguments to match new types

## Files In Scope

| File | Change |
|------|--------|
| `lib/analytics/events.ts` | Add typed payload interfaces and an `EventPayloadMap` type mapping each event name to its payload type |
| `lib/analytics/track.ts` | Change signature to `track<K extends EventName>(eventName: K, payload: EventPayloadMap[K])` — generic, type-safe, no `?` on payload (every event always has a payload) |
| `app/page.tsx` | Update 8 call sites: add explicit typed objects so tsc passes. No structural or behavioral change |

## Forbidden Changes

- Do NOT inject `timestamp`, `session_id`, `story_id`, or any other auto-populated field
- Do NOT extract `track()` calls into custom hooks or separate files
- Do NOT modify `app/api/**`, `app/globals.css`, `package.json`, `tsconfig.json`, or any file under `docs/`, `components/`, or `lib/` that is not listed in Files In Scope
- Do NOT change the existing event name constants or the `EVENTS` object shape

## Design Decisions

### 1. Payload interfaces — one per event

Each payload interface is derived from the actual fields currently passed at each call site. `speaker` uses the existing `'dad' | 'kid'` type that already flows through the component.

```ts
export interface StoryTurnSubmittedPayload {
  speaker: 'dad' | 'kid';
  frameCount: number;
}

export interface StoryFrameGeneratedPayload {
  speaker: 'dad' | 'kid';
  frameCount: number;
}

export interface StoryHintRequestedPayload {
  // intentionally empty — no payload fields needed (hint text is sent via API, event fires on successful response)
}

export interface StoryPlayStartedPayload {
  frameCount: number;
}

export interface StoryFrameRevisitedPayload {
  frameIndex: number;
}

export interface StoryGenerationFailedPayload {
  speaker: 'dad' | 'kid';
  error: string;
}

export interface VoiceInputStartedPayload {
  speaker: 'dad' | 'kid';
}

export interface VoiceInputCompletedPayload {
  speaker: 'dad' | 'kid';
}
```

### 2. Payload map — Option A (mapped type)

A single `EventPayloadMap` maps each event name constant to its payload interface. This is the single source of truth.

```ts
export type EventPayloadMap = {
  [EVENTS.STORY_TURN_SUBMITTED]: StoryTurnSubmittedPayload;
  [EVENTS.STORY_FRAME_GENERATED]: StoryFrameGeneratedPayload;
  [EVENTS.STORY_HINT_REQUESTED]: StoryHintRequestedPayload;
  [EVENTS.STORY_PLAY_STARTED]: StoryPlayStartedPayload;
  [EVENTS.STORY_FRAME_REVISITED]: StoryFrameRevisitedPayload;
  [EVENTS.STORY_GENERATION_FAILED]: StoryGenerationFailedPayload;
  [EVENTS.VOICE_INPUT_STARTED]: VoiceInputStartedPayload;
  [EVENTS.VOICE_INPUT_COMPLETED]: VoiceInputCompletedPayload;
};
```

This replaces Option B (function overloads — too noisy for 8 events). The mapped type is clean, extensible, and provides a single source of truth for event-to-payload mapping.

### 3. `track()` signature

```ts
import { EventName, EventPayloadMap } from './events';

export function track<K extends EventName>(eventName: K, payload: EventPayloadMap[K]): void {
  // body unchanged
}
```

The `?` on payload is removed — every wired event currently passes a payload object, and requiring one explicitly prevents callers from accidentally omitting fields. `story_hint_requested` has `StoryHintRequestedPayload` which is `{}` — calling `track(EVENTS.STORY_HINT_REQUESTED, {})` requires an empty object, which matches the existing call site at `page.tsx:742`.

### 4. Call site updates in `app/page.tsx`

All 8 existing `track()` calls already pass objects matching the new interfaces. The changes are type-annotation-only: explicitly type the inline objects where TypeScript's contextual inference isn't sufficient (this is usually not needed — `K` is inferred from the first argument and `EventPayloadMap[K]` is inferred from that, so the second argument is already constrained). In practice, the existing inline objects should satisfy the new types with zero structural changes, because:

- `speaker` at every call site is `'dad' | 'kid'` (typed via `useState<'dad' | 'kid'>`)
- `frameCount` is `scenes.length` (number)
- `frameIndex` is `index` (number)
- `error` is `e.message || 'Unknown'` (string)

If tsc finds any mismatch (e.g., `speaker` being inferred as `string` instead of `'dad' | 'kid'` at a particular site due to a shadow or a variable assignment), the fix is to add a local type annotation on the variable (`const mySpeaker: 'dad' | 'kid' = speaker`) — no runtime change.

## Acceptance Criteria

1. Each of the 8 event names has a specific TypeScript payload interface exported from `lib/analytics/events.ts`
2. `EventPayloadMap` maps every event name constant to its payload interface
3. `track()` signature is generic: `track<K extends EventName>(eventName: K, payload: EventPayloadMap[K]): void`
4. All 8 existing `track()` call sites in `app/page.tsx` compile without errors under the new types
5. `story_hint_requested` call site at `page.tsx:742` with payload `{}` compiles under the new `StoryHintRequestedPayload` type
6. `npx tsc --noEmit` passes (0 exit code)
7. `npm.cmd run build` passes
8. No new runtime behavior — the `track()` function body is unchanged
9. `git diff --stat` shows exactly 3 files changed: `lib/analytics/events.ts`, `lib/analytics/track.ts`, `app/page.tsx`

## Implementation Strategy

### Phase 1: `lib/analytics/events.ts`

1. Add the 8 payload interfaces above the `EVENTS` object.
2. Add `EventPayloadMap` type after the `EventName` type.
3. Keep `EVENTS` and `EventName` unchanged.

Export all new types alongside the existing exports.

### Phase 2: `lib/analytics/track.ts`

1. Import `EventPayloadMap` from `./events`.
2. Change signature to `track<K extends EventName>(eventName: K, payload: EventPayloadMap[K]): void`.
3. Remove the `?` from `payload`.
4. Keep the function body identical.

### Phase 3: `app/page.tsx`

1. Run `npx tsc --noEmit` — if it passes with zero changes, document that the existing inline objects already satisfy the new types.
2. If tsc reports type errors on any `track()` call:
   - Identify the mismatched field.
   - Add a minimal type annotation (e.g., on the variable passed as `speaker`) to narrow it to `'dad' | 'kid'`.
   - Do NOT restructure the call site, extract a helper, or change behavior.
3. If a call site passes extra fields beyond the interface, tsc will not error (excess properties are allowed in assignability, though TS's excess property check on literal objects may fire — if it does, remove the extra field).

### Phase 4: Verification

1. `npx tsc --noEmit`
2. `npm.cmd run build`
3. `git diff --stat` — confirm exactly 3 files

## Risks

| Risk | Mitigation |
|------|------------|
| **TS excess property check on inline objects** — if a `track()` call passes an inline literal with a field not in the payload interface, tsc may error | Remove the stray field from the inline object. The reviewer said not to auto-inject common fields, so no field should be present that isn't already in the payload interface. |
| **`speaker` inferred as `string` instead of `'dad' \| 'kid'`** — TypeScript may widen the type if the variable is assigned through a non-const path | Add a type annotation `const mySpeaker: 'dad' \| 'kid' = speaker` at the relevant call site. Minimal, no runtime change. |
| **`EventPayloadMap` breaks if `EVENTS` is imported as a type** — `EventPayloadMap` uses `EVENTS.*` as keys, which requires `EVENTS` to be accessible as a value | This is fine. `EVENTS` is already imported as a value in `track.ts`. `EventPayloadMap` is a type but its keys reference value-level constants — TypeScript supports this (indexed access on `typeof EVENTS`). |

## Rollback

3-file change. Revert all three files:
```
git checkout HEAD -- lib/analytics/events.ts lib/analytics/track.ts app/page.tsx
```
No data migration, no API change, no runtime behavior change.

## Approval

Awaiting user approval. After approval: plan-agent updates `active_spec.md` to point here and flips `TASK-016` in `progress.md` to `approved`.
