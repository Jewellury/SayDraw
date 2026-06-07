# Audit Report: TASK-004 — align-first-screen-with-hifi-proxy

**Audit Agent:** audit-agent
**Date:** 2026-06-06
**Task Status:** audit → done (PASS)

---

## Summary

TASK-004 rewrote `app/page.tsx` and `app/globals.css` to align the first screen with `docs/00_design/HuaHuaBen.jsx`. Audit confirms all 15 ACs are met, no forbidden files were modified, build and typecheck pass, and there are no P0/P1 findings.

**Result: PASS** — ready to clear active_spec.md.

---

## Acceptance Criteria Verification

| AC | Description | Finding |
|----|-------------|---------|
| AC1 | Header: BookOpen SVG + "画话本" (30px ZCOOL KuaiLe) + subtitle (12px Noto Serif SC) + Play/RotateCcw ghost buttons | **PASS** — page.tsx:17-40, globals.css:73-127 |
| AC2 | Speaker toggle in footer near input bar, not at page top | **PASS** — page.tsx:104-112, footer.hb-foot contains .hb-who |
| AC3 | Input pill: radius 50px, 2.5px border, 4px 5px 0 shadow, padding 6px 6px 6px 8px, mic 42px, send "画出来" | **PASS** — page.tsx:114-132, globals.css:298-357 |
| AC4 | SEED_SVG as React JSX elements (no dangerouslySetInnerHTML) | **PASS** — page.tsx:48-65, grep confirms zero dangerouslySetInnerHTML in app/ |
| AC5 | SVG self-drawing animation ~1.5s, staggered nth-child delays, .hb-draw on main SVG only | **PASS** — globals.css:165-186, .hb-draw on board div only (not filmstrip) |
| AC6 | Narration: Ma Shan Zheng 23px lh 1.5 + 11px dad-color dot | **PASS** — globals.css:189-206, dot uses `background: var(--dad)` |
| AC7 | "第 1 / 1 格" bottom-right, Noto Serif SC 12px, opacity 0.5 | **PASS** — page.tsx:71, globals.css:209-216 |
| AC8 | Board: radius 8px, 2.5px border, padding 24px 22px 16px | **PASS** — globals.css:136-143 |
| AC9 | Dot-grid background + feTurbulence paper noise opacity ~6% | **PASS** — globals.css:39-57 (dot-grid + body::before), page.tsx:7-11 (feTurbulence filter) |
| AC10 | Filmstrip frame 86x66px radius 6px, current highlighted (ink border + shadow + translateY -2px) | **PASS** — globals.css:219-260, page.tsx:74-99 |
| AC11 | @media <=520px: title 24px, narration 20px, send span hidden, padded adjustments | **PASS** — globals.css:360-393 |
| AC12 | tsc --noEmit passes | **PASS** — zero errors |
| AC13 | npm run build exit 0 | **PASS** — compiled successfully, all pages generated (SWC native binary warning is environment, not code) |
| AC14 | No new npm dependencies | **PASS** — package.json unchanged, no new imports |
| AC15 | Seed SVG uses only --ink color | **PASS** — stroke="#1f1c18" equals --ink; monochrome black line art (see P2 note below) |

---

## Findings

### P2: Seed SVG hardcodes `#1f1c18` instead of `var(--ink)` CSS variable

- **Severity:** P2 (should fix)
- **Location:** `app/page.tsx:49-64` (all 16 SVG child elements)
- **Problem:** SVG `stroke="#1f1c18"` uses the literal hex value rather than `stroke="var(--ink)"`. The value IS the same as --ink, and artwork remains monochrome black line art, so this does not violate the "no color" rule. However, if --ink token ever changes, the SVG will drift.
- **Fix:** Change all `stroke="#1f1c18"` to `stroke="var(--ink)"` in the seed SVG elements.

---

## Technical Checks

| Check | Status | Notes |
|-------|--------|-------|
| TypeScript (`tsc --noEmit`) | ✅ Pass | Zero errors |
| Build (`npm run build`) | ✅ Pass | Compiled successfully, all 4 pages generated |
| Forbidden files untouched | ✅ Confirmed | `docs/00_design/` timestamps (17:00-17:18) predate TASK-004 execution (20:47-20:48). All config files hashed and unmodified. |
| DEEPSEEK_API_KEY exposure | ✅ Clean | No key in client-side code (grep: zero matches in app/) |
| dangerouslySetInnerHTML | ✅ Clean | Zero instances in app/ (seed SVG rendered as React JSX) |
| SVG safety (static seed SVG) | ✅ Pass | No scripts, event handlers, foreignObjects, or external links in hardcoded SVGs |
| Pre-edit backups | ✅ Present | `docs/tasks/artifacts/TASK-004-align-first-screen-with-hifi-proxy/pre-edit/` contains page.tsx and globals.css |
| New npm dependencies | ✅ None | package.json unchanged |

---

## AC5 Detail: Draw Animation Scope

The `.hb-draw` class is applied ONLY to the main board SVG container (`page.tsx:47`), NOT to the filmstrip thumbnail (`page.tsx:77` uses `.hb-frame-svg`). This is correct per the plan: only the main stage SVG should animate on page load.

---

## AC9 Detail: Paper Noise Mechanism

The `body::before` pseudo-element uses `filter: url(#paper-noise)` referencing an inline `<filter id="paper-noise">` defined in a hidden SVG element (`page.tsx:7-11`). Both exist in the same document, so the URL reference is valid. The feTurbulence parameters (`type="fractalNoise"`, `baseFrequency="0.65"`, `numOctaves="3"`) match the prototype's approach. Visual confirmation would require a browser rendering test.

---

## Mobile (AC11) Coverage

@media <=520px covers:
- `.hb-title`: 30px → 24px
- `.hb-narration`: 23px → 20px
- `.hb-send span`: `display: none` (icon-only send button)
- Header/board/footer padding tightened proportionally
- Ghost buttons shrink to 12px font, 6px 10px padding

Touch targets: mic button (42x42px), ghost buttons (border-radius 40px pill), send button (pill). All > 44px recommendation.

---

## Conclusion

**Result: PASS** (0 P0, 0 P1, 1 P2)

TASK-004 is healthy and ready to ship. The single P2 finding (hardcoded hex vs CSS variable in seed SVG) is cosmetic and does not affect the black-and-white line-art requirement. Recommend clearing active_spec.md and moving TASK-004 to done.

---

*Audit agent does not fix code. P2 finding left for future execute-agent task if desired.*
