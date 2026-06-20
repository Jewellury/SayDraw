## Inspiration
I have a four-year-old and a one-year-old. Every evening, there's this gap between us — I'm deep in code, which means nothing to him, and he wants to read the same dinosaur book for the tenth time, which I can't get excited about. We kept missing each other.

Then one night I asked him "what does the dinosaur do next?" instead of reading the page. He lit up. He invented a story — a meteor, a moon, a butterfly. Five minutes in, he'd told me more about his day at preschool than a month of "how was school?" ever got me. I realized I hadn't just found a game. I'd found a window.

That night I started building SayDraw. The constraint was never "build a drawing app." The constraint was "build the one thing neither of us owns, that surprises us both."

## What it does
SayDraw is a voice-first storytelling canvas for a parent and a young child. You take turns speaking one line of a story out loud. Each line is drawn in real time as a hand-sketched, black-and-white line illustration that draws *itself* stroke by stroke — like a pencil appearing on paper — with a short caption underneath. Line by line, your improvised spoken story becomes an animated picture book you can play back together.

When a child runs out of steam, a gentle "what happens next?" button nudges them with an open-ended question in a parent's voice.

The magic is that neither person owns the story. You both speak, you both watch something appear, and the result belongs to both of you. More quietly, it's also a record — everything a small child invents comes from their real world, which means the dinosaurs and meteors are also a window into what's actually in their head.

## How we built it
**Front end:** Next.js 15 (React, TypeScript, App Router), deployed on Vercel. The entire interface is designed for a child to operate independently — no keyboard required, press-and-hold mic, large touch targets.

**Speech recognition:** Volcano Engine's streaming ASR (大模型流式语音识别), tuned for child voices. This was a deliberate switch from the browser's built-in Web Speech API, which couldn't reliably pick up a four-year-old's soft, high-pitched voice. Audio is captured client-side via AudioWorklet (raw PCM at 16 kHz mono), then proxied through a Vercel serverless route that acts as a WebSocket client to Volcano's `bigmodel_nostream` endpoint — bypassing the limitation that browser WebSocket connections can't carry custom authentication headers.

**Drawing — two complementary engines:**

1. **Direct SVG generation** (default): DeepSeek V3 receives the full story context plus the latest line, and returns a structured JSON response with narration, a follow-up question, a story summary, and a complete SVG string. The prompt includes 3 few-shot examples and strict constraints: `viewBox="0 0 400 300"`, `stroke="#211e18"`, `fill="none"`, 8–14 elements, three-tier stroke-width hierarchy. Every SVG is sanitized server-side to strip scripts, event handlers, and external links. The stroke-dashoffset animation plays client-side, making lines appear to draw themselves.

2. **Semantic renderer** (bypass path): Instead of asking the LLM to write raw SVG coordinates — which language models are fundamentally bad at — the model outputs a lightweight JSON structure describing the scene in semantic terms: what characters are present, what pose they're in, what scene type it is (sitting, standing, flying, fainted, interaction, sky), and what components to use. A deterministic layout engine then assembles 20 hand-drawn Rough.js SVG components (cat, dinosaur, moon, star, flower, cloud, meteor, heart, etc.) with proper layering and spacing. This path is measurably faster and produces more recognizable drawings.

**Analytics:** Instrumented with Novus.ai — tracking story turns, frame generation, hints, playback, voice input start/completion, and generation failures. The semantic renderer path is tagged separately so we can measure adoption and quality differences between the two drawing engines.

**Task management:** All engineering work was run through a three-agent system (plan → execute → audit), with full decision traceability via Architecture Decision Records. Thirteen ADRs document every major technical choice — why we picked streaming over one-shot, why the semantic renderer exists, why we stayed on DeepSeek after a three-day bakeoff.

## Challenges we ran into
**The model that was supposed to fix everything didn't work.** Our original plan was to use Doubao-pro (Volcano Ark) for higher-quality SVG. We integrated the entire provider, wrote the resolver, set up env-preference switching — and discovered the endpoint was a vision model, not a text model. It timed out at 30+ seconds. We tried Doubao-lite: 25 seconds. We ran a formal three-way bakeoff and found the model we were about to replace — DeepSeek V3 — was 50× faster and produced comparable quality after prompt improvements. The lesson wasn't "DeepSeek is better than Doubao." It was "test before you switch."

