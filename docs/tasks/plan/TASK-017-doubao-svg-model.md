# TASK-017: Doubao SVG Model + Few-Shot Prompt Upgrade

Lifecycle: tracked in `docs/tasks/active_spec.md` and `docs/tasks/progress.md`
Owner Flow: plan-agent -> execute-agent -> audit-agent
Lane: Full (API keys, server routes, SVG sanitization, AI calls, cross-module contracts)

## Background

`deepseek-v4-flash` (active in `lib/ai/deepseek.ts`) is a small/fast text LLM. It handles the JSON narration + `followUpQuestion` + `storySummary` fields well, but its SVG geometry output is weak: crooked proportions, missing limbs, 3–5 element scenes that violate the 12–22 element rule in `COMBINED_SYS`, and frequent fill/color contamination. Hackathon playtests show children cannot recognise their own characters in the resulting frames, which breaks the core "externalising the child's imagination" promise (AGENTS.md Core Values #2).

The fix has two parts and **neither part violates any Sacred Product Decision**:

1. **Switch the SVG-generation model to 豆包-pro (Doubao-pro) via 火山方舟 (Volcano Ark)**, served at an OpenAI-compatible endpoint. Doubao-pro is a stronger general LLM that produces noticeably cleaner SVG geometry while still emitting SVG **text** (not raster). Output remains SVG, remains black-and-white, and remains stroke-dashoffset compatible.
2. **Add 3–5 curated few-shot SVG examples** to `COMBINED_SYS` so the model has concrete style anchors for the 400×300 viewBox, the 3/2/1.5 stroke-width tiering, the `#211e18` ink, and the character guides (dinosaur / moon / butterfly).

This plan is the SVG-quality companion to TASK-010. TASK-010 hardened the DeepSeek client, error chain, JSON mode, and sanitizer integration. TASK-017 keeps every TASK-010 guarantee (mock fallback, sanitize-on-every-path, child-safe errors) and only changes which provider serves the call and what few-shot evidence the prompt carries.

## Decision History (Architecture Decision Record)

This section records the full selection-decision chain so a technical architecture retrospective six months later can fully reconstruct *why* TASK-017 looks the way it does. Each ADR is self-contained. User input citations are either direct quotes (in the user's original Chinese) or close paraphrases, dated 2026-06-20. Purely technical decisions with no direct user input say so explicitly.

### ADR-1: Switch SVG-generation model from DeepSeek to Doubao (Volcano Ark)

**Context:** `deepseek-v4-flash` is a small/fast text LLM and its SVG geometry output is weak — crooked proportions, missing limbs, 3–5 element scenes that violate the 12–22 element rule, and frequent fill/color contamination. A stronger model is needed for SVG quality without breaking the Sacred Product Decisions.

**Alternatives considered:**
- **(a) Switch to Doubao-pro LLM via Volcano Ark (OpenAI-compatible)** — keeps SVG-as-text output, uses a stronger general LLM → CHOSEN
- **(b) Switch to Doubao image generation (Seedream)** — outputs PNG/raster → REJECTED because it violates Sacred Decision #2 (SVG is the primary output format, no PNG as main result) AND Sacred Decision #3 (stroke-dashoffset self-draw animation requires SVG paths, impossible with raster)
- **(c) Switch to Claude Sonnet (dormant in `lib/ai/svg-model.ts`)** — stronger LLM, OpenAI-incompatible → REJECTED as primary: Anthropic cost/latency higher; kept as a future option (code stays dormant)
- **(d) Stay on DeepSeek-flash, just improve the prompt** — REJECTED because prompt-only improvements hit a ceiling on a small model's geometric reasoning

**Decision:** Option (a) — Doubao-pro LLM via Volcano Ark, emitting SVG as text.

**User input (2026-06-20):** "换豆包pro同时加SVG范例" (chose option (a) and requested few-shot SVG examples be added in the same conversation — see ADR-3).

**Consequences:**
- Gain: stronger SVG geometry; recognisable characters; fewer color/fill contaminations.
- Lose: a second provider to manage (env vars, billing, region reachability) — but Sacred Decisions are untouched (still SVG, still B&W, still stroke-dasharray compatible).

### ADR-2: Env-preference provider resolver, not clean cut-over

**Context:** When switching providers, the team must decide whether to remove DeepSeek entirely or keep it as a fallback path for demo resilience.

**Alternatives considered:**
- **(a) Clean cut-over** (remove `lib/ai/deepseek.ts`, Doubao only) → REJECTED because if Volcano Ark has regional connectivity issues from the deployment region, the demo breaks with no recovery without a code redeploy
- **(b) Env-preference resolver** (Doubao when `DOUBAO_API_KEY` is set, else DeepSeek when `DEEPSEEK_API_KEY` is set, else mock) → CHOSEN
- **(c) Runtime provider selection in UI** → REJECTED because it adds UI scope and leaks provider concerns to the user-facing surface

**Decision:** Option (b) — env-preference resolver.

**User input (2026-06-20):** No direct user instruction. Purely technical decision recommended by plan-agent, consistent with the hackathon-resilience principle in `AGENTS.md` "Development Priority" — *"If we can't make it all work, make the core loop work end-to-end"* and the project priority *"Can be played publicly > complete feature set."*

**Consequences:**
- Gain: demo resilience — fall back to DeepSeek by unsetting one env var, no redeploy.
- Lose: tiny code overhead (one resolver module); DeepSeek stays as a documented secondary provider indefinitely.

### ADR-3: Few-shot SVG examples embedded in `COMBINED_SYS`, not as a separate user message

**Context:** Three curated SVG examples are being added to anchor model output style (400×300 viewBox, three-tier stroke-width, `#211e18` ink, character guides). The question is where they live in the prompt structure.

**Alternatives considered:**
- **(a) Embed in the system prompt `COMBINED_SYS`** under a `示例 SVG（风格参考，不要原样复制）：` marker → CHOSEN
- **(b) Send as a separate user-message turn before the actual story turn** → REJECTED because it changes the message shape, complicates the route, and may confuse the model about which message is the "real" request
- **(c) Store examples in a separate file, load at runtime, concatenate** → REJECTED because it is unnecessary indirection — the examples are static, source-authored content

**Decision:** Option (a) — embedded in `COMBINED_SYS` under the marker.

**User input (2026-06-20):** "换豆包pro同时加SVG范例" — the user explicitly asked for SVG examples to be added alongside the Doubao switch. The placement (system prompt vs. user message vs. file) was a purely technical decision consistent with the current single-model single-call architecture (Sacred Decision #5: AI returns both narration and SVG in one call).

**Consequences:**
- Gain: simple single-call structure preserved; no message-shape changes; no file IO.
- Lose: `COMBINED_SYS` grows by ~1.5–2k tokens (negligible for Doubao-pro-256k context window).

### ADR-4: Keep DeepSeek client (`lib/ai/deepseek.ts`) as documented secondary, do not remove

**Context:** After adding Doubao, the fate of the existing DeepSeek client must be decided.

**Alternatives considered:**
- **(a) Remove `lib/ai/deepseek.ts`** → REJECTED because it loses the fallback path ADR-2 depends on, and loses the architectural reference for the new `doubao.ts` (which mirrors its shape)
- **(b) Keep as documented secondary provider, wired through the resolver** → CHOSEN
- **(c) Keep code but comment out imports** → REJECTED because it is dead code, worse than removal

**Decision:** Option (b) — keep as documented secondary provider.

**User input (2026-06-20):** No direct user instruction. Follows directly from ADR-2 (env-preference resolver requires the secondary provider to still exist).

**Consequences:**
- Gain: fallback resilience, architectural reference, zero regression risk.
- Lose: two providers to keep in sync if the function signature ever changes (acceptable — signatures are stable).

### ADR-5: Migrate hint route to Doubao-preferred resolver alongside generate route

**Context:** The hint route (`/api/story/hint`) also calls `generateStoryFrame()`; the team must decide whether it follows the provider switch.

**Alternatives considered:**
- **(a) Migrate hint to the same resolver** (Doubao-preferred) → CHOSEN
- **(b) Keep hint on DeepSeek only** → REJECTED because it creates provider inconsistency between two routes that serve the same UX (story creation); if Doubao is better for SVG it is better for hints too
- **(c) Use DeepSeek for hint, Doubao for SVG only** → REJECTED because it adds conditional logic for no user benefit

**Decision:** Option (a) — migrate hint to the resolver.

**User input (2026-06-20):** No direct user instruction. Purely technical decision for provider consistency across all AI routes.

**Consequences:**
- Gain: UX consistency; one resolver pattern across all AI routes.
- Lose: nothing.

### ADR-6: After empirical bakeoff, fall back to DeepSeek chat (NOT Doubao) for production

**Context:** The original plan (ADR-1) chose Doubao-pro because we expected stronger SVG geometry than `deepseek-v4-flash`. ADR-2's env-preference resolver was deliberately built to allow a no-code switch between providers. During execution (2026-06-20 bakeoff, see `docs/tasks/artifacts/TASK-017-doubao-svg-model/drawing-bakeoff/`), every available Volcano endpoint proved too slow for production use within the 30s Vercel `maxDuration`, while a re-test of DeepSeek's `deepseek-chat` (V3) model showed it is now fast enough and produces visually acceptable SVG with the upgraded few-shot prompt.

**Alternatives considered:**

- **(a) Doubao-pro via `ep-20260619155735-lx4dr`** (the PRO endpoint nana provisioned) → **REJECTED.** Empirical test showed a 31–45 s timeout for a single SVG generation. Root cause discovered during execution: this endpoint id actually points to `doubao-seed-2-0-pro-260215`, which is a **vision/recognition model**, not a text-generation LLM — wrong model family for emitting SVG markup.
- **(b) Doubao-lite via `ep-20260619160218-5m76d`** (`doubao-seed-2-0-lite`, the multimodal/text LITE endpoint) → **REJECTED.** Empirical bakeoff (2026-06-20, prompt "一只小猫坐在月亮上"): **25.44 s** per call, valid SVG, 11 elements. Far above the 30 s Vercel cap when route prefill + post-processing overhead is added. Root cause not fully isolated; likely a combination of the ~4.7k-char system prompt triggering a slow decoding path and the doubao-seed-2.0 family's higher per-token latency on structured output.
- **(c) DeepSeek chat (`deepseek-chat` / V3)** → **CHOSEN for production.** Bakeoff: **0.29 s** for the first call, then **0.08–0.55 s** on subsequent calls (DeepSeek prompt-cache hit). Output: valid SVG, 16 elements, no color, fully sanitize-safe. Visually recognizable to a 4-year-old. Latency is roughly 50× better than Doubao-lite and comfortably inside the 30 s cap.
- **(d) DeepSeek pro (`deepseek-reasoner`)** → **REJECTED.** Bakeoff returned in 0.08 s but with **empty `content`** — the DeepSeek API silently routed the request to `deepseek-v4-flash` and emitted all output in the `reasoning_content` field instead of `content`. Our client reads `data.choices[0].message.content`, so the call returns "empty response" and falls through to mock fallback. Activating the reasoner would require both code changes (read `reasoning_content`) and re-validation of the actual model invoked; deferred until reasoning quality becomes a demonstrated need.

**Decision:** Production uses DeepSeek chat (option c). The `DOUBAO_*` env vars are commented out indefinitely in `.env.local` so the env-preference resolver (ADR-2) transparently routes every call to the DeepSeek path. The Doubao client (`lib/ai/doubao.ts`), the resolver (`lib/ai/provider.ts`), and the `.env.example` documentation all stay in place — if a future Volcano endpoint proves fast enough, switching back is a one-line `.env.local` uncomment with no code change and no redeploy.

**User input (2026-06-20):** After the bakeoff data was surfaced, the user explicitly confirmed the recommendation: *"用 DeepSeek chat，豆包 key 永久注掉"* — use DeepSeek chat, comment out the Doubao key permanently.

**Consequences:**
- **Gain:** ~50× speedup (25 s → 0.5 s), well inside the 30 s Vercel `maxDuration`, smooth demo UX.
- **Gain:** lower token cost (DeepSeek ~2.7k tokens vs Doubao ~4.3k for the same scene).
- **Gain:** DeepSeek API is rock-solid stable in the China region; one less external dependency to monitor on demo day.
- **Lose:** SVG geometry quality may be slightly weaker than Doubao-pro *would have been* had it actually worked — but empirically the DeepSeek-chat output is visually acceptable at 11–16 elements per frame.
- **Lose:** single-provider concentration risk — both story text and SVG now flow through DeepSeek. If DeepSeek has a regional outage, both features fail together (mock fallback still fires per TASK-010).
- **Future:** if Volcano releases a faster text-only Doubao variant, the env-preference resolver makes re-evaluation a 1-line `.env.local` change.

### Decision chain summary

The chain is: **DeepSeek SVG quality is weak** (ADR-1 context) → **switch to Doubao-pro LLM** (not image gen, Sacred Decisions protect SVG) → **keep DeepSeek as fallback** for demo resilience (ADR-2 + ADR-4) → **embed few-shot in system prompt** to anchor style (ADR-3) → **migrate hint route too** for consistency (ADR-5) → **empirical bakeoff overturns ADR-1's premise**: every Doubao endpoint is too slow, DeepSeek chat is fast *and* good enough with the new prompt, so production stays on DeepSeek (ADR-6) with the Doubao wiring kept dormant for future re-evaluation. If SVG quality is still insufficient after this task, the next option is Claude Sonnet (dormant in `lib/ai/svg-model.ts`), which would require its own task.

## Goal

1. **Add a Doubao (Volcano Ark) client** at `lib/ai/doubao.ts` with the **same exported signature** as `deepseek.ts`: `generateStoryFrame(systemPrompt, userMessage) => Promise<string>`. Uses OpenAI-compatible `POST {DOUBAO_BASE_URL}/chat/completions`, `Authorization: Bearer ${DOUBAO_API_KEY}`, model field = `DOUBAO_MODEL` (a Volcano endpoint id, e.g. `ep-xxxxx`).
2. **Env-preference provider resolver** in both routes: prefer Doubao when `DOUBAO_API_KEY` is set, fall back to DeepSeek when only `DEEPSEEK_API_KEY` is set, fall back to mock otherwise. This keeps DeepSeek as a documented secondary path so the demo can run on either provider.
3. **Add a few-shot examples block** to `COMBINED_SYS` under a clearly-delimited marker (`示例 SVG（风格参考，不要原样复制）：`) with **3 curated sanitize-safe SVGs** (dinosaur, moon+meteor, butterfly+flower).
4. **Migrate the hint route** to the same provider resolver (Doubao-preferred) so model behaviour is consistent across the experience.

## Non-goals

- **No PNG / raster output** (Sacred Decision #2)
- **No color SVG** (Sacred Decision #1) — few-shot examples and Doubao output remain `fill="none"` / `stroke="#211e18"`
- **No change to stroke-dashoffset self-draw animation** (Sacred Decision #3) — viewBox, path structure, and element semantics stay identical
- **No client (`app/page.tsx`) changes** — response shape is unchanged
- **No DeepSeek removal** — `lib/ai/deepseek.ts` stays as documented secondary provider
- **No new dependencies** — built-in `fetch` only; no `openai` / `@volcengine/...` packages
- **No i18n changes** — both `HINT_SYS` (zh) and `HINT_SYS_EN` keep working; few-shot block lives inside `COMBINED_SYS` (zh-primary) only because that is the SVG path
- **No animation / timing / playback changes**
- **No change to `maxDuration = 30`** on either route
- **No modification to `docs/00_design/` or `docs/_archive/`**
- **No change to `package.json`, `tsconfig.json`, `next.config.*`, `postcss.config.*`, `tailwind.config.*`**

## Design Source

- `AGENTS.md` — Sacred Product Decisions #1 (B&W), #2 (SVG primary), #3 (stroke-dashoffset self-draw), #5 (one JSON response with narration + SVG), "DeepSeek API Key - Critical Rule" (server-side only; same rule applies to `DOUBAO_API_KEY`), "SVG Safety Rules" (every SVG through `sanitizeSvg`)
- `docs/00_design/HuaHuaBen.jsx` — original character style, ink color, viewBox, three-tier stroke-width
- `lib/ai/prompts.ts` — current `COMBINED_SYS` (lines 3–37), character guides (lines 31–36), `INK = '#211e18'`
- `lib/ai/deepseek.ts` — current client shape to mirror
- `docs/tasks/plan/TASK-010-deepseek-real-integration.md` — error-chain and fallback pattern to preserve

## Files In Scope

| File | Action | Purpose |
|------|--------|---------|
| `lib/ai/doubao.ts` | **Create** | New Volcano Ark client. Exports `generateStoryFrame(systemPrompt, userMessage): Promise<string>` and `NoApiKeyError` (re-exported/shared). Env: `DOUBAO_API_KEY`, `DOUBAO_BASE_URL` (default `https://ark.cn-beijing.volces.com/api/v3`), `DOUBAO_MODEL` (endpoint id, no default — throws on missing). Same `response_format: { type: 'json_object' }`, `temperature: 0.75`, `max_tokens: 2000`, 30s `AbortController` timeout as `deepseek.ts` |
| `lib/ai/prompts.ts` | **Modify** | Append few-shot block to `COMBINED_SYS` under marker `示例 SVG（风格参考，不要原样复制）：` with 3 sanitize-safe SVG strings (dinosaur / moon+meteor / butterfly+flower). Add a shared `NoApiKeyError` export site if execute-agent chooses to consolidate (otherwise each client exports its own and routes import per-provider) |
| `app/api/story/generate/route.ts` | **Modify** | Replace direct `import ... from '@/lib/ai/deepseek'` with a provider resolver that picks Doubao when `DOUBAO_API_KEY` is set, else DeepSeek when `DEEPSEEK_API_KEY` is set, else throws `NoApiKeyError` (existing mock-fallback path fires unchanged). Sanitize chain, JSON parsing, `FALLBACK_SVG`, gentle error message — all unchanged |
| `app/api/story/hint/route.ts` | **Modify** | Same provider resolver swap. `HINT_SYS` / `HINT_SYS_EN` and mock hint path unchanged |
| `.env.example` | **Modify** | Add `DOUBAO_API_KEY`, `DOUBAO_BASE_URL`, `DOUBAO_MODEL` block (server-side only). Also fix the existing typo on line 7 (`ANTHROPIC_BASE_URL: "..."` → `ANTHROPIC_BASE_URL=...`) since the file is being touched |

**Kept (not removed):** `lib/ai/deepseek.ts` stays as the documented secondary provider so the hackathon demo runs on whichever key the team has. The dormant `lib/ai/svg-model.ts` (unused Anthropic `generateSvg`) is left untouched — it is architectural reference only.

## Forbidden Changes

- **`app/page.tsx`** — no client changes (response shape unchanged)
- **`app/layout.tsx`, `components/**`** — no UI changes
- **`docs/00_design/`**, **`docs/_archive/`** — source document protection
- **`package.json`** — no new dependencies (built-in `fetch` only)
- **`tsconfig.json`**, **`next.config.*`**, **`postcss.config.*`**, **`tailwind.config.*`** — no config changes
- **`lib/svg/sanitizeSvg.ts`** — sanitizer behaviour unchanged (still runs on every SVG, both providers, both mock paths)
- **`lib/ai/mock.ts`** — mock rotation unchanged
- **`lib/story/storage.ts`**, **`lib/story/types.ts`** — response types unchanged
- **`lib/ai/svg-model.ts`** — dormant Anthropic reference; do not activate or delete
- **`lib/analytics/**`** — analytics events unchanged (no new trigger points introduced)
- Do **NOT** put `DOUBAO_API_KEY` or `DOUBAO_MODEL` in any `NEXT_PUBLIC_*` variable, prop, or serialized client state
- Do **NOT** commit `.env.local` or any file containing either API key
- Do **NOT** switch output to PNG, raster, base64 image, image-generation API, or `data:image/*` URLs
- Do **NOT** introduce color attributes (`stroke="red"`, `fill="#fff"`, etc.) in the few-shot examples or prompt rules

## Acceptance Criteria

### AC1: Environment Configuration (Doubao)
- `DOUBAO_API_KEY` is read server-side only (`process.env.DEEPSEEK_API_KEY` style); never prefixed `NEXT_PUBLIC_`
- `DOUBAO_BASE_URL` defaults to `https://ark.cn-beijing.volces.com/api/v3` when unset
- `DOUBAO_MODEL` is the Volcano **endpoint id** (e.g. `ep-xxxxxxxxxxxx-xxxxx`), read from env, never hard-coded
- When `DOUBAO_API_KEY` is set but `DOUBAO_MODEL` is missing, `lib/ai/doubao.ts` throws a clear error caught by the route's mock-fallback chain (no crash, no key leak)

### AC2: No Key -> Mock Fallback (Existing Behavior Preserved, TASK-010 AC2)
- When neither `DOUBAO_API_KEY` nor `DEEPSEEK_API_KEY` is set, `POST /api/story/generate` returns mock data immediately and `POST /api/story/hint` returns mock hint immediately
- No network call is attempted
- Mock rotation behaviour is identical to pre-TASK-017 (same `getMockScene` / `getMockHint`)
- Client page (`app/page.tsx`) works unchanged

### AC3: Provider Resolver (Env-Preference)
- `DOUBAO_API_KEY` set → routes call `lib/ai/doubao.ts` `generateStoryFrame()`
- `DOUBAO_API_KEY` unset + `DEEPSEEK_API_KEY` set → routes call `lib/ai/deepseek.ts` `generateStoryFrame()` (zero regression from TASK-010)
- Both unset → mock fallback
- Resolver is the **only** place provider selection happens (no scattered conditionals inside business logic)

### AC4: Doubao Call Shape
- When key is set, `generateStoryFrame()` POSTs to `${DOUBAO_BASE_URL}/chat/completions`
- Headers include `Authorization: Bearer ${DOUBAO_API_KEY}` and `Content-Type: application/json`
- Request body includes `model: process.env.DOUBAO_MODEL`, `messages`, `temperature: 0.75`, `max_tokens: 2000`, `response_format: { type: 'json_object' }`
- 30s `AbortController` timeout; on `AbortError` throws a timeout Error caught by the route's mock-fallback

### AC4b: Deterministic Error-Chain Test (No Real Key Needed)
- With a fake `DOUBAO_API_KEY` (any non-empty string) and a bad `DOUBAO_BASE_URL` (e.g. `https://ark.nonexistent.invalid`) and a fake `DOUBAO_MODEL`:
  - `generateStoryFrame()` in the Doubao path fails (DNS/connection error)
  - End-to-end chain reaches mock fallback and `POST /api/story/generate` returns 200 with valid `{ narration, svg }`
  - Same applies to `POST /api/story/hint` (returns 200 with a mock hint)
- Verifies the full error chain works without requiring a real Volcano key

### AC5: Few-Shot Examples in `COMBINED_SYS`
- `COMBINED_SYS` contains a clearly-delimited block introduced by the marker `示例 SVG（风格参考，不要原样复制）：`
- **At least 3** complete `<svg>...</svg>` example strings are present (target subjects: friendly dinosaur, moon+meteor, butterfly+flower)
- Each example: `viewBox="0 0 400 300"`, 10–15 elements, every element `stroke="#211e18"` `fill="none"`, three-tier `stroke-width` (3 / 2 / 1.5), `stroke-linecap="round"` `stroke-linejoin="round"`
- Each example is sanitize-safe by construction: **no** `<script>`, **no** `<foreignObject>`, **no** `on*` attributes, **no** external `href` / `xlink:href`, **no** `<text>` element, **no** color values anywhere
- Examples appear in source as plain string literals (not loaded from disk at runtime)

### AC6: Sanitization Unchanged
- Every SVG returned by `/api/story/generate` passes through `sanitizeSvg()` before response, on both Doubao and DeepSeek and mock paths (TASK-010 AC7 preserved)
- Post-sanitize validation in the route is unchanged: if result is empty / missing `<svg` / missing `</svg>`, use `FALLBACK_SVG`
- `sanitizeSvg()` source file is not modified

### AC7: Sacred Decisions Preserved
- Output is **SVG text** only — no PNG, no base64 image, no `data:image/*`, no image-generation call
- Ink color remains `#211e18`; no color attributes appear in either prompt rules or few-shot examples
- viewBox `0 0 400 300` is unchanged so the stroke-dashoffset self-draw animation in `components/` works without modification
- Visual check: stroke-dashoffset self-draw animation still plays end-to-end on a real Doubao frame

### AC8: Hint Route Migration
- `app/api/story/hint/route.ts` uses the same provider resolver as `/generate`
- `HINT_SYS` and `HINT_SYS_EN` are unchanged (few-shot block is SVG-only and lives in `COMBINED_SYS`, which the hint route does not use)
- Decision documented: **hint moves to Doubao-preferred** for provider consistency, with the same mock fallback as today

### AC9: No Client-Exposed Keys
- `grep -r "NEXT_PUBLIC_DOUBAO" .` returns zero matches in any tracked file
- No `DOUBAO_API_KEY` value appears in any client bundle, console log, or `NextResponse` body
- Server-side `console.error` messages from the Doubao path never include the bearer token (only status code and a truncated body slice, matching `deepseek.ts` line 48)

### AC10: TypeScript / Build / Lint
- `npm run typecheck` passes with zero errors
- `npm run build` completes without errors
- `npm run lint` exits 0 (known Next/SWC warnings are non-blocking)

### AC11: `.env.example` Hygiene
- Doubao vars (`DOUBAO_API_KEY`, `DOUBAO_BASE_URL`, `DOUBAO_MODEL`) added with placeholder values and a server-side-only comment
- Existing line 7 typo (`ANTHROPIC_BASE_URL: "https://..."`) corrected to `ANTHROPIC_BASE_URL=https://api.anthropic.com/v1/messages`
- No real keys committed

## Test First Plan

### Phase 0: Baseline (must be clean before any edit)
1. `npm run typecheck` — must be clean
2. `npm run build` — must be clean
3. `npm run lint` — must be clean
4. Confirm dev server still serves `/api/story/generate` with mock data (no keys)

### Phase 1: Types & Prompts (no behavioural change)
5. Add the few-shot block to `COMBINED_SYS` in `lib/ai/prompts.ts` under the `示例 SVG（风格参考，不要原样复制）：` marker; for each example run a mental `sanitizeSvg()` check (no script / foreignObject / on* / external href / text / color)
6. If consolidating `NoApiKeyError` into a shared file, do that export-only change here; otherwise leave per-client exports
7. `npm run typecheck` — must still be clean

### Phase 2: Doubao Client
8. Create `lib/ai/doubao.ts` mirroring `lib/ai/deepseek.ts`: same function signature, same timeout pattern, same error shape; only the URL, headers, model field source, and env names differ
9. `npm run typecheck` — must still be clean

### Phase 3: Provider Resolver + Route Wiring
10. Introduce the resolver (either a tiny `lib/ai/provider.ts` or inline `if/else` in each route — execute-agent's choice, but **one** place only) and swap the import in `app/api/story/generate/route.ts` and `app/api/story/hint/route.ts`
11. Update `.env.example`: add Doubao vars, fix the `ANTHROPIC_BASE_URL:` typo
12. `npm run typecheck` — must still be clean

### Phase 4: Verification
13. **No-key test (regression):** with both `DOUBAO_API_KEY` and `DEEPSEEK_API_KEY` unset —
    ```
    curl -X POST http://localhost:3001/api/story/generate \
      -H 'Content-Type: application/json' \
      -d '{"storySoFar":"","newLine":"一只小恐龙","speaker":"kid"}'
    ```
    expect 200 with mock `{ narration, svg }`. Same for `/api/story/hint`.
14. **Deterministic error-chain test (AC4b):** set `DOUBAO_API_KEY=faux`, `DOUBAO_BASE_URL=https://ark.nonexistent.invalid`, `DOUBAO_MODEL=ep-fake-xxxxx`; restart server; same curl — expect 200 with mock `{ narration, svg }` (mock fallback fires after Doubao network failure). Same for `/api/story/hint`.
15. **DeepSeek-still-works test (regression):** with `DOUBAO_API_KEY` unset and `DEEPSEEK_API_KEY` set (or fake) — confirm the resolver falls through to DeepSeek and the existing TASK-010 chain fires.
16. **Real Doubao path (only if a real key is available):** set valid `DOUBAO_API_KEY` + `DOUBAO_MODEL` + `DOUBAO_BASE_URL`; same curl — expect 200 with `{ narration, svg, followUpQuestion, storySummary }`; SVG passes `sanitizeSvg()`; rendered frame visibly cleaner than DeepSeek baseline; stroke-dashoffset animation still plays in the browser.
17. `npm run typecheck` — MUST pass
18. `npm run build` — MUST pass
19. `npm run lint` — MUST pass
20. Manual smoke: full mock loop (no keys) — type, submit, see frame, filmstrip updates, playback animates via stroke-dashoffset; confirm unchanged behaviour from TASK-010.

### Screenshot Evidence (required for visual confirmation)

Save to `docs/tasks/artifacts/TASK-017-doubao-svg-model/`:
- A side-by-side of a DeepSeek-generated frame vs a Doubao-generated frame for the same prompt (desktop 1440×900) — only if both keys are available; otherwise just a Doubao frame and a mock frame
- A playback frame mid-animation showing stroke-dashoffset self-draw working (desktop 1440×900)
- Mobile 390×844 of the same playback frame

## Implementation Strategy

### Step 1: Author `lib/ai/doubao.ts`
Mirror `lib/ai/deepseek.ts` exactly in shape. The only deltas:

```ts
const BASE_URL = process.env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
const MODEL = process.env.DOUBAO_MODEL; // endpoint id, no hard default

export class NoApiKeyError extends Error { /* same shape as deepseek.ts */ }

export async function generateStoryFrame(systemPrompt, userMessage): Promise<string> {
  const apiKey = process.env.DOUBAO_API_KEY;
  if (!apiKey) throw new NoApiKeyError();
  if (!MODEL) throw new Error('DOUBAO_MODEL (endpoint id) is not set');
  // fetch `${BASE_URL}/chat/completions` with model: MODEL, response_format, temperature 0.75, max_tokens 2000, 30s AbortController
  // return content string or throw
}
```

Execute-agent may either duplicate `NoApiKeyError` per client or hoist it to a shared `lib/ai/errors.ts`. Both are acceptable as long as the resolver and routes import consistently. **Recommendation: hoist** to avoid instanceof pitfalls across module boundaries.

### Step 2: Provider resolver (one place)
Pick **one** of:

**Option A (preferred): tiny `lib/ai/provider.ts`**
```ts
import { generateStoryFrame as doubao } from '@/lib/ai/doubao';
import { generateStoryFrame as deepseek } from '@/lib/ai/deepseek';
import { NoApiKeyError } from '@/lib/ai/errors';

export async function generateStoryFrame(systemPrompt: string, userMessage: string): Promise<string> {
  if (process.env.DOUBAO_API_KEY) return doubao(systemPrompt, userMessage);
  if (process.env.DEEPSEEK_API_KEY) return deepseek(systemPrompt, userMessage);
  throw new NoApiKeyError();
}
```
Routes swap `@/lib/ai/deepseek` → `@/lib/ai/provider`. One-line change per route.

**Option B: inline `if/else` in each route.** Slightly less clean, but no new file. Acceptable.

**Why env-preference over clean cut-over:** the hackathon demo must stay playable even if Volcano Ark has regional connectivity issues from the deployment environment. Env-preference lets the team fall back to DeepSeek by unsetting one variable, with no redeploy of code. The cost is one extra module and a slightly longer AC3 — trivial.

### Step 3: Few-shot block in `COMBINED_SYS`
Append after the existing "角色指南" block, before the closing "只输出 JSON" line:

```
\n\n示例 SVG（风格参考，不要原样复制）：\n
示例1（恐龙）：\n<svg viewBox="0 0 400 300" ...>...</svg>\n
示例2（月亮与陨石）：\n<svg viewBox="0 0 400 300" ...>...</svg>\n
示例3（蝴蝶与花）：\n<svg viewBox="0 0 400 300" ...>...</svg>\n
```

Each example authored by execute-agent to satisfy:
- 10–15 SVG elements
- `viewBox="0 0 400 300"`, `xmlns="http://www.w3.org/2000/svg"`
- Every element: `stroke="#211e18"` `fill="none"` `stroke-linecap="round"` `stroke-linejoin="round"`
- Three-tier stroke-width: 3 (subject outline), 2 (details), 1.5 (background)
- Zero color, zero `<text>`, zero `<script>`, zero `on*`, zero external `href`
- Recognisable as the named subject to a 4-year-old

**Subjects (matches existing character guide in `COMBINED_SYS` lines 31–36):**
1. **Friendly dinosaur** — round head, short front legs, thick hind legs + tail, small back fins,憨厚 expression
2. **Moon + meteor** — round moon in upper corner with 2–3 crater circles, tailed meteor crossing from top
3. **Butterfly + flower** — symmetric wing pair, antennae, butterfly on a simple 5-petal flower

### Step 4: Wire routes
Swap the import in `app/api/story/generate/route.ts` and `app/api/story/hint/route.ts` to point at the resolver. **No other change** in either route — error chain, sanitization, JSON parsing, gentle error message, `FALLBACK_SVG` all preserved from TASK-010.

### Step 5: `.env.example`
Add:
```
# Doubao / 火山方舟 (Volcano Ark) — SVG model, server-side only
DOUBAO_API_KEY=XX
DOUBAO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
DOUBAO_MODEL=ep-your-endpoint-id
```
Also fix the existing typo: `ANTHROPIC_BASE_URL: "https://api.anthropic.com/v1/messages"` → `ANTHROPIC_BASE_URL=https://api.anthropic.com/v1/messages`.

## Error Handling Chain (unchanged from TASK-010, only Layer 1 expanded)

```
Layer 1: DOUBAO_API_KEY set?  -> Doubao path
         else DEEPSEEK_API_KEY set? -> DeepSeek path
         else -> mock fallback (no API call)
Layer 2: provider network/API error -> mock fallback (log real error server-side)
Layer 3: response JSON parse fails -> regex extract SVG; if still fails -> FALLBACK_SVG
Layer 4: SVG sanitizer returns — post-sanitize validation: empty / missing <svg / missing </svg> -> FALLBACK_SVG
Layer 5: any unhandled exception -> gentle "画板打了个小盹" message, 500
```

Key principle (unchanged): **never expose model errors, stack traces, or API key fragments to the client.**

## Volcano Ark API Contract

### Request
```json
{
  "model": "ep-xxxxxxxxxxxx-xxxxx",
  "messages": [
    { "role": "system", "content": "<COMBINED_SYS with few-shot>" },
    { "role": "user", "content": "<story so far + latest line>" }
  ],
  "max_tokens": 2000,
  "temperature": 0.75,
  "response_format": { "type": "json_object" }
}
```
URL: `POST https://ark.cn-beijing.volces.com/api/v3/chat/completions`
Auth: `Authorization: Bearer ${DOUBAO_API_KEY}`

### Expected Response (same shape as DeepSeek)
```json
{
  "narration": "蝴蝶轻轻落在花瓣上，小恐龙看呆了。",
  "svg": "<svg viewBox=\"0 0 400 300\" ...>...</svg>",
  "followUpQuestion": "小恐龙要飞起来了，然后会去哪里呢？",
  "storySummary": "小恐龙被陨石砸中后醒来，遇到一只蝴蝶。"
}
```

## Backward Compatibility

- `app/page.tsx` is not modified — destructures `{ narration, svg }` and ignores unknown fields
- `lib/ai/deepseek.ts` is not removed — still callable directly and still wired through the resolver when Doubao is not configured
- `lib/ai/mock.ts`, `lib/svg/sanitizeSvg.ts`, `lib/story/storage.ts`, `lib/story/types.ts`, `lib/analytics/*` all unchanged
- `HINT_SYS`, `HINT_SYS_EN`, `TEXT_SYS`, `SVG_SYS`, `SCENE_SYS` exported shapes unchanged — only `COMBINED_SYS` content grows
- No new Novus events (the existing `story_turn_submitted` / `story_frame_generated` / `story_generation_failed` triggers still fire at the same call sites)

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Volcano endpoint id (`DOUBAO_MODEL`) misconfigured or stale | Medium | High | Throw clear `DOUBAO_MODEL is not set` error -> route mock fallback -> 200. Document endpoint-id creation in `.env.example` comment |
| Volcano Ark region-restricted network access (China-only egress) from Vercel region | Medium | High | Env-preference resolver lets the team fall back to DeepSeek by unsetting `DOUBAO_API_KEY` — no code redeploy. Pre-check Vercel region reachability before demo |
| Doubao ignores `response_format: json_object` and wraps in markdown fences | Low | Medium | Existing `parseResponse()` already handles ```json fences and raw SVG extraction (TASK-010 AC5) |
| Few-shot examples leak verbatim into model output | Medium | Medium | Marker text explicitly says `不要原样复制`; post-sanitize validation does not detect this, but a verbatim 3-example dump would clearly fail the "matches user's newLine" visual check during smoke. Acceptable risk for MVP |
| Token budget growth from 3 SVG examples (~1.5–2k extra tokens in system prompt) | Medium | Low | `max_tokens: 2000` is the response cap, not request cap; Doubao-pro-256k context handles this easily. Monitor for latency |
| Latency exceeds 30s Vercel cap on cold + large prompt | Low | High | 30s `AbortController` + route `maxDuration = 30` already in place; on timeout, mock fallback fires (TASK-010 pattern) |
| Few-shot SVG contains sanitizer-evading payload by accident (e.g. stray `<script>` in a copied example) | Low | High | Each example must pass a manual `sanitizeSvg()` trace during execution; execute-agent runs `sanitizeSvg()` on each literal in isolation before committing. AC5 enforces |
| Doubao returns color attributes despite prompt | Medium | Medium | `sanitizeSvg()` strips event handlers only — color contamination is visual, not security. Prompt + few-shot are primary defense. If visible during smoke, tighten prompt wording |
| Cost / billing surprise from Volcano | Low | Low | Hackathon-scale traffic is negligible; monitor in Volcano console |
| `NoApiKeyError instanceof` check fails after hoisting to shared module | Low | Medium | Either re-export from `lib/ai/errors.ts` and import everywhere, or use a typed `name === 'NoApiKeyError'` string check. Execute-agent verifies in Phase 3 |

## Rollback

To revert TASK-017:
1. `git checkout -- lib/ai/prompts.ts` (removes few-shot block)
2. `git checkout -- app/api/story/generate/route.ts app/api/story/hint/route.ts` (restores direct DeepSeek import)
3. `git checkout -- .env.example` (reverts Doubao vars + restores the original typo)
4. `rm lib/ai/doubao.ts` and (if created) `rm lib/ai/provider.ts` / `rm lib/ai/errors.ts`
5. `npm run typecheck && npm run build && npm run lint` to confirm clean state

No `npm install` rollback needed (no dependency changes). `lib/ai/deepseek.ts` is untouched by this task and remains the production path after rollback.

## Approval

Plan authored by plan-agent on 2026-06-20 (v1.1: + ADR section).
Approval and execution lifecycle are tracked in `docs/tasks/active_spec.md` and `docs/tasks/progress.md`.
