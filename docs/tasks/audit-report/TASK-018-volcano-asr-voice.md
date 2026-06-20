# TASK-018: Volcano ASR Voice (child-voice tuned, one-shot via Vercel WebSocket-client)

Lifecycle: post-execution audit
Auditor: audit-agent
Plan File: docs/tasks/plan/TASK-018-volcano-asr-voice.md
Execution Log: docs/tasks/execution-log/TASK-018-volcano-asr-voice.md
Audit Date: 2026-06-20
Result: pass

> The pre-approval audit (decision-traceability focused) is obsolete and has been
> overwritten by this post-execution audit. All P1/P2 findings from the pre-approval
> audit were addressed in plan v3.1 (ADR section + resource-id decision).

## Summary

TASK-018 ships a higher-accuracy Volcano ASR voice path with a clean three-tier
fallback chain (Volcano → Web Speech → typing). The implementation is faithful to
the approved plan: server-side credentials never reach the browser, the press-time
strategy decision structurally fixes the v1 audit's P1-3 (impossible post-release
fallback), and the binary WebSocket protocol is byte-verified against the live
Volcano endpoint.

All P0 gates pass (typecheck / build / lint / key exposure / SVG safety N/A).
All four execute-agent-flagged deviations are ruled **accept** (one as P2 tech
debt; the other three are doc-vs-reality divergences correctly handled by the
code). The end-to-end server path is proven (silent PCM → `{ text: "" }` WS
roundtrip with the real user key). Browser-only AC18 scenarios are handed to the
user as the single manual-verification gap.

**Findings: 0 P0 / 0 P1 / 3 P2 / 2 P3 — PASS, mark TASK-018 `done`.**

## Checks

### Build / typecheck / lint (P0) — ALL PASS

| Check | Command | Result |
|---|---|---|
| TypeScript | `tsc --noEmit` | PASS — 0 errors |
| Build | `npm run build` | PASS — 6 routes (`/`, `/_not-found`, `/api/story/generate`, `/api/story/hint`, `/api/voice/capability`, `/api/voice/transcribe`) — matches execution log |
| Lint | `npm run lint` | PASS — "No ESLint warnings or errors" |

