# TASK-017: Doubao SVG Model + Few-Shot Prompt Upgrade

Lifecycle: post-execution audit
Auditor: audit-agent
Plan File: [plan/TASK-017-doubao-svg-model.md](../plan/TASK-017-doubao-svg-model.md)
Execution Log: [execution-log/TASK-017-doubao-svg-model.md](../execution-log/TASK-017-doubao-svg-model.md)
Audit Date: 2026-06-20
Result: **pass** (with documented plan deviation — see Finding F1)

## Summary

TASK-017 shipped a working provider-abstract AI layer (`lib/ai/provider.ts` + `lib/ai/doubao.ts` + `lib/ai/errors.ts`), a sanitized few-shot prompt upgrade (`lib/ai/prompts.ts`), and a permanent server-side latency log. **The plan's literal Goal #1 ("switch SVG model to Doubao") was technically not met** — every available Volcano endpoint proved too slow in empirical testing (25–45 s vs. a 30 s Vercel cap), so the user explicitly directed production to stay on DeepSeek chat with `DOUBAO_*` commented out. This deviation is **fully justified** by empirical data, explicitly approved by the user, and documented as a new ADR-6 in the plan file.

The higher-level intent — *improve drawing quality without breaking UX, preserve the single-call contract, and keep DeepSeek as a fallback path* — **was met**: the few-shot prompt lifted DeepSeek output quality to visually acceptable, latency dropped 34 % (8.5 s → 5.6 s median), and the env-preference resolver makes a future Doubao re-evaluation a 1-line `.env.local` change.

