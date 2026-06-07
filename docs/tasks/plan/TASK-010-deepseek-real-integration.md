# TASK-010: DeepSeek Real Integration

Lifecycle: tracked in `docs/tasks/active_spec.md` and `docs/tasks/progress.md`
Owner Flow: plan-agent -> execute-agent -> audit-agent
Lane: Full (API keys, server routes, SVG sanitization, AI calls, cross-module contracts)

## Background

TASK-007 built the core loop with `lib/ai/deepseek.ts` as a basic OpenAI-compatible chat completion wrapper: single model, single attempt, basic JSON parsing in the API route. The prompt (`SCENE_SYS`) requests `{ narration, svg }` only. The response type (`GenerateResponse`) in `lib/story/types.ts` carries only `narration` and `svg`.

TASK-010 upgrades the integration to production quality: dual-model fallback, `response_format: json_object` for structured output, richer response fields (`followUpQuestion`, `storySummary`) for future hint/summary features, improved SVG constraints, and a robust error-handling chain that never exposes model errors to the child user. This plan modifies 4 files: `lib/ai/deepseek.ts`, `lib/ai/prompts.ts`, `app/api/story/generate/route.ts`, and `lib/story/types.ts`.

## Goal

Make the DeepSeek API integration production-grade:

1. **Dual-model with fallback.** Primary call uses `DEEPSEEK_MODEL`; on failure, retry once with `DEEPSEEK_FALLBACK_MODEL`.
2. **Structured JSON output.** Request `response_format: { type: "json_object" }` from DeepSeek; parse `{ narration, svg, followUpQuestion, storySummary }`.
3. **Upgraded prompt.** SVG stroke color `#211e18`, explicit rules against fill/text/color, element count 10-24, request `followUpQuestion` and `storySummary`, continuity with existing story.
4. **Resilient error chain.** Primary fail -> fallback model -> JSON parse fail -> mock fallback -> SVG sanitizer fail -> fallback SVG. No raw model errors reach the child.

## Non-goals

- Client-side changes (`app/page.tsx` stays untouched)
- Consuming `followUpQuestion` or `storySummary` in the UI (future task)
- Streaming/SSE responses (single-shot JSON)
- Adding new dependencies (no `openai` npm package; built-in `fetch` only)
- Modifying `lib/ai/mock.ts` (existing mock data is sufficient)
- Modifying `docs/00_design/` or `docs/_archive/`
- Changing `package.json`, `tsconfig.json`, `next.config.*`, `tailwind.config.*`

## Design Source

- `docs/00_design/HuaHuaBen.jsx` lines 72-79: original `SCENE_SYS` prompt
- `docs/00_design/design_brief.md`: product-level SVG constraints
- AGENTS.md: DeepSeek API config (`deepseek-v4-flash` primary, `deepseek-v4-pro` fallback)

## Files In Scope

| File | Action | Purpose |
|------|--------|---------|
| `lib/ai/deepseek.ts` | **Modify** | Add `generateStoryFrame()` with dual-model fallback, `response_format: json_object`, temperature 0.75, environment config |
| `lib/ai/prompts.ts` | **Modify** | Update `SCENE_SYS` to request `followUpQuestion`/`storySummary`, enforce `#211e18` ink, 10-24 elements, forbid fill/text/color |
| `app/api/story/generate/route.ts` | **Modify** | Wire new `generateStoryFrame()`, parse `{ narration, svg, followUpQuestion, storySummary }`, sanitize SVG, fallback chain |
| `lib/story/types.ts` | **Modify** | Add optional `followUpQuestion?` and `storySummary?` to `GenerateResponse` |

## Forbidden Changes

- **`app/page.tsx`** — no client changes (existing mock loop must continue working without modification)
- **`docs/00_design/`** — source document protection
- **`docs/_archive/`** — source document protection
- **`package.json`** — no new dependencies
- **`tsconfig.json`**, **`next.config.*`**, **`postcss.config.*`**, **`tailwind.config.*`** — no config changes
- **`lib/ai/mock.ts`** — existing mock rotation is sufficient; do not modify
- **`lib/svg/sanitizeSvg.ts`** — existing sanitizer is sufficient; do not modify
- **`lib/story/storage.ts`** — no changes needed
- Do NOT put `DEEPSEEK_API_KEY` in any `NEXT_PUBLIC_*` variable, prop, or serialized client state
- Do NOT commit `.env.local` or any file containing the API key

## Acceptance Criteria

