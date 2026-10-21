import { useEffect, useRef } from 'react';

// Full-screen anime-style Japanese landscapes, one per category.
// Static scenery is painted once into offscreen layers on resize; clouds, petals,
// ribbons, fireworks etc. animate on top. Every scene reacts to `level`
// (0..1 loudness) and `beat` (a pulse that jumps on drum hits and fades out),
// and layers slide with the pointer for a little parallax depth.

const TAU = Math.PI * 2;
const M = 40; // extra width painted on each side of a layer so it can slide for parallax
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

// A layer painted from -M to w + M
const wideLayer = (w, h, dpr, paint) => makeLayer(w + M * 2, h, dpr, (c) => { c.translate(M, 0); paint(c); });
const drawWide = (ctx, layer, w, h, px, depth) => ctx.drawImage(layer, -M + px * depth * M, 0, w + M * 2, h);

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

/* ---------- Scenery painters ---------- */

// A hill or mountain ridge with optional ink outline and rim light; returns height-at-x
const ridge = (c, w, h, { y, amp, colors, seed, sharp = false, rim, ink, detail = 3 }) => {
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
  c.beginPath();
  c.moveTo(-M, h);
  for (let x = -M; x <= w + M; x += 5) c.lineTo(x, at(x));
  c.lineTo(w + M, h);
  c.closePath();
  c.fillStyle = linear(c, y - amp * 1.5, h, colors);
  c.fill();
  const edge = (color, width) => {
    c.beginPath();
    for (let x = -M; x <= w + M; x += 5) (x === -M ? c.moveTo(x, at(x)) : c.lineTo(x, at(x)));
    c.strokeStyle = color;
    c.lineWidth = width;
    c.stroke();
  };
  if (ink) edge(ink, 2.5);
  if (rim) edge(rim, 1.5);
  return at;
};

const torii = (c, x, base, s, color = '#e0482d', ink = 'rgba(30, 8, 8, 0.9)') => {
  const pw = s * 0.07;
  const half = s * 0.42;
  c.fillStyle = color;
  c.strokeStyle = ink;
  c.lineWidth = Math.max(1.5, s * 0.012);
  const box = (x0, y0, bw, bh) => {
    c.beginPath();
    c.rect(x0, y0, bw, bh);
    c.fill();
    c.stroke();
  };
  box(x - half, base - s * 0.95, pw, s * 0.95);
  box(x + half - pw, base - s * 0.95, pw, s * 0.95);
  box(x - half - s * 0.08, base - s * 0.78, half * 2 + s * 0.16, s * 0.06);
  box(x - s * 0.03, base - s * 0.92, s * 0.06, s * 0.14);
  c.beginPath();
  c.moveTo(x - half - s * 0.22, base - s * 1.0);
  c.quadraticCurveTo(x, base - s * 0.92, x + half + s * 0.22, base - s * 1.0);
  c.lineTo(x + half + s * 0.18, base - s * 0.9);
  c.quadraticCurveTo(x, base - s * 0.84, x - half - s * 0.18, base - s * 0.9);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = '#26160f';
  c.beginPath();
  c.moveTo(x - half - s * 0.25, base - s * 1.03);
  c.quadraticCurveTo(x, base - s * 0.95, x + half + s * 0.25, base - s * 1.03);
  c.lineTo(x + half + s * 0.22, base - s * 0.99);
  c.quadraticCurveTo(x, base - s * 0.92, x - half - s * 0.22, base - s * 0.99);
  c.closePath();
  c.fill();
};

const pagoda = (c, x, base, s, color) => {
  c.fillStyle = color;
  let y = base;
  for (let i = 0; i < 5; i++) {
    const bw = s * (0.3 - i * 0.042);
    const bh = s * 0.1;
    c.fillRect(x - bw * 0.55, y - bh, bw * 1.1, bh);
    y -= bh;
    const rw = bw * 1.3;
    c.beginPath();
    c.moveTo(x - rw - s * 0.05, y - s * 0.02);
    c.quadraticCurveTo(x - rw * 0.5, y + s * 0.012, x - bw * 0.45, y - s * 0.055);
    c.lineTo(x + bw * 0.45, y - s * 0.055);
    c.quadraticCurveTo(x + rw * 0.5, y + s * 0.012, x + rw + s * 0.05, y - s * 0.02);
    c.closePath();
    c.fill();
    y -= s * 0.05;
  }
  c.fillRect(x - s * 0.008, y - s * 0.2, s * 0.016, s * 0.2);
};

const pine = (c, x, base, hgt, color) => {
  c.fillStyle = color;
  c.fillRect(x - hgt * 0.03, base - hgt * 0.15, hgt * 0.06, hgt * 0.17);
  c.beginPath();
  for (let i = 0; i < 4; i++) {
    const y = base - hgt * 0.1 - hgt * 0.22 * i;
    const half = hgt * 0.3 * (1 - i * 0.2);
    c.moveTo(x - half, y);
    c.lineTo(x, y - hgt * 0.38);
    c.lineTo(x + half, y);
  }
  c.fill();
};

// Round shaded tree crown (summer greens, autumn maples)
const bush = (c, x, base, s, [light, dark, trunk], r) => {
  c.fillStyle = trunk;
  c.fillRect(x - s * 0.04, base - s * 0.55, s * 0.08, s * 0.55);
  // Big trees get many smaller puffs so the crown reads as foliage, not blobs
  const big = s > 100;
  for (let i = 0; i < (big ? 45 : 10); i++) {
    const a = r() * TAU;
    const d = r() * s * (big ? 0.42 : 0.35);
    const cx = x + Math.cos(a) * d;
    const cy = base - s * 0.8 + Math.sin(a) * d * 0.6;
    const rr = s * (0.17 + r() * 0.14) * (big ? 0.5 : 1);
    const g = c.createRadialGradient(cx - rr * 0.35, cy - rr * 0.45, rr * 0.1, cx, cy, rr);
    g.addColorStop(0, light);
    g.addColorStop(1, dark);
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, rr, 0, TAU);
    c.fill();
  }
};

// Branching blossom tree with shaded flower clusters
const blossomTree = (c, x, y, len, ang, scale, r, { bark, petals }) => {
  const ends = [];
  const branch = (bx, by, l, a, width, depth) => {
    const x2 = bx + Math.cos(a) * l;
    const y2 = by + Math.sin(a) * l;
    c.strokeStyle = bark;
    c.lineWidth = width;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(bx, by);
    c.quadraticCurveTo(bx + Math.cos(a + 0.3) * l * 0.5, by + Math.sin(a + 0.3) * l * 0.5, x2, y2);
    c.stroke();
    if (depth <= 2) ends.push([x2, y2]);
    if (depth === 0) return;
    const n = 2 + (r() < 0.35 ? 1 : 0);
    for (let i = 0; i < n; i++) branch(x2, y2, l * (0.68 + r() * 0.12), a + (r() - 0.5) * 1.1, width * 0.66, depth - 1);
  };
  branch(x, y, len, ang, Math.max(8, 24 * scale), 6);
  ends.forEach(([ex, ey]) => {
    for (let i = 0; i < 6; i++) {
      const cx = ex + (r() - 0.5) * 34 * scale;
      const cy = ey + (r() - 0.5) * 26 * scale;
      const rr = (10 + r() * 15) * scale;
      const g = c.createRadialGradient(cx - rr * 0.3, cy - rr * 0.4, rr * 0.1, cx, cy, rr);
      g.addColorStop(0, petals[0]);
      g.addColorStop(0.6, petals[1]);
      g.addColorStop(1, petals[2]);
      c.fillStyle = g;
      c.beginPath();
      c.arc(cx, cy, rr, 0, TAU);
      c.fill();
    }
  });
};

