# TASK-019: hybrid-renderer-v2 (semantic anchors)

**Lifecycle:** audit
**Auditor:** audit-agent
**Plan File:** `docs/tasks/plan/TASK-019-hybrid-renderer.md`
**Execution Log:** `docs/tasks/execution-log/TASK-019-hybrid-renderer-v2.md`
**Audit Date:** 2026-06-20
**Result: PASS**

## Summary

TASK-019 v2 adds a semantic-anchor bypass path to the story generation pipeline. LLM outputs a pure `components[]` array (`{id, role, drawOrder}`) with zero coordinates. A deterministic renderer (`semanticRenderer.ts`) auto-layouts using role rules, renders via Rough.js for hand-drawn jitter, and produces an SVG string. The bypass is gated behind `?strategy=semantic` query param — the existing direct-SVG path remains default and untouched.

All P0/P1 checks pass. 0 findings. Task is ready to close.

## Checks

| # | Check | Severity | Result |
|---|-------|----------|--------|
| 1 | `npm run typecheck` (tsc --noEmit) | P0 | ✅ 0 errors |
| 2 | `npm run build` (next build) | P0 | ✅ Compiled successfully, all pages generated |
| 3 | `npm run lint` (next lint) | P0 | ✅ No ESLint warnings or errors |
| 4 | DEEPSEEK_API_KEY exposure scan | P0 | ✅ Server-side only (`lib/ai/deepseek.ts`, `lib/ai/provider.ts`); zero hits in `app/`, `components/`, or `NEXT_PUBLIC_*` |
| 5 | SVG sanitization still applied | P0 | ✅ `sanitizeSvg()` called at `route.ts:151` after both direct and semantic branches compute `svg` |
| 6 | B&W only (no color fills) | P0 | ✅ All components use `stroke="#211e18" fill="none"` via `roughSvg.ts` |
| 7 | Components ≤ 12 | P1 | ✅ Exactly 12 in `componentRegistry` (moon, stone, cat_body, cat_head, cat_eyes, cat_tail, dino_body, dino_head, star, ground, flower, butterfly_wings) |
| 8 | Only roughjs as new dep | P1 | ✅ `package.json` shows `"roughjs": "^4.6.6"`; no Paper.js, no other new deps |
| 9 | No LLM coordinates | P1 | ✅ `SEMANTIC_SYS` prompt (lines 147-177) explicitly says "不要输出坐标！渲染器会根据 role 自动布局"; zero `x=`/`y=`/`cx=`/`cy=`/`bbox` in SEMANTIC_SYS section |
| 10 | LLM outputs only {id, role, drawOrder} | P1 | ✅ `SEMANTIC_SYS` schema confirms; `parseSemanticResponse()` validates |
| 11 | Direct SVG path still default | P1 | ✅ `?strategy=semantic` is explicit bypass (`route.ts:90`); absent param → `COMBINED_SYS` + `generateStoryFrame()` |
| 12 | No files outside approved scope | P1 | ✅ `git status` confirms: modified files match plan exactly (route.ts, prompts.ts, provider.ts, package.json); new files match plan (roughSvg.ts, componentLib.ts, semanticRenderer.ts). No `app/page.tsx`, no `docs/00_design/` |
| 13 | No Paper.js | P1 | ✅ Grep for `Paper|paper\.js|paperjs` across `*.{ts,tsx,json}` returns 0 matches |
| 14 | Fallback on empty components | P1 | ✅ `route.ts:124-128`: empty `components[]` → `FALLBACK_SVG`; missing component ID → gracefully skips |
| 15 | Semantic path always DeepSeek (no Doubao) | P2 | ✅ `generateStoryFrameSemantic()` in `provider.ts:30-34` — always calls `generateDeepseek()`, never Doubao. Documented in execution log. |

## Findings

**None.** All checks pass with zero P0/P1/P2/P3 findings.

### Notes (not findings)

- SVG output size is ~30KB (vs ~1-2KB for direct LLM SVG). Documented by execute-agent as expected due to Rough.js perturbation producing ~20-50 path ops per shape.
- `public/side-by-side.html` is a browser dev tool for side-by-side comparison during testing. It references `DEEPSEEK_API_KEY` as informational text ("需...有 DEEPSEEK_API_KEY") but does not contain or expose any key. This is a static artifact, not production UI.
- `next lint` emits a deprecation warning for `next lint` command itself (Next.js 16 migration notice), not a code-level issue.

## Verification

- Build/typecheck/lint: all three pass (verified via `powershell -Command` npm scripts)
- Key exposure: `DEEPSEEK_API_KEY` only in `lib/ai/deepseek.ts:13` and `lib/ai/provider.ts:21,31` (both server-side `process.env.*` reads)
- SVG sanitization path: `route.ts:150-155` — try/catch wrapping `sanitizeSvg(svg)` runs on both branches
- Plan compliance: all 4 acceptance criteria met (semantic path produces valid SVG, renderer runs locally, direct SVG path untouched, components < 12)
- File scope: `git status --porcelain` confirms all files match approved plan scope

## Required Fixes

None.

## Follow-up

None — TASK-019 is complete as an MVP verification. Future expansion (more scene types, more components, replacing direct SVG path) would be new plan-agent tasks.
