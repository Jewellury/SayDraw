# TASK-009: Voice Input

Owner Flow: plan-agent -> execute-agent -> audit-agent
Lifecycle: tracked in `docs/tasks/active_spec.md` and `docs/tasks/progress.md`

## Background

The design brief (§4) declares voice-first as a core interaction: "4 岁孩子是'说'不是'打字'". The frontend spec (§4) describes: "麦克风按钮放最显眼处... 聆听时变暖橙并轻微脉动." The reference implementation in `HuaHuaBen.jsx:167-190` has the complete Web Speech API logic for `SpeechRecognition` with `zh-CN`, interim results, and cleanup.

Currently `app/page.tsx` has a mic button in the input bar with a no-op `onClick={() => {}}`. `app/globals.css` has the base `.hb-mic` class but no `.hb-mic.live` class for the pulsing state. No voice logic exists.

## Goal

Implement browser-native voice input using Web Speech API (`SpeechRecognition`, `zh-CN`) that transcribes spoken words into the text input field without auto-submitting. The mic button toggles recording on/off and shows visual feedback when listening.

## Non-goals

- Auto-submit after voice transcription (user must confirm/edit)
- Any server-side changes, API routes, or new dependencies
- Speech synthesis / text-to-speech (out of scope)
- Mobile app / native microphone integration
- Replacing the existing text input loop

## Design Source

- `docs/00_design/HuaHuaBen.jsx:167-190` — reference implementation for `startVoice`/`stopVoice`
- `docs/00_design/frontend_design_spec.md` §4 — mic button: "聆听时变暖橙并轻微脉动"
- `docs/00_design/design_brief.md` §6 — "MVP 用浏览器 Web Speech API（zh-CN）"

## Files In Scope

| File | Change |
|------|--------|
| `app/page.tsx` | Add `listening` state, `recRef`, `startVoice`/`stopVoice`, wire mic button, fire analytics |
| `app/globals.css` | Add `.hb-mic.live` class with pulsing animation |

## Forbidden Changes

- No `NEXT_PUBLIC_*` env vars
- No new npm dependencies
- No changes to API routes (`app/api/`)
- No changes to `lib/` (analytics events already defined)
- No changes to `docs/00_design/` or `docs/_archive/`
- Do not modify the text input flow, keyboard handling, or send button logic

## Acceptance Criteria

1. **Mic toggle**: clicking the mic button starts recording (mic button gets `.live` class); clicking again stops it.
2. **Transcription fills input**: after `SpeechRecognition` produces a result, `setInput(t)` fills the text field — user can edit before pressing send.
3. **No auto-submit**: text fills input only; `addScene()` is never called automatically.
4. **Unsupported browser**: when `SpeechRecognition` is unavailable, the error message `"这个浏览器还不支持语音，用打字也可以哦"` appears in the error display.
5. **Analytics fired**: `voice_input_started` on mic tap start; `voice_input_completed` on successful transcription.
6. **Listening visual**: mic button turns accent-colored and pulses when recording (`hb-mic.live`).
7. **Cleanup**: `rec.onend` and `rec.onerror` set listening to false and stop the animation.
8. **Build passes**: `npm.cmd run build` succeeds with no new TypeScript or lint errors.
9. **Existing behavior unchanged**: text typing, Enter submit, send button, speaker toggle all work as before.

## Screenshot Evidence (required for visual tasks)

- Desktop (1440×900): mic idle, mic listening (pulsing), error state (unsupported browser)
- Tablet (834×1112): mic listening
- Mobile (390×844): mic listening
- Save to `docs/tasks/artifacts/TASK-009-voice-input/`

## Verification Plan

1. Run `npm.cmd run build` — must pass with no new errors.
2. In a browser that supports SpeechRecognition (Chrome desktop):
   - Click mic → verify pulsing animation + `voice_input_started` fires.
   - Speak → verify text fills input field without auto-submit.
   - Click mic again or wait for silence → verify `voice_input_completed` fires, pulsing stops.
3. In a browser without SpeechRecognition (or mock it):
   - Click mic → verify fallback error message shows.
4. Verify existing text input flow: type text, press Enter → scene generates as before.
5. Verify Enter does not auto-submit voice results.

## Implementation Strategy

Single vertical slice in `app/page.tsx`:

1. Add state: `const [listening, setListening] = useState(false);`
2. Add ref: `const recRef = useRef<SpeechRecognition | null>(null);`
3. Implement `startVoice()` following `HuaHuaBen.jsx:167-186`:
   - Check `window.SpeechRecognition || window.webkitSpeechRecognition`
   - If unsupported: setError fallback message, return
   - Create instance, set `lang = 'zh-CN'`, `interimResults = true`, `continuous = false`
   - `onresult`: extract transcript, `setInput(t)`, fire `voice_input_completed`
   - `onend` / `onerror`: `setListening(false)`
   - Store in `recRef.current`, `setListening(true)`, `rec.start()`, fire `voice_input_started`
4. Implement `stopVoice()` following `HuaHuaBen.jsx:187-190`:
   - `recRef.current?.stop()`, `setListening(false)`
5. Wire mic button: `onClick` toggles `listening ? stopVoice() : startVoice()`
6. Add `.live` class to mic button when listening, with keyboard `onKeyDown` block while listening
7. Add `.hb-mic.live` in `app/globals.css`:
   - Background: `var(--accent)`, color: `#fff` (or paper)
   - Animation: gentle pulse via `box-shadow` or `scale` keyframe

### Types

No existing `types/` directory. Implement minimal local Web Speech API types inline inside `app/page.tsx` (e.g., `declare SpeechRecognition interface`). Do not touch `lib/` or config files.

## Risks

| Risk | Mitigation |
|------|------------|
| SpeechRecognition not on `window` TypeScript types | Add a minimal inline declaration in `app/page.tsx` (no types/ directory, no lib/ changes) |
| Some browsers (Firefox, Safari) don't support SpeechRecognition | Fallback error message already handled; UX is the text input |
| Recording may time out or produce empty result | `onerror` / `onend` clean up state; empty transcript is a no-op |
| Chinese input on non-Chinese system | `lang = 'zh-CN'` tells the browser; works on Chrome |

## Rollback

Revert changes to `app/page.tsx` and `app/globals.css`. No other files touched.

## Approval