const bamboo = (c, w, h, { count, colors, ink, leaf, seed, minW, maxW }) => {
  const r = seeded(seed);
  for (let i = 0; i < count; i++) {
    const x = -M + r() * (w + 2 * M);
    const bw = minW + r() * (maxW - minW);
    c.save();
    c.translate(x, h);
    c.rotate((r() - 0.5) * 0.06);
    const g = c.createLinearGradient(-bw / 2, 0, bw / 2, 0);
    g.addColorStop(0, colors[1]);
    g.addColorStop(0.35, colors[0]);
    g.addColorStop(1, colors[2]);
    c.fillStyle = g;
    c.fillRect(-bw / 2, -h * 1.15, bw, h * 1.15);
    if (ink) {
      c.strokeStyle = ink;
      c.lineWidth = 1.2;
      c.strokeRect(-bw / 2, -h * 1.15, bw, h * 1.15);
    }
    c.fillStyle = colors[2];
    for (let y = -h * 0.08 - r() * 40; y > -h * 1.15; y -= 60 + r() * 50) c.fillRect(-bw / 2 - 1, y, bw + 2, 3);
    if (leaf) {
      c.fillStyle = leaf;
      // Slender leaves in small sprays, capped so thick stalks don't get giant leaves
      const len = Math.min(bw * 2.4, 34);
      for (let j = 0; j < 5; j++) {
        const dir = r() < 0.5 ? -1 : 1;
        const y = -h * (0.35 + r() * 0.65);
        for (let l = 0; l < 3; l++) {
          c.save();
          c.translate(dir * bw * 0.4, y + l * 6);
          c.rotate(dir * (0.35 + l * 0.3 + r() * 0.2));
          c.beginPath();
          c.ellipse(dir * len, 0, len, Math.max(2.5, len * 0.16), 0, 0, TAU);
          c.fill();
          c.restore();
        }
      }
    }
    c.restore();
  }
};

/* ---------- Sky painters ---------- */

const PAL = {
  day: { light: '#ffffff', base: '#eef7ff', shadow: '#a3c8e6', glow: 'rgba(255, 255, 255, 0.55)', hl: 'rgba(255, 255, 255, 0.95)', hl0: 'rgba(255, 255, 255, 0)', core: 'rgba(100, 140, 195, 0.45)' },
  dusk: { light: '#fff2f0', base: '#ffc3cf', shadow: '#b278a6', glow: 'rgba(255, 190, 200, 0.5)', hl: 'rgba(255, 240, 220, 0.9)', hl0: 'rgba(255, 240, 220, 0)', core: 'rgba(110, 60, 120, 0.25)' },
  dawn: { light: '#fff6e6', base: '#ffd0ae', shadow: '#bd8792', glow: 'rgba(255, 210, 170, 0.5)', hl: 'rgba(255, 250, 230, 0.9)', hl0: 'rgba(255, 250, 230, 0)', core: 'rgba(120, 80, 115, 0.4)' },
  storm: { light: '#767c98', base: '#464b63', shadow: '#202336', glow: 'rgba(30, 30, 50, 0.5)', hl: 'rgba(160, 170, 210, 0.5)', hl0: 'rgba(160, 170, 210, 0)', core: 'rgba(8, 8, 18, 0.6)' },
  night: { light: '#56619f', base: '#2a3270', shadow: '#141a40', glow: 'rgba(120, 130, 220, 0.25)', hl: 'rgba(205, 215, 255, 0.45)', hl0: 'rgba(205, 215, 255, 0)', core: 'rgba(5, 5, 20, 0.5)' },
  autumn: { light: '#fff1d8', base: '#ffcd96', shadow: '#cf7f5a', glow: 'rgba(255, 200, 140, 0.5)', hl: 'rgba(255, 250, 230, 0.9)', hl0: 'rgba(255, 250, 230, 0)', core: 'rgba(140, 60, 40, 0.35)' },
};

// Cel-shaded cumulus: bright crown, shaded belly, flat soft base
const cloudSprite = (dpr, size, pal, seed) => {
  const r = seeded(seed);
  const cw = size * 2.6;
  const ch = size * 1.55;
  const n = 7 + Math.floor(r() * 4);
  const puffs = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const lift = Math.sin(t * Math.PI);
    puffs.push({ x: size * 0.45 + t * size * 1.7, y: size * 1.3 - lift * size * (0.28 + r() * 0.22), rad: size * (0.17 + lift * 0.3 + r() * 0.07) });
  }
  for (let i = 1; i < n - 1; i += 2) {
    const p = puffs[i];
    puffs.push({ x: p.x + (r() - 0.5) * size * 0.3, y: p.y + p.rad * 0.55, rad: p.rad * 0.7 });
  }
  const img = makeLayer(cw, ch, dpr, (c) => {
    const shape = () => {
      c.beginPath();
      puffs.forEach((p) => {
        c.moveTo(p.x + p.rad, p.y);
        c.arc(p.x, p.y, p.rad, 0, TAU);
      });
    };
    c.save();
    c.shadowColor = pal.glow;
    c.shadowBlur = size * 0.18;
    shape();
    c.fillStyle = pal.base;
    c.fill();
    c.restore();
    shape();
    c.fillStyle = linear(c, size * 0.15, size * 1.45, [pal.light, pal.base, pal.shadow]);
    c.fill();
    c.save();
    shape();
    c.clip();
    puffs.forEach((p) => glow(c, p.x - p.rad * 0.3, p.y - p.rad * 0.4, p.rad * 0.85, pal.hl, pal.hl0));
    c.fillStyle = linear(c, size * 1.0, size * 1.45, ['rgba(0, 0, 0, 0)', pal.core]);
    c.fillRect(0, size, cw, size * 0.5);
    c.restore();
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = linear(c, size * 1.36, size * 1.44, ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 1)']);
    c.fillRect(0, size * 1.36, cw, ch);
  });
  return { img, cw, ch };
};

const makeClouds = (dpr, w, h, pal, count, [y0, y1], [s0, s1], seed, depth = 0.2) => {
  const r = seeded(seed);
  const base = Math.min(w, h);
  return Array.from({ length: count }, (_, i) => {
    const sprite = cloudSprite(dpr, base * (s0 + r() * (s1 - s0)), pal, seed + i * 17);
    return { ...sprite, x: r() * (w + sprite.cw) - sprite.cw, y: h * (y0 + r() * (y1 - y0)), speed: 0.05 + r() * 0.15, depth };
  });
};

const drawClouds = (ctx, clouds, w, k, px, boost = 1) => {
  clouds.forEach((c) => {
    c.x += c.speed * k * boost;
    if (c.x > w + M) c.x = -c.cw - M;
    ctx.drawImage(c.img, c.x + px * c.depth * M, c.y, c.cw, c.ch);
  });
};

// Fan of light shafts from a sun or moon
const rays = (ctx, x, y, len, count, color, rot) => {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(x, y);
  ctx.rotate(rot);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, len);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + Math.sin(i * 7.3) * 0.2;
    const wd = 0.03 + (Math.sin(i * 3.1) + 1) * 0.025;
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a - wd) * len, Math.sin(a - wd) * len);
    ctx.lineTo(Math.cos(a + wd) * len, Math.sin(a + wd) * len);
    ctx.closePath();
  }
  ctx.fill();
  ctx.restore();
};

const sun = (ctx, x, y, r, level, [inner, outer], core = '#fffef4') => {
  glow(ctx, x, y, r * 14 * (1 + level * 0.3), outer);
  glow(ctx, x, y, r * 5 * (1 + level * 0.4), inner);
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
};

const flare = (ctx, sx, sy, w, h, level, rgb) => {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  [[0.35, 0.03], [0.55, 0.015], [0.8, 0.05], [1.1, 0.02]].forEach(([p, size]) => {
    const x = sx + (w / 2 - sx) * p * 2;
    const y = sy + (h / 2 - sy) * p * 2;
    glow(ctx, x, y, Math.min(w, h) * size * (1 + level), `rgba(${rgb}, ${0.18 + level * 0.15})`, `rgba(${rgb}, 0)`);
  });
  ctx.restore();
};

const makeStars = (w, h, count, maxY) =>
  Array.from({ length: count }, () => ({ x: rand(0, w), y: rand(0, h * maxY), r: rand(0.4, 1.7), tw: rand(0, TAU) }));

