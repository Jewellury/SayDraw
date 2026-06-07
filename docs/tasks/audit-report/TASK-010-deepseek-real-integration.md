# TASK-010 Audit Report: DeepSeek Real Integration

**Auditor:** audit-agent
**Date:** 2026-06-07
**Task Status:** PASS — No P0/P1 findings
**Lane:** Full

---

## Executive Summary

All 12 acceptance criteria verified. TypeScript, build, and lint all pass clean. No security issues found. The error chain is complete and robust. Task is production-ready.

---

## Verification Results

### Automated Checks

| Check | Tool | Result |
|-------|------|--------|
| TypeScript | `tsc --noEmit` | ✅ 0 errors |
| Build | `npm run build` | ✅ Compiled successfully |
| Lint | `npm run lint` | ✅ 0 warnings, 0 errors |

### AC-by-AC Verification

| AC | Description | Status | Evidence |
|----|-------------|--------|----------|
| AC1 | Environment Configuration | ✅ PASS | `lib/ai/deepseek.ts:1-3` — defaults: `https://api.deepseek.com`, `deepseek-v4-flash`, `deepseek-v4-pro`. All `process.env.*` reads, no `NEXT_PUBLIC_*`. |
| AC2 | No Key → Mock Fallback | ✅ PASS | `route.ts:75` — immediate mock when key missing. `getMockScene()` unchanged. `app/page.tsx` untouched. |
| AC3 | Primary Model Call | ✅ PASS | `deepseek.ts:35-36,64` — `response_format: json_object`, temperature 0.75, SCENE_SYS + user message. |
| AC4 | Fallback Model on Primary Failure | ✅ PASS | `deepseek.ts:65-72` — catch → console.error → retry with FALLBACK_MODEL. Same body, different model. |
| AC4b | Deterministic Error-Chain (Bad URL) | ✅ PASS | Code path verified: fake key + bad URL → both fetches fail → `route.ts:96-101` catches → mock fallback → 200. |
| AC5 | JSON Parsing with Fallback | ✅ PASS | `route.ts:25-46` — JSON parse → regex extract SVG → fail → empty string. `narration \|\| newLine` fallback. |
| AC6 | Upgraded Prompt (SCENE_SYS) | ✅ PASS | `prompts.ts:1,5-6,12` — ink `#211e18`, 10–24 elements, word "json" + JSON example, forbids fill/text/color. |
| AC7 | SVG Sanitization | ✅ PASS | `sanitizeSvg()` called in both mock (`route.ts:77`) and real (`route.ts:86`) paths. |
| AC8 | Updated Response Type | ✅ PASS | `types.ts:22-24` — `followUpQuestion?: string`, `storySummary?: string`. Client destructures only `narration`, `svg`. |
| AC9 | Child-Safe Errors | ✅ PASS | `route.ts:106` — `"画板打了个小盹，再说一次试试"`. No raw errors, stack traces, or API fragments exposed. |
| AC10 | TypeScript Compiles | ✅ PASS | `tsc --noEmit` exits 0. |
| AC11 | Build Succeeds | ✅ PASS | `next build` completes, all pages generated. |
| AC12 | Lint Passes | ✅ PASS | ESLint 0 warnings, 0 errors. |

---

## Critical Security Checks

### 1. DEEPSEEK_API_KEY Exposure Scan

| File | Location | Server/Client | Verdict |
|------|----------|---------------|---------|
| `lib/ai/deepseek.ts` | Lines 7, 17, 58 | Server | ✅ Allowed |
| `app/api/story/generate/route.ts` | Line 75 | Server (Route Handler) | ✅ Allowed |
| `.env.example` | Line 2 | Template (empty) | ✅ Allowed, git-safe |
| `app/page.tsx` | — | Client | ✅ NOT present |
| Any `globals.css` | — | — | ✅ NOT present |
| `NEXT_PUBLIC_*` | — | — | ✅ No DEEPSEEK key in NEXT_PUBLIC |

**Verdict: PASS** — DEEPSEEK_API_KEY appears only in server-side files and a template env file. Never exposed to client.

### 2. Client-Side DeepSeek API Calls

Grep for `fetch.*deepseek` across all `.ts/.tsx` files: **0 matches**. The only reference to `api.deepseek.com` is in `lib/ai/deepseek.ts:1` (server-side).

**Verdict: PASS** — No client code calls DeepSeek API directly.

### 3. SVG Safety

