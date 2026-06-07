# TASK-014C: Final Icon Replacement (External AI SVG)

## 1. Task

Replace the 4 icons from TASK-014B with user-provided final SVGs sourced from an external AI review. The SVGs come verbatim from `docs/tasks/plan/TASK-014C-saydraw_icons_prompt.md` — no re-drafting, no shape changes.

## 2. Source of Truth

`docs/tasks/plan/TASK-014C-saydraw_icons_prompt.md` — all SVG markup, sizing, and behavior rules.

## 3. What Changes from TASK-014B

| Icon | TASK-014B | TASK-014C |
|------|-----------|-----------|
| Dad | Squared-jaw head (`Q` path) + V-torso, dot eyes (`r=0.8`) | Circle head (`circle cx=16 cy=12 r=6.5`) + necktie zigzag + dot eyes (`ellipse rx=1.3`), smile arc, shoulder lines |
| Kid | Round head (`Q` path) + 5 bangs strokes + arc smiling-eyes | Flower-bud hair (5 outward-scatter arcs) + big oval eyes (`ellipse rx=1.2 ry=1.3`), round head (`circle r=6`), small body |
| Bubble | Irregular bubble + triangular tail + hand-drawn `?` + dot | Refined bubble with standard `Q`/`Z` path + tail + `?` hook + dot — same concept, cleaner path geometry |
| Pencil | Tilted parallelogram barrel (`M 7 21 L 13 15 L 22 6 L 16 12 Z`) + scattered line-dash detail | New geometry: eraser-end rectangle (`21.5 5.5` to `26.5 10.5`), barrel center-line, proper tip triangle, lead-core stroke. Entirely different path topology |

## 4. Key Implementation Decisions

### 4.1 Dad/Kid: `currentColor` via parent container

Per user doc §2, the SVG uses `stroke="currentColor"` + `fill="currentColor"` and active/inactive is toggled by changing the **button parent's** `color`. Currently TASK-014B puts `style={{ color: ... }}` directly on the SVG element. Move it to the button's `style` prop:

```tsx
// Dad button
style={{
  color: speaker === 'dad' ? '#fff' : '#211e18',
  padding: 0, width: 56, height: 56, borderRadius: '50%',
  display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 0,
}}
// SVG: no inline color style — inherits from button via currentColor
```

The `.hb-chip { color: var(--c) }` CSS would otherwise set `#2b5d7e`/`#d9622b` as inactive color — the inline `color` on the button overrides to `#211e18` (ink).

### 4.2 Bubble: hardcoded `#211e18`, no `currentColor`

Per user doc §5.3, the bubble SVG uses `stroke="#211e18"` hardcoded. The TASK-014B `.hb-spark` hover CSS (`background: var(--ink); color: var(--paper);`) still runs, but since stroke is hardcoded, the icon stays `#211e18` on hover while only the background inverts. The bubble has no "active" toggle state like dad/kid.

### 4.3 Pencil: hardcoded `stroke="white"`, no `currentColor`

Per user doc §5.4, the pencil SVG uses `stroke="white"` hardcoded. The `.hb-send` CSS already sets `background: var(--ink)` and `color: var(--paper)` (white), so the hardcode matches. The loading jitter SVG already uses `stroke="currentColor"` and naturally inherits white — no change needed.

### 4.4 Loading jitter: unchanged

The 3-line jitter scratch SVG and its `@keyframes hbJitter1/2/3` + `.hb-jit1/2/3` classes from TASK-014B are kept verbatim. Per user doc §5.5.

## 5. Button Sizing

Unchanged from TASK-014B. Per user doc §4:

| Icon | Container | SVG render |
|------|-----------|------------|
| Dad | 56×56px circle | 32×32 |
| Kid | 56×56px circle | 32×32 |
| Bubble | 48×48px circle | 28×28 |
| Pencil | 56×56px circle | 32×32 |

## 6. Implementation Steps

All changes in `app/page.tsx` only. Do **not** touch `app/globals.css`.

### Step 1 — Dad button SVG (lines ~517-534)

Replace the TASK-014B dad SVG (squared-jaw head + V-torso) with the user-provided dad SVG from doc §3.1 (circle head + necktie + dot eyes). Remove `style={{ color: ... }}` from the SVG element; add `color: speaker === 'dad' ? '#fff' : '#211e18'` to the button's inline `style` (line ~502).

### Step 2 — Kid button SVG (lines ~553-574)

Replace the TASK-014B kid SVG (round head + bangs) with the user-provided kid SVG from doc §3.2 (flower-bud hair arcs + big eyes). Remove `style={{ color: ... }}` from the SVG element; add `color: speaker === 'kid' ? '#fff' : '#211e18'` to the button's inline `style` (line ~538).

### Step 3 — Bubble button SVG (lines ~592-607)

Replace the TASK-014B bubble SVG with the user-provided bubble SVG from doc §3.3. Change root `stroke="currentColor"` to `stroke="#211e18"`. Change the question-dot circle's `fill="currentColor"` to `fill="#211e18"`.

### Step 4 — Pencil idle SVG (lines ~686-702)

Replace the TASK-014B pencil SVG (parallelogram) with the user-provided pencil SVG from doc §3.4. Change root `stroke="currentColor"` to `stroke="white"`.

### Step 5 — Loading jitter SVG (lines ~670-684)

Unchanged from TASK-014B. Verify it still uses `stroke="currentColor"` (inherits white from `.hb-send`).

### Step 6 — Verification

- Grep: `stroke="currentColor"` should appear on dad SVG, kid SVG, mic SVG, loading jitter SVG — **not** on bubble or pencil idle SVG.
- Dad button `style` contains `color: speaker === 'dad' ? '#fff' : '#211e18'`.
- Kid button `style` contains `color: speaker === 'kid' ? '#fff' : '#211e18'`.
- No inline `style={{ color: ... }}` on any SVG element.

## 7. Acceptance Criteria

From user doc §6 plus standard checks:

1. **Dad active**: background `#2b5d7e`, icon white
2. **Kid active**: background `#d9622b`, icon white
3. **Mutual exclusion**: clicking one speaker deactivates the other
4. **Bubble**: dashed circle border, icon stays `#211e18` on hover
5. **Pencil**: dark circle (`#211e18`), white icon, loading jitter works
6. **All icons**: `stroke-linecap="round"`, hand-drawn feel unified with canvas style
7. **No Chinese text** visible inside buttons — only in `aria-label`/`title`
8. **aria-label + title** preserved on all 4 buttons
9. **Mic button untouched** (byte-identical JSX)
10. **No new npm dependencies**, no icon libraries
11. **`npm run typecheck`** passes
12. **`npm run build`** passes
13. **Only `app/page.tsx` modified** — `git diff --stat` shows exactly 1 file
14. **`globals.css` untouched** — TASK-014B style changes (dashed border, jitter keyframes) are correct and remain

## 8. Scope

- **In:** `app/page.tsx` only — 4 SVG replacements, 2 `color` style moves (SVG→button)
- **Out:** `app/globals.css`, `lib/`, `components/`, API routes, `docs/`, package.json, mic button, speaker toggle logic, loading state machine, CSS changes of any kind

## 9. Estimated Effort

**XS** — 4 inline SVGs replaced, 2 `color` props relocated. Net change ~50 lines in 1 file.

## 10. Rollback

```bash
git checkout HEAD -- app/page.tsx
```

Restores TASK-014B state. No other files touched.
