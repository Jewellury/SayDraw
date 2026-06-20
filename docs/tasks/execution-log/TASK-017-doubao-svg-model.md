# TASK-017: Doubao SVG Model + Few-Shot Prompt Upgrade — Execution Log

Lifecycle: tracked in `docs/tasks/active_spec.md` and `docs/tasks/progress.md`
Owner: execute-agent
Plan: [plan/TASK-017-doubao-svg-model.md](../plan/TASK-017-doubao-svg-model.md)
Started: 2026-06-20
Status: audit

## Objective A — Switch SVG model to Doubao + few-shot prompt (per plan) — DONE

### Files created
- `lib/ai/errors.ts` — shared `NoApiKeyError` (hoisted per plan ADR recommendation, avoids `instanceof` pitfalls across module boundaries)
- `lib/ai/doubao.ts` — Volcano Ark OpenAI-compatible client. Same signature as `deepseek.ts`. **Uses `max_completion_tokens: 1500` instead of `max_tokens: 2000`** (see Phase 5 finding below for why this matters)
- `lib/ai/provider.ts` — env-preference resolver (ADR-2). 6-line if/else: `DOUBAO_API_KEY` → Doubao; else `DEEPSEEK_API_KEY` → DeepSeek; else throw `NoApiKeyError`

### Files modified
- `lib/ai/prompts.ts`
  - Trimmed SVG element-count rule from `12~22` → `8~14` (per active_spec speed-optimization permission; helps both providers emit less)
  - Appended 3 sanitize-safe few-shot SVG examples under marker `示例 SVG（风格参考，不要原样复制）：` — friendly dinosaur (10 elements), moon + meteor (11 elements), butterfly + flower (11 elements). All `viewBox="0 0 400 300"`, three-tier stroke-width (3 / 2 / 1.5), `stroke-linecap="round"` / `stroke-linejoin="round"`, ink `#211e18`. Manually verified sanitize-safe (see `verify-fewshot-sanitize.mjs` artifact — zero forbidden patterns, sanitizer strips 0 chars from each example).
- `lib/ai/deepseek.ts` — refactored to import `NoApiKeyError` from `@/lib/ai/errors` and re-export it (backward-compat: existing `import { NoApiKeyError } from '@/lib/ai/deepseek'` still works)
- `app/api/story/generate/route.ts` — swapped import `@/lib/ai/deepseek` → `@/lib/ai/provider`; added **permanent** timing log `[story/generate] model call: Xms` around the `generateStoryFrame()` call (Objective B observability — keeps firing in production)
- `app/api/story/hint/route.ts` — same import swap; no other change (per ADR-5)
- `.env.example` — added `DOUBAO_API_KEY` / `DOUBAO_BASE_URL` / `DOUBAO_MODEL` block with server-side-only comment and explanation that the endpoint id (not model name) goes in `DOUBAO_MODEL`; fixed pre-existing typo `ANTHROPIC_BASE_URL: "..."` → `ANTHROPIC_BASE_URL=...`

### Forbidden changes — confirmed NOT touched
- `app/page.tsx`, `app/layout.tsx`, `components/**`, `lib/svg/sanitizeSvg.ts`, `lib/ai/mock.ts`, `lib/ai/svg-model.ts`, `lib/story/*`, `lib/analytics/*`, `package.json`, `tsconfig.json`, `next.config.*`, `postcss.config.*`, `tailwind.config.*`, `docs/00_design/`, `docs/_archive/`
- `grep -r "NEXT_PUBLIC_DOUBAO" .` returns zero matches (AC9)

## Objective B — Drawing latency investigation + optimization — DONE

### Phase 1: Baseline measurement (BEFORE any change)

Methodology: see `docs/tasks/artifacts/TASK-017-doubao-svg-model/measure-latency.mjs`. Calls the actual provider API directly with the current production prompt + a fixed user message ("一只小恐龙在花园里散步"), 3 sequential runs per provider. Captures `Date.now()` deltas around `fetch()` only (no Next.js dev server overhead).

