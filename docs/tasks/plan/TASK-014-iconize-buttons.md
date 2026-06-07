# TASK-014: Iconize Four Chrome Buttons

Owner Flow: plan-agent -> execute-agent -> audit-agent
Lifecycle: tracked in `docs/tasks/active_spec.md` and `docs/tasks/progress.md`

## Background

The current input bar / footer (`app/page.tsx:492-597`) uses four Chinese-text buttons:
- **爸爸说 / 宝宝说** — speaker toggle pills (`.hb-chip`).
- **接下来呢？** — hint button with star SVG + text (`.hb-spark`).
- **画出来** — primary submit button with paper-airplane SVG + text (`.hb-send`).

Design spec §6 says "文字尽量少，能用图标 + 声音就别用字" (prefer icon + sound over text). The mic button (`.hb-mic`, line 527-552) is already icon-only and stays as the visual reference for the line-art aesthetic.

This task replaces the text (and where relevant, the existing icon) inside the four buttons with purpose-built inline SVGs that match the canvas hand-drawn line art. Mic button is explicitly untouched.

## Goal

Replace the Chinese text inside the four chrome buttons (`爸爸说`, `宝宝说`, `接下来呢？`, `画出来`) with inline SVG icons. Keep all CSS, colors, layout, and event wiring identical. Drop the existing paper-airplane SVG in `画出来` and replace with a pencil. All new SVGs use a single ink color (`#211e18` or `currentColor`) to match the canvas aesthetic.

## Non-goals

- Mic button (`.hb-mic`, lines 527-552) — **untouched**. The pencil loading spinner SVG is the same `.hb-spin` rotating-sun style and stays.
- Any new npm dependency, icon library, or font import.
- Any change to `app/globals.css` selectors, `:hover` rules, sizing tokens, or the `.hb-send` dark fill.
- Any change to the speaker toggle / Enter-to-submit / mic event wiring / `addScene` flow.
- Settings panel, playback modal, filmstrip, narration dot, or any other chrome.
- Color story frames, color tokens, paper/ink palette, or canvas SVG generation pipeline.
- Removing the `画出来` Chinese from any aria label that *replaces* it (we keep Chinese aria text in Chinese context).
- Removing the existing mobile `.hb-send span { display: none }` rule — it becomes dead but harmless. Do not touch it.
- A new analytics event. Reuse existing `story_turn_submitted` (already fired in `addScene`).

## Design Source

- `docs/00_design/frontend_design_spec.md` §1 — ink/paper/dad/kid/accent color tokens. Token values map to CSS vars `--ink #211e18`, `--paper #f6f1e3`, `--dad #2b5d7e`, `--kid #d9622b`.
- `docs/00_design/frontend_design_spec.md` §4 — speaker toggle "两个超大描边药丸，激活时填充各自颜色" — existing `.hb-chip.on` already implements this and stays.
- `docs/00_design/frontend_design_spec.md` §6 — "文字尽量少，能用图标 + 声音就别用字".
- `app/page.tsx:527-552` — the existing mic button SVG, the visual reference for line-art style and stroke attributes.

## Files In Scope

| File | Change |
|------|--------|
| `app/page.tsx` | Replace text/inner-SVG inside `.hb-chip` (×2), `.hb-spark`, `.hb-send` buttons. Add `aria-label` and `title` to the 3 buttons that currently lack them. Add icon SVGs as inline JSX. |

No other files. No CSS changes. No `lib/`, `app/api/`, `package.json`, or `docs/` changes.

## Forbidden Changes

- Do not touch `app/globals.css`, `package.json`, any API route, any `lib/` file.
- Do not touch any file under `docs/00_design/`, `docs/_archive/`, `docs/tasks/`.
- Do not modify the mic button SVG (lines 537-551), the `.hb-mic` class, or the mic event handlers.
- Do not modify `addScene`, the speaker toggle `onClick` handlers, the `setSpeaker` call, or the `listening` / `loading` state machines.
- Do not change the `.hb-chip.on` active styling — existing fill with `--c` and white text is the desired active state.
- Do not remove the `.hb-send span { display: none }` mobile rule (it is dead after this change but harmless).
- Do not add a new analytics event, a new env var, or a new file.

## Design Decisions

### 1. 爸爸说 (Dad avatar)