**Browsers can't set custom headers on WebSocket connections.** Volcano's ASR requires authentication headers (`X-Api-Key`, `X-Api-Resource-Id`) on the WebSocket handshake — something neither browser WebSocket APIs nor the W3C spec support. We couldn't run a self-hosted relay (too much ops for a child's toy). The solution: Vercel serverless functions *can* act as WebSocket clients (outbound), just not as WebSocket servers (inbound). So the browser sends a standard HTTP POST with raw audio bytes, the Vercel route opens a WebSocket connection to Volcano as a client, forwards the binary protocol frames, and returns the transcript. This architecture took three full rewrites to land on.

**LLMs fundamentally cannot draw.** Language models are not CAD software. Our first version asked DeepSeek to output raw SVG coordinates — the results were geometrically correct but unrecognizable to a child. A "dinosaur" was an irregular ellipse with four lines. A "cat on a moon" was a big circle and a small circle. After two rounds of external AI research — including literature reviews covering OmniSVG, Render-in-the-Loop, and LLM4SVG — we concluded the right approach was to let the model describe *what* to draw in plain language, and let deterministic code handle *how* to draw it. The semantic renderer was built in response to this finding.

**The agent system sometimes failed silently.** When sub-agent tasks ran past 30 minutes, the platform timed out with no recovery. We learned to split long tasks into checkpoints and to never run critical model selection decisions through long agent chains — those belong in quick, manual bakeoff scripts.

## Accomplishments that we're proud of
**The voice pipeline ships, and it works for children.** Average end-to-end latency is 1–2 seconds from release to transcript. The three-tier fallback (Volcano → Web Speech → typing) means the app is always playable, even without API keys.

**We built two drawing engines, not one.** The direct SVG path handles any story that comes its way. The semantic renderer handles the six most common scene types with measurably better quality. Both paths are live, both are tested, and switching between them is a query parameter.

**We documented every decision.** Thirteen Architecture Decision Records capture why we chose streaming over one-shot, why the semantic renderer exists, why we stayed on DeepSeek, and nine other key choices. A plain-language technical overview document means a new team member — or our future selves — can understand the whole architecture in five minutes.

**We ran a proper evaluation loop.** Two rounds of external AI research. A formal model bakeoff. Side-by-side visual comparison pages. The semantic renderer wasn't a gut decision — it was the conclusion of an evidence chain that started with "the drawings look worse than we expected" and ended with "here's a hybrid architecture backed by three published papers."

**The task management system worked.** Ten tasks, three agents, zero unapproved code changes. Every line of product code can be traced to an approved task plan.

## What we learned
**1. Constraints make products, not features.** I started imagining full color. Watching my son, I threw it out. Black-and-white line drawings that appear stroke by stroke are more magical to a four-year-old than anything polished. The constraint shipped the product in a week instead of never.

**2. Voice-first wasn't a feature — it was the whole bet.** I planned it as a nice-to-have. It became the difference between a toy I operate *for* him and a toy *he* operates. It also forced the WebSocket relay puzzle, which taught us more about Vercel's capabilities than the rest of the project combined.

**3. Bakeoffs beat assumptions.** We were convinced we needed a better model. We integrated it. We wired the fallback. We were one env variable away from shipping — and then a 10-minute comparison script showed it was 50× slower. Testing before switching isn't a best practice; it's the only practice.

**4. Let models do what they're good at.** LLMs write terrible SVG coordinates. They're excellent at describing scenes in plain language. The moment we stopped asking the model to draw and started asking it to *curate*, everything improved: quality, speed, and our ability to debug.

**5. Sub-agents need checkpoints.** Long-running autonomous tasks fail silently. We learned to split work into 5–15 minute chunks with hard save points. The three-agent plan→execute→audit cycle was valuable, but we should have applied it to its own execution — shorter cycles, shorter runs.

## What's next for SayDraw
The immediate priority is expanding the semantic renderer from 6 scene types to covering the full range of a four-year-old's imagination — walking, hiding, eating, swimming, flying, dancing. With 20 components already built, each new scene type is about 50 lines of deterministic layout code.

Longer term, I want to build a "Little Notebook" — a feature that quietly saves every line my son says across weeks and months, then stitches them back into a single page: *"The world your child built this month."* The picture book is the hook. The record of a small mind growing up is the reason to keep it.

I also want to release the task management system and agent charters as open-source tooling. The plan→execute→audit workflow with Architecture Decision Records proved valuable beyond this project, and other small teams building with AI agents deserve a lightweight alternative to Jira.
