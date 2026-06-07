# TASK-015: Add zh/en Language Toggle (UI + SpeechRecognition)

Owner Flow: plan-agent -> execute-agent -> audit-agent
Lifecycle: tracked in `docs/tasks/active_spec.md` and `docs/tasks/progress.md`

## Background

`app/page.tsx` (single client component) currently hard-codes Chinese text in ~20+ places: logo title, speaker chip labels, send button, hint button, page counter, input placeholder, error message, playback modal, settings panel, mic aria-labels, and the API input `storyText()` line. There is no language preference state. `SpeechRecognition.lang` is hard-coded to `'zh-CN'` (`app/page.tsx:274`).

This task adds a lightweight in-component `zh` / `en` switch without introducing any i18n library, and links `SpeechRecognition.lang` to the active UI language so voice input works in the chosen language. The toggle button lives in the existing top-right chrome row.

The user has drafted the shape (see the prompt that produced this plan). This plan preserves the user's intent and fills the gaps the user listed: missing string keys, hydration safety, invalid-localStorage handling, `<html lang>` sync, seed scene localization, stale SpeechRecognition cleanup, toggle placement, and a tighter `STRINGS` object.

## Goal

- Page supports a `zh` / `en` toggle; every user-facing string follows the active language.
- `SpeechRecognition.lang` is set to `'zh-CN'` for `zh` and `'en-US'` for `en`. New instances pick up the new language on the next `startVoice()`.
- No new npm dependencies, no API route change, no `globals.css` change, no new files.
- Lang preference persists in `localStorage['saydraw_lang']`. First-visit default derives from `navigator.language` (`zh*` → `zh`, else → `en`).
- `<html lang>` attribute reflects the active language (cheap a11y / browser translation hint).
- English-localized seed scene is added; `getSeedScene(lang)` returns the right initial frame on first load (after hydration completes the real value).

## Non-goals

- A third language, locale-aware pluralization beyond `cur / total` counts, or RTL support.
- `react-i18next` / `next-intl` / any i18n library, custom build tooling, or a new file under `lib/`.
- Any change to `app/globals.css`, `app/api/**`, `lib/svg/sanitizeSvg.ts`, `lib/story/**`, or `lib/analytics/**`.
- Any change to API contracts: the request body, the response shape, the seed SVG string, the route paths, or the DeepSeek prompt body.
- Auto-detect speech language independently of UI lang (a single explicit toggle is the MVP contract).
- Adding a new reserved analytics event name. Existing events keep their current payloads.
- Adding `lang` as a field on existing `track()` payloads. Out of scope for MVP; deferred (see Risks).
- Refactoring `app/page.tsx` into multiple files or extracting `STRINGS` to its own file. Single-file change only.

## Design Source

- `docs/00_design/frontend_design_spec.md` §6 — "文字尽量少，能用图标 + 声音就别用字" (we keep all existing copy; this task only translates it).
- `app/page.tsx` — full file (the only file in scope). All line numbers in this plan refer to the current file.
- `AGENTS.md` — sacred rules: B&W SVG, voice-first, no accounts, no i18n libs (no `react-i18n`, no `next-intl`), no PNG main pipeline.
- `lib/analytics/events.ts` — current reserved event list; do not modify.
- `lib/analytics/track.ts` — accepts a free-form `Record<string, unknown>` payload; do not modify.

## Files In Scope

| File | Change |
|------|--------|
| `app/page.tsx` | Add `STRINGS` const, `SEED_SCENE_EN`, `getSeedScene(lang)`, `resolveInitialLang()`. Add `lang` state, two `useEffect`s (init lang, sync `<html lang>`), `toggleLang()`. Update `startVoice()` to set `rec.lang` from `lang`. Update `storyText()` to use API labels. Replace ~20 hard-coded strings with `STRINGS[lang].*` lookups. Add the toggle button as the leftmost child of `.hb-head-btns`. Update `defaultState()` to call `getSeedScene(lang)` (with `'zh'` SSR default — see Hydration section). |

No other files. No CSS. No `package.json`. No API route. No `lib/` change. No new file.

## Forbidden Changes

