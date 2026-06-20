# Execution Log: TASK-019 v2 (hybrid-renderer semantic anchors)

**Date:** 2026-06-20
**Agent:** execute-agent
**Status:** completed → handoff to audit

## Files Created

| File | Purpose |
|------|---------|
| `lib/svg/roughSvg.ts` | Rough.js server-side wrapper — converts `generator.circle/ellipse/line/path()` drawables to SVG path strings without DOM |
| `lib/svg/componentLib.ts` | 12 pure SVG component functions (relative coords, hand-drawn via roughSvg) |
| `lib/svg/semanticRenderer.ts` | Deterministic layout engine: reads `components[]` with roles → auto-layout → complete SVG |
| `docs/tasks/artifacts/TASK-019-hybrid-renderer-v2/side-by-side.html` | Browser-side comparison tool for direct vs semantic SVG |
| `docs/tasks/artifacts/TASK-019-hybrid-renderer-v2/test-output.svg` | Verified semantic renderer output (cat on moon scene) |

## Files Modified

| File | Change |
|------|--------|
| `lib/ai/prompts.ts` | Added `SEMANTIC_SYS` prompt — LLM outputs `components[]` with `{id, role, drawOrder}` instead of SVG |
| `lib/ai/provider.ts` | Added `generateStoryFrameSemantic()` — always DeepSeek (no Doubao fallback) |
| `app/api/story/generate/route.ts` | Added `?strategy=semantic` query param support; added `parseSemanticResponse()` |
| `package.json` | Added `roughjs` dependency (runtime, ~15KB) |
| `docs/tasks/active_spec.md` | Status: approved → in_progress |
| `docs/tasks/progress.md` | Status: approved → in_progress |

## Component Library (12 components)

| ID | Role | Description |
|----|------|-------------|
| `moon` | support | Crescent moon via two rough arcs |
| `stone` | support | Rounded rock with texture lines |
| `cat_body` | character | Ellipse body + legs |
| `cat_head` | character | Circle head + triangular ears |
| `cat_eyes` | detail | Two eyes (circles + pupils) + nose + whiskers |
| `cat_tail` | character | Curved Q-path tail |
| `dino_body` | character | Ellipse body + spine ridges + legs |
| `dino_head` | character | Circle head + snout + eye |
| `star` | background | 5-pointed star path |
| `ground` | background | Segmented horizontal line at base |
| `flower` | background | Stem + 6 petal ellipses + center circle |
| `butterfly_wings` | background | 4 wing Q-paths + antennae |

All components use `stroke="#211e18" fill="none" stroke-linecap="round" stroke-linejoin="round"`.

## Layout Rules (renderScene)

1. **ground** → y=270, full width
2. **support** → (200, 220) — center-bottom
3. **character bodies** → (200, 185) — above support
4. **character heads** → (200, 153) — above body
5. **character tails** → (165, 187) — left of body
6. **detail** → follows head position
7. **background** → pseudo-random scatter in upper 20-120 y range

## Verification Results

| Check | Result |
|-------|--------|
| `npm run typecheck` | ✅ 0 errors |
| `npm run build` | ✅ Compiled successfully |
| `npm run lint` | ✅ No ESLint warnings or errors |
| Semantic renderer test (Node) | ✅ Valid SVG generated (31KB, 30+ elements) |

## Approved Plan Compliance

- ✅ One scene type only ("角色坐在支撑物上")
- ✅ 12 components (≤ 12 limit)
- ✅ NO Paper.js dependency
- ✅ roughjs only (~15KB, 0 extra deps)
- ✅ Existing direct-SVG path unchanged (default when no `?strategy=semantic`)
- ✅ No LLM coordinates — LLM outputs only `{id, role, drawOrder}`
- ✅ No touch: voice code, app/page.tsx, docs/00_design/
- ✅ New path is bypass: `?strategy=semantic` query param

## Known Notes

- SVG output is ~30-31KB (vs typical direct LLM SVG ~1-2KB). This is expected due to roughjs's hand-drawn perturbation generating ~20-50 path ops per shape.
- The `seed` passes through `Options` wrapper per roughjs v4 typings.
- Seed is deterministic per component (incremented counter), not random — this gives consistent but varied hand-drawn style across components.
- If LLM returns empty/invalid `components[]` or a component ID not in registry, `renderScene` gracefully produces SVG with available components and falls back to FALLBACK_SVG in the route.

## Artifacts

- `docs/tasks/artifacts/TASK-019-hybrid-renderer-v2/side-by-side.html` — Open in browser while dev server runs on :3001
- `docs/tasks/artifacts/TASK-019-hybrid-renderer-v2/test-output.svg` — Sample semantic render output