const drawStars = (ctx, stars, t, level) => {
  stars.forEach((st) => {
    const a = 0.45 + Math.sin(t * 2 + st.tw) * 0.4;
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(a, 0.05)})`;
    ctx.beginPath();
    ctx.arc(st.x, st.y, st.r * (1 + level * 0.8), 0, TAU);
    ctx.fill();
  });
};

/* ---------- Effects ---------- */

const spiral = (ctx, x, y, r) => {
  const turns = TAU * 1.75;
  ctx.beginPath();
  for (let a = 0; a <= turns; a += 0.15) {
    const rr = r * (1 - a / turns);
    const px = x + Math.cos(a + Math.PI) * rr;
    const py = y + Math.sin(a + Math.PI) * rr;
    if (a === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
};

// Ukiyo-e style flowing ribbon (water or flame) with curling crests
const ribbon = (ctx, w, t, { y, amp, thick, colors, edge, alpha, speed, phase = 0 }) => {
  if (alpha < 0.02) return;
  const yAt = (x) => y + Math.sin(x * 0.005 + t * speed + phase) * amp + Math.sin(x * 0.012 - t * speed * 1.4 + phase) * amp * 0.35;
  const th = (x) => thick * (0.55 + 0.45 * Math.sin(x * 0.008 + t * speed * 0.8 + phase));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  for (let x = -60; x <= w + 60; x += 10) (x === -60 ? ctx.moveTo(x, yAt(x)) : ctx.lineTo(x, yAt(x)));
  for (let x = w + 60; x >= -60; x -= 10) ctx.lineTo(x, yAt(x) + th(x));
  ctx.closePath();
  ctx.fillStyle = linear(ctx, y - amp, y + amp + thick, colors);
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = alpha * 0.7;
  for (let j = 1; j <= 2; j++) {
    ctx.beginPath();
    for (let x = -60; x <= w + 60; x += 12) {
      const yy = yAt(x) + th(x) * (j / 3);
      if (x === -60) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 2.5;
  const gap = 260;
  const off = (((t * speed * 90) % gap) + gap) % gap;
  for (let x = -gap + off; x < w + gap; x += gap) spiral(ctx, x, yAt(x) - thick * 0.05, thick * 0.55);
  ctx.restore();
};

const star4 = (ctx, x, y, r) => {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
};

const makeSparkles = (w, h, count, [y0, y1] = [0.2, 1]) =>
  Array.from({ length: count }, () => ({ x: rand(0, w), y: rand(h * y0, h * y1), r: rand(1, 3), ph: rand(0, TAU), vy: rand(0.1, 0.4) }));

const drawSparkles = (ctx, list, w, h, t, k, level, rgb, rise = 1) => {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  list.forEach((p) => {
    p.y -= p.vy * k * rise * (1 + level * 2);
    p.x += Math.sin(t + p.ph) * 0.2 * k;
    if (p.y < -10) { p.y = h + 10; p.x = rand(0, w); }
    if (p.y > h + 10) { p.y = -10; p.x = rand(0, w); }
    const a = 0.35 + Math.sin(t * 3 + p.ph) * 0.3;
    ctx.fillStyle = `rgba(${rgb}, ${a})`;
    if (p.r > 2.4) star4(ctx, p.x, p.y, p.r * 2.2 * (1 + level));
    else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (1 + level), 0, TAU);
      ctx.fill();
    }
  });
  ctx.restore();
};

const makeBlades = (w, count, [l0, l1], shades) =>
  Array.from({ length: count }, () => ({ x: rand(-M, w + M), len: rand(l0, l1), wd: rand(1.5, 3.5), shade: Math.floor(rand(0, shades)) }));

const drawBlades = (ctx, blades, h, t, level, colors, dx) => {
  blades.forEach((b) => {
    const x = b.x + dx;
    const sway = Math.sin(t * 1.6 + b.x * 0.015) * (b.len * 0.12 + level * b.len * 0.35);
    ctx.fillStyle = colors[b.shade];
    ctx.beginPath();
    ctx.moveTo(x - b.wd, h);
    ctx.quadraticCurveTo(x + sway * 0.4, h - b.len * 0.5, x + sway, h - b.len);
    ctx.quadraticCurveTo(x + sway * 0.4 + b.wd * 0.3, h - b.len * 0.5, x + b.wd, h);
    ctx.fill();
  });
};

const makeDrops = (w, h, count) =>
  Array.from({ length: count }, () => ({ x: rand(0, w), y: rand(0, h), len: rand(10, 24), speed: rand(9, 15) }));

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

// Flickering strokes on water, brightest in a column under the light
const drawShimmer = (ctx, w, y0, y1, t, cx, color, level) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (let i = 0; i < 44; i++) {
    const p = i / 44;
    const y = y0 + (y1 - y0) * p * p + 4;
    const spread = 30 + p * w * 0.22;
    const x = cx + Math.sin(i * 12.9898 + Math.floor(t * 3 + i) * 0.7) * spread;
    const len = 10 + p * 46;
    ctx.globalAlpha = (0.25 + 0.35 * Math.abs(Math.sin(t * 2 + i))) * (0.7 + level * 0.6);
    ctx.beginPath();
    ctx.moveTo(x - len / 2, y);
    ctx.lineTo(x + len / 2, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
};

const drawMist = (ctx, bands, w, k, rgb) => {
  bands.forEach((f) => {
    f.x += f.sp * k;
    if (f.x - f.rw > w) f.x = -f.rw;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.scale(1, 0.16);
    glow(ctx, 0, 0, f.rw, `rgba(${rgb}, ${f.a})`, `rgba(${rgb}, 0)`);
    ctx.restore();
  });
};

const makeMist = (w, h, count, [y0, y1], a = 0.35) =>
  Array.from({ length: count }, () => ({ x: rand(0, w), y: rand(h * y0, h * y1), rw: rand(w * 0.25, w * 0.55), sp: rand(0.1, 0.3), a }));

const updateBirds = (ctx, s, w, h, t, k, color, chance = 0.003) => {
  if (Math.random() < chance * k && s.birds.length < 6) {
    const n = Math.floor(rand(1, 4));
    const y = rand(h * 0.1, h * 0.38);
    for (let i = 0; i < n; i++) s.birds.push({ x: -20 - i * 25, y: y + i * 12, size: rand(5, 9), phase: rand(0, TAU), speed: rand(1, 1.6) });
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  s.birds = s.birds.filter((b) => b.x < w + 40);
  s.birds.forEach((b) => {
    b.x += b.speed * k;
    b.y += Math.sin(t + b.phase) * 0.2 * k;
    const flap = Math.sin(t * 8 + b.phase) * b.size * 0.5;
    ctx.beginPath();
    ctx.moveTo(b.x - b.size, b.y - flap);
    ctx.quadraticCurveTo(b.x - b.size * 0.4, b.y - b.size * 0.2, b.x, b.y);
    ctx.quadraticCurveTo(b.x + b.size * 0.4, b.y - b.size * 0.2, b.x + b.size, b.y - flap);
    ctx.stroke();
  });
};

// Falling petals / leaves; `gust` pushes them sideways on beats
const makeFall = (w, h, count, colors, size) =>
  Array.from({ length: count }, () => ({
    x: rand(0, w), y: rand(-h, h), vx: rand(0.3, 1), vy: rand(0.5, 1.3), rot: rand(0, TAU), vr: rand(-0.05, 0.05),
    size: rand(size[0], size[1]), color: colors[Math.floor(rand(0, colors.length))], flip: rand(0, TAU),
  }));

const drawFall = (ctx, list, w, h, t, k, level, beat, shape, dir = -1) => {
  list.forEach((p) => {
    p.x += dir * p.vx * k * (1 + level * 1.5 + beat * 4);
    p.y += p.vy * k * (1 + level);
    p.rot += p.vr * k * (1 + beat * 3);
    if (p.y > h + 20 || p.x < -30 || p.x > w + 30) {
      p.y = rand(-60, h * 0.4);
      p.x = dir < 0 ? rand(w * 0.3, w + 40) : rand(-40, w * 0.7);
    }
    ctx.save();
    ctx.translate(p.x + Math.sin(t + p.rot) * 8, p.y);
    ctx.rotate(p.rot);
    ctx.scale(1, Math.abs(Math.cos(t * 2 + p.flip)) * 0.7 + 0.3);
    ctx.fillStyle = p.color;
    shape(ctx, p.size);
    ctx.restore();
  });
};

const petalShape = (ctx, s) => {
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.quadraticCurveTo(s * 0.9, -s * 0.2, 0, s);
  ctx.quadraticCurveTo(-s * 0.9, -s * 0.2, 0, -s);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.beginPath();
  ctx.ellipse(-s * 0.15, -s * 0.2, s * 0.22, s * 0.45, 0, 0, TAU);
  ctx.fill();
};

const mapleShape = (ctx, s) => {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * TAU;
    const rr = i % 2 === 0 ? s : s * 0.45;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(90, 20, 10, 0.5)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
};

const lantern = (ctx, x, y, r, color, level) => {
  glow(ctx, x, y, r * 4.5 * (1 + level * 0.6), 'rgba(255, 170, 90, 0.45)', 'rgba(255, 120, 40, 0)');
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.85, r, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(70, 10, 10, 0.5)';
  ctx.lineWidth = 1;
  [-0.45, 0, 0.45].forEach((f) => {
    ctx.beginPath();
    ctx.ellipse(x, y + f * r, r * 0.85 * Math.sqrt(1 - f * f), r * 0.12, 0, 0, Math.PI);
    ctx.stroke();
  });
  ctx.fillStyle = '#2a1a12';
  ctx.fillRect(x - r * 0.45, y - r - 3, r * 0.9, 4);
  ctx.fillRect(x - r * 0.45, y + r - 1, r * 0.9, 4);
  glow(ctx, x - r * 0.25, y - r * 0.35, r * 0.6, 'rgba(255, 245, 220, 0.6)', 'rgba(255, 245, 220, 0)');
};

const lanternString = (ctx, [x0, y0], [x1, y1], sag, n, t, level, colors) => {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2 + sag * 2;
  ctx.strokeStyle = 'rgba(20, 10, 10, 0.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(cx, cy, x1, y1);
  ctx.stroke();
  for (let i = 1; i <= n; i++) {
    const u = i / (n + 1);
    const x = (1 - u) ** 2 * x0 + 2 * (1 - u) * u * cx + u ** 2 * x1;
    const y = (1 - u) ** 2 * y0 + 2 * (1 - u) * u * cy + u ** 2 * y1;
    const sway = Math.sin(t * 2 + i) * 3;
    ctx.strokeStyle = 'rgba(20, 10, 10, 0.8)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + sway, y + 8);
    ctx.stroke();
    lantern(ctx, x + sway, y + 20, 11, colors[i % colors.length], level);
  }
};

// Radial anime speed lines for big hits
const speedLines = (ctx, w, h, a) => {
  if (a < 0.05) return;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.strokeStyle = `rgba(255, 255, 255, ${a * 0.3})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 70; i++) {
    const ang = (i / 70) * TAU + rand(-0.03, 0.03);
    const r0 = Math.min(w, h) * rand(0.38, 0.6);
    const r1 = Math.max(w, h);
    ctx.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0);
    ctx.lineTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
  }
  ctx.stroke();
  ctx.restore();
};