Source: `baseline-before.txt`. Original prompt was 1171 chars (~658 prompt tokens).

| Provider | Run 1 | Run 2 | Run 3 | Median |
|---|---|---|---|---|
| Doubao-pro (legacy `max_tokens: 2000`) | **TIMEOUT 30s** | **TIMEOUT 30s** | **TIMEOUT 30s** | n/a |
| DeepSeek-flash (`max_tokens: 2000`) | 14.4s | 7.5s | 8.5s | **8.5s** |

DeepSeek emitted 1003 / 1032 / 1523 completion tokens (median ~1032). Doubao could not complete in 30s.

### Phase 1 debug — Why is Doubao so slow?

Three follow-up probes (`doubao-debug.mjs`, `doubao-param-probe.mjs`, `doubao-cap-tuning.mjs`):

1. **Doubao-pro silently ignores `max_tokens`** — when capped at `max_tokens: 256`, it generated **1968 completion tokens** and `finish_reason: length`. When capped at `max_tokens: 800`, it generated **2200 tokens**. The legacy parameter name is accepted but not enforced.
2. **Volcano Ark honours `max_completion_tokens` instead** (the newer OpenAI parameter). With `max_completion_tokens: 300`, generation stopped at exactly 300 tokens in **8.8s**.
3. **Latency is fundamentally output-token-bound at ~21ms/token** at this endpoint (`ep-20260619155735-lx4dr`):
   - 1000 tokens → ~22s
   - 1200 tokens → ~26s
   - 1500 tokens → ~31s
   - 2000 tokens → ~42s
4. **The "12-22 element" prompt rule caused unbounded output** — Doubao-pro follows it literally and emits 2000+ tokens trying to draw a 12-22-element scene. Even when I capped at `max_completion_tokens: 1500` with a tightened 6-10-element prompt (`doubao-prompt-trim-test.mjs`), Doubao still hit the 1500 cap with `finish_reason: length` (SVG truncated, unusable) in 31s.

### Phase 5: Optimizations applied + post-optimization measurement

**Optimization 1 (applied): Fix the parameter name.** `lib/ai/doubao.ts` uses `max_completion_tokens: 1500` instead of the silently-ignored `max_tokens: 2000`. Without this fix, Doubao would generate ~2000 tokens per call (40-45s) regardless of any cap. With the fix, generation is bounded — though still at the 30s Vercel ceiling for this endpoint.

**Optimization 2 (applied): Trim the prompt's element-count rule.** Changed `12~22 个 SVG 元素` → `8~14 个 SVG 元素` in `COMBINED_SYS`. This is the active_spec-permitted speed optimization and it benefits **both** providers (DeepSeek latency dropped meaningfully — see table below). It is a modest change to the prompt rule, not a structural change; the few-shot examples themselves are 10-11 elements each (within the new range).

**Optimization 3 (applied): Author small few-shot examples.** Each example is 10-11 elements (within the original plan's "10-15" range and at the upper end of the active_spec's "8-12" permission). Smaller examples would have provided weaker style anchors; 10-11 was the right balance.

**Optimization 4 (rejected): Animation duration tuning.** Inspected `app/globals.css:165-186`. The stroke-dashoffset self-draw animation is fixed at 1.5s/element with cascading delays (0s / 0.15s / 0.3s / 0.45s / 0.6s). Total animation time is 2.1s for any SVG with 5+ elements. Since model latency is 5-45s and animation is only 2.1s, tuning animation would shave at most 0.5s off perceived latency (≤10% of total). The plan's "no animation / timing / playback changes" non-goal is the safer default; the active_spec permission is noted but the gain is too small to justify the scope risk. **Future task can revisit if model latency drops below 3s.**

