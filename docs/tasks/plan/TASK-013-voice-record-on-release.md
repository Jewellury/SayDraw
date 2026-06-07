# TASK-013: Voice Record on Release (interim → final)

Owner Flow: plan-agent -> execute-agent -> audit-agent
Lifecycle: tracked in `docs/tasks/active_spec.md` and `docs/tasks/progress.md`

## Background

TASK-009 wired the mic button to Web Speech API with `interimResults: true` and `continuous: true`. The press-and-hold gesture (`onMouseDown` start, `onMouseUp`/`onMouseLeave`/`onTouchEnd`/`onTouchCancel` stop) is already in place — the input bar already behaves like "press to record, release to stop".

The remaining problem is **interim transcription**: the input box is filled character-by-character as the user speaks (`rec.onresult` accumulates every interim result and calls `setInput(t)`). For a parent + 4-year-old co-creation flow this is too noisy: the kid sees their half-formed words pop into the box and gets self-conscious, and the parent gets the impression that a half-baked sentence was already submitted.

The fix is to suppress interim results entirely and let the final transcript land in the input box **all at once when the user releases**.

This is a tiny interaction change, fully contained in the voice code path. No new dependencies, no API surface change, no design-token change, no settings change.

## Goal

Change the voice input so the input box is filled exactly once per recording, with the final recognized transcript, when the user releases the mic. No intermediate text is shown.

## Non-goals

- Auto-submit on release (the user must still press 画出来 to confirm)
- Any change to the `lang = 'zh-CN'` setting
- Any change to the speaker toggle / Enter-to-submit / send button behavior
- Adding recording duration, waveform, or any visual feedback beyond the existing pulse
- iOS Safari reliability (where `onresult` may not fire after `stop()`) — known limitation, explicitly out of scope
- A new npm dependency, a new analytics event, or a server route change
- Replacing the existing `.hb-mic.live` pulse animation

## Design Source

- `docs/00_design/frontend_design_spec.md` §4: "麦克风按钮放最显眼处…… 聆听时变暖橙并轻微脉动"
- `docs/00_design/HuaHuaBen.jsx:289-300` — reference mic button markup
- Existing `app/globals.css:345-361` `.hb-mic.live` + `hbMicPulse` keyframe — reused as-is

## Files In Scope

| File | Change |
|------|--------|
| `app/page.tsx` | `startVoice()` config: `interimResults: true` → `false`, `continuous: true` → `false`. `onresult`: filter to final-only and fill once. `voice_input_completed` only when final transcript is non-empty. Add "recording" placeholder logic on the input. |
| `app/globals.css` | (optional) add a small `.hb-input.recording` class only if the placeholder cannot be swapped via inline prop — prefer inline placeholder to avoid touching CSS |

No other files. No new directories. No new types. No `lib/`, `app/api/`, or `package.json` changes.

## Forbidden Changes

- Do not change `rec.lang = 'zh-CN'`
- Do not add a new npm dependency
- Do not add a new `NEXT_PUBLIC_*` env var
- Do not change any API route (`app/api/`)
- Do not change any file under `lib/`, `docs/00_design/`, or `docs/_archive/`
- Do not change the `.hb-mic` or `.hb-mic.live` CSS classes (the orange pulse stays)
- Do not change the `onMouseDown` / `onMouseUp` / `onMouseLeave` / `onTouchStart` / `onTouchEnd` / `onTouchCancel` event wiring on the mic button
- Do not add a new analytics event name; reuse `voice_input_started` and `voice_input_completed`
- Do not add auto-submit behavior

## Acceptance Criteria

1. **Config flip**: in `startVoice()`, `rec.interimResults = false` and `rec.continuous = false`. (Line 273-274 of the current file.)
2. **Defensive `onresult`**: only results where `r.isFinal` is true contribute to `setInput(...)`; if a non-final result somehow arrives (e.g. browser quirk), it is ignored.
3. **One-shot fill**: when `onresult` fires with a final transcript, `setInput(t)` runs once with the final transcript. Calling `setInput` inside the `for` loop is fine only if the loop body is guarded by `if (r.isFinal)`.
4. **Analytics**: `voice_input_completed` fires only when the final transcript is non-empty; if final transcript is empty (silence, no speech, error), it does not fire.
5. **Recording placeholder**: while `listening === true`, the input's `placeholder` shows "说吧，松手就出来……" (or a near-equivalent Chinese hint that does not leak the original speaker-specific copy). When `listening === false`, the original placeholder is restored.
6. **Pulse preserved**: while `listening === true`, the `.hb-mic.live` class is applied — orange background, paper icon, `hbMicPulse` animation. No change to the existing pulse.
7. **No input clobbering**: existing input value is preserved (a) at recording start, (b) on `onerror`, (c) on `onend` with empty result. The implementation must not call `setInput('')` anywhere in the voice code path.
8. **Cleanup unchanged**: `onend` and `onerror` still set `setListening(false)`.
9. **`onMouseLeave` / `onTouchCancel` unchanged**: if the user drags off the button or cancels, `stopVoice()` runs and the final result (if any) is delivered before the listening state clears.
10. **Build passes**: `npm.cmd run build` succeeds with no new TypeScript or lint errors.
11. **Existing behavior preserved**: typing, Enter-to-submit, send button, speaker toggle, settings panel, playback all work as before.
12. **Idempotency guard**: `startVoice()` declares a session-scoped `committed` flag (re-created on every fresh start). The first `onresult` invocation that yields a non-empty final transcript sets `committed = true` and then `setInput(t)` and `voice_input_completed` each fire exactly once. Subsequent `onresult` invocations in the same recording session return early without touching input or firing the event. The guard is local to the recognition session and is not module-level state.

