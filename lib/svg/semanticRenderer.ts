import { componentRegistry } from './componentLib';

interface ComponentSpec {
  id: string;
  role: 'support' | 'character' | 'detail' | 'background';
  drawOrder: number;
}

const ViewBox = { w: 400, h: 300 };

function randomInRange(seed: number, min: number, max: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return min + ((s - Math.floor(s)) * (max - min));
}

function buildSvg(
  elements: Array<{ id: string; x: number; y: number; role: string; svg: string }>,
  orderMap: Map<string, number>
): string {
  const sorted = [...elements].sort((a, b) => {
    const ao = orderMap.get(a.id) ?? 99;
    const bo = orderMap.get(b.id) ?? 99;
    return ao - bo;
  });

  const parts: string[] = [];
  parts.push(
    `<svg viewBox="0 0 ${ViewBox.w} ${ViewBox.h}" xmlns="http://www.w3.org/2000/svg">`
  );

  for (const el of sorted) {
    parts.push(`<g transform="translate(${el.x}, ${el.y})">${el.svg}</g>`);
  }

  parts.push('</svg>');
  return parts.join('\n');
}

export function renderScene(components: ComponentSpec[]): string {
  const supportedIds = new Set(components.map((c) => c.id));
  const orderMap = new Map(components.map((c) => [c.id, c.drawOrder]));

  const supportY = 220;
  const groundY = 270;

  const rendered: Array<{ id: string; x: number; y: number; role: string; svg: string }> = [];

  const supportX = 200;

  if (supportedIds.has('ground')) {
    rendered.push({
      id: 'ground',
      x: 0,
      y: groundY,
      role: 'background',
      svg: componentRegistry['ground'](),
    });
  }

  for (const comp of components) {
    if (comp.role === 'support' && supportedIds.has(comp.id)) {
      rendered.push({
        id: comp.id,
        x: supportX,
        y: supportY,
        role: 'support',
        svg: componentRegistry[comp.id]?.(),
      });
      break;
    }
  }

  const charComps = components.filter(
    (c) => c.role === 'character' && supportedIds.has(c.id)
  );
  charComps.sort((a, b) => a.drawOrder - b.drawOrder);
  const charX = supportX;
  const charBaseY = supportY - 35;
  const charHeads = ['cat_head', 'dino_head'];
  const charBodies = ['cat_body', 'dino_body'];
  const charTails = ['cat_tail'];

  const placedChars: Array<{ id: string; x: number; y: number }> = [];

  for (const comp of charComps) {
    let cx = charX;
    let cy = charBaseY;

    if (charBodies.includes(comp.id)) {
      cx = charX;
      cy = charBaseY;
    } else if (charHeads.includes(comp.id)) {
      cx = charX;
      cy = charBaseY - 32;
    } else if (charTails.includes(comp.id)) {
      cx = charX - 35;
      cy = charBaseY + 2;
    }

    rendered.push({
      id: comp.id,
      x: cx,
      y: cy,
      role: 'character',
      svg: componentRegistry[comp.id]?.(),
    });
    placedChars.push({ id: comp.id, x: cx, y: cy });
  }

  const detailComps = components.filter(
    (c) => c.role === 'detail' && supportedIds.has(c.id)
  );

  for (const comp of detailComps) {
    let dx = charX;
    let dy = charBaseY - 32;

    for (const pc of placedChars) {
      if (charHeads.includes(pc.id)) {
        dx = pc.x;
        dy = pc.y;
        break;
      }
    }

    rendered.push({
      id: comp.id,
      x: dx,
      y: dy,
      role: 'detail',
      svg: componentRegistry[comp.id]?.(),
    });
  }

  const bgComps = components.filter(
    (c) =>
      c.role === 'background' && supportedIds.has(c.id) && c.id !== 'ground'
  );

  for (let i = 0; i < bgComps.length; i++) {
    const comp = bgComps[i];
    const seed = orderMap.get(comp.id) ?? i;
    const bx = randomInRange(seed, 50, 350);
    const by = randomInRange(seed + 100, 20, 120);

    rendered.push({
      id: comp.id,
      x: bx,
      y: by,
      role: 'background',
      svg: componentRegistry[comp.id]?.(),
    });
  }

  return buildSvg(rendered, orderMap);
}
