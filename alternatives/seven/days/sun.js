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
  const N = COARSE ? 1300 : 2800;

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
      // 45% of the ink belongs to the name: tethered home, but riding the same current
      const anchored = i < N * 0.45;
      let x = Math.random() * W, y = Math.random() * H, hx = 0, hy = 0;
      if (anchored) {
        const [mx, my] = homes[(Math.random() * homes.length) | 0];
        hx = mx * MS; hy = my * MS;
        x = hx + (Math.random() - 0.5) * 30;
        y = hy + (Math.random() - 0.5) * 30;
      }
      P.push({ x, y, hx, hy, anchored });
    }
  }
  reset();
  addEventListener('resize', reset);

  const S = 0.0016;   // field scale
  const E = 3;        // finite-difference epsilon
  const SPEED = REDUCED ? 4 : 14;

  function step(now) {
    requestAnimationFrame(step);
    const t = now * 0.00009;

    // let the paper slowly drink the ink back up
    g.fillStyle = 'rgba(244, 241, 232, 0.05)';
    g.fillRect(0, 0, W, H);

    const faint = new Path2D();
    const dark = new Path2D();

    for (const p of P) {
      // curl of the noise field -> divergence-free flow
      const n1 = fbm(p.x * S, (p.y + E) * S, t);
      const n2 = fbm(p.x * S, (p.y - E) * S, t);
      const n3 = fbm((p.x + E) * S, p.y * S, t);
      const n4 = fbm((p.x - E) * S, p.y * S, t);
      let vx = (n1 - n2) / (2 * E) * 60 * SPEED;
      let vy = -(n3 - n4) / (2 * E) * 60 * SPEED;

      // cursor: a slow whirlpool around the fingertip
      const dx = p.x - ptr.x, dy = p.y - ptr.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 170 * 170) {
        const d = Math.sqrt(d2) + 0.001;
        const f = (1 - d / 170);
        vx += (-dy / d) * f * 260 + (dx / d) * f * 60;
        vy += (dx / d) * f * 260 + (dy / d) * f * 60;
      }

      // tethered ink is pulled back to its spot on the name
      if (p.anchored) {
        vx = vx * 0.4 + (p.hx - p.x) * 3.2;
        vy = vy * 0.4 + (p.hy - p.y) * 3.2;
      }

      const px = p.x, py = p.y;
      p.x += vx * 0.016;
      p.y += vy * 0.016;

      if (p.x < 0) p.x += W; else if (p.x >= W) p.x -= W;
      if (p.y < 0) p.y += H; else if (p.y >= H) p.y -= H;

      // don't draw wrap jumps
      if (Math.abs(p.x - px) > 40 || Math.abs(p.y - py) > 40) continue;

      const mi = mask[(p.y / MS | 0) * mw + (p.x / MS | 0)] || 0;
      const path = (p.anchored || mi > 0.35) ? dark : faint;
      path.moveTo(px, py);
      path.lineTo(p.x, p.y);
    }

    g.lineWidth = 1.1;
    g.strokeStyle = 'rgba(26, 22, 15, 0.08)';
    g.stroke(faint);
    g.lineWidth = 1.5;
    g.strokeStyle = 'rgba(26, 22, 15, 0.5)';
    g.stroke(dark);
  }
  requestAnimationFrame(step);
}
