# TASK-018: Volcano ASR Voice (child-voice tuned, one-shot via Vercel WebSocket-client)

Lifecycle: tracked in `docs/tasks/active_spec.md` and `docs/tasks/progress.md`
Owner Flow: plan-agent -> execute-agent -> audit-agent
Lane: Full (server-side credentials, new server routes, custom binary WebSocket protocol, new runtime dependency `ws`, AudioWorklet capture, client/server contracts, cross-module change to `app/page.tsx`)

> **Third rewrite — grounded in the official Volcano doc.** This version replaces the v1 (HTTP 录音文件识别 one-shot) and v2 (browser-direct streaming via short-lived token mint) drafts in full. Both prior architectures are impossible for this account:
> - v1 picked the wrong product (the user's key is for **大模型流式语音识别**, not the HTTP file-recognition product).
> - v2 assumed Volcano offers a short-lived token-mint mechanism. The official doc reveals **Volcano ASR auth is static headers on the WebSocket handshake (`X-Api-*`)**. Browsers cannot set custom headers on a `WebSocket` upgrade, so the browser can never speak to Volcano directly. There is no STS / token-mint endpoint.
>
> The user has also **rejected self-hosted relay**. The only remaining compliant shape is: **a Vercel serverless function acts as a WebSocket *client* to Volcano's `bigmodel_nostream` endpoint (one-shot semantics over WebSocket), while the browser stays on plain HTTP.** The user's existing 大模型流式 key is reused unchanged. Live partial transcripts are dropped (one-shot only); the user accepted this tradeoff.

## Background

Today, voice input in SayDraw is 100% browser-native Web Speech API, inlined in `app/page.tsx` (no separate voice module):

- `app/page.tsx:13-57` — inline TS declarations for the unprefixed `SpeechRecognition` types.
- `app/page.tsx:255` — `recRef` holds the live `SpeechRecognition` instance.
- `app/page.tsx:381-416` — `startVoice()` builds `new SR()`, sets `lang`, `interimResults = false`, `continuous = false`, wires `onresult` (fills input once, fires `voice_input_completed`), `onend` / `onerror`. No auto-submit.
- `app/page.tsx:418-421` — `stopVoice()` calls `recRef.current?.stop()`.
- `app/page.tsx:280-288` — `toggleLang()` nulls `recRef` to force a fresh instance.
- `app/page.tsx:773-798` — mic button: press-and-hold/release UX (`onMouseDown` / `onTouchStart` → `startVoice()`; `onMouseUp` / `onMouseLeave` / `onTouchEnd` / `onTouchCancel` → `stopVoice()`). Six event handlers.
- `app/page.tsx:383-386` — if `SpeechRecognition` is unavailable, gentle message `"这个浏览器还不支持语音，用打字也可以哦"`; typing always usable.

**Pain point (user-stated):** young children speak softly, with immature articulation, often from across the room. Browser Web Speech mis-recognizes them (no child-voice acoustic model, no far-field gain control). Volcano's **大模型流式语音识别** is tuned for this — the `bigmodel` model is the best child-voice option in the Volcano lineup.

**Why one-shot over the streaming endpoints.** Volcano exposes three `wss://` endpoints for this product:

| Endpoint | Semantics | Used? |
|---|---|---|
| `wss://openspeech.bytedance.com/api/v3/sauc/bigmodel` | bidirectional streaming, live partials | no |
| `wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream` | send-all-then-get-one-result, highest accuracy | **YES (this plan)** |
| `wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async` | optimized streaming variant | no |

`bigmodel_nostream` is chosen because (a) it is the only endpoint the Vercel-as-WS-client architecture can use without a long-lived relay (send-all → one response → close), (b) the doc states it has the **highest accuracy**, (c) it is the only endpoint that supports the `audio.language` field (`zh-CN` / `en-US`) — exactly what a bilingual parent-child app needs, and (d) it reuses the user's existing 大模型流式 key (same `X-Api-*` auth, same resource id namespace `volc.bigasr.sauc.*`).

**New runtime dependency: `ws`.** This is the first task to add a runtime npm dependency. Justification: Vercel's Node runtime has **no built-in WebSocket client** (the browser's `WebSocket` global is not available server-side; Node 20 has no stable built-in WS client). The `ws` package (^8.x) is the canonical, battle-tested Node WebSocket library, runs on Node 20 with zero native dependencies, and — critically — accepts a `headers` option on the handshake upgrade request, which is the *only* way to inject the `X-Api-*` auth headers Volcano requires. `@types/ws` is added for TypeScript. No `@volcengine/*` SDK is used because the official SDKs are Python/Go/Java only; we implement the (well-documented) binary protocol directly. No audio-codec libraries are needed (we emit raw PCM).

**Deadline note.** The user has said this is for their child, not the hackathon ("不用担心时间，重点不是参加比赛"). The pre-approval audit's P1-5 (deadline scope risk) is therefore **dropped**. A degenerate Fast-Lane fallback is still documented (ship with the probe returning `available: false` → public path stays on Web Speech) in case execution runs long.

## Decision History (Architecture Decision Record)

This section reconstructs the full decision chain so a 6-month retrospective can fully recover why TASK-018 took the shape it did. Each ADR captures Context, Alternatives considered (with rejection reasons), Decision, User input citation, and Consequences. Where a decision was technical with no user input, that is stated explicitly — honesty over reconstruction.

### ADR-1: Streaming product family (大模型流式) not classic HTTP ASR products

**Context:** Volcano Engine operates multiple ASR product lines with different protocols (HTTP vs WebSocket), activation gates, and acoustic-model versions. The choice of product family is the highest-leverage decision: it constrains every downstream choice (protocol, endpoint, auth shape, billing model).

**Alternatives considered:**
- **(a) 大模型流式语音识别 (bigmodel family, WebSocket)** — latest 大模型 acoustic model, three endpoints (`bigmodel` / `bigmodel_nostream` / `bigmodel_async`) — the user's existing key is provisioned for this family
- **(b) 大模型录音文件识别 (HTTP, separate activation)** — batch file upload, separate product activation required → REJECTED because the user's existing key is NOT activated for this product; re-activation would block shipping
- **(c) 经典一句话识别 (HTTP, older model)** — legacy one-sentence product, older acoustic model → REJECTED because the older model is materially worse on child voice, which is the primary pain point this task exists to solve
- **(d) 录音文件识别标准版/极速版 (HTTP, older model)** — legacy batch products → REJECTED for the same child-voice quality reason as (c)

**Decision:** 大模型流式 product family (option a). The user's existing key is for this family, AND its `bigmodel` acoustic model is the best child-voice option in the Volcano lineup — which is the explicit problem statement of TASK-018.

**User input (2026-06-20):** "我已经拿到 火山 ASR 服务的流式语音识别的key和示例名" — the user stated in conversation that they already hold a key for the streaming-recognition product, which fixes the product family at the top of the decision chain.

**Consequences:**
- Gain: best (latest 大模型) acoustic model for child voice — the core pain point
- Lose: pure-HTTP simplicity — the streaming family is WebSocket-only, which forces the architectural work captured in ADR-3

### ADR-2: `bigmodel_nostream` endpoint (one-shot semantics) out of three streaming-family endpoints

**Context:** The 大模型流式 product family exposes three `wss://` endpoints with different request/response semantics. The choice of endpoint determines whether live partial transcripts are possible, whether the `language` field is supported, and how much UX redesign is needed.

**Alternatives considered:**
- **(a) `bigmodel` (bidirectional streaming, real-time partials)** — full-duplex WebSocket, words arrive as the child speaks → REJECTED for this task because using it well requires either a browser-direct WebSocket (impossible — see ADR-3) or a long-lived self-hosted relay (rejected by user — see ADR-3)
- **(b) `bigmodel_async` (bidirectional optimized variant)** — same relay requirement as (a) → REJECTED for the same reason, plus the doc does not advertise a meaningful accuracy gain over `bigmodel_nostream`
- **(c) `bigmodel_nostream` (send-all-then-receive, one-shot)** — single request, single final response, doc states highest accuracy, only endpoint supporting the `audio.language` field — CHOSEN

**Decision:** `bigmodel_nostream` (option c). One-shot semantics fit the existing press-and-hold/release UX without redesign; the doc states it has the highest accuracy; and the `language` field (`zh-CN` / `en-US`) is supported only here — a non-negotiable for a bilingual parent-child app.

**User input (2026-06-20):** implicit via rejection of the only path to live partials. The user rejected self-hosted relay ("不自建"), which was the sole route to endpoints (a) or (b); they then accepted the one-shot trade-off explicitly: "改回 one-shot（不要 relay）".

**Consequences:**
- Gain: highest stated accuracy, `language` field support, no UX redesign, simpler connection lifecycle
- Lose: live partial transcripts — the child sees the result only on release (after a 1–3 s roundtrip), not word-by-word as they speak. The downstream consequence is fully explored in ADR-4.

### ADR-3: Vercel function as outbound WebSocket client (THE central architecture decision)

**Context:** A browser cannot connect directly to Volcano (see alternative a below); an intermediary is needed to hold the static `X-Api-*` auth headers server-side and speak the binary protocol. The intermediary choice determines the entire runtime topology and the dependency surface of the project.