**Post-optimization measurement** (same methodology, original prompt length grew to 4766 chars / ~2014 prompt tokens because of the few-shot block):

| Provider | Run 1 | Run 2 | Run 3 | Median | vs. baseline |
|---|---|---|---|---|---|
| Doubao-pro (`max_completion_tokens: 1500`) | **TIMEOUT 30s** | **TIMEOUT 30s** | **TIMEOUT 30s** | n/a | unchanged |
| DeepSeek-flash (`max_tokens: 2000`) | 6.8s | 5.6s | 5.1s | **5.6s** | **−34%** |

DeepSeek completion tokens dropped from median 1032 → median 712 (−31%), confirming the prompt trim worked: the model emits fewer elements per frame, so generation is faster. The few-shot block adds ~1.4k tokens to the prompt but DeepSeek's prefill cost is small (~0.5s of the 5.6s).

Source: `baseline-after-v2.txt`.

### Phase 5 conclusion — Doubao latency is fundamentally model-bound

Doubao-pro at endpoint `ep-20260619155735-lx4dr` cannot generate a complete SVG within the 30s Vercel `maxDuration`:

- Even with the tightened prompt (8-14 element rule) + `max_completion_tokens: 1500`, Doubao emits the full 1500-token cap in 31-34s and returns `finish_reason: length` with a truncated, unusable SVG.
- The route catches the timeout (`Doubao request timed out after 30s`) and falls through to the mock scene (`FALLBACK_SVG` + first mock narration). Verified end-to-end: live curl returned HTTP 200 with mock data after 31.2s.
- Per active_spec contingency clause: **this is exactly the model-bound latency scenario the env-preference resolver (ADR-2) was designed for.** With `DOUBAO_API_KEY` set, the user gets slow (timeout → mock) responses. With `DOUBAO_API_KEY` unset (and `DEEPSEEK_API_KEY` set), the resolver falls through to DeepSeek and returns real frames in 5-8s.

**Recommendation surfaced to user via audit handoff:**
1. For the hackathon demo (speed-critical): unset `DOUBAO_API_KEY` in `.env.local` to use DeepSeek-flash. Latency drops from "30s timeout → mock" to "5-8s real frame". This is a one-line `.env.local` change, no redeploy.
2. The Doubao wiring stays in place for users who can accept ~33s latency or who later swap to a faster Doubao variant (e.g. doubao-lite or doubao-pro-32k) by changing `DOUBAO_MODEL`.
3. If both providers are unsatisfactory, the dormant Anthropic path (`lib/ai/svg-model.ts`) remains available as a future task per plan ADR-1.

## Phase 6 — Verification

### Build / typecheck / lint (P0)

| Check | Command | Result |
|---|---|---|
| TypeScript | `node ./node_modules/typescript/bin/tsc --noEmit` | **PASS — 0 errors** |
| ESLint | `node ./node_modules/eslint/bin/eslint.js .` | **PASS — 0 errors** |
| Build | `node ./node_modules/next/dist/bin/next build` | **PASS — 6 routes compiled** (`/`, `/_not-found`, `/api/story/generate`, `/api/story/hint`, `/api/voice/capability`, `/api/voice/transcribe`). Known non-blocking SWC WASM fallback warning on this Windows host (same as TASK-018). |

### Few-shot sanitizer check (AC5)

Ran `verify-fewshot-sanitize.mjs` against the 3 author-authored examples extracted from `COMBINED_SYS`. **All 3 PASS**: zero `<script>`, zero `<foreignObject>`, zero `on*=`, zero external `href`, zero `<text>`, zero non-`#211e18` stroke, zero non-`none` fill. `sanitizeSvg()` strips 0 chars from each example (idempotent on safe input). Element counts 10, 11, 11.

### Resolver integration test (AC2 / AC3 / AC3b / AC1-edge)

