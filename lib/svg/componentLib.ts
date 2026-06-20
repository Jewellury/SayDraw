import { roughCircle, roughEllipse, roughLine, roughPath } from './roughSvg';

function g(children: string): string {
  return `<g>${children}</g>`;
}

export function moon(): string {
  const parts: string[] = [];
  parts.push(roughPath('M -25 -20 A 35 35 0 1 0 25 20', 3));
  parts.push(roughPath('M 22 17 A 22 22 0 1 1 -22 -18', 2));
  return g(parts.join('\n'));
}

export function stone(): string {
  const parts: string[] = [];
  parts.push(roughEllipse(0, 0, 38, 22, 3));
  parts.push(roughPath('M -32 5 Q -20 -8 0 0 Q 20 6 32 -2', 2));
  parts.push(roughLine(-25, 10, 20, 15, 2));
  return g(parts.join('\n'));
}

export function catBody(): string {
  const parts: string[] = [];
  parts.push(roughEllipse(0, 0, 22, 16, 3));
  parts.push(roughLine(-15, 10, -13, 24, 3));
  parts.push(roughLine(15, 10, 13, 24, 3));
  return g(parts.join('\n'));
}

export function catHead(): string {
  const parts: string[] = [];
  parts.push(roughCircle(0, 0, 20, 3));
  parts.push(roughLine(-14, -16, -10, -28, 3));
  parts.push(roughLine(-8, -20, 0, -16, 3));
  parts.push(roughLine(14, -16, 10, -28, 3));
  parts.push(roughLine(8, -20, 0, -16, 3));
  return g(parts.join('\n'));
}

export function catEyes(): string {
  const parts: string[] = [];
  parts.push(roughCircle(-7, -1, 4, 2));
  parts.push(roughCircle(7, -1, 4, 2));
  parts.push(roughCircle(-7, -1, 1.5, 2));
  parts.push(roughCircle(7, -1, 1.5, 2));
  parts.push(roughLine(-3, 5, 0, 6, 2));
  parts.push(roughLine(0, 6, 3, 5, 2));
  parts.push(roughLine(-4, 8, -2, 9, 2));
  parts.push(roughLine(4, 8, 2, 9, 2));
  return g(parts.join('\n'));
}

export function catTail(): string {
  const parts: string[] = [];
  parts.push(roughPath('M -18 0 Q -35 -10 -40 -35 Q -42 -48 -32 -45 Q -22 -42 -26 -30', 3));
  return g(parts.join('\n'));
}

export function dinoBody(): string {
  const parts: string[] = [];
  parts.push(roughEllipse(0, 0, 28, 18, 3));
  parts.push(roughPath('M -25 -5 Q -22 -15 -18 -12 Q -12 -6 -14 2', 2));
  parts.push(roughPath('M -8 8 L -12 22', 3));
  parts.push(roughPath('M 8 8 L 12 22', 3));
  return g(parts.join('\n'));
}

export function dinoHead(): string {
  const parts: string[] = [];
  parts.push(roughCircle(0, 0, 16, 3));
  parts.push(roughPath('M 12 -4 Q 22 0 26 8 Q 24 12 16 8', 2));
  parts.push(roughCircle(6, -4, 3, 2));
  parts.push(roughPath('M 16 3 Q 20 6 22 3', 2));
  return g(parts.join('\n'));
}

export function star(): string {
  const parts: string[] = [];
  parts.push(
    roughPath(
      'M 0 -12 L 3 -4 L 12 -4 L 5 2 L 7 10 L 0 5 L -7 10 L -5 2 L -12 -4 L -3 -4 Z',
      2
    )
  );
  return g(parts.join('\n'));
}

export function groundSegment(): string {
  const parts: string[] = [];
  parts.push(roughLine(0, 0, 100, 0, 2));
  parts.push(roughLine(110, 0, 210, 0, 2));
  parts.push(roughLine(220, 0, 320, 0, 2));
  parts.push(roughLine(330, 0, 400, 0, 2));
  return g(parts.join('\n'));
}

export function flower(): string {
  const parts: string[] = [];
  parts.push(roughLine(0, 15, 0, -5, 2));
  for (let a = 0; a < 360; a += 60) {
    const rx = Math.cos((a * Math.PI) / 180) * 6;
    const ry = Math.sin((a * Math.PI) / 180) * 6;
    parts.push(roughEllipse(rx, ry, 4, 3, 2));
  }
  parts.push(roughCircle(0, 0, 3, 2));
  return g(parts.join('\n'));
}

