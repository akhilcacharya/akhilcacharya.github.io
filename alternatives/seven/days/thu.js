// THURSDAY — phosphor. The name burns steady in a drifting field of
// terminal characters; the cursor sends ripples through the glass.
import { canvasIn, DPR, COARSE, REDUCED, nameMask, pointer, noiseFactory } from './util.js';

export default function run(stage) {
  document.body.dataset.theme = 'dark';
  const [c, g] = canvasIn(stage);
  const { fbm } = noiseFactory(1337);
  const ptr = pointer();

  const CELL = COARSE ? 7 : 13;
  const RAMP = ' ·:;+=oxX#@';
  const N = RAMP.length - 1;
  const FPS = COARSE ? 30 : 60;

  let W, H, cols, rows, mask;

  function reset() {
    const dpr = DPR();
    W = innerWidth; H = innerHeight;
    c.width = W * dpr; c.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(W / CELL);
    rows = Math.ceil(H / CELL);
    mask = nameMask(cols, rows, ['AKHIL', 'ACHARYA'], cols < 70 ? 0.95 : 0.86);
    g.font = `${CELL - 1}px ui-monospace, Menlo, Consolas, monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
  }
  reset();
  addEventListener('resize', reset);

  let energy = 0, last = 0;

  function draw(now) {
    requestAnimationFrame(draw);
    if (now - last < 1000 / FPS - 2) return;
    last = now;

    const t = REDUCED ? 40 : now * 0.001;
    energy = ptr.active && now - ptr.last < 90 ? 1 : energy * 0.985;

    g.fillStyle = '#0c0a06';
    g.fillRect(0, 0, W, H);

    for (let r = 0; r < rows; r++) {
      const y = (r + 0.55) * CELL;
      for (let cI = 0; cI < cols; cI++) {
        const m = mask[r * cols + cI];
        const n = fbm(cI * 0.075, r * 0.075, t * 0.32);

        let b;
        if (m > 0.04) {
          // inside a letter: bright and steady, shimmering slightly
          b = (0.68 + 0.32 * n) * (0.45 + 0.55 * m);
        } else {
          b = n * n * 0.30;
        }

        if (energy > 0.02) {
          const x = (cI + 0.5) * CELL;
          const d = Math.hypot(x - ptr.x, y - ptr.y);
          b += Math.exp(-d / 180) * (0.35 + 0.3 * Math.sin(d * 0.045 - t * 5)) * energy;
        }

        if (b < 0.06) continue;
        if (b > 1) b = 1;

        const ch = RAMP[(b * N) | 0];
        if (ch === ' ') continue;

        g.fillStyle = `hsl(${30 + b * 12} 90% ${22 + b * 48}%)`;
        g.fillText(ch, (cI + 0.5) * CELL, y);
      }
    }
  }
  requestAnimationFrame(draw);
}
