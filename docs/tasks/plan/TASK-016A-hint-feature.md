# TASK-016A: "接下来呢？" Hint Feature

Owner Flow: plan-agent -> execute-agent -> audit-agent
Lifecycle: tracked in `docs/tasks/active_spec.md` and `docs/tasks/progress.md`

## Background

The "接下来呢？" (What's next? Get a hint) button exists in the UI at `app/page.tsx:713-743` but has an empty `onClick={() => {}}`. There is no hint generation flow. The button is styled as `className="hb-spark"` with a speech-bubble SVG icon and an aria-label already wired to `STRINGS[lang].nextHintAria`.

The Novus event `story_hint_requested` is reserved in `lib/analytics/events.ts` but not wired anywhere. TASK-016 (Novus event payload types) deliberately leaves it unwired — this task is where it gets wired.

## Goal

Build a lightweight, text-only `POST /api/story/hint` route that generates a short inspiration hint for the parent/child to continue the story. Wire the hint button's `onClick` to call this API, show the result near the input area, and fire the `story_hint_requested` Novus event on success.

## Non-goals

- Do NOT generate SVG
- Do NOT create a new scene/frame
- Do NOT reuse `/api/story/generate` route
- Do NOT modify the existing story generation pipeline (`/api/story/generate`, `lib/ai/deepseek.ts` function signatures, or the `generateStoryFrame` function body)
- Do NOT change the hint button's styling, shape, or icon
- Do NOT do TASK-016 (payload type constraints) — that is a separate task
- Do NOT add new dependencies to `package.json`

## Design Source

User instruction (authoritative). The hint button markup in `app/page.tsx:713-743`, the existing `lib/ai/deepseek.ts` and `/api/story/generate/route.ts` patterns, and `lib/ai/mock.ts` provide the codebase context.

## Design Decisions

### 1. API route is `POST /api/story/hint` (separate from generate)

A new Route Handler at `app/api/story/hint/route.ts`. Follows the same server-side-only pattern as `app/api/story/generate/route.ts`: check for `DEEPSEEK_API_KEY`, try DeepSeek, catch `NoApiKeyError` to fall back to mock.

### 2. Reuse `generateStoryFrame()` from `lib/ai/deepseek.ts` directly

`generateStoryFrame(systemPrompt, userMessage): Promise<string>` is a generic DeepSeek Flash call with JSON mode and 2000 max_tokens. We can reuse it as-is for hint generation — the 2000 token ceiling is a safe upper bound, and the AI will stop early for short hints. No wrapper needed. This avoids editing `deepseek.ts` entirely.

### 3. Hint response is a single `hint` string

```ts
// Request
interface HintRequest {
  storySoFar: string;  // context from storyText()
  lang: 'zh' | 'en';
}

// Response
interface HintResponse {
  hint: string;  // short inspiration text (1-2 sentences)
}
```

### 4. System prompt (`HINT_SYS`) asks for a JSON object with one field

The prompt instructs the AI to return `{"hint": "..."}`. Using JSON mode keeps parsing trivial and prevents the AI from adding conversational preamble. The prompt is language-aware (`zh`/`en`).

### 5. Mock fallback

When `DEEPSEEK_API_KEY` is not set, `getMockHint()` returns a few rotating pre-written hints in the requested language. This keeps the app playable without an API key.

### 6. UI: hint text shown inside a `<div>` below the input bar

The hint result appears as a small text block between the input bar and the filmstrip (or above the input bar, near where the button is). It replaces the previous hint when clicked again. Loading state shows a small inline spinner on the button and/or a "thinking…" placeholder text.

### 7. Novus event fires after successful hint generation

`track(EVENTS.STORY_HINT_REQUESTED, {})` is called in the `onClick` handler after a successful API response, before displaying the hint. This is the first wiring of this reserved event.

## Files In Scope

| File | Change |
|------|--------|
| `app/api/story/hint/route.ts` | **NEW**: lightweight hint API route |
| `lib/ai/prompts.ts` | Add `HINT_SYS` prompt for hint generation |
| `lib/ai/mock.ts` | Add `getMockHint(index: number, lang: 'zh' \| 'en'): string` |
| `lib/story/types.ts` | Add `HintRequest` and `HintResponse` interfaces |
| `app/page.tsx` | Add hint state (`hintText`, `hintLoading`), wire `onClick`, add hint display UI, fire `track(EVENTS.STORY_HINT_REQUESTED, {})` |
| `lib/analytics/events.ts` | (read-only, no change — `story_hint_requested` is already defined) |

## Forbidden Changes

- Do NOT modify `lib/ai/deepseek.ts` (signature, body, or exports)
- Do NOT modify `/api/story/generate/route.ts` or any existing API route
- Do NOT modify `lib/ai/prompts.ts` beyond adding `HINT_SYS`
- Do NOT modify `lib/ai/mock.ts` beyond adding `getMockHint()`
- Do NOT modify `lib/analytics/events.ts` or `lib/analytics/track.ts`
- Do NOT modify `lib/svg/sanitizeSvg.ts`
- Do NOT change the hint button's styling, icon, or aria-label
- Do NOT create a new scene/frame when hint is generated
- Do NOT add any file outside the Files In Scope table
- Do NOT add new npm dependencies

## Acceptance Criteria

1. `POST /api/story/hint` returns `{ hint: string }` when API key is set, or a mock hint when key is missing
2. Hint button click calls the API and displays the hint text near the input area (not as a scene frame)
3. `track(EVENTS.STORY_HINT_REQUESTED, {})` fires after successful hint generation
4. Button shows loading state (disabled + spinner) during fetch
5. Error state is handled gracefully (subtle error message, button re-enabled)
6. Clicking hint again during same turn replaces the previous hint
7. `npx tsc --noEmit` passes (0 exit code)
8. `npm.cmd run build` passes
9. `git diff --stat` shows changes to exactly 5 files (the 5 listed in Files In Scope, excluding the read-only events.ts)
10. The existing story generation pipeline is unchanged

## Verification Plan

### Automated

1. `npx tsc --noEmit` — must pass
2. `npm.cmd run build` — must pass
3. `git diff --stat` — confirm exactly 5 files: `app/api/story/hint/route.ts` (new), `lib/ai/prompts.ts`, `lib/ai/mock.ts`, `lib/story/types.ts`, `app/page.tsx`

### Manual

1. Click the hint button with an empty story (only seed scene) — hint text appears near the input area
2. Click the hint button repeatedly — hint text updates each time
3. Verify button shows loading state during fetch (spinner or disabled appearance)
4. Verify `[Novus] story_hint_requested` appears in dev console after hint loads
5. Disconnect network → click hint → error is handled gracefully (button returns to enabled, no crash)
6. Without `DEEPSEEK_API_KEY` set — mock hints appear

## Implementation Strategy

### Phase 1: Types (`lib/story/types.ts`)

Add two interfaces after `GenerateError`:

```ts
export interface HintRequest {
  storySoFar: string;
  lang: 'zh' | 'en';
}

export interface HintResponse {
  hint: string;
}
```

### Phase 2: Prompt (`lib/ai/prompts.ts`)

Add a new `HINT_SYS` export before the existing `SCENE_SYS` export. The system prompt must:

- Speak in the requested language (`zh`/`en`)
- Ask for a single `{"hint": "..."}` JSON object
- Generate 1 inspiring sentence — either a prompt suggestion, an open question, or 3 optional next steps
- Be aware of the story context (passed in the user message)
- Target parents prompting a 4-year-old to continue a story
- Be short (under 80 characters ideally)

Model it after the existing pattern: `COMBINED_SYS` uses JSON output format instructions; `HINT_SYS` is simpler since no SVG is involved.

### Phase 3: Mock (`lib/ai/mock.ts`)

Add `getMockHint()` — returns a short hint string from a small rotating pool (3-4 Chinese hints + 3-4 English hints). Use an internal counter (similar to `mockCounter` in the generate route, or a module-level counter in `mock.ts`). Signature:

```ts
export function getMockHint(lang: 'zh' | 'en'): string
```

### Phase 4: API Route (`app/api/story/hint/route.ts`)

Create the new route handler following the exact same pattern as `app/api/story/generate/route.ts`:

1. `maxDuration = 30`
2. Import `generateStoryFrame`, `NoApiKeyError` from `@/lib/ai/deepseek`
3. Import `HINT_SYS` from `@/lib/ai/prompts`
4. Import `getMockHint` from `@/lib/ai/mock`
5. Parse `HintRequest` body
6. Build user message: `"故事进行到：\n${storySoFar}\n\n请给一个灵感提示，帮助孩子继续编故事。"` (zh) or English equivalent
7. Try `generateStoryFrame(HINT_SYS + '\n\n' + langInstruction, userMessage)` → parse JSON → extract `hint`
8. Catch `NoApiKeyError` → use `getMockHint(lang)`
9. Return `{ hint }` as `HintResponse`
10. Always return a hint — seed scene provides enough context. If storySoFar is somehow empty, return a generic fallback hint string directly
11. `500` catch-all fallback with a generic hint

### Phase 5: UI (`app/page.tsx`)

Add two state variables in the component:

```ts
const [hintText, setHintText] = useState('');
const [hintLoading, setHintLoading] = useState(false);
```

Wire the hint button's `onClick`:

```ts
async () => {
  if (hintLoading) return;
  setHintLoading(true);
  setHintText('');
  try {
    const res = await fetch('/api/story/hint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storySoFar: storyText(), lang }),
    });
    if (!res.ok) throw new Error('Hint API error');
    const data = await res.json();
    setHintText(data.hint || '');
    track(EVENTS.STORY_HINT_REQUESTED, {});
  } catch (e) {
    setHintText('');
    console.error('[hint]', e);
  } finally {
    setHintLoading(false);
  }
}
```

Hint display UI: a `<p>` or `<div>` element positioned between the input bar and the filmstrip (or inside the input bar area). When `hintText` is non-empty, show it with a subtle fade-in animation. When `hintLoading`, show a "thinking…" placeholder.

Button loading state: when `hintLoading` is true, disable the button (`disabled` attribute) or add a subtle CSS animation (e.g., pulse or rotate).

**i18n:** Add two new string keys to the `STRINGS` object in both `zh` and `en`:

| Key | zh | en |
|-----|----|----|
| `hintLoading` | 想一下…… | Thinking… |
| `hintPlaceholder` | (empty string for blank state) | (empty string for blank state) |

Place the hint display `<div>` after the input pill and before the filmstrip. Use a conditional render: only show when `hintText` is non-empty or `hintLoading` is true.

### Phase 6: Cleanup

- No changes to `lib/analytics/events.ts` (event name already exists)
- No changes to `lib/analytics/track.ts` (existing signature handled by TASK-016 separately; this task passes `{}` which is compatible with the current `Record<string, unknown>`)
- No changes to `lib/ai/deepseek.ts`
- Verify all imports are correct, no unused imports in page.tsx

## Risks

| Risk | Mitigation |
|------|------------|
| **`generateStoryFrame` uses JSON mode** — hint prompt must instruct the AI to output valid JSON with a `hint` field | Write the prompt to explicitly request `{"hint": "..."}` format. Test with DeepSeek Flash to confirm compliance. |
| **Button duplicates state on rapid click** | Guard with `if (hintLoading) return;` in onClick. |
| **Hint text too long for UI** | The prompt limits hint to ~80 characters. CSS `overflow-hidden` + `text-ellipsis` as a safety net. |
| **`storyText()` returns empty string on first frame (seed scene has no summary)** | The seed scene has `text` but may not have `summary`. In `storyText()`, it falls back to `s.text` if `s.summary` is empty. This is sufficient context for the hint. |
| **Type mismatch with TASK-016** — TASK-016 might change `track()` signature before TASK-016A lands | TASK-016 is not yet approved/executed. If TASK-016 lands first and changes the `track()` signature to not accept `{}`, TASK-016A's audit should catch and fix. Low risk: TASK-016 defines `StoryHintRequestedPayload` as `{}` — an empty object — so `track(EVENTS.STORY_HINT_REQUESTED, {})` is compatible. |

## Rollback

5-file change. Revert all five files:

```
git checkout HEAD -- lib/story/types.ts lib/ai/prompts.ts lib/ai/mock.ts app/page.tsx
rm -f app/api/story/hint/route.ts
```

No data migration, no schema changes, no persistence changes. The hint state is transient (React state, not localStorage). The existing story generation pipeline is untouched.

## Approval

Awaiting user approval. After approval: plan-agent updates `active_spec.md` and flips TASK-016A in `progress.md` to `approved`.
