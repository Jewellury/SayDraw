'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { loadStory, saveStory } from '@/lib/story/storage';
import { track } from '@/lib/analytics/track';
import { EVENTS } from '@/lib/analytics/events';
import type { Scene, StoryState, GenerateResponse } from '@/lib/story/types';
import VoiceRecorder from '@/components/VoiceRecorder';

/* ------------------------------------------------------------------ */
/*  Localised strings surfaced to <VoiceRecorder> as child-safe copy.   */
/* ------------------------------------------------------------------ */

const DAD_COLOR = '#2b5d7e';
const KID_COLOR = '#d9622b';

const SEED_SVG = `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
  <circle cx="72" cy="60" r="36" fill="none" stroke="#1f1c18" stroke-width="3"/>
  <circle cx="62" cy="50" r="6" fill="none" stroke="#1f1c18" stroke-width="2"/>
  <circle cx="86" cy="70" r="4" fill="none" stroke="#1f1c18" stroke-width="2"/>
  <circle cx="68" cy="80" r="3" fill="none" stroke="#1f1c18" stroke-width="2"/>
  <line x1="112" y1="92" x2="252" y2="208" stroke="#1f1c18" stroke-width="3" stroke-linecap="round"/>
  <line x1="124" y1="82" x2="196" y2="142" stroke="#1f1c18" stroke-width="2" stroke-linecap="round"/>
  <line x1="138" y1="108" x2="206" y2="170" stroke="#1f1c18" stroke-width="2" stroke-linecap="round"/>
  <circle cx="260" cy="216" r="13" fill="none" stroke="#1f1c18" stroke-width="3"/>
  <path d="M250 234 l-9 9 M270 230 l11 6 M260 240 l0 13" fill="none" stroke="#1f1c18" stroke-width="2" stroke-linecap="round"/>
  <path d="M300 252 q18 -52 56 -46 q40 6 30 46 q-2 12 -14 12 l-60 0 q-12 0 -12 -12 z" fill="none" stroke="#1f1c18" stroke-width="3" stroke-linecap="round"/>
  <line x1="320" y1="263" x2="320" y2="280" stroke="#1f1c18" stroke-width="3" stroke-linecap="round"/>
  <line x1="362" y1="263" x2="362" y2="280" stroke="#1f1c18" stroke-width="3" stroke-linecap="round"/>
  <path d="M326 236 l8 8 M334 236 l-8 8" fill="none" stroke="#1f1c18" stroke-width="2" stroke-linecap="round"/>
  <path d="M350 236 l8 8 M358 236 l-8 8" fill="none" stroke="#1f1c18" stroke-width="2" stroke-linecap="round"/>
  <circle cx="332" cy="216" r="3" fill="none" stroke="#1f1c18" stroke-width="2"/>
  <circle cx="352" cy="209" r="3" fill="none" stroke="#1f1c18" stroke-width="2"/>
</svg>`;

const SEED_SCENE: Scene = {
  id: 1,
  speaker: 'dad',
  text: '陨石从月球上掉下来，砸到小恐龙，嗷呜——小恐龙晕了。',
  svg: SEED_SVG,
};

