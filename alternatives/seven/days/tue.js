// TUESDAY — relief. A slowly flowing topographic map. The name is a raised
// plateau, traced by nested contour rings; the cursor pushes up a hill and
// the contours bunch around it like terrain under your thumb.
import { canvasIn, DPR, COARSE, REDUCED, nameMask, pointer, noiseFactory } from './util.js';

export default function run(stage) {
  document.body.dataset.theme = 'light';
  const [c, g] = canvasIn(stage);
  const { fbm } = noiseFactory(2024);
  const ptr = pointer();

  const CELL = COARSE ? 10 : 7;
  const NLEV = 17;
  const HMAX = 2.2;
  const levels = [];
  for (let i = 1; i <= NLEV; i++) levels.push(i / (NLEV + 1) * HMAX);

  let W, H, gw, gh, blur, height;

  // one-time smoothing of the name mask into a rounded plateau
  function blurMask(src, w, h, r, passes) {
    let a = src;
    for (let p = 0; p < passes; p++) {
      const b = new Float32Array(w * h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let s = 0, n = 0;
          for (let dy = -r; dy <= r; dy++) {
            const yy = y + dy;
            if (yy < 0 || yy >= h) continue;
            for (let dx = -r; dx <= r; dx++) {
              const xx = x + dx;
              if (xx < 0 || xx >= w) continue;
              s += a[yy * w + xx]; n++;
            }
          }
          b[y * w + x] = s / n;
        }
      }
      a = b;
    }
    return a;
  }

  function reset() {
    const dpr = DPR();
    W = innerWidth; H = innerHeight;
    c.width = W * dpr; c.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    gw = Math.ceil(W / CELL) + 1;
    gh = Math.ceil(H / CELL) + 1;
    const m = nameMask(gw, gh, ['AKHIL', 'ACHARYA'], gw < 90 ? 0.94 : 0.82);
    blur = blurMask(m, gw, gh, 2, 2);
    height = new Float32Array(gw * gh);
  }
  reset();
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(reset, 200); });

  const SIG2 = 2 * 95 * 95;
  const ex = new Float32Array(4), ey = new Float32Array(4);

  function frame(now) {
    requestAnimationFrame(frame);
    const t = REDUCED ? 30 : now * 0.001;
    const z = t * 0.05, flow = t * 0.06;

    // build the height field
    const active = ptr.active;
    const px = ptr.x, py = ptr.y;
    for (let r = 0; r < gh; r++) {
      for (let cc = 0; cc < gw; cc++) {
        let h = fbm(cc * 0.06 + flow, r * 0.06, z) * 1.15 + blur[r * gw + cc] * 1.3;
        if (active) {
          const dx = cc * CELL - px, dy = r * CELL - py;
          h += Math.exp(-(dx * dx + dy * dy) / SIG2);
        }
        height[r * gw + cc] = h;
      }
    }

    // marching squares -> one Path2D per contour level
    const paths = levels.map(() => new Path2D());
    for (let r = 0; r < gh - 1; r++) {
      for (let cc = 0; cc < gw - 1; cc++) {
        const i = r * gw + cc;
        const tl = height[i], tr = height[i + 1], bl = height[i + gw], br = height[i + gw + 1];
        let mn = tl, mx = tl;
        if (tr < mn) mn = tr; if (tr > mx) mx = tr;
        if (bl < mn) mn = bl; if (bl > mx) mx = bl;
        if (br < mn) mn = br; if (br > mx) mx = br;
        const x0 = cc * CELL, y0 = r * CELL, x1 = x0 + CELL, y1 = y0 + CELL;
        for (let li = 0; li < levels.length; li++) {
          const L = levels[li];
          if (L < mn) continue;
          if (L > mx) break; // levels ascending
          let n = 0;
          if ((tl - L) * (tr - L) < 0) { ex[n] = x0 + (L - tl) / (tr - tl) * CELL; ey[n] = y0; n++; }
          if ((tr - L) * (br - L) < 0) { ex[n] = x1; ey[n] = y0 + (L - tr) / (br - tr) * CELL; n++; }
          if ((bl - L) * (br - L) < 0) { ex[n] = x0 + (L - bl) / (br - bl) * CELL; ey[n] = y1; n++; }
          if ((tl - L) * (bl - L) < 0) { ex[n] = x0; ey[n] = y0 + (L - tl) / (bl - tl) * CELL; n++; }
          const p = paths[li];
          if (n === 2) {
            p.moveTo(ex[0], ey[0]); p.lineTo(ex[1], ey[1]);
          } else if (n === 4) {
            p.moveTo(ex[0], ey[0]); p.lineTo(ex[1], ey[1]);
            p.moveTo(ex[2], ey[2]); p.lineTo(ex[3], ey[3]);
          }
        }
      }
    }

    // paint: warm paper, sepia contours darkening with elevation
    g.fillStyle = '#efe9db';
    g.fillRect(0, 0, W, H);
    g.lineWidth = 1;
    g.lineJoin = 'round';
    for (let li = 0; li < paths.length; li++) {
      const frac = levels[li] / HMAX;
      g.strokeStyle = `rgba(74, 56, 38, ${0.14 + 0.5 * frac})`;
      g.stroke(paths[li]);
    }
  }
  requestAnimationFrame(frame);
}
