# TASK-007: Text Input Core Loop

Lifecycle: tracked in `docs/tasks/active_spec.md` and `docs/tasks/progress.md`
Owner Flow: plan-agent -> execute-agent -> audit-agent
Lane: Full (API keys, server routes, SVG sanitization, AI calls, cross-module contracts)

## Background

`app/page.tsx` is a visual skeleton: it renders the header, board, filmstrip, input pill, and speaker toggle correctly, but **nothing is interactive**. The text input has `readOnly`, every button has `onClick={() => {}}`, filmstrip frames are hardcoded 3 static SVGs, and the page counter always reads `第 1 / 3 格`. There is no state, no API layer, no localStorage persistence.

The prototype in `docs/00_design/HuaHuaBen.jsx` demonstrates the complete interactive loop: speak/type -> call AI -> parse response -> append scene -> animate SVG -> update filmstrip -> persist to localStorage. TASK-007 ports that loop into the real Next.js codebase, keeping the DeepSeek API key server-side and adding SVG sanitization.

## Goal

Make the text-input core loop work end-to-end:

1. Type a sentence into the input -> click "画出来" -> a new frame appears with AI-generated narration + SVG
2. Without a `DEEPSEEK_API_KEY`, the API route returns mock data so the app remains playable
3. With a key, the API route calls DeepSeek, sanitizes the SVG on the server, and returns `{ narration, svg }`
4. New frames appear in the filmstrip dynamically, page counter reflects real count
5. Story state persists to `localStorage` and restores on page refresh

## Non-goals

- Voice input (SpeechRecognition) -- deferred to a later task
- Playback mode -- deferred to a later task
- "接下来呢?" hint button logic -- deferred
- Mobile/responsive polish beyond existing `.hb-*` CSS
- Edge/error states beyond "no key -> mock" and a gentle error message
- Streaming responses (single-shot JSON response for MVP)
- The speaker toggle already toggles visually; AI prompting based on speaker is in-scope

## Design Source

**Primary:** `docs/00_design/HuaHuaBen.jsx` -- particularly:
- `addScene()` (lines 116-151): state flow for submit -> call AI -> parse -> append -> auto-scroll
- `callClaude()` (lines 57-70): fetch pattern (we adapt this to our API route)
- `parseScene()` (lines 43-55): JSON extraction with `{ narration, svg }` fallback
- `SCENE_SYS` prompt (lines 72-79): the system prompt for story frame generation
- `DrawnSvg` (lines 86-94): `dangerouslySetInnerHTML` with `replayKey` for stroke animation
- `useState` initial scene (lines 97-99): `[{ id, speaker, text, svg }]` with seed SVG
- localStorage save/load pattern (spirit of lines 100-102)

**Secondary:** `docs/00_design/frontend_design_spec.md` -- tone, colors, microcopy

## Files In Scope

### New Files (create)

| File | Purpose |
|------|---------|
| `app/api/story/generate/route.ts` | POST handler. Accepts `{ storySoFar, newLine, speaker }`, returns `{ narration, svg }`. Checks `process.env.DEEPSEEK_API_KEY`; no key -> mock; has key -> calls DeepSeek, sanitizes SVG. |
| `lib/ai/deepseek.ts` | DeepSeek chat completion client. Takes system prompt + user message, returns raw text. Uses `process.env.DEEPSEEK_API_KEY` (server-only, never exported to client). Endpoint: `https://api.deepseek.com/v1/chat/completions`. Default model: `deepseek-v4-flash`. |
| `lib/ai/prompts.ts` | System prompts for story frame generation (`SCENE_SYS` only). Exported as const strings. Hint is a non-goal for TASK-007. |
| `lib/ai/mock.ts` | Mock data generator. Returns a hardcoded cycle of 4-5 scene `{ narration, svg }` objects (rotating, to simulate progression when no API key). |
| `lib/svg/sanitizeSvg.ts` | SVG sanitizer. Strips `<script>`, `<foreignObject>`, `on*` event attributes, external `href`/`xlink:href`. Returns clean SVG string. Logs warnings on stripped content. |
| `lib/story/types.ts` | TypeScript types: `Scene { id, speaker, text, svg }`, `StoryState { scenes, current, speaker }`, `GenerateRequest`, `GenerateResponse`. |
| `lib/story/storage.ts` | `loadStory(): StoryState`, `saveStory(state): void`. Reads/writes `localStorage` key `saydraw-story`. Falls back to seed scene on missing/corrupt data. **Client-only helper — must not be imported by API route or server-side code.** |
| `lib/analytics/events.ts` | Novus event name constants: `story_turn_submitted`, `story_frame_generated`, `story_generation_failed`. |
| `lib/analytics/track.ts` | `track(eventName, payload?)` stub. Logs to console in dev, ready for Novus SDK integration. |