- Do not touch `app/globals.css`, `package.json`, `package-lock.json`, or `tsconfig.json`.
- Do not touch any file under `app/api/`, `lib/`, `docs/00_design/`, `docs/_archive/`, or `docs/tasks/`.
- Do not modify `lib/analytics/events.ts` (no new event name) or `lib/analytics/track.ts`.
- Do not change any existing icon SVG (mic, settings, play, reset, send-spinner, etc.) — only the surrounding copy is translated.
- Do not add a new icon, a new CSS class, a new env var, or a new `next/font` import.
- Do not add `react-i18n`, `next-intl`, `i18next`, or any i18n-related dependency.
- Do not refactor `app/page.tsx` into multiple files.
- Do not change the existing mic press-and-hold gesture, the existing speaker toggle chips, the existing settings panel layout, the existing playback modal layout, or the existing reset-button behavior.
- Do not add a `lang` field to existing `track()` payloads.
- Do not introduce any new i18n-related localStorage key other than `saydraw_lang`.

## Design Decisions

### 1. STRINGS object — full key list

The final key set has **30 entries**, evolved across three phases. The user's original draft seeded a baseline set covering the most prominent user-facing strings. This plan added the keys needed to cover every remaining hard-coded Chinese string in `app/page.tsx` (closing the original gap), to separate the API input label from the UI label so the two can diverge if needed, and to drop the unused `drawingPromptLabel` since the field it would label is hidden. TASK-014C's iconization of the dad chip, kid chip, hint button, and send button then required a final round of adjustments: four of the previously active keys became dead (the visible button text they labeled no longer renders anywhere in the file), and four new aria/title keys were added to label the icon-only buttons. The page counter keeps its existing string format; the playback counter uses a separate key because its numeric format `${cur} / ${total}` works for both languages.

Final keys (zh + en values are below):