const STRINGS = {
  zh: {
    appTitle: '画话本',
    tagline: '你说一句 · 宝宝说一句 · 画板画一幅',
    dadSwitchLabel: '切换为爸爸说话',
    kidSwitchLabel: '切换为宝宝说话',
    nextHintAria: '接下来呢？给点灵感',
    drawBtn: '画出来',
    drawBtnLoadingAria: '画板正在沙沙画……',
    dadPlaceholder: '爸爸说……',
    kidPlaceholder: '宝宝说……（或者点麦克风）',
    listeningHint: '说吧，松手就出来……',
    transcribingHint: '识别中……',
    pageCount: (cur: number, total: number) => `第 ${cur} / ${total} 格`,
    playCount: (cur: number, total: number) => `${cur} / ${total}`,
    errorMsg: '画板打了个小盹，再说一次试试',
    voiceUnsupportedMsg: '这个浏览器还不支持语音，用打字也可以哦',
    micLabelIdle: '长按录音',
    micLabelListening: '松开结束录音',
    playBtn: '播放故事',
    playCloseLabel: '关闭播放',
    playPrevLabel: '上一格',
    playNextLabel: '下一格',
    resetTooltip: '从开头重来',
    settingsTitle: '设置',
    settingsDone: '完成',
    settingsReset: '恢复默认',
    settingsCloseLabel: '关闭设置',
    settingsTextPromptLabel: '故事提示词（DeepSeek Flash）',
    settingsTextPromptHint: '额外的旁白和故事规则，追加到默认提示词末尾',
    settingsTextPromptPlaceholder: '例：旁白要活泼一点，多用拟声词……',
    dadApiLabel: '爸爸',
    kidApiLabel: '宝宝',
    hintLoading: '想一下……',
  },
  en: {
    appTitle: 'HuaHuaBen',
    tagline: 'You say a line · Your kid says a line · The board draws one',
    dadSwitchLabel: "Switch to dad's voice",
    kidSwitchLabel: "Switch to kid's voice",
    nextHintAria: "What's next? Get a hint",
    drawBtn: 'Draw',
    drawBtnLoadingAria: 'The board is drawing…',
    dadPlaceholder: 'Dad says… (or tap the mic)',
    kidPlaceholder: 'Kid says… (or tap the mic)',
    listeningHint: 'Speak, then release',
    transcribingHint: 'Transcribing…',
    pageCount: (cur: number, total: number) => `Frame ${cur} of ${total}`,
    playCount: (cur: number, total: number) => `${cur} / ${total}`,
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
    hintLoading: 'Thinking…',
  },
};

const SEED_SCENE_EN: Scene = {
  id: 1,
  speaker: 'dad',
  text: 'A meteor fell from the moon and bonked a little dinosaur on the head — ROAR! The little dinosaur fainted.',
  svg: SEED_SVG,
};

function getSeedScene(lang: 'zh' | 'en'): Scene {
  return lang === 'en' ? SEED_SCENE_EN : SEED_SCENE;
}