**Alternatives considered:**
- **(a) Browser-direct WebSocket to Volcano** — REJECTED: the W3C WebSocket API cannot set custom HTTP headers on the upgrade handshake; Volcano auth requires `X-Api-*` headers; would also leak `VOLC_*` credentials to the browser, violating AGENTS.md "DeepSeek API Key - Critical Rule" (the same server-side-only rule applies to `VOLC_*`)
- **(b) Short-lived token mint + browser-direct (the v2 plan's approach)** — REJECTED: the official Volcano doc the user provided on 2026-06-20 shows NO token-minting mechanism (no STS, no HMAC signing, no temporary credentials); auth is exclusively static handshake headers; the v2 plan collapsed the moment that doc arrived
- **(c) Self-hosted WebSocket relay service** — REJECTED by user ("不自建"): the ops burden and ongoing hosting cost of a separately-deployed always-on relay are not justified for a single child's personal tool
- **(d) Vercel function as outbound WS client** — CHOSEN: the Vercel Node runtime can use the `ws` npm package as a WebSocket CLIENT (an outbound connection, no long-lived inbound listener needed); creds stay server-side; the browser stays on plain HTTP; total roundtrip 1–3 s, well under the Vercel 30 s function cap

**Decision:** Vercel-as-WS-client (option d). One HTTP request from the browser triggers one outbound WebSocket from the Vercel function to Volcano; the connection lives only for the duration of that HTTP request.

**User input (2026-06-20):** "改回 one-shot（不要 relay）" (explicitly rejected self-hosted relay — alternative c); "走 A：现有 key + Vercel WS（推荐）" (confirmed the Vercel-WS-client shape — alternative d).

**Consequences:**
- Gain: no new infrastructure to operate; credentials remain server-side; fits Vercel's stateless Node runtime with no special configuration
- Lose: live partial transcripts (HTTP request/response is not a streaming surface to the browser); adds the `ws` runtime dependency — the first new runtime dependency in the project (justification required per AGENTS.md; the dependency-surface decision is captured in ADR-6)

### ADR-4: Accept loss of live partial transcripts

**Context:** True live-partial UX (Doubao-app style, words appearing on screen as the child speaks) requires a browser-side WebSocket consuming partial frames. That is impossible under ADR-3's chosen topology — the browser only sees a single HTTP roundtrip. This ADR isolates the resulting UX trade-off so it is not buried inside the architecture decision.

**Alternatives considered:**
- **(a) Accept the loss and ship one-shot** — input box fills once on release, after a 1–3 s roundtrip — CHOSEN
- **(b) Build a self-hosted relay to enable live partials** — REJECTED: same user rejection as ADR-3c ("不自建"), plus the doubling of operational surface for a single UX nicety on a personal tool
- **(c) Reverse-engineer a polling scheme on `bigmodel_async`** — REJECTED: the doc does not describe a poll-based consumption mode; the endpoint is bidirectional-streaming by design; fabricating a polling contract would be guesswork with no support guarantee

**Decision:** Accept the loss (option a). Ship one-shot; the child sees their words appear on release.

**User input (2026-06-20):** after the trade-off was explained three separate times in conversation, the user chose "改回 one-shot（不要 relay）" and confirmed "走 A：现有 key + Vercel WS".

**Consequences:**
- Gain: shipping simplicity, zero new infrastructure, smaller blast radius for a personal tool
- Lose: the magic "words appear as the child speaks" UX. **This is the most consequential UX trade-off in the entire task** — it is called out at the top of Non-goals and in the Goal section.
- Future enhancement hook: if live partials later become critical, build the relay (ADR-3 alternative c) as a follow-up task; nothing in the current plan blocks that path.

### ADR-5: AudioWorklet for PCM capture, not MediaRecorder

**Context:** Volcano's `bigmodel_nostream` endpoint requires raw PCM at 16 kHz / 16-bit / mono. The browser exposes two main audio-capture APIs with very different output characteristics, and the choice determines whether a transcoding step is needed.

**Alternatives considered:**
- **(a) AudioWorklet (`AudioContext` + `audioWorklet` processor)** — direct access to raw PCM sample frames in a worker scope — CHOSEN
- **(b) `MediaRecorder` + transcoding** — `MediaRecorder` emits compressed containers (Safari `mp4`, Firefox `ogg`, Chrome `webm`); using it would require a decoder + re-encoder to PCM → REJECTED because it adds a heavy codec dependency (forbidden by AGENTS.md "no audio-codec libs") AND introduces per-browser codec variance that the ACs explicitly want to sidestep
- **(c) `MediaRecorder` with format negotiation** — pick the best of whatever the browser offers, transcode that → REJECTED for the same codec-dependency reason as (b), plus strictly worse than (a) on every axis

**Decision:** AudioWorklet (option a). The worklet reads PCM frames directly and posts them to the main thread; no transcoding layer exists.

**User input:** technical decision, no user input.

**Consequences:**
- Gain: raw PCM produced directly (no transcoding dependency); bypasses cross-browser codec variance entirely (Safari mp4 / Firefox ogg / Chrome webm all become irrelevant); high sample quality
- Lose: requires HTTPS secure context (AudioWorklet is secure-context-only — covered by AC9); Safari 14.1+ only (older iOS falls back to Web Speech — covered by AC8). Both mitigations are already acceptance criteria.

### ADR-6: `ws` npm package as the only new runtime dependency

**Context:** ADR-3 requires a WebSocket client running inside the Vercel Node runtime. Node 20 has no stable built-in WebSocket client (the browser's `WebSocket` global is not available server-side). A library must be chosen. AGENTS.md requires explicit justification for new runtime dependencies.

**Alternatives considered:**
- **(a) `ws` npm package (^8.x)** — canonical Node WebSocket library, battle-tested, zero native deps, runs on Node 20, accepts a `headers` option on the upgrade handshake (the exact mechanism ADR-3 relies on) — CHOSEN
- **(b) `@volcengine/*` official SDK** — REJECTED: the Volcano doc the user provided lists official SDKs as Python / Go / Java only; **no JS SDK exists**, so this option is not actually available
- **(c) Hand-rolled WebSocket on `http.upgrade`** — REJECTED as wasteful: re-implementing RFC 6455 framing, masking, and the close handshake by hand adds risk and review burden with no benefit over the canonical library

**Decision:** `ws` (option a). Only the `WebSocket` client class plus `on` / `send` / `close` API surface is used.

**User input:** technical decision, no user input. (Context note: the Volcano doc the user provided on 2026-06-20 is what established that no JS SDK exists — alternative b was ruled out by the user's own source document.)

**Consequences:**
- Gain: minimal API surface (one class, three methods), zero native compilation, well-understood behaviour under Vercel Node runtime
- Lose: this is the first runtime dependency added to the project. Justification is captured in AC17 ("Dependency Surface") and reaffirmed in the Files In Scope table. `@types/ws` is added to `devDependencies` for TypeScript.

### ADR-7: Resource id `volc.seedasr.sauc.duration` (2.0 model, 小时版 billing)

**Context:** The Volcano `X-Api-Resource-Id` header selects both the model version (1.0 vs 2.0) and the billing model (小时版 / duration vs 并发版 / concurrent). The value must match what is activated in the user's Volcano console or the handshake is rejected.

**Alternatives considered:**
- **(a) `volc.bigasr.sauc.duration` (1.0 小时版)** — older 1.0 acoustic model, duration billing → REJECTED: user is on the 2.0 model, not 1.0
- **(b) `volc.bigasr.sauc.concurrent` (1.0 并发版)** — older 1.0 model, concurrency billing → REJECTED: wrong model version AND wrong billing model for this use case
- **(c) `volc.seedasr.sauc.duration` (2.0 小时版)** — latest 2.0 model, duration billing — CHOSEN
- **(d) `volc.seedasr.sauc.concurrent` (2.0 并发版)** — latest 2.0 model, concurrency billing → REJECTED: concurrency billing is for high-concurrency commercial deployments; SayDraw is a single child pressing occasionally

**Decision:** `volc.seedasr.sauc.duration` (option c).

**User input (2026-06-20):** "是2.0版，然后小时版和并发版都显示运行，是不是都支持的意思？" — the user confirmed they are on the 2.0 model and that both `duration` (小时版) and `concurrent` (并发版) show "运行中" (activated) in their console. The plan chooses 小时版 because SayDraw's single-child occasional-use pattern is the textbook fit for per-second duration billing, not per-peak-concurrency commercial billing.

**Consequences:**
- Gain: 2.0 model (latest, best for child voice — the task's core goal); 小时版 billing matches actual usage (billed per audio second, not for reserved concurrency)
- Lose: none operationally. Both variants are activated on the user's account, so switching to `volc.seedasr.sauc.concurrent` later (if usage pattern ever shifts to high concurrency) is a single env-var change with no re-activation step

### ADR-8: Three-tier fallback (Volcano → Web Speech → typing) with press-time decision

**Context:** Sacred Decision #4 ("voice-first, but text fallback required") is immutable. Volcano will fail sometimes (no creds in some envs, network drops, transcribe errors, unsupported browsers). The fallback topology must preserve both the voice-first promise and the typing safety net, AND it must fix a structural bug found in the v1 audit (P1-3: "post-recording fallback is logically impossible — by the time Volcano fails post-release, Web Speech cannot retroactively listen to the just-finished utterance").

**Alternatives considered:**
- **(a) Volcano-only** — REJECTED: violates Sacred Decision #4 (text fallback) and the user's stated browser matrix (Safari < 14.1, in-app webviews, etc.)
- **(b) Volcano + Web Speech with post-recording fallback** — REJECTED: this is the v1 plan's shape and the source of audit P1-3; once Volcano returns `{ error }` post-release, the audio is gone and Web Speech cannot re-listen to it
- **(c) Volcano + Web Speech with press-time decision via a cached capability probe** — CHOSEN: a `GET /api/voice/capability` probe runs once on mount (fail-safe to `false` within 2 s — AC3); the press handler reads the cached result and synchronously picks Volcano or Web Speech BEFORE any capture starts
- **(d) Volcano + typing only (drop Web Speech)** — REJECTED: loses the Web Speech path which is still valuable on browsers where Volcano creds are absent but native speech recognition works; also breaks the existing TASK-013 UX in those envs

**Decision:** Option (c). Capability probe cached on mount; strategy decision made at press time, never after release.

**User input:** product-rule-driven decision (Sacred Decision #4); no explicit user choice between alternatives. The press-time probe mechanism itself is a structural fix for audit P1-3, not a user-requested feature.

**Consequences:**
- Gain: the press-time decision structurally fixes audit P1-3 (no post-release impossible fallback); typing is always usable; Web Speech is preserved as a real secondary path on browsers where Volcano is unavailable; zero keyless regression (probe returns `false` → behaviour identical to pre-TASK-018)
- Lose: one extra HTTP roundtrip on mount (the capability probe). Mitigated by the 2 s fail-safe budget (AC3) and by the probe warming the Vercel function for the eventual transcribe call (audit P2-1 fix).

### Decision chain summary

The chain is: **user has streaming key** (ADR-1) → **must use WebSocket** → **browser can't hold Volcano headers** (ADR-3a/b rejected) → **user rejected self-hosted relay** (ADR-3c rejected) → **Vercel-as-WS-client** (ADR-3d chosen) → **one-shot endpoint** for simplicity (ADR-2) → **accept no live partials** (ADR-4) → **AudioWorklet for clean PCM** (ADR-5) → **`ws` library** since no JS SDK (ADR-6) → **2.0 小时版 resource id** from user's console (ADR-7) → **three-tier fallback** for resilience (ADR-8). If any link breaks (e.g., user later decides to build a relay), the chain is restorable from this section.

## Goal

Add a higher-accuracy Volcano ASR voice path: on release, the browser captures PCM (16 kHz / 16-bit / mono) via an AudioWorklet, POSTs it to `/api/voice/transcribe`; a Vercel function opens a short-lived outbound WebSocket to Volcano's `bigmodel_nostream` endpoint (auth via static `X-Api-*` headers), speaks the custom binary protocol, receives one final transcript, and returns `{ text }` to the browser. The mic button prefers Volcano; if Volcano is unavailable (no creds, probe failure, transcribe error), it degrades to the existing Web Speech API path; if Web Speech is also unavailable, typing is always usable. Server-side credentials never reach the browser.

Specifically:

1. **Capability probe on mount.** `GET /api/voice/capability` returns `{ available: boolean }`. Probe fetch failure (network / non-2xx / timeout / parse error) **must** set `available = false` within a 2s budget (fail-safe).
2. **Strategy decision on press, not after release.** When `available === true` and AudioWorklet is supported, the press starts the Volcano path (getUserMedia + worklet capture, buffering PCM). When `available === false`, the press synchronously starts Web Speech instead. **The fallback decision is instant at press time** because the probe result is already cached — this is the structural fix for the prior audit's P1-3 (post-release fallback is logically impossible).
3. **On release.** Volcano path: stop the worklet, assemble the PCM `Blob`, POST to `/api/voice/transcribe`; on `{ text }` within 25s, `setInput(text)` + `voice_input_completed`; on `{ error }` or timeout, gentle "请再说一次" message (typing still usable). Web Speech path: `recRef.current?.stop()` (unchanged).
4. **No partial transcripts.** The input box does not fill live (one-shot only). The user accepted this.
5. **No auto-submit.** Transcript fills the input; parent taps 画出来 (TASK-013 behaviour preserved).
6. **Three-tier fallback preserved.** Volcano (via Vercel WS-client) → Web Speech → typing.
7. **Analytics parity.** `voice_input_started` once on press; `voice_input_completed` once on first successful transcript (idempotency `committed` guard preserved). No new event names.
8. **Zero keyless regression.** With no `VOLC_*` creds, probe returns `available: false` → Web Speech path → behaviour identical to pre-TASK-018.

## Non-goals

- **Live partial transcripts** (requires a long-lived bidirectional WS relay the user rejected; `bigmodel_nostream` is one-shot by design).
- **Voice Activity Detection / auto-stop on natural pause** (Doubao-app style tap-to-start/stop). Future enhancement.
- **Self-hosted Node WebSocket relay** (user explicitly rejected).
- **Browser-direct connection to Volcano** (impossible: browsers cannot set WS headers; would leak creds).
- **Speech synthesis / TTS** (`SpeechSynthesis` untouched).
- **Auto-submit on transcript** (input filled; parent taps 画出来).
- **Any change to the SVG / story pipeline** (`/api/story/*`, `lib/ai/*`, `lib/svg/*`, prompts).
- **Removal of the typing fallback** (Sacred Decision #4) or the Web Speech API path (kept as fallback; inline type declarations stay).
- **Change to mic button JSX, the six event handlers, or the `.hb-mic.live` pulse animation.**
- **Bilingual live-switching mid-recording** (a recording uses the `lang` active at press time).
- **Audio persistence** (PCM never written to disk, never logged).
- **New heavy deps beyond `ws` + `@types/ws`** (no `@volcengine/*`, no audio-codec libs).
- **The `bigmodel` / `bigmodel_async` streaming endpoints** (would require a relay).
- **Change to `docs/00_design/` or `docs/_archive/`** (source-document protection).

## Design Source

- `app/page.tsx:773-798` — existing press-and-hold/release mic UX (preserved; zero JSX change).
- `app/page.tsx:381-421` — existing `startVoice()` / `stopVoice()` Web Speech implementation (preserved as fallback; internals renamed `startWebSpeech` / `stopWebSpeech`; public names kept as strategy-aware dispatchers).
- `app/page.tsx:13-57` — existing inline `SpeechRecognition` type declarations (preserved).
- AGENTS.md "Sacred Product Decisions" #4 — voice-first but text fallback required (drives the three-tier chain).
- AGENTS.md "DeepSeek API Key - Critical Rule" — server-side only, never `NEXT_PUBLIC_*` (same rule applies to `VOLC_*`).
- AGENTS.md "Novus-Friendly Event Naming" — `voice_input_started` / `voice_input_completed` reserved, reused unchanged.
- `lib/analytics/events.ts:26-32, 41-42` — existing event names + payload shapes (reused, not extended).
- Official Volcano doc "豆包语音 · 大模型流式语音识别 API" (user-provided) — drives the entire Volcano bigmodel_nostream Contract section below.

## Files In Scope

| File | Action | Purpose |
|---|---|---|
| `lib/voice/types.ts` | **NEW** | `TranscribeRequest`, `TranscribeResponse` (`{ text }` \| `{ error }`), `CapabilityResponse` (`{ available }`), `VoiceLang = 'zh-CN' \| 'en-US'`. Isomorphic (shared by client and server); no server-only code leaks here. |
| `lib/voice/volcanoProtocol.ts` | **NEW (isomorphic, pure functions)** | Binary protocol codec: `encodeFullClientRequest(json)`, `encodeAudioFrame(pcm, isLast)`, `decodeServerFrame(buffer)`. Pure functions over `Buffer`; no I/O. Unit-testable in isolation. |
| `lib/voice/volcanoAsr.ts` | **NEW (server-only, `import 'server-only'`)** | `transcribeWithVolcano(pcm: Buffer, lang): Promise<string>` — opens `ws` WebSocket to `bigmodel_nostream` with `X-Api-*` headers, sends frames per protocol, resolves with `result.text`. Reads all `VOLC_*` env vars. Also exports `hasVolcanoCredentials()` and typed `VolcanoAsrError` (with `kind`). |
| `app/api/voice/transcribe/route.ts` | **NEW** | `POST` multipart handler. Validates audio, calls `transcribeWithVolcano`, returns `{ text }` or `{ error }`. Never logs creds. `runtime = 'nodejs'`, `maxDuration = 30`. 4 MB body limit. 25s `AbortController`. |
| `app/api/voice/capability/route.ts` | **NEW** (own file — fixes audit P1-1) | `GET` → `{ available: hasVolcanoCredentials() }`. Separate URL from transcribe. |
| `lib/voice/pcmWorklet.ts` | **NEW (client, AudioWorklet processor)** | Reads mic PCM at 16 kHz mono 16-bit little-endian, posts `ArrayBuffer` to main thread. Downsamples from native rate (often 48 kHz) if `new AudioContext({ sampleRate: 16000 })` is not honoured. |
| `app/page.tsx` | **MODIFY** | Capability probe on mount (fail-safe, 2s budget); strategy resolver in `startVoice`/`stopVoice` (public names preserved); AudioContext + worklet lifecycle; live `setInput` only on final result; overlap guard. Mic button JSX unchanged. Inline `SpeechRecognition` types preserved as fallback. |
| `components/VoiceRecorder.tsx` | **NEW (recommended — see Open Question #1)** | Optional extraction of the new path. Judgement call for execute-agent. |
| `.env.example` | **MODIFY** | Add `VOLC_API_KEY`, `VOLC_APP_KEY`, `VOLC_ACCESS_KEY`, `VOLC_RESOURCE_ID`, `VOLC_ENDPOINT_PATH`, `VOLC_BASE_URL`, `VOLC_MODEL_NAME`. No real values. Server-side-only rule reaffirmed. |
| `package.json` | **MODIFY** | Add `ws` (^8.x) to `dependencies`, `@types/ws` to `devDependencies`. First runtime dep add. |

## Forbidden Changes

- **No long-lived WebSocket server on Vercel** — we are only a WS *client* making a brief outbound connection inside one HTTP request.
- **No browser-direct connection to Volcano** — browsers cannot set WS headers; would leak creds.
- **No self-hosted relay service** — user explicitly rejected.
- **No deletion of the typing fallback** (Sacred Decision #4) or the Web Speech API path.
- **No `NEXT_PUBLIC_VOLC_*` exposure** anywhere (client bundles, props, serialised state).
- **No change to `/api/story/*`, `lib/ai/*`, `lib/svg/*`, prompts.**
- **No change to `docs/00_design/` or `docs/_archive/`** (source-document protection).
- **No new heavy deps beyond `ws` + `@types/ws`** (no `@volcengine/*` SDK, no audio-codec libs).
- **No change to `tsconfig.json`, `next.config.*`, `tailwind.config.*`, `postcss.config.*`.**
- **No change to the mic button JSX / six event handlers / `.hb-mic.live` pulse.**
- **No new analytics event names** (`voice_input_started`, `voice_input_completed` reused).
- **No auto-submit on transcript.**
- **No logging of audio content, transcripts, or credentials** anywhere (client or server). Only `X-Tt-Logid` may be logged server-side for debugging.
- **No committing of `.env.local`** or any file containing real `VOLC_*` values.

## Volcano bigmodel_nostream Contract (grounded in the official doc — encode verbatim in code)

This section is the single source of truth execute-agent implements against. Every byte position is specified. No guessing.

### Endpoint

- Base: `VOLC_BASE_URL` (default `wss://openspeech.bytedance.com`)
- Path: `VOLC_ENDPOINT_PATH` (default `/api/v3/sauc/bigmodel_nostream`)
- Full URL: `${VOLC_BASE_URL}${VOLC_ENDPOINT_PATH}` — opened as a `ws` WebSocket client.

### Auth — HTTP headers on the WebSocket upgrade request (NO token mint, NO STS)

The `ws` library accepts a `headers` option on `new WebSocket(url, { headers })` which sets arbitrary headers on the HTTP upgrade handshake. This is the *only* mechanism that makes browser-impossible custom-header auth possible from the server.

**New console** (when `VOLC_API_KEY` is set):
```
X-Api-Key: <VOLC_API_KEY>
X-Api-Resource-Id: <VOLC_RESOURCE_ID>          # default volc.seedasr.sauc.duration
X-Api-Request-Id: <random UUID v4 per request>
X-Api-Sequence: -1
```

**Old console** (when `VOLC_API_KEY` is unset and `VOLC_APP_KEY` + `VOLC_ACCESS_KEY` are set):
```
X-Api-App-Key: <VOLC_APP_KEY>
X-Api-Access-Key: <VOLC_ACCESS_KEY>
X-Api-Resource-Id: <VOLC_RESOURCE_ID>          # default volc.seedasr.sauc.duration
X-Api-Request-Id: <random UUID v4 per request>
X-Api-Sequence: -1
```

`hasVolcanoCredentials()` returns true iff (new-console shape set) OR (old-console shape fully set). The plan supports **both** shapes simultaneously; the active shape is resolved at call time.

**Response headers to capture:** `X-Api-Connect-Id` and `X-Tt-Logid`. **Only `X-Tt-Logid` may be logged** (server-side, on error). Never log any `X-Api-*` request header value.

### Audio format (server receives PCM, forwards to Volcano unchanged)

| Field | Value |
|---|---|
| `format` | `pcm` |
| `codec` | `raw` (means PCM) |
| `rate` | `16000` (only supported value) |
| `bits` | `16` (only supported value) |
| `channel` | `1` (mono) |
| Sample encoding | `pcm_s16le` — signed 16-bit **little-endian** PCM samples |

Note: the PCM *samples* are little-endian (PCM convention). All binary-protocol *integer header fields* are **big-endian** (network order). Do not confuse the two.

### Custom binary protocol — all integer fields BIG-endian

WebSocket frames carry a 4-byte custom header + payload. Bit layout:

**Byte 0** — `0x11` always:
- high nibble `0b0001` = protocol version 1
- low nibble `0b0001` = header size 1 (means 1 × 4 = 4 bytes)

**Byte 1** — high nibble = message type, low nibble = type-specific flags:

| Message type | Type nibble | Flags | Byte 1 hex | Used in this plan |
|---|---|---|---|---|
| Full client request | `0b0001` (1) | `0b0000` (normal) | `0x10` | initial JSON config frame |
| Audio only | `0b0010` (2) | `0b0000` (more coming) | `0x20` | each PCM chunk except last |
| Audio only | `0b0010` (2) | `0b0010` (last packet) | `0x22` | final PCM frame (marks end-of-stream) |
| Full server response | `0b1001` (9) | `0b0000` | `0x90` | the one transcript we read |
| Server error | `0b1111` (15) | `0b0000` | `0xF0` | error frame |

**Byte 2** — high nibble = serialization, low nibble = compression:

| Payload | Ser nibble | Comp nibble | Byte 2 hex |
|---|---|---|---|
| JSON, no compression | `0b0001` | `0b0000` | `0x10` |
| JSON, Gzip | `0b0001` | `0b0001` | `0x11` |
| Raw PCM (no serialization) | `0b0000` | `0b0000` | `0x00` |

**Byte 3** — reserved, always `0x00`.

### Frame layouts (exact byte order)

**Client → Server — Full client request:**
```
[ 4B header = 0x11 0x10 0x11 0x00 ]   (JSON + Gzip recommended)
[ 4B payload size  — BE uint32      ]
[ N bytes payload  — Gzipped JSON   ]
```
(If config sent without Gzip: byte 2 = `0x10`, payload = raw UTF-8 JSON.)

**Client → Server — Audio only (more coming):**
```
[ 4B header = 0x11 0x20 0x00 0x00 ]
[ 4B payload size — BE uint32     ]
[ N bytes payload — raw PCM s16le ]
```

**Client → Server — Audio only (LAST packet, end-of-stream):**
```
[ 4B header = 0x11 0x22 0x00 0x00 ]
[ 4B payload size — BE uint32 (0 if no trailing bytes, else size of last chunk) ]
[ optional trailing PCM bytes (may be empty) ]
```

**Server → Client — Full server response:**
```
[ 4B header = 0x11 0x90 0x1Y 0x00 ]   (Y = compression nibble: 0 none, 1 Gzip)
[ 4B sequence     — BE int32 (signed) ]
[ 4B payload size — BE uint32         ]
[ N bytes payload — (Gzipped if Y=1) JSON ]
```

**Server → Client — Error:**
```
[ 4B header = 0x11 0xF0 0x00 0x00 ]
[ 4B error code        — BE uint32 ]
[ 4B error msg size    — BE uint32 ]
[ N bytes error msg    — UTF-8      ]
```

### Send sequence (one-shot via `bigmodel_nostream`)

1. **Open WS** to `${VOLC_BASE_URL}${VOLC_ENDPOINT_PATH}` with the `X-Api-*` headers above (`new WebSocket(url, { headers })`). Wait for `open`.
2. **Send Full client request** — header `0x11 0x10 0x11 0x00` + 4B BE size + Gzipped JSON payload (see payload below).
3. **Send Audio only chunks** — split PCM into ~3200-byte frames (100 ms of audio at 16 kHz/16-bit/mono; doc recommends 100–200 ms / 3200–6400 bytes per frame). Each non-last chunk: header `0x11 0x20 0x00 0x00` + 4B BE size + PCM bytes.
4. **Send LAST Audio only** — header `0x11 0x22 0x00 0x00` + 4B BE size (0 or size of remaining bytes) + optional trailing bytes. This tells Volcano "audio is complete, produce the final result".
5. **Receive one Full server response** — parse header, read sequence, read size, read (decompress if needed) JSON, extract `result.text`. (Ignore any further frames; close after the first full response or an error.)
6. **Close WS** (`ws.close()`).

Total roundtrip target: 1–3 s for a typical child utterance. Well under Vercel's 30 s cap.

### Full client request JSON payload
```json
{
  "user": { "uid": "saydraw-session-<uuid>" },
  "audio": {
    "format": "pcm",
    "rate": 16000,
    "bits": 16,
    "channel": 1,
    "language": "zh-CN"
  },
  "request": {
    "model_name": "bigmodel",
    "enable_itn": true,
    "enable_punc": true,
    "enable_ddc": false,
    "result_type": "full"
  }
}
```
- `audio.language`: `"zh-CN"` or `"en-US"` (passed through from the client's `lang`). **Doc states `language` is only supported on the `bigmodel_nostream` endpoint** — another reason this endpoint is the right pick.
- `request.model_name`: `"bigmodel"` (overridable via `VOLC_MODEL_NAME`, default `bigmodel`).
- `enable_itn` (inverse text normalization: digits/units), `enable_punc` (punctuation) both on for readable child transcripts.

### Server response JSON
```json
{
  "result": {
    "text": "整个音频的识别结果文本",
    "utterances": [
      { "text": "...", "definite": true, "start_time": 0, "end_time": 1705 }
    ]
  },
  "audio_info": { "duration": 3696 }
}
```
Extract `result.text` (the full concatenated transcript). Ignore `utterances` for MVP.

### Error codes (map each to child-safe message + log code server-side)

| Code | Meaning | Mapping |
|---|---|---|
| `20000000` | Success | n/a (not an error) |
| `45000001` | Invalid params | `VolcanoAsrError('protocol')` → gentle message |
| `45000002` | Empty audio | `VolcanoAsrError('empty')` → `{ text: '' }` (no transcript; gentle "请再说一次") |
| `45000081` | Packet timeout | `VolcanoAsrError('timeout')` → gentle message |
| `45000151` | Audio format incorrect | `VolcanoAsrError('protocol')` → gentle message + **trigger the sequence-field contingency** below |
| `550xxxxx` | Internal server error | `VolcanoAsrError('server')` → gentle message |
| `55000031` | Server busy | `VolcanoAsrError('server')` → gentle message |

### Execution contingency — audio-frame sequence field

The frame layouts above are encoded verbatim from the doc the user provided. The doc's client→server audio layout is `[4B header][4B payload size][payload]` with the end-of-stream marker carried in the **flags nibble** (`0b0010`). If, during execution, Volcano returns `45000151` (audio format incorrect) on the audio frames, the most likely cause is that this particular gateway additionally expects a 4-byte big-endian sequence field on audio frames (positive incrementing for non-last, `-1` for last), i.e. `[4B header][4B sequence BE int32][4B payload size][payload]`. In that case execute-agent adds the sequence field to `encodeAudioFrame` (sequence = 1, 2, 3, … for non-last; `-1` for the last frame) and re-tests. The full-client-request and server-response layouts are unchanged either way. This is the single most likely point of protocol friction; the plan names it so execute-agent does not have to rediscover it.

## Architecture (locked)

```
Browser                         Vercel function                Volcano ASR
  │                                 │                              │
  │ 1. getUserMedia + AudioWorklet  │                              │
  │    captures PCM 16k/16b/mono    │                              │
  │ 2. On release: POST PCM Blob    │                              │
  │    to /api/voice/transcribe     │                              │
  │    (multipart, field 'audio')   │                              │
  ├────────────────────────────────>│                              │
  │                                 │ 3. new WebSocket(VolcanoURL, │
  │                                 │       { headers: X-Api-* })  │
  │                                 ├─────────────────────────────>│
  │                                 │ 4. send Full client request  │
  │                                 │    (JSON, Gzipped, 4B hdr)   │
  │                                 ├─────────────────────────────>│
  │                                 │ 5. send Audio only requests  │
  │                                 │    (PCM chunks, 4B hdr each) │
  │                                 ├─────────────────────────────>│
  │                                 │ 6. send last Audio only      │
  │                                 │    (flags=0b0010)            │
  │                                 ├─────────────────────────────>│
  │                                 │ 7. receive Full server resp  │
  │                                 │    (parse result.text)       │
  │                                 │<─────────────────────────────┤
  │                                 │ 8. ws.close()                │
  │ 9. HTTP 200 { text: "..." }     │                              │
  │<────────────────────────────────┤                              │
  │ 10. setInput(text)              │                              │
  │     voice_input_completed       │                              │
```

The Vercel function is a **WebSocket client**, not a server. The connection lives only for the duration of one HTTP request (1–3 s typical). This is fully compatible with Vercel's stateless Node runtime.

## Three-tier Fallback Chain

```
mic pressed
  -> if listeningRef.current / volcanoInFlightRef.current: ignore (overlap guard, AC10)
  -> voice_input_started (always, once)
  -> reset committedRef
  -> if volcanoAvailable (probe returned true within 2s on mount):
       getUserMedia + AudioWorklet capture
         NotAllowedError / NotFoundError -> gentle msg, typing usable (no Web Speech fallback; same mic)
         AudioWorklet unsupported        -> startWebSpeech() synchronously (AC9)
       (capture buffers PCM; input box NOT updated live — one-shot)
       on release:
         POST /api/voice/transcribe (PCM blob)
           { text: "..." } within 25s -> setInput(text), voice_input_completed (committedRef)
           { error } / timeout / network -> gentle "请再说一次", typing usable
  -> else (probe returned false): startWebSpeech()
       transcript lands -> setInput(t), voice_input_completed (committedRef — no double fire)
       empty / unsupported -> gentle msg, typing usable
  -> typing (always available)
```

**Critical (audit P1-3 fix):** the strategy decision is made at **press time** using the cached probe result, never after release. Post-release Volcano failure shows a gentle message and leaves typing usable — it does **not** attempt to start Web Speech (which would be listening to silence). This is structurally different from the v1 one-shot plan that was logically broken.

## Acceptance Criteria

### AC1: Environment Configuration
- `VOLC_BASE_URL` defaults to `wss://openspeech.bytedance.com`; `VOLC_ENDPOINT_PATH` defaults to `/api/v3/sauc/bigmodel_nostream`; `VOLC_RESOURCE_ID` defaults to `volc.seedasr.sauc.duration` (2.0 小时版 — resolved in Open Question #2 and ADR-7); `VOLC_MODEL_NAME` defaults to `bigmodel`.
- Auth shape resolved at call time: if `VOLC_API_KEY` set → new console (`X-Api-Key`); else if `VOLC_APP_KEY` + `VOLC_ACCESS_KEY` set → old console (`X-Api-App-Key` + `X-Api-Access-Key`); else → no creds (capability false).
- All env reads are server-side only (`process.env.*` in `lib/voice/volcanoAsr.ts`); **never `NEXT_PUBLIC_*`**. Grep `lib/voice/**`, `app/api/voice/**`, `app/page.tsx`, `components/**` for `NEXT_PUBLIC_VOLC` → zero matches.
- `.env.example` documents both console shapes and reaffirms the server-side-only rule. No real values committed.

### AC2: Capability Probe (separate route file — fixes audit P1-1)
- `GET /api/voice/capability` is served from `app/api/voice/capability/route.ts` — its own file, its own URL. **Not** crammed into the transcribe route.
- Returns `{ available: boolean }` based purely on `hasVolcanoCredentials()`. The response contains **no** credentials or secret-derived data.

### AC3: Capability Probe Failure = `available: false` within 2s (fixes audit P1-2)
- Probe fetch failure (network error, dev-server cold-start, route 5xx, user offline, JSON parse error) **must** set `volcanoAvailable = false` (fail-safe) within a 2s budget (use `AbortController` or `Promise.race` with a 2s timeout).
- The client never attempts the Volcano path when the probe did not return `{ available: true }`.
- Guarantees zero keyless regression: no creds → Web Speech → behaviour identical to pre-TASK-018 (no flicker, no `getUserMedia` attempt, no error toast).

### AC4: Transcribe Route Hygiene
- `POST /api/voice/transcribe` accepts `multipart/form-data` with field `audio` (raw PCM bytes). Optionally accepts field `lang` (`zh-CN` | `en-US`, default `zh-CN`).
- Validates audio is non-empty; rejects bodies > 4 MB.
- Calls `transcribeWithVolcano(pcm, lang)`; on success returns `200 { text }`; on `VolcanoAsrError` returns `200 { error: <child-safe msg> }` (200 so the client distinguishes "transcribe ran, no transcript" from a network failure); on unexpected exception returns `500 { error }`.
- `export const runtime = 'nodejs'` and `export const maxDuration = 30`. 25s `AbortController` on the whole transcribe.
- The route **never** logs `VOLC_*` values; on error it may `console.error` only the `X-Tt-Logid` response header and the `VolcanoAsrError.kind` / error code (numeric) — never the secret.

### AC5: Volcano Path (when creds set and probe succeeded)
- Mic press with `available === true` and AudioWorklet supported: `voice_input_started` (once) → `getUserMedia({ audio: true })` → `AudioContext({ sampleRate: 16000 })` → `audioWorklet.addModule(...)` → connect mic → worklet. Worklet posts PCM `ArrayBuffer`s; client buffers them (input box **not** updated live — one-shot).
- On release: stop worklet, stop `AudioContext`, release mic track, assemble `Blob` from buffered PCM chunks, `POST /api/voice/transcribe`.
- On `{ text }` non-empty within 25s: `setInput(text)`, fire `voice_input_completed` (guarded by `committedRef`). No auto-submit.
- On `{ error }` / timeout / network: gentle "请再说一次"; `voice_input_completed` does **not** fire; typing usable.

### AC6: Early Synchronous Fallback to Web Speech (fixes audit P1-3)
- Strategy chosen at **press time** from cached probe → no post-release fallback problem.
- If `available === false`: `startWebSpeech()` synchronously on the same press.
- If AudioWorklet unsupported: `startWebSpeech()` synchronously.
- If `getUserMedia` denies permission: gentle message; typing usable (do **not** fall through to Web Speech — it needs the same mic).
- If Volcano transcribe returns `{ error }` after release: gentle "请再说一次"; typing usable. **Never** start Web Speech after release (would listen to silence).

### AC7: PCM Format (fixes audit P1-4 by sidestepping MediaRecorder)
- AudioWorklet outputs `pcm_s16le` at 16 kHz / 16-bit / mono. No `MediaRecorder`, no codec variance (Safari `audio/mp4` / Firefox `audio/ogg` problem does not apply).
- Float32 → Int16 conversion: `s < 0 ? s * 0x8000 : s * 0x7FFF`, clamped to `[-1, 1]`.
- If `new AudioContext({ sampleRate: 16000 })` is not honoured (actual `audioContext.sampleRate !== 16000`), the worklet downsamples from native (e.g. 48000 → 3:1 average, 44100 → rational resample). Document the chosen path in code comments + execution log.

### AC8: Cross-browser (fixes audit P2-4)
- AudioWorklet supported in Chrome 66+, Firefox 76+, Safari 14.1+. Feature-detect `audioWorklet in AudioContext.prototype` (or `'AudioWorkletNode' in window`) on press; on unsupported → Web Speech for that session.
- Older iOS (< 14.1) without AudioWorklet → Web Speech (same as today).

### AC9: HTTPS / Secure Context (fixes audit P2-3)
- App served over HTTPS in preview and production (Vercel default). `getUserMedia`, `AudioContext`, `audioWorklet`, and the `wss://` outbound from the Vercel function all require a secure context. Local dev uses `http://localhost:3001` (secure-context-eligible). Documented in `.env.example`.

### AC10: Overlap Recording Guard (fixes audit P2-2)
- `listeningRef` / `volcanoInFlightRef`: re-press while a capture or in-flight POST is active is **ignored** (no second `voice_input_started`, no second `getUserMedia`, no second POST). Alternatively, abort the in-flight POST via `AbortController` on re-press and start fresh — execute-agent picks one. Either way: no double analytics fire, no race on `setInput`, no two concurrent `AudioContext`s.
- A stale POST response arriving after a fresh press cannot write to the new session's input (session-token check or ref nulling).

### AC11: Graceful Error Handling
All of the following show a gentle UI message ("请再说一次" or equivalent child-friendly copy) and leave typing usable; none throw to the React tree:
- Permission denied (`NotAllowedError`), no microphone (`NotFoundError`), probe failure, probe `available: false`, AudioWorklet unsupported, Volcano transcribe `{ error }`, transcribe timeout, transcribe network failure, empty final transcript (`result.text` empty or `45000002`).

### AC12: Analytics Fire-Once (preserves TASK-013 pattern)
- `voice_input_started` exactly once per press, on press, regardless of strategy.
- `voice_input_completed` exactly once per **successful** press (non-empty final transcript), regardless of which path produced it.
- Session-scoped `committedRef` (reset every fresh press) prevents double-fire. A press that fails on all paths does **not** fire `voice_input_completed`.
- Payload shape matches `VoiceInputStartedPayload` / `VoiceInputCompletedPayload` (`{ speaker }`) — no schema change.

### AC13: Three-tier Fallback Preserved
- Volcano (via Vercel WS-client) → Web Speech → typing. Typing always usable (Sacred Decision #4). No new event names.

### AC14: Server-Only Enforcement (fixes audit P3-2)
- `lib/voice/volcanoAsr.ts` begins with `import 'server-only';`. A client-component import would fail at build time, not silently leak env reads.
- `app/api/voice/{transcribe,capability}/route.ts` are server routes by definition (no `'use client'`).

### AC15: Typed Error `kind` Consumed (fixes audit P3-3)
- `VolcanoAsrError` carries `kind: 'auth' | 'network' | 'timeout' | 'protocol' | 'server' | 'empty'`.
- Transcribe route consumes `kind`: `'empty'` → `{ text: '' }`; all others → `{ error: childSafeMsg }`. The discriminant is not dead code.

### AC16: TypeScript, Build, Lint
- `npm run typecheck` zero errors. `npm run build` passes. `npm run lint` passes (known Next/SWC warnings non-blocking).

### AC17: Dependency Surface
- `ws` (^8.x) added to `dependencies`; `@types/ws` to `devDependencies`. Only the `WebSocket` client class + `on` / `send` / `close` API surface used. No `@volcengine/*`.

### AC18: Manual Smoke Matrix
- **Type → submit:** unchanged.
- **Mic with creds:** press, speak softly, release; text appears in input 1–3 s later; no live partials; no auto-submit; tap 画出来 → frame generates.
- **Mic without creds:** press, speak, release; Web Speech runs; behaviour identical to pre-TASK-018.
- **Mic with creds but Volcano unreachable** (fake `VOLC_BASE_URL`): release → `{ error }` → gentle "请再说一次"; typing usable.
- **Permission denied:** block mic; press → gentle message; typing works.
- **Lang switch:** toggle zh ⇄ en; next press honours new lang on both paths.
- **Re-press while in-flight:** ignored (or cleanly aborted); no double `voice_input_started`, no garbled input.
- **Safari/Firefox without AudioWorklet:** falls back to Web Speech gracefully.
- **Network-tab inspection:** `/api/voice/capability` and `/api/voice/transcribe` responses contain **no** `VOLC_*` values.

## Test First Plan

### Phase 0: Baseline
1. `npm run typecheck` — clean.
2. `npm run build` — clean.
3. `npm run lint` — clean.
4. With no `VOLC_*` creds: mic still works via Web Speech (or unsupported message in non-Chrome).

### Phase 1: Types
5. Create `lib/voice/types.ts` (`TranscribeRequest`, `TranscribeResponse`, `CapabilityResponse`, `VoiceLang`).
6. `npm run typecheck` — pass.

### Phase 2: Binary Protocol Codec (unit-testable in isolation — the hard part)
7. Create `lib/voice/volcanoProtocol.ts` — pure functions:
   - `encodeFullClientRequest(json: object): Buffer` → `[0x11 0x10 0x11 0x00][4B BE size][gzip(JSON)]`
   - `encodeAudioFrame(pcm: Buffer, isLast: boolean): Buffer` → header byte 1 = `0x20` (more) or `0x22` (last); `[4B header][4B BE size][pcm]`
   - `decodeServerFrame(buf: Buffer): { type: 'response' | 'error'; sequence?: number; payload?: object; code?: number; message?: string }` — reads byte 1 type nibble, branches response vs error, decompresses Gzip if compression nibble set.
8. **Codec verification harness** (manual node REPL or a scratch script under `docs/tasks/artifacts/TASK-018-volcano-asr-voice/`): for a known JSON input, print the exact bytes `encodeFullClientRequest` produces and assert:
   - byte 0 = `0x11`
   - byte 1 = `0x10`
   - byte 2 = `0x11` (Gzip on) or `0x10` (off)
   - bytes 4–7 = big-endian payload size
   - bytes 8+ decompress (if Gzip) to the input JSON.
   Then assert `decodeServerFrame(encodeServerResponseMock)` recovers `result.text`. This proves the codec before any network is involved. Keep the harness output in the execution log.

### Phase 3: Server Client + Routes
9. `npm install ws@^8 @types/ws` (add to `package.json`).
10. Create `lib/voice/volcanoAsr.ts` with `import 'server-only'`, `hasVolcanoCredentials()`, `transcribeWithVolcano(pcm, lang)`, `VolcanoAsrError(kind)`. Reads `VOLC_*`; builds the right header shape; opens `ws` WebSocket; runs the send sequence; resolves `result.text`.
11. Create `app/api/voice/capability/route.ts` — `GET` → `{ available }`.
12. Create `app/api/voice/transcribe/route.ts` — `POST` multipart; `runtime = 'nodejs'`, `maxDuration = 30`; 25s `AbortController`; 4 MB limit; calls `transcribeWithVolcano`; returns `{ text }` / `{ error }`.
13. **Capability probe (curl, no key):** `curl http://localhost:3001/api/voice/capability` → `{ "available": false }`.
14. **Capability probe (fake key):** set `VOLC_API_KEY=test` in `.env.local`; restart dev server; `curl .../capability` → `{ "available": true }`. Old-console shape: set `VOLC_APP_KEY=test` + `VOLC_ACCESS_KEY=test` → `{ "available": true }`.
15. **Transcribe (hard to curl — binary PCM multipart):** tested in Phase 5 via the running app with a real recording. A 1-second silent PCM buffer can be generated server-side for a smoke test (e.g. a scratch script POSTs 32000 zero bytes labelled `audio`) → expect `{ error }` (45000002 empty audio) which proves the WS path, protocol, and error roundtrip all work end-to-end without a real mic.
16. **Key-exposure grep (fixes audit P3-4):** `rg "VOLC_API_KEY|VOLC_APP_KEY|VOLC_ACCESS_KEY|VOLC_AK|VOLC_SK" app/api/voice lib/voice` scoped to `console.*` / error-message contexts → zero matches. Only `X-Tt-Logid` and numeric error codes appear in `console.error`.

### Phase 4: AudioWorklet + Client Wiring
17. Create `lib/voice/pcmWorklet.ts` (AudioWorklet processor). Confirm compile (AudioWorklet globals live in a separate scope; `tsc` config may need `// @ts-nocheck` or lib DOM overrides — execute-agent resolves + documents).
18. Serve the worklet (static `public/pcmWorklet.js` after a tiny build step, **or** a route handler returning the source as `application/javascript`). Pick one; document.
19. Add capability probe on mount (fail-safe, 2s — AC3).
20. Rename `startVoice` / `stopVoice` internals to `startWebSpeech` / `stopWebSpeech`; keep public names as strategy-aware dispatchers.
21. Add `startVolcanoCapture` / `stopVolcanoCaptureAndTranscribe` (getUserMedia + worklet + buffer PCM; on release POST + `setInput` + `voice_input_completed`). Wire overlap guard (AC10).
22. Wire analytics: `voice_input_started` in the dispatcher; `voice_input_completed` in the shared "final transcript landed" path, guarded by `committedRef`.
23. (Conditional) extract `components/VoiceRecorder.tsx` per Open Question #1 if the inline path exceeds ~150 new lines.
24. `npm run typecheck && npm run build && npm run lint` — all pass.

### Phase 5: Full Verification
25. `npm run typecheck` — pass.
26. `npm run build` — pass.
27. `npm run lint` — pass.
28. **Manual smoke matrix** (AC18).
29. Verify `/api/voice/capability` and `/api/voice/transcribe` responses contain **no** credentials (network tab).
30. Verify `lib/voice/volcanoAsr.ts` has `import 'server-only';` at the top.
31. Verify no `NEXT_PUBLIC_VOLC_*`: `rg "NEXT_PUBLIC_VOLC" app lib components` → zero matches.

## Implementation Strategy

### Step 1: `lib/voice/types.ts`
Shared shapes imported by both client and server; no server-only code.

```ts
export type VoiceLang = 'zh-CN' | 'en-US';

export interface TranscribeRequest {
  audio: Blob;       // multipart field 'audio'
  lang?: VoiceLang;  // multipart field 'lang', default 'zh-CN'
}

export interface TranscribeSuccess { text: string; }
export interface TranscribeFailure { error: string; }
export type TranscribeResponse = TranscribeSuccess | TranscribeFailure;

export interface CapabilityResponse { available: boolean; }
```

### Step 2: `lib/voice/volcanoProtocol.ts` (isomorphic, pure)
Pure `Buffer` functions. Bit-layout constants as named hex for auditability:

```ts
const VERSION_HEADER_BYTE = 0x11; // protocol v1 | header size 1

const MSG_FULL_CLIENT_REQUEST = 0x10; // type 0b0001, flags 0b0000
const MSG_AUDIO_MORE          = 0x20; // type 0b0010, flags 0b0000
const MSG_AUDIO_LAST          = 0x22; // type 0b0010, flags 0b0010
const MSG_SERVER_RESPONSE     = 0x90; // type 0b1001, flags 0b0000 (read from wire)
const MSG_SERVER_ERROR        = 0xF0; // type 0b1111, flags 0b0000 (read from wire)

const SER_JSON_GZIP   = 0x11; // serialization JSON | compression Gzip
const SER_JSON_NONE   = 0x10; // serialization JSON | compression none
const SER_RAW_PCM     = 0x00; // no serialization | no compression

export function encodeFullClientRequest(payload: object): Buffer {
  const json = Buffer.from(JSON.stringify(payload), 'utf8');
  const gzipped = gzipSync(json);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(gzipped.length, 0);
  return Buffer.concat([
    Buffer.from([VERSION_HEADER_BYTE, MSG_FULL_CLIENT_REQUEST, SER_JSON_GZIP, 0x00]),
    size,
    gzipped,
  ]);
}

export function encodeAudioFrame(pcm: Buffer, isLast: boolean): Buffer {
  const size = Buffer.alloc(4);
  size.writeUInt32BE(pcm.length, 0);
  return Buffer.concat([
    Buffer.from([VERSION_HEADER_BYTE, isLast ? MSG_AUDIO_LAST : MSG_AUDIO_MORE, SER_RAW_PCM, 0x00]),
    size,
    pcm,
  ]);
}

export function decodeServerFrame(buf: Buffer):
  | { type: 'response'; sequence: number; payload: object }
  | { type: 'error'; code: number; message: string } {
  const msgType = buf[1] & 0xF0;
  if (msgType === 0xF0) {
    const code = buf.readUInt32BE(4);
    const msgSize = buf.readUInt32BE(8);
    const message = buf.subarray(12, 12 + msgSize).toString('utf8');
    return { type: 'error', code, message };
  }
  // response
  const sequence = buf.readInt32BE(4);
  const payloadSize = buf.readUInt32BE(8);
  const comp = buf[2] & 0x0F;
  let raw = buf.subarray(12, 12 + payloadSize);
  if (comp === 0x01) raw = gunzipSync(raw);
  return { type: 'response', sequence, payload: JSON.parse(raw.toString('utf8')) };
}
```

(Per the Execution Contingency above, if 45000151 is returned on audio frames, add a 4B BE sequence field to `encodeAudioFrame`: incrementing positive for non-last, `-1` for last. All other functions unchanged.)

### Step 3: `lib/voice/volcanoAsr.ts` (server-only)
```ts
import 'server-only';
import WebSocket from 'ws';
import { randomUUID } from 'crypto';
import { gunzipSync } from 'zlib';
import {
  encodeFullClientRequest, encodeAudioFrame, decodeServerFrame,
} from './volcanoProtocol';
import type { VoiceLang } from './types';

export class VolcanoAsrError extends Error {
  constructor(public readonly kind: 'auth'|'network'|'timeout'|'protocol'|'server'|'empty', message: string) { super(message); }
}

export function hasVolcanoCredentials(): boolean {
  const { VOLC_API_KEY, VOLC_APP_KEY, VOLC_ACCESS_KEY } = process.env;
  return Boolean(VOLC_API_KEY) || Boolean(VOLC_APP_KEY && VOLC_ACCESS_KEY);
}

function buildHeaders(): Record<string, string> {
  const requestId = randomUUID();
  const resourceId = process.env.VOLC_RESOURCE_ID || 'volc.seedasr.sauc.duration';
  if (process.env.VOLC_API_KEY) {
    return {
      'X-Api-Key': process.env.VOLC_API_KEY,
      'X-Api-Resource-Id': resourceId,
      'X-Api-Request-Id': requestId,
      'X-Api-Sequence': '-1',
    };
  }
  return {
    'X-Api-App-Key': process.env.VOLC_APP_KEY!,
    'X-Api-Access-Key': process.env.VOLC_ACCESS_KEY!,
    'X-Api-Resource-Id': resourceId,
    'X-Api-Request-Id': requestId,
    'X-Api-Sequence': '-1',
  };
}

export async function transcribeWithVolcano(pcm: Buffer, lang: VoiceLang): Promise<string> {
  // 1. build URL + headers
  // 2. new WebSocket(url, { headers: buildHeaders() })
  // 3. on 'open': send encodeFullClientRequest(payload) (payload per JSON spec)
  // 4. chunk pcm into ~3200-byte frames; send encodeAudioFrame(chunk, false) for each
  // 5. send encodeAudioFrame(remainingOrEmpty, true)
  // 6. on 'message': decodeServerFrame; if 'response' -> resolve(payload.result.text);
  //    if 'error' -> map code to VolcanoAsrError(kind) and reject (45000002 -> 'empty')
  // 7. on 'error'/'close' before response -> VolcanoAsrError('network')
  // 8. 25s overall timeout -> VolcanoAsrError('timeout') + ws.terminate()
  // NEVER log any X-Api-* request header value. On error, console.error only X-Tt-Logid + numeric code.
}
```

Model name: `process.env.VOLC_MODEL_NAME || 'bigmodel'`. `user.uid`: `'saydraw-session-' + randomUUID()`.

### Step 4: `app/api/voice/capability/route.ts`
```ts
import { NextResponse } from 'next/server';
import { hasVolcanoCredentials } from '@/lib/voice/volcanoAsr';
import type { CapabilityResponse } from '@/lib/voice/types';

export const runtime = 'nodejs';
export async function GET() {
  return NextResponse.json<CapabilityResponse>({ available: hasVolcanoCredentials() });
}
```

### Step 5: `app/api/voice/transcribe/route.ts`
Mirror TASK-010's discipline. Parse multipart via `await req.formData()`; read `audio` Blob → `Buffer.from(await blob.arrayBuffer())`; read optional `lang`. Reject empty audio and > 4 MB. `AbortController` 25s. Map `VolcanoAsrError`: `'empty'` → `{ text: '' }`; others → `{ error: childSafeMsg }`. `console.error` only `X-Tt-Logid` + `kind` + numeric code. Never the secret.

### Step 6: `lib/voice/pcmWorklet.ts` (AudioWorklet processor)
```ts
class PcmProcessor extends AudioWorkletProcessor {
  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const channel = input[0]; // mono: take channel 0
    // If context sampleRate != 16000, downsample here (ratio = sampleRate / 16000).
    const pcm = new Int16Array(channel.length);
    for (let i = 0; i < channel.length; i++) {
      const s = Math.max(-1, Math.min(1, channel[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    this.port.postMessage(pcm.buffer, [pcm.buffer]);
    return true;
  }
}
registerProcessor('pcm-processor', PcmProcessor);
```
Serve via static `public/pcmWorklet.js` (preferred) or a route handler. Execute-agent resolves and documents.

### Step 7: Client Strategy Resolver (`app/page.tsx`, or extracted `components/VoiceRecorder.tsx`)
Mic button JSX untouched. `startVoice()` becomes a dispatcher:

```ts
async function startVoice() {
  if (listeningRef.current) return;          // overlap guard (AC10)
  track(EVENTS.VOICE_INPUT_STARTED, { speaker });
  committedRef.current = false;
  setError('');
  if (volcanoAvailable && audioWorkletSupported()) {
    const started = await startVolcanoCapture(); // getUserMedia + worklet
    if (started) { setListening(true); return; }
    // getUserMedia denied -> gentle msg, typing usable (do NOT fall through to Web Speech)
  }
  startWebSpeech();                            // synchronous fallback
  setListening(true);
}
```

`stopVoice()`:
- If volcano capture active: stop worklet + AudioContext, release mic, assemble PCM Blob, POST `/api/voice/transcribe` (background; set a `volcanoInFlightRef`). On `{ text }` non-empty → `setInput(text)` + `voice_input_completed` (guarded). On `{ error }` → gentle "请再说一次".
- Else if `recRef.current` set (Web Speech): `recRef.current.stop()` (unchanged).

`volcanoAvailable` fetched once via `GET /api/voice/capability` on mount, 2s fail-safe (AC3), cached in state. Client never reads env.

### Step 8: Preserve Web Speech
Inline `SpeechRecognition` types (lines 13-57) stay. `startWebSpeech` / `stopWebSpeech` bodies are TASK-013 logic unchanged (final-only, one-shot fill, session-scoped `committed` guard). `toggleLang()` nulls `recRef` and tears down any open Volcano capture.

### Step 9: `.env.example`
```env
# Volcano Engine 大模型流式语音识别 (bigmodel_nostream) — server-side only. NEVER use NEXT_PUBLIC_*.
# New console (preferred): set VOLC_API_KEY
VOLC_API_KEY=XX
# Old console: set BOTH below instead
VOLC_APP_KEY=XX
VOLC_ACCESS_KEY=XX
# Optional overrides (defaults shown):
# VOLC_RESOURCE_ID=volc.seedasr.sauc.duration
# VOLC_BASE_URL=wss://openspeech.bytedance.com
# VOLC_ENDPOINT_PATH=/api/v3/sauc/bigmodel_nostream
# VOLC_MODEL_NAME=bigmodel
```

### Step 10: `package.json`
`dependencies`: add `"ws": "^8.18.0"`. `devDependencies`: add `"@types/ws": "^8.5.13"`. (Exact versions pinned by execute-agent at install time.)

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **`ws` incompatible with Vercel Node runtime** | Low | High | `ws` ^8 runs on Node 20 with no native deps; Vercel Node runtime supports it. Verify in execution log with a cold-start transcribe test. |
| **Vercel 30s function cap** (cold-start + Volcano latency) | Medium | Medium | `maxDuration = 30`; 25s client-side `AbortController`; capability probe on mount warms the function (audit P2-1). |
| **Binary protocol bit-packing bug** (BE/LE confusion, wrong nibble, Gzip flag) | High | High | Phase 2 codec harness asserts exact bytes before any network call; pure functions unit-testable in isolation. |
| **Audio-frame sequence-field variant** (doc layout vs gateway reality) | Medium | High | Execution Contingency above: on `45000151`, add 4B BE sequence field to `encodeAudioFrame`. |
| **`ws` handshake header injection rejected** | Low | High | `ws` accepts `headers` option on the upgrade request (documented behaviour); verify with a `45000001` (bad params) vs auth-rejection in Phase 3. |
| **PCM sample-rate mismatch** (browser AudioContext often 48 kHz) | Medium | Medium | `new AudioContext({ sampleRate: 16000 })`; if not honoured, worklet downsamples (AC7). |
| **AudioWorklet browser support** (Safari 14.1+ only) | Medium | Medium | Feature-detect on press; older iOS falls back to Web Speech (AC8). |
| **Volcano region (Beijing) reachability from Vercel region** | Medium | High | Test from the deployment region; on network failure, transcribe returns `{ error }` → gentle message (typing usable). Document reachability in execution log. |
| **Child-voice quality** (bigmodel_nostream vs bigmodel_async) | Low | Low | Doc states `bigmodel_nostream` is the most accurate; correct pick. |
| **Cost / billing** (duration vs concurrency resource id) | Low | Low | `VOLC_RESOURCE_ID` defaults to `volc.seedasr.sauc.duration` (2.0 小时版); user confirmed both duration and concurrent are activated in their console — 小时版 chosen for SayDraw's single-child occasional-use pattern (Open Question #2 resolved, see ADR-7). |
| **Empty/silent audio** (45000002) | Medium | Low | Maps to `{ text: '' }` → gentle "请再说一次"; `voice_input_completed` does not fire. |
| **Overlap recording race** (audit P2-2) | Medium | Low | `listeningRef` / `volcanoInFlightRef` guard (AC10). |
| **Post-release Volcano failure** (audit P1-3) | Medium | Low | By design: no Web Speech re-listen; gentle message + typing usable. Decision made at press time, not after release. |
| **Cross-task `.env.example` merge conflict with TASK-017** (audit P3-1) | Low | Low | Coordinator sequences the two tasks (one active at a time). No plan change. |
| **Fast-Lane degenerate fallback** (if execution runs long) | Low | Low | Ship with probe returning `available: false` (no creds in prod env) → public path stays on Web Speech; server route exists behind the flag for post-release activation. |

## Rollback

1. `git checkout -- app/page.tsx .env.example package.json package-lock.json`
2. Delete: `app/api/voice/`, `lib/voice/`, `components/VoiceRecorder.tsx` (if created), `public/pcmWorklet.js` (if served from there).
3. `npm uninstall ws @types/ws`
4. `npm run typecheck && npm run build && npm run lint` — confirm clean.

## Open Questions

The v1 plan had 6 OQs; the official doc resolves all but these 2 minor ones (OQ #2 was resolved 2026-06-20 — see below):

1. **`components/VoiceRecorder.tsx` extraction — yes or no?** Recommend **yes**: the new path (probe + capture + POST + worklet + fallback + analytics fire-once + overlap guard) is substantially larger than the current ~40 lines of Web Speech logic, and extraction gives audit-agent a clean unit. Judgement call for execute-agent: if extraction introduces more risk than it removes (e.g. many `page.tsx`-local setters needed), keep it inline and defer. Either way, public names `startVoice` / `stopVoice` stay the same.

2. **Resource id confirmation.** **RESOLVED 2026-06-20.** User confirmed they are on the 2.0 model with both `volc.seedasr.sauc.duration` (小时版 / `duration`) and `volc.seedasr.sauc.concurrent` (并发版 / `concurrent`) showing "运行中" (activated) in their console. Chose `volc.seedasr.sauc.duration` (小时版) for SayDraw's single-child occasional-use pattern. Rationale: 并发版 bills by peak concurrent sessions and is designed for high-concurrency commercial deployments that do not apply here; 小时版 bills per audio second which matches SayDraw's actual usage (one child pressing occasionally). The default value across this plan (`VOLC_RESOURCE_ID`, auth header comments, `.env.example`, AC1, the code default in `volcanoAsr.ts`, and the Risks row) now reads `volc.seedasr.sauc.duration`. Both variants remain activated on the user's account, so switching to `volc.seedasr.sauc.concurrent` later is a single env change with no re-activation. For reference, the full variant matrix is: `volc.bigasr.sauc.duration` (1.0 小时版), `volc.bigasr.sauc.concurrent` (1.0 并发版), `volc.seedasr.sauc.duration` (2.0 小时版 — **chosen**), `volc.seedasr.sauc.concurrent` (2.0 并发版). Decision rationale captured in ADR-7.

3. **Auth shape confirmation.** User must specify old console (`VOLC_APP_KEY` + `VOLC_ACCESS_KEY`) or new console (`VOLC_API_KEY`). Plan supports both at runtime; this is just for `.env.example` defaults and the execution smoke test.

**All prior OQs resolved by the doc:** no more streaming-vs-one-shot, no token-mint question, no product-variant question, no sample-code question, no audio-format question, no VAD question (VAD stays a Non-goal).

## Approval

Plan authored by plan-agent on 2026-06-20 (v3.1: + ADR section, resource id resolved). Approval and execution lifecycle are tracked in `docs/tasks/active_spec.md` and `docs/tasks/progress.md`.
