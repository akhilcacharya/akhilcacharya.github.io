// shared helpers for the seven daily pieces

export const DPR = () => Math.min(devicePixelRatio || 1, 2);
export const COARSE = matchMedia('(pointer: coarse)').matches;
export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function canvasIn(stage, alpha = false) {
  const c = document.createElement('canvas');
  c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none';
  stage.appendChild(c);
  return [c, c.getContext('2d', { alpha })];
}

// Rasterize the name onto a w×h grid. Returns Float32Array (0..1).
export function nameMask(w, h, lines = ['AKHIL', 'ACHARYA'], widthFrac = 0.86) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const fam = `'Arial Black','Helvetica Neue',Arial,sans-serif`;

  let size = h;
  for (const word of lines) {
    g.font = `900 ${h}px ${fam}`;
    const tw = g.measureText(word).width;
    size = Math.min(size, h * (w * widthFrac) / tw);
  }
  size = Math.min(size, (h * 0.72) / lines.length);

  g.font = `900 ${size}px ${fam}`;
  const gap = size * 1.14;
  const cy = h / 2 - gap * (lines.length - 1) / 2;
  lines.forEach((word, i) => g.fillText(word, w / 2, cy + gap * i));

  const d = g.getImageData(0, 0, w, h).data;
  const m = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) m[i] = d[i * 4] / 255;
  return m;
}

export function maskPoints(m, w, h, step = 1) {
  const pts = [];
  for (let y = 0; y < h; y += step)
    for (let x = 0; x < w; x += step)
      if (m[y * w + x] > 0.5) pts.push([x + 0.5, y + 0.5]);
  return pts;
}

// Unified pointer state (mouse + touch).
export function pointer() {
  const p = { x: -1e4, y: -1e4, vx: 0, vy: 0, down: false, last: -1e4, active: false };
  const move = (x, y) => {
    if (p.active) { p.vx = x - p.x; p.vy = y - p.y; }
    p.x = x; p.y = y;
    p.active = true;
    p.last = performance.now();
  };
  addEventListener('pointermove', e => move(e.clientX, e.clientY), { passive: true });
  addEventListener('pointerdown', e => { p.down = true; move(e.clientX, e.clientY); });
  addEventListener('pointerup', () => { p.down = false; });
  addEventListener('pointercancel', () => { p.down = false; });
  return p;
}

// Seeded 3D value noise + fbm.
export function noiseFactory(seed = 1337) {
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 255; i > 0; i--) {
    const j = (rnd() * (i + 1)) | 0;
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  const fade = t => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  const lat = (x, y, z) => perm[(x + perm[(y + perm[z & 255]) & 255]) & 255] / 255;

  function noise3(x, y, z) {
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    const fx = fade(x - X), fy = fade(y - Y), fz = fade(z - Z);
    const x0 = X & 255, x1 = (X + 1) & 255;
    const y0 = Y & 255, y1 = (Y + 1) & 255;
    const z0 = Z & 255, z1 = (Z + 1) & 255;
    return lerp(
      lerp(lerp(lat(x0, y0, z0), lat(x1, y0, z0), fx), lerp(lat(x0, y1, z0), lat(x1, y1, z0), fx), fy),
      lerp(lerp(lat(x0, y0, z1), lat(x1, y0, z1), fx), lerp(lat(x0, y1, z1), lat(x1, y1, z1), fx), fy),
      fz
    );
  }
  const fbm = (x, y, z) => 0.65 * noise3(x, y, z) + 0.35 * noise3(x * 2.3, y * 2.3, z * 2.3);
  return { noise3, fbm, rnd };
}