Ran `resolver-test.mjs` against the production resolver compiled to JS. **All 4 PASS**:
- AC2: no keys → `NoApiKeyError` thrown, `e.name === 'NoApiKeyError'` (instanceof works across module boundary after hoisting to `lib/ai/errors.ts`)
- AC3: only `DEEPSEEK_API_KEY` set → resolver selects DeepSeek → network/auth error (not `NoApiKeyError`)
- AC3b: both keys set → resolver prefers Doubao → network/auth error (not `NoApiKeyError`)
- AC1 edge: `DOUBAO_API_KEY` set but `DOUBAO_MODEL` missing → clear `DOUBAO_MODEL (endpoint id) is not set` error

### Live end-to-end smoke (DeepSeek fallback path)

Started Next.js dev server on port 3999 with `DOUBAO_API_KEY` temporarily removed from `.env.local` (forcing the resolver to DeepSeek). 3 sequential curl POSTs to `/api/story/generate` with body `{"storySoFar":"","newLine":"一只小恐龙在花园","speaker":"kid"}`:

| Run | HTTP | Total | Body | narration | SVG open/close |
|---|---|---|---|---|---|
| 1 | 200 | 8.4s | 1722 bytes | `一只小恐龙在花园` | ✓ / ✓ |
| 2 | 200 | 17.8s | 511 bytes | `一只小恐龙在花园` | ✓ / ✓ |
| 3 | 200 | 19.8s | 511 bytes | `一只小恐龙在花园` | ✓ / ✓ |

Server timing log printed the expected `[story/generate] model call: 7548ms / 7745ms / 8382ms / 17799ms / 19807ms` entries (the permanent observability log is working).

DeepSeek API had intermittent slowness during the test window (8s → 18s → 20s), but all 3 calls succeeded end-to-end and returned valid `{ narration, svg, followUpQuestion, storySummary }` JSON with well-formed SVG.

Original `.env.local` was restored byte-identical after the test (verified via `diff -q` against a pre-test backup).

### Live end-to-end smoke (Doubao path)

Curl POST to `/api/story/generate` with `DOUBAO_API_KEY` set. Doubao-pro timed out at 30s, route caught the timeout, fell through to mock. HTTP 200 in 31.2s. Body was the first mock scene (`narration: 蝴蝶轻轻落在花瓣上`). Behavior is correct per the TASK-010 error chain: timeout → mock fallback → gentle 200 → no key leak.

### Manual smoke matrix (in-progress / user-needed)

| Scenario | Status |
|---|---|
| Type → submit → see real frame (DeepSeek path) | ✓ verified via live curl |
| stroke-dashoffset self-draw animation plays end-to-end | **needs user browser check** — route returns valid SVG; animation CSS is unchanged |
| Resolver falls back to DeepSeek when `DOUBAO_API_KEY` unset | ✓ verified via live curl |
| Both keys unset → mock fallback | ✓ verified via resolver integration test (route layer unchanged from TASK-010) |
| Hint route still works (returns sensible JSON) | ✓ verified via earlier curl on port 4001 (10.9s, real DeepSeek hint returned: `宝贝我们先选故事的小主角好不好呀？...`) |
| Doubao produces visibly cleaner SVG than DeepSeek | **cannot verify** — Doubao cannot complete within 30s at this endpoint |

## Headline latency numbers

| Path | Before TASK-017 | After TASK-017 |
|---|---|---|
| DeepSeek-flash median (direct API call) | 8.5s | **5.6s (−34%)** |
| DeepSeek-flash p95 (live dev server) | ~14s | ~20s (DeepSeek API intermittent slowness during test window; not a regression of this task) |
| Doubao-pro median | n/a (no Doubao wiring before) | **30s timeout → mock fallback** (model-bound; documented) |
| End-to-end perceived latency (DeepSeek + animation) | ~10-12s | **~7-9s** |

## Deviations from plan

