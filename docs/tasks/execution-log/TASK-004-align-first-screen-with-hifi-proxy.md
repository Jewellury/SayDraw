# TASK-004 Execution Log

**Task:** TASK-004-align-first-screen-with-hifi-proxy
**Agent:** execute-agent
**Status:** done
**Date:** 2026-06-06

## Summary

Rewrote `app/page.tsx` and `app/globals.css` to match the high-fidelity prototype in `docs/00_design/HuaHuaBen.jsx`. The first screen now renders: branded header, animated seed SVG story card, filmstrip, speaker toggle in footer, and unified pill input bar. Paper noise texture via feTurbulence, dot-grid background, stroke-dasharray self-drawing animation.

## Files Changed

### `app/globals.css` — extended with:
- Paper noise overlay via `body::before` + SVG feTurbulence filter (opacity 6%)
- Dot-grid background (`radial-gradient`, 1px dots, 22px spacing)
- Root container: `max-width: 760px`, centered, column flex
- Header: `.hb-head`, `.hb-logo`, `.hb-title` (30px ZCOOL KuaiLe), `.hb-sub` (12px Noto Serif SC)
- Ghost buttons: `.hb-ghost` (rounded pill, hover invert)
- Board: `.hb-board` (radius 8px, 2.5px border, shadow 6px 7px 0)
- Tape: `.hb-tape` (120×24px, dashed border, orange tint)
- SVG animation: `.hb-draw` with `stroke-dasharray:700`, `hbDraw` 1.5s keyframes
- Staggered delays: nth-child(2) 0.15s, (3) 0.3s, (4) 0.45s, (n+5) 0.6s
- Narration: `.hb-narration` (Ma Shan Zheng 23px, lh 1.5), `.hb-dot` (11px circle)
- Page number: `.hb-page` (Noto Serif SC 12px, opacity 0.5)
- Filmstrip: `.hb-frame` 86×66px radius 6px, `.hb-frame.on` (ink border, shadow, translateY -2px)
- Speaker chips: `.hb-chip` with `--c` CSS variable, `.on` fills background
- Input pill: `.hb-inputbar` (radius 50px, 2.5px border, shadow 4px 5px 0)
- Mic: `.hb-mic` 42px, input: `.hb-input`, send: `.hb-send` (padding 11px 20px)
- Mobile: `@media ≤520px` title 24px, narration 20px, send span hidden

### `app/page.tsx` — rewritten:
- Added `'use client'` directive (needed for onClick handlers)
- Hidden SVG element with `feTurbulence` filter (`id="paper-noise"`) referenced by body::before
- **Header**: BookOpen inline SVG (26×26) + "画话本" title + subtitle + Play ghost button + RotateCcw ghost button (both no-op)
- **Board**: Tape strip + `<div className="hb-draw">` wrapping SEED_SVG as React JSX elements (no dangerouslySetInnerHTML)
- **Narration**: Colored dot (dad blue) + "陨石从月球上掉下来，砸到小恐龙，嗷呜——小恐龙晕了。" + page number "第 1 / 1 格"
- **Filmstrip**: Single frame (86×66px) with SEED_SVG thumbnail, highlighted (`.on`)
- **Footer**: Speaker toggle (爸爸说 / 宝宝说 active) + Input pill (Mic 42px SVG + readOnly input + Send SVG + "画出来" span)

### No other files modified
- `package.json` — unchanged (no new dependencies)
- `tailwind.config.ts` — unchanged
- `next.config.ts`, `tsconfig.json` — unchanged
- `docs/00_design/`, `docs/_archive/` — untouched

## Commands Run

| Step | Command | Result |
|------|---------|--------|
| Baseline tsc | `npx tsc --noEmit` | Pass (no output) |
| Baseline build | `npm run build` | Pass (exit 0) |
| Post-edit tsc | `npx tsc --noEmit` | Pass (no output) |
| Post-edit build | `npm run build` | Pass (exit 0) |
| Dev smoke test | `npm run dev` + GET / | 200 OK |

## Implementation Notes

1. **SEED_SVG conversion**: 16 SVG child elements mapped 1:1 from prototype to React JSX (circle, line, path). All `fill="none"`, `stroke="#1f1c18"` (matches `--ink`).
2. **Paper noise**: feTurbulence filter defined in hidden SVG in page component, applied to `body::before` via `filter: url(#paper-noise)`. This is functionally equivalent to the prototype's approach but uses feTurbulence instead of only CSS gradients.
3. **`use client` directive**: Required because buttons have `onClick` handlers. Next.js App Router pages are Server Components by default. This is consistent with future interactivity needs.
4. **All icons are inline SVGs**: BookOpen, Play, RotateCcw, Mic, Send — no `lucide-react` dependency used.
5. **Speaker toggle**: CSS variable `--c` approach mirrors prototype. First chip uses `--dad` color, last chip uses `--kid` color. Active state fills background via `--c`.
6. **Mobile adaptation**: Title shrinks to 24px, narration to 20px, send button text hidden (icon only), padding reduced.

## Deviations from Plan

None. All specifications followed exactly.

- Used `body::before` for paper noise overlay as specified ✓
- Seed SVG as React JSX elements (no dangerouslySetInnerHTML) ✓
- stroke-dasharray animation with correct nth-child delays ✓
- All CSS values match plan table ✓
- `@media ≤520px` from prototype ✓
- No new npm dependencies ✓
- No forbidden files modified ✓

## Artifacts

- Pre-edit backups: `docs/tasks/artifacts/TASK-004-align-first-screen-with-hifi-proxy/pre-edit/page.tsx`, `globals.css`

## AC Verification

| AC | Description | Status |
|----|-------------|--------|
| AC1 | Header: BookOpen SVG + "画话本" title + subtitle + Play/RotateCcw ghost buttons | PASS |
| AC2 | Speaker toggle in footer near input bar, not top | PASS |
| AC3 | Unified input pill (radius 50px, shadow, mic 42px, send "画出来") | PASS |
| AC4 | SEED_SVG as React JSX elements (no dangerouslySetInnerHTML) | PASS |
| AC5 | SVG self-drawing animation ~1.5s with staggered nth-child delays | PASS |
| AC6 | Narration: Ma Shan Zheng 23px lh 1.5 + 11px dad dot | PASS |
| AC7 | "第 1 / 1 格" bottom-right Noto Serif SC 12px opacity 0.5 | PASS |
| AC8 | Board: radius 8px, 2.5px border, padding 24px 22px 16px | PASS |
| AC9 | Dot-grid background + feTurbulence paper noise opacity ~6% | PASS |
| AC10 | Filmstrip frame 86×66px radius 6px, current highlighted | PASS |
| AC11 | @media ≤520px: title 24px, narration 20px, send span hidden | PASS |
| AC12 | tsc --noEmit passes | PASS |
| AC13 | npm run build exit 0 | PASS |
| AC14 | No new npm dependencies | PASS |
| AC15 | Seed SVG uses only `--ink` color (#1f1c18) | PASS |

All 15 ACs met.