### AC1: Environment Configuration
- `DEEPSEEK_BASE_URL` defaults to `https://api.deepseek.com` when unset
- `DEEPSEEK_MODEL` defaults to `deepseek-v4-flash` when unset
- `DEEPSEEK_FALLBACK_MODEL` defaults to `deepseek-v4-pro` when unset
- All env reads are server-side only (`process.env.*`, never `NEXT_PUBLIC_*`)

### AC2: No Key -> Mock Fallback (Existing Behavior Preserved)
- When `DEEPSEEK_API_KEY` is not set, `POST /api/story/generate` responds with mock data immediately
- No attempt to call DeepSeek is made
- Mock rotation behavior is identical to pre-TASK-010 (same `getMockScene` function)
- Client page (`app/page.tsx`) works unchanged

### AC3: Primary Model Call
- When key is set, `generateStoryFrame()` calls DeepSeek with the primary model (`DEEPSEEK_MODEL`)
- Request includes `response_format: { type: "json_object" }`
- Temperature is 0.75 (moderate creativity, sufficient consistency)
- System prompt is `SCENE_SYS`; user message contains `storySoFar`, `newLine`, `speaker`

### AC4: Fallback Model on Primary Failure
- If primary model call fails (network error, non-2xx status, empty response), retry once with `DEEPSEEK_FALLBACK_MODEL`
- Fallback uses the same request body (messages, temperature, response_format) — only the `model` field differs
- Log the primary model error before retrying (server-side `console.error`)
- If fallback also fails, proceed to mock fallback

### AC4b: Deterministic Error-Chain Test (No Real Key Needed)
- With a fake `DEEPSEEK_API_KEY` (any non-empty string) and a bad `DEEPSEEK_BASE_URL` (e.g. `https://api.nonexistent-deepseek.invalid`):
  - Primary model call fails (DNS/connection error)
  - Fallback model call also fails
  - End-to-end chain reaches mock fallback and returns 200 with valid `{ narration, svg }`
- Verifies the full error chain works without requiring a real DeepSeek API key

### AC5: JSON Parsing with Fallback
- Parse response content as JSON; expect `{ narration, svg, followUpQuestion?, storySummary? }`
- If JSON parse fails, fall through to `parseScene()` regex extraction (existing logic)
- If regex extraction also fails (no SVG found), return fallback SVG
- `narration` field: required; if missing from AI response, use the user's `newLine` as fallback (existing behavior)
- `followUpQuestion` and `storySummary` are optional — missing values are silently omitted from the response

