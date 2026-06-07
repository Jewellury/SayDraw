'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { loadStory, saveStory } from '@/lib/story/storage';
import { track } from '@/lib/analytics/track';
import { EVENTS } from '@/lib/analytics/events';
import type { Scene, StoryState, GenerateResponse } from '@/lib/story/types';

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

export default function Page() {
  const [scenes, setScenes] = useState<Scene[]>(() => {
    const s = typeof window !== 'undefined' ? loadStory() : defaultState();
    return s.scenes;
  });
  const [current, setCurrent] = useState<number>(() => {
    const s = typeof window !== 'undefined' ? loadStory() : defaultState();
    return s.current;
  });
  const [speaker, setSpeaker] = useState<'dad' | 'kid'>(() => {
    const s = typeof window !== 'undefined' ? loadStory() : defaultState();
    return s.speaker;
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const filmRef = useRef<HTMLDivElement>(null);

  const storyText = useCallback(
    () =>
      scenes
        .map((s) => (s.speaker === 'dad' ? '爸爸' : '宝宝') + '：' + s.text)
        .join('\n'),
    [scenes]
  );

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
      const res = await fetch('/api/story/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storySoFar: storyText(),
          newLine: myLine,
          speaker: mySpeaker,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'API error');
      }

      const { narration, svg }: GenerateResponse = data;

      const newScene: Scene = {
        id: Date.now(),
        speaker: mySpeaker,
        text: narration || myLine,
        svg,
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
      });

      setTimeout(() => {
        filmRef.current?.scrollTo({ left: 99999, behavior: 'smooth' });
      }, 100);
    } catch (e) {
      setError('画板打了个小盹，再说一次试试');
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
    if (e.key === 'Enter' && !loading && input.trim()) {
      addScene();
    }
  }

  function switchToFrame(index: number) {
    setCurrent(index);
    track(EVENTS.STORY_FRAME_REVISITED, { frameIndex: index });
  }

  // localStorage persistence: load on mount (already done via lazy init),
  // save on scene/current/speaker change
  useEffect(() => {
    saveStory({ scenes, current, speaker });
  }, [scenes, current, speaker]);

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
              <div className="hb-title">画话本</div>
              <div className="hb-sub">你说一句 · 宝宝说一句 · 画板画一幅</div>
            </div>
          </div>
          <div className="hb-head-btns">
            <button className="hb-ghost" onClick={() => {}} aria-label="播放故事">
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
              播放故事
            </button>
            <button
              className="hb-ghost"
              onClick={() => {
                setScenes([SEED_SCENE]);
                setCurrent(0);
                setSpeaker('kid');
                setError('');
                setInput('');
              }}
              title="从开头重来"
              aria-label="从开头重来"
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
              第 {current + 1} / {scenes.length} 格
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
              style={{ '--c': DAD_COLOR } as React.CSSProperties}
              onClick={() => setSpeaker('dad')}
            >
              爸爸说
            </button>
            <button
              className={'hb-chip' + (speaker === 'kid' ? ' on' : '')}
              style={{ '--c': KID_COLOR } as React.CSSProperties}
              onClick={() => setSpeaker('kid')}
            >
              宝宝说
            </button>
            <button className="hb-spark" onClick={() => {}}>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z" />
              </svg>
              接下来呢？
            </button>
          </div>

          {/* Input Pill */}
          <div className="hb-inputbar">
            <button className="hb-mic" aria-label="麦克风" onClick={() => {}}>
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
            <input
              className="hb-input"
              placeholder={
                speaker === 'kid' ? '宝宝说……（或者点麦克风）' : '爸爸说……'
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <button
              className="hb-send"
              onClick={addScene}
              disabled={loading || !input.trim()}
            >
              {loading ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="hb-spin"
                >
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
              <span>{loading ? '绘画中' : '画出来'}</span>
            </button>
          </div>
        </footer>
      </div>
    </>
  );
}
