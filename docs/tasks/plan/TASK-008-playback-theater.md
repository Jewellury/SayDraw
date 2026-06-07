# TASK-008: Playback Theater

Owner Flow: plan-agent -> execute-agent -> audit-agent
Lifecycle: tracked in `docs/tasks/active_spec.md` and `docs/tasks/progress.md`

## Background

The "播放故事" button exists in the header as a ghost button but has a no-op `onClick={() => {}}` at `app/page.tsx:215`. The playback modal/mode does not exist yet in the Next.js app. The reference implementation in `HuaHuaBen.jsx` has a fully functional playback theater (lines 200-332, 401-411, 414-420) that must be migrated into the Next.js codebase. This is the emotional climax of the product — the "watching mode" where parents and children see their co-created story come to life.

## Goal

Implement a fullscreen dark warm-paper playback theater modal that:
1. Opens when the user clicks the "播放故事" header button
2. Shows the current frame centered and enlarged with SVG self-drawing animation re-triggered
3. Displays large narration text below the frame
4. Auto-advances every 3.8 seconds (midpoint of 3.5-4s range)
5. Provides Previous / Next / Close manual controls
6. Fires the `story_play_started` analytics event on open

## Non-goals

- No server/API changes
- No new dependencies
- No sound effects (audio not in scope)
- No story hint integration inside the theater
- No PNG export or sharing from theater
- No playback speed control (MVP: fixed auto-advance)
- No touch gesture navigation (prev/next buttons only for MVP)
- No "grand reveal" at end of story (just stops at last frame)

## Design Source

1. `docs/00_design/frontend_design_spec.md` §4 "播放态（观看模式）" and §5 "动效"
2. `docs/00_design/HuaHuaBen.jsx` — lines 200-332 (useEffect auto-advance + modal JSX), lines 401-411 (.hb-modal, .hb-close, .hb-play-board, .hb-play-text, .hb-play-ctrl CSS), lines 414-420 (.hb-draw animation CSS)

## Files In Scope

| File | Action |
|------|--------|
| `app/page.tsx` | Add `playing`/`playIdx` state, useEffect auto-advance timer, wire "播放故事" button onClick, add playback modal JSX |
| `app/globals.css` | Add `.hb-modal`, `.hb-close`, `.hb-play-board`, `.hb-play-text`, `.hb-play-ctrl` CSS blocks |

## Forbidden Changes

- Do NOT modify `lib/ai/`, `lib/svg/`, `lib/story/`, `lib/analytics/` (events and track are already correct)
- Do NOT change the existing `.hb-draw` animation CSS (it works for both stage and theater)
- Do NOT modify `docs/00_design/` or `docs/_archive/`
- Do NOT add color to story SVGs
- Do NOT add new dependencies
- Do NOT modify `app/api/` routes
- Do NOT change the `DrawnSvg` component interface (it already accepts `replayKey`)

## Acceptance Criteria

### AC1: Button Activation
- [ ] "播放故事" header button onClick opens the playback modal (no longer no-op)
- [ ] Button must not open modal if `scenes.length === 0` (edge case guard)

### AC2: Fullscreen Dark Theater
- [ ] Modal overlay fills the viewport (position fixed, inset 0)
- [ ] Background is dark warm-paper (`rgba(31,28,24,0.92)`) — matches HuaHuaBen.jsx reference
- [ ] All creation-mode controls (input bar, speaker toggle, filmstrip, hint button) are hidden behind the modal

### AC3: Frame Display
- [ ] Single frame SVG centered and enlarged (card max-width 560px, SVG max-height 55vh)
- [ ] SVG self-drawing animation re-triggers on each frame change via `replayKey` prop on `DrawnSvg`
- [ ] Narration text is large (26px, Ma Shan Zheng font), centered below the frame

### AC4: Auto-Advance
- [ ] useEffect timer advances `playIdx` every ~3800ms when `playing === true`
- [ ] Timer stops at the last frame (does not loop or wrap)
- [ ] Timer resets if user manually navigates with Prev/Next buttons
- [ ] Timer is cleaned up on unmount (clearTimeout in useEffect return)

### AC5: Manual Controls
- [ ] "Previous" button (ChevronLeft) decrements `playIdx`, disabled at frame 0
- [ ] "Next" button (ChevronRight) increments `playIdx`, disabled at last frame
- [ ] "Close" button (X icon, top-right) sets `playing = false`, closing the modal
- [ ] Frame counter shows "{playIdx + 1} / {scenes.length}" between prev/next

### AC6: Analytics Event
- [ ] `track(EVENTS.STORY_PLAY_STARTED, { frameCount: scenes.length })` fires exactly once when `playing` transitions from `false` to `true`
- [ ] Event does NOT fire on subsequent modal re-opens unless user closes and re-opens (fires once per open)

### AC7: Responsive
- [ ] Theater is usable at mobile (390×844), tablet (834×1112), and desktop (1440×900)
- [ ] Padding is reduced on small screens so the frame and controls remain visible
- [ ] Close button stays at top-right at all breakpoints

### AC8: Build & Lint
- [ ] `npm run build` succeeds with zero errors
- [ ] TypeScript compilation passes with zero errors

## Test First Plan

### Static Verification
```bash
# TypeScript check
npx tsc --noEmit

# Full build
npm run build
```

### Visual Checklist (manual browser verification)
1. Open app, add 2-3 story frames to have test data
2. Click "播放故事" → modal opens, dark overlay visible, first frame draws
3. Wait ~4s → auto-advances to next frame, SVG re-animates
4. Click "Prev" → goes back, SVG re-animates
5. Click "Next" → goes forward, SVG re-animates
6. Click "Close" (X) → modal closes, creation UI visible again
7. Verify counter "1 / 3", "2 / 3" etc.
8. Verify prev button disabled on first frame, next disabled on last

