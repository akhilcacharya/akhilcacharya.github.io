// SUNDAY — ink. Particles ride a curl-noise field and deposit ink;
// the name is where the ink settles darkest. The cursor stirs the water.
import { canvasIn, DPR, COARSE, REDUCED, nameMask, maskPoints, pointer, noiseFactory } from './util.js';

export default function run(stage) {
  document.body.dataset.theme = 'light';
  const [c, g] = canvasIn(stage);
  const { fbm } = noiseFactory(99);
  const ptr = pointer();

  const PAPER = '#f4f1e8';
  const MS = 4; // mask cell in css px
  const N = COARSE ? 1400 : 2600;

  let W, H, mw, mh, mask, homes;
  const P = [];

  function reset() {
    const dpr = DPR();
    W = innerWidth; H = innerHeight;
    c.width = W * dpr; c.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = PAPER;
    g.fillRect(0, 0, W, H);
    mw = Math.ceil(W / MS); mh = Math.ceil(H / MS);
    mask = nameMask(mw, mh);
    homes = maskPoints(mask, mw, mh);
    P.length = 0;
    for (let i = 0; i < N; i++) {
      // most of the ink belongs to the name: tethered home, but riding the same current
      const anchored = i < N * 0.72;
      let x = Math.random() * W, y = Math.random() * H, hx = 0, hy = 0;
      let ph = 0;
      if (anchored) {
        const [mx, my] = homes[(Math.random() * homes.length) | 0];
        hx = mx * MS; hy = my * MS;
        x = hx; y = hy;
        ph = fbm(hx * 0.004, hy * 0.004, 0) * 6.283; // smooth spatial phase -> coherent sway
      }
      P.push({ x, y, hx, hy, ph, anchored });
    }
  }
  reset();
  addEventListener('resize', reset);

  const S = 0.0016;   // field scale
  const E = 3;        // finite-difference epsilon
  const SPEED = REDUCED ? 4 : 10;

  function step(now) {
    requestAnimationFrame(step);
    const t = now * 0.00009;

    // let the paper slowly drink the ink back up
    g.fillStyle = 'rgba(244, 241, 232, 0.09)';
    g.fillRect(0, 0, W, H);

    const faint = new Path2D();  // ambient current, hairline strokes
    const ink = new Path2D();    // the name, crisp stipple

    const tw = t * 6; // sway clock

    for (const p of P) {
      if (p.anchored) {
        // gentle coherent sway around home -> crisp, living stipple (no springy hairs)
        let tx = p.hx + Math.cos(tw + p.ph) * 2.6;
        let ty = p.hy + Math.sin(tw + p.ph) * 2.6;
        // the cursor parts the letters; they flow back
        const dx = p.hx - ptr.x, dy = p.hy - ptr.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 130 * 130) {
          const d = Math.sqrt(d2) + 0.001;
          const f = (1 - d / 130) ** 2 * 34;
          tx += dx / d * f; ty += dy / d * f;
        }
        p.x += (tx - p.x) * 0.28;
        p.y += (ty - p.y) * 0.28;
        ink.moveTo(p.x + 1.15, p.y);
        ink.arc(p.x, p.y, 1.15, 0, 6.283);
      } else {
        // ambient ink drifts on the curl field, tracing faint hairlines
        const n1 = fbm(p.x * S, (p.y + E) * S, t);
        const n2 = fbm(p.x * S, (p.y - E) * S, t);
        const n3 = fbm((p.x + E) * S, p.y * S, t);
        const n4 = fbm((p.x - E) * S, p.y * S, t);
        let vx = (n1 - n2) / (2 * E) * 60 * SPEED;
        let vy = -(n3 - n4) / (2 * E) * 60 * SPEED;
        const dx = p.x - ptr.x, dy = p.y - ptr.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 150 * 150) {
          const d = Math.sqrt(d2) + 0.001;
          const f = (1 - d / 150);
          vx += (-dy / d) * f * 130 + (dx / d) * f * 34;
          vy += (dx / d) * f * 130 + (dy / d) * f * 34;
        }
        const px = p.x, py = p.y;
        p.x += vx * 0.016;
        p.y += vy * 0.016;
        if (p.x < 0) p.x += W; else if (p.x >= W) p.x -= W;
        if (p.y < 0) p.y += H; else if (p.y >= H) p.y -= H;
        // keep the background current off the letters so they stay clean
        const mi = mask[(p.y / MS | 0) * mw + (p.x / MS | 0)] || 0;
        if (mi < 0.15 && Math.abs(p.x - px) < 40 && Math.abs(p.y - py) < 40) {
          faint.moveTo(px, py);
          faint.lineTo(p.x, p.y);
        }
      }
    }

    g.lineWidth = 1;
    g.strokeStyle = 'rgba(26, 22, 15, 0.04)';
    g.stroke(faint);
    g.fillStyle = 'rgba(26, 22, 15, 0.16)';
    g.fill(ink);
  }
  requestAnimationFrame(step);
}