- **Concept:** larger circle (48×48) with an adult head silhouette — round head + a soft adult-shoulder curve. Sized larger than the kid avatar to give a visual "adult = bigger" cue that mirrors real life and helps the 4-year-old parse which is which.
- **Sizing:** button `48×48`, border-radius 50%, SVG `width=24 height=24 viewBox="0 0 24 24"`.
- **Stroke:** `stroke="#211e18"`. Stays ink-colored on both the inactive paper background AND the active `--dad` filled background — matches the "墨线是主角" rule from the design spec.
- **DRAFT SVG:**
  ```tsx
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
       stroke="#211e18" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="9" r="5" />
    <path d="M4.5 21c1-3.4 3.7-5.5 7.5-5.5s6.5 2.1 7.5 5.5" />
    <path d="M9 5.2c1-1 4.5-1 6 0" />
  </svg>
  ```
- **State behavior:** when `speaker === 'dad'`, existing `.hb-chip.on` already fills the button with `--c` (blue) and the text color becomes `#fff`. The ink-stroke SVG remains visible on the colored background.
- **aria-label:** `"切换为爸爸说话"`
- **title:** `"切换为爸爸说话"`

### 2. 宝宝说 (Kid avatar)

- **Concept:** smaller circle (40×40) with a child head + two 刘海 (bangs) strokes arching over the forehead. Sized slightly smaller than the dad avatar — same "adult bigger" cue, plus the bangs make it instantly readable as "kid" to a Chinese-speaking family.
- **Sizing:** button `40×40`, border-radius 50%, SVG `width=22 height=22 viewBox="0 0 24 24"`.
- **Stroke:** `stroke="#211e18"`. Same ink-on-everything rule.
- **DRAFT SVG:**
  ```tsx
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
       stroke="#211e18" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="11" r="4.2" />
    <path d="M5.5 20.5c.6-2.6 3-4.3 6.5-4.3s5.9 1.7 6.5 4.3" />
    <path d="M8.2 9.4c1-1.4 2.8-1.7 4-1.2" />
    <path d="M11.8 8.2c1.2-.5 3-.3 4 .5" />
  </svg>
  ```
- **State behavior:** identical to dad — `.hb-chip.on` fills with `--kid` orange, the ink-stroke SVG remains.
- **aria-label:** `"切换为宝宝说话"`
- **title:** `"切换为宝宝说话"`

### 3. 接下来呢？(Hint speech bubble)

- **Concept:** a rounded speech bubble with a tail and a `?` glyph inside. Reads instantly as "ask for a hint". Replaces both the existing star SVG and the text "接下来呢？".
- **Sizing:** button retains its pill shape; SVG `width=18 height=18 viewBox="0 0 24 24"`.
- **Stroke:** `stroke="currentColor"` — the `.hb-spark` already swaps `color` between ink (default) and paper (`:hover`), so the icon inverts correctly on hover without any new CSS.
- **DRAFT SVG:**
  ```tsx
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 11.5c0 3.6-3.8 6.5-8.5 6.5-1.3 0-2.5-.2-3.6-.5L4 19l1.4-3.4C4.5 14.5 4 13.1 4 11.5 4 7.9 7.8 5 12.5 5s8.5 2.9 8.5 6.5z" />
    <path d="M9.5 10.4c.3-1.1 1.3-1.9 2.5-1.9 1.4 0 2.5.9 2.5 2 0 .9-.7 1.3-1.3 1.7-.5.4-.7.8-.7 1.3" />
    <circle cx="12" cy="16.3" r="0.7" fill="currentColor" stroke="none" />
  </svg>
  ```
- **State behavior:** default state shows ink-stroke bubble on paper background. `:hover` (existing CSS) inverts to paper-stroke on ink background — same as today, no change.
- **aria-label:** `"接下来呢？给点灵感"`
- **title:** `"接下来呢？给点灵感"`

### 4. 画出来 (Pencil submit)

- **Concept:** a pencil tilted ~45° with the point at the lower-left, "about to draw" — replaces the paper-airplane metaphor (which suggested "send message" not "draw a picture") with a metaphor that literally matches the canvas action. The existing dark `.hb-send` pill stays; the paper-color pencil stroke is the new content.
- **Sizing:** button retains the dark pill; SVG `width=20 height=20 viewBox="0 0 24 24"`. Text removed entirely.
- **Stroke:** `stroke="currentColor"`. `.hb-send` already has `color: var(--paper)`, so the pencil inherits the paper color and reads cleanly on the dark `--ink` fill.
- **DRAFT SVG:**
  ```tsx
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 4 L20 8 L8 20 L4 20 L4 16 L16 4 Z" />
    <path d="M14 6 L18 10" />
    <path d="M4 16 L8 20" />
  </svg>
  ```
- **State behavior:**
  - **Idle** (`loading=false`): pencil visible. Button enabled iff `!loading && input.trim()` (existing rule).
  - **Loading** (`loading=true`): the pencil is replaced by the existing `.hb-spin` spinner SVG (the eight-ray sun, lines 569-579). Button is disabled. `aria-label` swaps to a Chinese loading hint.