### Modified Files

| File | Change |
|------|--------|
| `app/page.tsx` | Transform from static skeleton to interactive StoryPage component. Add `useState` for scenes/current/speaker/input/loading/error. Remove `readOnly` from input, wire `onChange`. Wire "画出来" button `onClick` to `addScene()`. Wire speaker toggle. Render filmstrip dynamically from `scenes` array. Page counter from real count. `useEffect` for localStorage load-on-mount and save-on-change. |

## Forbidden Changes

- `docs/00_design/` -- **DO NOT TOUCH** (source document protection)
- `docs/_archive/` -- **DO NOT TOUCH** (source document protection)
- `package.json` -- no new dependencies (Next.js 15 built-in `fetch` is sufficient for DeepSeek API; use `@/` path alias already configured)
- `tsconfig.json` -- no changes needed
- `next.config.*` -- no changes needed
- `app/layout.tsx` -- no changes needed
- `app/globals.css` -- no changes needed (`.hb-*` classes are already complete)
- `postcss.config.*`, `tailwind.config.*` -- no changes needed
- Do NOT put `DEEPSEEK_API_KEY` in any `NEXT_PUBLIC_*` variable, prop, or serialized client state
- Do NOT commit `.env.local` or any file containing the API key

## Acceptance Criteria

### AC1: Input Is Writable
- The text input is no longer `readOnly`
- User can type characters into the input field
- Input placeholder changes with speaker toggle (dad/kid)

### AC2: "画出来" Button Works
- Clicking "画出来" (or pressing Enter) with non-empty input triggers a story turn
- Button is disabled when input is empty or loading
- Input clears after successful submission

### AC3: Mock Data Loop Works (No API Key)
- When `DEEPSEEK_API_KEY` env var is not set, the API route returns mock data
- Mock data produces valid `{ narration, svg }` responses
- Multiple submissions produce different mock scenes (rotation, not identical)
- The core loop (type -> submit -> see new frame) works end-to-end with mock data

### AC4: DeepSeek API Route Works (With Key)
- POST `/api/story/generate` with `{ storySoFar, newLine, speaker }` calls DeepSeek
- DeepSeek API key is read from `process.env.DEEPSEEK_API_KEY` only on the server
- The API route returns `{ narration, svg }` as JSON
- System prompt matches the `SCENE_SYS` prompt from HuaHuaBen.jsx (adapted for DeepSeek)
- If `DEEPSEEK_API_KEY` is available, real API path is smoke-tested; otherwise audit verifies server-only key handling by code review and mock path passes

### AC5: SVG Sanitization Runs Server-Side
- All SVGs returned by the API route pass through `sanitizeSvg()`
- `<script>` tags, `<foreignObject>`, `on*` attributes, and external `href`/`xlink:href` are stripped
- Sanitization runs before the response is sent to the client
- Seed SVG (static inline in page.tsx) does NOT pass through sanitizer (it is authored and verified safe)

### AC6: New Frame Appears on Board
- After successful generation, the board displays the new SVG + narration
- The SVG renders with the `.hb-draw` class for stroke-dashoffset animation
- Narration appears below the SVG with speaker-colored dot
- The `replayKey` pattern triggers re-animation when returning to a frame

### AC7: Filmstrip Updates Dynamically
- Filmstrip thumbnails are rendered from the `scenes` array (not hardcoded)
- Current frame is highlighted with the `.on` class (lifted + dark border)
- Frame numbers are colored by speaker (dad blue, kid orange)
- Clicking a filmstrip thumbnail switches the board to that frame

### AC8: Page Counter Is Correct
- "第 N / M 格" reflects actual `current + 1` and `scenes.length`

### AC9: Speaker Toggle Works
- Clicking "爸爸说" / "宝宝说" toggles the `speaker` state
- The active pill fills with its color (dad blue, kid orange)
- Input placeholder updates to match speaker

### AC10: localStorage Persists and Restores
- Every scene change is saved to `localStorage` (key: `saydraw-story`)
- On page refresh/remount, state restores from localStorage
- If localStorage is empty or corrupted, fall back to seed scene `[{ id: 1, speaker: "dad", text: "陨石从月球上掉下来...", svg: SEED_SVG }]`

### AC11: Loading State
- While waiting for API response, the "画出来" button shows a spinner/disabled state
- The input remains disabled during loading to prevent double-submission

