// Builds a paste-ready browser-console snippet that pre-loads a polished
// 5-frame story into localStorage, for recording the "play back the animated
// picture book" shot without live API calls. Reuses the existing hand-drawn
// SVGs from the source so nothing is hand-copied.
//
// Run:  node scripts/build-demo-seed.mjs
// Then: paste scripts/demo-seed-console.txt into the browser console on the app.

import fs from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..');

const mock = fs.readFileSync(path.join(root, 'lib/ai/mock.ts'), 'utf8');
const page = fs.readFileSync(path.join(root, 'app/page.tsx'), 'utf8');

// Extract the 4 scene SVGs (butterfly, frog, friends, rainbow).
const sceneSvgs = [...mock.matchAll(/svg:\s*`([\s\S]*?)`/g)].map((m) => m[1]);
// Extract the seed SVG (fainted dino) from the page.
const seedSvg = page.match(/const SEED_SVG = `([\s\S]*?)`/)[1];

if (sceneSvgs.length < 4 || !seedSvg) {
  console.error('Extraction failed — sceneSvgs:', sceneSvgs.length, 'seed:', !!seedSvg);
  process.exit(1);
}

// Alternating dad/kid voices, English narration (swap to zh if you prefer).
const frames = [
  { id: 1, speaker: 'dad', text: 'A meteor fell from the moon and bonked a little dinosaur on the head — ROAR! It fainted.', svg: seedSvg },
  { id: 2, speaker: 'kid', text: 'A butterfly landed softly on a petal, and the little dinosaur stared in wonder.', svg: sceneSvgs[0] },
  { id: 3, speaker: 'dad', text: 'Suddenly, a little frog hopped out of the flowers!', svg: sceneSvgs[1] },
  { id: 4, speaker: 'kid', text: 'The frog and the little dinosaur became good friends.', svg: sceneSvgs[2] },
  { id: 5, speaker: 'dad', text: 'Together they set off to see the rainbow in the distance.', svg: sceneSvgs[3] },
];

const state = { scenes: frames, current: 4, speaker: 'kid' };

const snippet =
  `// Paste into the browser console while the app is open, then it reloads.\n` +
  `localStorage.setItem('saydraw-story', ${JSON.stringify(JSON.stringify(state))});\n` +
  `localStorage.setItem('saydraw_lang', 'en');\n` +
  `location.reload();\n`;

const outPath = path.join(root, 'scripts/demo-seed-console.txt');
fs.writeFileSync(outPath, snippet);
console.log('Wrote', outPath, `(${snippet.length} chars, 5 frames)`);
