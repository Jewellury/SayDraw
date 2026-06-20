import { componentRegistry } from './componentLib';

interface ComponentSpec {
  id: string;
  role: 'support' | 'character' | 'detail' | 'background';
  drawOrder: number;
}

interface RenderElement {
  id: string;
  x: number;
  y: number;
  role: string;
  svg: string;
  groupKey?: string;
}

interface GroupInfo {
  transform: string;
  drawOrder: number;
}

const ViewBox = { w: 400, h: 300 };

function randomInRange(seed: number, min: number, max: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return min + ((s - Math.floor(s)) * (max - min));
}

function buildSvg(
  elements: RenderElement[],
  orderMap: Map<string, number>,
  groups?: Record<string, GroupInfo>
): string {
  const groupElements = new Map<string, RenderElement[]>();
  const standalone: RenderElement[] = [];

  for (const el of elements) {
    if (el.groupKey && groups && groups[el.groupKey]) {
      const arr = groupElements.get(el.groupKey) || [];
      arr.push(el);
      groupElements.set(el.groupKey, arr);
    } else {
      standalone.push(el);
    }
  }

  // Determine group ordering by drawOrder
  const groupEntries = [...groupElements.entries()].sort((a, b) => {
    const ao = groups?.[a[0]]?.drawOrder ?? 99;
    const bo = groups?.[b[0]]?.drawOrder ?? 99;
    return ao - bo;
  });

  const sortedStandalone = [...standalone].sort((a, b) => {
    const ao = orderMap.get(a.id) ?? 99;
    const bo = orderMap.get(b.id) ?? 99;
    return ao - bo;
  });

  const parts: string[] = [];
  parts.push(
    `<svg viewBox="0 0 ${ViewBox.w} ${ViewBox.h}" xmlns="http://www.w3.org/2000/svg">`
  );

  for (const el of sortedStandalone) {
    parts.push(`<g transform="translate(${el.x}, ${el.y})">${el.svg}</g>`);
  }

  for (const [, groupEls] of groupEntries) {
    const gInfo = groups![groupEls[0].groupKey!];
    const sortedGroup = [...groupEls].sort((a, b) => {
      const ao = orderMap.get(a.id) ?? 99;
      const bo = orderMap.get(b.id) ?? 99;
      return ao - bo;
    });
    parts.push(`<g transform="${gInfo.transform}">`);
    for (const el of sortedGroup) {
      parts.push(`<g transform="translate(${el.x}, ${el.y})">${el.svg}</g>`);
    }
    parts.push('</g>');
  }

  parts.push('</svg>');
  return parts.join('\n');
}

// ---- Scene Type Inference (fallback) ----

export function inferSceneType(components: ComponentSpec[]): string {
  const ids = new Set(components.map((c) => c.id));
  const charComps = components.filter((c) => c.role === 'character');
  const prefixes = new Set<string>();
  for (const c of charComps) {
    const prefix = c.id.split('_')[0];
    if (prefix) prefixes.add(prefix);
  }

  if (prefixes.size >= 2) return 'interaction';
  if (!components.some((c) => c.role === 'support')) return 'standing';
  if (components.some((c) => c.role === 'support')) return 'sitting';
  return 'sitting';
}

// ---- Layout: Sitting ----

