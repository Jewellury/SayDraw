# Speaker Switch Mic Bug — Root Cause Investigation

## Summary

When the speaker is toggled (宝宝 ↔ 爸爸) and the user then clicks the microphone button, an error message "画板打了个小盹，再说一次试试" (`STRINGS[lang].errorMsg`) appears "immediately." This is NOT an API-level error — it originates from the client-side VoiceRecorder component, specifically from the `startVolcanoCapture` function's catch block or the `stopVolcanoCaptureAndTranscribe` function's error paths. The root cause is a **stale error state combined with `startVoice` early-return, caused by cascading callback recreation triggered by the `strings` prop being an inline object literal on every render.**

## Root Cause

There are **two co-operating causes**, neither sufficient alone:

### Cause 1 (Primary): Error state not cleared on speaker switch

`app/page.tsx:567,605` — The speaker toggle `onClick` handlers only call `setSpeaker(...)` with no accompanying `setError('')`. If a previous voice-recording attempt produced an error (Volcano getUserMedia denial, POST failure, empty audio, etc.), that error persists in the `<div className="hb-err">` element. The user switches speakers, the error is still visible, and clicking the mic creates the illusion of "clicking mic shows error."

### Cause 2: `startVoice` may early-return without calling `onClearError`

`components/VoiceRecorder.tsx:457-459` — `startVoice` checks two guards:
```
if (listeningRef.current) return;
if (inFlightPostRef.current) return;
```
If either is `true`, the function returns **before** `onClearError()` (line 463). This means a stale error is never cleared, even though the user pressed the mic.

### Cause 3 (Amplifier): Cascading callback recreation from unstable `strings` prop

`app/page.tsx:695-698` — The `strings` object is an **inline object literal**:
```tsx
strings={{
  voiceUnsupported: STRINGS[lang].voiceUnsupportedMsg,
  retry: STRINGS[lang].errorMsg,
}}
```
Every Page render creates a new `strings` object. This object flows into VoiceRecorder as a prop.

`components/VoiceRecorder.tsx:452` — `stopVolcanoCaptureAndTranscribe` has `strings` in its dependency array:
```
}, [onError, onTranscript, setListening, speaker, strings]);
```

`speaker` is also in this array. So when `speaker` changes during re-render, **both** `speaker` and `strings` change, triggering a **cascading recreation chain**:

```
speaker changes → Page re-renders → new strings object
  → stopVolcanoCaptureAndTranscribe recreated (speaker + strings deps)
    → stopVoice recreated (stopVolcanoCaptureAndTranscribe dep)
      → useImperativeHandle updated (stopVoice dep)
  → startWebSpeech recreated (speaker dep)
    → startVoice recreated (speaker + startWebSpeech deps)
```

**Every behavioral callback in VoiceRecorder is recreated on every speaker toggle.** While this does not directly call any error handler, it creates unnecessary instability and can expose timing bugs when an in-flight Volcano POST is still running.

### The Likely User Scenario

1. User records with Volcano ASR — the POST to `/api/voice/transcribe` starts (`inFlightPostRef.current = true`)
2. User switches speaker while the POST is in flight
3. VoiceRecorder re-renders with all callbacks recreated (Cause 3)
4. The in-flight POST completes with an error → calls `onError(strings.retry)` → parent `error` state = "画板打了个小盹"
5. User clicks mic → `startVoice` → `inFlightPostRef.current` might still be `true` (if the POST's `finally` block hasn't resolved yet, or if a new capture already re-set it) → returns early → `onClearError` NEVER called → error persists (Cause 2)
6. Because speaker switch didn't clear error (Cause 1), the error was already visible, and the failed mic click makes it look like clicking the mic triggered it

An alternative shorter path: the user had a previous failed recording, the error is showing, speaker switch doesn't clear it, clicking mic early-returns, error never clears.

## Evidence

### Code path traced

`app/page.tsx:57` — error string definition:
```
errorMsg: '画板打了个小盹，再说一次试试',
```

`app/page.tsx:695-698` — passed to VoiceRecorder as `strings.retry`:
```
strings={{
  voiceUnsupported: STRINGS[lang].voiceUnsupportedMsg,
  retry: STRINGS[lang].errorMsg,          // ← "画板打了个小盹"
}}
```

`app/page.tsx:693` — onError callback:
```
onError={(m) => setError(m)}              // ← sets parent error state
```

`app/page.tsx:694` — onClearError callback:
```
onClearError={() => setError('')}         // ← clears error only when called
```

`app/page.tsx:567,605` — speaker toggle buttons:
```
onClick={() => setSpeaker('dad')}         // ← NO setError('')
onClick={() => setSpeaker('kid')}         // ← NO setError('')
```