Build, typecheck, and lint all pass cleanly. No P0 or P1 findings. No client-exposed keys. No Sacred Decision violations. No forbidden files touched by TASK-017 (the in-tree `app/page.tsx` and `package.json` diffs are TASK-018's, already audited & `done`).

## Checks

| Check | Command | Result |
|---|---|---|
| TypeScript | `npm run typecheck` (`tsc --noEmit`) | **PASS — 0 errors** |
| Build | `npm run build` (`next build`) | **PASS — 6 routes compiled, 8 static pages generated.** Known non-blocking SWC WASM fallback warning on this Windows host (same as TASK-018). |
| Lint | `npm run lint` (`next lint`) | **PASS — 0 warnings, 0 errors** (same known SWC warning, non-blocking per AGENTS.md) |
| Key scan — client exposure | `grep -r "NEXT_PUBLIC_DOUBAO" .` | **PASS — 0 matches in source** (3 hits in docs only, describing the rule itself) |
| Key scan — read sites | `grep DOUBAO_` in `app/`, `components/` | **PASS — 0 matches**. All `DOUBAO_*` reads confined to `lib/ai/doubao.ts`, `lib/ai/provider.ts`. The string `DOUBAO_API_KEY` appears in `lib/ai/errors.ts` only as **text inside an error message** (no key value). |
| Key scan — log leak | `grep` for `console.(log\|error).*apiKey\|token` in `app/` | **PASS — 0 matches**. The route's `[story/generate] model call: Xms` log at `route.ts:84` emits only an integer millisecond delta. |
| Sanitizer unchanged | `git diff lib/svg/sanitizeSvg.ts` | **PASS — no diff** |
| Sanitizer still wired | grep `sanitizeSvg(` in `app/api/story/generate/route.ts` | **PASS — line 104, runs on every SVG path (DeepSeek / Doubao / mock)** |
| Few-shot sanitize-safety | grep `script\|foreignObject\|onload\|onclick\|onerror\|<text\|href\|xlink` in `lib/ai/prompts.ts` | **PASS — 0 matches** in few-shot literals |
| Few-shot ink discipline | grep `stroke="#` and `fill="` patterns | **PASS — every stroke is `#211e18`, every fill is `none`** in the three example SVGs |
| Few-shot stroke tiers | grep `stroke-width="(3\|2\|1\.5)"` | **PASS — only the three sanctioned tiers appear** |
| Forbidden files | `git diff` against `app/page.tsx`, `components/**`, `docs/00_design/`, `docs/_archive/`, `package.json`, `tsconfig.json`, `next.config.*`, `postcss.config.*`, `tailwind.config.*`, `lib/svg/sanitizeSvg.ts`, `lib/ai/mock.ts`, `lib/ai/svg-model.ts`, `lib/story/*`, `lib/analytics/*` | **PASS — no TASK-017 changes.** The `app/page.tsx` and `package.json` working-tree diffs belong to TASK-018 (`VoiceRecorder` component + `ws` / `server-only` deps), which is already `done` per `progress.md`. |

## Findings

### F1 — Plan Goal #1 deviation: production stays on DeepSeek, not Doubao

- **Severity:** P2 (deviation, but justified & user-approved — does **not** block ship)
- **Location:** `lib/ai/provider.ts`, `.env.local` (production config), ADR-1 vs new ADR-6
- **Problem:** The plan's literal Goal #1 stated "Add a Doubao (Volcano Ark) client" and ADR-1 chose Doubao-pro as the primary provider. Empirical execution showed every available Volcano endpoint is unusable for production:
  - `ep-20260619155735-lx4dr` (PRO) → wrong model family (`doubao-seed-2-0-pro-260215` is a vision model); 31–45 s timeouts.
  - `ep-20260619160218-5m76d` (LITE) → 25.44 s per call in the bakeoff (exceeds 30 s Vercel cap once route overhead is added).
  - DeepSeek-reasoner → API silently routes to `deepseek-v4-flash` and emits content in `reasoning_content` (broken for our client).
  - DeepSeek chat → 0.29 s cold, 0.08–0.55 s cached; valid 16-element SVG.
- **Fix applied (not by audit-agent — by execute-agent + user decision):** User commented out `DOUBAO_*` in `.env.local` to force resolver fallback to DeepSeek. Documented as new ADR-6 in the plan.
- **Audit conclusion:** This is a **justified plan deviation**, not a failure. The plan deliberately included ADR-2 (env-preference resolver) *for exactly this contingency*. The higher-level goal (better drawing without breaking UX) was met.

### F2 — DeepSeek occasionally exceeds the prompt's 8–14 element rule

- **Severity:** P3 (model behaviour, not a code defect)
- **Location:** `lib/ai/prompts.ts:23` (rule) vs bakeoff artefact `deepseek-chat.svg` (16 elements)
- **Problem:** The prompt rule says `8~14 个 SVG 元素（精简优先，不要堆砌细节）`, but the bakeoff DeepSeek-chat sample emitted 16 elements for "一只小猫坐在月亮上". The SVG is still visually acceptable and sanitize-safe.
- **Fix:** None required for ship. If element creep becomes visible in production, tighten the rule to `8~12` or add a hard cap reminder ("不要超过14个元素"). File as future-task if observed in playtesting.

### F3 — Parameter-name divergence between providers

- **Severity:** P3 (future maintainability)
- **Location:** `lib/ai/doubao.ts:44` uses `max_completion_tokens: 1500`; `lib/ai/deepseek.ts:34` uses `max_tokens: 2000`
- **Problem:** The two providers use different OpenAI-compatible parameter names for the same concept. DeepSeek currently accepts both names, but a future DeepSeek API tightening could break the legacy name. The Doubao path is already on the modern name.
- **Fix:** None required for ship. When this task's resolver is next touched, migrate `deepseek.ts` to `max_completion_tokens: 1500` for consistency (DeepSeek accepts both today).

### F4 — `package.json` and `app/page.tsx` carry in-tree diffs from TASK-018

- **Severity:** P3 (informational — these are *not* TASK-017 changes)
- **Location:** `git status` shows modified `app/page.tsx`, `package.json`, `package-lock.json`
- **Problem:** A naïve reviewer of `git diff` could mis-attribute these changes to TASK-017. They are TASK-018's `VoiceRecorder` extraction and `ws` / `server-only` voice deps. TASK-018 is already `done` with its own audit pass.
- **Fix:** None required. Mentioned only to prevent confusion in a future commit/PR review.

## Verification

### Acceptance-criteria checklist

| AC | Description | Result | Evidence |
|----|---|---|---|
| AC1 | Env config server-side only; `DOUBAO_MODEL` checked, clear error if missing | **PASS** | `lib/ai/doubao.ts:5,18,23-26`. Zero `NEXT_PUBLIC_DOUBAO` matches in source. |
| AC2 | No key → mock fallback preserved | **PASS** | `lib/ai/provider.ts:24` throws `NoApiKeyError`; route catches and falls through to `getMockText` / `getMockHint` unchanged from TASK-010. |
| AC3 | Provider resolver is single source of truth | **PASS** | `lib/ai/provider.ts` is the only selection site. Both `/generate` and `/hint` import from `@/lib/ai/provider`. |
| AC4 | Doubao call shape | **PASS with documented deviation** | POSTs to `${DOUBAO_BASE_URL}/chat/completions`, `Authorization: Bearer`, `model`, `messages`, `temperature: 0.75`, `response_format: { type: 'json_object' }`, 30 s `AbortController`. **Deviation:** uses `max_completion_tokens: 1500` instead of plan-literal `max_tokens: 2000` — empirically required (Volcano ignores the legacy name); documented in execution log + source comment. |
| AC4b | Deterministic error-chain reaches mock fallback | **PASS** | Execution log records resolver-test.mjs all-4-AC PASS, plus live Doubao-timeout → mock end-to-end (HTTP 200 in 31.2 s). |
| AC5 | Few-shot examples in `COMBINED_SYS` | **PASS** | 3 examples (dinosaur 10 el, moon+meteor 11 el, butterfly+flower 11 el) under marker `示例 SVG（风格参考，不要原样复制）：` at `prompts.ts:37`. All sanitize-safe by manual trace + execution-log artifact `verify-fewshot-sanitize.mjs` (0 forbidden patterns, sanitizer idempotent). Plain string literals — no runtime disk load. |
| AC6 | Sanitization unchanged | **PASS** | `git diff lib/svg/sanitizeSvg.ts` → no diff. `route.ts:104` still calls `sanitizeSvg()` on every path. |
| AC7 | Sacred Decisions preserved | **PASS** | #1 B&W only (all examples + bakeoff outputs use `#211e18` / `fill="none"`); #2 SVG text only (no PNG, no base64, no image-gen); #3 viewBox `0 0 400 300` unchanged; #5 single-call contract intact (one JSON, narration + svg + followUpQuestion + storySummary). |
| AC8 | Hint route migrated | **PASS** | `app/api/story/hint/route.ts:4` imports from `@/lib/ai/provider`. `HINT_SYS` / `HINT_SYS_EN` unchanged. |
| AC9 | No client-exposed keys | **PASS** | `grep -r "NEXT_PUBLIC_DOUBAO" .` → 0 in source. Route log emits only integer ms. |
| AC10 | TS / build / lint pass | **PASS** | See Checks table above. |
| AC11 | `.env.example` hygiene | **PASS** | `.env.example:5-11` adds Doubao block with server-side-only comment + endpoint-id clarification. Line 15 fixes the `ANTHROPIC_BASE_URL=` typo. No real keys committed. |

### SVG safety trace (per few-shot example)

Manually traced each example through `sanitizeSvg.ts` logic:

- **Example 1 (dinosaur, `prompts.ts:39-50`):** 10 elements — 1 `<line>`, 2 `<path>`, 1 `<circle>` head, 1 `<circle>` eye, 1 `<path>` mouth, 2 `<line>` legs, 2 `<path>` fins, 1 `<path>` limb. Zero `<script>`, zero `<foreignObject>`, zero `on*`, zero external `href`, zero `<text>`, zero color. ✅
- **Example 2 (moon+meteor, `prompts.ts:52-64`):** 11 elements — 1 ground line, 1 moon circle, 3 crater circles, 1 meteor tail path, 1 meteor head ellipse (with `transform="rotate(45 130 130)"` — safe, no script), 1 ground path, 2 eye circles, 1 smile path. All sanitize-safe. ✅
- **Example 3 (butterfly+flower, `prompts.ts:66-77`):** 11 elements — 1 ground line, 1 stem line, 1 body circle, 2 upper-wing circles, 2 lower-wing circles, 2 antennae paths, 2 leaf paths. All sanitize-safe. ✅

Sanitizer regex strips 0 characters from each example (idempotent on safe input).

### Permanent timing log verification

`app/api/story/generate/route.ts:82-84`:

```ts
const tModelStart = Date.now();
const raw = await generateStoryFrame(systemPrompt, userMessage);
console.log(`[story/generate] model call: ${Date.now() - tModelStart}ms`);
```

Emits only an integer millisecond delta. No prompt, response, key, or endpoint data is logged. Verified safe.

## Required Fixes

None. Zero P0, zero P1.

## Follow-up

1. **Monitor DeepSeek dependency concentration** (P3). Both story text and SVG now flow through a single provider. If DeepSeek has a regional outage, both features fail together (mock fallback still fires per TASK-010). When a faster Volcano text-only Doubao variant releases, the env-preference resolver makes re-evaluation a 1-line `.env.local` change — re-run `docs/tasks/artifacts/TASK-017-doubao-svg-model/drawing-bakeoff/` to validate.
2. **Consider tightening the element-count rule** if observed element creep degrades perceived quality (F2).
3. **Align the `max_tokens` vs `max_completion_tokens` parameter names** across providers when the resolver is next touched (F3).
4. **Optional browser smoke** for the stroke-dashoffset self-draw animation on a real DeepSeek frame (the execution log marks this as the only verification step that needed user-side browser access; CSS is unchanged so regression risk is zero, but a single visual confirmation closes the loop).

## Status

Audit result: **pass** (0 P0 / 0 P1 / 1 P2 / 3 P3).

Plan Goal #1 (switch to Doubao) was technically not met — but the deviation is justified by empirical data, explicitly approved by the user, documented in new ADR-6, and consistent with the plan's own ADR-2 (env-preference resolver built for exactly this contingency). The higher-level product intent (better drawing, preserved Sacred Decisions, demo resilience) was met.

TASK-017 is marked **`done`** in `progress.md`. `active_spec.md` cleared to idle.
