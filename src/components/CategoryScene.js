import { useEffect, useRef } from 'react';

// Full-screen anime-style nature backgrounds, one per category.
// Static scenery (sky, hills, trees) is painted once into offscreen layers on resize;
// clouds, petals, rain, fireworks etc. animate on top and react to `level`
// (0..1 loudness from the audio analyser).

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);

// Seeded RNG so a landscape keeps its shape across resizes
const seeded = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const makeLayer = (w, h, dpr, paint) => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  paint(ctx);
  return canvas;
};

const linear = (ctx, y0, y1, colors) => {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), c));
  return g;
};

const glow = (ctx, x, y, r, inner, outer = 'rgba(255, 255, 255, 0)') => {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
};

// A hill or mountain ridge; returns a function giving the ridge height at x
const ridge = (ctx, w, h, { y, amp, colors, seed, sharp = false, rim, detail = 3 }) => {
  const r = seeded(seed);
  const waves = Array.from({ length: detail }, (_, i) => ({
    f: (0.0015 + r() * 0.003) * (i + 1) * (sharp ? 1.8 : 1),
    p: r() * TAU,
    a: amp / (i + 1),
  }));
  const at = (x) => waves.reduce((yy, wv) => {
    const v = Math.sin(x * wv.f + wv.p);
    return yy - (sharp ? (1 - Math.abs(v)) * 2 - 1 : v) * wv.a;
  }, y);
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w + 6; x += 6) ctx.lineTo(x, at(x));
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, y - amp * 1.5, h, colors);
  ctx.fill();
  if (rim) {
    ctx.beginPath();
    for (let x = 0; x <= w + 6; x += 6) (x ? ctx.lineTo(x, at(x)) : ctx.moveTo(x, at(x)));
    ctx.strokeStyle = rim;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  return at;
};

const pine = (ctx, x, base, hgt, color) => {
  ctx.fillStyle = color;
  ctx.fillRect(x - hgt * 0.03, base - hgt * 0.15, hgt * 0.06, hgt * 0.17);
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const y = base - hgt * 0.1 - hgt * 0.22 * i;
    const half = hgt * 0.3 * (1 - i * 0.2);
    ctx.moveTo(x - half, y);
    ctx.lineTo(x, y - hgt * 0.38);
    ctx.lineTo(x + half, y);
  }
  ctx.fill();
};

// Puffy cel-shaded cumulus cloud with a flat base
const cloudSprite = (dpr, size, pal, seed) => {
  const r = seeded(seed);
  const cw = size * 2.5;
  const ch = size * 1.3;
  const img = makeLayer(cw, ch, dpr, (c) => {
    const n = 6 + Math.floor(r() * 4);
    const puffs = Array.from({ length: n }, (_, i) => {
      const t = i / (n - 1);
      const lift = Math.sin(t * Math.PI);
      return {
        x: size * 0.45 + t * size * 1.6,
        y: size * 1.05 - lift * size * (0.2 + r() * 0.2),
        rad: size * (0.18 + lift * 0.28 + r() * 0.06),
      };
    });
    const puff = (dx, dy, k, color) => {
      c.fillStyle = color;
      puffs.forEach((p) => {
        c.beginPath();
        c.arc(p.x + dx * p.rad, p.y + dy * p.rad, p.rad * k, 0, TAU);
        c.fill();
      });
    };
    puff(0, 0.12, 1, pal.shadow);
    puff(0, 0, 0.92, pal.base);
    puff(-0.22, -0.28, 0.55, pal.light);
    c.globalCompositeOperation = 'destination-out';
    c.fillRect(0, size * 1.15, cw, ch);
  });
  return { img, cw, ch };
};

const makeClouds = (dpr, w, h, pal, count, [y0, y1], [s0, s1], seed) => {
  const r = seeded(seed);
  const base = Math.min(w, h);
  return Array.from({ length: count }, (_, i) => {
    const sprite = cloudSprite(dpr, base * (s0 + r() * (s1 - s0)), pal, seed + i * 17);
    return { ...sprite, x: r() * (w + sprite.cw) - sprite.cw, y: h * (y0 + r() * (y1 - y0)), speed: 0.08 + r() * 0.18 };
  });
};

const drawClouds = (ctx, clouds, w, k, boost = 1) => {
  clouds.forEach((c) => {
    c.x += c.speed * k * boost;
    if (c.x > w + 10) c.x = -c.cw;
    ctx.drawImage(c.img, c.x, c.y, c.cw, c.ch);
  });
};

const makeBlades = (w, count, [l0, l1], shades) =>
  Array.from({ length: count }, () => ({
    x: rand(-10, w + 10), len: rand(l0, l1), wd: rand(1.5, 3.5), shade: Math.floor(rand(0, shades)),
  }));

