import { StoryState, Scene } from './types';

const STORAGE_KEY = 'saydraw-story';

const INK = '#1f1c18';

const SEED_SVG = `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
  <circle cx="72" cy="60" r="36" fill="none" stroke="${INK}" stroke-width="3"/>
  <circle cx="62" cy="50" r="6" fill="none" stroke="${INK}" stroke-width="2"/>
  <circle cx="86" cy="70" r="4" fill="none" stroke="${INK}" stroke-width="2"/>
  <circle cx="68" cy="80" r="3" fill="none" stroke="${INK}" stroke-width="2"/>
  <line x1="112" y1="92" x2="252" y2="208" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
  <line x1="124" y1="82" x2="196" y2="142" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
  <line x1="138" y1="108" x2="206" y2="170" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
  <circle cx="260" cy="216" r="13" fill="none" stroke="${INK}" stroke-width="3"/>
  <path d="M250 234 l-9 9 M270 230 l11 6 M260 240 l0 13" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
  <path d="M300 252 q18 -52 56 -46 q40 6 30 46 q-2 12 -14 12 l-60 0 q-12 0 -12 -12 z" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
  <line x1="320" y1="263" x2="320" y2="280" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
  <line x1="362" y1="263" x2="362" y2="280" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
  <path d="M326 236 l8 8 M334 236 l-8 8" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
  <path d="M350 236 l8 8 M358 236 l-8 8" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
  <circle cx="332" cy="216" r="3" fill="none" stroke="${INK}" stroke-width="2"/>
  <circle cx="352" cy="209" r="3" fill="none" stroke="${INK}" stroke-width="2"/>
</svg>`;

const SEED_SCENE: Scene = {
  id: 1,
  speaker: 'dad',
  text: '陨石从月球上掉下来，砸到小恐龙，嗷呜——小恐龙晕了。',
  svg: SEED_SVG,
};

function defaultState(): StoryState {
  return {
    scenes: [SEED_SCENE],
    current: 0,
    speaker: 'kid',
  };
}

export function loadStory(): StoryState {
  if (typeof window === 'undefined') return defaultState();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();

    const parsed = JSON.parse(raw);

    if (
      parsed &&
      Array.isArray(parsed.scenes) &&
      parsed.scenes.length > 0 &&
      typeof parsed.current === 'number'
    ) {
      return {
        scenes: parsed.scenes as Scene[],
        current: Math.min(parsed.current, parsed.scenes.length - 1),
        speaker: parsed.speaker === 'dad' ? 'dad' : 'kid',
      };
    }

    return defaultState();
  } catch {
    return defaultState();
  }
}

export function saveStory(state: StoryState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage quota exceeded or unavailable - silently fail
  }
}