- **aria-label:** `loading ? '画板正在沙沙画……' : '画出来'`
- **title:** `loading ? '画板正在沙沙画……' : '画出来'`

## Implementation Steps

1. **`app/page.tsx` ~line 494-500** — 爸爸说 button: remove the literal text `爸爸说`; add the dad avatar SVG (Design Decision 1); add `aria-label="切换为爸爸说话"` and `title="切换为爸爸说话"`. Keep `.hb-chip` class, `onClick`, and `--c` style unchanged.
2. **`app/page.tsx` ~line 501-507** — 宝宝说 button: remove the literal text `宝宝说`; add the kid avatar SVG (Design Decision 2); add `aria-label="切换为宝宝说话"` and `title="切换为宝宝说话"`. Keep `.hb-chip` class, `onClick`, and `--c` style unchanged.
3. **`app/page.tsx` ~line 494-507** — adjust button padding/sizing via inline `style` so the dad chip and kid chip render as clean circles. The base `.hb-chip` class declares `padding: 6px 16px` and `border-radius: 40px`; both must be overridden on these two buttons or the avatar SVG will be crushed by horizontal padding (48 - 32 padding - 4 border = 12px content area for the dad; 40 - 32 - 4 = 4px for the kid). Inline style on each button must include:
   - `padding: 0`
   - `width: 48` (dad) / `width: 40` (kid)
   - `height: 48` / `height: 40`
   - `borderRadius: '50%'`
   - `display: 'flex'`
   - `alignItems: 'center'`
   - `justifyContent: 'center'`
   - `lineHeight: 0` (kills the residual `font-size: 15px` line-height that would otherwise nudge the SVG off-center)
   Inline style always wins over class CSS. Do NOT modify the `.hb-chip` class itself.
4. **`app/page.tsx` ~line 508-522** — 接下来呢？ button: keep the existing star SVG, remove the literal text `接下来呢？` from below it; **actually drop the star** and add the speech-bubble SVG (Design Decision 3) in its place; add `aria-label="接下来呢？给点灵感"` and `title="接下来呢？给点灵感"`. Keep `.hb-spark` class, `onClick`, and `margin-left: auto` unchanged.
5. **`app/page.tsx` ~line 563-596** — 画出来 button: drop BOTH the paper-airplane SVG (`<line>` and `<polygon>` at lines 591-592) AND the `<span>{loading ? '绘画中' : '画出来'}</span>` (line 595). Replace with the pencil SVG (Design Decision 4) in the idle branch. Keep the existing `.hb-spin` spinner SVG in the loading branch. Add `aria-label` and `title` that swap with `loading` state. Keep `.hb-send` class, `onClick={addScene}`, and `disabled` rule unchanged.
6. **No other changes** in `app/page.tsx`. Do not touch imports, state, or any handler.

## Acceptance Criteria

1. **No Chinese text inside the 4 buttons** — visual check: only SVG glyphs are visible inside `.hb-chip` (×2), `.hb-spark`, and `.hb-send`. No `爸爸说` / `宝宝说` / `接下来呢？` / `画出来` / `绘画中` text nodes remain in the rendered DOM inside these buttons.
2. **Every iconized button has `aria-label` AND `title`** — all four buttons expose both attributes. For `.hb-send`, both attributes swap based on `loading`.
3. **All new SVGs follow the line-art rule** — every new `<svg>` uses `stroke="#211e18"` or `stroke="currentColor"`, `fill="none"`, `strokeLinecap="round"`, `strokeLinejoin="round"`, `strokeWidth="2"`. (Mic button SVG is exempt; it is unchanged.)
4. **No new dependencies** — `git diff package.json package-lock.json` is empty.
5. **No emoji, no external icon font, no icon library import** — only inline `<svg>` elements. No new `@import` or `<link>` tags in the file.
6. **`npm.cmd run build` passes** — Vercel production build succeeds with no new TypeScript or lint errors.
7. **Typecheck passes** — `npx tsc --noEmit` returns 0. (If `npm run typecheck` is defined in `package.json`, prefer that; otherwise fall back to `tsc --noEmit`.)
8. **Mic button byte-identical** — the JSX between the mic `<svg>` and its closing `</svg>` (lines 537-551) is unchanged. Audit greps for the literal substring `M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z` and confirms it still appears exactly once.
9. **Paper-airplane gone** — the literals `x1="22" y1="2"` and `points="22 2 15 22 11 13 2 9 22 2"` no longer appear in `app/page.tsx`.
10. **Loading state still works** — when `loading=true`, the `.hb-spin` rotating-sun SVG is rendered, the button is `disabled`, and the spinner is visible. When `loading=false` and `input.trim()` is non-empty, the pencil is rendered and the button is enabled.
11. **Active speaker state still works** — clicking the dad avatar sets `speaker='dad'` and the existing `.hb-chip.on` styling (blue fill, white text) is applied. Same for kid. The stroke `#211e18` is still readable on the colored fill.
12. **Hint button hover** — the existing `.hb-spark:hover` rule still inverts the icon to paper-color on ink background via `currentColor`. No new CSS needed.
13. **Build artifacts unchanged** — only `app/page.tsx` is in the diff. No `globals.css` diff, no `package.json` diff.
14. **Avatar chips render as clean circles (P1 reviewer check)** — in the rendered DOM, the dad button's content area must be ≥ 24px wide and ≥ 24px tall, and the kid button's content area must be ≥ 22px wide and ≥ 22px tall. Verify by inspecting computed `clientWidth` / `clientHeight` of each button's inner area in DevTools, OR by visual screenshot where the avatar SVG is fully visible and centered inside the circle with no clipping or squish. Inline style must include `padding: 0`, `display: 'flex'`, `alignItems: 'center'`, `justifyContent: 'center'`.