function renderSitting(components: ComponentSpec[]): string {
  const supportedIds = new Set(components.map((c) => c.id));
  const orderMap = new Map(components.map((c) => [c.id, c.drawOrder]));

  const supportY = 220;
  const groundY = 270;
  const supportX = 200;

  const rendered: RenderElement[] = [];

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

// ---- Layout: Standing ----

function renderStanding(components: ComponentSpec[]): string {
  const supportedIds = new Set(components.map((c) => c.id));
  const orderMap = new Map(components.map((c) => [c.id, c.drawOrder]));

  const groundY = 270;
  const charX = 200;
  const charHeads = ['cat_head', 'dino_head'];
  const charBodies = ['cat_body', 'dino_body'];
  const charTails = ['cat_tail'];

  const rendered: RenderElement[] = [];

  if (supportedIds.has('ground')) {
    rendered.push({
      id: 'ground',
      x: 0,
      y: groundY,
      role: 'background',
      svg: componentRegistry['ground'](),
    });
  }

  const charComps = components.filter(
    (c) => c.role === 'character' && supportedIds.has(c.id)
  );
  charComps.sort((a, b) => a.drawOrder - b.drawOrder);

  const placedChars: Array<{ id: string; x: number; y: number }> = [];

  for (const comp of charComps) {
    let cx = charX;
    let cy = 235;

    if (charBodies.includes(comp.id)) {
      cx = charX;
      cy = 235;
    } else if (charHeads.includes(comp.id)) {
      cx = charX;
      cy = 200;
    } else if (charTails.includes(comp.id)) {
      cx = charX - 35;
      cy = 237;
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
    let dy = 200;

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

  const grassComps = bgComps.filter((c) => c.id === 'grass');
  const otherBg = bgComps.filter((c) => c.id !== 'grass');

  for (let i = 0; i < grassComps.length; i++) {
    const grassX = [60, 200, 340, 130, 270][i % 5];
    rendered.push({
      id: 'grass',
      x: grassX,
      y: groundY,
      role: 'background',
      svg: componentRegistry['grass']?.(),
    });
  }

  for (let i = 0; i < otherBg.length; i++) {
    const comp = otherBg[i];
    const seed = orderMap.get(comp.id) ?? i;
    const bx = randomInRange(seed, 30, 370);
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

// ---- Layout: Flying ----

function renderFlying(components: ComponentSpec[]): string {
  const supportedIds = new Set(components.map((c) => c.id));
  const orderMap = new Map(components.map((c) => [c.id, c.drawOrder]));

  const groundY = 270;
  const rendered: RenderElement[] = [];
  const groups: Record<string, GroupInfo> = {};
  const charHeads = ['cat_head', 'dino_head'];
  const charBodies = ['cat_body', 'dino_body'];

  if (supportedIds.has('ground')) {
    rendered.push({
      id: 'ground',
      x: 0,
      y: groundY,
      role: 'background',
      svg: componentRegistry['ground'](),
    });
  }

  if (supportedIds.has('meteor')) {
    rendered.push({
      id: 'meteor',
      x: 240,
      y: 120,
      role: 'character',
      svg: componentRegistry['meteor']?.(),
      groupKey: 'meteor',
    });
    groups['meteor'] = { transform: 'translate(240, 120) rotate(-45)', drawOrder: 4 };
  }

  if (supportedIds.has('motion_lines')) {
    rendered.push({
      id: 'motion_lines',
      x: 190,
      y: 145,
      role: 'background',
      svg: componentRegistry['motion_lines']?.(),
    });
  }

  const charComps = components.filter(
    (c) =>
      c.role === 'character' &&
      supportedIds.has(c.id) &&
      c.id !== 'meteor'
  );
  charComps.sort((a, b) => a.drawOrder - b.drawOrder);

  const placedChars: Array<{ id: string; x: number; y: number }> = [];
  for (const comp of charComps) {
    let cx = 200;
    let cy = 130;

    if (charBodies.includes(comp.id)) {
      cx = 200;
      cy = 130;
    } else if (charHeads.includes(comp.id)) {
      cx = 200;
      cy = 98;
    } else {
      cx = 165;
      cy = 132;
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
    let dx = 200;
    let dy = 98;

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
      c.role === 'background' &&
      supportedIds.has(c.id) &&
      c.id !== 'ground' &&
      c.id !== 'motion_lines'
  );

  for (let i = 0; i < bgComps.length; i++) {
    const comp = bgComps[i];
    const seed = orderMap.get(comp.id) ?? i;
    const bx = randomInRange(seed, 30, 370);
    const by = randomInRange(seed + 100, 20, 100);

    rendered.push({
      id: comp.id,
      x: bx,
      y: by,
      role: 'background',
      svg: componentRegistry[comp.id]?.(),
    });
  }

  return buildSvg(rendered, orderMap, Object.keys(groups).length > 0 ? groups : undefined);
}

// ---- Layout: Fainted ----

function renderFainted(components: ComponentSpec[]): string {
  const supportedIds = new Set(components.map((c) => c.id));
  const orderMap = new Map(components.map((c) => [c.id, c.drawOrder]));

  const groundY = 270;
  const rendered: RenderElement[] = [];
  const groups: Record<string, GroupInfo> = {};

  if (supportedIds.has('ground')) {
    rendered.push({
      id: 'ground',
      x: 0,
      y: groundY,
      role: 'background',
      svg: componentRegistry['ground'](),
    });
  }

  const charHeads = ['cat_head', 'dino_head'];
  const charBodies = ['cat_body', 'dino_body'];
  const charTails = ['cat_tail'];

  const charComps = components.filter(
    (c) => (c.role === 'character' || c.role === 'detail') && supportedIds.has(c.id)
  );
  charComps.sort((a, b) => a.drawOrder - b.drawOrder);

  const charGroupX = 240;
  const charGroupY = 230;

  groups['fainted_char'] = {
    transform: `translate(${charGroupX}, ${charGroupY}) rotate(50)`,
    drawOrder: 3,
  };

  for (const comp of charComps) {
    let cx = 0;
    let cy = 0;

    if (charBodies.includes(comp.id)) {
      cx = 0;
      cy = 0;
    } else if (charHeads.includes(comp.id)) {
      cx = 0;
      cy = -30;
    } else if (comp.role === 'detail') {
      cx = 0;
      cy = -30;
    } else if (charTails.includes(comp.id)) {
      cx = -20;
      cy = 5;
    }

    rendered.push({
      id: comp.id,
      x: cx,
      y: cy,
      role: comp.role,
      svg: componentRegistry[comp.id]?.(),
      groupKey: 'fainted_char',
    });
  }

  if (supportedIds.has('dazed_stars')) {
    rendered.push({
      id: 'dazed_stars',
      x: 265,
      y: 185,
      role: 'background',
      svg: componentRegistry['dazed_stars']?.(),
    });
  }

  const bgComps = components.filter(
    (c) =>
      c.role === 'background' &&
      supportedIds.has(c.id) &&
      c.id !== 'ground' &&
      c.id !== 'dazed_stars'
  );

  for (let i = 0; i < bgComps.length; i++) {
    const comp = bgComps[i];
    const seed = orderMap.get(comp.id) ?? i;

    if (comp.id === 'meteor') {
      rendered.push({
        id: comp.id,
        x: 290,
        y: 210,
        role: 'background',
        svg: componentRegistry[comp.id]?.(),
      });
    } else {
      const bx = randomInRange(seed, 30, 370);
      const by = randomInRange(seed + 100, 20, 100);
      rendered.push({
        id: comp.id,
        x: bx,
        y: by,
        role: 'background',
        svg: componentRegistry[comp.id]?.(),
      });
    }
  }

  return buildSvg(rendered, orderMap, groups);
}

// ---- Layout: Interaction ----

function renderInteraction(components: ComponentSpec[]): string {
  const supportedIds = new Set(components.map((c) => c.id));
  const orderMap = new Map(components.map((c) => [c.id, c.drawOrder]));

  const groundY = 270;
  const rendered: RenderElement[] = [];

  if (supportedIds.has('ground')) {
    rendered.push({
      id: 'ground',
      x: 0,
      y: groundY,
      role: 'background',
      svg: componentRegistry['ground'](),
    });
  }

  const charHeads = ['cat_head', 'dino_head'];
  const charBodies = ['cat_body', 'dino_body'];
  const charTails = ['cat_tail'];

  const charComps = components.filter(
    (c) => c.role === 'character' && supportedIds.has(c.id)
  );

  // Group by prefix (cat_*, dino_*)
  const prefixGroups = new Map<string, ComponentSpec[]>();
  for (const c of charComps) {
    const prefix = c.id.split('_')[0];
    if (prefix) {
      const arr = prefixGroups.get(prefix) || [];
      arr.push(c);
      prefixGroups.set(prefix, arr);
    }
  }

  const prefixes = [...prefixGroups.keys()];
  const charAPrefix = prefixes[0];
  const charBPrefix = prefixes[1];

  const charAX = 150;
  const charBX = 260;

  const placedChars: Array<{ id: string; x: number; y: number; prefix: string }> = [];

  function layoutChar(comps: ComponentSpec[], baseX: number, prefix: string) {
    for (const comp of comps) {
      let cx = baseX;
      let cy = 235;

      if (charBodies.includes(comp.id)) {
        cx = baseX;
        cy = 235;
      } else if (charHeads.includes(comp.id)) {
        cx = baseX;
        cy = 200;
      } else if (charTails.includes(comp.id)) {
        cx = baseX - 35;
        cy = 237;
      }

      rendered.push({
        id: comp.id,
        x: cx,
        y: cy,
        role: 'character',
        svg: componentRegistry[comp.id]?.(),
      });
      placedChars.push({ id: comp.id, x: cx, y: cy, prefix });
    }
  }

  if (charAPrefix) {
    layoutChar(
      (prefixGroups.get(charAPrefix) || []).sort((a, b) => a.drawOrder - b.drawOrder),
      charAX,
      charAPrefix
    );
  }

  if (charBPrefix) {
    layoutChar(
      (prefixGroups.get(charBPrefix) || []).sort((a, b) => a.drawOrder - b.drawOrder),
      charBX,
      charBPrefix
    );
  }

  const detailComps = components.filter(
    (c) => c.role === 'detail' && supportedIds.has(c.id)
  );

  for (const comp of detailComps) {
    const prefix = comp.id.split('_')[0];
    let dx = 200;
    let dy = 200;

    for (const pc of placedChars) {
      if (pc.prefix === prefix && charHeads.includes(pc.id)) {
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

  if (supportedIds.has('heart')) {
    rendered.push({
      id: 'heart',
      x: 205,
      y: 195,
      role: 'background',
      svg: componentRegistry['heart']?.(),
    });
  }

  const bgComps = components.filter(
    (c) =>
      c.role === 'background' &&
      supportedIds.has(c.id) &&
      c.id !== 'ground' &&
      c.id !== 'heart'
  );

  if (bgComps.length > 0) {
    const comp = bgComps[0];
    rendered.push({
      id: comp.id,
      x: 200,
      y: 60,
      role: 'background',
      svg: componentRegistry[comp.id]?.(),
    });
  }

  return buildSvg(rendered, orderMap);
}

// ---- Layout: Sky ----

function renderSky(components: ComponentSpec[]): string {
  const supportedIds = new Set(components.map((c) => c.id));
  const orderMap = new Map(components.map((c) => [c.id, c.drawOrder]));

  const rendered: RenderElement[] = [];

  // Clouds: distributed across top half
  const cloudPositions = [
    { x: 80, y: 60 },
    { x: 320, y: 80 },
    { x: 200, y: 45 },
    { x: 50, y: 110 },
    { x: 350, y: 120 },
  ];
  let cloudIdx = 0;

  // Moon
  if (supportedIds.has('moon')) {
    rendered.push({
      id: 'moon',
      x: 60,
      y: 60,
      role: 'support',
      svg: componentRegistry['moon']?.(),
    });
  }

  // Sun
  if (supportedIds.has('sun')) {
    rendered.push({
      id: 'sun',
      x: 340,
      y: 50,
      role: 'background',
      svg: componentRegistry['sun']?.(),
    });
  }

  // Clouds
  const cloudComps = components.filter(
    (c) => c.id === 'cloud' && supportedIds.has(c.id)
  );
  for (const comp of cloudComps) {
    const pos = cloudPositions[cloudIdx % cloudPositions.length];
    rendered.push({
      id: comp.id,
      x: pos.x,
      y: pos.y,
      role: 'background',
      svg: componentRegistry['cloud']?.(),
    });
    cloudIdx++;
  }

  if (cloudComps.length === 0 && supportedIds.has('cloud')) {
    // If cloud is in components but hasn't been drawn yet
    const pos = cloudPositions[0];
    rendered.push({
      id: 'cloud',
      x: pos.x,
      y: pos.y,
      role: 'background',
      svg: componentRegistry['cloud']?.(),
    });
  }

  // Butterfly
  if (supportedIds.has('butterfly_wings')) {
    rendered.push({
      id: 'butterfly_wings',
      x: 200,
      y: 150,
      role: 'character',
      svg: componentRegistry['butterfly_wings']?.(),
    });
  }

  // Stars
  const starComps = components.filter(
    (c) => c.id === 'star' && supportedIds.has(c.id)
  );
  const starPositions = [
    { x: 120, y: 80 },
    { x: 280, y: 50 },
    { x: 60, y: 130 },
    { x: 340, y: 140 },
    { x: 200, y: 30 },
  ];
  for (let i = 0; i < starComps.length; i++) {
    const pos = starPositions[i % starPositions.length];
    rendered.push({
      id: 'star',
      x: pos.x,
      y: pos.y,
      role: 'background',
      svg: componentRegistry['star']?.(),
    });
  }

  // Remaining backgrounds
  const bgComps = components.filter(
    (c) =>
      c.role === 'background' &&
      supportedIds.has(c.id) &&
      !['cloud', 'star', 'sun'].includes(c.id)
  );

  for (let i = 0; i < bgComps.length; i++) {
    const comp = bgComps[i];
    const seed = orderMap.get(comp.id) ?? i;
    const bx = randomInRange(seed, 30, 370);
    const by = randomInRange(seed + 100, 40, 180);

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

// ---- Dispatch ----

export function renderScene(components: ComponentSpec[], sceneType?: string): string {
  const type = sceneType && isValidSceneType(sceneType) ? sceneType : inferSceneType(components);

  switch (type) {
    case 'sitting':
      return renderSitting(components);
    case 'standing':
      return renderStanding(components);
    case 'flying':
      return renderFlying(components);
    case 'fainted':
      return renderFainted(components);
    case 'interaction':
      return renderInteraction(components);
    case 'sky':
      return renderSky(components);
    default:
      return renderSitting(components);
  }
}

function isValidSceneType(t: string): boolean {
  return ['sitting', 'standing', 'flying', 'fainted', 'interaction', 'sky'].includes(t);
}
