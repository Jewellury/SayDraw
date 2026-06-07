import React, { useState, useRef, useEffect } from "react";
import { Mic, Send, Play, X, Sparkles, ChevronLeft, ChevronRight, Loader, BookOpen, RotateCcw } from "lucide-react";

/*  画话本 · SayDraw
    你说一句，宝宝说一句，画板就一笔一笔把故事画出来。
    黑白线条 / 手绘速写画风 / 亲子轮流共创
*/

// ---------- 主题色 ----------
const INK = "#1f1c18";
const PAPER = "#f6f1e3";
const DAD = "#2b5d7e";   // 爸爸
const KID = "#d9622b";   // 宝宝

// ---------- 开场分镜（手绘，秒开，不调用接口）----------
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

const FALLBACK_SVG = `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
  <path d="M120 180 q80 -90 160 0" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
  <circle cx="170" cy="150" r="6" fill="none" stroke="${INK}" stroke-width="2"/>
  <circle cx="230" cy="150" r="6" fill="none" stroke="${INK}" stroke-width="2"/>
  <path d="M170 175 q30 18 60 0" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
</svg>`;

// ---------- 工具：从模型输出里安全取出 JSON ----------
function parseScene(raw) {
  let t = String(raw || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  const s = t.indexOf("{");
  const e = t.lastIndexOf("}");
  if (s !== -1 && e !== -1) t = t.slice(s, e + 1);
  try {
    const o = JSON.parse(t);
    if (o && o.svg) return { narration: o.narration || "", svg: o.svg };
  } catch (_) {}
  // 兜底：直接抠出 <svg>…</svg>
  const m = String(raw).match(/<svg[\s\S]*?<\/svg>/i);
  return { narration: "", svg: m ? m[0] : FALLBACK_SVG };
}

async function callClaude(system, userText) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system,
      messages: [{ role: "user", content: userText }],
    }),
  });
  const data = await res.json();
  return (data.content || []).map((b) => (b.type === "text" ? b.text : "")).join("\n");
}

const SCENE_SYS =
  "你是一个儿童绘本「画板引擎」，陪一个4岁孩子和爸爸一起编故事。" +
  "你会收到目前为止的故事，以及最新的一句话。请只做两件事：" +
  "1) 写一句温暖、简单、口语化、适合4岁孩子的中文旁白，把这一句和前面的故事自然衔接起来（不超过25个字，不要用引号）。" +
  "2) 画一幅纯黑白线条简笔画（SVG），手绘速写风，要能看出这一镜的角色、动作和场景。" +
  "SVG规则：viewBox='0 0 400 300'；只用线条，所有元素 stroke='" + INK + "'、fill='none'、stroke-width 2到3、stroke-linecap='round'；" +
  "不要任何彩色、不要文字；线条元素控制在10到22个之间，保证轮廓清楚。" +
  "只输出一个JSON对象，不要markdown、不要多余文字：{\"narration\":\"...\",\"svg\":\"<svg ...>...</svg>\"}";

const HINT_SYS =
  "你在陪4岁孩子编故事。根据目前的故事，提一个简短、好玩、开放式的问题，引导孩子说出下一句。" +
  "口语、亲切、不超过20个字，像爸爸会问的话。只输出这句问题本身，不要引号。";