const drawBlades = (ctx, blades, h, t, level, colors) => {
  blades.forEach((b) => {
    const sway = Math.sin(t * 1.6 + b.x * 0.015) * (b.len * 0.12 + level * b.len * 0.35);
    ctx.fillStyle = colors[b.shade];
    ctx.beginPath();
    ctx.moveTo(b.x - b.wd, h);
    ctx.quadraticCurveTo(b.x + sway * 0.4, h - b.len * 0.5, b.x + sway, h - b.len);
    ctx.quadraticCurveTo(b.x + sway * 0.4 + b.wd * 0.3, h - b.len * 0.5, b.x + b.wd, h);
    ctx.fill();
  });
};

const makeStars = (w, h, count, maxY) =>
  Array.from({ length: count }, () => ({ x: rand(0, w), y: rand(0, h * maxY), r: rand(0.4, 1.6), tw: rand(0, TAU) }));

const drawStars = (ctx, stars, t, level) => {
  stars.forEach((st) => {
    const a = 0.45 + Math.sin(t * 2 + st.tw) * 0.4;
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(a, 0.05)})`;
    ctx.beginPath();
    ctx.arc(st.x, st.y, st.r * (1 + level * 0.8), 0, TAU);
    ctx.fill();
  });
};

const drawRain = (ctx, drops, w, h, k, level, color, wind = 2) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  drops.forEach((d) => {
    d.y += d.speed * k * (1 + level);
    d.x += wind * k;
    if (d.y > h) { d.y = rand(-60, 0); d.x = rand(-60, w); }
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x + wind * 2, d.y + d.len);
  });
  ctx.stroke();
};

const makeDrops = (w, h, count) =>
  Array.from({ length: count }, () => ({ x: rand(0, w), y: rand(0, h), len: rand(10, 22), speed: rand(8, 14) }));

// Water shimmer: short flickering strokes, brightest in a column under the light source
const drawShimmer = (ctx, w, y0, y1, t, cx, color, level) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (let i = 0; i < 40; i++) {
    const p = i / 40;
    const y = y0 + (y1 - y0) * p * p + 4;
    const spread = 30 + p * w * 0.25;
    const x = cx + Math.sin(i * 12.9898 + Math.floor(t * 3 + i) * 0.7) * spread;
    const len = 10 + p * 40;
    ctx.globalAlpha = (0.25 + 0.35 * Math.abs(Math.sin(t * 2 + i))) * (0.7 + level * 0.6);
    ctx.beginPath();
    ctx.moveTo(x - len / 2, y);
    ctx.lineTo(x + len / 2, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
};

const drawBird = (ctx, b, t) => {
  const flap = Math.sin(t * 8 + b.phase) * b.size * 0.5;
  ctx.beginPath();
  ctx.moveTo(b.x - b.size, b.y - flap);
  ctx.quadraticCurveTo(b.x - b.size * 0.4, b.y - b.size * 0.2, b.x, b.y);
  ctx.quadraticCurveTo(b.x + b.size * 0.4, b.y - b.size * 0.2, b.x + b.size, b.y - flap);
  ctx.stroke();
};

const updateBirds = (ctx, s, w, h, t, k, color, chance = 0.003) => {
  if (Math.random() < chance * k && s.birds.length < 6) {
    const n = Math.floor(rand(1, 4));
    const y = rand(h * 0.1, h * 0.4);
    for (let i = 0; i < n; i++) s.birds.push({ x: -20 - i * 25, y: y + i * 12, size: rand(5, 9), phase: rand(0, TAU), speed: rand(1, 1.6) });
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  s.birds = s.birds.filter((b) => b.x < w + 40);
  s.birds.forEach((b) => {
    b.x += b.speed * k;
    b.y += Math.sin(t + b.phase) * 0.2 * k;
    drawBird(ctx, b, t);
  });
};

const SCENES = {
  // Summer meadow under a big aqua sky
  dreamy: {
    init: (w, h, dpr) => ({
      sky: makeLayer(w, h, dpr, (c) => {
        c.fillStyle = linear(c, 0, h * 0.8, ['#0b7cc4', '#2fb0e6', '#86dcf2', '#d4f7fa']);
        c.fillRect(0, 0, w, h);
      }),
      land: makeLayer(w, h, dpr, (c) => {
        ridge(c, w, h, { y: h * 0.62, amp: h * 0.08, colors: ['#a6d8ec', '#7fc1dd'], seed: 3 });
        ridge(c, w, h, { y: h * 0.72, amp: h * 0.05, colors: ['#62c4a0', '#2f8f6a'], seed: 7, rim: 'rgba(190, 255, 220, 0.7)' });
        ridge(c, w, h, { y: h * 0.84, amp: h * 0.03, colors: ['#4cb466', '#2b7a43'], seed: 11, rim: 'rgba(180, 240, 150, 0.8)' });
      }),
      clouds: makeClouds(dpr, w, h, { base: '#f2fbff', light: '#ffffff', shadow: '#a4d3ee' }, 5, [0.05, 0.42], [0.1, 0.24], 21),
      blades: makeBlades(w, Math.round(w / 6), [h * 0.04, h * 0.11], 3),
      pollen: Array.from({ length: 40 }, () => ({ x: rand(0, w), y: rand(h * 0.4, h), r: rand(1, 2.5), ph: rand(0, TAU) })),
      birds: [],
    }),
    draw: (ctx, w, h, s, t, level, k) => {
      ctx.drawImage(s.sky, 0, 0, w, h);
      const sx = w * 0.82;
      const sy = h * 0.13;
      const base = Math.min(w, h);
      glow(ctx, sx, sy, base * (0.4 + level * 0.15), 'rgba(255, 255, 235, 0.85)');
      ctx.fillStyle = '#fffef5';
      ctx.beginPath();
      ctx.arc(sx, sy, base * 0.04, 0, TAU);
      ctx.fill();
      // Lens flare dots running from the sun towards the centre
      [0.3, 0.5, 0.75].forEach((p, i) => {
        glow(ctx, sx + (w / 2 - sx) * p * 1.4, sy + (h / 2 - sy) * p * 1.4, base * (0.03 + i * 0.015), `rgba(180, 255, 250, ${0.25 + level * 0.2})`);
      });
      drawClouds(ctx, s.clouds, w, k);
      updateBirds(ctx, s, w, h, t, k, 'rgba(20, 60, 80, 0.7)');
      ctx.drawImage(s.land, 0, 0, w, h);
      drawBlades(ctx, s.blades, h, t, level, ['#2f8a48', '#3fa257', '#55b866']);
      s.pollen.forEach((p) => {
        p.x += 0.3 * k;
        p.y -= 0.15 * k * (1 + level * 2);
        if (p.y < h * 0.3 || p.x > w) { p.y = rand(h * 0.7, h); p.x = rand(-20, w); }
        ctx.fillStyle = `rgba(255, 255, 220, ${0.4 + Math.sin(t * 3 + p.ph) * 0.3})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 + level), 0, TAU);
        ctx.fill();
      });
    },
  },

  // Cherry blossom hill at sunset
  romance: {
    init: (w, h, dpr) => {
      const petals = Array.from({ length: 70 }, () => ({
        x: rand(0, w), y: rand(-h, h), vx: rand(0.3, 1), vy: rand(0.5, 1.2), rot: rand(0, TAU), vr: rand(-0.05, 0.05),
        size: rand(3, 6), color: ['#ffc4d6', '#ffadc6', '#ffe0ea'][Math.floor(rand(0, 3))],
      }));
      return {
        sky: makeLayer(w, h, dpr, (c) => {
          c.fillStyle = linear(c, 0, h * 0.75, ['#4f4a9a', '#b86fae', '#ff9cb2', '#ffd3a8']);
          c.fillRect(0, 0, w, h);
        }),
        land: makeLayer(w, h, dpr, (c) => {
          ridge(c, w, h, { y: h * 0.68, amp: h * 0.05, colors: ['#b67aa6', '#93608e'], seed: 5 });
          ridge(c, w, h, { y: h * 0.8, amp: h * 0.05, colors: ['#6e3d6c', '#40223f'], seed: 9, rim: 'rgba(255, 180, 200, 0.8)' });
          // Sakura tree on the right
          const r = seeded(42);
          const scale = Math.min(w, h) / 800;
          const ends = [];
          const branch = (x, y, len, ang, width, depth) => {
            const x2 = x + Math.cos(ang) * len;
            const y2 = y + Math.sin(ang) * len;
            c.strokeStyle = '#3b1f2b';
            c.lineWidth = width;
            c.lineCap = 'round';
            c.beginPath();
            c.moveTo(x, y);
            c.lineTo(x2, y2);
            c.stroke();
            if (depth <= 2) ends.push([x2, y2]);
            if (depth === 0) return;
            const n = 2 + (r() < 0.35 ? 1 : 0);
            for (let i = 0; i < n; i++) branch(x2, y2, len * (0.68 + r() * 0.12), ang + (r() - 0.5) * 1.1, width * 0.66, depth - 1);
          };
          branch(w * 0.9, h + 5, h * 0.22, -Math.PI / 2 - 0.25, Math.max(8, 22 * scale), 6);
          ends.forEach(([x, y]) => {
            for (let i = 0; i < 5; i++) {
              c.fillStyle = ['#ffc4d6', '#ffadc6', '#ff94b4', '#ffe0ea'][Math.floor(r() * 4)];
              c.beginPath();
              c.arc(x + (r() - 0.5) * 30 * scale, y + (r() - 0.5) * 24 * scale, (10 + r() * 14) * scale, 0, TAU);
              c.fill();
            }
          });
        }),
        clouds: makeClouds(dpr, w, h, { base: '#ffc9d6', light: '#fff0f3', shadow: '#d98aa8' }, 4, [0.08, 0.4], [0.08, 0.18], 31),
        petals,
        birds: [],
      };
    },
    draw: (ctx, w, h, s, t, level, k) => {
      ctx.drawImage(s.sky, 0, 0, w, h);
      const base = Math.min(w, h);
      glow(ctx, w * 0.35, h * 0.64, base * (0.45 + level * 0.15), 'rgba(255, 220, 190, 0.8)');
      ctx.fillStyle = '#fff0dc';
      ctx.beginPath();
      ctx.arc(w * 0.35, h * 0.64, base * 0.09, 0, TAU);
      ctx.fill();
      drawClouds(ctx, s.clouds, w, k);
      updateBirds(ctx, s, w, h, t, k, 'rgba(70, 30, 60, 0.6)', 0.002);
      ctx.drawImage(s.land, 0, 0, w, h);
      s.petals.forEach((p) => {
        p.x -= p.vx * k * (1 + level * 2);
        p.y += p.vy * k * (1 + level);
        p.rot += p.vr * k;
        if (p.y > h + 10 || p.x < -10) { p.y = rand(-40, h * 0.5); p.x = rand(w * 0.5, w + 40); }
        ctx.save();
        ctx.translate(p.x + Math.sin(t + p.rot) * 8, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      });
    },
  },

  // Sunrise over a calm river with floating diyas
  devotional: {
    init: (w, h, dpr) => {
      const horizon = h * 0.66;
      return {
        horizon,
        sky: makeLayer(w, h, dpr, (c) => {
          c.fillStyle = linear(c, 0, horizon, ['#3a5d9e', '#e9967f', '#ffc887', '#fff0c4']);
          c.fillRect(0, 0, w, h);
        }),
        land: makeLayer(w, h, dpr, (c) => {
          ridge(c, w, h, { y: horizon - h * 0.02, amp: h * 0.04, colors: ['#c58c95', '#a56d82'], seed: 13 });
          c.fillStyle = linear(c, horizon, h, ['#ffe2a8', '#e7a283', '#5a70a8', '#2a3c6b']);
          c.fillRect(0, horizon, w, h - horizon);
          const r = seeded(8);
          for (let i = 0; i < 9; i++) {
            const x = r() * w;
            const y = horizon + (h - horizon) * (0.35 + r() * 0.6);
            const sc = (y - horizon) / (h - horizon);
            c.fillStyle = '#3f8a5a';
            c.beginPath();
            c.ellipse(x, y, 26 * sc + 6, 8 * sc + 2, 0, 0, TAU);
            c.fill();
            if (r() < 0.6) {
              c.fillStyle = '#ff9ec0';
              c.beginPath();
              c.ellipse(x, y - 6 * sc - 2, 7 * sc + 2, 5 * sc + 2, 0, 0, TAU);
              c.fill();
            }
          }
          ridge(c, w, h, { y: h * 0.97, amp: h * 0.02, colors: ['#3d6b45', '#25452d'], seed: 17 });
        }),
        clouds: makeClouds(dpr, w, h, { base: '#ffd9b8', light: '#fff4e4', shadow: '#d99a8a' }, 4, [0.06, 0.32], [0.08, 0.17], 41),
        diyas: Array.from({ length: 9 }, () => ({ x: rand(0, w), p: rand(0.15, 0.95), ph: rand(0, TAU) })),
        embers: Array.from({ length: 30 }, () => ({ x: rand(0, w), y: rand(0, h), sp: rand(0.2, 0.6), ph: rand(0, TAU) })),
      };
    },
    draw: (ctx, w, h, s, t, level, k) => {
      ctx.drawImage(s.sky, 0, 0, w, h);
      const sx = w / 2;
      const sy = s.horizon;
      const base = Math.min(w, h);
      // Slowly turning sun rays
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(t * 0.03);
      ctx.fillStyle = `rgba(255, 240, 200, ${0.08 + level * 0.12})`;
      for (let i = 0; i < 14; i++) {
        ctx.rotate(TAU / 14);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.max(w, h), -40);
        ctx.lineTo(Math.max(w, h), 40);
        ctx.fill();
      }
      ctx.restore();
      glow(ctx, sx, sy, base * (0.35 + level * 0.15), 'rgba(255, 230, 160, 0.9)');
      ctx.fillStyle = '#fff3cf';
      ctx.beginPath();
      ctx.arc(sx, sy, base * 0.08, Math.PI, TAU);
      ctx.fill();
      drawClouds(ctx, s.clouds, w, k);
      ctx.drawImage(s.land, 0, 0, w, h);
      drawShimmer(ctx, w, sy, h, t, sx, 'rgba(255, 245, 210, 1)', level);
      s.diyas.forEach((d) => {
        const y = sy + (h - sy) * d.p;
        const sc = 0.4 + d.p * 1.2;
        d.x += 0.25 * sc * k;
        if (d.x > w + 30) d.x = -30;
        const bob = Math.sin(t * 1.5 + d.ph) * 1.5 * sc;
        glow(ctx, d.x, y - 8 * sc + bob, 26 * sc * (1 + level), 'rgba(255, 190, 80, 0.6)', 'rgba(255, 120, 0, 0)');
        ctx.fillStyle = '#8a4b1f';
        ctx.beginPath();
        ctx.ellipse(d.x, y + bob, 9 * sc, 3.5 * sc, 0, 0, Math.PI);
        ctx.fill();
        ctx.fillStyle = '#fff2b0';
        ctx.beginPath();
        ctx.ellipse(d.x, y - 5 * sc + bob, 2.2 * sc, 5 * sc * (1 + Math.sin(t * 9 + d.ph) * 0.12), 0, 0, TAU);
        ctx.fill();
      });
      s.embers.forEach((e) => {
        e.y -= e.sp * k * (1 + level * 2);
        if (e.y < 0) { e.y = h; e.x = rand(0, w); }
        ctx.fillStyle = `rgba(255, 220, 140, ${0.35 + Math.sin(t * 3 + e.ph) * 0.25})`;
        ctx.beginPath();
        ctx.arc(e.x + Math.sin(t + e.ph) * 6, e.y, 1.6, 0, TAU);
        ctx.fill();
      });
    },
  },

  // Desert dunes under a huge moon
  sufi: {
    init: (w, h, dpr) => ({
      sky: makeLayer(w, h, dpr, (c) => {
        c.fillStyle = linear(c, 0, h * 0.8, ['#050a28', '#121d52', '#363d7c', '#76609a']);
        c.fillRect(0, 0, w, h);
      }),
      land: makeLayer(w, h, dpr, (c) => {
        ridge(c, w, h, { y: h * 0.72, amp: h * 0.06, colors: ['#4a3b78', '#362a5e'], seed: 23, detail: 2, rim: 'rgba(210, 190, 255, 0.5)' });
        ridge(c, w, h, { y: h * 0.82, amp: h * 0.05, colors: ['#33285a', '#241c44'], seed: 29, detail: 2, rim: 'rgba(230, 200, 140, 0.45)' });
        ridge(c, w, h, { y: h * 0.92, amp: h * 0.04, colors: ['#1f1840', '#130e2a'], seed: 31, detail: 2, rim: 'rgba(230, 200, 140, 0.35)' });
      }),
      stars: makeStars(w, h, 220, 0.7),
      shooting: [],
      sand: Array.from({ length: 120 }, () => ({ r: rand(20, Math.max(w, h) * 0.45), a: rand(0, TAU), size: rand(0.6, 1.8), sp: rand(0.4, 1.2) })),
    }),
    draw: (ctx, w, h, s, t, level, k) => {
      ctx.drawImage(s.sky, 0, 0, w, h);
      drawStars(ctx, s.stars, t, level);
      const mx = w * 0.72;
      const my = h * 0.26;
      const base = Math.min(w, h);
      glow(ctx, mx, my, base * (0.3 + level * 0.15), 'rgba(255, 244, 214, 0.55)');
      ctx.fillStyle = '#fff6dc';
      ctx.beginPath();
      ctx.arc(mx, my, base * 0.085, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(220, 205, 170, 0.45)';
      [[-0.3, -0.2, 0.18], [0.25, 0.1, 0.13], [-0.05, 0.35, 0.1]].forEach(([dx, dy, rr]) => {
        ctx.beginPath();
        ctx.arc(mx + dx * base * 0.085, my + dy * base * 0.085, rr * base * 0.085, 0, TAU);
        ctx.fill();
      });
      if (Math.random() < (0.006 + level * 0.02) * k) {
        s.shooting.push({ x: rand(0, w * 0.7), y: rand(0, h * 0.3), vx: rand(6, 10), vy: rand(2, 4), life: 1 });
      }
      s.shooting = s.shooting.filter((st) => st.life > 0);
      s.shooting.forEach((st) => {
        ctx.strokeStyle = `rgba(255, 255, 255, ${st.life})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(st.x, st.y);
        ctx.lineTo(st.x - st.vx * 8, st.y - st.vy * 8);
        ctx.stroke();
        st.x += st.vx * k;
        st.y += st.vy * k;
        st.life -= 0.02 * k;
      });
      ctx.drawImage(s.land, 0, 0, w, h);
      // Golden sand swirling like a dervish
      ctx.fillStyle = 'rgba(240, 210, 140, 0.7)';
      s.sand.forEach((d) => {
        d.a += (d.sp * k * (0.4 + level * 2.5)) / Math.sqrt(d.r) * 0.25;
        const x = w / 2 + Math.cos(d.a) * d.r;
        const y = h * 0.84 + Math.sin(d.a) * d.r * 0.18;
        ctx.beginPath();
        ctx.arc(x, y, d.size * (1 + level), 0, TAU);
        ctx.fill();
      });
    },
  },

  // Storm over jagged mountains and a pine forest
  rock: {
    init: (w, h, dpr) => ({
      sky: makeLayer(w, h, dpr, (c) => {
        c.fillStyle = linear(c, 0, h * 0.8, ['#121722', '#283043', '#46506a']);
        c.fillRect(0, 0, w, h);
      }),
      land: makeLayer(w, h, dpr, (c) => {
        ridge(c, w, h, { y: h * 0.56, amp: h * 0.16, colors: ['#55617f', '#3a4459'], seed: 37, sharp: true, rim: 'rgba(160, 185, 225, 0.6)' });
        const near = ridge(c, w, h, { y: h * 0.74, amp: h * 0.1, colors: ['#242a3a', '#171b26'], seed: 43, sharp: true, rim: 'rgba(120, 140, 180, 0.4)' });
        const r = seeded(4);
        for (let x = -10; x < w + 20; x += 18 + r() * 26) pine(c, x, Math.max(near(x) + h * 0.12, h * 0.9), h * (0.08 + r() * 0.08), '#0d1018');
        c.fillStyle = '#0d1018';
        c.fillRect(0, h * 0.95, w, h * 0.05);
      }),
      clouds: makeClouds(dpr, w, h, { base: '#4b5366', light: '#6c7588', shadow: '#2a3040' }, 6, [-0.05, 0.28], [0.14, 0.26], 51),
      drops: makeDrops(w, h, 260),
      flash: 0,
      bolt: null,
      boltLife: 0,
      prev: 0,
    }),
    draw: (ctx, w, h, s, t, level, k) => {
      ctx.drawImage(s.sky, 0, 0, w, h);
      const kick = level - s.prev;
      s.prev = level;
      if (k > 0.5 && ((kick > 0.08 && level > 0.45) || Math.random() < 0.003 * k)) {
        let x = rand(w * 0.1, w * 0.9);
        const pts = [[x, h * 0.1]];
        for (let y = h * 0.1; y < h * 0.65; y += rand(20, 45)) {
          x += rand(-35, 35);
          pts.push([x, y]);
        }
        s.bolt = pts;
        s.boltLife = 1;
        s.flash = 0.35;
      }
      if (s.bolt && s.boltLife > 0) {
        ctx.strokeStyle = `rgba(220, 240, 255, ${s.boltLife})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = '#7fe8ff';
        ctx.shadowBlur = 25;
        ctx.beginPath();
        s.bolt.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
        ctx.shadowBlur = 0;
        s.boltLife -= 0.06 * k;
      }
      drawClouds(ctx, s.clouds, w, k, 3);
      ctx.drawImage(s.land, 0, 0, w, h);
      drawRain(ctx, s.drops, w, h, k, level, 'rgba(170, 200, 230, 0.45)', 3);
      if (s.flash > 0) {
        ctx.fillStyle = `rgba(220, 240, 255, ${s.flash})`;
        ctx.fillRect(0, 0, w, h);
        s.flash *= 0.85;
      }
    },
  },

  // Fireworks over a lake on a summer festival night
  party: {
    init: (w, h, dpr) => ({
      sky: makeLayer(w, h, dpr, (c) => {
        c.fillStyle = linear(c, 0, h * 0.72, ['#060b2c', '#1b1f5e', '#4e2b7c', '#ff6f9e']);
        c.fillRect(0, 0, w, h);
      }),
      land: makeLayer(w, h, dpr, (c) => {
        ridge(c, w, h, { y: h * 0.7, amp: h * 0.05, colors: ['#221a4e', '#171236'], seed: 53 });
        c.fillStyle = linear(c, h * 0.74, h, ['#3d2c72', '#1a1240', '#0c0822']);
        c.fillRect(0, h * 0.74, w, h * 0.26);
        const r = seeded(9);
        for (let x = -10; x < w + 20; x += 24 + r() * 30) pine(c, x, h * 0.76, h * (0.05 + r() * 0.05), '#120d2c');
      }),
      stars: makeStars(w, h, 90, 0.5),
      bursts: [],
      flies: Array.from({ length: 40 }, () => ({ x: rand(0, w), y: rand(h * 0.78, h), ph: rand(0, TAU), sp: rand(0.2, 0.6) })),
      prev: 0,
      lastHue: 190,
    }),
    draw: (ctx, w, h, s, t, level, k) => {
      ctx.drawImage(s.sky, 0, 0, w, h);
      drawStars(ctx, s.stars, t, 0);
      const kick = level - s.prev;
      s.prev = level;
      if (k > 0.3 && ((kick > 0.07 && level > 0.35) || Math.random() < 0.025 * k)) {
        const x = rand(w * 0.1, w * 0.9);
        const y = rand(h * 0.1, h * 0.45);
        const hue = Math.floor(rand(0, 360));
        s.lastHue = hue;
        const n = 70;
        s.bursts.push({
          x, y, life: 1, hue,
          parts: Array.from({ length: n }, (_, i) => {
            const a = (i / n) * TAU;
            const v = rand(1.5, 4) * (1 + level);
            return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v };
          }),
        });
      }
      ctx.globalCompositeOperation = 'lighter';
      s.bursts = s.bursts.filter((b) => b.life > 0);
      s.bursts.forEach((b) => {
        if (b.life > 0.9) glow(ctx, b.x, b.y, 80, `hsla(${b.hue}, 100%, 70%, 0.35)`, `hsla(${b.hue}, 100%, 70%, 0)`);
        ctx.fillStyle = `hsla(${b.hue}, 100%, 70%, ${b.life})`;
        b.parts.forEach((p) => {
          p.x += p.vx * k;
          p.y += p.vy * k;
          p.vx *= 0.985;
          p.vy = p.vy * 0.985 + 0.03 * k;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.8, 0, TAU);
          ctx.fill();
        });
        b.life -= 0.012 * k;
      });
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(s.land, 0, 0, w, h);
      drawShimmer(ctx, w, h * 0.74, h, t, w / 2, `hsla(${s.lastHue}, 100%, 75%, 1)`, level);
      s.flies.forEach((f) => {
        f.x += Math.sin(t * f.sp + f.ph) * 0.5 * k;
        f.y += Math.cos(t * f.sp * 1.3 + f.ph) * 0.3 * k;
        glow(ctx, f.x, f.y, 8 * (1 + level), `rgba(210, 255, 140, ${0.5 + Math.sin(t * 3 + f.ph) * 0.4})`, 'rgba(210, 255, 140, 0)');
      });
    },
  },

  // Golden-hour countryside with a windmill
  retro: {
    init: (w, h, dpr) => {
      let mill;
      const land = makeLayer(w, h, dpr, (c) => {
        ridge(c, w, h, { y: h * 0.66, amp: h * 0.04, colors: ['#d49b62', '#bf8550'], seed: 61 });
        const mid = ridge(c, w, h, { y: h * 0.76, amp: h * 0.04, colors: ['#e2ad4c', '#c58a2e'], seed: 67, rim: 'rgba(255, 230, 150, 0.8)' });
        const mx = w * 0.76;
        const top = mid(mx) - h * 0.17;
        c.fillStyle = '#5a3a22';
        c.beginPath();
        c.moveTo(mx - h * 0.025, mid(mx) + 4);
        c.lineTo(mx - h * 0.014, top);
        c.lineTo(mx + h * 0.014, top);
        c.lineTo(mx + h * 0.025, mid(mx) + 4);
        c.fill();
        mill = { x: mx, y: top, r: h * 0.11 };
        ridge(c, w, h, { y: h * 0.9, amp: h * 0.025, colors: ['#b97f2c', '#8e5f1f'], seed: 71 });
      });
      return {
        sky: makeLayer(w, h, dpr, (c) => {
          c.fillStyle = linear(c, 0, h * 0.7, ['#f2b05f', '#f59d63', '#f8ca8c', '#fde8ba']);
          c.fillRect(0, 0, w, h);
        }),
        land,
        mill,
        angle: 0,
        clouds: makeClouds(dpr, w, h, { base: '#ffd9a8', light: '#fff1d8', shadow: '#e39a66' }, 4, [0.05, 0.35], [0.09, 0.2], 71),
        blades: makeBlades(w, Math.round(w / 7), [h * 0.05, h * 0.12], 3),
        birds: [],
        vignette: makeLayer(w, h, dpr, (c) => {
          const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
          g.addColorStop(0, 'rgba(60, 30, 10, 0)');
          g.addColorStop(1, 'rgba(60, 30, 10, 0.45)');
          c.fillStyle = g;
          c.fillRect(0, 0, w, h);
        }),
      };
    },
    draw: (ctx, w, h, s, t, level, k) => {
      ctx.drawImage(s.sky, 0, 0, w, h);
      const base = Math.min(w, h);
      glow(ctx, w * 0.3, h * 0.6, base * (0.45 + level * 0.15), 'rgba(255, 235, 180, 0.85)');
      ctx.fillStyle = '#fff3d1';
      ctx.beginPath();
      ctx.arc(w * 0.3, h * 0.6, base * 0.1, 0, TAU);
      ctx.fill();
      drawClouds(ctx, s.clouds, w, k);
      updateBirds(ctx, s, w, h, t, k, 'rgba(90, 50, 20, 0.6)');
      ctx.drawImage(s.land, 0, 0, w, h);
      s.angle += (0.01 + level * 0.06) * k;
      ctx.save();
      ctx.translate(s.mill.x, s.mill.y);
      ctx.rotate(s.angle);
      ctx.fillStyle = '#6b4528';
      for (let i = 0; i < 4; i++) {
        ctx.rotate(TAU / 4);
        ctx.fillRect(0, -s.mill.r * 0.06, s.mill.r, s.mill.r * 0.12);
        ctx.fillRect(s.mill.r * 0.3, -s.mill.r * 0.06, s.mill.r * 0.7, s.mill.r * 0.22);
      }
      ctx.restore();
      ctx.fillStyle = '#3e2716';
      ctx.beginPath();
      ctx.arc(s.mill.x, s.mill.y, s.mill.r * 0.08, 0, TAU);
      ctx.fill();
      drawBlades(ctx, s.blades, h, t, level, ['#c99032', '#ddb04f', '#a8741f']);
      ctx.drawImage(s.vignette, 0, 0, w, h);
      ctx.fillStyle = 'rgba(255, 240, 210, 0.18)';
      for (let i = 0; i < 120; i++) ctx.fillRect(rand(0, w), rand(0, h), 1.5, 1.5);
    },
  },

  // Misty pine lake in the rain
  rainy: {
    init: (w, h, dpr) => ({
      sky: makeLayer(w, h, dpr, (c) => {
        c.fillStyle = linear(c, 0, h * 0.75, ['#46606f', '#7a95a4', '#aec2ca']);
        c.fillRect(0, 0, w, h);
      }),
      land: makeLayer(w, h, dpr, (c) => {
        ridge(c, w, h, { y: h * 0.58, amp: h * 0.08, colors: ['#8ea6b2', '#7b94a1'], seed: 73 });
        const mid = ridge(c, w, h, { y: h * 0.68, amp: h * 0.05, colors: ['#5f7a88', '#4c6573'], seed: 79 });
        const r = seeded(12);
        for (let x = -10; x < w + 20; x += 14 + r() * 22) pine(c, x, mid(x) + h * 0.05, h * (0.06 + r() * 0.05), '#41596a');
        c.fillStyle = linear(c, h * 0.78, h, ['#9db2bc', '#5b7582', '#334955']);
        c.fillRect(0, h * 0.78, w, h * 0.22);
        for (let x = -10; x < w + 20; x += 20 + r() * 30) {
          if (x > w * 0.25 && x < w * 0.7) continue;
          pine(c, x, h * 0.8, h * (0.1 + r() * 0.08), '#22343f');
        }
      }),
      fog: Array.from({ length: 6 }, () => ({ x: rand(0, w), y: rand(h * 0.5, h * 0.8), rw: rand(w * 0.25, w * 0.5), sp: rand(0.1, 0.3) })),
      drops: makeDrops(w, h, 300),
      ripples: [],
    }),
    draw: (ctx, w, h, s, t, level, k) => {
      ctx.drawImage(s.sky, 0, 0, w, h);
      ctx.drawImage(s.land, 0, 0, w, h);
      s.fog.forEach((f) => {
        f.x += f.sp * k;
        if (f.x - f.rw > w) f.x = -f.rw;
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.scale(1, 0.18);
        glow(ctx, 0, 0, f.rw, 'rgba(230, 240, 245, 0.35)', 'rgba(230, 240, 245, 0)');
        ctx.restore();
      });
      if (Math.random() < (0.3 + level) * k) s.ripples.push({ x: rand(0, w), y: rand(h * 0.8, h), r: 1, a: 0.6 });
      s.ripples = s.ripples.filter((rp) => rp.a > 0.03);
      s.ripples.forEach((rp) => {
        rp.r += 0.8 * k;
        rp.a *= 0.95;
        ctx.strokeStyle = `rgba(230, 240, 245, ${rp.a})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(rp.x, rp.y, rp.r * 2, rp.r * 0.5, 0, 0, TAU);
        ctx.stroke();
      });
      drawRain(ctx, s.drops, w, h, k, level, `rgba(220, 235, 245, ${0.35 + level * 0.3})`, 1.5);
    },
  },
};

const CategoryScene = ({ category, playing, analyserRef }) => {
  const canvasRef = useRef(null);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    const scene = SCENES[category] || SCENES.dreamy;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0;
    let h = 0;
    let state = null;
    let level = 0;
    let freq = null;
    let frame;
    let clock = 0;
    let last = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      state = scene.init(w, h, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const loop = (now) => {
      const analyser = analyserRef.current;
      let target = 0;
      if (analyser && playingRef.current) {
        if (!freq || freq.length !== analyser.frequencyBinCount) freq = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(freq);
        let sum = 0;
        const bins = Math.floor(freq.length / 2);
        for (let i = 0; i < bins; i++) sum += freq[i];
        target = Math.min(1, (sum / bins / 255) * 1.6);
      }
      level = level * 0.75 + target * 0.25;
      // k is the per-frame step: 1 at 60fps while playing, slower when paused
      const speed = reduceMotion ? 0.25 : playingRef.current ? 1 : 0.35;
      const dt = Math.min(now - last, 50) / 1000;
      last = now;
      const k = dt * 60 * speed;
      clock += dt * speed;
      scene.draw(ctx, w, h, state, clock, reduceMotion ? 0 : level, k);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, [category, analyserRef]);

  return <canvas ref={canvasRef} className="scene" aria-hidden="true" />;
};

export default CategoryScene;
