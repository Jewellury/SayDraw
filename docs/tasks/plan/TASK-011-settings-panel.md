# TASK-011: Settings Panel

Owner Flow: plan-agent -> execute-agent -> audit-agent
Lifecycle: tracked in `docs/tasks/active_spec.md` and `docs/tasks/progress.md`

## Background

Users currently have no control over the AI model or prompt instructions. The model is hardcoded server-side (`deepseek-v4-flash`); the system prompt is a fixed constant in `lib/ai/prompts.ts`. Parents may want to swap models or tweak the drawing style. This task adds a frontend settings panel (drawer) that lets the user configure model selection and prompt rules, persisted in `localStorage` and sent to the API via POST body. The API key remains server-side only.

## Goal

Add a settings panel (overlay drawer from right) reachable via a gear icon in the header. The panel exposes 4 independent, editable fields. Values persist in `localStorage` and are sent to `/api/story/generate` with each request. The server route reads them and uses them to override defaults.

### Configuration items

| Item | UI control | localStorage key | Default value source |
|------|-----------|------------------|---------------------|
| Model | `<select>` dropdown (flash / pro) | `saydraw_model` | `"deepseek-v4-flash"` |
| Scene prompt | Large `<textarea>` | `saydraw_scene_prompt` | `SCENE_SYS` from `lib/ai/prompts.ts` |
| Narration rules | `<input type="text">` or small `<textarea>` | `saydraw_narration_prompt` | `""` (empty = no extra narration rules) |
| SVG spec rules | `<input type="text">` or small `<textarea>` | `saydraw_svg_prompt` | `""` (empty = no extra SVG rules) |

**Defaults behavior**: If a field is empty/not set in localStorage, the client sends `null`/omitted. The server route uses the hardcoded `SCENE_SYS` default when `scenePrompt` is empty, and skips appending narration/svg prompts when empty.

## Non-goals

- No user accounts or server-side settings storage
- No prompt template versioning
- No model list beyond the two DeepSeek options (flash / pro)
- No export/import of settings
- No settings for voice input or playback behavior
- No new npm dependencies

## Design Source

- `docs/00_design/frontend_design_spec.md` — design tokens (`--paper`, `--ink`, `--accent`, `--paper-card`, fonts)
- `docs/00_design/高保真静态图.jpg` / `docs/00_design/HuaHuaBen.jsx` — hi-fi proxy for overall aesthetic
- Existing `app/globals.css` — consistent with `.hb-*` class naming convention

Settings panel aesthetic: follow the same warm paper/ink/storybook style. Drawer slides in from the right with a semi-transparent backdrop. Form elements use the same `--paper-card` background, `--ink` borders, `Ma Shan Zheng` / `ZCOOL KuaiLe` / `Noto Serif SC` fonts.

## Files In Scope

| File | Change |
|------|--------|
| `lib/story/types.ts` | Extend `GenerateRequest` with optional `model`, `scenePrompt`, `narrationPrompt`, `svgPrompt` fields |
| `lib/ai/deepseek.ts` | Accept optional `model` and `fallbackModel` params in `generateStoryFrame()` instead of hardcoding env vars |
| `app/api/story/generate/route.ts` | Read `model`, `scenePrompt`, `narrationPrompt`, `svgPrompt` from POST body; construct system prompt dynamically; pass model to `generateStoryFrame()` |
| `app/page.tsx` | Add settings state (open/closed + 4 config fields); load from localStorage on mount; render gear button in header; render settings drawer; send configs in POST body |
| `app/globals.css` | Add `.hb-settings-*` classes for overlay, drawer, form fields, responsive breakpoints |

## Forbidden Changes

- No client-side exposure of `DEEPSEEK_API_KEY`
- No server-side storage of settings
- No new npm dependencies (`package.json` unchanged)
- No changes to `docs/00_design/` or `docs/_archive/`
- No changes to `lib/ai/prompts.ts` (defaults stay hardcoded)
- No PNG pipeline, no color SVGs, no accounts, no database
- No changes to `next.config.js` or any build/config file

## Acceptance Criteria

