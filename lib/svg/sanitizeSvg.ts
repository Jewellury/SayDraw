export function sanitizeSvg(raw: string): string {
  let svg = String(raw || '');

  const beforeLen = svg.length;

  // Strip <script>...</script> blocks (case-insensitive, multiline)
  svg = svg.replace(/<script[\s\S]*?\/script>/gi, '');

  // Strip <foreignObject>...</foreignObject> blocks
  svg = svg.replace(/<foreignObject[\s\S]*?\/foreignObject>/gi, '');

  // Strip on* event attributes (onload, onclick, onmouseover, etc.)
  svg = svg.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
  svg = svg.replace(/\s+on\w+\s*=\s*[^\s/>]+/gi, '');

  // Strip external href/xlink:href that reference URLs (not internal #fragment)
  svg = svg.replace(/\s+(xlink:)?href\s*=\s*["']https?:\/\/[^"']*["']/gi, '');
  svg = svg.replace(/\s+(xlink:)?href\s*=\s*["']javascript:[^"']*["']/gi, '');

  const afterLen = svg.length;
  if (beforeLen !== afterLen) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[sanitizeSvg] Stripped ${beforeLen - afterLen} characters of unsafe content`);
    }
  }

  return svg;
}