## Verification Plan

1. Run `npx tsc --noEmit` from `E:\SayDraw` — must pass.
2. Run `npm.cmd run build` from `E:\SayDraw` — must pass.
3. Manual in Chrome desktop (only environment that supports Web Speech reliably):
   - Press and hold the mic button. Verify the input box does **not** show partial text. The placeholder should switch to the recording hint.
   - Speak a short sentence, then release. Verify the input box fills with the final sentence exactly once.
   - Verify the send button enables, then press 画出来. Verify the scene generates as before.
4. Manual in a browser without `SpeechRecognition` (or with mic permission denied):
   - Verify the existing fallback error message "这个浏览器还不支持语音，用打字也可以哦" still appears.
5. Verify existing text input: type text, press Enter → scene generates. Verify the input bar placeholder is unchanged when not listening.
6. Verify the `.hb-mic.live` pulse is visually identical to before (no CSS change).

## Implementation Strategy

### Edit `app/page.tsx` — `startVoice()` (current lines 263-292)

At the top of the `startVoice()` body, declare a session-scoped `committed` flag. It is local to this `startVoice()` closure and is naturally reset on every fresh call (the closure is recreated each time the user presses the mic):

```ts
let committed = false;
```

Change two config flags:

```ts
rec.interimResults = false;   // was true
rec.continuous = false;       // was true
```

In `rec.onresult`, only final results count and the **first** non-empty final transcript wins. A session-scoped `committed` guard makes the side effects idempotent, so a duplicate `onresult` from a quirky browser cannot fire `setInput` or `voice_input_completed` twice in one recording:

```ts
rec.onresult = (e: SpeechRecognitionEvent) => {
  if (committed) return;          // session-scoped guard; declared in startVoice() closure
  let finalText = '';
  for (let i = e.resultIndex; i < e.results.length; i++) {
    const r = e.results[i];
    if (r.isFinal) finalText += r[0] ? r[0].transcript : '';
  }
  const t = finalText.trim();
  if (!t) return;
  committed = true;               // lock for the rest of this recording
  setInput(t);
  track(EVENTS.VOICE_INPUT_COMPLETED, { speaker });
};
```

`rec.onend` and `rec.onerror` keep their current shape (`setListening(false)`); do not touch `setInput` from them. They also do not need to clear `committed` — the next `startVoice()` call rebuilds the closure with a fresh `false`.

### Edit `app/page.tsx` — input placeholder (current lines 553-562)

Switch the `placeholder` based on `listening`:

```tsx
placeholder={
  listening
    ? '说吧，松手就出来……'
    : speaker === 'kid'
      ? '宝宝说……（或者点麦克风）'
      : '爸爸说……'
}
```

No new state, no new CSS class required.

### Edit `app/page.tsx` — aria-label (current line 529)

Keep as is: `aria-label={listening ? '松开结束录音' : '长按录音'}`. Already correct for the new flow.

### No CSS changes

The existing `.hb-mic.live` (orange background + `hbMicPulse`) is reused as-is.

## Risks

| Risk | Mitigation |
|------|------------|
| iOS Safari may not fire `onresult` after `rec.stop()` — `voice_input_completed` may never fire and the input stays empty | Documented as known limitation, explicitly out of scope. The user can fall back to typing. Do not attempt to work around (would expand scope into a cross-browser recognition library swap). |
| Existing interim result handling mutates the input on every result — switching to "final only" is a small behavioral change for users who relied on the partial-fill feedback | The change is the explicit ask. No mitigation needed beyond clear changelog note in execution log. |
| Mic icon color "turns red" — the existing palette token is `--accent` (`#d9622b`, warm red-orange) which the design brief calls "暖橙" | Keep `--accent`. It is the same token the design calls "暖橙" and is visually the red-orange the task describes. If a brighter red is required, surface as a clarification before approval — do not introduce a new design token. |
| `continuous: false` means `onend` will fire shortly after the user stops speaking or releases; the small race between `onresult` and `onend` is benign because both set `listening=false` and `onend` does not touch `input` | No action needed; preserved-input invariant (#7) keeps the value safe. |
| Some browsers fire `onresult` multiple times with separate final results in a single session, causing duplicate `setInput` and `voice_input_completed` | Session-scoped `committed` flag in `startVoice()` closure: first non-empty final transcript locks the flag and ignores all subsequent results in that session. |

## Rollback

Revert the three small edits in `app/page.tsx` (`interimResults` / `continuous` flags, `onresult` loop, input placeholder ternary). No other files touched; revert is a single-file change.
