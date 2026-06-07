# TASK-014B: Redraw Four Core Icons in Hand-Drawn Sketchbook Style

## 1. Background

TASK-014 replaced text with icons, but used a generic UI icon library style inconsistent with the product's "black-and-white hand-drawn sketchbook" visual language. TASK-014B redraws all four icons as purpose-built hand-drawn SVGs, adjusts button sizing, updates state rules, and replaces the loading spinner with a pencil-scratch jitter animation — all aligned with the warm-paper sketchbook aesthetic.

## 2. Goal

Replace the 4 inline SVGs from TASK-014 (dad avatar, kid avatar, speech bubble, pencil) with entirely redrawn hand-drawn sketchbook versions. Update button sizing, stroke colors, border styling, loading animation, and active-state behavior per the design brief.

## 3. Scope

- **Dad avatar** — redraw with squared-jaw adult head, dot eyes, calm smile, V-torso (user-provided SVG, 32×32 viewBox)
- **Kid avatar** — redraw with larger rounder head, bangs strokes, arc smiling-eyes, happy mouth, narrow shoulders (new draft)
- **Question speech bubble** — redraw with irregular bubble + triangular tail + hand-drawn `?` (new draft)
- **Pencil** — redraw tilted ~45°, rectangular body, triangular tip w/ lead core, eraser-cap tail (new draft)
- **Loading state** — replace `.hb-spin` 8-ray spinner with 3-line jitter scratch animation + CSS keyframes
- **Button sizing** — dad/kid: 56×56 circle; spark: 48×48 circle; send: 56×56 circle
- **Active stroke** — dad/kid active stroke white (not `#211e18`); send stays white
- **Spark border** — change from solid to dashed
- **Remove** old `.hb-spin` SVG from send button, old star SVG from spark button, old avatar SVGs
- **Globals.css** — add `@keyframes hbJitter*` for 3-line scratch animation, change `.hb-spark` border to dashed

## 4. Out of Scope

- No icon library (lucide, heroicons, etc.)
- No changes to AI call logic, API routes, or `lib/`
- No new npm dependencies
- Mic button untouched (byte-identical JSX)
- Speaker toggle event wiring, `addScene`, `loading`/`listening` state machines untouched
- Send button disabled logic untouched
- Settings panel, playback modal, filmstrip, narration dot
- Color story frames, color tokens, paper/ink palette, canvas SVG generation pipeline
- `docs/00_design/` or `docs/_archive/` files

## 5. Design Decisions

### 5.1. 爸爸说 (adult avatar) — user-provided, verbatim

**Concept:** Simplified adult head with squared jaw, calm dot eyes, V-torso. Heavier, stabler lines than the baby icon.

```svg
<svg viewBox="0 0 32 32" fill="none" stroke="currentColor"
     stroke-linecap="round" stroke-linejoin="round"
     xmlns="http://www.w3.org/2000/svg">
  <path d="M11 10 Q11 7 16 7 Q21 7 21 10 Q21 15 16 16 Q11 15 11 10 Z" stroke-width="2"/>
  <circle cx="13.5" cy="11" r="0.8" fill="currentColor"/>
  <circle cx="18.5" cy="11" r="0.8" fill="currentColor"/>
  <path d="M13.5 13.5 Q16 14.5 18.5 13.5" stroke-width="1.5"/>
  <path d="M10 25 Q10 20 16 19 Q22 20 22 25" stroke-width="2"/>
</svg>
```

**Sizing:** SVG renders at 32×32px inside 56×56px circular container (~57% fill).
**Inactive:** `stroke="currentColor"` where currentColor=`#211e18` via inline `color` style.
**Active:** `stroke="currentColor"` where currentColor=`#fff` via inline `color` style (parent filled `#2b5d7e`).

### 5.2. 宝宝说 (child avatar) — plan draft

**Concept:** Bigger, rounder head than dad (child large-head-small-body proportion). Scattered bangs strokes on top. Arc-shaped smiling eyes. Happy upward mouth arc. Narrower shoulders than dad. Same 32×32 viewBox, stroke-width=2/1.5 convention.

