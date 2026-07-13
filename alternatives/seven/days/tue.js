// TUESDAY — organism. Gray–Scott reaction–diffusion grows a living coral
// around the name; touch it and it grows where you linger.
import { canvasIn, COARSE, REDUCED, nameMask, pointer } from './util.js';

export default function run(stage) {
  document.body.dataset.theme = 'dark';
  const [c, g] = canvasIn(stage);
  const ptr = pointer();

  const GW = COARSE ? 260 : 460;
  const ITERS = REDUCED ? 2 : (COARSE ? 5 : 7);
  const F = 0.0367;
  const K_OUT = 0.0630;  // outside the name: coral / worms
  const K_IN = 0.0480;   // inside the name: solid growth
  const DU = 0.2097, DV = 0.1050;

  let W, H, gw, gh, U, V, U2, V2, mask, img, buf;

  function reset() {
    W = innerWidth; H = innerHeight;
    gw = GW;
    gh = Math.max(80, Math.round(GW * H / W));
    c.width = gw; c.height = gh;
    c.style.imageRendering = 'auto';
    const n = gw * gh;
    U = new Float32Array(n).fill(1);
    V = new Float32Array(n).fill(0);
    U2 = new Float32Array(n);
    V2 = new Float32Array(n);
    mask = nameMask(gw, gh, ['AKHIL', 'ACHARYA'], 0.8);
    // seed: the name plus a few random motes (U/V must stay in [0,1])
    for (let i = 0; i < n; i++) if (mask[i] > 0.4) { U[i] = 0.5; V[i] = 0.25; }
    for (let s = 0; s < 24; s++) {
      const x = (Math.random() * gw) | 0, y = (Math.random() * gh) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const i = ((y + dy + gh) % gh) * gw + ((x + dx + gw) % gw);
        U[i] = 0.5; V[i] = 0.25;
      }
    }
    img = g.createImageData(gw, gh);
    buf = img.data;
  }
  reset();
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(reset, 250); });

  function stepRD() {
    for (let y = 0; y < gh; y++) {
      const up = ((y - 1 + gh) % gh) * gw;
      const dn = ((y + 1) % gh) * gw;
      const row = y * gw;
      for (let x = 0; x < gw; x++) {
        const i = row + x;
        const l = row + ((x - 1 + gw) % gw);
        const r = row + ((x + 1) % gw);
        const u = U[i], v = V[i];
        const lapU = U[l] + U[r] + U[up + x] + U[dn + x] - 4 * u;
        const lapV = V[l] + V[r] + V[up + x] + V[dn + x] - 4 * v;
        const uvv = u * v * v;
        const k = mask[i] > 0.35 ? K_IN : K_OUT;
        let nu = u + (DU * lapU - uvv + F * (1 - u));
        let nv = v + (DV * lapV + uvv - (F + k) * v);
        U2[i] = nu < 0 ? 0 : nu > 1 ? 1 : nu;
        V2[i] = nv < 0 ? 0 : nv > 1 ? 1 : nv;
      }
    }
    [U, U2] = [U2, U];
    [V, V2] = [V2, V];
  }

  function dab(cx, cy, rad, amt) {
    for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
      if (dx * dx + dy * dy > rad * rad) continue;
      const x = (cx + dx + gw) % gw, y = (cy + dy + gh) % gh;
      V[y * gw + x] = Math.min(1, V[y * gw + x] + amt);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);

    // pointer feeds the organism
    if (ptr.active && now - ptr.last < 120) {
      dab((ptr.x / W * gw) | 0, (ptr.y / H * gh) | 0, 3, 0.3);
    }
    // keep the name alive under the growth
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] > 0.4 && V[i] < 0.2) V[i] = 0.2;
    }

    for (let s = 0; s < ITERS; s++) stepRD();

    // duotone render: deep ink -> sea glass
    for (let i = 0; i < gw * gh; i++) {
      let v = V[i] * 2.6;
      if (v > 1) v = 1;
      v = v * v * (3 - 2 * v);
      buf[i * 4]     = 6  + v * (98 - 6);
      buf[i * 4 + 1] = 10 + v * (242 - 10);
      buf[i * 4 + 2] = 18 + v * (205 - 18);
      buf[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  requestAnimationFrame(frame);
}