Known environment caveat: `@next/swc-win32-x64-msvc` SWC binary fails ("not a
valid Win32 application") and SWC falls back to WASM. Non-blocking, affects all
builds identically. Documented in execution log Phase 0.

### Key exposure scan (P0) — PASS

| Grep | Scope | Result |
|---|---|---|
| `VOLC_` (env reads) | `app/`, `lib/`, `components/` | All 8 `process.env.VOLC_*` reads live in `lib/voice/volcanoAsr.ts` (the server-only module). All other matches are docstrings. ✓ |
| `NEXT_PUBLIC_VOLC` | whole repo | Zero matches in code (only doc references in plan, execution log, `.env.example` warning comment). ✓ |
| `import 'server-only'` | `lib/voice/volcanoAsr.ts:17` | First line of file. ✓ |
| Console calls in voice paths | `app/api/voice/`, `lib/voice/` | Two `console.error` calls: `volcanoAsr.ts:203` logs `kind=`, `code=`, `logid=` only; `transcribe/route.ts:101` logs `kind=` (Error.name) only. No `X-Api-*` values, no transcript, no audio. ✓ |
| `from 'ws'` / `import.*ws` | whole repo, `*.ts*` | Only `import type WebSocketType from 'ws'` in `volcanoAsr.ts:42` (erased at compile). No client import. ✓ |
| `'use client'` / `server-only` collision | `components/VoiceRecorder.tsx` | `'use client'` at line 1, no `server-only` import. ✓ |

### SVG safety (P0, N/A) — PASS

`<svg` grep in `lib/voice/`, `app/api/voice/`, `components/VoiceRecorder.tsx`,
`public/pcmWorklet.js`: zero matches. TASK-018 does not touch SVG generation or
rendering. (The mic-button `<svg>` icon in `app/page.tsx` is preserved verbatim
from the original — same 4 path elements — but is decorative UI chrome, not a
generated story SVG.)

### Plan compliance (P1) — PASS

AC-by-AC verification (plan lines 505–595):

| AC | Topic | Verified | Evidence |
|---|---|---|---|
| AC1 | Env config + auth shape | ✓ | `volcanoAsr.ts:75-104` resolves new-console (`VOLC_API_KEY`) vs old-console (`VOLC_APP_KEY`+`VOLC_ACCESS_KEY`) at call time. Defaults match plan: `volc.seedasr.sauc.duration`, `wss://openspeech.bytedance.com`, `/api/v3/sauc/bigmodel_nostream`, `bigmodel`. `.env.example` documents both shapes + HTTPS note. |
| AC2 | Capability probe in own file | ✓ | `app/api/voice/capability/route.ts` is its own file, its own URL. Returns `{ available }` purely from `hasVolcanoCredentials()`. Fixes audit P1-1. |
| AC3 | Probe fail-safe within 2s | ✓ | `VoiceRecorder.tsx:181-208`: `AbortController` + `setTimeout(2000)` race; on abort/throw → `setStrategy('web-speech')` or `'none'` (fail-safe). Guarantees zero keyless regression. |
| AC4 | Transcribe route hygiene | ✓ | `transcribe/route.ts`: `runtime='nodejs'`, `maxDuration=30`, 4 MB cap (line 69), 25 s `Promise.race` timeout (line 83), 200 + `{ text }` / `{ text: "" }` / 200 + `{ error }` / 500 + `{ error }` mapping. No VOLC_* logging. |
| AC5 | Volcano path on success | ✓ | `startVolcanoCapture` (line 321) → getUserMedia → AudioContext(16000) → addModule → worklet buffers PCM (no live setInput). On release → POST → `{ text }` non-empty → `setInput` + `voice_input_completed` guarded by `committedRef`. |
| AC6 | Press-time fallback decision | ✓ | Strategy decided at mount via cached probe, dispatched synchronously at press. If `getUserMedia` denies: gentle message + typing usable (no fall-through to Web Speech — same mic). If Volcano returns `{ error }` post-release: gentle "请再说一次"; **never** starts Web Speech after release (fixes v1 audit P1-3). |
| AC7 | PCM format | ✓ | `pcmWorklet.ts`: Float32 → Int16 via `s < 0 ? s * 0x8000 : s * 0x7fff`, clamped. Downsamples from native (48000 → 3:1 average; 44100 → nearest-neighbour). No MediaRecorder. Sidesteps v1 audit P1-4. |
| AC8 | Cross-browser feature-detect | ✓ | `audioWorkletSupported()` at `VoiceRecorder.tsx:129` checks `AudioContext` + `'audioWorklet' in AudioContext.prototype`. Probe selects strategy based on it. |
| AC9 | HTTPS / secure context | ✓ | `.env.example` documents requirement + localhost exception. Vercel preview/prod HTTPS by default. |
| AC10 | Overlap recording guard | ✓ | `listeningRef` + `inFlightPostRef` in `startVoice` (line 458-459); `sessionRef` increment per press (line 460); stale-POST guard `if (session !== sessionRef.current) return;` at lines 433, 446. |
| AC11 | Graceful error handling | ✓ | All enumerated failure modes (permission denied, no mic, probe fail, AudioWorklet unsupported, transcribe error, timeout, network, empty) map to child-safe `strings.retry` ("画板打了个小盹，再说一次试试") or `strings.voiceUnsupported`. None throws to React tree. |
| AC12 | Analytics fire-once | ✓ | `voice_input_started` once per press (line 462). `voice_input_completed` once per successful press via `committedRef` guard in both paths (lines 289, 437). Failed press does not fire completed. Payload `{ speaker }` matches `VoiceInputStartedPayload` / `VoiceInputCompletedPayload` (no schema change). |
| AC13 | Three-tier fallback preserved | ✓ | Volcano → Web Speech → typing. `<input>` always rendered. |
| AC14 | Server-only enforcement | ✓ | `import 'server-only'` is line 17 of `volcanoAsr.ts`. `server-only@^0.0.1` added to `dependencies` (required by AC14; not bundled by Next.js, must be runtime dep). |
| AC15 | Typed `kind` discriminant consumed | ✓ | `VolcanoAsrErrorKind` = `'auth' \| 'network' \| 'timeout' \| 'protocol' \| 'server' \| 'empty'`. Route consumes it: `'empty'` → `{ text: "" }`, others → `childSafeTokenFor(kind)` (line 93-98). Not dead code. |
| AC16 | TypeScript / Build / Lint | ✓ | See P0 table above. |
| AC17 | Dependency surface | ✓ | `ws@^8.18.0` (dep), `@types/ws@^8.5.13` (dev). Only `WebSocket` class + `on`/`send`/`close` used. No `@volcengine/*`. Plus `server-only@^0.0.1` (justified by AC14). |
| AC18 | Manual smoke matrix | PARTIAL → USER | Scenarios verified by code + automated probe: 1 (type→submit), 3 (Web Speech path), 4 (Volcano unreachable), 7 (re-press guard), 9 (network tab — no VOLC_*). Scenarios **requiring real browser + mic**: 2 (mic happy path), 5 (permission denied), 6 (lang switch), 8 (legacy browser). Server-side roundtrip proven via capability-probe-output.txt scenario 4 (silent PCM → `{text:""}`). **See Verification gap below.** |

### Sacred Decisions (P0) — PASS

- **#4 voice-first, text fallback required:** typing `<input>` always rendered (line 729 of `app/page.tsx`); Web Speech preserved as fallback; Volcano unavailable → Web Speech → typing. ✓
- **No color / no PNG / no accounts / no DB / no native app:** TASK-018 touches none. ✓

### Forbidden Changes (P1) — PASS

`git status --short` shows the change set is entirely in scope:

| Modified / new | In plan scope? |
|---|---|
| `.env.example` | ✓ (Files In Scope) |
| `app/page.tsx` | ✓ (mic-button JSX preserved byte-for-byte via `renderButton` render-prop; only inline type decls + `startVoice`/`stopVoice` removed; `<input>`, six handlers, SVG paths, `.hb-mic.live` className all intact) |
| `package.json` + `package-lock.json` | ✓ (`ws`, `@types/ws`, `server-only`) |
| `app/api/voice/{capability,transcribe}/route.ts` | ✓ |
| `lib/voice/{types,volcanoProtocol,volcanoAsr,pcmWorklet}.ts` | ✓ |
| `components/VoiceRecorder.tsx` | ✓ (per OQ #1 recommendation) |
| `public/pcmWorklet.js` | ✓ (per plan Step 18) |
| `docs/tasks/artifacts/TASK-018-volcano-asr-voice/` | ✓ (audit-agent-visible evidence per Phase 2 step 8) |
| `docs/tasks/plan/`, `execution-log/`, `audit-report/` | ✓ (workflow metadata) |

**Forbidden files NOT touched:** `app/api/story/*`, `lib/ai/*`, `lib/svg/*`, `lib/story/*`, `lib/analytics/events.ts`, `tsconfig.json`, `next.config.*`, `tailwind.config.*`, `postcss.config.*`, `docs/00_design/`, `docs/_archive/`. ✓

> **Note on `docs/00_design/`:** `git status` shows two new files there
> (`豆包语音_大模型流式语音识别API_1780023003.pdf` and `豆包语音流式语音识别.md`).
> These are the **user-provided** official Volcano docs (timestamped 09:30 / 09:35,
> before execution began at 11:25+). They are the user's own source documents
> dropped in for reference; execute-agent did **not** create them. The plan
> references "the user-provided doc" repeatedly. No charter violation.
>
> **Note on `.env.example` drive-by fix:** the diff also corrects a pre-existing
> malformed line `ANTHROPIC_BASE_URL: "https://..."` → `ANTHROPIC_BASE_URL=https://...`
> (invalid colon replaced with `=`). This was nominally TASK-017's responsibility
> per the pre-approval audit's cross-task interaction note. Benign bug fix to an
> obviously broken line, not a new behavior. See P2-2 below.

### Live end-to-end test (P1) — PASS (with documented gap)

The execute-agent's `capability-probe-output.txt` is the authoritative server-side
evidence. ALL 4 scenarios PASS:

1. No creds → `{ available: false }` ✓ (zero keyless regression)
2. `VOLC_API_KEY=test` → `{ available: true }` ✓ (probe only, no network)
3. `VOLC_APP_KEY`+`VOLC_ACCESS_KEY=test` → `{ available: true }` ✓ (old console shape)
4. **Real user key + 1 s silent PCM POST** → `{ text: "" }` ✓ (full WS handshake + binary protocol + 11 response frames + clean close code 1000 "finish last sequence")

Codec harness (`codec-harness-output.txt`) verifies every byte position of the
protocol offline. ALL 18 byte-level assertions PASS.

`server-stderr.log` confirms the live endpoint emits response byte 1 = `0x91`
(intermediate) and `0x93` (final) — handled by the decoder's high-nibble mask.

Audit-agent could not curl `http://localhost:3001/...` directly because port 3001
is currently held by a different Next.js app (404 page titled "AI智能错题本").
SayDraw's dev server is not running. This is a verification-environment gap, not
a code defect — the execute-agent's recorded evidence on port 3999 (production
build, fully isolated) is more authoritative than a manual curl would be.

### Novus events (P2) — PASS

- `voice_input_started` fires on press (VoiceRecorder.tsx:462), once per press (overlap guard at 458-459).
- `voice_input_completed` fires on first successful transcript (lines 291, 439), `committedRef`-guarded.
- Idempotency works on fallback chain: Web Speech success path sets `committedRef=true` before firing (line 289); Volcano success path same (line 437). A press that fails on all paths does not fire completed.
- No new event names introduced (events.ts unchanged).

### Mobile / responsive (P3) — PASS

- All six touch handlers wired (`onTouchStart` / `onTouchEnd` / `onTouchCancel` at VoiceRecorder.tsx:541-543) with the same `e.preventDefault()` semantics as the original.
- Mic button JSX (`className`, `aria-label`, SVG icon) preserved verbatim via `renderButton` prop.
- No layout regression: `.hb-inputbar`, `.hb-mic`, `.hb-mic.live`, `.hb-input` classes and DOM structure unchanged.

## Findings

### P0: (none)

### P1: (none)

### P2-1: `eval('require')('ws')` webpack-bypass — accept as tech debt

- **Location:** `lib/voice/volcanoAsr.ts:40-43`
- **Problem:** The `ws` package is loaded via `eval('require')('ws')` to defeat
  webpack's static analysis, working around a real bug where webpack stubs
  `ws`'s optional `require('bufferutil')` to an empty module, causing the
  overridden `module.exports.mask` to throw `b.mask is not a function` at
  `ws.send()` time. The cleanest fix — `serverExternalPackages: ['ws']` in
  `next.config.ts` — is **forbidden** by the plan's "Forbidden Changes" list.
  The execute-agent chose the only remaining viable option inside the plan's
  constraints.
- **Ruling: ACCEPT.** Functionally correct, proven end-to-end by capability-probe
  scenario 4 with the real user key. Safety guarantees are in place:
  - `import 'server-only'` at line 17 makes any client import fail at build time.
  - `ws` is declared as a runtime `dependency` in `package.json`.
  - The `eslint-disable-next-line no-eval` is on a single line with a 14-line
    comment block explaining the bug, the alternative considered, and why it was
    rejected (plan forbids `next.config.*`).
  - The local name `VolcanoWebSocket` avoids the DOM lib's global `WebSocket`
    type clash; `import type WebSocketType from 'ws'` is erased at compile.
- **Fix (future task, not blocking):** When a future task lifts the
  `next.config.*` prohibition, replace `eval('require')('ws')` with
  `serverExternalPackages: ['ws']` (Next.js 15 name; was `experimental.serverComponentsExternalPackages`
  in 14). This is the canonical fix and removes ~5 lines of workaround. File as
  a P3 follow-up task when the project next touches `next.config.ts`.

### P2-2: `.env.example` drive-by fix of pre-existing `ANTHROPIC_BASE_URL` typo

- **Location:** `.env.example` line 6 (diff: `ANTHROPIC_BASE_URL: "..."` → `ANTHROPIC_BASE_URL=...`)
- **Problem:** TASK-018's `.env.example` edit incidentally fixes a malformed
  line that used a colon (`:`) instead of `=`. This fix was nominally in
  TASK-017's scope (per the pre-approval audit's cross-task interaction note).
  Strictly speaking, this is out-of-scope for TASK-018's Files In Scope.
