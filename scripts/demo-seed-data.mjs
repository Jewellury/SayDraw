// Shared builder for the pre-seeded 5-frame demo story. Reuses the existing
// hand-drawn SVGs from source so nothing is hand-copied. Imported by both
// build-demo-seed.mjs (console snippet) and record-demo.mjs (video).

import fs from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..');

export function buildState() {
  const mock = fs.readFileSync(path.join(root, 'lib/ai/mock.ts'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'app/page.tsx'), 'utf8');

  const sceneSvgs = [...mock.matchAll(/svg:\s*`([\s\S]*?)`/g)].map((m) => m[1]);
  const seedSvg = page.match(/const SEED_SVG = `([\s\S]*?)`/)[1];

  if (sceneSvgs.length < 4 || !seedSvg) {
    throw new Error(`Extraction failed — sceneSvgs:${sceneSvgs.length} seed:${!!seedSvg}`);
  }

  const frames = [
    { id: 1, speaker: 'dad', text: 'A meteor fell from the moon and bonked a little dinosaur on the head — ROAR! It fainted.', svg: seedSvg },
    { id: 2, speaker: 'kid', text: 'A butterfly landed softly on a petal, and the little dinosaur stared in wonder.', svg: sceneSvgs[0] },
    { id: 3, speaker: 'dad', text: 'Suddenly, a little frog hopped out of the flowers!', svg: sceneSvgs[1] },
    { id: 4, speaker: 'kid', text: 'The frog and the little dinosaur became good friends.', svg: sceneSvgs[2] },
    { id: 5, speaker: 'dad', text: 'Together they set off to see the rainbow in the distance.', svg: sceneSvgs[3] },
  ];

  return { scenes: frames, current: 4, speaker: 'kid' };
}
