# TASK-013 Execution Log — Voice Record on Release (interim → final)

**Status:** in_progress → audit
**Date:** 2026-06-07
**Scope:** single file — `app/page.tsx`

## Summary

Three small edits applied to `app/page.tsx` per the approved plan:
1. `startVoice()` config: `interimResults: true` → `false`, `continuous: true` → `false`
2. `startVoice()` body: added session-scoped `committed` flag, rewrote `rec.onresult` to filter final-only and fire side effects once
3. Input `placeholder`: ternary based on `listening` (recording hint vs. speaker-specific copy)

No CSS changes, no new dependencies, no API route changes, no env var changes.

---

## Edits Applied

### Edit 1 — `startVoice()` config flags (was lines 273-274; now lines 275-276)

```ts
rec.interimResults = false;   // was true
rec.continuous = false;       // was true
```

### Edit 2 — `startVoice()` body (was lines 263-292; now lines 263-298)

Inserted `let committed = false;` after `track(EVENTS.VOICE_INPUT_STARTED, ...)` and rewrote `rec.onresult` to filter for `r.isFinal` only, with a session-scoped `committed` guard that locks the side effects after the first non-empty final transcript.

```ts
  function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setError('这个浏览器还不支持语音，用打字也可以哦');
      return;
    }
    track(EVENTS.VOICE_INPUT_STARTED, { speaker });

    let committed = false;

    const rec = new SR();
    rec.lang = 'zh-CN';
    rec.interimResults = false;
    rec.continuous = false;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      if (committed) return;
      let finalText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0] ? r[0].transcript : '';
      }
      const t = finalText.trim();
      if (!t) return;
      committed = true;
      setInput(t);
      track(EVENTS.VOICE_INPUT_COMPLETED, { speaker });
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);

    recRef.current = rec;
    setListening(true);
    setError('');
    rec.start();
  }
```

### Edit 3 — Input placeholder (was lines 553-562; now lines 559-572)

```tsx
            <input
              className="hb-input"
              placeholder={
                listening
                  ? '说吧，松手就出来……'
                  : speaker === 'kid'
                    ? '宝宝说……（或者点麦克风）'
                    : '爸爸说……'
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
```

---

## Untouched (per plan)

- `rec.lang = 'zh-CN'` (line 274)
- `rec.onend` and `rec.onerror` (lines 291-292): unchanged, only call `setListening(false)`
- `stopVoice()` (lines 300-303): unchanged
- `onMouseDown` / `onMouseUp` / `onMouseLeave` / `onTouchStart` / `onTouchEnd` / `onTouchCancel` event wiring on the mic button (lines 530-535)
- `aria-label={listening ? '松开结束录音' : '长按录音'}` (line 529)
- `useCallback` `storyText`, `addScene`, `saveSettings`, `switchToFrame`, `startPlayback`, `handleKeyDown`, `useEffect` blocks
- All other input/footer/main/header/settings/playback markup

---

## Per-Criterion Self-Check (#1–#12)

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| 1 | Config flip: `interimResults: false`, `continuous: false` | PASS | Lines 275-276 |
| 2 | Defensive `onresult`: only `r.isFinal` results contribute | PASS | Line 283: `if (r.isFinal) finalText += ...` |
| 3 | One-shot fill: `setInput(t)` once per recording | PASS | Locked by `committed` guard (line 279) and early return on empty (line 286) |
| 4 | `voice_input_completed` only on non-empty final transcript | PASS | Line 286: `if (!t) return;` precedes the `track` call |
| 5 | Recording placeholder: "说吧，松手就出来……" while listening | PASS | Lines 562-563; original placeholder restored when `!listening` (lines 564-566) |
| 6 | Pulse preserved: `.hb-mic.live` still applied while listening | PASS | `className={'hb-mic' + (listening ? ' live' : '')}` at line 528 — untouched. No CSS changes. |
| 7 | No input clobbering: no `setInput('')` in voice path | PASS | Verified via grep: `setInput('')` does not appear inside `startVoice`/`stopVoice`/`onend`/`onerror` |
| 8 | Cleanup unchanged: `onend` and `onerror` set `setListening(false)` | PASS | Lines 291-292 |
| 9 | `onMouseLeave` / `onTouchCancel` unchanged: `stopVoice()` runs and final result delivered | PASS | Event wiring untouched (lines 532, 535); `stopVoice()` calls `rec.stop()` so `onresult` fires before `onend` |
| 10 | Build passes: `npm.cmd run build` succeeds | PASS | See "Build Output" below |
| 11 | Existing behavior preserved: typing, Enter, send, speaker toggle, settings, playback | PASS | None of those code paths were modified |
| 12 | Idempotency guard: `committed` is session-scoped, first non-empty final locks, subsequent return early | PASS | `committed` declared in `startVoice()` closure (line 271); set to `true` at line 287 before side effects; check at line 279 returns early. Closure is rebuilt on every `startVoice()` call. |