1. **Gear button exists** in header (`.hb-head-btns`), sits alongside "播放故事" and reset buttons
2. **Settings drawer opens** from right side on click, with semi-transparent backdrop overlay; closes on X button, backdrop click, or Escape key
3. **Model dropdown** shows `deepseek-v4-flash` (default) and `deepseek-v4-pro`; selection persists in localStorage
4. **Scene prompt textarea** is pre-filled with the current default `SCENE_SYS` value from `lib/ai/prompts.ts`; editable; persists in localStorage
5. **Narration rules input** is a text field; empty by default; editable; persists in localStorage
6. **SVG spec rules input** is a text field; empty by default; editable; persists in localStorage
7. **"恢复默认" button** resets all 4 fields to their hardcoded defaults (`deepseek-v4-flash`, `SCENE_SYS`, `""`, `""`)
8. **Settings are sent in POST body** to `/api/story/generate` on every generate call (`model`, `scenePrompt`, `narrationPrompt`, `svgPrompt`)
9. **Server uses custom settings**: if `scenePrompt` is provided and non-empty (after validation: type check, trim, ≤4000 chars), it replaces `SCENE_SYS`; `narrationPrompt`/`svgPrompt` are appended to the system prompt when non-empty (after validation: type check, trim, ≤1000 chars each); `model` overrides server default; `fallbackModel` is computed server-side (flash→pro, pro→flash)
10. **API key stays server-only**: `DEEPSEEK_API_KEY` is never sent to or read from the client
11. **Settings survive page refresh** (localStorage)
12. **Mobile responsive**: drawer is full-width on mobile, fixed-width (~400px) on desktop
13. **Build passes**: `npx next build` (or equivalent) with no type errors
14. **No new lint warnings**
15. **Server validates prompts**: non-string, empty, or over-length prompt fields (`scenePrompt` >4000, `narrationPrompt` >1000, `svgPrompt` >1000) are normalized to `null` and replaced with server hardcoded defaults
16. **No hydration race**: settings from localStorage are loaded via lazy `useState` initializer (not `useEffect`), so `addScene()` always reads current saved state, even if the user taps "go" immediately on mount

### Screenshot Evidence (required for visual tasks)

- Desktop (1440x900): header with gear button visible; settings drawer open showing all 4 fields
- Tablet (834x1112): settings drawer open
- Mobile (390x844): settings drawer open (full-width)
- Save to `docs/tasks/artifacts/TASK-011-settings-panel/`

## Implementation Strategy

### 1. Extend types (`lib/story/types.ts`)
Add optional fields to `GenerateRequest`:
```ts
model?: string;
fallbackModel?: string;
scenePrompt?: string;
narrationPrompt?: string;
svgPrompt?: string;
```

### 2. Extend DeepSeek helper (`lib/ai/deepseek.ts`)
Change `generateStoryFrame` signature to accept optional model overrides:
```ts
export async function generateStoryFrame(
  systemPrompt: string,
  userMessage: string,
  model?: string,
  fallbackModel?: string
): Promise<string>
```
Use `model || PRIMARY_MODEL` and `fallbackModel || FALLBACK_MODEL` internally. Backward-compatible — existing callers without model params still work.

### 3. Update API route (`app/api/story/generate/route.ts`)
- Destructure `model`, `scenePrompt`, `narrationPrompt`, `svgPrompt` from request body
- **Validate and sanitize prompts:**
  - Check `typeof === 'string'` for all 3 prompt fields; `.trim()` each
  - `scenePrompt` max 4000 chars, `narrationPrompt` max 1000 chars, `svgPrompt` max 1000 chars
  - Empty, non-string, or over-limit → normalize to `null`
- Construct system prompt:
  ```
  scenePrompt (or SCENE_SYS if null/empty) + "\n" + narrationPrompt (if non-null and non-empty) + "\n" + svgPrompt (if non-null and non-empty)
  ```
- **Compute model fallback (server-side, never from client):**
  - Validate `model` against known list `["deepseek-v4-flash", "deepseek-v4-pro"]`; unknown values resolve to defaults
  - If `model === "deepseek-v4-pro"` → `fallbackModel = "deepseek-v4-flash"`
  - If `model === "deepseek-v4-flash"` or missing → `fallbackModel = "deepseek-v4-pro"`
  - Defaults when no model sent: primary = `deepseek-v4-flash`, fallback = `deepseek-v4-pro`
- Pass both `model` and `fallbackModel` to `generateStoryFrame()`

### 4. Add settings panel UI (`app/page.tsx`)

**State (lazy initialization — reads localStorage synchronously during first render, eliminating hydration race):**
```ts
const [settingsOpen, setSettingsOpen] = useState(false);
const [settingsModel, setSettingsModel] = useState(() => localStorage.getItem('saydraw_model') || 'deepseek-v4-flash');
const [settingsScenePrompt, setSettingsScenePrompt] = useState(() => localStorage.getItem('saydraw_scene_prompt') || SCENE_SYS);
const [settingsNarrationPrompt, setSettingsNarrationPrompt] = useState(() => localStorage.getItem('saydraw_narration_prompt') || '');
const [settingsSvgPrompt, setSettingsSvgPrompt] = useState(() => localStorage.getItem('saydraw_svg_prompt') || '');
```

