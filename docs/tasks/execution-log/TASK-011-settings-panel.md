# Execution Log: TASK-011 Settings Panel

## Status: Complete

## Files Changed

| File | Change |
|------|--------|
| `lib/story/types.ts` | Added `model?`, `scenePrompt?`, `narrationPrompt?`, `svgPrompt?` to `GenerateRequest` |
| `lib/ai/deepseek.ts` | Added optional `model` and `fallbackModel` params to `generateStoryFrame()`; uses `model \|\| PRIMARY_MODEL` / `fallbackModel \|\| FALLBACK_MODEL` |
| `app/api/story/generate/route.ts` | Added `validatePrompt()` helper; destructured new settings fields from POST body; validated model against known list; computed `fallbackModel` server-side; constructed dynamic system prompt from `scenePrompt`/`narrationPrompt`/`svgPrompt`; passed `primaryModel` and `fallbackModel` to `generateStoryFrame()` |
| `app/page.tsx` | Imported `SCENE_SYS`; added `getLs()` SSR-safe helper; added 4 settings states with lazy `useState` init; added `saveSettings()` helper; added `useEffect` for Escape key close; added gear icon button in `.hb-head-btns`; added settings drawer JSX (overlay + drawer with 4 fields + footer); updated `addScene()` POST body to include settings |
| `app/globals.css` | Added `.hb-settings-*` classes (overlay, drawer, header, body, label, select, textarea, input, footer); added mobile full-width rule inside existing `@media (max-width: 520px)` |

## Verification

- `npx next build`: Passed (compiled, types checked, static pages generated)
- `npx tsc --noEmit`: Passed (no errors)
- `localStorage` SSR guard: `getLs()` helper checks `typeof window === 'undefined'` before accessing localStorage

## Implementation Notes

1. **SSR guard required**: The lazy `useState` initializer runs on both server and client. Added `getLs()` helper with `typeof window === 'undefined'` check to prevent SSR crash.
2. **FallbackModel not in client request**: Computed server-side (`flash→pro`, `pro→flash`), never accepted from client per security rule.
3. **Prompt validation**: Server-side `validatePrompt()` checks `typeof === 'string'`, trims, and enforces length caps (scenePrompt: 4000, narrationPrompt: 1000, svgPrompt: 1000). Invalid values normalize to `null`.
4. **Model validation**: Server validates against `['deepseek-v4-flash', 'deepseek-v4-pro']`; unknown values default to `deepseek-v4-flash` primary, `deepseek-v4-pro` fallback.
5. **System prompt construction**: Uses `scenePrompt` if valid, else falls back to `SCENE_SYS`. Appends `narrationPrompt` and `svgPrompt` when non-null.
6. **Settings persist immediately**: `saveSettings()` writes all 4 keys to localStorage on each change.
7. **Drawer close**: X button, backdrop click, Escape key, or "完成" button.

## Acceptance Criteria Coverage

| AC | Description | Status |
|----|-------------|--------|
| 1 | Gear button in header | Done |
| 2 | Drawer opens/closes (X, backdrop, Escape) | Done |
| 3 | Model dropdown with flash/pro, persisted | Done |
| 4 | Scene prompt textarea, pre-filled with SCENE_SYS | Done |
| 5 | Narration rules input, empty default | Done |
| 6 | SVG rules input, empty default | Done |
| 7 | "恢复默认" resets all 4 fields | Done |
| 8 | Settings sent in POST body | Done |
| 9 | Server uses custom settings with validation | Done |
| 10 | API key stays server-only | Done (no client changes) |
| 11 | Settings survive page refresh | Done (localStorage) |
| 12 | Mobile responsive (full-width drawer) | Done |
| 13 | Build passes | Done |
| 14 | No new lint warnings | Done |
| 15 | Server validates prompts (type, trim, length caps) | Done |
| 16 | No hydration race (lazy useState init) | Done |

## Deviations

- Added SSR guard (`getLs()`) for `localStorage` access in `useState` initializer — required because Next.js prerenders pages on the server where `localStorage` is not available.