`components/VoiceRecorder.tsx:457-459` — startVoice early-return guards:
```
if (listeningRef.current) return;         // ← before onClearError
if (inFlightPostRef.current) return;      // ← before onClearError
```

`components/VoiceRecorder.tsx:368-378` — startVolcanoCapture catch (all errors → strings.retry):
```
} catch (e) {
  onError(strings.retry);                 // ← "画板打了个小盹"
  teardownVolcanoCapture();
  return false;
}
```

`components/VoiceRecorder.tsx:408-448` — stopVolcanoCaptureAndTranscribe (three onError sites, all → strings.retry):
```
onError(strings.retry);                   // line 410: no audio
onError(mapErrorToken(..., strings));     // line 444: transcription error → strings.retry
onError(strings.retry);                   // line 447: POST failure
```

`components/VoiceRecorder.tsx:452` — dependency array with BOTH speaker AND strings:
```
}, [onError, onTranscript, setListening, speaker, strings]);
```

### Critical observation about `strings` object instability

- `strings` is `{ voiceUnsupported, retry }` — both values are string literals from `STRINGS[lang]`.
- The **values** don't change when only `speaker` changes (same `lang`).
- But the **object reference** changes on every render (inline literal).
- This cascades to recreate every callback in the `stopVolcanoCaptureAndTranscribe` → `stopVoice` chain (4 hops).

## Reproduction

1. Load the app and ensure Volcano ASR is active (check that recording works)
2. Record something with the mic (press, hold, release) — keep it short
3. While the Volcano POST is still in the network (or immediately after), switch speaker by tapping the other avatar button
4. Notice if any error message appears or persists
5. Click the microphone button
6. Observe: error message "画板打了个小盹，再说一次试试" is displayed and does not clear

The bug is timing-sensitive — most likely to reproduce on slower network connections where the Volcano POST takes longer, giving the user time to switch speaker while `inFlightPostRef.current` is still `true`.

## Recommended Fixes

### Fix 1: Clear error on speaker switch (lowest risk — P1)

`app/page.tsx:567,605` — Add `setError('')` to speaker toggle onClick:

```tsx
// Before (line 567):
onClick={() => setSpeaker('dad')}

// After:
onClick={() => { setSpeaker('dad'); setError(''); }}

// Before (line 605):
onClick={() => setSpeaker('kid')}

// After:
onClick={() => { setSpeaker('kid'); setError(''); }}
```

### Fix 2: Memoize `strings` to prevent cascading callback recreation (medium risk — P2)

`app/page.tsx:695` — Wrap the `strings` object in `useMemo`:

```tsx
// Before:
strings={{
  voiceUnsupported: STRINGS[lang].voiceUnsupportedMsg,
  retry: STRINGS[lang].errorMsg,
}}

// After:
const voiceStrings = useMemo(() => ({
  voiceUnsupported: STRINGS[lang].voiceUnsupportedMsg,
  retry: STRINGS[lang].errorMsg,
}), [lang]);

// Then use:
strings={voiceStrings}
```

Without this, every render of Page creates a new `strings` object, which ripples through the entire VoiceRecorder callback chain (stopVolcanoCaptureAndTranscribe → stopVoice → useImperativeHandle). With `useMemo` keyed on `[lang]`, the object reference is stable when only `speaker` changes.

### Fix 3: Ensure `startVoice` always calls `onClearError` (low risk — P1)

`components/VoiceRecorder.tsx:457-463` — Move `onClearError()` before the early-return guards:

```tsx
const startVoice = useCallback(() => {
    onClearError();  // ← MOVED UP: always clear stale errors
    if (listeningRef.current) return;
    if (inFlightPostRef.current) return;
    sessionRef.current += 1;
    committedRef.current = false;
    track(EVENTS.VOICE_INPUT_STARTED, { speaker });
    // ... rest unchanged
```

This ensures any stale error is always cleared on mic press, regardless of guard state.

### Fix 4 (bonus): Await `AudioContext.close()` in teardown (P3)

`components/VoiceRecorder.tsx:401-404` — Note that `audioCtxRef.current?.close()` is `void`-ed. While not directly related to this bug, failing to await can cause `NotAllowedError` when creating a new AudioContext while the old one is still closing on some Chrome versions. Consider `await audioCtxRef.current?.close()` if the teardown function is made async.

---

## Verdict

- **Root cause found:** Yes — three cooperating causes (see above)
- **Primary file + lines:** `app/page.tsx:567,605` (speaker toggle no error clear) and `components/VoiceRecorder.tsx:457-459` (early-return before onClearError)
- **Bug description:** Error state persists across speaker switches because speaker toggle doesn't clear it, and `startVoice` can early-return without calling `onClearError`, making the stale error impossible for the user to dismiss.
- **Recommended fix priority:** Apply Fix 1 + Fix 3 together. Fix 2 is good hygiene but lower priority.
