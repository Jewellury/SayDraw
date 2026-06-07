# TASK-015 — Execution Log

## Summary

Added zh/en language toggle to `app/page.tsx`. Every hardcoded user-facing string is now a `STRINGS[lang].*` lookup. A toggle button (`EN`/`中`) sits as the leftmost child of `.hb-head-btns`. `SpeechRecognition.lang` follows the active UI language. Language preference persists in `localStorage['saydraw_lang']`, first-visit default derives from `navigator.language`. Two new `useEffect` hooks handle post-mount lang init and `<html lang>` sync.

## Files Changed

- `app/page.tsx` (only file modified)

## Implementation Details

### Top-of-file additions (after SEED_SCENE, before defaultState)

- `STRINGS` const — zh/en objects with all 30 keys (26 string values + 2 function formatters per language)
- `SEED_SCENE_EN` — English translation of the seed scene (same SVG, different `text`)
- `getSeedScene(lang)` — returns the correct seed scene for the active language
- `resolveInitialLang()` — SSR-safe lang detection with localStorage allowlist validation
- `REC_LANG` — maps `'zh'` → `'zh-CN'`, `'en'` → `'en-US'` for SpeechRecognition

### State & effects

- Added `lang` state: `useState<'zh' | 'en'>('zh')` (SSR-safe default)
- Post-mount effect: calls `resolveInitialLang()`, sets lang, and replaces seed scene if user is on English with a fresh story
- `<html lang>` sync effect: sets `document.documentElement.lang` to `'zh-CN'` or `'en'`

### toggleLang()

- Stops voice if listening, nulls `recRef`, flips lang, writes to localStorage (try/catch for Safari private mode)

### startVoice()

- Changed `rec.lang = 'zh-CN'` → `rec.lang = REC_LANG[lang]`

### storyText()

- Uses `STRINGS[lang].dadApiLabel` / `STRINGS[lang].kidApiLabel` with `': '` separator
- Added `lang` to useCallback dependency array

### JSX string replacements

All ~20+ hardcoded Chinese strings replaced with `STRINGS[lang].*` lookups:
- Logo title, tagline
- Settings icon aria-label, settings panel header/close/label/hint/placeholder/done/reset buttons
- Play button visible text + aria-label
- Reset button title + aria-label
- Dad/kid speaker chip aria-labels + titles
- Hint button aria-label + title
- Send button aria-label + title (idle + loading branches)
- Page counter (`pageCount` formatter)
- Playback modal: close aria, prev aria, next aria, counter (`playCount` formatter)
- Mic aria-label (idle + listening)
- Input placeholder (3 branches: listening, kid, dad)
- Error toast, voice unsupported message

## 4 Dead Keys

Skipped (not in STRINGS): `dadLabel`, `kidLabel`, `nextHint`, `drawBtnLoading`. These were already removed from the rendered output by TASK-014C iconization.

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS — zero errors |
| `npm.cmd run build` | PASS — compiled successfully, all pages generated |
| `git diff --stat` | N/A — no existing commits in repo; only `app/page.tsx` was modified |

## Deviations from Plan

1. **Voice language follows UI toggle** (2026-06-07). The plan originally specified `rec.lang` follows the UI lang. It was temporarily decoupled to `navigator.language` per user feedback, but this broke English voice input on Chinese browsers (zh-CN recognizer cannot transcribe English speech). Reverted: `rec.lang = lang === 'zh' ? 'zh-CN' : 'en-US'` inline in `startVoice()`. No separate function or constant needed.

2. **Toggle button changed from text to globe icon** (2026-06-07). The plan specified a text-based toggle (`EN`/`中`). Per user feedback the text was ambiguous (showing the target language while the page was in the current language). Replaced with a stroke-based globe SVG icon matching the existing header icon style. `aria-label` and `title` remain unchanged and provide clear tooltip guidance.

## Notes

- The `STRINGS.zh` object contains the original Chinese strings; `STRINGS.en` contains the English translations.
- The `pageCount` and `playCount` keys are function formatters (`(cur, total) => string`) to handle dynamic numeric content.
- `resolveInitialLang()` validates localStorage values against an allowlist (`'zh'` | `'en'`), falling back to `navigator.language` detection.
- `toggleLang()` wraps localStorage writes in try/catch for browsers that block storage (Safari private mode).
- The seed scene replacement (`setScenes` updater in the lang init effect) only fires when the story is still just the seed (length 1, id matches), so returning users with saved stories keep their data.
