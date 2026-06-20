import { chromium } from 'playwright';
import { buildState } from './demo-seed-data.mjs';

const state = buildState();
const json = JSON.stringify(state);
console.log('built state: scenes=', state.scenes.length, 'json chars=', json.length);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();

// Approach: navigate first, then set localStorage + reload (mirrors console paste).
await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.evaluate((s) => {
  localStorage.setItem('saydraw-story', s);
  localStorage.setItem('saydraw_lang', 'en');
}, json);

const stored = await page.evaluate(() => (localStorage.getItem('saydraw-story') || '').length);
console.log('localStorage after set: chars=', stored);

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

const afterReload = await page.evaluate(() => {
  let parsed = null;
  try { parsed = JSON.parse(localStorage.getItem('saydraw-story') || 'null'); } catch {}
  return {
    lsChars: (localStorage.getItem('saydraw-story') || '').length,
    lsScenes: parsed && parsed.scenes ? parsed.scenes.length : 'n/a',
    pageText: document.querySelector('.hb-page')?.textContent || 'n/a',
    filmThumbs: document.querySelectorAll('.hb-frame').length,
  };
});
console.log('after reload:', JSON.stringify(afterReload));

await browser.close();
