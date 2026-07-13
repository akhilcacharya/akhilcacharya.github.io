// FRIDAY — swarm. Two thousand points of light hold the shape of the name.
// Sweep through them and they scatter like startled fish, then drift home.
import { canvasIn, DPR, COARSE, REDUCED, nameMask, maskPoints, pointer, noiseFactory } from './util.js';

export default function run(stage) {
  document.body.dataset.theme = 'dark';
  const [c, g] = canvasIn(stage);
  const { fbm } = noiseFactory(777);
  const ptr = pointer();

  const MS = 3;                       // mask resolution in css px
  const MAXP = COARSE ? 1100 : 2400;

  let W, H;
  const P = [];

  function reset() {
    const dpr = DPR();
    W = innerWidth; H = innerHeight;
    c.width = W * dpr; c.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    const mw = Math.ceil(W / MS), mh = Math.ceil(H / MS);
    const mask = nameMask(mw, mh);
    let pts = maskPoints(mask, mw, mh);
    // thin evenly to MAXP
    if (pts.length > MAXP) {
      const keep = [];
      const stride = pts.length / MAXP;
      for (let i = 0; i < MAXP; i++) keep.push(pts[(i * stride) | 0]);
      pts = keep;
    }
    // fisher-yates so scatter looks organic
    for (let i = pts.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [pts[i], pts[j]] = [pts[j], pts[i]];
    }

    P.length = 0;
    for (const [mx, my] of pts) {
      P.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: 0, vy: 0,
        tx: mx * MS, ty: my * MS,
        ph: Math.random() * 7,
      });
    }
  }
  reset();
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(reset, 250); });

  const SPRING = 0.014;
  const DAMP = 0.90;
  const R = 130;

  function frame(now) {
    requestAnimationFrame(frame);
    const t = now * 0.001;

    g.fillStyle = '#05070c';
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';

    const stir = !REDUCED && ptr.active && now - ptr.last < 400;

    for (const p of P) {
      // home
      p.vx += (p.tx - p.x) * SPRING;
      p.vy += (p.ty - p.y) * SPRING;

      // gentle ambient drift so the letters feel alive
      p.vx += (fbm(p.x * 0.004, p.y * 0.004, t * 0.4) - 0.5) * 0.5;
      p.vy += (fbm(p.y * 0.004, p.x * 0.004, t * 0.4 + 40) - 0.5) * 0.5;

      // flee the cursor
      if (stir) {
        const dx = p.x - ptr.x, dy = p.y - ptr.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < R * R) {
          const d = Math.sqrt(d2) + 0.001;
          const f = (1 - d / R) ** 2 * 9;
          p.vx += (dx / d) * f + ptr.vx * 0.12;
          p.vy += (dy / d) * f + ptr.vy * 0.12;
        }
      }

      p.vx *= DAMP;
      p.vy *= DAMP;
      p.x += p.vx;
      p.y += p.vy;

      const sp = Math.min(1, (p.vx * p.vx + p.vy * p.vy) * 0.02);
      const tw = 0.75 + 0.25 * Math.sin(t * 2.4 + p.ph);
      // calm = warm white, agitated = electric blue
      const rC = 235 + sp * 10, gC = 238 - sp * 70, bC = 242 + sp * 13;
      // soft halo + bright core
      g.fillStyle = `rgba(${rC | 0},${gC | 0},${bC | 0},${0.16 * tw})`;
      const h = 5 + sp * 3;
      g.fillRect(p.x - h / 2, p.y - h / 2, h, h);
      g.fillStyle = `rgba(${rC | 0},${gC | 0},${bC | 0},${(0.8 + sp * 0.2) * tw})`;
      const s = 1.9 + sp * 1.4;
      g.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    g.globalCompositeOperation = 'source-over';
  }
  requestAnimationFrame(frame);
}