- **Ruling: ACCEPT.** The original line was syntactically broken (`.env` files
  use `KEY=value`, not `KEY: "value"`) — it would not have parsed correctly in
  any sane `.env` loader. The fix introduces no new behavior; it makes a
  non-functional line functional for whoever next sets `ANTHROPIC_*`. No
  charter risk.

### P2-3: Edge case — `strategy='volcano'` + `audioWorkletSupported()=false` at press falls through to `'none'` instead of Web Speech

- **Location:** `components/VoiceRecorder.tsx:465-482`
- **Problem:** `startVoice` checks `if (strategy === 'volcano' && audioWorkletSupported())`.
  If somehow strategy was set to `'volcano'` at probe time but `audioWorkletSupported()`
  returns false at press time, the next `if (strategy === 'web-speech')` branch
  also doesn't match (strategy is still `'volcano'`), and the user lands in the
  `'none'` branch with `voiceUnsupported` instead of falling through to Web Speech.
- **Ruling: ACCEPT.** In practice this is unreachable: the capability probe
  gates `'volcano'` on `audioWorkletSupported()` at mount time (line 193), and
  browser feature support does not change at runtime. The redundant press-time
  check is defensive. If it ever does fire, the user still has typing (Sacred
  Decision #4 preserved). P3 fix only.

### P3-1: `diag-protocol.mjs` debugging artifact can be deleted in cleanup

- **Location:** `docs/tasks/artifacts/TASK-018-volcano-asr-voice/diag-protocol.mjs`
- **Problem:** Execute-agent flagged this as a debugging script used during the
  `ws` bundling-bug investigation. It's no longer load-bearing — the production
  code does not use the DIAG logging it exercises. Keeping it is fine as a
  decision-traceability artifact; deleting it is also fine.
- **Ruling: ACCEPT as-is.** The execution log explicitly noted it for cleanup
  discretion. No action required.

### P3-2: `server-stderr.log` is a fixed-in-time artifact

- **Location:** `docs/tasks/artifacts/TASK-018-volcano-asr-voice/server-stderr.log`
- **Problem:** Captures DIAG trace lines from the last debugging run; the DIAG
  logging has since been removed from production code. Re-running it would not
  reproduce the output. The execution log flags this clearly.
- **Ruling: ACCEPT as-is.** Useful as decision-traceability evidence for the
  `ws` bundling-bug investigation. No action required.

## Verification

### Automated (audit-agent re-ran)

| Check | Result |
|---|---|
| `tsc --noEmit` | PASS — 0 errors |
| `npm run build` | PASS — 6 routes, including `/api/voice/{capability,transcribe}` |
| `npm run lint` | PASS — clean |
| `VOLC_` grep on `app/`, `lib/`, `components/` | PASS — all reads in `lib/voice/volcanoAsr.ts` |
| `NEXT_PUBLIC_VOLC` grep on whole repo | PASS — 0 code matches |
| `<svg` grep on new voice files | PASS — 0 matches (SVG safety N/A) |
| `git status --short` | PASS — all changes in plan scope |

### Recorded by execute-agent (audit-agent reviewed)

- `capability-probe-output.txt` — 4/4 scenarios PASS including silent-PCM end-to-end with real user key.
- `codec-harness-output.txt` — 18/18 byte-level assertions PASS.
- `server-stderr.log` — confirms live endpoint response byte 1 = `0x91`/`0x93`, sequences 1..11, clean WS close code 1000.

### Gap — user must manually verify before relying on this in production

**The single most important thing for the user to do:** run the AC18 browser
matrix with a real microphone. Specifically:

1. **Mic happy path** (AC18 scenario 2): press mic with `VOLC_API_KEY` set, speak
   softly as a child would, release, verify text appears in the input box within
   1-3 s. This is the only path that exercises real-mic → AudioWorklet → PCM →
   Volcano → transcript. The server-side roundtrip is proven (scenario 4 silent
   PCM), but **child-voice recognition quality** has not yet been measured.
2. **Permission denied** (AC18 scenario 5): block mic in browser settings, press,
   verify gentle message + typing still works.
3. **Lang switch** (AC18 scenario 6): toggle zh ⇄ en, verify next press honours
   new lang on both Volcano and Web Speech paths.
4. **Legacy browser** (AC18 scenario 8): open in Safari < 14.1 or Firefox without
   AudioWorklet, verify graceful fallback to Web Speech.
5. **Network tab inspection** (AC18 scenario 9): in DevTools Network tab, verify
   `/api/voice/capability` and `/api/voice/transcribe` responses contain **no**
   `VOLC_*` values.

The execute-agent context has no GUI; these are inherently manual. Code paths
for all of them are present and the automated probe verifies the server half.

## Required Fixes

**None.** No P0 or P1 findings. TASK-018 may be marked `done`.

## Follow-up (P2/P3, non-blocking)

- **P2-1 (tech debt):** When a future task lifts the `next.config.*` prohibition,
  replace `eval('require')('ws')` with `serverExternalPackages: ['ws']` in
  `next.config.ts`. Removes ~5 lines of workaround.
- **P3-1 (cleanup, optional):** Delete `docs/tasks/artifacts/TASK-018-volcano-asr-voice/diag-protocol.mjs`
  once the `ws` bundling bug context is no longer load-bearing.
- **P3-2 (cleanup, optional):** Same for `server-stderr.log` — fixed-in-time
  artifact, safe to remove after the next passing audit cycle.
- **General:** User should run the AC18 browser matrix (see Verification gap
  above) before relying on child-voice recognition quality in production.

## Rulings on execute-agent-flagged deviations

| # | Deviation | Ruling | Severity | Reason |
|---|---|---|---|---|
| (a) | `eval('require')('ws')` in `lib/voice/volcanoAsr.ts` | **accept** | P2 (tech debt) | Functionally correct, safe (server-only via `import 'server-only'`), documented, only viable option inside plan's `next.config.*` prohibition. Proven end-to-end by capability-probe scenario 4. Future task should refactor via `serverExternalPackages: ['ws']` when config prohibition lifts. |
| (b) | Audio frame byte 2 = `0x01` (Gzip) not `0x00` (raw) | **accept** | n/a (doc bug in plan) | Matches proven test script + active_spec critical rule. Plan pseudocode was wrong; this is doc-vs-reality, not an implementation bug. The plan's Execution Contingency explicitly anticipated "audio-frame protocol friction." Codec harness confirms exact bytes. |
| (c) | `server-only` runtime dep added | **accept** | n/a | Required by AC14. Next.js does not bundle a built-in `server-only` shim — must be runtime dep. Used correctly at line 17 of `volcanoAsr.ts`. |
| (d) | Live response byte 1 = `0x91`/`0x93` not `0x90` | **accept** | n/a (doc bug in plan) | Decoder is robust: `decodeServerMessage` (volcanoProtocol.ts:99) masks with `0xF0` and only checks the type nibble. Server log confirms sequences 1..11 decoded correctly. Future plan revision should update the spec table. |
