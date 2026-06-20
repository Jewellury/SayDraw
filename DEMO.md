# SayDraw — 60-second demo recording guide

The painless way: **never narrate live while operating the app.** Record the
screen silently, then add captions (or dub a voiceover afterward). Shoot it as
**two short clips** and cut them together — each is individually low-risk.

## Before you record
1. `npm run dev`, open `http://localhost:3000` in a clean, maximized browser
   window (hide bookmarks bar; zoom 100%).
2. Confirm real API keys are in `.env.local` so frames actually draw (not the
   fallback face).
3. Windows recorder: **Win + G** → record the browser. For editing/captions,
   **Clipchamp** (built into Windows 11) is enough — no install.

---

## Clip A — live voice + live draw (~0:00–0:30)
The one authentic moment. Start from a fresh story (click the ↺ reset button).

| Time | Action on screen | Caption / voiceover |
|------|------------------|---------------------|
| 0:00–0:08 | App home, seed frame visible | "This is SayDraw — a parent and child take turns telling a story, one line each." |
| 0:08–0:20 | **Press & hold the mic**, say softly *"一只小猫坐在月亮上"* (or in English), release. Watch the input show **"Transcribing…"**, then the text appears. | "You just speak. Volcano ASR is tuned for soft children's voices." |
| 0:20–0:30 | Tap the **draw** button. Watch the SVG **draw itself line by line**. | "Every line becomes a hand-sketched drawing, live." |

> Tip: speak quietly on purpose — it shows the ASR handling a child's volume.
> If the draw looks off, just reset and retry; it's only a 10-second take.

## Clip B — animated picture-book playback (~0:30–1:00)
Guaranteed good, zero waiting. Use the pre-seeded 5-frame story.

1. Open the browser **console** (F12) and paste the contents of
   **`scripts/demo-seed-console.txt`**. The page reloads with a full 5-frame
   story (dino → butterfly → frog → friends → rainbow), voices alternating.
2. Start recording, then:

| Time | Action on screen | Caption / voiceover |
|------|------------------|---------------------|
| 0:30–0:40 | Show the filmstrip — 5 numbered frames, parent/child colors alternating | "The story grows frame by frame, parent and child trading lines." |
| 0:40–1:00 | Click **Play story**. Each frame's lines redraw on screen in the player. | "At the end, play back the whole animated picture book — a story neither of you owns, that surprises you both." |

---

## If you want a voiceover instead of captions
Record both clips silently first, cut them together, then read the right-hand
column **once** over the finished video. You're only talking, not clicking —
no conflict with the mic input, no retakes from fumbling.

## Regenerate the seed
`node scripts/build-demo-seed.mjs` rewrites `scripts/demo-seed-console.txt`.
Edit the `frames` array in that script to change the narration text or switch
to Chinese.