**Why lazy `useState` instead of `useEffect`:** The `useEffect` approach risked `addScene()` firing before hydration completed — if the user tapped "go" immediately on mount, the POST body would contain defaults instead of saved user settings. Lazy `useState` reads localStorage during the first synchronous render, so the state is correct before any user interaction. No `hydrated` flag or generate-button blocking needed.

**localStorage save on change:**
Write a helper `saveSettings()` called whenever any setting changes and on save/close.

**API call update in `addScene()`:**
Add to POST body:
```ts
body: JSON.stringify({
  storySoFar: storyText(),
  newLine: myLine,
  speaker: mySpeaker,
  model: settingsModel,
  scenePrompt: settingsScenePrompt,
  narrationPrompt: settingsNarrationPrompt,
  svgPrompt: settingsSvgPrompt,
})
```

**Header button:** Gear icon SVG button in `.hb-head-btns`, before existing buttons.

**Drawer UI structure:**
```html
<div className="hb-settings-overlay" onClick={close}>
  <div className="hb-settings-drawer" onClick={e => e.stopPropagation()}>
    <header>设置 / X close button</header>
    <div className="hb-settings-body">
      <label>模型选择 → <select></label>
      <label>画面提示词 → <textarea rows={8}></label>
      <label>旁白规则 → <input></label>
      <label>SVG规则 → <input></label>
    </div>
    <footer>
      <button>恢复默认</button>
      <button>完成</button>
    </footer>
  </div>
</div>
```

### 5. Add styles (`app/globals.css`)

Classes to add:
- `.hb-settings-overlay` — fixed inset backdrop, z-index 60, bg ink-soft + blur
- `.hb-settings-drawer` — fixed right, top 0, bottom 0, width 400px (100% on mobile), paper-card bg, ink border-left, shadow
- `.hb-settings-header` — flex row, title + close button, border-bottom
- `.hb-settings-body` — padded scroll area, label + input pairs
- `.hb-settings-label` — font-family Ma Shan Zheng, ink-soft
- `.hb-settings-select`, `.hb-settings-textarea`, `.hb-settings-input` — styled form controls matching warm paper aesthetic
- `.hb-settings-footer` — flex row, two buttons (ghost for reset, filled for done)
- `.hb-settings-gear` — icon-only ghost button in header
- Responsive: `@media (max-width: 520px)` → drawer full-width, tighter padding

Follow existing `.hb-*` class naming, design tokens, and typography conventions.

## Risks

| Risk | Mitigation |
|------|-----------|
| User-entered prompts break the AI output format (e.g. SCENE_SYS replaced with bad instructions → no SVG returned) | Server-side fallback: if AI response fails, falls through to mock as it does today. User can always reset to defaults. **Added:** server-side prompt validation (type check, trim, length caps) before prompt construction. |
| localStorage grows large with long prompt text | Prompts are text, well under localStorage limits (~5-10MB). Not a real risk for MVP. Server-side length caps (scenePrompt 4000, narrationPrompt 1000, svgPrompt 1000) also bound storage. |
| Model name sent from client could be injected | Server validates model against known list `["deepseek-v4-flash", "deepseek-v4-pro"]`. Unknown values default. **Added:** fallbackModel is computed server-side from the validated model, never accepted from the client. |
| Settings drawer on mobile covers the entire screen, confusing users | Keep design familiar — close button always visible, tap backdrop to close, title bar prominent. |
| Hydration race: `addScene()` fires before localStorage settings load (useEffect), sending defaults instead of saved user settings | Use lazy `useState` initializer — reads localStorage synchronously during first render. No `hydrated` flag or generate-button blocking needed. |

## Rollback

- Settings panel is purely additive UI. Removing it means deleting the settings JSX from `page.tsx`, the CSS classes from `globals.css`, and reverting the 3 optional fields from the POST body.
- Server route changes are backward-compatible: all new fields are optional with sensible defaults. Old clients (without settings) continue to work.
- `generateStoryFrame()` new parameters are optional — old call signature still works.
- To fully revert: delete settings panel JSX/CSS, remove optional fields from `GenerateRequest`, revert `generateStoryFrame` signature, remove model/settings destructuring from route. No data migration needed.

## Approval