### Screenshot Evidence (required for visual tasks)

Save to `docs/tasks/artifacts/TASK-008-playback-theater/`:
- Desktop (1440×900): modal open mid-playback
- Tablet (834×1112): modal open with narration visible
- Mobile (390×844): modal open, all controls reachable

## Implementation Strategy

### Step 1: Add State
In `app/page.tsx`:
```ts
const [playing, setPlaying] = useState(false);
const [playIdx, setPlayIdx] = useState(0);
```

### Step 2: Add Auto-Advance useEffect
After existing useEffect (line 169-171), add:
```ts
useEffect(() => {
  if (!playing) return;
  if (playIdx >= scenes.length - 1) return;
  const t = setTimeout(
    () => setPlayIdx((i) => Math.min(i + 1, scenes.length - 1)),
    3800,
  );
  return () => clearTimeout(t);
}, [playing, playIdx, scenes.length]);
```

### Step 3: Wire "播放故事" Button
Replace `onClick={() => {}}` at `app/page.tsx:215` with:
```ts
onClick={() => {
  if (scenes.length === 0) return;
  track(EVENTS.STORY_PLAY_STARTED, { frameCount: scenes.length });
  setPlayIdx(current);
  setPlaying(true);
}}
```
Note: start playback from the currently selected frame (`current`), not always from frame 0.

### Step 4: Add Playback Modal JSX
Add the modal block after the closing `</footer>` tag using the same structure as `HuaHuaBen.jsx:310-332`, but using the existing `DrawnSvg` component from the local scope:
```tsx
{playing && (
  <div className="hb-modal">
    <button
      className="hb-close"
      onClick={() => setPlaying(false)}
      aria-label="关闭播放"
    >
      {/* X icon SVG */}
    </button>
    <div className="hb-play-board">
      {scenes[playIdx] && (
        <DrawnSvg
          svg={scenes[playIdx].svg}
          replayKey={'play-' + playIdx}
        />
      )}
      {scenes[playIdx] && (
        <div className="hb-play-text">{scenes[playIdx].text}</div>
      )}
    </div>
    <div className="hb-play-ctrl">
      <button
        onClick={() => setPlayIdx((i) => Math.max(0, i - 1))}
        disabled={playIdx === 0}
        aria-label="上一格"
      >
        {/* ChevronLeft SVG */}
      </button>
      <span>{playIdx + 1} / {scenes.length}</span>
      <button
        onClick={() => setPlayIdx((i) => Math.min(scenes.length - 1, i + 1))}
        disabled={playIdx === scenes.length - 1}
        aria-label="下一格"
      >
        {/* ChevronRight SVG */}
      </button>
    </div>
  </div>
)}
```

### Step 5: Add CSS
Append the following blocks to `app/globals.css` (place before the mobile `@media` block, after the `.hb-spin` keyframes block at line 396):

```css
/* ---------- Playback Modal ---------- */
.hb-modal {
  position: fixed;
  inset: 0;
  background: rgba(31, 28, 24, 0.92);
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 20px;
}

.hb-close {
  position: absolute;
  top: 18px;
  right: 18px;
  background: none;
  border: 2px solid var(--paper);
  color: var(--paper);
  border-radius: 50%;
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.hb-play-board {
  background: var(--paper-card);
  border-radius: 10px;
  padding: 24px;
  max-width: 560px;
  width: 100%;
}

.hb-play-board .hb-draw svg {
  max-height: 55vh;
}

.hb-play-text {
  font-family: var(--font-story);
  font-size: 26px;
  text-align: center;
  margin-top: 14px;
  color: var(--ink);
}

.hb-play-ctrl {
  display: flex;
  align-items: center;
  gap: 22px;
  color: var(--paper);
  font-size: 18px;
}

.hb-play-ctrl button {
  background: none;
  border: 2px solid var(--paper);
  color: var(--paper);
  border-radius: 50%;
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.hb-play-ctrl button:disabled {
  opacity: 0.3;
}
```

Add mobile responsive adjustments inside the existing `@media (max-width: 520px)` block:
```css
.hb-modal {
  padding: 14px;
  gap: 16px;
}

.hb-play-board {
  padding: 18px;
}

.hb-play-text {
  font-size: 22px;
}

.hb-close {
  top: 10px;
  right: 10px;
  width: 38px;
  height: 38px;
}
```

### Step 6: Verify
Run `npm run build` and manual visual checklist above.

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Timer fires after modal closes (stale closure) | Low | useEffect returns cleanup, `playing` gate prevents ticks when false |
| SVG animation glitches on rapid prev/next | Low | `replayKey` changes force React to remount `DrawnSvg`; CSS animation resets naturally |
| Modal CSS conflicts with existing `.hb-draw` rules | Low | `.hb-play-board .hb-draw svg` selector is more specific than `.hb-draw svg`, only overrides max-height |
| Analytics double-fire on React StrictMode | Low | The `playing` boolean gate prevents double fire (state transition from false→true is idempotent in the event) |
| Deeply nested SVG elements don't re-animate | Low | CSS classes on `key`-remounted nodes force full animation restart; same mechanism already works on the main stage |

## Rollback

To undo this task:
1. Revert `app/page.tsx` changes: remove `playing`/`playIdx` state, remove useEffect auto-advance, restore no-op `onClick={() => {}}`, remove modal JSX block
2. Revert `app/globals.css` changes: remove `.hb-modal`, `.hb-close`, `.hb-play-board`, `.hb-play-text`, `.hb-play-ctrl` blocks and their mobile overrides
3. Run `npm run build` to confirm clean revert

## Approval

Awaiting user approval to move from `planned` to `approved`.