```svg
<svg viewBox="0 0 32 32" fill="none" stroke="currentColor"
     stroke-linecap="round" stroke-linejoin="round"
     xmlns="http://www.w3.org/2000/svg">
  <path d="M9 9 Q9 5 16 5 Q23 5 23 9 Q23 15 16 16 Q9 15 9 9 Z" stroke-width="2"/>
  <path d="M11.5 6.5 Q12 4.5 13.5 5.5" stroke-width="1.5"/>
  <path d="M14 5.5 Q14.5 3.5 16 5" stroke-width="1.5"/>
  <path d="M17 5 Q18 3.5 19 5.5" stroke-width="1.5"/>
  <path d="M19.5 6 Q20.5 4.5 21 7" stroke-width="1.5"/>
  <path d="M12 10.5 Q12.8 11.5 13.8 10.5" stroke-width="1.5"/>
  <path d="M18 10.5 Q18.8 11.5 19.8 10.5" stroke-width="1.5"/>
  <path d="M13.5 13 Q16 15 18.5 13" stroke-width="1.5"/>
  <path d="M12 27 Q12 24 16 23.5 Q20 24 20 27" stroke-width="2"/>
</svg>
```

**Sizing:** Same as dad — 32×32px SVG inside 56×56px circle.
**Inactive/Active:** same `currentColor` toggle (`#211e18` → `#fff`); parent fill `#d9622b` when active.

### 5.3. 接下来呢 (question speech bubble) — plan draft

**Concept:** Hand-drawn irregular rounded-rect bubble with a small triangular tail pointing down-right. Inside: a hand-drawn `?` (hook stroke + dot below). More "hand tremor" feel than a normal icon.

```svg
<svg viewBox="0 0 32 32" fill="none" stroke="currentColor"
     stroke-linecap="round" stroke-linejoin="round"
     xmlns="http://www.w3.org/2000/svg">
  <path d="M5.5 8 Q5 4 9.5 4 L22 4 Q27 4 27 8 L27 17 Q27 21 22.5 21 L11 21 Q6 21 5.5 17 Z" stroke-width="2"/>
  <path d="M21 21 L24 27 L18 21" stroke-width="2" stroke-linejoin="round"/>
  <path d="M13 10 Q11.5 7 15 6 Q18 5.5 18 8.5 Q18 11 16 12 Q15 13 15 14" stroke-width="2"/>
  <circle cx="15.5" cy="17" r="1.2" fill="currentColor"/>
</svg>
```

**Sizing:** SVG renders at ~28×28px inside 48×48px circle (~58% fill).
**Border:** `.hb-spark` border changed from `solid` to `dashed` in globals.css.
**Color:** Uses `stroke="currentColor"` — existing `.hb-spark` CSS already toggles `color` (ink → paper on hover). No change to color logic.

### 5.4. 画出来 (pencil) — plan draft

**Concept:** Tilted pencil (~40°), rectangular barrel, triangular tip with smaller lead-core triangle inside, short horizontal dash for eraser end. Thicker and more forceful than generic "edit pencil" icons. Dynamic, as if about to draw.

```svg
<svg viewBox="0 0 32 32" fill="none" stroke="currentColor"
     stroke-linecap="round" stroke-linejoin="round"
     xmlns="http://www.w3.org/2000/svg">
  <path d="M9 23 L12 19 L23 9 L19 13 Z" stroke-width="2"/>
  <path d="M9 23 L4 28 L12 19" stroke-width="2"/>
  <path d="M8 23.5 L7 25 L10 22" stroke-width="1.5"/>
  <path d="M20 12 L18 14" stroke-width="2"/>
  <path d="M14 18 L16 16" stroke-width="1.5"/>
  <path d="M17 15 L19 13" stroke-width="1.5"/>
</svg>
```

**Sizing:** SVG renders at 32×32px inside 56×56px circle (~57% fill).
**Default (idle):** `stroke="currentColor"` where currentColor=`var(--paper)` (white on ink bg via `.hb-send`).
**Disabled:** `opacity: 0.4` unchanged from existing `.hb-send:disabled`.

### 5.5. Loading state: 3-line jitter scratch animation

**Concept:** When `loading=true`, replace the pencil with 3 short horizontal lines stacked vertically (scribbling/shading marks). Each line wiggles with a different random-looking translate via CSS keyframes. Replaces the now-removed `.hb-spin` rotating-sun spinner.

**SVG markup:**
```svg
<svg viewBox="0 0 32 32" fill="none" stroke="currentColor"
     stroke-linecap="round" stroke-linejoin="round"
     xmlns="http://www.w3.org/2000/svg">
  <line x1="10" y1="12" x2="20" y2="12" stroke-width="2" class="hb-jit1"/>
  <line x1="10" y1="17" x2="20" y2="17" stroke-width="2" class="hb-jit2"/>
  <line x1="10" y1="22" x2="20" y2="22" stroke-width="2" class="hb-jit3"/>
</svg>
```