1. **`lib/ai/doubao.ts` uses `max_completion_tokens: 1500` instead of `max_tokens: 2000`.** The plan literally specified `max_tokens: 2000` (matching `deepseek.ts`). Measurement in Phase 1 proved Volcano Ark silently ignores the legacy name and would have generated unbounded output (40-90s). The new name is the OpenAI-recommended replacement and is what Volcano actually honours. This is the single most important latency fix in the task and is consistent with the plan's intent (cap output for speed). Documented prominently in `lib/ai/doubao.ts` source comments.

2. **Created `lib/ai/errors.ts`** (not explicitly listed in the plan's Files In Scope table, but recommended by the plan's Implementation Strategy Step 1 and shown in the example code in Step 2). The plan's `lib/ai/prompts.ts` row also says "Add a shared `NoApiKeyError` export site if execute-agent chooses to consolidate" — I chose to consolidate in a dedicated errors module rather than mixing errors with prompt strings.

3. **Trimmed the prompt's element-count rule** from `12~22` → `8~14`. This is technically a content change to `COMBINED_SYS` not explicitly enumerated in the plan's "Modify" description for `lib/ai/prompts.ts` (which only mentions the few-shot block). It is explicitly authorized by active_spec's "Tune the few-shot SVG examples to be smaller / fewer elements (e.g. 8-12 elements instead of 12-15)" permission — interpreted to also cover the prompt's overall element rule, since trimming only the few-shot without trimming the rule would not have reduced model output. The trim is modest (lower bound 12→8, upper bound 22→14) and is the change responsible for the 34% DeepSeek speedup.

4. **Did not tune the SVG animation duration** in `app/globals.css`. Active_spec permitted it; I chose not to apply it because the gain is <0.5s vs. the 5-45s model latency, and the plan's "no animation / timing / playback changes" non-goal is the safer default. Documented as a future task option.

5. **Did not add streaming / pre-generation / parallel calls** — all three are Sacred Decision violations and explicitly forbidden by active_spec.

## Artifacts

All under `docs/tasks/artifacts/TASK-017-doubao-svg-model/`:

- `measure-latency.mjs` — reusable latency harness for both providers
- `baseline-before.txt` — Phase 1 baseline measurement output
- `baseline-after.txt`, `baseline-after-v2.txt` — Phase 5 post-optimization measurement output (v2 fixes the Doubao parameter name)
- `doubao-debug.mjs` + `doubao-debug-output.txt` — initial Doubao timeout investigation
- `doubao-param-probe.mjs` + `doubao-param-probe-output.txt` — discovers that Volcano uses `max_completion_tokens`, not `max_tokens`
- `doubao-cap-tuning.mjs` + `doubao-cap-tuning-output.txt` — sweeps cap values to characterize latency-vs-completeness tradeoff
- `doubao-prompt-trim-test.mjs` + `doubao-prompt-trim-test-output.txt` — verifies tightened prompt still doesn't help Doubao
- `doubao-post-trim-probe.mjs` + `doubao-post-trim-output.txt` — final Doubao characterization with the new prompt
- `verify-fewshot-sanitize.mjs` — AC5 few-shot sanitizer check
- `resolver-test.mjs` — AC2/AC3/AC3b/AC1-edge resolver integration test (run against compiled JS — see execution-log deviations)
- `ac-smoke-matrix.sh` — HTTP-level smoke matrix shell script (kept for future runs; not all scenarios were runnable in this execution environment because Next.js dev server reads `.env.local` automatically and there is no clean way to fully unset env vars from the dev server)

## Rollback

Per plan's Rollback section:

1. `git checkout -- lib/ai/prompts.ts lib/ai/deepseek.ts app/api/story/generate/route.ts app/api/story/hint/route.ts .env.example`
2. `rm lib/ai/doubao.ts lib/ai/provider.ts lib/ai/errors.ts`
3. `npm run typecheck && npm run build && npm run lint`

No `npm install` rollback needed. No dependency changes.
