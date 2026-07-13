// WEDNESDAY — sky. The current weather in Cambridge, MA, painted live:
// real temperature, cloud cover, wind and precipitation. Cursor makes gusts.
import { canvasIn, DPR, COARSE, REDUCED, pointer } from './util.js';

const API = 'https://api.open-meteo.com/v1/forecast'
  + '?latitude=42.3736&longitude=-71.1097'
  + '&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,is_day,cloud_cover'
  + '&temperature_unit=fahrenheit&wind_speed_unit=mph';

const LABELS = {
  0: 'clear sky', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast',
  45: 'fog', 48: 'rime fog',
  51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle', 56: 'freezing drizzle', 57: 'freezing drizzle',
  61: 'light rain', 63: 'rain', 65: 'heavy rain', 66: 'freezing rain', 67: 'freezing rain',
  71: 'light snow', 73: 'snow', 75: 'heavy snow', 77: 'snow grains',
  80: 'rain showers', 81: 'rain showers', 82: 'heavy showers',
  85: 'snow showers', 86: 'snow showers',
  95: 'thunderstorm', 96: 'thunderstorm', 99: 'thunderstorm',
};

const kindOf = code =>
  code <= 1 ? 'clear' :
  code === 2 ? 'partly' :
  code === 3 ? 'overcast' :
  code <= 48 ? 'fog' :
  (code >= 71 && code <= 77) || code === 85 || code === 86 ? 'snow' :
  code >= 95 ? 'thunder' : 'rain';