**CSS keyframes (appended to `app/globals.css`):**
```css
@keyframes hbJitter1 {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(2px); }
  75% { transform: translateX(-1.5px); }
}
@keyframes hbJitter2 {
  0%, 100% { transform: translateX(0); }
  30% { transform: translateX(-2px); }
  70% { transform: translateX(1.5px); }
}
@keyframes hbJitter3 {
  0%, 100% { transform: translateX(0); }
  40% { transform: translateX(1.5px); }
  80% { transform: translateX(-2px); }
}
.hb-jit1 {
  animation: hbJitter1 0.3s ease-in-out infinite;
}
.hb-jit2 {
  animation: hbJitter2 0.35s ease-in-out infinite;
  animation-delay: 0.08s;
}
.hb-jit3 {
  animation: hbJitter3 0.4s ease-in-out infinite;
  animation-delay: 0.04s;
}
```

Each line ~10px wide, vertical gap ~5px. Different cycle durations + delays create a random-looking scratch effect.

## 6. Button Sizing Changes

| Button | TASK-014 size | TASK-014B size | Change |
|--------|-------------|----------------|--------|
| 爸爸说 (dad) | 48×48 circle | **56×56 circle** | +8px |
| 宝宝说 (kid) | 40×40 circle | **56×56 circle** | +16px |
| 接下来呢 (spark) | pill (auto w) | **48×48 circle** | →circle |
| 画出来 (send) | pill (auto w) | **56×56 circle** | →circle |

All four buttons now use `borderRadius: '50%'` for perfect circles. SVG icons centered, filling ~55-60% of container.

## 7. State Rules Changes from TASK-014

1. **Active stroke is now white** — TASK-014 used hardcoded `stroke="#211e18"` on dad/kid avatars (always ink, even on colored fill). TASK-014B uses `stroke="currentColor"` + conditional inline `color` style: `#211e18` when inactive, `#fff` when active. This makes the icon readable against filled backgrounds.

2. **接下来呢 gets dashed border** — `.hb-spark` border changes from `2px solid var(--ink)` to `2px dashed var(--ink)` per user spec.

3. **画出来 loading animation changes** — TASK-014 used the `.hb-spin` 8-ray rotating-sun SVG. TASK-014B replaces it entirely with the 3-line jitter scratch SVG + CSS keyframes. Remove the `.hb-spin` SVG from page.tsx and remove `.hb-spin` class + `@keyframes hbRot` from globals.css (they become dead). Add new `.hb-jit1/.hb-jit2/.hb-jit3` classes and `@keyframes hbJitter1/2/3`.

4. **Active backgrounds unchanged** — dad active fill `#2b5d7e`, kid active fill `#d9622b`, send fill `#211e18` always.

5. **Send button always white stroke** — `.hb-send` has `color: var(--paper)` so `stroke="currentColor"` naturally gives white on ink in both idle and loading states.

## 8. Implementation Steps

### app/page.tsx

1. **Line 500-532** — 爸爸说 button: replace the old avatar SVG (viewBox 0 0 24 24, lines 517-531) with the new 32×32 viewBox dad SVG from §5.1. Change `width: 48, height: 48` to `width: 56, height: 56`. Change SVG `width="24" height="24"` to `width="32" height="32"`. Change `stroke="#211e18"` to `stroke="currentColor"`. Add `style={{ color: speaker === 'dad' ? '#fff' : '#211e18' }}` on the SVG.

2. **Line 533-566** — 宝宝说 button: replace the old kid avatar SVG (lines 550-565) with the new 32×32 kid avatar SVG from §5.2. Change `width: 40, height: 40` to `width: 56, height: 56`. Change SVG `width="22" height="22"` to `width="32" height="32"`. Change `stroke="#211e18"` to `stroke="currentColor"`. Add `style={{ color: speaker === 'kid' ? '#fff' : '#211e18' }}` on the SVG.

3. **Line 567-588** — 接下来呢 button: replace the old speech-bubble SVG (lines 573-587) with the new 32×32 viewBox bubble SVG from §5.3. Add inline style: `width: 48, height: 48, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 0`. Change SVG dimensions to `width="28" height="28"`.

4. **Line 633-669** — 画出来 button: add inline style: `width: 56, height: 56, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 0`. Replace idle pencil SVG (lines 652-668) with the new 32×32 viewBox pencil from §5.4. Replace loading spinner SVG (lines 640-651) with the 3-line jitter SVG from §5.5.

5. **Line 640-651** — Remove the `.hb-spin` spinner SVG block entirely. Remove `className="hb-spin"` reference.

6. **Verify all 4 buttons** have `aria-label` and `title` preserved. Mic button (lines 594-618) untouched.

### app/globals.css

7. **Line 305** — Change `.hb-spark` `border` from `solid` to `dashed`: `border: 2px dashed var(--ink);`

8. **Lines 407-414** — Remove dead spinner CSS: delete `.hb-spin` class and `@keyframes hbRot`.