### Items Not Verifiable in This Environment

- **Criterion 3 / 5 / 6 manual end-to-end** (press-and-hold the mic in Chrome, observe no partial text, observe placeholder swap, observe final transcript fills once, observe send button enables and "画出来" generates a scene). This requires a browser with Web Speech + a working mic, which is not available in the current CI environment. **Flag for audit-agent to spot-check in Chrome desktop.**
- **Criterion 4 manual check** (silent recording: empty final transcript → no `voice_input_completed` event). Same environment limitation.

These were already in the plan's Verification Plan as "Manual in Chrome desktop" items.

---

## Verification Commands

### `npx tsc --noEmit`

```
$ npx tsc --noEmit
(no output)
```

**Result:** PASS — exit code 0, no diagnostics.

### `npm.cmd run build`

Output (truncated for readability; full log kept for audit):

```
> saydraw@1.0.0 build
> next build

- Next.js 15.5.19
- Environments: .env.local

   Creating an optimized production build ...
[non-fatal SWC binary warning: "@next/swc-win32-x64-msvc, but an error occurred: ... is not a valid Win32 application."]
[Next.js falls back to its non-SWC compiler path automatically]
   Compiled successfully in 3.7s
   Linting and checking validity of types ...
   Collecting page data ...
   Generating static pages (0/5) ...
   Generating static pages (5/5)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                                 Size  First Load JS
Γ£ô /                                        5.05 kB         107 kB
Γ£ô /_not-found                              994 B         103 kB
fƒ /api/story/generate                       123 B         103 kB
+ First Load JS shared by all               102 kB

Γ£ô (Static)   prerendered as static content
fƒ (Dynamic)  server-rendered on demand
```

**Result:** PASS — `Compiled successfully in 3.7s`, linting and type validity pass, all 5 static pages generated.

**Pre-existing SWC warning:** the `@next/swc-win32-x64-msvc` binary on this Windows host is not a valid Win32 module (likely an arch mismatch or stale install). Next.js 15 falls back to its non-SWC compiler transparently and the build completes normally. This warning is **not caused by TASK-013** — it appears on a clean checkout of `main` and is outside this task's scope. Flagged for awareness only; no action required from the audit-agent.

---

## Deviations from Plan

None. All three edits implemented exactly as specified in §"Implementation Strategy" of the plan file. No CSS change was needed (the inline placeholder swap is sufficient, as anticipated by the plan's "(optional) … prefer inline placeholder to avoid touching CSS" note).

## Artifacts

- `app/page.tsx` — modified (3 small edits, 1 file)
- `docs/tasks/progress.md` — TASK-013 row updated to `audit` after this log is written
- `docs/tasks/execution-log/TASK-013-voice-record-on-release.md` — this file

## Open Issues for Audit-Agent

1. **Manual Chrome verification** of criteria 3, 4, 5, 6 (press-and-hold UX, no partial fill, placeholder swap, one-shot fill, send-button enable) — must be done by a human in Chrome desktop with mic access.
2. **Pre-existing SWC warning** — non-blocking, environment-level. The build completes successfully via the fallback compiler. No action required unless the project wants to reinstall the SWC binary at a later date (out of TASK-013 scope).
3. The `committed` guard is intentionally module-free / closure-only. It does not survive across `startVoice()` calls (each press-of-mic rebuilds the closure). If a future task wants cross-session dedup, that would be a different design.
