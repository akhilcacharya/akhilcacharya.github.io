// SATURDAY — play. The letters of the name are rubber. Grab one, throw it,
// watch the pile. Double-tap to pour them back in.
import { COARSE, REDUCED, pointer } from './util.js';

const PALETTE = ['#e8501a', '#1460e8', '#17140e', '#0a9a58', '#d9a50a', '#c221a9'];

export default function run(stage) {
  document.body.dataset.theme = 'light';

  stage.innerHTML = `
    <style>
      .phys { position: absolute; inset: 0; overflow: hidden; cursor: grab; touch-action: none; }
      .phys.grabbing { cursor: grabbing; }
      .phys .lt {
        position: absolute;
        left: 0; top: 0;
        font-family: 'Arial Black', 'Helvetica Neue', Arial, sans-serif;
        font-weight: 900;
        user-select: none;
        will-change: transform;
        line-height: 1;
      }
    </style>
    <div class="phys" id="phys"></div>`;

  const arena = stage.querySelector('#phys');
  const WORDS = ['AKHIL', 'ACHARYA'];
  const bodies = [];
  let W, H, SIZE;

  function build() {
    W = innerWidth; H = innerHeight;
    SIZE = Math.min(Math.max(W / 12, 54), H / 5.5, 140);
    arena.querySelectorAll('.lt').forEach(e => e.remove());
    bodies.length = 0;

    // one slot per glyph across the floor (with a gap between the words),
    // so the pile still roughly spells the name once everything lands
    const glyphs = [...WORDS[0], ' ', ...WORDS[1]];
    const slots = glyphs.length;
    const margin = W * 0.04;
    let k = 0;
    glyphs.forEach((ch, si) => {
      if (ch === ' ') return;
      const el = document.createElement('div');
      el.className = 'lt';
      el.textContent = ch;
      el.style.fontSize = SIZE + 'px';
      el.style.color = PALETTE[k % PALETTE.length];
      arena.appendChild(el);
      const w = el.offsetWidth, h = el.offsetHeight;
      bodies.push({
        el, w, h,
        r: Math.max(w, h) * 0.46,
        // one at a time, each into its own slot
        x: margin + (W - 2 * margin) * (si / slots) + (Math.random() - 0.5) * 6,
        y: -SIZE * 1.4,
        vx: 0,
        vy: 0,
        a: (Math.random() - 0.5) * 0.22,
        va: (Math.random() - 0.5) * 0.8,
        t0: 150 + k * 260, // ms until this letter is released
        held: false,
      });
      k++;
    });
  }
  build();
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(build, 250); });

  const GRAV = REDUCED ? 600 : 1800;
  const REST = 0.55;
  const ptr = pointer();
  let held = null;

  arena.addEventListener('pointerdown', e => {
    let best = null, bd = 1e9;
    for (const b of bodies) {
      const d = Math.hypot(e.clientX - (b.x + b.w / 2), e.clientY - (b.y + b.h / 2));
      if (d < b.r * 1.5 && d < bd) { bd = d; best = b; }
    }
    if (best) {
      held = best;
      best.held = true;
      arena.classList.add('grabbing');
      arena.setPointerCapture(e.pointerId);
    }
  });
  const drop = () => {
    if (held) { held.held = false; held = null; arena.classList.remove('grabbing'); }
  };
  arena.addEventListener('pointerup', drop);
  arena.addEventListener('pointercancel', drop);
  arena.addEventListener('dblclick', build);

  let lastTap = 0;
  arena.addEventListener('pointerup', e => {
    if (e.pointerType === 'touch') {
      const now = performance.now();
      if (now - lastTap < 350) build();
      lastTap = now;
    }
  });

  let last = 0, born = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.032, (now - last) / 1000 || 0.016);
    last = now;
    const age = now - born;

    for (const b of bodies) {
      if (age < b.t0) continue; // not released yet
      if (b.held) {
        // critically-damped spring to the pointer
        const tx = ptr.x - b.w / 2, ty = ptr.y - b.h / 2;
        b.vx += (tx - b.x) * 30 * dt * 10;
        b.vy += (ty - b.y) * 30 * dt * 10;
        b.vx *= 0.72;
        b.vy *= 0.72;
        b.va *= 0.85;
      } else {
        b.vy += GRAV * dt;
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.a += b.va * dt;

      // floor / walls / ceiling
      const fy = H - b.h;
      if (b.y > fy) {
        b.y = fy;
        if (b.vy > 40) b.va += b.vx * 0.002 * (Math.random() - 0.3);
        b.vy *= -REST;
        b.vx *= 0.92;
        // settle upright-ish when slow
        if (Math.abs(b.vy) < 60) { b.va *= 0.8; b.a *= 0.92; }
      }
      if (b.x < 0) { b.x = 0; b.vx *= -REST; }
      if (b.x > W - b.w) { b.x = W - b.w; b.vx *= -REST; }
      if (b.y < -H) b.y = -H;

      b.va *= 0.995;
    }

    // pairwise collisions (as discs)
    for (let i = 0; i < bodies.length; i++) {
      const A = bodies[i];
      if (age < A.t0) continue;
      for (let j = i + 1; j < bodies.length; j++) {
        const B = bodies[j];
        if (age < B.t0) continue;
        const ax = A.x + A.w / 2, ay = A.y + A.h / 2;
        const bx = B.x + B.w / 2, by = B.y + B.h / 2;
        let dx = bx - ax, dy = by - ay;
        const min = (A.r + B.r) * 0.62;
        const d2 = dx * dx + dy * dy;
        if (d2 > min * min || d2 === 0) continue;
        const d = Math.sqrt(d2);
        dx /= d; dy /= d;
        const push = (min - d) / 2;
        if (!A.held) { A.x -= dx * push; A.y -= dy * push; }
        if (!B.held) { B.x += dx * push; B.y += dy * push; }
        // impulse along the normal
        const rel = (B.vx - A.vx) * dx + (B.vy - A.vy) * dy;
        if (rel < 0) {
          const jimp = -(1 + REST) * rel / 2;
          if (!A.held) { A.vx -= dx * jimp; A.vy -= dy * jimp; A.va -= jimp * 0.002; }
          if (!B.held) { B.vx += dx * jimp; B.vy += dy * jimp; B.va += jimp * 0.002; }
        }
      }
    }

    for (const b of bodies) {
      b.el.style.transform = `translate(${b.x}px, ${b.y}px) rotate(${b.a}rad)`;
    }
  }
  requestAnimationFrame(frame);
}