const lerp = (a, b, t) => a + (b - a) * t;
const mixHex = (a, b, t) => {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], t))).join(',')})`;
};

export default async function run(stage) {
  document.body.dataset.theme = 'dark';
  const [c, g] = canvasIn(stage);
  const ptr = pointer();

  // live conditions (graceful fallback if the fetch fails)
  let wx = { temp: 68, code: 2, wind: 8, windDir: 270, isDay: 1, clouds: 40, live: false };
  try {
    const r = await fetch(API, { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    const cur = j.current;
    wx = {
      temp: Math.round(cur.temperature_2m),
      code: cur.weather_code,
      wind: cur.wind_speed_10m,
      windDir: cur.wind_direction_10m,
      isDay: cur.is_day,
      clouds: cur.cloud_cover,
      live: true,
    };
  } catch { /* keep fallback */ }

  const kind = kindOf(wx.code);
  const day = !!wx.isDay;
  const dark = !day || kind === 'thunder';
  document.body.dataset.theme = dark || kind === 'rain' ? 'dark' : 'light';

  // ---- palette from conditions ----
  // heat tint: 0 cold .. 1 hot
  const heat = Math.max(0, Math.min(1, (wx.temp - 20) / 75));
  let top, bot;
  if (day) {
    if (kind === 'clear' || kind === 'partly') {
      top = mixHex(mixHex('#7db4e8', '#3f8edc', 1 - heat * 0.5), '#5a9fd4', 0);
      top = mixHex('#8fc3ef', '#3d7fc4', 1 - heat);          // cold: steel, hot: deep summer blue
      bot = mixHex('#dceefb', '#ffd9a0', heat * 0.75);       // hot days glow gold at the horizon
    } else if (kind === 'overcast' || kind === 'fog') {
      top = '#9aa4ad'; bot = '#dfe3e6';
    } else if (kind === 'snow') {
      top = '#aeb9c4'; bot = '#e8ecf0';
    } else { // rain / thunder in daylight
      top = '#5c6a78'; bot = '#a9b4bd';
    }
  } else {
    if (kind === 'clear' || kind === 'partly') { top = '#060a1e'; bot = '#1b2a4a'; }
    else if (kind === 'snow') { top = '#12161f'; bot = '#2a3140'; }
    else { top = '#0a0d14'; bot = '#1d2330'; }
  }
  const inkText = !dark && (kind !== 'rain');
  const textCol = inkText ? 'rgba(20, 28, 40, 0.88)' : 'rgba(245, 248, 252, 0.92)';
  const dimCol = inkText ? 'rgba(20, 28, 40, 0.45)' : 'rgba(245, 248, 252, 0.42)';

  // ---- particles ----
  let W, H;
  const wind = { x: 0 };                     // px/s horizontal drift from real wind
  {
    const a = (wx.windDir + 180) * Math.PI / 180;   // direction the air moves toward
    wind.x = Math.sin(a) * wx.wind * 6;
  }
  const gust = { x: 0, y: 0 };

  const clouds = [];
  const drops = [];
  const stars = [];
  let cloudSprite = null;

  function makeCloudSprite() {
    const s = document.createElement('canvas');
    s.width = 480; s.height = 200;
    const sg = s.getContext('2d');
    sg.filter = 'blur(18px)';
    const col = day ? '255,255,255' : '190,200,220';
    for (let i = 0; i < 7; i++) {
      const x = 70 + Math.random() * 340, y = 70 + Math.random() * 60, r = 36 + Math.random() * 46;
      sg.fillStyle = `rgba(${col},${0.5 + Math.random() * 0.3})`;
      sg.beginPath(); sg.arc(x, y, r, 0, 7); sg.fill();
    }
    return s;
  }

  function reset() {
    const dpr = DPR();
    W = innerWidth; H = innerHeight;
    c.width = W * dpr; c.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    cloudSprite = makeCloudSprite();
    clouds.length = 0;
    const nClouds = Math.round((wx.clouds / 100) * 9) + (kind === 'overcast' ? 3 : 0);
    for (let i = 0; i < nClouds; i++) {
      clouds.push({
        x: Math.random() * (W + 600) - 300,
        y: Math.random() * H * 0.5 - 40,
        s: 0.6 + Math.random() * 1.3,
        a: 0.35 + Math.random() * 0.45,
      });
    }

    drops.length = 0;
    if (kind === 'rain' || kind === 'thunder' || kind === 'snow') {
      const heavy = [55, 65, 67, 75, 82, 86, 95, 96, 99].includes(wx.code) ? 2
        : [53, 63, 73, 81].includes(wx.code) ? 1.4 : 1;
      const n = Math.round((kind === 'snow' ? 180 : 260) * heavy * (COARSE ? 0.5 : 1));
      for (let i = 0; i < n; i++) {
        drops.push({
          x: Math.random() * W, y: Math.random() * H,
          v: kind === 'snow' ? 40 + Math.random() * 60 : 750 + Math.random() * 550,
          r: kind === 'snow' ? 1 + Math.random() * 2.2 : 0,
          ph: Math.random() * 7,
        });
      }
    }

    stars.length = 0;
    if (!day && (kind === 'clear' || kind === 'partly')) {
      for (let i = 0; i < 150; i++) {
        stars.push({ x: Math.random() * W, y: Math.random() * H * 0.75, r: Math.random() * 1.3 + 0.3, ph: Math.random() * 7 });
      }
    }
  }
  reset();
  addEventListener('resize', reset);

  // compass label for the caption
  const compass = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(wx.windDir / 45) % 8];
  const caption = `cambridge, ma — ${wx.temp}°f, ${LABELS[wx.code] || '—'}, wind ${Math.round(wx.wind)} mph ${compass}${wx.live ? '' : ' (offline guess)'}`;

  let flash = 0, nextFlash = 5 + Math.random() * 8;
  let last = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    const t = now * 0.001;

    // cursor gusts decay
    if (ptr.active && now - ptr.last < 80) {
      gust.x = lerp(gust.x, ptr.vx * 18, 0.2);
      gust.y = lerp(gust.y, ptr.vy * 18, 0.2);
    }
    gust.x *= 0.94; gust.y *= 0.94;

    // sky
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, top);
    sky.addColorStop(1, bot);
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);

    // sun / moon
    if (day && (kind === 'clear' || kind === 'partly')) {
      const sx = W * 0.72, sy = H * 0.24;
      const halo = g.createRadialGradient(sx, sy, 0, sx, sy, H * 0.5);
      halo.addColorStop(0, `rgba(255, 244, 214, ${0.9 - heat * 0.1})`);
      halo.addColorStop(0.12, 'rgba(255, 236, 190, 0.55)');
      halo.addColorStop(1, 'rgba(255, 236, 190, 0)');
      g.fillStyle = halo;
      g.fillRect(0, 0, W, H);
    } else if (!day && (kind === 'clear' || kind === 'partly')) {
      const mx = W * 0.74, my = H * 0.22;
      const halo = g.createRadialGradient(mx, my, 0, mx, my, 160);
      halo.addColorStop(0, 'rgba(230, 238, 255, 0.35)');
      halo.addColorStop(1, 'rgba(230, 238, 255, 0)');
      g.fillStyle = halo; g.fillRect(mx - 160, my - 160, 320, 320);
      g.fillStyle = '#e8edf8';
      g.beginPath(); g.arc(mx, my, 26, 0, 7); g.fill();
      g.fillStyle = top;
      g.beginPath(); g.arc(mx - 10, my - 6, 22, 0, 7); g.fill(); // crescent
    }

    // stars
    if (stars.length) {
      for (const s of stars) {
        const tw = 0.45 + 0.55 * Math.sin(t * 1.6 + s.ph) ** 2;
        g.fillStyle = `rgba(235, 240, 255, ${0.75 * tw})`;
        g.fillRect(s.x, s.y, s.r, s.r);
      }
    }

    // clouds
    for (const cl of clouds) {
      cl.x += (wind.x * 0.06 + gust.x * 0.01) * dt * 60 * 0.16;
      if (cl.x > W + 320) cl.x = -620;
      if (cl.x < -640) cl.x = W + 300;
      g.globalAlpha = cl.a;
      g.drawImage(cloudSprite, cl.x, cl.y, 480 * cl.s, 200 * cl.s);
      g.globalAlpha = 1;
    }

    // fog wash
    if (kind === 'fog') {
      for (let i = 0; i < 3; i++) {
        const y = H * (0.3 + i * 0.22) + Math.sin(t * 0.3 + i * 2) * 24;
        const fg = g.createLinearGradient(0, y - 90, 0, y + 90);
        const col = day ? '235,238,240' : '25,30,40';
        fg.addColorStop(0, `rgba(${col},0)`);
        fg.addColorStop(0.5, `rgba(${col},0.42)`);
        fg.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = fg;
        g.fillRect(0, y - 90, W, 180);
      }
    }

    // precipitation
    if (drops.length) {
      const rainCol = dark ? 'rgba(190, 210, 235, 0.5)' : 'rgba(70, 90, 110, 0.45)';
      g.strokeStyle = rainCol;
      g.lineWidth = 1;
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath();
      for (const d of drops) {
        // local cursor push
        const ddx = d.x - ptr.x, ddy = d.y - ptr.y;
        const near = ddx * ddx + ddy * ddy < 150 * 150 ? 1 : 0;

        if (kind === 'snow') {
          d.x += (Math.sin(t * 0.8 + d.ph) * 18 + wind.x * 0.35 + gust.x * near) * dt;
          d.y += (d.v + gust.y * near * 0.4) * dt;
          if (d.y > H + 4) { d.y = -4; d.x = Math.random() * W; }
          if (d.x < -4) d.x += W + 8; else if (d.x > W + 4) d.x -= W + 8;
          g.moveTo(d.x, d.y);
          g.arc(d.x, d.y, d.r, 0, 7);
        } else {
          const vx = wind.x * 0.8 + gust.x * near;
          d.x += vx * dt;
          d.y += (d.v + gust.y * near) * dt;
          if (d.y > H + 20) { d.y = -20; d.x = Math.random() * W; }
          if (d.x < -20) d.x += W + 40; else if (d.x > W + 20) d.x -= W + 40;
          const lx = vx * 0.016, ly = d.v * 0.018;
          g.moveTo(d.x, d.y);
          g.lineTo(d.x - lx, d.y - ly);
        }
      }
      if (kind === 'snow') g.fill(); else g.stroke();
    }

    // lightning
    if (kind === 'thunder' && !REDUCED) {
      nextFlash -= dt;
      if (nextFlash <= 0) { flash = 1; nextFlash = 4 + Math.random() * 9; }
      if (flash > 0.01) {
        g.fillStyle = `rgba(240, 245, 255, ${flash * 0.55})`;
        g.fillRect(0, 0, W, H);
        flash *= 0.82;
      }
    }

    // the name, thin, hanging in the weather
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const size = Math.min(W * 0.088, 110);
    try { g.letterSpacing = `${size * 0.18}px`; } catch { /* older engines */ }
    g.font = `200 ${size}px 'Helvetica Neue', system-ui, sans-serif`;
    g.fillStyle = textCol;
    g.fillText('AKHIL ACHARYA', W / 2 + size * 0.09, H * 0.46);
    try { g.letterSpacing = '0px'; } catch { }

    // the reading
    g.textAlign = 'left';
    g.font = `11px ui-monospace, Menlo, monospace`;
    g.fillStyle = dimCol;
    g.fillText(caption, 18, H - 20);
  }
  requestAnimationFrame(frame);
}