### AC6: Upgraded Prompt (SCENE_SYS)
- SVG stroke color changed from `#1f1c18` to `#211e18`
- Element count range: 10–24 (was 10–22)
- Explicitly forbid: `fill` (except `fill="none"`), text elements, color attributes
- Request `followUpQuestion` and `storySummary` in the JSON output
- Prompt describes `followUpQuestion` as an open-ended question to guide the next turn (optional)
- Prompt describes `storySummary` as a 2-3 sentence summary of the story so far (optional)
- Continuity: AI must read and continue the existing story (existing behavior preserved)
- **DeepSeek JSON mode compliance:** `SCENE_SYS` prompt includes the word "json" and provides a JSON output example (e.g. `{ "narration": "...", "svg": "...", "followUpQuestion": "...", "storySummary": "..." }`) per [DeepSeek JSON mode documentation](https://api-docs.deepseek.com/guides/json_mode) requirement that the system/user prompt must indicate JSON output

### AC7: SVG Sanitization
- Every SVG returned by the API route passes through `sanitizeSvg()` before the response is sent
- Sanitization runs for both real-DeepSeek path and mock-fallback path (existing behavior preserved)
- If sanitizer strips content, log a warning in development mode (existing sanitizer behavior)

### AC8: Updated Response Type
- `GenerateResponse` in `lib/story/types.ts` includes optional `followUpQuestion?: string` and `storySummary?: string`
- Backward compatible: routes consuming only `narration` and `svg` work without change

### AC9: Error Messages Are Child-Safe
- API errors never expose raw model errors, stack traces, or API key fragments to the client
- All client-visible errors use the gentle message: "画板打了个小盹，再说一次试试"
- Server-side errors are logged via `console.error` for debugging

### AC10: TypeScript Compiles
- `npm run typecheck` passes with zero errors

### AC11: Build Succeeds
- `npm run build` completes without errors

### AC12: Lint Passes
- `npm.cmd run lint` exits 0 (known Next/SWC warnings are non-blocking)

## Test First Plan

### Phase 0: Baseline
1. `npm run typecheck` — must be clean
2. `npm run build` — must be clean
3. `npm run lint` — must be clean

### Phase 1: Types + Prompts (no behavioral change)
4. Update `lib/story/types.ts`: add `followUpQuestion?` and `storySummary?` to `GenerateResponse`; verify `tsc`
5. Update `lib/ai/prompts.ts`: upgrade `SCENE_SYS` with new SVG rules and response fields; verify `tsc`

### Phase 2: DeepSeek Client Upgrade
6. Update `lib/ai/deepseek.ts`: add `generateStoryFrame()` with dual-model fallback, `response_format`, temperature 0.75; verify `tsc`
7. Manual test (if key available): call `generateStoryFrame()` directly from a test script or server-side code; verify it calls primary model, falls back to secondary on injected failure

### Phase 3: API Route Upgrade
8. Update `app/api/story/generate/route.ts`: wire `generateStoryFrame()`, parse new fields, error chain; verify `tsc`
9. Test without key: `curl -X POST http://localhost:3001/api/story/generate -H 'Content-Type: application/json' -d '{"storySoFar":"","newLine":"一只小猫","speaker":"kid"}'` — expect mock response
10. Test with key (if available): same curl — expect real DeepSeek response with `narration`, `svg`, optionally `followUpQuestion`/`storySummary`
11. Force error (if key available): temporarily set invalid model name; verify fallback model retry or mock fallback fires, client receives gentle error

### Phase 4: Final Verification
12. `npm run typecheck` — MUST pass
13. `npm run build` — MUST pass
14. `npm run lint` — MUST pass
15. Manual smoke test: full mock loop (no key) — type, submit, see frame, filmstrip updates; confirm unchanged behavior
16. If key available: full real loop — type, submit, see real AI-generated SVG frame with `#211e18` ink

## Implementation Strategy

### Step 1: Update `lib/story/types.ts`
Add optional fields to `GenerateResponse`:
```ts
export interface GenerateResponse {
  narration: string;
  svg: string;
  followUpQuestion?: string;
  storySummary?: string;
}
```

### Step 2: Update `lib/ai/prompts.ts`
Rewrite `SCENE_SYS` to:
- Use `#211e18` ink color
- Element count 10–24
- Explicitly forbid `fill`, text, color
- Request `followUpQuestion` and `storySummary` in JSON output
- Maintain existing continuity and age-4 tone

### Step 3: Upgrade `lib/ai/deepseek.ts`
Replace the simple `chatCompletion()` export with:

**Exported function: `generateStoryFrame()`**
- Signature: `(systemPrompt: string, userMessage: string) => Promise<string>` (returns raw text for route to parse)
- Reads `DEEPSEEK_API_KEY` — if missing, throws `NoApiKeyError` (caught by route -> mock fallback)
- Calls primary model; on failure, calls fallback model
- Uses `response_format: { type: "json_object" }`, temperature 0.75
- Returns content string from successful response
- Throws on both models failing

**Internal helper: `callDeepSeek()`**
- Takes `model: string`, same messages/params
- Returns raw content string or throws

**Environment constants on module load:**
```ts
const BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
const PRIMARY_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
const FALLBACK_MODEL = process.env.DEEPSEEK_FALLBACK_MODEL || 'deepseek-v4-pro';
```

**Remove:** existing `chatCompletion()` export if no other callers exist.

### Step 4: Upgrade `app/api/story/generate/route.ts`
Restructure the POST handler:

```
hasKey?
  no  -> mock fallback (unchanged path)
  yes ->
    try:
      raw = await generateStoryFrame(SCENE_SYS, userMessage)
      parsed = parseResponse(raw)  // extracts { narration, svg, followUpQuestion?, storySummary? }
      safeSvg = sanitizeSvg(parsed.svg)
      // Post-sanitize validation: result must be non-empty, contain <svg and </svg>
      if (!safeSvg || !safeSvg.includes('<svg') || !safeSvg.includes('</svg>')) {
        safeSvg = FALLBACK_SVG
      }
      return {
        narration: parsed.narration || newLine,
        svg: safeSvg,
        followUpQuestion: parsed.followUpQuestion || undefined,
        storySummary: parsed.storySummary || undefined,
      }
    catch:
      console.error the real error (server-side)
      fall back to mock (same as no-key path)
```

**New `parseResponse()` function:**
- Extends existing `parseScene()` to also extract `followUpQuestion` and `storySummary`
- Same JSON parsing + regex fallback logic
- Returns `{ narration, svg, followUpQuestion?, storySummary? }`

**Error chain design:**
```
DeepSeek primary fails
  -> try fallback model
    -> fallback fails
      -> mock fallback (returns mock scene, 200 OK)
    -> fallback succeeds
      -> parse JSON -> sanitize SVG -> return 200
  -> primary succeeds
    -> parse JSON -> sanitize SVG -> return 200
```

## Error Handling Chain

```
Layer 1: DEEPSEEK_API_KEY missing -> mock (no API call)
Layer 2: Primary model network/API error -> retry with fallback model
Layer 3: Both models fail -> mock fallback (log real error server-side)
Layer 4: Response JSON parse fails -> regex extract SVG; if still fails -> FALLBACK_SVG
Layer 5: SVG sanitizer returns — post-sanitize validation in API route: if result is empty string, missing `<svg` tag, or missing `</svg>` closing tag -> FALLBACK_SVG (hardcoded safe SVG)
Layer 6: Any unhandled exception -> gentle "画板打了个小盹" message, 500
```

Key principle: **never expose model errors, stack traces, or API key fragments to the client.**

## DeepSeek API Contract

### Request
```json
{
  "model": "deepseek-v4-flash",
  "messages": [
    { "role": "system", "content": "<SCENE_SYS>" },
    { "role": "user", "content": "<story so far + latest line>" }
  ],
  "max_tokens": 1000,
  "temperature": 0.75,
  "response_format": { "type": "json_object" }
}
```

### Expected Response
```json
{
  "narration": "蝴蝶轻轻落在花瓣上，小恐龙看呆了。",
  "svg": "<svg viewBox=\"0 0 400 300\" ...>...</svg>",
  "followUpQuestion": "小恐龙要飞起来了，然后会去哪里呢？",
  "storySummary": "小恐龙被陨石砸中后醒来，遇到一只蝴蝶，蝴蝶轻轻落在花瓣上。"
}
```

## Fallback SVG

When all parsing fails and no SVG can be extracted, use this hardcoded fallback (same as `FALLBACK_SVG` in HuaHuaBen.jsx):

```svg
<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
  <path d="M120 180 q80 -90 160 0" fill="none" stroke="#211e18" stroke-width="3" stroke-linecap="round"/>
  <circle cx="170" cy="150" r="6" fill="none" stroke="#211e18" stroke-width="2"/>
  <circle cx="230" cy="150" r="6" fill="none" stroke="#211e18" stroke-width="2"/>
  <path d="M170 175 q30 18 60 0" fill="none" stroke="#211e18" stroke-width="2" stroke-linecap="round"/>
</svg>
```

Note: ink color updated to `#211e18` to match the new prompt spec.

## Backward Compatibility

- `app/page.tsx` is not modified — the existing client code destructures `{ narration, svg }` from the response and ignores unknown fields. Adding `followUpQuestion` and `storySummary` is backwards compatible.
- `getMockScene()` in `lib/ai/mock.ts` is unchanged — it returns `{ narration, svg }` which satisfies the `GenerateResponse` interface (optional fields are absent = `undefined`).
- `lib/svg/sanitizeSvg.ts` is unchanged.
- `lib/story/storage.ts` is unchanged.
- `lib/analytics/` is unchanged.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| DeepSeek ignores `response_format: json_object` and returns markdown-wrapped JSON | Medium | Medium | `parseResponse()` already handles ```json fences and raw SVG extraction (from TASK-007) |
| DeepSeek returns SVG without `viewBox="0 0 400 300"` | Medium | Low | SVG still renders; viewBox is a strong prompt constraint but not enforced in code |
| DeepSeek adds color/fill/text despite prompt | Medium | Medium | `sanitizeSvg()` strips event handlers only; color/fill contamination is a visual issue, not a security one. Prompt strength is the primary defense |
| Fallback model also fails (API outage) | Low | High | Graceful mock fallback; app remains playable. Real error logged server-side |
| `followUpQuestion` breaks JSON parsing if it contains special characters | Low | Low | JSON string escaping handles this; if not, regex fallback extracts SVG and `narration` |
| Mock data still uses `#1f1c18` after prompt upgrades to `#211e18` | Low | Low | Visual difference is imperceptible (near-black). Mock SVGs are pre-authored and safe. Update in a future task if needed |

## Rollback

To revert TASK-010:
1. Restore `lib/ai/deepseek.ts` from git: `git checkout -- lib/ai/deepseek.ts`
2. Restore `lib/ai/prompts.ts` from git: `git checkout -- lib/ai/prompts.ts`
3. Restore `app/api/story/generate/route.ts` from git: `git checkout -- app/api/story/generate/route.ts`
4. Restore `lib/story/types.ts` from git: `git checkout -- lib/story/types.ts`
5. Run `npm run typecheck && npm run build && npm run lint` to confirm clean state

No `npm install` rollback needed (no dependency changes).

## Approval

Plan authored by plan-agent on 2026-06-07.
Approval and execution lifecycle are tracked in `docs/tasks/active_spec.md` and `docs/tasks/progress.md`.
