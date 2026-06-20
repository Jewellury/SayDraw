import rough from 'roughjs';

const INK = '#211e18';

interface RoughOp {
  op: string;
  data: number[];
}

interface RoughSet {
  type: string;
  ops: RoughOp[];
  strokeWidth?: number;
}

interface RoughDrawable {
  shape: string;
  sets: RoughSet[];
}

function createGenerator(strokeWidth: number, seed: number) {
  return rough.generator({
    options: {
      seed,
      roughness: 1.5,
      bowing: 1.2,
      stroke: INK,
      strokeWidth,
      fill: 'none',
    },
  });
}

function opsToPathD(ops: RoughOp[]): string {
  const parts: string[] = [];
  for (const op of ops) {
    switch (op.op) {
      case 'move':
        parts.push(`M${op.data[0]} ${op.data[1]}`);
        break;
      case 'lineTo':
        parts.push(`L${op.data[0]} ${op.data[1]}`);
        break;
      case 'bcurveTo':
        parts.push(
          `C${op.data[0]} ${op.data[1]} ${op.data[2]} ${op.data[3]} ${op.data[4]} ${op.data[5]}`
        );
        break;
    }
  }
  return parts.join(' ');
}

function drawableToSvg(d: RoughDrawable): string {
  return d.sets
    .map((set) => {
      const dAttr = opsToPathD(set.ops);
      const sw = set.strokeWidth || 2;
      return `<path d="${dAttr}" stroke="${INK}" stroke-width="${sw}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join('\n');
}

let seedCounter = 42;

function nextSeed(): number {
  return seedCounter++;
}

export function roughCircle(
  cx: number,
  cy: number,
  r: number,
  strokeWidth = 3
): string {
  const gen = createGenerator(strokeWidth, nextSeed());
  const drawn = gen.circle(cx, cy, r * 2, {
    stroke: INK,
    strokeWidth,
    fill: 'none',
    roughness: 1.5,
    bowing: 1.2,
  });
  return drawableToSvg(drawn as unknown as RoughDrawable);
}

export function roughEllipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  strokeWidth = 3
): string {
  const gen = createGenerator(strokeWidth, nextSeed());
  const drawn = gen.ellipse(cx, cy, rx * 2, ry * 2, {
    stroke: INK,
    strokeWidth,
    fill: 'none',
    roughness: 1.5,
    bowing: 1.2,
  });
  return drawableToSvg(drawn as unknown as RoughDrawable);
}

export function roughLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  strokeWidth = 2
): string {
  const gen = createGenerator(strokeWidth, nextSeed());
  const drawn = gen.line(x1, y1, x2, y2, {
    stroke: INK,
    strokeWidth,
    fill: 'none',
    roughness: 1.5,
    bowing: 1.2,
  });
  return drawableToSvg(drawn as unknown as RoughDrawable);
}

export function roughPath(d: string, strokeWidth = 3): string {
  const gen = createGenerator(strokeWidth, nextSeed());
  const drawn = gen.path(d, {
    stroke: INK,
    strokeWidth,
    fill: 'none',
    roughness: 1.5,
    bowing: 1.2,
  });
  return drawableToSvg(drawn as unknown as RoughDrawable);
}
