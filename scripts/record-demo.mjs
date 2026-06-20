// Records the "B-clip": loads the pre-seeded 5-frame story and plays it back
// as the animated picture book, capturing the whole thing to a .webm video.
// No API key / network needed — the story is static SVG in localStorage.
//
// Prereq: dev server running at http://localhost:3000  (npm run dev)
// Run:    node scripts/record-demo.mjs
// Output: demo-video/saydraw-playback.webm

import { chromium } from 'playwright';
import { buildState } from './demo-seed-data.mjs';
import fs from 'fs';
import path from 'path';

const URL = process.env.DEMO_URL || 'http://localhost:3000';
const OUT_DIR = path.resolve(import.meta.dirname, '..', 'demo-video');
const SIZE = { width: 1280, height: 720 };

fs.mkdirSync(OUT_DIR, { recursive: true });

const state = buildState();

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: SIZE,
  deviceScaleFactor: 2,
  recordVideo: { dir: OUT_DIR, size: SIZE },
});
const page = await context.newPage();

// Seed localStorage BEFORE the app's JS runs so it boots straight into the
// finished 5-frame story.
await page.addInitScript((story) => {
  localStorage.setItem('saydraw-story', story);
  localStorage.setItem('saydraw_lang', 'en');
}, JSON.stringify(state));

await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });

// Establishing shot — let fonts settle and show the filmstrip of 5 frames.
await page.waitForTimeout(4000);

// Open the playback modal.
await page.getByRole('button', { name: 'Play story' }).click();

// Playback auto-advances every 3.8s across 5 frames (~15.2s) and each frame
// redraws its strokes (~2.1s). Give it the full run plus a hold on the finale.
await page.waitForTimeout(19000);
await page.waitForTimeout(2000);

await context.close(); // finalizes and flushes the video file
await browser.close();

// Give the captured clip a stable name.
const webm = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.webm')).sort();
if (webm.length === 0) {
  console.error('No video produced.');
  process.exit(1);
}
const finalPath = path.join(OUT_DIR, 'saydraw-playback.webm');
const latest = path.join(OUT_DIR, webm[webm.length - 1]);
if (latest !== finalPath) fs.renameSync(latest, finalPath);
const kb = (fs.statSync(finalPath).size / 1024).toFixed(0);
console.log(`OK -> ${finalPath} (${kb} KB)`);