export function butterflyWings(): string {
  const parts: string[] = [];
  parts.push(roughPath('M 0 0 Q -20 -18 -30 -8 Q -24 2 0 0', 2));
  parts.push(roughPath('M 0 0 Q -16 10 -24 18 Q -10 14 0 0', 2));
  parts.push(roughPath('M 0 0 Q 20 -18 30 -8 Q 24 2 0 0', 2));
  parts.push(roughPath('M 0 0 Q 16 10 24 18 Q 10 14 0 0', 2));
  parts.push(roughLine(0, -10, 0, 5, 2));
  parts.push(roughLine(0, -10, -8, -18, 1.5));
  parts.push(roughLine(0, -10, 8, -18, 1.5));
  return g(parts.join('\n'));
}

export function cloud(): string {
  const parts: string[] = [];
  parts.push(roughEllipse(-12, 4, 18, 10, 2));
  parts.push(roughEllipse(12, 4, 20, 10, 2));
  parts.push(roughEllipse(0, -2, 22, 12, 2));
  parts.push(roughEllipse(-26, 8, 16, 8, 2));
  return g(parts.join('\n'));
}

export function sun(): string {
  const parts: string[] = [];
  parts.push(roughCircle(0, 0, 18, 2.5));
  for (let a = 0; a < 360; a += 45) {
    const r = Math.PI * a / 180;
    parts.push(roughLine(
      Math.cos(r) * 22,
      Math.sin(r) * 22,
      Math.cos(r) * 30,
      Math.sin(r) * 30,
      2.5
    ));
  }
  return g(parts.join('\n'));
}

export function meteor(): string {
  const parts: string[] = [];
  parts.push(roughEllipse(0, 0, 18, 10, 3));
  parts.push(roughPath('M -18 -6 L -32 0 L -18 6 Z', 2.5));
  return g(parts.join('\n'));
}

export function xEyes(): string {
  const parts: string[] = [];
  parts.push(roughLine(-7, -5, -2, 2, 2));
  parts.push(roughLine(-2, -5, -7, 2, 2));
  parts.push(roughLine(2, -5, 7, 2, 2));
  parts.push(roughLine(7, -5, 2, 2, 2));
  return g(parts.join('\n'));
}

export function heart(): string {
  const parts: string[] = [];
  parts.push(roughPath('M 0 -2 C -2 -12 -20 -14 -20 -4 C -20 8 0 18 0 18 C 0 18 20 8 20 -4 C 20 -14 2 -12 0 -2 Z', 2));
  return g(parts.join('\n'));
}

export function motionLines(): string {
  const parts: string[] = [];
  parts.push(roughLine(-24, -6, -10, -6, 1.5));
  parts.push(roughLine(-26, 0, -8, 0, 1.5));
  parts.push(roughLine(-24, 6, -10, 6, 1.5));
  return g(parts.join('\n'));
}

export function grass(): string {
  const parts: string[] = [];
  parts.push(roughPath('M -14 0 Q -11 -16 -6 -12', 1.5));
  parts.push(roughPath('M -4 0 Q -1 -20 2 -18', 1.5));
  parts.push(roughPath('M 6 0 Q 10 -16 14 -12', 1.5));
  return g(parts.join('\n'));
}

export function dazedStars(): string {
  const parts: string[] = [];
  parts.push(roughPath('M -14 -10 L -12 -4 L -6 -4 L -11 0 L -9 6 L -14 2 L -19 6 L -17 0 L -22 -4 L -16 -4 Z', 1.5));
  parts.push(roughPath('M 8 -12 L 10 -6 L 16 -6 L 11 -2 L 13 4 L 8 0 L 3 4 L 5 -2 L 0 -6 L 6 -6 Z', 1.5));
  parts.push(roughPath('M -2 -18 L 0 -12 L 6 -12 L 1 -8 L 3 -2 L -2 -6 L -7 -2 L -5 -8 L -10 -12 L -4 -12 Z', 1.5));
  return g(parts.join('\n'));
}

export const componentRegistry: Record<string, () => string> = {
  moon,
  stone,
  cat_body: catBody,
  cat_head: catHead,
  cat_eyes: catEyes,
  cat_tail: catTail,
  dino_body: dinoBody,
  dino_head: dinoHead,
  star,
  ground: groundSegment,
  flower,
  butterfly_wings: butterflyWings,
  cloud,
  sun,
  meteor,
  x_eyes: xEyes,
  heart,
  motion_lines: motionLines,
  grass,
  dazed_stars: dazedStars,
};