| Key | Source line | Used for | Note |
|-----|-------------|----------|------|
| `appTitle` | 381 | Logo H1 | NEW — was `画话本` |
| `tagline` | 382 | Logo subtitle | KEEP — same string as the user's draft (`你说一句 · 宝宝说一句 · 画板画一幅`) |
| `drawBtn` | 667 | Send button idle `aria-label` + `title` | KEEP — `画出来` (idle branch of `loading ? … : '画出来'`; line shifted from 605 after TASK-014C iconized the button) |
| `dadSwitchLabel` | 515 | Dad chip `aria-label` + `title` | NEW — added after TASK-014C iconization. Was `切换为爸爸说话`. The 4 chip/hint/send icons are aria/title-only, no visible text. |
| `kidSwitchLabel` | 553 | Kid chip `aria-label` + `title` | NEW — added after TASK-014C iconization. Was `切换为宝宝说话`. |
| `nextHintAria` | 591 | Hint button `aria-label` + `title` | NEW — added after TASK-014C iconization. Was `接下来呢？给点灵感`. NOTE: differs from the (now-dead) `nextHint` key `'接下来呢？'`. |
| `drawBtnLoadingAria` | 667 | Send button loading `aria-label` + `title` | NEW — added after TASK-014C iconization. Was `画板正在沙沙画……` (loading branch of the same conditional). Replaces the (now-dead) `drawBtnLoading` key `'绘画中'`. |
| `dadPlaceholder` | 646 | Input placeholder for dad | KEEP — `爸爸说……` |
| `kidPlaceholder` | 645 | Input placeholder for kid | KEEP — `宝宝说……（或者点麦克风）` |
| `listeningHint` | 643 | Input placeholder while listening | KEEP — `说吧，松手就出来……` |
| `pageCount` | 468 | Stage page counter | KEEP — `第 ${cur} / ${total} 格` |
| `playCount` | 760 | Playback modal counter | NEW — separate key; numeric format `${cur} / ${total}` works for both |
| `errorMsg` | 252 | Error toast | KEEP — `画板打了个小盹，再说一次试试` (the user's draft had `✏️` appended; we drop the emoji to match the current code and the line-art aesthetic — see Open Question Q1) |
| `voiceUnsupportedMsg` | 266 | Browser-missing SR error | NEW — was `这个浏览器还不支持语音，用打字也可以哦` |
| `micLabelIdle` | 615 | Mic aria/title idle | NEW — was `长按录音` |
| `micLabelListening` | 615 | Mic aria/title listening | NEW — was `松开结束录音` |
| `playBtn` | 414 | Play button visible text | KEEP — `播放故事` |
| `playCloseLabel` | 714 | Playback modal close aria | NEW — was `关闭播放` |
| `playPrevLabel` | 745 | Playback prev aria | NEW — was `上一格` |
| `playNextLabel` | 764 | Playback next aria | NEW — was `下一格` |
| `resetTooltip` | 425-426 | Reset button title + aria | NEW — was `从开头重来` |
| `settingsTitle` | 386, 787 | Settings icon aria + panel header | KEEP — `设置` (reused for the icon's aria-label — same value, no new key) |
| `settingsDone` | 826 | Settings "Done" button | KEEP — `完成` |
| `settingsReset` | 823 | Settings "Reset" button | KEEP — `恢复默认` |
| `settingsCloseLabel` | 790 | Settings close aria | NEW — was `关闭设置` |
| `settingsTextPromptLabel` | 800 | Settings textarea label | NEW — was `故事提示词（DeepSeek Flash）` |
| `settingsTextPromptHint` | 801 | Settings textarea hint | NEW — was `额外的旁白和故事规则，追加到默认提示词末尾` |
| `settingsTextPromptPlaceholder` | 810 | Settings textarea placeholder | NEW — was `例：旁白要活泼一点，多用拟声词……` |
| `dadApiLabel` | 176 | `storyText()` API input label | NEW — was `'爸爸'` (note: API label omits `说`) |
| `kidApiLabel` | 176 | `storyText()` API input label | NEW — was `'宝宝'` (note: API label omits `说`) |

The following 4 keys are now DEAD and must be dropped from `STRINGS` (zh + en):

- `dadLabel: '爸爸说' / 'Dad'` — was visible chip text on `.hb-chip`. The chip is now icon-only; the literal `爸爸说` no longer appears anywhere in `app/page.tsx` (only `爸爸说……` in the dad input placeholder, which is a different string covered by `dadPlaceholder`).
- `kidLabel: '宝宝说' / 'Kid'` — same as above.
- `nextHint: '接下来呢？' / "What's next?"` — was visible spark text. The literal `接下来呢？` no longer appears in `app/page.tsx`; the new aria is `接下来呢？给点灵感`, which is a different string covered by `nextHintAria`.
- `drawBtnLoading: '绘画中' / 'Drawing…'` — was visible loading text. The literal `绘画中` no longer appears in `app/page.tsx`; the new loading aria is `画板正在沙沙画……`, covered by `drawBtnLoadingAria`.

`drawingPromptLabel` (in the user's draft) is **dropped** (gap #7). The settings field is hidden per the existing comment on line 715; the localStorage key `saydraw_drawing_prompt` stays.

### 2. English values

The `en` object is a faithful translation that preserves the warmth and brevity of the Chinese original. The brand name is preserved as `HuaHuaBen` (see Open Question Q2).

```ts
en: {
  appTitle: 'HuaHuaBen',
  tagline: 'You say a line · Your kid says a line · The board draws one',
  dadSwitchLabel: "Switch to dad's voice",
  kidSwitchLabel: "Switch to kid's voice",
  nextHintAria: "What's next? Get a hint",
  drawBtn: 'Draw',
  drawBtnLoadingAria: 'The board is drawing…',
  dadPlaceholder: "Dad says… (or tap the mic)",
  kidPlaceholder: "Kid says… (or tap the mic)",
  listeningHint: 'Speak, then release',
  pageCount: (cur, total) => `Frame ${cur} of ${total}`,
  playCount: (cur, total) => `${cur} / ${total}`,
  errorMsg: 'The board took a quick nap, try again',
  voiceUnsupportedMsg: "This browser doesn't support voice. Typing works too.",
  micLabelIdle: 'Press and hold to record',
  micLabelListening: 'Release to stop recording',
  playBtn: 'Play story',
  playCloseLabel: 'Close player',
  playPrevLabel: 'Previous frame',
  playNextLabel: 'Next frame',
  resetTooltip: 'Restart from the beginning',
  settingsTitle: 'Settings',
  settingsDone: 'Done',
  settingsReset: 'Restore defaults',
  settingsCloseLabel: 'Close settings',
  settingsTextPromptLabel: 'Story prompt (DeepSeek Flash)',
  settingsTextPromptHint: 'Extra narration and story rules, appended to the default prompt',
  settingsTextPromptPlaceholder: 'e.g. narration should be lively, use more onomatopoeia…',
  dadApiLabel: 'Dad',
  kidApiLabel: 'Kid',
}
```

### 3. SpeechRecognition language mapping

```ts
const REC_LANG: Record<'zh' | 'en', string> = { zh: 'zh-CN', en: 'en-US' };
```

`startVoice()` sets `rec.lang = REC_LANG[lang]`. The lang source is the React `lang` state at the moment the user presses the mic.

### 4. Hydration safety (CRITICAL)

The page is `'use client'` and Next.js still SSRs it once. `navigator` and `localStorage` are browser-only. The implementation must follow this pattern:

- `useState<'zh' | 'en'>('zh')` — server-safe default. Server and first client render agree, so React's hydration check passes.
- `useEffect(() => { setLang(resolveInitialLang()); }, [])` — runs after mount, updates the state to the real value.
- **Known trade-off:** a user on an `en` browser will see a brief flash of Chinese copy on the very first load (the time between hydration and the `useEffect` tick). This is acceptable for MVP. No skeleton / loading screen is required. Plan documents the trade-off; audit does not fail on it.

`resolveInitialLang()` is defined at module scope:

```ts
function resolveInitialLang(): 'zh' | 'en' {
  if (typeof window === 'undefined') return 'zh';
  const stored = localStorage.getItem('saydraw_lang');
  if (stored === 'zh' || stored === 'en') return stored;
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}
```

It validates `localStorage` against the allowlist (gap #5). Invalid values (`'fr'`, `null`, `''`) fall through to navigator detection.

`defaultState()` cannot call `resolveInitialLang()` because it must be SSR-safe. It keeps returning the current Chinese seed. The first paint is therefore `SEED_SCENE_ZH` for every user; the second paint (after the post-mount effect runs) shows the right seed for the user's language. This is part of the same hydration trade-off.

To localize the seed:

```ts
const SEED_SCENE_EN: Scene = {
  id: 1,
  speaker: 'dad',
  text: 'A meteor fell from the moon and bonked a little dinosaur on the head — ROAR! The little dinosaur fainted.',
  svg: SEED_SVG,
};

function getSeedScene(lang: 'zh' | 'en'): Scene {
  return lang === 'en' ? SEED_SCENE_EN : SEED_SCENE;
}
```

The English seed is a faithful translation of the existing Chinese seed (line 84: `陨石从月球上掉下来，砸到小恐龙，嗷呜——小恐龙晕了。`). The SVG string is identical (no translation needed in line art).

### 5. `<html lang>` sync

```ts
useEffect(() => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }
}, [lang]);
```

Cheap a11y win (gap #6). Browser translation hints and screen-reader pronunciation both benefit. The static `<html lang="en">` in `app/layout.tsx` (default Next.js) is overridden by this effect after mount. We do not add a `metadata` export or a server-rendered dynamic attribute — that would require a server component or middleware, both out of scope.

### 6. SpeechRecognition cleanup on lang change

When the user toggles language:

- If `listening === true`: call `stopVoice()` (which calls `recRef.current?.stop()` then `setListening(false)`). The browser fires `onend`, which also sets `setListening(false)`.
- Set `recRef.current = null` so the next `startVoice()` always allocates a fresh `SpeechRecognition` instance with the new `rec.lang`. This avoids stale callbacks firing on a now-defunct instance after a quick toggle (gap #8).
- The `committed` flag in `startVoice()` is closure-scoped, so a fresh instance rebuilds a fresh flag naturally. No extra work needed.

The toggle handler:

```ts
function toggleLang() {
  if (listening) stopVoice();
  recRef.current = null;
  const next = lang === 'zh' ? 'en' : 'zh';
  setLang(next);
  if (typeof window !== 'undefined') {
    localStorage.setItem('saydraw_lang', next);
  }
}
```

### 7. Toggle button placement and label

The toggle is the **leftmost** child of `.hb-head-btns` (`app/page.tsx:385`). It reuses the existing `hb-ghost` class — no new CSS, no new icon, no new style. Visible text is the *other* language's compact label: `EN` when the current lang is `zh`, `中` when the current lang is `en`.

Per the user's gap list (gap #10), the visible label is compact (no width jump), but the `aria-label` is explicit:

```tsx
<button
  className="hb-ghost"
  onClick={toggleLang}
  aria-label={lang === 'zh' ? 'Switch to English' : '切换到中文'}
  title={lang === 'zh' ? 'Switch to English' : '切换到中文'}
>
  {lang === 'zh' ? 'EN' : '中'}
</button>
```

The settings icon button moves one slot to the right; no other button is touched.

### 8. Story input labels (storyText)

`storyText()` currently uses `'爸爸' / '宝宝'` (no `说`) as the label in front of each line. These are sent to the API as story context. The plan adds `dadApiLabel` / `kidApiLabel` keys so the label can differ from the UI label if needed. In this MVP they happen to match (`Dad` / `Kid`).

```ts
const storyText = useCallback(
  () =>
    scenes
      .map((s) => {
        const label = s.speaker === 'dad' ? STRINGS[lang].dadApiLabel : STRINGS[lang].kidApiLabel;
        return label + ': ' + (s.summary || s.text);
      })
      .join('\n'),
  [scenes, lang]
);
```

The Chinese version uses `：` (full-width colon) and the English version uses `:` (ASCII colon) — preserved per-language.

### 9. Analytics: no payload change

Per gap #11, do not pass `lang` to existing events for MVP. The plan defers this; the user's draft did not ask for it. The reserved event list in `lib/analytics/events.ts` is not modified.

## Implementation Strategy

### `app/page.tsx` — top-of-file additions (after `SEED_SCENE`, before `defaultState`)

1. Insert `STRINGS` const (zh + en objects as above).
2. Insert `SEED_SCENE_EN` and `getSeedScene(lang)` helper.
3. Insert `resolveInitialLang()` helper.
4. Insert `REC_LANG` mapping.

### `app/page.tsx` — `defaultState()` (line 88)

Change the body to return the current Chinese seed (no change in observable behavior on the server):

```ts
function defaultState(): StoryState {
  return { scenes: [SEED_SCENE], current: 0, speaker: 'kid' };
}
```

(unchanged — keeping the Chinese seed as the SSR default is part of the hydration trade-off).

### `app/page.tsx` — `Page` component (line 147)

5. Add `const [lang, setLang] = useState<'zh' | 'en'>('zh');` alongside the other `useState` calls.
6. Add a post-mount effect that calls `setLang(resolveInitialLang())` and replaces the existing scenes with the localized seed if the user is on English and the story is still the Chinese seed:

```ts
useEffect(() => {
  const initial = resolveInitialLang();
  setLang(initial);
  if (initial === 'en') {
    setScenes((prev) =>
      prev.length === 1 && prev[0].id === SEED_SCENE.id ? [getSeedScene('en')] : prev
    );
  }
}, []);
```

The `prev[0].id === SEED_SCENE.id` check ensures the localization only runs for users who have not yet started a real story (the seed is the only scene). Users with saved stories keep their saved data.

7. Add a second effect to keep `<html lang>` in sync (Design Decision 5).
8. Add `toggleLang()` function (Design Decision 6).
9. Replace the hard-coded `rec.lang = 'zh-CN'` in `startVoice()` (line 274) with `rec.lang = REC_LANG[lang];`.
10. Update `storyText()` to use `STRINGS[lang].dadApiLabel` / `STRINGS[lang].kidApiLabel` (Design Decision 8).
11. Insert the toggle button as the first child of `.hb-head-btns` (Design Decision 7).
12. Replace every hard-coded user-facing string in the JSX with the corresponding `STRINGS[lang].*` lookup. The full list is in the table above. Drop the 4 dead keys (`dadLabel`, `kidLabel`, `nextHint`, `drawBtnLoading`) — these are no longer rendered anywhere in `app/page.tsx` after TASK-014C removed the visible button text. Add the 4 new keys (`dadSwitchLabel`, `kidSwitchLabel`, `nextHintAria`, `drawBtnLoadingAria`) at the 4 aria-label/title sites created by TASK-014C. For each iconized button, the screen-reader `aria-label` AND the hover `title` MUST use the same `STRINGS[lang].*` key, so the assistive announcement and the tooltip stay in sync:

    - **Dad chip (`app/page.tsx:515-516`):** `aria-label={STRINGS[lang].dadSwitchLabel}` and `title={STRINGS[lang].dadSwitchLabel}`.
    - **Kid chip (`app/page.tsx:553-554`):** `aria-label={STRINGS[lang].kidSwitchLabel}` and `title={STRINGS[lang].kidSwitchLabel}`.
    - **Hint button (`app/page.tsx:591-592`):** `aria-label={STRINGS[lang].nextHintAria}` and `title={STRINGS[lang].nextHintAria}`.
    - **Send button (`app/page.tsx:667-668`):** `aria-label={loading ? STRINGS[lang].drawBtnLoadingAria : STRINGS[lang].drawBtn}` and the matching `title` on line 668. The loading branch uses the new `drawBtnLoadingAria`; the idle branch reuses the existing `drawBtn` key.

### No other changes

No CSS, no new files, no API change, no `lib/` change, no `package.json` change.

## Acceptance Criteria

1. **Toggle exists and is leftmost in `.hb-head-btns`** — visual check: a `hb-ghost` button with the visible text `EN` (when lang is `zh`) or `中` (when lang is `en`) sits as the first child of `.hb-head-btns`, before the existing settings icon. Uses the same `hb-ghost` class.
2. **Click toggles all text instantly, no refresh** — click the button, every hard-coded string in §1's table switches to the other language on the next paint, without a page reload.
3. **`SpeechRecognition.lang` follows UI lang** — after toggling to `en`, calling `startVoice()` creates a `SpeechRecognition` with `rec.lang === 'en-US'`. After toggling to `zh`, it creates one with `rec.lang === 'zh-CN'`. Verify by reading `recRef.current.lang` in DevTools after pressing the mic.
4. **Lang switch while listening does not crash** — press the mic, then click the toggle. The recording stops, the mic pulse clears, no JS error appears in the console, and the next press of the mic starts a new recording in the new language.
5. **Persistence** — toggle to `en`, refresh the page, the page reloads in `en`. `localStorage.getItem('saydraw_lang')` returns `'en'`.
6. **First-visit default** — clear `localStorage['saydraw_lang']`; reload. If `navigator.language` starts with `zh` (case-insensitive), lang is `zh`. Otherwise lang is `en`.
7. **Invalid localStorage value** — `localStorage.setItem('saydraw_lang', 'fr')`, reload. The page falls back to the navigator rule (no crash, no `fr` lang state).
8. **`<html lang>` reflects active lang** — after `zh`, `document.documentElement.lang === 'zh-CN'`. After `en`, `document.documentElement.lang === 'en'`. Verify in DevTools.
9. **No hydration mismatch** — load the page in a fresh incognito window; the browser console shows no React hydration warning. Verify by reading the console.
10. **Seed scene localizes** — on a fresh first visit (no saved story) with an English browser, the first scene is `SEED_SCENE_EN` after the post-mount effect runs (its `text` is the English sentence, not the Chinese one).
11. **No new npm deps** — `git diff package.json package-lock.json` is empty. `git diff --stat` shows exactly one file changed: `app/page.tsx`.
12. **No `dangerouslySetInnerHTML` change** — the seed SVG is unchanged, the sanitizer is unchanged, no new dynamic SVG path is added.
13. **No reserved event change** — `lib/analytics/events.ts` is not modified. `lib/analytics/track.ts` is not modified. No call site adds a new event name.
14. **Build passes** — `npx tsc --noEmit` returns 0. `npm.cmd run build` succeeds.
15. **All hard-coded user-facing Chinese strings in §1 are now `STRINGS[lang].*` lookups** — verify by grep. The 4 dead keys (`dadLabel`, `kidLabel`, `nextHint`, `drawBtnLoading`) are no longer expected anywhere in `app/page.tsx` — TASK-014C removed the visible button text they used to label. The 4 new keys (`dadSwitchLabel`, `kidSwitchLabel`, `nextHintAria`, `drawBtnLoadingAria`) MUST be wired at the 4 aria-label/title sites (`app/page.tsx:515, 553, 591, 667`); audit fails if any of these 4 sites still contains a literal Chinese string after this task. After this task, the only Chinese strings remaining in `app/page.tsx` are the values inside the `STRINGS.zh` object, the `text` field of the Chinese seed scene (`SEED_SCENE`), and the SVG markup strings (no translation needed for line art).
16. **Settings panel copy switches** — open the settings drawer in `zh` and `en`; the title, the textarea label, the hint, the placeholder, the close aria, the "Restore defaults" button, and the "Done" button all translate.
17. **Playback modal copy switches** — start playback in `zh` and `en`; the close aria, the prev aria, the next aria, and the `cur / total` counter all translate (counter uses the `playCount` formatter).
18. **Existing behavior preserved** — typing, Enter-to-submit, send button, mic press-and-hold, speaker toggle, settings panel save/reset, playback, filmstrip navigation, and reset all work as before.
19. **TASK-014C's 4 iconized buttons have localized aria-labels** — verify by switching lang and inspecting the `aria-label` attribute of `.hb-chip` (×2), `.hb-spark`, and `.hb-send` in DevTools. All four must reflect `STRINGS[lang].*`. The dad chip and kid chip swap between `切换为爸爸说话` / `Switch to dad's voice` and `切换为宝宝说话` / `Switch to kid's voice`. The hint button swaps between `接下来呢？给点灵感` / `What's next? Get a hint`. The send button swaps between `画板正在沙沙画……` / `The board is drawing…` (loading state) and `画出来` / `Draw` (idle state). The hover `title` attribute must mirror the `aria-label` on every one of these 4 buttons.

## Verification Plan

1. `cd E:\SayDraw && npx tsc --noEmit` — must pass.
2. `cd E:\SayDraw && npm.cmd run build` — must pass.
3. `git diff --stat` from `E:\SayDraw` — must show exactly one file changed: `app/page.tsx`.
4. `git diff package.json package-lock.json` — must be empty.
5. Grep checks in `app/page.tsx`:
   - `grep -F 'rec.lang = '` should return exactly one match, with `REC_LANG[lang]` (no literal `'zh-CN'`).
   - `grep -E "'(zh-CN|en-US)'"` should return 0 matches in any function body other than the `REC_LANG` declaration.
   - `grep -E '画话本|播放故事|设置|恢复默认|完成|关闭设置|关闭播放|上一格|下一格|长按录音|松开结束录音|从开头重来|这个浏览器|故事提示词|额外的旁白|例：旁白要活泼'` outside the `STRINGS.zh` object and `SEED_SCENE` / `SEED_SCENE_EN` definitions — must be 0 matches.
   - `grep -E "'(爸爸说|宝宝说|接下来呢？|绘画中)'"` should return 0 matches anywhere in the file (these strings are dead — removed by TASK-014C iconization, do not appear in the rendered output). The substrings `爸爸说` / `宝宝说` may still appear in the dad/kid input placeholders (`爸爸说……` / `宝宝说……（或者点麦克风）`), so the check uses quote-bounded matches (`'爸爸说'` / `'宝宝说'`) to exclude those.
   - `grep -E '切换为爸爸说话|切换为宝宝说话|接下来呢？给点灵感|画板正在沙沙画……'` should match **only** inside the `STRINGS.zh` object (zh values for the new keys `dadSwitchLabel`, `kidSwitchLabel`, `nextHintAria`, `drawBtnLoadingAria`). Zero matches in any JSX attribute or function body outside `STRINGS`.
   - `grep -F 'aria-label=' app/page.tsx` should return exactly 5 matches: the 4 iconized buttons (lines 515, 553, 591, 667) plus the mic button (line 615). Each `aria-label` value must be a `STRINGS[lang].*` lookup, not a literal Chinese string.
   - `grep -F 'saydraw_lang'` should appear at least 3 times: read, write, and the helper.
6. Manual in Chrome desktop (English browser, fresh incognito):
   - Load `localhost:3000` — observe a brief Chinese flash, then the page switches to English within ~50ms.
   - Verify logo title is `HuaHuaBen` and tagline is the English one.
   - Click the `中` button — all text switches to Chinese, including settings drawer and playback modal.
   - Refresh — page is still in Chinese. `localStorage['saydraw_lang']` is `'zh'`.
   - Click `EN` — switches back. Refresh — still English.
   - Open DevTools, set `localStorage.setItem('saydraw_lang','fr')` — refresh. Page falls back to English (since browser is English). No crash.
   - Reset localStorage to `null` — refresh. Page derives lang from `navigator.language`.
   - In `en`, press and hold the mic. In DevTools, read `recRef.current.lang` — should be `'en-US'`. Speak a short English sentence, release. The input box fills with the English transcript.
   - In `zh`, press and hold the mic. `recRef.current.lang` should be `'zh-CN'`. Speak Chinese, release. Input fills with the Chinese transcript.
   - In `en`, start a fresh story. Send `Test`. The film strip's first frame shows the English seed text after a hard refresh; the second frame shows the API response (English narration).
7. Manual in Chrome desktop, fresh visit with English browser: open DevTools console, hard-reload. Confirm no `Warning: Text content did not match` or `Hydration failed` warning. Confirm no `Web Speech` errors on page load (only after pressing the mic).
8. Visual check: the toggle button is the leftmost in `.hb-head-btns`, has the same height/padding as the other ghost pills, and the visible text (`EN` or `中`) is a single short string. No layout jump on toggle.

## Risks

| Risk | Mitigation |
|------|------------|
| **Hydration flash on first load** — en browsers see Chinese copy for ~16-50ms before the post-mount effect runs | Documented in the plan; acceptable for MVP. No skeleton / loading screen added. If the flash becomes user-noticeable in practice, defer a follow-up task to read lang from a `cookies()` call (server) or a `useLayoutEffect` for first paint. |
| **Stale `SpeechRecognition` callbacks** — if the user toggles while listening, the old instance's `onresult` / `onend` may fire after the toggle | `toggleLang()` calls `stopVoice()` and clears `recRef.current = null` synchronously. The browser tears down the old instance; the next `startVoice()` allocates a new one with the new `rec.lang`. The closure-scoped `committed` flag in `startVoice()` naturally resets. |
| **English seed sentence tone mismatch** — the Chinese seed is whimsical; the English translation may feel stilted | Use a faithful but slightly idiomatic English translation (see Design Decision 4). If a parent tester flags the wording, the seed is a single string and easy to revise in `STRINGS.en`. |
| **`<html lang>` set via `useEffect` is too late for the first paint** — screen readers and browser translation hints may briefly see `<html lang="en">` (the default in `app/layout.tsx`) | Acceptable for MVP. The static default is English, which is the safest fallback for an English-only screen reader. A static dynamic attribute would require either a server component or middleware; both are out of scope. |
| **`localStorage` write inside a `setState` updater** — `toggleLang()` writes to `localStorage` synchronously after `setLang(next)`; React may bail the state update in StrictMode double-invocation, causing a stale write | The `setLang` is called with a known value (`lang === 'zh' ? 'en' : 'zh'`), not an updater function; React will not bail it. `localStorage.setItem` is idempotent — a duplicate write of the same value is harmless. |
| **Toggle button text "中" may be opaque to English-only users** | The visible label is compact per the user spec, but the `aria-label` and `title` are explicit: `Switch to English` / `切换到中文`. Hover and screen reader experience is clear. |
| **`storyText()` English labels in API request** — DeepSeek may interpret `Dad:` differently from `爸爸:` | The semantic role is preserved (`Dad` = the parent). The English prompt body may be slightly less natural in zh context, but it does not break the request. If the API returns noticeably worse English, add a follow-up task to localize the API prompt body separately. |
| **`localStorage` write fails in private mode (Safari iOS)** — `localStorage.setItem` can throw in private browsing | Wrap the writes in a try/catch in `resolveInitialLang()` and `toggleLang()`. If the write throws, the in-memory `lang` state still works for the current session; persistence is a best-effort bonus. |

## Rollback

Single-file change. Revert is `git checkout HEAD -- app/page.tsx`. No CSS, no package, no API route, no `lib/` change. The seed scene is the only stateful data potentially affected — if a user toggled to `en` once, the next page load (post-revert) will show the Chinese seed again. `localStorage['saydraw_lang']` may be left in a stale state; clearing it is a no-op for the reverted app.

## Decisions Log

The following questions were resolved by the user during planning. Plan-agent records the agreed answers here; no further action needed on these items. This is a documentation cleanup, not a behavior change.

1. **No ✏️ emoji in `errorMsg`.** The Chinese error string is the emoji-free version that matches the current code. The `STRINGS.zh.errorMsg` value is `'画板打了个小盹，再说一次试试'`. The English value is `'The board took a quick nap, try again'`. Aligns with the line-art aesthetic (no emoji in chrome).
2. **Brand name: `HuaHuaBen`.** The English logo title is the brand name in Latin script. `STRINGS.en.appTitle: 'HuaHuaBen'`. (Pinyin of 画话本.)
3. **Tagline: literal English translation.** The English tagline is `'You say a line · Your kid says a line · The board draws one'`. Faithful translation of the Chinese `你说一句 · 宝宝说一句 · 画板画一幅`. No playful / shorter alternative was chosen.
4. **`<html lang>`: `'zh-CN'` and `'en'`.** `document.documentElement.lang` is set to `'zh-CN'` for `zh` and `'en'` for `en`. The English value is the region-less BCP 47 tag (not `'en-US'`); region-specific is reserved for the future if needed. `SpeechRecognition.lang` uses `'zh-CN'` / `'en-US'` per `REC_LANG` (per-web-spec convention).
5. **SR race: accept current behavior.** When the user toggles `lang` between `mousedown` and `rec.start()`, the toggle wins because `toggleLang()` is synchronous and `startVoice()` reads `lang` from React state at the moment of allocation. The window is sub-millisecond on a desktop; the plan accepts this behavior. No additional guard added.

## Approval

Awaiting user approval. After approval: plan-agent updates `active_spec.md` to point here and flips `TASK-015` in `progress.md` to `approved`.