/* ---------- Scenes ---------- */

const SCENES = {
  // Summer countryside: towering clouds, snow-capped peak, torii on a green hill, rice paddies
  dreamy: {
    init: (w, h, dpr) => ({
      sky: makeLayer(w, h, dpr, (c) => {
        c.fillStyle = linear(c, 0, h * 0.72, ['#0862b6', '#1592dc', '#4cc0ee', '#a8e8f6', '#e6fbfd']);
        c.fillRect(0, 0, w, h);
      }),
      far: wideLayer(w, h, dpr, (c) => {
        const px = w * 0.24;
        const py = h * 0.3;
        const base = h * 0.66;
        c.fillStyle = linear(c, py, base, ['#a9cfe6', '#7fb2d4']);
        c.beginPath();
        c.moveTo(px - h * 0.55, base);
        c.quadraticCurveTo(px - h * 0.12, py + h * 0.05, px - h * 0.04, py);
        c.lineTo(px + h * 0.04, py);
        c.quadraticCurveTo(px + h * 0.12, py + h * 0.05, px + h * 0.55, base);
        c.closePath();
        c.fill();
        c.fillStyle = '#f4fbff';
        c.beginPath();
        c.moveTo(px - h * 0.04, py);
        c.lineTo(px + h * 0.04, py);
        c.lineTo(px + h * 0.1, py + h * 0.07);
        c.lineTo(px + h * 0.05, py + h * 0.06);
        c.lineTo(px + h * 0.02, py + h * 0.09);
        c.lineTo(px - h * 0.02, py + h * 0.06);
        c.lineTo(px - h * 0.06, py + h * 0.08);
        c.lineTo(px - h * 0.1, py + h * 0.07);
        c.closePath();
        c.fill();
        ridge(c, w, h, { y: h * 0.645, amp: h * 0.05, colors: ['#93c6df', '#77aecd'], seed: 3 });
      }),
      mid: wideLayer(w, h, dpr, (c) => {
        const at = ridge(c, w, h, { y: h * 0.71, amp: h * 0.045, colors: ['#5cc49a', '#2f8f68'], seed: 7, ink: 'rgba(10, 60, 50, 0.55)', rim: 'rgba(200, 255, 225, 0.75)' });
        const r = seeded(5);
        for (let x = -M; x < w + M; x += 50 + r() * 90) {
          if (Math.abs(x - w * 0.72) > 70) bush(c, x, at(x) + 6, h * (0.05 + r() * 0.04), ['#6fd08a', '#22704a', '#3a2a1a'], r);
        }
        torii(c, w * 0.72, at(w * 0.72) + 4, h * 0.11);
        const top = h * 0.79;
        c.fillStyle = linear(c, top, h, ['#c4f0f8', '#6cc6dc', '#3e9fbb']);
        c.fillRect(-M, top, w + 2 * M, h - top);
        c.strokeStyle = 'rgba(70, 150, 90, 0.45)';
        c.lineWidth = 1;
        for (let x = -M; x < w + M; x += 16) {
          c.beginPath();
          c.moveTo(x, top + 4);
          c.lineTo(w / 2 + (x - w / 2) * 1.8, h);
          c.stroke();
        }
        c.strokeStyle = 'rgba(40, 110, 70, 0.85)';
        for (let i = 0; i < 6; i++) {
          const y = top + (h - top) * ((i + 0.3) / 6) ** 1.6;
          c.lineWidth = 1.5 + i * 0.7;
          c.beginPath();
          c.moveTo(-M, y);
          c.lineTo(w + M, y + (r() - 0.5) * 8);
          c.stroke();
        }
      }),
      clouds: [
        ...makeClouds(dpr, w, h, PAL.day, 1, [0.0, 0.04], [0.42, 0.5], 91, 0.08),
        ...makeClouds(dpr, w, h, PAL.day, 5, [0.06, 0.4], [0.1, 0.22], 21, 0.25),
      ],
      blades: makeBlades(w, Math.round(w / 5), [h * 0.05, h * 0.13], 3),
      sparkles: makeSparkles(w, h, 50, [0.4, 1]),
      birds: [],
    }),
    draw: (ctx, w, h, s, t, level, k, beat, px) => {
      ctx.drawImage(s.sky, 0, 0, w, h);
      const sx = w * 0.8;
      const sy = h * 0.14;
      const b = Math.min(w, h);
      rays(ctx, sx, sy, Math.max(w, h) * 1.1, 16, `rgba(255, 255, 230, ${0.12 + level * 0.15})`, t * 0.02);
      sun(ctx, sx, sy, b * 0.045, level, ['rgba(255, 255, 240, 0.9)', 'rgba(160, 240, 255, 0.35)']);
      drawClouds(ctx, s.clouds, w, k, px);
      updateBirds(ctx, s, w, h, t, k, 'rgba(20, 60, 80, 0.7)');
      drawWide(ctx, s.far, w, h, px, 0.25);
      drawWide(ctx, s.mid, w, h, px, 0.6);
      drawShimmer(ctx, w, h * 0.79, h, t, sx + px * 0.6 * M, 'rgba(255, 255, 255, 1)', level);
      drawBlades(ctx, s.blades, h, t, level, ['#2f8a48', '#3fa257', '#59c06a'], px * M);
      drawSparkles(ctx, s.sparkles, w, h, t, k, level, '255, 255, 220');
      flare(ctx, sx, sy, w, h, level + beat * 0.5, '170, 255, 250');
    },
  },

  // Cherry blossom tree and pagoda at sunset
  romance: {
    init: (w, h, dpr) => ({
      sky: makeLayer(w, h, dpr, (c) => {
        c.fillStyle = linear(c, 0, h * 0.75, ['#24235e', '#6a4597', '#c873a8', '#ff9fb0', '#ffd2ae']);
        c.fillRect(0, 0, w, h);
      }),
      far: wideLayer(w, h, dpr, (c) => {
        const at = ridge(c, w, h, { y: h * 0.67, amp: h * 0.05, colors: ['#a06ca2', '#7c5088'], seed: 5 });
        pagoda(c, w * 0.28, at(w * 0.28) + 6, h * 0.24, '#4a2a5a');
      }),
      mid: wideLayer(w, h, dpr, (c) => {
        ridge(c, w, h, { y: h * 0.8, amp: h * 0.045, colors: ['#5a2f62', '#36193d'], seed: 9, ink: 'rgba(20, 5, 25, 0.7)', rim: 'rgba(255, 190, 210, 0.8)' });
      }),
      tree: wideLayer(w, h, dpr, (c) => {
        const scale = Math.min(w, h) / 800;
        blossomTree(c, w * 0.08, h + 5, h * 0.24, -Math.PI / 2 + 0.38, scale, seeded(42), {
          bark: '#2e1622',
          petals: ['#fff0f5', '#ffb3c9', '#e9779c'],
        });
      }),
      clouds: makeClouds(dpr, w, h, PAL.dusk, 4, [0.06, 0.38], [0.09, 0.2], 31),
      petals: makeFall(w, h, 90, ['#ffc4d6', '#ffadc6', '#ffe0ea', '#ff9cba'], [3, 6]),
      sparkles: makeSparkles(w, h, 30),
      birds: [],
    }),
    draw: (ctx, w, h, s, t, level, k, beat, px) => {
      ctx.drawImage(s.sky, 0, 0, w, h);
      const b = Math.min(w, h);
      rays(ctx, w * 0.62, h * 0.66, Math.max(w, h), 14, `rgba(255, 210, 190, ${0.08 + level * 0.12})`, t * 0.015);
      sun(ctx, w * 0.62, h * 0.66, b * 0.075, level, ['rgba(255, 225, 200, 0.85)', 'rgba(255, 150, 180, 0.35)'], '#fff0dc');
      drawClouds(ctx, s.clouds, w, k, px);
      updateBirds(ctx, s, w, h, t, k, 'rgba(70, 30, 60, 0.6)', 0.002);
      drawWide(ctx, s.far, w, h, px, 0.25);
      drawWide(ctx, s.mid, w, h, px, 0.5);
      ctx.save();
      ctx.translate(0, h);
      ctx.transform(1, 0, Math.sin(t * 0.8) * 0.006 * (1 + level * 2), 1, 0, 0);
      ctx.translate(0, -h);
      drawWide(ctx, s.tree, w, h, px, 0.9);
      ctx.restore();
      drawFall(ctx, s.petals, w, h, t, k, level, beat, petalShape, 1);
      drawSparkles(ctx, s.sparkles, w, h, t, k, level, '255, 200, 225');
    },
  },

  // Dawn over a lake with a torii standing in the water and floating lanterns
  devotional: {
    init: (w, h, dpr) => {
      const horizon = h * 0.64;
      return {
        horizon,
        sky: makeLayer(w, h, dpr, (c) => {
          c.fillStyle = linear(c, 0, horizon, ['#1f3570', '#6f5d9e', '#e3907f', '#ffc98a', '#fff0c6']);
          c.fillRect(0, 0, w, h);
        }),
        far: wideLayer(w, h, dpr, (c) => {
          ridge(c, w, h, { y: horizon - h * 0.07, amp: h * 0.05, colors: ['#a596c2', '#8f80b0'], seed: 13 });
          ridge(c, w, h, { y: horizon - h * 0.02, amp: h * 0.035, colors: ['#7d6d9a', '#685a88'], seed: 19, ink: 'rgba(40, 25, 60, 0.4)' });
        }),
        water: wideLayer(w, h, dpr, (c) => {
          c.fillStyle = linear(c, horizon, h, ['#ffe6b0', '#f0a888', '#7a6fa8', '#2b2f66']);
          c.fillRect(-M, horizon, w + 2 * M, h - horizon);
          const tx = w * 0.68;
          const base = horizon + h * 0.13;
          const size = h * 0.26;
          c.save();
          c.translate(0, base * 2);
          c.scale(1, -1);
          c.globalAlpha = 0.3;
          torii(c, tx, base, size);
          c.restore();
          c.strokeStyle = 'rgba(255, 230, 200, 0.35)';
          c.lineWidth = 2;
          for (let y = base + 6; y < base + size; y += 9) {
            c.beginPath();
            c.moveTo(tx - size * 0.6, y);
            c.lineTo(tx + size * 0.6, y);
            c.stroke();
          }
          torii(c, tx, base, size);
        }),
        bank: wideLayer(w, h, dpr, (c) => {
          ridge(c, w, h, { y: h * 0.97, amp: h * 0.02, colors: ['#2f5a3a', '#1a3322'], seed: 17, ink: 'rgba(5, 20, 10, 0.8)' });
          const r = seeded(3);
          c.strokeStyle = '#1f3d27';
          c.lineWidth = 2;
          for (let x = -M; x < w + M; x += 8 + r() * 14) {
            c.beginPath();
            c.moveTo(x, h);
            c.quadraticCurveTo(x + 3, h - h * 0.04, x + (r() - 0.5) * 12, h - h * (0.05 + r() * 0.05));
            c.stroke();
          }
        }),
        clouds: makeClouds(dpr, w, h, PAL.dawn, 4, [0.05, 0.3], [0.08, 0.18], 41),
        mist: makeMist(w, h, 5, [0.58, 0.72], 0.3),
        lanterns: Array.from({ length: 10 }, () => ({ x: rand(0, w), p: rand(0.12, 0.95), ph: rand(0, TAU) })),
        embers: makeSparkles(w, h, 35),
      };
    },
    draw: (ctx, w, h, s, t, level, k, beat, px) => {
      ctx.drawImage(s.sky, 0, 0, w, h);
      const sx = w * 0.36;
      const sy = s.horizon - h * 0.03;
      const b = Math.min(w, h);
      rays(ctx, sx, sy, Math.max(w, h) * 1.2, 18, `rgba(255, 235, 190, ${0.14 + level * 0.18})`, t * 0.02);
      sun(ctx, sx, sy, b * 0.07, level, ['rgba(255, 230, 160, 0.95)', 'rgba(255, 170, 120, 0.4)'], '#fff4d2');
      drawClouds(ctx, s.clouds, w, k, px);
      drawWide(ctx, s.far, w, h, px, 0.2);
      drawWide(ctx, s.water, w, h, px, 0.4);
      drawShimmer(ctx, w, s.horizon, h, t, sx + px * 0.4 * M, 'rgba(255, 245, 210, 1)', level);
      drawMist(ctx, s.mist, w, k, '255, 235, 220');
      s.lanterns.forEach((d) => {
        const y = s.horizon + (h - s.horizon) * d.p;
        const sc = 0.4 + d.p * 1.3;
        d.x += 0.22 * sc * k;
        if (d.x > w + 40) d.x = -40;
        const bob = Math.sin(t * 1.5 + d.ph) * 1.5 * sc;
        glow(ctx, d.x, y + 10 * sc, 22 * sc, 'rgba(255, 190, 90, 0.35)', 'rgba(255, 140, 40, 0)');
        glow(ctx, d.x, y - 6 * sc + bob, 30 * sc * (1 + level), 'rgba(255, 200, 100, 0.55)', 'rgba(255, 130, 30, 0)');
        ctx.fillStyle = '#ffe1a0';
        ctx.fillRect(d.x - 6 * sc, y - 14 * sc + bob, 12 * sc, 12 * sc);
        ctx.strokeStyle = '#4a2a14';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(d.x - 6 * sc, y - 14 * sc + bob, 12 * sc, 12 * sc);
        ctx.fillStyle = '#4a2a14';
        ctx.fillRect(d.x - 8 * sc, y - 2 * sc + bob, 16 * sc, 3 * sc);
      });
      ribbon(ctx, w, t, {
        y: h * 0.86, amp: h * 0.025, thick: h * 0.035, alpha: 0.12 + beat * 0.6, speed: 0.8,
        colors: ['rgba(220, 245, 255, 0.95)', 'rgba(90, 160, 220, 0.9)'], edge: '#ffffff',
      });
      drawWide(ctx, s.bank, w, h, px, 0.8);
      drawSparkles(ctx, s.embers, w, h, t, k, level, '255, 215, 140');
    },
  },

  // Full moon over a wisteria-framed night
  sufi: {
    init: (w, h, dpr) => {
      const r = seeded(77);
      const clusterSprite = (len, seed) => {
        const rr = seeded(seed);
        const sw = 46;
        return {
          img: makeLayer(sw, len, dpr, (c) => {
            c.shadowColor = 'rgba(190, 150, 255, 0.8)';
            c.shadowBlur = 10;
            const n = Math.round(len / 6);
            for (let i = 0; i < n; i++) {
              const p = i / n;
              const y = 6 + p * (len - 12);
              const rad = 7 * (1 - p * 0.75);
              const x = sw / 2 + (rr() - 0.5) * 14 * (1 - p * 0.6);
              const g = c.createRadialGradient(x - rad * 0.3, y - rad * 0.3, 0, x, y, rad);
              g.addColorStop(0, p < 0.4 ? '#f3e8ff' : '#d8b4fe');
              g.addColorStop(1, p < 0.5 ? '#a78bfa' : '#7c3aed');
              c.fillStyle = g;
              c.beginPath();
              c.arc(x, y, rad, 0, TAU);
              c.fill();
            }
          }),
          sw,
          len,
        };
      };
      const sprites = Array.from({ length: 5 }, (_, i) => clusterSprite(h * (0.14 + i * 0.03), 100 + i));
      return {
        sky: makeLayer(w, h, dpr, (c) => {
          c.fillStyle = linear(c, 0, h * 0.85, ['#040820', '#0e1645', '#24296a', '#4b3884']);
          c.fillRect(0, 0, w, h);
        }),
        far: wideLayer(w, h, dpr, (c) => {
          const at = ridge(c, w, h, { y: h * 0.8, amp: h * 0.04, colors: ['#1d1f50', '#111232'], seed: 23, ink: 'rgba(0, 0, 10, 0.8)', rim: 'rgba(170, 160, 255, 0.5)' });
          torii(c, w * 0.3, at(w * 0.3) + 4, h * 0.09, '#140f2e', 'rgba(0, 0, 0, 0.9)');
          const rr = seeded(2);
          for (let x = -M; x < w + M; x += 26 + rr() * 30) if (Math.abs(x - w * 0.3) > 50) pine(c, x, at(x) + h * 0.03, h * (0.04 + rr() * 0.04), '#0b0b22');
        }),
        branches: wideLayer(w, h, dpr, (c) => {
          c.strokeStyle = '#140c1e';
          c.lineCap = 'round';
          for (let i = 0; i < 4; i++) {
            c.lineWidth = 10 - i * 2;
            c.beginPath();
            c.moveTo(-M, h * (0.02 + i * 0.02));
            for (let x = -M; x <= w + M; x += 60) c.lineTo(x, h * (0.03 + i * 0.02) + Math.sin(x * 0.01 + i) * h * 0.02);
            c.stroke();
          }
          c.fillStyle = '#1c2a1e';
          for (let i = 0; i < 160; i++) {
            c.beginPath();
            c.ellipse(-M + r() * (w + 2 * M), r() * h * 0.09, 14, 5, r() * TAU, 0, TAU);
            c.fill();
          }
        }),
        clusters: Array.from({ length: Math.round(w / 55) }, (_, i) => ({
          x: (i + 0.5) * 55 + (r() - 0.5) * 20, y: h * (0.03 + r() * 0.05), sprite: sprites[Math.floor(r() * sprites.length)], ph: r() * TAU,
        })),
        stars: makeStars(w, h, 220, 0.75),
        clouds: makeClouds(dpr, w, h, PAL.night, 3, [0.2, 0.45], [0.1, 0.16], 61, 0.15),
        petals: makeFall(w, h, 60, ['#d8b4fe', '#c4b5fd', '#f0abfc', '#e9d5ff'], [2.5, 5]),
        flies: makeSparkles(w, h, 30, [0.55, 1]),
      };
    },
    draw: (ctx, w, h, s, t, level, k, beat, px) => {
      ctx.drawImage(s.sky, 0, 0, w, h);
      drawStars(ctx, s.stars, t, level);
      const mx = w * 0.55;
      const my = h * 0.4;
      const b = Math.min(w, h);
      rays(ctx, mx, my, Math.max(w, h) * 0.9, 20, `rgba(200, 190, 255, ${0.06 + level * 0.1})`, -t * 0.01);
      sun(ctx, mx, my, b * 0.13, level, ['rgba(255, 246, 220, 0.5)', 'rgba(150, 140, 255, 0.3)'], '#fff7e2');
      ctx.fillStyle = 'rgba(215, 200, 170, 0.35)';
      [[-0.35, -0.2, 0.2], [0.3, 0.15, 0.14], [-0.05, 0.4, 0.11], [0.15, -0.4, 0.08]].forEach(([dx, dy, rr]) => {
        ctx.beginPath();
        ctx.arc(mx + dx * b * 0.13, my + dy * b * 0.13, rr * b * 0.13, 0, TAU);
        ctx.fill();
      });
      drawClouds(ctx, s.clouds, w, k, px);
      drawWide(ctx, s.far, w, h, px, 0.3);
      s.clusters.forEach((c) => {
        ctx.save();
        ctx.translate(c.x + px * 0.9 * M, c.y);
        ctx.rotate(Math.sin(t * 1.2 + c.ph) * 0.05 * (1 + level * 2 + beat * 2));
        ctx.drawImage(c.sprite.img, -c.sprite.sw / 2, 0, c.sprite.sw, c.sprite.len);
        ctx.restore();
      });
      drawWide(ctx, s.branches, w, h, px, 0.9);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      drawFall(ctx, s.petals, w, h, t, k, level, beat, petalShape, -1);
      ctx.restore();
      drawSparkles(ctx, s.flies, w, h, t, k, level, '255, 225, 140', -0.3);
    },
  },

  // Storm over jagged mountains with flame ribbons that surge on the beat
  rock: {
    init: (w, h, dpr) => ({
      sky: makeLayer(w, h, dpr, (c) => {
        c.fillStyle = linear(c, 0, h * 0.75, ['#07080f', '#151829', '#2a1f3a', '#5a1f2a']);
        c.fillRect(0, 0, w, h);
      }),
      far: wideLayer(w, h, dpr, (c) => {
        ridge(c, w, h, { y: h * 0.56, amp: h * 0.17, colors: ['#4a4566', '#2e2b45'], seed: 37, sharp: true, ink: 'rgba(5, 5, 12, 0.7)', rim: 'rgba(255, 130, 100, 0.55)' });
      }),
      near: wideLayer(w, h, dpr, (c) => {
        const at = ridge(c, w, h, { y: h * 0.75, amp: h * 0.1, colors: ['#1f1b2c', '#120f1c'], seed: 43, sharp: true, ink: 'rgba(0, 0, 0, 0.9)', rim: 'rgba(255, 90, 60, 0.5)' });
        const r = seeded(4);
        for (let x = -M; x < w + M; x += 18 + r() * 26) pine(c, x, Math.max(at(x) + h * 0.12, h * 0.9), h * (0.08 + r() * 0.08), '#08070d');
        c.fillStyle = '#08070d';
        c.fillRect(-M, h * 0.95, w + 2 * M, h * 0.05);
      }),
      clouds: makeClouds(dpr, w, h, PAL.storm, 6, [-0.05, 0.28], [0.14, 0.26], 51, 0.15),
      drops: makeDrops(w, h, 240),
      embers: makeSparkles(w, h, 70),
      flash: 0,
      bolt: null,
      boltLife: 0,
    }),
    draw: (ctx, w, h, s, t, level, k, beat, px) => {
      ctx.drawImage(s.sky, 0, 0, w, h);
      if (k > 0.5 && ((beat > 0.7 && !s.bolt) || Math.random() < 0.003 * k)) {
        const make = (x, y, len) => {
          const pts = [[x, y]];
          for (let yy = y; yy < y + len; yy += rand(18, 40)) {
            x += rand(-35, 35);
            pts.push([x, yy]);
          }
          return pts;
        };
        const main = make(rand(w * 0.1, w * 0.9), h * 0.08, h * 0.55);
        const forks = [1, 2].map(() => {
          const [fx, fy] = main[Math.floor(rand(2, main.length - 2))] || main[0];
          return make(fx, fy, h * rand(0.1, 0.2));
        });
        s.bolt = [main, ...forks];
        s.boltLife = 1;
        s.flash = 0.4;
      }
      if (s.bolt && s.boltLife > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowColor = '#8fe9ff';
        ctx.shadowBlur = 30;
        s.bolt.forEach((pts, i) => {
          ctx.strokeStyle = `rgba(225, 245, 255, ${s.boltLife})`;
          ctx.lineWidth = i ? 1.5 : 3.5;
          ctx.beginPath();
          pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.stroke();
        });
        ctx.restore();
        s.boltLife -= 0.05 * k;
        if (s.boltLife <= 0) s.bolt = null;
      }
      drawClouds(ctx, s.clouds, w, k, px, 3);
      drawWide(ctx, s.far, w, h, px, 0.2);
      const flameColors = ['#fff4b0', '#ffb02e', '#ff5a1f', '#b3121f'];
      ribbon(ctx, w, t, { y: h * 0.48, amp: h * 0.08, thick: h * 0.07, colors: flameColors, edge: '#fff6d0', alpha: 0.18 + beat * 0.8, speed: 1.2 });
      drawWide(ctx, s.near, w, h, px, 0.6);
      ribbon(ctx, w, t, { y: h * 0.7, amp: h * 0.06, thick: h * 0.06, colors: flameColors, edge: '#fff6d0', alpha: 0.12 + beat * 0.85, speed: -0.9, phase: 2 });
      drawSparkles(ctx, s.embers, w, h, t, k, level + beat, '255, 150, 60', 2);
      drawRain(ctx, s.drops, w, h, k, level, 'rgba(170, 190, 230, 0.4)', 3);
      if (s.flash > 0) {
        ctx.fillStyle = `rgba(220, 240, 255, ${s.flash})`;
        ctx.fillRect(0, 0, w, h);
        s.flash *= 0.85 ** k;
      }
      speedLines(ctx, w, h, beat > 0.55 ? beat : 0);
    },
  },

  // Summer festival: lantern strings and fireworks over a river
  party: {
    init: (w, h, dpr) => ({
      sky: makeLayer(w, h, dpr, (c) => {
        c.fillStyle = linear(c, 0, h * 0.74, ['#04071f', '#0f1650', '#2c1f66', '#8a3a86', '#e0607e']);
        c.fillRect(0, 0, w, h);
      }),
      land: wideLayer(w, h, dpr, (c) => {
        const at = ridge(c, w, h, { y: h * 0.71, amp: h * 0.04, colors: ['#1d1648', '#120d30'], seed: 53, ink: 'rgba(0, 0, 10, 0.8)' });
        pagoda(c, w * 0.78, at(w * 0.78) + 6, h * 0.16, '#0e0a26');
        c.fillStyle = linear(c, h * 0.74, h, ['#3a2a72', '#160f3a', '#08061c']);
        c.fillRect(-M, h * 0.74, w + 2 * M, h * 0.26);
        const r = seeded(9);
        for (let x = -M; x < w + M; x += 24 + r() * 30) if (Math.abs(x - w * 0.78) > 40) pine(c, x, h * 0.76, h * (0.05 + r() * 0.05), '#0c0824');
      }),
      stars: makeStars(w, h, 80, 0.5),
      rockets: [],
      bursts: [],
      flies: makeSparkles(w, h, 40, [0.76, 1]),
      lastHue: 190,
    }),
    draw: (ctx, w, h, s, t, level, k, beat, px) => {
      ctx.drawImage(s.sky, 0, 0, w, h);
      drawStars(ctx, s.stars, t, 0);
      if (k > 0.3 && ((beat > 0.6 && s.rockets.length < 3) || Math.random() < 0.02 * k)) {
        s.rockets.push({ x: rand(w * 0.1, w * 0.9), y: h * 0.74, vy: -rand(7, 10), target: rand(h * 0.1, h * 0.4), hue: Math.floor(rand(0, 360)) });
      }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      s.rockets = s.rockets.filter((rk) => {
        rk.y += rk.vy * k;
        rk.vy += 0.07 * k;
        glow(ctx, rk.x, rk.y, 8, `hsla(${rk.hue}, 100%, 85%, 0.9)`, `hsla(${rk.hue}, 100%, 70%, 0)`);
        if (rk.y > rk.target && rk.vy < -1) return true;
        s.lastHue = rk.hue;
        const n = 90;
        s.bursts.push({
          x: rk.x, y: rk.y, life: 1, hue: rk.hue,
          parts: Array.from({ length: n }, (_, i) => {
            const a = (i / n) * TAU + rand(-0.05, 0.05);
            const v = rand(2, 4.5) * (1 + level * 0.6);
            return { x: rk.x, y: rk.y, px: rk.x, py: rk.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v };
          }),
        });
        return false;
      });
      s.bursts = s.bursts.filter((bs) => bs.life > 0);
      s.bursts.forEach((bs) => {
        if (bs.life > 0.85) glow(ctx, bs.x, bs.y, 120, `hsla(${bs.hue}, 100%, 75%, 0.35)`, `hsla(${bs.hue}, 100%, 70%, 0)`);
        glow(ctx, bs.x, h * 0.74 + (h * 0.74 - bs.y) * 0.3, 60, `hsla(${bs.hue}, 100%, 70%, ${bs.life * 0.25})`, `hsla(${bs.hue}, 100%, 70%, 0)`);
        ctx.strokeStyle = `hsla(${bs.hue + (1 - bs.life) * 40}, 100%, 72%, ${bs.life})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        bs.parts.forEach((p) => {
          p.px = p.x;
          p.py = p.y;
          p.x += p.vx * k;
          p.y += p.vy * k;
          p.vx *= 0.982 ** k;
          p.vy = p.vy * 0.982 ** k + 0.035 * k;
          ctx.moveTo(p.px - p.vx * 2, p.py - p.vy * 2);
          ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
        if (bs.life < 0.4) {
          ctx.fillStyle = `rgba(255, 255, 255, ${bs.life})`;
          bs.parts.forEach((p) => { if (Math.random() < 0.3) ctx.fillRect(p.x, p.y, 2, 2); });
        }
        bs.life -= 0.011 * k;
      });
      ctx.restore();
      drawWide(ctx, s.land, w, h, px, 0.4);
      drawShimmer(ctx, w, h * 0.74, h, t, w / 2, `hsla(${s.lastHue}, 100%, 75%, 1)`, level);
      drawSparkles(ctx, s.flies, w, h, t, k, level, '210, 255, 140', 0.2);
      const colors = ['#e8392b', '#f0602d', '#ffd166', '#ff8fa3'];
      lanternString(ctx, [-20 + px * M, h * 0.05], [w + 20 + px * M, h * 0.09], h * 0.05, Math.max(5, Math.round(w / 110)), t, level + beat, colors);
      lanternString(ctx, [-20 + px * M * 1.2, h * 0.17], [w * 0.55 + px * M * 1.2, -10], h * 0.06, Math.max(3, Math.round(w / 220)), t + 1, level + beat, colors);
    },
  },

  // Autumn maples, a red arched bridge over a stream at golden hour
  retro: {
    init: (w, h, dpr) => ({
      sky: makeLayer(w, h, dpr, (c) => {
        c.fillStyle = linear(c, 0, h * 0.7, ['#d9744a', '#ee9d5c', '#f6c886', '#fde6bf']);
        c.fillRect(0, 0, w, h);
      }),
      far: wideLayer(w, h, dpr, (c) => {
        const at = ridge(c, w, h, { y: h * 0.6, amp: h * 0.06, colors: ['#c06a5a', '#9e5050'], seed: 61 });
        const r = seeded(8);
        for (let x = -M; x < w + M; x += 18 + r() * 24) bush(c, x, at(x) + h * 0.03, h * (0.03 + r() * 0.02), ['#ff8a4a', '#a8322a', '#5a2a1a'], r);
      }),
      mid: wideLayer(w, h, dpr, (c) => {
        ridge(c, w, h, { y: h * 0.74, amp: h * 0.035, colors: ['#c98b4a', '#8f5a2c'], seed: 67, ink: 'rgba(60, 25, 10, 0.6)', rim: 'rgba(255, 220, 150, 0.8)' });
        const top = h * 0.8;
        c.fillStyle = linear(c, top, h * 0.88, ['#ffd9a0', '#d9845a', '#7a4a6a']);
        c.fillRect(-M, top, w + 2 * M, h * 0.08);
        const bx = w * 0.6;
        const span = Math.min(w * 0.3, h * 0.5);
        c.strokeStyle = '#c8402a';
        c.lineWidth = Math.max(6, h * 0.014);
        c.beginPath();
        c.moveTo(bx - span / 2, top + h * 0.01);
        c.quadraticCurveTo(bx, top - h * 0.12, bx + span / 2, top + h * 0.01);
        c.stroke();
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(bx - span / 2, top - h * 0.03);
        c.quadraticCurveTo(bx, top - h * 0.15, bx + span / 2, top - h * 0.03);
        c.stroke();
        for (let i = 0; i <= 8; i++) {
          const u = i / 8;
          const x = bx - span / 2 + span * u;
          const y = top + h * 0.01 - Math.sin(u * Math.PI) * h * 0.065;
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x, y - h * 0.035);
          c.stroke();
        }
      }),
      near: wideLayer(w, h, dpr, (c) => {
        const at = ridge(c, w, h, { y: h * 0.92, amp: h * 0.02, colors: ['#8a4a26', '#5a2e18'], seed: 71, ink: 'rgba(40, 15, 5, 0.8)' });
        const r = seeded(14);
        bush(c, w * 0.9, at(w * 0.9) + 8, h * 0.42, ['#ff8a3d', '#b8261b', '#3a2418'], r);
        bush(c, w * 0.06, at(w * 0.06) + 8, h * 0.3, ['#ffb347', '#c2471b', '#3a2418'], r);
      }),
      clouds: makeClouds(dpr, w, h, PAL.autumn, 4, [0.04, 0.32], [0.09, 0.2], 71),
      leaves: makeFall(w, h, 60, ['#e8452c', '#ff7a2f', '#ffb347', '#c2271b'], [5, 9]),
      birds: [],
    }),
    draw: (ctx, w, h, s, t, level, k, beat, px) => {
      ctx.drawImage(s.sky, 0, 0, w, h);
      const sx = w * 0.26;
      const sy = h * 0.56;
      const b = Math.min(w, h);
      rays(ctx, sx, sy, Math.max(w, h), 16, `rgba(255, 220, 170, ${0.12 + level * 0.15})`, t * 0.015);
      sun(ctx, sx, sy, b * 0.07, level, ['rgba(255, 235, 180, 0.9)', 'rgba(255, 150, 90, 0.4)'], '#fff3d1');
      drawClouds(ctx, s.clouds, w, k, px);
      updateBirds(ctx, s, w, h, t, k, 'rgba(90, 40, 20, 0.6)');
      drawWide(ctx, s.far, w, h, px, 0.25);
      drawWide(ctx, s.mid, w, h, px, 0.5);
      drawShimmer(ctx, w, h * 0.8, h * 0.88, t, w * 0.5, 'rgba(255, 235, 200, 1)', level);
      drawWide(ctx, s.near, w, h, px, 0.9);
      drawFall(ctx, s.leaves, w, h, t, k, level, beat, mapleShape, -1);
    },
  },

  // Bamboo forest in the rain with ukiyo-e water ribbons
  rainy: {
    init: (w, h, dpr) => ({
      sky: makeLayer(w, h, dpr, (c) => {
        c.fillStyle = linear(c, 0, h, ['#1e3438', '#3d5a5c', '#6f8d8a', '#9db5ae']);
        c.fillRect(0, 0, w, h);
      }),
      far: wideLayer(w, h, dpr, (c) => {
        bamboo(c, w, h, { count: Math.round(w / 14), colors: ['#86a39d', '#71908a', '#5f7d78'], leaf: 'rgba(110, 145, 135, 0.8)', seed: 81, minW: 6, maxW: 10 });
      }),
      mid: wideLayer(w, h, dpr, (c) => {
        bamboo(c, w, h, { count: Math.round(w / 40), colors: ['#69a873', '#4b8458', '#2f5c3a'], ink: 'rgba(10, 30, 20, 0.5)', leaf: '#3f7a4a', seed: 83, minW: 14, maxW: 22 });
      }),
      near: wideLayer(w, h, dpr, (c) => {
        bamboo(c, w, h, { count: 5, colors: ['#9ad884', '#5ba653', '#2b6b33'], ink: 'rgba(5, 25, 10, 0.85)', leaf: '#3e8a3c', seed: 87, minW: 34, maxW: 48 });
        c.fillStyle = linear(c, h * 0.9, h, ['#56756f', '#22362f']);
        c.fillRect(-M, h * 0.9, w + 2 * M, h * 0.1);
      }),
      mist: makeMist(w, h, 6, [0.45, 0.85], 0.35),
      drops: makeDrops(w, h, 300),
      ripples: [],
    }),
    draw: (ctx, w, h, s, t, level, k, beat, px) => {
      ctx.drawImage(s.sky, 0, 0, w, h);
      drawWide(ctx, s.far, w, h, px, 0.2);
      drawMist(ctx, s.mist, w, k, '225, 238, 235');
      drawWide(ctx, s.mid, w, h, px, 0.5);
      drawRain(ctx, s.drops, w, h, k, level, `rgba(220, 235, 240, ${0.35 + level * 0.3})`, 1.5);
      ctx.save();
      ctx.translate(0, h);
      ctx.transform(1, 0, Math.sin(t * 0.7) * 0.01 * (1 + level * 2 + beat), 1, 0, 0);
      ctx.translate(0, -h);
      drawWide(ctx, s.near, w, h, px, 0.9);
      ctx.restore();
      if (Math.random() < (0.3 + level) * k) s.ripples.push({ x: rand(0, w), y: rand(h * 0.91, h), r: 1, a: 0.6 });
      s.ripples = s.ripples.filter((rp) => rp.a > 0.03);
      s.ripples.forEach((rp) => {
        rp.r += 0.8 * k;
        rp.a *= 0.95 ** k;
        ctx.strokeStyle = `rgba(230, 240, 245, ${rp.a})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(rp.x, rp.y, rp.r * 2, rp.r * 0.5, 0, 0, TAU);
        ctx.stroke();
      });
      const water = ['rgba(235, 252, 255, 0.95)', 'rgba(120, 210, 230, 0.95)', 'rgba(30, 110, 145, 0.95)'];
      ribbon(ctx, w, t, { y: h * 0.74, amp: h * 0.05, thick: h * 0.06, colors: water, edge: '#ffffff', alpha: 0.1 + beat * 0.8, speed: 1 });
      ribbon(ctx, w, t, { y: h * 0.84, amp: h * 0.04, thick: h * 0.05, colors: water, edge: '#ffffff', alpha: 0.08 + beat * 0.7, speed: -0.8, phase: 1.5 });
    },
  },
};

