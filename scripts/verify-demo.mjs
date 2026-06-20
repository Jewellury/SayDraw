// Sanity check: screenshots the seeded home + a mid-playback frame so we can
// confirm the recorded video shows real content. Writes PNGs to demo-video/.
import { chromium } from 'playwright';
import { buildState } from './demo-seed-data.mjs';
import path from 'path';

const OUT = path.resolve(import.meta.dirname, '..', 'demo-video');
const state = buildState();

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.addInitScript((s) => {
  localStorage.setItem('saydraw-story', s);
  localStorage.setItem('saydraw_lang', 'en');
}, JSON.stringify(state));
await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: path.join(OUT, 'verify-1-home.png') });

await page.getByRole('button', { name: 'Play story' }).click();
await page.waitForTimeout(6000); // a couple frames in
await page.screenshot({ path: path.join(OUT, 'verify-2-playback.png') });

await browser.close();
console.log('screenshots written');
