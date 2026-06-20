// Self-contained verifier: each few-shot SVG passes sanitizeSvg() semantics + AC5.
// Artifact only.
import { readFile } from 'node:fs/promises';

const src = await readFile('./lib/ai/prompts.ts', 'utf8');
// Capture from `export const INK` onward through COMBINED_SYS assignment
const inkStart = src.indexOf("export const INK =");
const combinedEnd = src.indexOf("只输出 JSON，不要任何其他内容。';", inkStart);
const combinedSrc = src.slice(inkStart, combinedEnd + "只输出 JSON，不要任何其他内容。'".length)
  .replace(/export\s+const\s+/g, 'const ');

// Crude eval of the string-concat chain (safe — only string concatenation in this block)
const COMBINED_SYS = (new Function(`${combinedSrc}; return COMBINED_SYS;`))();

// Inline replica of lib/svg/sanitizeSvg.ts
function sanitizeSvg(raw) {
  let svg = String(raw || '');
  svg = svg.replace(/<script[\s\S]*?\/script>/gi, '');
  svg = svg.replace(/<foreignObject[\s\S]*?\/foreignObject>/gi, '');
  svg = svg.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
  svg = svg.replace(/\s+on\w+\s*=\s*[^\s/>]+/gi, '');
  svg = svg.replace(/\s+(xlink:)?href\s*=\s*["']https?:\/\/[^"']*["']/gi, '');
  svg = svg.replace(/\s+(xlink:)?href\s*=\s*["']javascript:[^"']*["']/gi, '');
  return svg;
}

const matches = [...COMBINED_SYS.matchAll(/<svg[\s\S]*?<\/svg>/g)];
console.log(`Found ${matches.length} SVG examples in COMBINED_SYS`);

const forbiddenPatterns = [
  ['<script', /<script/i],
  ['<foreignObject', /<foreignObject/i],
  ['on*= attribute', /\son\w+\s*=/i],
  ['external href', /href\s*=\s*["']https?:/i],
  ['javascript: href', /href\s*=\s*["']javascript:/i],
  ['<text> element', /<text[\s>]/i],
  ['non-ink stroke color', /stroke\s*=\s*["'](?!#211e18|#1f1c18)["'][^"']*["']/i],
  ['non-none fill', /fill\s*=\s*["'](?!none)["'][^"']*["']/i],
];

let allPass = true;
matches.forEach((m, i) => {
  const original = m[0];
  const cleaned = sanitizeSvg(original);
  const stripped = original.length - cleaned.length;

  // Count visible shape elements
  const opens = original.match(/<\w+/g) || [];
  const closes = original.match(/\/>/g) || [];
  const elementCount = opens.length - 1; // minus <svg> itself
  const hasViewBox = original.includes('viewBox="0 0 400 300"');
  const hasInk = original.includes('stroke="#211e18"');

  // Stroke-width tiers
  const hasTier3 = /stroke-width="3"/.test(original);
  const hasTier2 = /stroke-width="2"/.test(original);
  const hasTier15 = /stroke-width="1.5"/.test(original);
  const hasRoundCap = original.includes('stroke-linecap="round"');
  const hasRoundJoin = original.includes('stroke-linejoin="round"');

  console.log(`\n--- Example ${i + 1} ---`);
  console.log(`  elements (excl <svg>): ${elementCount}`);
  console.log(`  viewBox 0 0 400 300: ${hasViewBox} | ink #211e18: ${hasInk}`);
  console.log(`  stroke tiers 3/2/1.5: ${hasTier3}/${hasTier2}/${hasTier15}`);
  console.log(`  linecap=round: ${hasRoundCap} | linejoin=round: ${hasRoundJoin}`);
  console.log(`  sanitizer stripped ${stripped} chars (must be 0)`);

  const violations = forbiddenPatterns.filter(([_, re]) => re.test(original));
  if (violations.length) {
    console.log(`  ❌ FORBIDDEN: ${violations.map(v => v[0]).join(', ')}`);
    allPass = false;
  } else {
    console.log(`  ✅ forbidden-pattern check: PASS`);
  }
  if (stripped > 0) {
    console.log(`  ❌ SANITIZER MODIFIED INPUT`);
    allPass = false;
  }
  if (elementCount < 8 || elementCount > 15) {
    console.log(`  ⚠️  element count ${elementCount} is outside 8-15 guidance`);
  }
});

console.log(`\n=== AC5 result: ${allPass ? 'PASS ✅' : 'FAIL ❌'} ===`);
process.exit(allPass ? 0 : 1);