### AC12: Error Handling
- If the API route returns an error (network, timeout, 500), display gentle error: "画板打了个小盹，再说一次试试"
- The user's text is preserved in the input so they don't lose their line
- `story_generation_failed` analytics event fires on error

### AC13: Novus Analytics Stubs Fire
- `story_turn_submitted` fires when user clicks "画出来"
- `story_frame_generated` fires when a frame successfully returns
- `story_generation_failed` fires on API error
- All `track()` calls log to console (Novus-ready but non-blocking)

### AC14: Seed SVG Renders on First Load
- The initial scene (asteroid + dinosaur) renders immediately on page load
- It uses the same `SEED_SVG` as HuaHuaBen.jsx, with `INK` color

### AC15: Dynamic Filmstrip Auto-Scrolls
- After adding a new frame, the filmstrip scrolls to the far right to show the latest frame

### AC16: TypeScript Compiles Without Errors
- `npm run typecheck` (tsc --noEmit) passes with zero errors

### AC17: Build Succeeds
- `npm run build` completes without errors

### AC18: Lint Passes
- `npm.cmd run lint` exits 0 with no ESLint warnings/errors; known Next/SWC warnings are non-blocking

## Test First Plan

### Phase 0: Baseline Verification
1. Run `npm run typecheck` -- expect clean (baseline)
2. Run `npm run build` -- expect clean (baseline)
3. Run `npm run lint` -- expect clean (baseline)
4. Start dev server, confirm the static skeleton still renders

### Phase 1: Library Files (no behavioral change yet)
5. Create `lib/story/types.ts` -- verify `tsc` still passes
6. Create `lib/story/storage.ts` -- verify `tsc` still passes, test `loadStory()` fallback
7. Create `lib/analytics/events.ts` + `lib/analytics/track.ts` -- verify `tsc` still passes
8. Create `lib/svg/sanitizeSvg.ts` -- verify `tsc` still passes
9. Manual verification: pass SVG containing `<script>`, `onload`, and external `href` through sanitizer, confirm all stripped
10. Create `lib/ai/prompts.ts` -- verify `tsc` still passes
11. Create `lib/ai/mock.ts` -- verify `tsc` still passes

### Phase 2: API Route
12. Create `lib/ai/deepseek.ts` -- verify `tsc` still passes
13. Create `app/api/story/generate/route.ts` -- verify `tsc` still passes
14. Test API route with `curl`/browser: POST to `/api/story/generate` without key -> expect mock data
15. (If key available) Test with key -> expect real DeepSeek response

### Phase 3: Page State
16. Modify `app/page.tsx` to add state and wire interactions
17. Verify `npm run typecheck` passes
18. Verify `npm run build` passes
19. Manual test: type a line, click "画出来", verify mock loop works
20. Manual test: refresh page, verify localStorage persistence
21. Manual test: toggle speaker, verify visual + placeholder change
22. Manual test: filmstrip click navigates to that frame
23. Manual test: page counter updates correctly

### Phase 4: Final Verification
24. `npm run typecheck` -- MUST pass
25. `npm run build` -- MUST pass
26. `npm run lint` -- MUST pass
27. Manual smoke test: full core loop (type -> submit -> see frame -> filmstrip -> counter -> refresh -> persist)

### Screenshot Evidence (required for visual tasks)
- Desktop (1440x900): seed screen, after 2 mock frames, filmstrip expanded
- Tablet (834x1112): seed screen, input area visible
- Mobile (390x844): seed screen, input area visible
- Save to `docs/tasks/artifacts/TASK-007-text-input-core-loop/`

## Implementation Strategy

### Phase 0: Scaffold Directories (1 step)
Create empty directories and placeholder `.gitkeep` files:
- `app/api/story/generate/`
- `lib/ai/`
- `lib/svg/`
- `lib/story/`
- `lib/analytics/`
- `docs/tasks/artifacts/TASK-007-text-input-core-loop/`

### Phase 1: Library Files (5 steps, no behavioral change)
Implement bottom-up, each followed by `npx tsc --noEmit`:
1. `lib/story/types.ts` -- types
2. `lib/analytics/events.ts` + `lib/analytics/track.ts` -- analytics stubs
3. `lib/svg/sanitizeSvg.ts` -- SVG sanitizer
4. `lib/ai/prompts.ts` + `lib/ai/mock.ts` -- AI prompts and mock data
5. `lib/story/storage.ts` -- localStorage persistence

### Phase 2: API Route (2 steps)
6. `lib/ai/deepseek.ts` -- DeepSeek client
7. `app/api/story/generate/route.ts` -- API route wiring mock + real paths