## Verification Plan

1. `cd E:\SayDraw && npx tsc --noEmit` — must pass.
2. `cd E:\SayDraw && npm.cmd run build` — must pass.
3. `git diff --stat` from `E:\SayDraw` — must show exactly one file changed: `app/page.tsx`.
4. `git diff package.json package-lock.json` — must be empty.
5. Grep checks in `app/page.tsx`:
   - `grep -F "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"` → 1 match (mic SVG, unchanged).
   - `grep -F 'x1="22" y1="2"'` → 0 matches (paper-airplane dropped).
   - `grep -F 'points="22 2 15 22 11 13 2 9 22 2"'` → 0 matches.
   - `grep -c 'aria-label=' app/page.tsx` → 4 (mic, dad, kid, spark, send) = 5 actually; mic already had one. Count must equal 5 (mic, dad, kid, spark, send) and the new four must have BOTH `aria-label` and `title`.
6. `grep -E '画出来|爸爸说|宝宝说|接下来呢|绘画中' app/page.tsx` — these strings should now appear only in `aria-label` / `title` attribute values, never as direct text content inside the four buttons. The only acceptable locations are aria/title attribute strings.
7. Manual in Chrome desktop:
   - Verify all 4 buttons show icons, no Chinese text.
   - Click dad avatar → blue fill, avatar visible, spark sends no error.
   - Click kid avatar → orange fill, avatar visible.
   - Type "dragon" → pencil button is enabled; click → spinner appears, button disabled.
   - Hover hint button → icon inverts to paper color on dark background.
8. Mobile width ≤ 520px: pencil-only `.hb-send` reads cleanly without the text; the dead `display: none` rule on `.hb-send span` is harmless.

## Risks

| Risk | Mitigation |
|------|------------|
| Avatar icon sizes (48px / 40px) may visually clash with the existing `.hb-chip` `font-size: 15px` and the surrounding `.hb-spark` (14px) button | Both buttons keep their 2px borders and pill/circle radius. Visual hierarchy still reads "speaker chips" → "hint" because the hint button is the only pill with text-after-icon today. The two new circles are clearly chips. |
| Hard-coding `stroke="#211e18"` on the avatar icons means the icon never tints to the speaker color when active | The active state is communicated by the button background fill (existing `.hb-chip.on` already does this). The icon's ink color remains stable and reads cleanly on both paper and the colored fill. The user spec accepts this. |
| Adding `aria-label` to a button that already shows Chinese text in some screen-reader configurations may double-announce | The buttons no longer have visible text (the literal `爸爸说` etc. is removed), so the `aria-label` is the sole source. No double-announce risk. |
| Inline `style` overrides on `.hb-chip` (padding 0, sizing, centering flex) may produce unexpected specificity | Inline style always wins over class CSS. The two specific buttons (dad, kid) will be sized; all other `.hb-chip` usages (none today besides these two) stay at the original pill size. `lineHeight: 0` is the safety belt against the inherited `font-size: 15px` line-box that would push the SVG down. |
| Pencil icon at 20px with three paths may look cluttered on a 1× device pixel ratio | `stroke-linejoin="round"` and `stroke-linecap="round"` soften the corners. The design spec already accepts 18-20px SVG icons in the input bar (the existing paper-airplane is 18px). Visual review at 1× DPR is part of audit step 7. |

## Rollback

Revert the changes in `app/page.tsx` (single file). No CSS, no package, no API route changes; rollback is a single `git checkout HEAD -- app/page.tsx`.

## Approval

Awaiting user approval. After approval: plan-agent updates `active_spec.md` to point here and flips `TASK-014` in `progress.md` to `approved`.