9. **Append after line 414** (where spinner was) — insert the 3 jitter `@keyframes` and `.hb-jit*` classes from §5.5.

## 9. Acceptance Criteria

1. **Four icons visually unified** with hand-drawn line feel — all use 32×32 viewBox, `stroke-width="2"`/`1.5`, hand-drawn path shapes
2. **Dad/baby avatars distinguishable** at a glance (adult squared jaw vs child round head + bangs)
3. **接下来呢 icon** clearly shows speech bubble + question mark
4. **画出来 icon** is a pencil, not an arrow/send
5. **Active/inactive color toggle correct** — dad active: blue bg + white icon; kid active: orange bg + white icon; inactive: transparent bg + ink icon
6. **No Chinese text visible** inside the 4 buttons (carry-over from TASK-014) — only in `aria-label`/`title` attributes
7. **aria-label + title preserved** on all 4 buttons
8. **Mic button untouched** (byte-identical JSX)
9. **Paper-airplane remains gone** — the literals `x1="22" y1="2"` and `points="22 2 15 22 11 13 2 9 22 2"` must NOT appear in page.tsx
10. **Old `.hb-spin` spinner removed** — no `hb-spin` class or `hbRot` keyframes in globals.css or page.tsx
11. **3 jitter lines animate** when `loading=true`; pencil shows when `loading=false`
12. **Button sizes match spec** — dad/kid/send = 56px circle, spark = 48px circle
13. **Spark border is dashed** — `.hb-spark { border: 2px dashed var(--ink); }`
14. **`npm.cmd run build` passes** — Vercel production build
15. **`npm run typecheck` passes** (or `npx tsc --noEmit`)
16. **Only `app/page.tsx` and `app/globals.css` modified** — `git diff --stat` shows exactly these 2 files

## 10. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Hand-drawn SVGs may look misshapen or hard to parse at 28-32px | The 32×32 viewBox with stroke-width=2 gives clear line weight. The simple shapes (head+bubble+pencil) are iconic and parse well at small sizes. Review at 1× DPR as audit step. |
| `stroke="currentColor"` + conditional inline `color` style may conflict with existing `.hb-chip` CSS | Inline `style={{ color: ... }}` on the SVG element wins over class CSS. The condition (`speaker === 'dad'/'kid'`) directly drives the color — no CSS specificity war. |
| Removing `.hb-spin` and `@keyframes hbRot` breaks other spinners | Grep confirms `.hb-spin` is used only in `app/page.tsx` line 648 (the send button loading state). No other usage. |
| Increasing kid button from 40px to 56px may look unbalanced next to other chrome | Both dad and kid are now the same 56px size — the differentiation is in the icon content (head shape, bangs), which is the correct approach. Consistent sizing reinforces the pair as a toggle. |
| 3 jitter lines may not animate naturally if SVG `transform` behaves unexpectedly in a flex container | `translateX()` on SVG `<line>` elements works independently of the parent layout. The `@keyframes` use small pixel offsets (1-2px) to avoid clipping at 32px viewBox boundaries. |

## 11. Verification Plan

1. `npx tsc --noEmit` — must pass
2. `npm.cmd run build` — must pass
3. `git diff --stat` — exactly 2 files: `app/page.tsx` and `app/globals.css`
4. Greps in `app/page.tsx`:
   - `M12 1a3 3 0 0 0-3 3v8a3` — exactly 1 match (mic SVG)
   - `x1="22" y1="2"` — 0 matches (paper-airplane gone)
   - `points="22 2 15 22 11 13 2 9 22 2"` — 0 matches
   - `className="hb-spin"` — 0 matches
   - `aria-label=` — count ≥ 5 (mic + 4 buttons)
5. Greps in `app/globals.css`:
   - `.hb-spin` — 0 matches
   - `hbRot` — 0 matches
   - `hbJitter` — matches present (3 keyframes + 3 classes)
   - `.hb-spark` border is `dashed`
6. Manual Chrome desktop:
   - 4 buttons show hand-drawn icons (no Chinese text)
   - Click dad → blue circle fill, icon goes white
   - Click kid → orange circle fill, icon goes white
   - Spark button has dashed border, hover inverts
   - Type text → send button enabled (pencil visible on dark bg)
   - Click send → 3 jitter lines animate, button disabled
   - Filmstrip/playback/narration still work end-to-end

## 12. Estimated Effort

**S** — Single-surface change: 4 inline SVGs replaced, 2 CSS blocks swapped, sizing/style adjusted. ~60 lines net change across 2 files.

## 13. Rollback

`git checkout HEAD -- app/page.tsx app/globals.css` restores TASK-014 state. No other files touched.