### Phase 3: Interactive Page (3 steps)
8. Refactor `app/page.tsx`: extract `SEED_SVG` constant, add `"use client"` state, wire input/buttons/filmstrip
9. Wire localStorage load/save via `useEffect`
10. Wire analytics `track()` calls at trigger points

### Phase 4: Verify & Screenshot (3 steps)
11. Run full verification: `typecheck`, `build`, `lint`
12. Manual smoke test with mock data (no key)
13. Capture screenshots at 3 breakpoints

## API Route Contract

### POST `/api/story/generate`

**Request:**
```json
{
  "storySoFar": "爸爸：陨石从月球上掉下来，砸到小恐龙...\n宝宝：小恐龙醒了，看到一只蝴蝶",
  "newLine": "蝴蝶飞到一朵大花上面",
  "speaker": "kid"
}
```

**Response (200):**
```json
{
  "narration": "蝴蝶轻轻落在花瓣上，小恐龙看呆了。",
  "svg": "<svg viewBox=\"0 0 400 300\" xmlns=\"http://www.w3.org/2000/svg\">...</svg>"
}
```

**Response (500):**
```json
{
  "error": "画板打了个小盹，再说一次试试"
}
```

## Prompt Strategy

The `SCENE_SYS` prompt from HuaHuaBen.jsx is adapted for DeepSeek (OpenAI-compatible chat format):

**System message:** (same as HuaHuaBen.jsx SCENE_SYS but sent as `messages[0].role: "system"`)
- Role: children's picture book "drawing engine"
- Output: warm, simple, spoken Chinese narration (<=25 chars) + pure B&W line-drawing SVG
- SVG rules: viewBox="0 0 400 300", only lines, all stroke="#1f1c18" fill="none", stroke-width 2-3, stroke-linecap="round", no color, no text, 10-22 line elements
- Format: JSON object `{"narration":"...","svg":"<svg ...>...</svg>"}`

**User message:** (same as HuaHuaBen.jsx body)
- Story so far + latest line + who said it

## Seed SVG

The `SEED_SVG` from HuaHuaBen.jsx (lines 16-33) is used as-is in page.tsx for the first frame. It is a static inline SVG verified to contain no scripts, event handlers, foreign objects, or external links. It does NOT go through the sanitizer.

## Mock Data Strategy

`lib/ai/mock.ts` exports a function `getMockScene(index: number): { narration, svg }` that cycles through 4 pre-authored scenes:
1. "蝴蝶轻轻落在花瓣上，小恐龙看呆了。" + simple flower SVG
2. "突然，花丛里跳出一只小青蛙！" + frog SVG
3. "小青蛙和小恐龙成了好朋友。" + two characters SVG
4. "它们一起去看远处的彩虹。" + rainbow landscape SVG (using black arc lines only — no color)

All mock SVGs must be black-and-white line art: `fill="none"`, `stroke="#1f1c18"`, no color fills, no gradients. Even when describing colorful subjects (e.g. "rainbow"), use black arc/line elements only. This provides enough variety to demonstrate the core loop without an API key.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| DeepSeek returns malformed JSON (no SVG, broken JSON, wrong format) | Medium | High | `parseScene()` regex fallback extracts raw SVG; fallback SVG if all parsing fails |
| DeepSeek returns SVG with forbidden elements | Medium | High | `sanitizeSvg()` strips them server-side before response |
| DeepSeek latency >5s feels broken to child | Medium | Medium | Loading state with spinner; mock path is instant for demos |
| localStorage quota exceeded | Low | Low | Story frames are text-only (~2KB each); quota is 5MB; unlikely to hit |
| localStorage data corruption on version mismatch | Low | Medium | `loadStory()` catches JSON parse errors, falls back to seed scene |
| Race condition: rapid double-click "画出来" | Medium | Medium | Disable button during loading; ignore if `loading === true` |
| SVG sanitizer false-positive strips valid SVG | Low | Medium | Regex-based, conservative; only strips known-dangerous patterns |
| No type definitions for `SpeechRecognition` (blocked later task) | N/A | N/A | Out of scope for TASK-007 |

## Rollback

To revert TASK-007 to the pre-implementation state:
1. Delete the new files: `app/api/story/`, `lib/ai/`, `lib/svg/`, `lib/story/`, `lib/analytics/`
2. Restore `app/page.tsx` from git: `git checkout -- app/page.tsx`
3. Run `npm run typecheck && npm run build && npm run lint` to confirm clean state

Since `package.json` is not modified and no dependencies are added, there is no `npm install` rollback step.

## Approval

Plan authored by plan-agent on 2026-06-07.
Approval and execution lifecycle are tracked in `docs/tasks/active_spec.md` and `docs/tasks/progress.md`.