// Film grain tile shared by all scenes
const makeGrain = () => {
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 160;
  const g = c.getContext('2d');
  const img = g.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 16;
  }
  g.putImageData(img, 0, 0);
  return c;
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
    const grain = ctx.createPattern(makeGrain(), 'repeat');
    let w = 0;
    let h = 0;
    let state = null;
    let vignette = null;
    let level = 0;
    let prevLevel = 0;
    let beat = 0;
    let px = 0;
    let targetPx = 0;
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
      vignette = makeLayer(w, h, dpr, (c) => {
        const g = c.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.8);
        g.addColorStop(0, 'rgba(0, 0, 0, 0)');
        g.addColorStop(1, 'rgba(0, 10, 20, 0.45)');
        c.fillStyle = g;
        c.fillRect(0, 0, w, h);
      });
    };
    const onPointer = (e) => { targetPx = (e.clientX / w) * 2 - 1; };
    resize();
    window.addEventListener('resize', resize);
    if (!reduceMotion) window.addEventListener('pointermove', onPointer);

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
      // Beat pulse: jumps when loudness rises sharply, then fades
      const kick = level - prevLevel;
      prevLevel = level;
      if (kick > 0.04) beat = Math.min(1, beat + kick * 6);
      beat *= 0.93 ** (dt * 60);
      px += (targetPx - px) * Math.min(1, dt * 3);
      scene.draw(ctx, w, h, state, clock, reduceMotion ? 0 : level, k, reduceMotion ? 0 : beat, px);
      ctx.drawImage(vignette, 0, 0, w, h);
      ctx.fillStyle = grain;
      ctx.fillRect(0, 0, w, h);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointer);
    };
  }, [category, analyserRef]);

  return <canvas ref={canvasRef} className="scene" aria-hidden="true" />;
};

export default CategoryScene;