// ---------- 把 SVG 串变成会"自己画出来"的样子 ----------
function DrawnSvg({ svg, replayKey }) {
  return (
    <div
      key={replayKey}
      className="hb-draw scene-canvas"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export default function App() {
  const [scenes, setScenes] = useState([
    { id: 1, speaker: "dad", text: "陨石从月球上掉下来，砸到小恐龙，嗷呜——小恐龙晕了。", svg: SEED_SVG },
  ]);
  const [current, setCurrent] = useState(0);
  const [input, setInput] = useState("");
  const [speaker, setSpeaker] = useState("kid");
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState("");
  const [hinting, setHinting] = useState(false);
  const [err, setErr] = useState("");
  const [listening, setListening] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [playIdx, setPlayIdx] = useState(0);
  const recRef = useRef(null);
  const filmRef = useRef(null);

  const storyText = () =>
    scenes.map((s) => (s.speaker === "dad" ? "爸爸" : "宝宝") + "：" + s.text).join("\n");

  async function addScene() {
    const line = input.trim();
    if (!line || loading) return;
    setErr("");
    setHint("");
    setLoading(true);
    const myLine = line;
    const mySpeaker = speaker;
    setInput("");
    try {
      const out = await callClaude(
        SCENE_SYS,
        "目前的故事：\n" + storyText() + "\n\n最新这一句是" +
          (mySpeaker === "dad" ? "爸爸" : "宝宝") + "说的：" + myLine
      );
      const { narration, svg } = parseScene(out);
      const newScene = {
        id: Date.now(),
        speaker: mySpeaker,
        text: narration || myLine,
        svg,
      };
      setScenes((prev) => {
        const next = [...prev, newScene];
        setCurrent(next.length - 1);
        return next;
      });
      setSpeaker(mySpeaker === "dad" ? "kid" : "dad");
      setTimeout(() => filmRef.current?.scrollTo({ left: 99999, behavior: "smooth" }), 100);
    } catch (e) {
      setErr("画板打了个小盹，再说一次试试 ✏️");
      setInput(myLine);
    } finally {
      setLoading(false);
    }
  }

  async function getHint() {
    if (hinting) return;
    setHinting(true);
    setHint("");
    try {
      const out = await callClaude(HINT_SYS, "目前的故事：\n" + storyText());
      setHint(out.trim().replace(/^["「]|["」]$/g, ""));
    } catch (e) {
      setHint("那……后来发生了什么呀？");
    } finally {
      setHinting(false);
    }
  }

  function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setErr("这个浏览器还不支持语音，用打字也可以哦");
      return;
    }
    const rec = new SR();
    rec.lang = "zh-CN";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      const t = Array.from(e.results).map((r) => r[0].transcript).join("");
      setInput(t);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }
  function stopVoice() {
    recRef.current?.stop();
    setListening(false);
  }

  function reset() {
    setScenes([{ id: 1, speaker: "dad", text: "陨石从月球上掉下来，砸到小恐龙，嗷呜——小恐龙晕了。", svg: SEED_SVG }]);
    setCurrent(0);
    setSpeaker("kid");
    setHint("");
    setErr("");
  }

  // 播放故事
  useEffect(() => {
    if (!playing) return;
    if (playIdx >= scenes.length - 1) return;
    const t = setTimeout(() => setPlayIdx((i) => Math.min(i + 1, scenes.length - 1)), 4200);
    return () => clearTimeout(t);
  }, [playing, playIdx, scenes.length]);

  const cur = scenes[current];

  return (
    <div className="hb-root">
      <style>{CSS}</style>

      <header className="hb-head">
        <div className="hb-logo">
          <BookOpen size={26} strokeWidth={2.4} />
          <div>
            <div className="hb-title">画话本</div>
            <div className="hb-sub">你说一句 · 宝宝说一句 · 画板画一幅</div>
          </div>
        </div>
        <div className="hb-head-btns">
          <button className="hb-ghost" onClick={() => { setPlayIdx(0); setPlaying(true); }}>
            <Play size={16} /> 播放故事
          </button>
          <button className="hb-ghost" onClick={reset} title="从开头重来">
            <RotateCcw size={16} />
          </button>
        </div>
      </header>

      <main className="hb-stage">
        {/* 画板 */}
        <div className="hb-board">
          <div className="hb-tape" />
          <DrawnSvg svg={cur.svg} replayKey={cur.id + "-" + current} />
          <div className="hb-narration">
            <span className="hb-dot" style={{ background: cur.speaker === "dad" ? DAD : KID }} />
            {cur.text}
          </div>
          <div className="hb-page">第 {current + 1} / {scenes.length} 格</div>
        </div>

        {/* 胶片 */}
        <div className="hb-film" ref={filmRef}>
          {scenes.map((s, i) => (
            <button
              key={s.id}
              className={"hb-frame" + (i === current ? " on" : "")}
              onClick={() => setCurrent(i)}
            >
              <div className="hb-frame-svg" dangerouslySetInnerHTML={{ __html: s.svg }} />
              <span className="hb-frame-no" style={{ color: s.speaker === "dad" ? DAD : KID }}>
                {i + 1}
              </span>
            </button>
          ))}
        </div>
      </main>

      {/* 输入区 */}
      <footer className="hb-foot">
        {hint && <div className="hb-hint" onClick={() => setHint("")}>💡 {hint}</div>}
        {err && <div className="hb-err">{err}</div>}

        <div className="hb-who">
          <button
            className={"hb-chip" + (speaker === "dad" ? " on" : "")}
            style={{ "--c": DAD }}
            onClick={() => setSpeaker("dad")}
          >
            爸爸说
          </button>
          <button
            className={"hb-chip" + (speaker === "kid" ? " on" : "")}
            style={{ "--c": KID }}
            onClick={() => setSpeaker("kid")}
          >
            宝宝说
          </button>
          <button className="hb-spark" onClick={getHint} disabled={hinting}>
            {hinting ? <Loader size={15} className="hb-spin" /> : <Sparkles size={15} />}
            接下来呢？
          </button>
        </div>

        <div className="hb-inputbar">
          <button
            className={"hb-mic" + (listening ? " live" : "")}
            onClick={listening ? stopVoice : startVoice}
            title="说话"
          >
            <Mic size={20} />
          </button>
          <input
            className="hb-input"
            value={input}
            placeholder={speaker === "kid" ? "宝宝说……（或者点麦克风）" : "爸爸说……"}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addScene()}
          />
          <button className="hb-send" onClick={addScene} disabled={loading || !input.trim()}>
            {loading ? <Loader size={18} className="hb-spin" /> : <Send size={18} />}
            <span>画出来</span>
          </button>
        </div>
      </footer>

      {/* 播放模式 */}
      {playing && (
        <div className="hb-modal">
          <button className="hb-close" onClick={() => setPlaying(false)}>
            <X size={22} />
          </button>
          <div className="hb-play-board">
            <DrawnSvg svg={scenes[playIdx].svg} replayKey={"play-" + playIdx} />
            <div className="hb-play-text">{scenes[playIdx].text}</div>
          </div>
          <div className="hb-play-ctrl">
            <button onClick={() => setPlayIdx((i) => Math.max(0, i - 1))} disabled={playIdx === 0}>
              <ChevronLeft size={22} />
            </button>
            <span>{playIdx + 1} / {scenes.length}</span>
            <button
              onClick={() => setPlayIdx((i) => Math.min(scenes.length - 1, i + 1))}
              disabled={playIdx === scenes.length - 1}
            >
              <ChevronRight size={22} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=ZCOOL+KuaiLe&family=Ma+Shan+Zheng&family=Noto+Serif+SC:wght@500&display=swap');

.hb-root{
  font-family:'ZCOOL KuaiLe','Noto Serif SC',serif;
  color:${INK};
  background:${PAPER};
  background-image:
    radial-gradient(circle at 1px 1px, rgba(31,28,24,.08) 1px, transparent 0);
  background-size:22px 22px;
  min-height:100vh; display:flex; flex-direction:column;
  max-width:760px; margin:0 auto;
}
.hb-head{display:flex;justify-content:space-between;align-items:center;padding:18px 20px 10px;}
.hb-logo{display:flex;align-items:center;gap:12px;}
.hb-title{font-size:30px;line-height:1;letter-spacing:2px;}
.hb-sub{font-family:'Noto Serif SC',serif;font-size:12px;opacity:.6;margin-top:4px;letter-spacing:1px;}
.hb-head-btns{display:flex;gap:8px;}
.hb-ghost{font-family:inherit;display:flex;align-items:center;gap:6px;background:none;border:2px solid ${INK};
  border-radius:40px;padding:7px 14px;font-size:14px;color:${INK};cursor:pointer;transition:.15s;}
.hb-ghost:hover{background:${INK};color:${PAPER};}

.hb-stage{flex:1;padding:6px 20px 12px;}
.hb-board{position:relative;background:#fffdf7;border:2.5px solid ${INK};border-radius:8px;
  padding:24px 22px 16px;box-shadow:6px 7px 0 rgba(31,28,24,.85);}
.hb-tape{position:absolute;top:-12px;left:50%;transform:translateX(-50%) rotate(-2deg);
  width:120px;height:24px;background:rgba(217,98,43,.28);border:1px dashed rgba(31,28,24,.4);border-radius:2px;}
.scene-canvas svg{width:100%;height:auto;display:block;max-height:46vh;}
.hb-narration{font-family:'Ma Shan Zheng',serif;font-size:23px;line-height:1.5;margin-top:10px;
  display:flex;align-items:flex-start;gap:9px;}
.hb-dot{width:11px;height:11px;border-radius:50%;margin-top:9px;flex:0 0 auto;}
.hb-page{position:absolute;bottom:8px;right:14px;font-family:'Noto Serif SC';font-size:12px;opacity:.5;}

.hb-film{display:flex;gap:10px;overflow-x:auto;padding:14px 2px 4px;}
.hb-frame{position:relative;flex:0 0 86px;height:66px;background:#fffdf7;border:2px solid rgba(31,28,24,.35);
  border-radius:6px;cursor:pointer;padding:4px;transition:.15s;}
.hb-frame.on{border-color:${INK};box-shadow:3px 3px 0 ${INK};transform:translateY(-2px);}
.hb-frame-svg svg{width:100%;height:100%;}
.hb-frame-no{position:absolute;bottom:2px;right:5px;font-size:13px;font-weight:bold;}

.hb-foot{padding:10px 20px 22px;}
.hb-hint{font-family:'Noto Serif SC';background:rgba(217,98,43,.14);border:1.5px dashed ${KID};
  border-radius:10px;padding:10px 14px;font-size:15px;margin-bottom:10px;cursor:pointer;}
.hb-err{font-family:'Noto Serif SC';color:${KID};font-size:14px;margin-bottom:8px;}
.hb-who{display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;}
.hb-chip{font-family:inherit;background:#fffdf7;border:2px solid var(--c);color:var(--c);
  border-radius:40px;padding:6px 16px;font-size:15px;cursor:pointer;transition:.15s;}
.hb-chip.on{background:var(--c);color:#fff;}
.hb-spark{font-family:inherit;margin-left:auto;display:flex;align-items:center;gap:6px;background:none;
  border:2px solid ${INK};border-radius:40px;padding:6px 14px;font-size:14px;color:${INK};cursor:pointer;}
.hb-spark:hover{background:${INK};color:${PAPER};}

.hb-inputbar{display:flex;align-items:center;gap:10px;background:#fffdf7;border:2.5px solid ${INK};
  border-radius:50px;padding:6px 6px 6px 8px;box-shadow:4px 5px 0 rgba(31,28,24,.85);}
.hb-mic{flex:0 0 auto;width:42px;height:42px;border-radius:50%;border:2px solid ${INK};background:none;
  color:${INK};display:grid;place-items:center;cursor:pointer;transition:.15s;}
.hb-mic.live{background:${KID};border-color:${KID};color:#fff;animation:hbPulse 1s infinite;}
.hb-input{flex:1;border:none;background:none;outline:none;font-family:'Noto Serif SC',serif;
  font-size:17px;color:${INK};}
.hb-input::placeholder{color:rgba(31,28,24,.4);}
.hb-send{flex:0 0 auto;display:flex;align-items:center;gap:7px;background:${INK};color:${PAPER};
  border:none;border-radius:40px;padding:11px 20px;font-family:inherit;font-size:16px;cursor:pointer;transition:.15s;}
.hb-send:disabled{opacity:.4;cursor:default;}

.hb-modal{position:fixed;inset:0;background:rgba(31,28,24,.92);z-index:50;display:flex;
  flex-direction:column;align-items:center;justify-content:center;gap:24px;padding:20px;}
.hb-close{position:absolute;top:18px;right:18px;background:none;border:2px solid ${PAPER};color:${PAPER};
  border-radius:50%;width:42px;height:42px;display:grid;place-items:center;cursor:pointer;}
.hb-play-board{background:#fffdf7;border-radius:10px;padding:24px;max-width:560px;width:100%;}
.hb-play-board .scene-canvas svg{max-height:55vh;}
.hb-play-text{font-family:'Ma Shan Zheng',serif;font-size:26px;text-align:center;margin-top:14px;color:${INK};}
.hb-play-ctrl{display:flex;align-items:center;gap:22px;color:${PAPER};font-size:18px;}
.hb-play-ctrl button{background:none;border:2px solid ${PAPER};color:${PAPER};border-radius:50%;
  width:46px;height:46px;display:grid;place-items:center;cursor:pointer;}
.hb-play-ctrl button:disabled{opacity:.3;}

/* 线条自己"画出来" */
.hb-draw svg path,.hb-draw svg line,.hb-draw svg polyline,.hb-draw svg circle,.hb-draw svg ellipse,.hb-draw svg rect{
  stroke-dasharray:700;stroke-dashoffset:700;animation:hbDraw 1.5s ease forwards;}
.hb-draw svg *:nth-child(2){animation-delay:.15s}
.hb-draw svg *:nth-child(3){animation-delay:.3s}
.hb-draw svg *:nth-child(4){animation-delay:.45s}
.hb-draw svg *:nth-child(n+5){animation-delay:.6s}
@keyframes hbDraw{to{stroke-dashoffset:0}}
@keyframes hbPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
.hb-spin{animation:hbRot 1s linear infinite}
@keyframes hbRot{to{transform:rotate(360deg)}}

@media(max-width:520px){
  .hb-title{font-size:24px}
  .hb-narration{font-size:20px}
  .hb-send span{display:none}
}
`;