function resolveInitialLang(): 'zh' | 'en' {
  if (typeof window === 'undefined') return 'zh';
  try {
    const stored = localStorage.getItem('saydraw_lang');
    if (stored === 'zh' || stored === 'en') return stored;
  } catch { /* localStorage unavailable */ }
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function defaultState(): StoryState {
  return { scenes: [SEED_SCENE], current: 0, speaker: 'kid' };
}

function DrawnSvg({ svg, replayKey }: { svg: string; replayKey: string }) {
  return (
    <div
      key={replayKey}
      className="hb-draw"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function FilmSvg({ svg }: { svg: string }) {
  return (
    <div
      className="hb-frame-svg"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function initTextPrompt(): string {
  if (typeof window === 'undefined') return '';
  const existing = localStorage.getItem('saydraw_text_prompt');
  if (existing !== null) return existing;

  const scene = localStorage.getItem('saydraw_scene_prompt');
  const narration = localStorage.getItem('saydraw_narration_prompt');

  let result = '';
  if (scene !== null && narration !== null) {
    result = scene + '\n' + narration;
  } else if (scene !== null) {
    result = scene;
  } else if (narration !== null) {
    result = narration;
  }

  localStorage.setItem('saydraw_text_prompt', result);
  localStorage.removeItem('saydraw_scene_prompt');
  localStorage.removeItem('saydraw_narration_prompt');
  return result;
}

function initDrawingPrompt(): string {
  if (typeof window === 'undefined') return '';
  const existing = localStorage.getItem('saydraw_drawing_prompt');
  if (existing !== null) return existing;

  const svg = localStorage.getItem('saydraw_svg_prompt');
  const result = svg !== null ? svg : '';

  localStorage.setItem('saydraw_drawing_prompt', result);
  localStorage.removeItem('saydraw_svg_prompt');
  return result;
}

export default function Page() {
  const [scenes, setScenes] = useState<Scene[]>(() =>
    resolveInitialLang() === 'en' ? [SEED_SCENE_EN] : [SEED_SCENE]
  );
  const [current, setCurrent] = useState<number>(() => defaultState().current);
  const [speaker, setSpeaker] = useState<'dad' | 'kid'>(() => defaultState().speaker);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [playIdx, setPlayIdx] = useState(0);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [lang, setLang] = useState<'zh' | 'en'>(() => resolveInitialLang());
  const [hintText, setHintText] = useState('');
  const [hintLoading, setHintLoading] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTextPrompt, setSettingsTextPrompt] = useState(() => initTextPrompt());
  const [settingsDrawingPrompt, setSettingsDrawingPrompt] = useState(() => initDrawingPrompt());

  const filmRef = useRef<HTMLDivElement>(null);
  const voiceRef = useRef<{ stop: () => void } | null>(null);
  // Renderer path. ?strategy=direct forces the direct SVG path.
  // Default is semantic (TASK-019/020).
  const strategyRef = useRef<'direct' | 'semantic'>('semantic');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search).get('strategy');
    if (p === 'direct') strategyRef.current = 'direct';
    if (p === 'semantic') strategyRef.current = 'semantic';
  }, []);

  useEffect(() => {
    pendo.initialize({ visitor: { id: '' } });
  }, []);

  useEffect(() => {
    const saved = loadStory();
    setScenes(saved.scenes);
    setCurrent(saved.current);
    setSpeaker(saved.speaker);
  }, []);

  useEffect(() => {
    setLang(resolveInitialLang());
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    }
  }, [lang]);

  function toggleLang() {
    // Abort any active capture so the next press honours the new lang.
    // (Preserves TASK-013 "recRef = null" teardown behaviour.)
    if (listening) voiceRef.current?.stop();
    const next = lang === 'zh' ? 'en' : 'zh';
    setLang(next);
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('saydraw_lang', next); } catch { /* best effort */ }
    }
  }

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

  function saveSettings(textPrompt: string, drawingPrompt: string) {
    localStorage.setItem('saydraw_text_prompt', textPrompt);
    localStorage.setItem('saydraw_drawing_prompt', drawingPrompt);
    localStorage.removeItem('saydraw_model');
    localStorage.removeItem('saydraw_scene_prompt');
    localStorage.removeItem('saydraw_narration_prompt');
    localStorage.removeItem('saydraw_svg_prompt');
  }

  async function addScene() {
    const line = input.trim();
    if (!line || loading) return;

    setError('');
    setLoading(true);
    const myLine = line;
    const mySpeaker = speaker;
    setInput('');

    track(EVENTS.STORY_TURN_SUBMITTED, {
      speaker: mySpeaker,
      frameCount: scenes.length,
    });

    try {
      const url =
        strategyRef.current === 'semantic'
          ? '/api/story/generate?strategy=semantic'
          : '/api/story/generate';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storySoFar: storyText(),
          newLine: myLine,
          speaker: mySpeaker,
          lang,
          textPrompt: settingsTextPrompt || undefined,
          drawingPrompt: settingsDrawingPrompt || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'API error');
      }

      const { narration, svg, followUpQuestion, storySummary, strategy }: GenerateResponse = data;

      const newScene: Scene = {
        id: Date.now(),
        speaker: mySpeaker,
        text: narration || myLine,
        svg,
        summary: storySummary,
      };

      setScenes((prev) => {
        const next = [...prev, newScene];
        return next;
      });
      setCurrent((prev) => prev + 1);
      setSpeaker(mySpeaker === 'dad' ? 'kid' : 'dad');

      track(EVENTS.STORY_FRAME_GENERATED, {
        speaker: mySpeaker,
        frameCount: scenes.length + 1,
        strategy: strategy || strategyRef.current,
      });

      setTimeout(() => {
        filmRef.current?.scrollTo({ left: 99999, behavior: 'smooth' });
      }, 100);
    } catch (e) {
      setError(STRINGS[lang].errorMsg);
      setInput(myLine);
      track(EVENTS.STORY_GENERATION_FAILED, {
        speaker: mySpeaker,
        error: e instanceof Error ? e.message : 'Unknown',
      });
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !loading && input.trim() && !listening) {
      addScene();
    }
  }

  function switchToFrame(index: number) {
    setCurrent(index);
    track(EVENTS.STORY_FRAME_REVISITED, { frameIndex: index });
  }

  function startPlayback() {
    if (playing || scenes.length === 0) return;
    track(EVENTS.STORY_PLAY_STARTED, { frameCount: scenes.length });
    setPlayIdx(0);
    setPlaying(true);
  }

  useEffect(() => {
    saveStory({ scenes, current, speaker });
  }, [scenes, current, speaker]);

  useEffect(() => {
    if (!playing) return;
    if (playIdx >= scenes.length - 1) return;
    const t = setTimeout(
      () => setPlayIdx((i) => Math.min(i + 1, scenes.length - 1)),
      3800,
    );
    return () => clearTimeout(t);
  }, [playing, playIdx, scenes.length]);

  useEffect(() => {
    if (!settingsOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSettingsOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settingsOpen]);

  const cur = scenes[current];

  return (
    <>
      <svg
        style={{ display: 'none' }}
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
      >
        <filter id="paper-noise">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="3"
            stitchTiles="stitch"
          />
        </filter>
      </svg>

      <div className="dot-grid hb-root">
        {/* ---- Header ---- */}
        <header className="hb-head">
          <div className="hb-logo">
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--ink)"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            <div>
              <div className="hb-title">{STRINGS[lang].appTitle}</div>
              <div className="hb-sub">{STRINGS[lang].tagline}</div>
            </div>
          </div>
          <div className="hb-head-btns">
            <button
              className="hb-ghost"
              onClick={toggleLang}
              aria-label={lang === 'zh' ? 'Switch to English' : '切换到中文'}
              title={lang === 'zh' ? 'Switch to English' : '切换到中文'}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </button>
            <button className="hb-ghost" style={{ display: 'none' }} onClick={() => setSettingsOpen(true)} aria-label={STRINGS[lang].settingsTitle}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
            <button className="hb-ghost" onClick={startPlayback} aria-label={STRINGS[lang].playBtn}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="6 3 20 12 6 21 6 3" />
              </svg>
              {STRINGS[lang].playBtn}
            </button>
            <button
              className="hb-ghost"
              onClick={() => {
                setScenes([getSeedScene(lang)]);
                setCurrent(0);
                setSpeaker('kid');
                setError('');
                setInput('');
              }}
              title={STRINGS[lang].resetTooltip}
              aria-label={STRINGS[lang].resetTooltip}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
            </button>
          </div>
        </header>

        {/* ---- Main Stage ---- */}
        <main className="hb-stage">
          {/* Board / Story Card */}
          <div className="hb-board">
            <div className="hb-tape" />
            {cur && (
              <DrawnSvg
                svg={cur.svg}
                replayKey={cur.id + '-' + current}
              />
            )}
            {cur && (
              <div className="hb-narration">
                <span
                  className="hb-dot"
                  style={{
                    background: cur.speaker === 'dad' ? DAD_COLOR : KID_COLOR,
                  }}
                />
                {cur.text}
              </div>
            )}
            <div className="hb-page">
              {STRINGS[lang].pageCount(current + 1, scenes.length)}
            </div>
          </div>

          {/* Filmstrip */}
          <div className="hb-film" ref={filmRef}>
            {scenes.map((s, i) => (
              <button
                key={s.id}
                className={'hb-frame' + (i === current ? ' on' : '')}
                onClick={() => switchToFrame(i)}
              >
                <FilmSvg svg={s.svg} />
                <span
                  className="hb-frame-no"
                  style={{
                    color: s.speaker === 'dad' ? DAD_COLOR : KID_COLOR,
                  }}
                >
                  {i + 1}
                </span>
              </button>
            ))}
          </div>
        </main>

        {/* ---- Footer ---- */}
        <footer className="hb-foot">
          {error && <div className="hb-err">{error}</div>}

          {/* Speaker Toggle */}
          <div className="hb-who">
            <button
              className={'hb-chip' + (speaker === 'dad' ? ' on' : '')}
              style={{
                color: speaker === 'dad' ? '#fff' : '#211e18',
                '--c': DAD_COLOR,
                padding: 0,
                width: 56,
                height: 56,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 0,
              } as React.CSSProperties}
              onClick={() => { setSpeaker('dad'); setError(''); }}
              aria-label={STRINGS[lang].dadSwitchLabel}
              title={STRINGS[lang].dadSwitchLabel}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="16" cy="12" r="6.5" strokeWidth="1.8" />
                <ellipse cx="13.5" cy="11.5" rx="1.3" ry="1.3" fill="currentColor" stroke="none" />
                <ellipse cx="18.5" cy="11.5" rx="1.3" ry="1.3" fill="currentColor" stroke="none" />
                <path d="M13.5 14.5 Q16 16.2 18.5 14.5" strokeWidth="1.6" />
                <path d="M16 18.5 L14.8 21 L16 23 L14.8 25 L16.2 27" strokeWidth="1.6" />
                <path d="M14.5 21 L17.5 21" strokeWidth="1.4" />
                <path d="M10 23 Q10 20 14 19" strokeWidth="1.8" />
                <path d="M22 23 Q22 20 18 19" strokeWidth="1.8" />
              </svg>
            </button>
            <button
              className={'hb-chip' + (speaker === 'kid' ? ' on' : '')}
              style={{
                color: speaker === 'kid' ? '#fff' : '#211e18',
                '--c': KID_COLOR,
                padding: 0,
                width: 56,
                height: 56,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 0,
              } as React.CSSProperties}
              onClick={() => { setSpeaker('kid'); setError(''); }}
              aria-label={STRINGS[lang].kidSwitchLabel}
              title={STRINGS[lang].kidSwitchLabel}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M16 3.5 Q14 6 15.5 8" strokeWidth="1.6" />
                <path d="M10 5.5 Q12.5 7.5 13.5 9.5" strokeWidth="1.6" />
                <path d="M22 5.5 Q19.5 7.5 18.5 9.5" strokeWidth="1.6" />
                <path d="M7.5 11 Q10 9.5 13 11" strokeWidth="1.6" />
                <path d="M24.5 11 Q22 9.5 19 11" strokeWidth="1.6" />
                <circle cx="16" cy="15.5" r="6" strokeWidth="1.8" />
                <ellipse cx="13.8" cy="15" rx="1.2" ry="1.3" fill="currentColor" stroke="none" />
                <ellipse cx="18.2" cy="15" rx="1.2" ry="1.3" fill="currentColor" stroke="none" />
                <path d="M13.5 18 Q16 19.5 18.5 18" strokeWidth="1.6" />
                <path d="M11 25.5 Q11.5 22.5 16 22 Q20.5 22.5 21 25.5" strokeWidth="1.8" />
              </svg>
            </button>
            <button
              className="hb-spark"
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 0,
              } as React.CSSProperties}
              onClick={async () => {
                if (hintLoading) return;
                setHintLoading(true);
                setHintText('');
                try {
                  const res = await fetch('/api/story/hint', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ storySoFar: storyText(), lang }),
                  });
                  if (!res.ok) throw new Error('Hint API error');
                  const data = await res.json();
                  setHintText(data.hint || '');
                  track(EVENTS.STORY_HINT_REQUESTED, {});
                } catch (e) {
                  setHintText('');
                  console.error('[hint]', e);
                } finally {
                  setHintLoading(false);
                }
              }}
              disabled={hintLoading}
              aria-label={STRINGS[lang].nextHintAria}
              title={STRINGS[lang].nextHintAria}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 32 32"
                fill="none"
                stroke="#211e18"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 5 Q5 3.5 6.5 3.5 L25.5 3.5 Q27 3.5 27 5 L27 18 Q27 19.5 25.5 19.5 L18 19.5 L14.5 24 L14.5 19.5 L6.5 19.5 Q5 19.5 5 18 Z" strokeWidth="1.8" />
                <path d="M13.5 9.5 Q13.5 7 16 7 Q18.5 7 18.5 9.5 Q18.5 12 16 13 L16 14.5" strokeWidth="1.8" />
                <circle cx="16" cy="17" r="1" fill="#211e18" stroke="none" />
              </svg>
            </button>
          </div>

          {/* Input Pill */}
          <div className="hb-inputbar">
            <VoiceRecorder
              ref={voiceRef}
              lang={lang}
              speaker={speaker}
              onTranscript={(t) => setInput(t)}
              onListeningChange={setListening}
              onTranscribingChange={setTranscribing}
              onError={(m) => setError(m)}
              onClearError={() => setError('')}
                      strings={{
                          voiceUnsupported: STRINGS[lang].voiceUnsupportedMsg,
                          retry: STRINGS[lang].errorMsg,
                        }}
                        key={speaker}
              renderButton={(handlers) => (
                <button
                  className={'hb-mic' + (listening ? ' live' : '')}
                  aria-label={listening ? STRINGS[lang].micLabelListening : STRINGS[lang].micLabelIdle}
                  onMouseDown={handlers.onMouseDown}
                  onMouseUp={handlers.onMouseUp}
                  onMouseLeave={handlers.onMouseLeave}
                  onTouchStart={handlers.onTouchStart}
                  onTouchEnd={handlers.onTouchEnd}
                  onTouchCancel={handlers.onTouchCancel}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </button>
              )}
            />
            <input
              className={'hb-input' + (transcribing ? ' hb-transcribing' : '')}
              placeholder={
                transcribing
                  ? STRINGS[lang].transcribingHint
                  : listening
                    ? STRINGS[lang].listeningHint
                    : speaker === 'kid'
                      ? STRINGS[lang].kidPlaceholder
                      : STRINGS[lang].dadPlaceholder
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <button
              className="hb-send"
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 0,
              } as React.CSSProperties}
              onClick={addScene}
              disabled={loading || !input.trim()}
              aria-label={loading ? STRINGS[lang].drawBtnLoadingAria : STRINGS[lang].drawBtn}
              title={loading ? STRINGS[lang].drawBtnLoadingAria : STRINGS[lang].drawBtn}
            >
              {loading ? (
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 32 32"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="10" y1="12" x2="20" y2="12" className="hb-jit1" />
                  <line x1="10" y1="17" x2="20" y2="17" className="hb-jit2" />
                  <line x1="10" y1="22" x2="20" y2="22" className="hb-jit3" />
                </svg>
              ) : (
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 32 32"
                  fill="none"
                  stroke="white"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M8 23 L19 8 L24 13 L13 26 Z" strokeWidth="1.8" />
                  <path d="M13 26 L8 29 L10 24" strokeWidth="1.8" />
                  <path d="M10 26.5 L10.5 27.5" strokeWidth="2" />
                  <path d="M19 8 L21.5 5.5 L26.5 10.5 L24 13" strokeWidth="1.8" />
                  <path d="M21.5 5.5 L24 8" strokeWidth="1.5" />
                  <path d="M13 12 L20 19" strokeWidth="1.2" />
                </svg>
              )}
            </button>
          </div>

          {(hintText || hintLoading) && (
            <div
              style={{
                textAlign: 'center',
                fontSize: '0.9rem',
                color: 'var(--muted, #6b6560)',
                padding: '8px 16px',
                fontStyle: hintLoading ? 'italic' : 'normal',
                animation: hintLoading ? 'none' : 'hb-fade-in 0.4s ease-out',
              }}
            >
              {hintLoading ? STRINGS[lang].hintLoading : hintText}
            </div>
          )}
        </footer>
      </div>

      {playing && (
        <div className="hb-modal">
          <button
            className="hb-close"
            onClick={() => setPlaying(false)}
            aria-label={STRINGS[lang].playCloseLabel}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
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
              aria-label={STRINGS[lang].playPrevLabel}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span>{STRINGS[lang].playCount(playIdx + 1, scenes.length)}</span>
            <button
              onClick={() => setPlayIdx((i) => Math.min(scenes.length - 1, i + 1))}
              disabled={playIdx === scenes.length - 1}
              aria-label={STRINGS[lang].playNextLabel}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="hb-settings-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="hb-settings-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="hb-settings-header">
              <span>{STRINGS[lang].settingsTitle}</span>
              <button
                onClick={() => setSettingsOpen(false)}
                aria-label={STRINGS[lang].settingsCloseLabel}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="hb-settings-body">
              <div>
                <label className="hb-settings-label">{STRINGS[lang].settingsTextPromptLabel}</label>
                <p className="hb-settings-hint">{STRINGS[lang].settingsTextPromptHint}</p>
                <textarea
                  className="hb-settings-textarea"
                  rows={6}
                  value={settingsTextPrompt}
                  onChange={(e) => {
                    setSettingsTextPrompt(e.target.value);
                    saveSettings(e.target.value, settingsDrawingPrompt);
                  }}
                  placeholder={STRINGS[lang].settingsTextPromptPlaceholder}
                />
              </div>
              {/* drawingPrompt field hidden — reserved localStorage data kept for future dual-model switch-back */}
            </div>
            <div className="hb-settings-footer">
              <button
                onClick={() => {
                  setSettingsTextPrompt('');
                  setSettingsDrawingPrompt('');
                  saveSettings('', '');
                }}
                >
                 {STRINGS[lang].settingsReset}
              </button>
              <button onClick={() => setSettingsOpen(false)}>
                {STRINGS[lang].settingsDone}
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
