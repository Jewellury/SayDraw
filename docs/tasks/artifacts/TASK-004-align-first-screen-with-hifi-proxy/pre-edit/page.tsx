export default function Page() {
  return (
    <div className="dot-grid relative flex h-screen w-screen flex-col items-center overflow-hidden"
      style={{ backgroundColor: "var(--paper)", fontFamily: "var(--font-secondary)" }}>

      {/* ---- Speaker Toggle ---- */}
      <div style={{
        display: "flex", gap: "16px", padding: "16px 20px 8px",
        justifyContent: "center", width: "100%", flexShrink: 0,
      }}>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          minWidth: "120px", minHeight: "56px", padding: "12px 28px",
          borderRadius: "9999px", fontSize: "22px", fontWeight: 700,
          fontFamily: "var(--font-title)",
          color: "#fdfaf0", backgroundColor: "var(--dad)",
          boxShadow: "3px 4px 0 rgba(33,30,24,.85)",
        }}>
          爸爸说
        </span>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          minWidth: "120px", minHeight: "56px", padding: "12px 28px",
          borderRadius: "9999px", fontSize: "22px", fontWeight: 700,
          fontFamily: "var(--font-title)",
          color: "var(--accent)", backgroundColor: "transparent",
          border: "2.5px solid var(--accent)",
        }}>
          宝宝说
        </span>
      </div>

      {/* ---- Story Card ---- */}
      <div style={{
        flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "center",
        width: "100%", padding: "16px 20px", minHeight: 0,
      }}>
        <div style={{
          position: "relative",
          width: "100%", maxWidth: "640px", aspectRatio: "4 / 3",
          backgroundColor: "var(--paper-card)",
          boxShadow: "6px 7px 0 rgba(33,30,24,.85)",
          borderRadius: "2px",
          transform: "rotate(0.5deg)",
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", overflow: "hidden",
          border: "2px solid var(--ink)",
        }}>
          {/* Tape strip */}
          <div style={{
            position: "absolute", top: "-10px", left: "50%",
            transform: "translateX(-50%) rotate(-2deg)",
            width: "80px", height: "28px",
            backgroundColor: "rgba(217,98,43,.35)",
            borderRadius: "2px",
          }} />

          {/* SVG placeholder */}
          <div style={{
            width: "88%", height: "75%",
            border: "2px dashed rgba(33,30,24,.15)",
            borderRadius: "4px",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{
              color: "var(--ink-soft)", fontSize: "16px",
              fontFamily: "var(--font-story)",
            }}>
              你的故事在这里画出来
            </span>
          </div>
        </div>
      </div>

      {/* ---- Filmstrip Row ---- */}
      <div style={{
        display: "flex", gap: "10px", padding: "10px 20px", overflowX: "auto",
        width: "100%", flexShrink: 0, justifyContent: "center",
      }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} style={{
            width: "72px", height: "54px", flexShrink: 0,
            backgroundColor: "var(--paper-card)",
            border: n === 1 ? "2px solid var(--ink)" : "1.5px solid var(--ink-soft)",
            borderRadius: "2px",
            boxShadow: n === 1 ? "3px 4px 0 rgba(33,30,24,.85)" : "none",
            opacity: n === 1 ? 1 : 0.5,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{
              fontSize: "11px", color: "var(--ink-soft)",
              fontFamily: "var(--font-secondary)",
            }}>
              {n === 1 ? "第1格" : ""}
            </span>
          </div>
        ))}
      </div>

      {/* ---- Input Bar ---- */}
      <div style={{
        display: "flex", alignItems: "center", gap: "12px",
        padding: "12px 20px 20px", width: "100%", flexShrink: 0,
        justifyContent: "center",
      }}>
        {/* Mic button */}
        <button style={{
          width: "56px", height: "56px", borderRadius: "9999px",
          backgroundColor: "var(--paper-card)",
          border: "2px solid var(--ink)",
          boxShadow: "3px 4px 0 rgba(33,30,24,.85)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", flexShrink: 0,
        }} aria-label="麦克风">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </button>

        {/* Text pill */}
        <div style={{
          flex: "1 1 auto", maxWidth: "480px",
          height: "56px", borderRadius: "9999px",
          backgroundColor: "var(--paper-card)",
          border: "2px solid var(--ink)",
          boxShadow: "3px 4px 0 rgba(33,30,24,.85)",
          display: "flex", alignItems: "center",
          padding: "0 20px",
        }}>
          <span style={{
            color: "var(--ink-soft)", fontSize: "18px",
            fontFamily: "var(--font-secondary)",
          }}>
            宝宝说……（或者点麦克风）
          </span>
        </div>

        {/* Draw button */}
        <button style={{
          minWidth: "100px", height: "56px", borderRadius: "9999px",
          backgroundColor: "var(--ink)",
          color: "var(--paper)", fontSize: "20px", fontWeight: 700,
          fontFamily: "var(--font-title)",
          border: "none",
          boxShadow: "3px 4px 0 rgba(33,30,24,.85)",
          cursor: "pointer", flexShrink: 0, padding: "0 24px",
        }}>
          画出来
        </button>
      </div>
    </div>
  );
}