- `sanitizeSvg()` runs on both mock and real paths (`route.ts:77, 86`)
- `validateSvg()` post-sanitize guard: checks non-empty, `<svg`, `</svg>` → returns `FALLBACK_SVG` on failure (`route.ts:48-54`)
- The sanitizer strips `<script>`, `<foreignObject>`, `on*` attributes, external `href`/`xlink:href`
- Static SVGs (mock data, FALLBACK_SVG) verified: no scripts, event handlers, foreign objects, external links

**Verdict: PASS** — Sanitization chain is complete and correct.

### 4. JSON Mode Compliance

`SCENE_SYS` prompt includes:
- Word "json" in Chinese context: "请用json格式只输出一个JSON对象" (`prompts.ts:5`)
- JSON example: `{ "narration": "...", "svg": "...", "followUpQuestion": "...", "storySummary": "..." }` (`prompts.ts:6`)

**Verdict: PASS** — Meets DeepSeek JSON mode requirements per [docs](https://api-docs.deepseek.com/guides/json_mode).

---

## Code Quality Review

### Optional Fields (`followUpQuestion`, `storySummary`)

- `lib/story/types.ts:22-24`: Declared as optional with `?`. Backward compatible.
- `app/api/story/generate/route.ts:36-37,91-92`: Extracted as `o.followUpQuestion || undefined` and `o.storySummary || undefined`.
- `app/page.tsx:174`: Client destructures only `{ narration, svg }` — extra fields silently ignored. No breakage.
- `lib/ai/mock.ts:84-86`: Returns `{ narration, svg }` — satisfies `GenerateResponse` (optional fields absent).

**Verdict: PASS** — Optional fields correctly handled across all code paths.

### Dangling Spread Operator

Grep for `...` in modified `.ts` files: only found in string literals (comments, prompt examples). No actual spread operators.

**Verdict: PASS** — No spread operator bugs.

### Error Chain Verification

```
Layer 1: Key missing → mock immediately (route.ts:75)
Layer 2: Primary model fails → console.error + retry fallback (deepseek.ts:65-72)
Layer 3: Both fail → console.error + mock 200 OK (route.ts:96-101)
Layer 4: JSON parse fails → regex extract SVG (route.ts:43-45)
Layer 5: Post-sanitize SVG invalid → FALLBACK_SVG (route.ts:48-54)
Layer 6: Unhandled → 500 + child-safe message (route.ts:103-108)
```

**Verdict: PASS** — All 6 layers verified in source. No gaps.

---

## Forbidden Changes Audit

| File | Status | Evidence |
|------|--------|----------|
| `app/page.tsx` | ✅ Not modified | Import/usage unchanged, no DeepSeek references |
| `docs/00_design/` | ✅ Not modified | Protected directory untouched |
| `docs/_archive/` | ✅ Not modified | Protected directory untouched |
| `package.json` | ✅ Not modified | No new dependencies |
| `tsconfig.json` | ✅ Not modified | No config changes |
| `next.config.*` | ✅ Not modified | No config changes |
| `tailwind.config.*` | ✅ Not modified | No config changes |
| `lib/ai/mock.ts` | ✅ Not modified | Existing `#1f1c18` mock SVGs preserved |
| `lib/svg/sanitizeSvg.ts` | ✅ Not modified | Existing sanitizer preserved |
| `.env.*` files | ✅ Gitignored | `.gitignore` excludes `.env`, `.env.local`, `.env.*.local` |

---

## Pre-Commit Checklist

- [x] No secrets in committed files
- [x] Build succeeds
- [x] TypeScript passes
- [x] SVG sanitizer active on generated/dynamic SVG paths
- [x] No color in story SVGs (ink `#211e18`/`#1f1c18`, both near-black)
- [x] Core loop code path verified (mock path unchanged)

---

## Findings

**P0 (Block Ship):** None
**P1 (Must Fix):** None
**P2 (Should Fix):** None

**P3 (Nice to Have):**

1. **Mock SVGs still use `#1f1c18`** (`lib/ai/mock.ts` — all 4 scenes). The new prompt uses `#211e18`. As noted in the plan risks table, the visual difference is imperceptible. Consider updating in a future task if visual consistency is desired. Low priority.

2. **`parseResponse()` discards `followUpQuestion`/`storySummary` on regex fallback** (`route.ts:45`). If DeepSeek returns markdown-wrapped JSON that fails `JSON.parse` but passes regex extraction, the optional fields are lost. Low impact — these fields are not consumed in MVP. Can address in future hint/summary task.

---

## Conclusion

**TASK-010 PASSES audit.** All acceptance criteria met. All security checks clean. No P0 or P1 findings. The error chain is robust, the sanitizer is properly integrated, and the key is never exposed to the client.

**Action:** Mark TASK-010 as `done` in `progress.md` and clear `active_spec.md`.
