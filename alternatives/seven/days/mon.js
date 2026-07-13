// MONDAY — type. The name set huge in a variable serif;
// letter weight bends toward the cursor like a magnet. Idle, it breathes.
import { COARSE, REDUCED, pointer } from './util.js';

export default async function run(stage) {
  document.body.dataset.theme = 'light';

  try {
    const face = new FontFace(
      'Fraunces',
      `url(${new URL('../fonts/fraunces-var.woff2', import.meta.url)}) format('woff2')`,
      { weight: '100 900' }
    );
    document.fonts.add(await face.load());
  } catch { /* fall back to system serif */ }

  stage.innerHTML = `
    <style>
      .kt-wrap {
        position: absolute; inset: 0;
        display: flex; align-items: center; justify-content: center;
        cursor: crosshair;
      }
      .kt {
        font-family: 'Fraunces', Georgia, serif;
        text-align: center;
        line-height: 0.88;
        letter-spacing: -0.015em;
        color: #17140e;
        user-select: none;
      }
      .kt .line { display: block; white-space: nowrap; }
      .kt .line:nth-child(1) { font-size: min(21.5vw, 23vh); }
      .kt .line:nth-child(2) { font-size: min(15vw, 16.5vh); }
      .kt .ch {
        display: inline-block;
        font-variation-settings: 'opsz' 90, 'wght' 440;
      }
    </style>
    <div class="kt-wrap">
      <div class="kt" aria-hidden="true">
        <span class="line" data-text="AKHIL"></span>
        <span class="line" data-text="ACHARYA"></span>
      </div>
    </div>`;

  const letters = [];
  stage.querySelectorAll('.line').forEach(line => {
    for (const ch of line.dataset.text) {
      const s = document.createElement('span');
      s.className = 'ch';
      s.textContent = ch;
      line.appendChild(s);
      letters.push({ el: s, w: 440, tw: 440, cx: 0, cy: 0 });
    }
  });

  function measure() {
    for (const l of letters) {
      const r = l.el.getBoundingClientRect();
      l.cx = r.left + r.width / 2;
      l.cy = r.top + r.height / 2;
    }
  }
  measure();
  addEventListener('resize', measure);
  document.fonts?.ready.then(measure);

  const ptr = pointer();
  const RADIUS = Math.min(innerWidth, innerHeight) * 0.45;
  const hasHover = matchMedia('(hover: hover)').matches;

  function frame(now) {
    requestAnimationFrame(frame);
    const t = now * 0.001;
    const idle = !hasHover || !ptr.active || now - ptr.last > 2500;

    letters.forEach((l, i) => {
      if (idle) {
        // gentle, even breathing around a solid medium weight
        l.tw = REDUCED ? 460 : 440 + 80 * Math.sin(t * 0.85 - i * 0.4);
      } else {
        const d = Math.hypot(ptr.x - l.cx, ptr.y - l.cy);
        const p = Math.max(0, 1 - d / RADIUS);
        // stays a real weight even far from the cursor; never hair-thin
        l.tw = 380 + 320 * (p * p * (3 - 2 * p));
      }
      l.w += (l.tw - l.w) * 0.14;
      // large optical size keeps the serifs solid rather than spidery
      const opsz = 74 + (l.w - 380) / 320 * 58;
      l.el.style.fontVariationSettings = `'opsz' ${opsz.toFixed(1)}, 'wght' ${l.w.toFixed(0)}`;
    });
  }
  requestAnimationFrame(frame);
}
