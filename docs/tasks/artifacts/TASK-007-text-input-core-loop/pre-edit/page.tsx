'use client';

export default function Page() {
  return (
    <>
      {/* SVG noise filter definition for paper texture */}
      <svg style={{ display: 'none' }} aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <filter id="paper-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
        </filter>
      </svg>

      <div className="dot-grid hb-root">
        {/* ---- Header ---- */}
        <header className="hb-head">
          <div className="hb-logo">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="6 3 20 12 6 21 6 3" />
              </svg>
              播放故事
            </button>
            <button className="hb-ghost" onClick={() => {}} title="从开头重来" aria-label="从开头重来">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            <div className="hb-draw">
              <svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
                <circle cx="72" cy="60" r="36" fill="none" stroke="#1f1c18" strokeWidth="3" />
                <circle cx="62" cy="50" r="6" fill="none" stroke="#1f1c18" strokeWidth="2" />
                <circle cx="86" cy="70" r="4" fill="none" stroke="#1f1c18" strokeWidth="2" />
                <circle cx="68" cy="80" r="3" fill="none" stroke="#1f1c18" strokeWidth="2" />
                <line x1="112" y1="92" x2="252" y2="208" stroke="#1f1c18" strokeWidth="3" strokeLinecap="round" />
                <line x1="124" y1="82" x2="196" y2="142" stroke="#1f1c18" strokeWidth="2" strokeLinecap="round" />
                <line x1="138" y1="108" x2="206" y2="170" stroke="#1f1c18" strokeWidth="2" strokeLinecap="round" />
                <circle cx="260" cy="216" r="13" fill="none" stroke="#1f1c18" strokeWidth="3" />
                <path d="M250 234 l-9 9 M270 230 l11 6 M260 240 l0 13" fill="none" stroke="#1f1c18" strokeWidth="2" strokeLinecap="round" />
                <path d="M300 252 q18 -52 56 -46 q40 6 30 46 q-2 12 -14 12 l-60 0 q-12 0 -12 -12 z" fill="none" stroke="#1f1c18" strokeWidth="3" strokeLinecap="round" />
                <line x1="320" y1="263" x2="320" y2="280" stroke="#1f1c18" strokeWidth="3" strokeLinecap="round" />
                <line x1="362" y1="263" x2="362" y2="280" stroke="#1f1c18" strokeWidth="3" strokeLinecap="round" />
                <path d="M326 236 l8 8 M334 236 l-8 8" fill="none" stroke="#1f1c18" strokeWidth="2" strokeLinecap="round" />
                <path d="M350 236 l8 8 M358 236 l-8 8" fill="none" stroke="#1f1c18" strokeWidth="2" strokeLinecap="round" />
                <circle cx="332" cy="216" r="3" fill="none" stroke="#1f1c18" strokeWidth="2" />
                <circle cx="352" cy="209" r="3" fill="none" stroke="#1f1c18" strokeWidth="2" />
              </svg>
            </div>
            <div className="hb-narration">
              <span className="hb-dot" />
              陨石从月球上掉下来，砸到小恐龙，嗷呜——小恐龙晕了。
            </div>
            <div className="hb-page">第 1 / 3 格</div>
          </div>

          {/* Filmstrip */}
          <div className="hb-film">
            <button className="hb-frame on">
              <div className="hb-frame-svg">
                <svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="72" cy="60" r="36" fill="none" stroke="#1f1c18" strokeWidth="3" />
                  <circle cx="62" cy="50" r="6" fill="none" stroke="#1f1c18" strokeWidth="2" />
                  <circle cx="86" cy="70" r="4" fill="none" stroke="#1f1c18" strokeWidth="2" />
                  <circle cx="68" cy="80" r="3" fill="none" stroke="#1f1c18" strokeWidth="2" />
                  <line x1="112" y1="92" x2="252" y2="208" stroke="#1f1c18" strokeWidth="3" strokeLinecap="round" />
                  <line x1="124" y1="82" x2="196" y2="142" stroke="#1f1c18" strokeWidth="2" strokeLinecap="round" />
                  <line x1="138" y1="108" x2="206" y2="170" stroke="#1f1c18" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="260" cy="216" r="13" fill="none" stroke="#1f1c18" strokeWidth="3" />
                  <path d="M250 234 l-9 9 M270 230 l11 6 M260 240 l0 13" fill="none" stroke="#1f1c18" strokeWidth="2" strokeLinecap="round" />
                  <path d="M300 252 q18 -52 56 -46 q40 6 30 46 q-2 12 -14 12 l-60 0 q-12 0 -12 -12 z" fill="none" stroke="#1f1c18" strokeWidth="3" strokeLinecap="round" />
                  <line x1="320" y1="263" x2="320" y2="280" stroke="#1f1c18" strokeWidth="3" strokeLinecap="round" />
                  <line x1="362" y1="263" x2="362" y2="280" stroke="#1f1c18" strokeWidth="3" strokeLinecap="round" />
                  <path d="M326 236 l8 8 M334 236 l-8 8" fill="none" stroke="#1f1c18" strokeWidth="2" strokeLinecap="round" />
                  <path d="M350 236 l8 8 M358 236 l-8 8" fill="none" stroke="#1f1c18" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="332" cy="216" r="3" fill="none" stroke="#1f1c18" strokeWidth="2" />
                  <circle cx="352" cy="209" r="3" fill="none" stroke="#1f1c18" strokeWidth="2" />
                </svg>
              </div>
              <span className="hb-frame-no" style={{ color: 'var(--dad)' }}>1</span>
            </button>
            <button className="hb-frame">
              <div className="hb-frame-svg">
                <svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
                  <path d="M120 180 q80 -90 160 0" fill="none" stroke="#1f1c18" strokeWidth="3" strokeLinecap="round" />
                  <circle cx="170" cy="150" r="6" fill="none" stroke="#1f1c18" strokeWidth="2" />
                  <circle cx="230" cy="150" r="6" fill="none" stroke="#1f1c18" strokeWidth="2" />
                  <path d="M170 175 q30 18 60 0" fill="none" stroke="#1f1c18" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <span className="hb-frame-no" style={{ color: 'var(--kid)' }}>2</span>
            </button>
            <button className="hb-frame">
              <div className="hb-frame-svg">
                <svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
                  <path d="M200 260 C100 160 120 80 200 130 C280 80 300 160 200 260" fill="none" stroke="#1f1c18" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>
              <span className="hb-frame-no" style={{ color: 'var(--dad)' }}>3</span>
            </button>
          </div>
        </main>

        {/* ---- Footer ---- */}
        <footer className="hb-foot">
          {/* Speaker Toggle */}
          <div className="hb-who">
            <button className="hb-chip" onClick={() => {}}>
              爸爸说
            </button>
            <button className="hb-chip on" onClick={() => {}}>
              宝宝说
            </button>
            <button className="hb-spark" onClick={() => {}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z" />
              </svg>
              接下来呢？
            </button>
          </div>

          {/* Input Pill */}
          <div className="hb-inputbar">
            <button className="hb-mic" aria-label="麦克风" onClick={() => {}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>
            <input className="hb-input" placeholder="宝宝说……（或者点麦克风）" readOnly />
            <button className="hb-send" onClick={() => {}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              <span>画出来</span>
            </button>
          </div>
        </footer>
      </div>
    </>
  );
}
