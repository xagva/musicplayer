import { useEffect, useRef } from 'react';

// Full-screen animated background. Each category has its own scene, and every
// scene reacts to `level` (0..1 loudness from the audio analyser) and `freq`.

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const fillBg = (ctx, w, h, stops, radial) => {
  const g = radial
    ? ctx.createRadialGradient(w / 2, h * 0.6, 0, w / 2, h * 0.6, Math.max(w, h) * 0.8)
    : ctx.createLinearGradient(0, 0, 0, h);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
};

const heartPath = (ctx, x, y, s) => {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.3);
  ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s);
  ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
};

const SCENES = {
  // Rising diya flames around a slowly turning mandala
  devotional: {
    init: (w, h) => ({
      flames: Array.from({ length: 45 }, () => ({
        x: rand(0, w), y: rand(0, h), size: rand(4, 10), speed: rand(0.3, 1), phase: rand(0, TAU),
      })),
    }),
    draw: (ctx, w, h, s, t, level) => {
      fillBg(ctx, w, h, ['#ffb15c', '#8a2a00', '#2a0700'], true);
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(t * 0.08);
      const r = Math.min(w, h) * (0.28 + level * 0.06);
      ctx.strokeStyle = `rgba(255, 220, 150, ${0.15 + level * 0.35})`;
      ctx.lineWidth = 1.5;
      for (let ring = 0; ring < 3; ring++) {
        const petals = 12 + ring * 6;
        for (let i = 0; i < petals; i++) {
          ctx.save();
          ctx.rotate((i / petals) * TAU + ring * 0.2);
          ctx.beginPath();
          ctx.ellipse(r * (0.35 + ring * 0.3), 0, r * 0.18, r * 0.06, 0, 0, TAU);
          ctx.stroke();
          ctx.restore();
        }
      }
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      s.flames.forEach((f) => {
        f.y -= f.speed * s.speed * (1 + level * 2);
        if (f.y < -30) { f.y = h + 30; f.x = rand(0, w); }
        const flicker = 1 + Math.sin(t * 8 + f.phase) * 0.15;
        const size = f.size * flicker * (1 + level * 0.8);
        const x = f.x + Math.sin(t + f.phase) * 6;
        const glow = ctx.createRadialGradient(x, f.y, 0, x, f.y, size * 4);
        glow.addColorStop(0, 'rgba(255, 200, 80, 0.5)');
        glow.addColorStop(1, 'rgba(255, 120, 0, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x - size * 4, f.y - size * 4, size * 8, size * 8);
        ctx.fillStyle = 'rgba(255, 240, 180, 0.9)';
        ctx.beginPath();
        ctx.ellipse(x, f.y, size * 0.45, size, 0, 0, TAU);
        ctx.fill();
      });
      ctx.globalCompositeOperation = 'source-over';
    },
  },

  // Whirling golden dust, like a dervish spin
  sufi: {
    init: (w, h) => ({
      clear: true,
      dots: Array.from({ length: 260 }, () => ({
        r: rand(20, Math.max(w, h) * 0.6), a: rand(0, TAU), size: rand(0.8, 2.6), speed: rand(0.4, 1.2),
      })),
    }),
    draw: (ctx, w, h, s, t, level) => {
      if (s.clear) { fillBg(ctx, w, h, ['#2b1b4a', '#0b0620'], true); s.clear = false; }
      ctx.fillStyle = 'rgba(11, 6, 32, 0.18)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(232, 200, 114, 0.85)';
      s.dots.forEach((d) => {
        d.a += (d.speed * s.speed * (0.6 + level * 3)) / Math.sqrt(d.r) * 0.25;
        const breathe = 1 + Math.sin(t * 0.7 + d.r * 0.01) * 0.05 + level * 0.1;
        const x = w / 2 + Math.cos(d.a) * d.r * breathe;
        const y = h / 2 + Math.sin(d.a) * d.r * breathe * 0.75;
        ctx.beginPath();
        ctx.arc(x, y, d.size * (1 + level), 0, TAU);
        ctx.fill();
      });
    },
  },

  // Equalizer bars plus lightning on loud hits
  rock: {
    init: () => ({ flash: 0, bolt: null, boltLife: 0, prevLevel: 0 }),
    draw: (ctx, w, h, s, t, level, freq) => {
      fillBg(ctx, w, h, ['#050505', '#1a0000', '#3a0000'], false);
      const kick = level - s.prevLevel;
      s.prevLevel = level;
      if (s.speed > 0.5 && ((kick > 0.08 && level > 0.45) || Math.random() < 0.003)) {
        let x = rand(w * 0.1, w * 0.9);
        const pts = [[x, 0]];
        for (let y = 0; y < h * rand(0.5, 0.9); y += rand(20, 50)) {
          x += rand(-40, 40);
          pts.push([x, y]);
        }
        s.bolt = pts;
        s.boltLife = 1;
        s.flash = 0.35;
      }
      if (s.flash > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${s.flash})`;
        ctx.fillRect(0, 0, w, h);
        s.flash *= 0.85;
      }
      if (s.bolt && s.boltLife > 0) {
        ctx.strokeStyle = `rgba(220, 230, 255, ${s.boltLife})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = '#9cf';
        ctx.shadowBlur = 25;
        ctx.beginPath();
        s.bolt.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
        ctx.shadowBlur = 0;
        s.boltLife -= 0.06;
      }
      const bars = 48;
      const bw = w / bars;
      for (let i = 0; i < bars; i++) {
        const v = freq ? freq[Math.floor((i / bars) * freq.length * 0.7)] / 255 : (Math.sin(t * 3 + i * 0.5) + 1) * 0.15;
        const bh = v * h * 0.55;
        const g = ctx.createLinearGradient(0, h, 0, h - bh);
        g.addColorStop(0, '#ff1e1e');
        g.addColorStop(1, '#ffb000');
        ctx.fillStyle = g;
        ctx.fillRect(i * bw + 2, h - bh, bw - 4, bh);
      }
    },
  },

  // Sweeping disco spotlights and falling confetti
  party: {
    init: (w, h) => ({
      confetti: Array.from({ length: 140 }, () => ({
        x: rand(0, w), y: rand(-h, h), vy: rand(1, 3), rot: rand(0, TAU), vr: rand(-0.1, 0.1),
        color: pick(['#ff4fd8', '#4fd1ff', '#ffe14f', '#7cff4f', '#ff7a4f']), cw: rand(5, 10), ch: rand(8, 16),
      })),
    }),
    draw: (ctx, w, h, s, t, level) => {
      fillBg(ctx, w, h, ['#1a0030', '#08000f'], false);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const ox = (w / 6) * (i + 1);
        const ang = Math.PI / 2 + Math.sin(t * (0.6 + i * 0.15) + i) * 0.6;
        const len = h * 1.2;
        const spread = 0.18 + level * 0.1;
        const hue = (t * 40 + i * 72) % 360;
        const g = ctx.createRadialGradient(ox, 0, 0, ox, 0, len);
        g.addColorStop(0, `hsla(${hue}, 100%, 60%, ${0.35 + level * 0.4})`);
        g.addColorStop(1, `hsla(${hue}, 100%, 60%, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(ox, 0);
        ctx.lineTo(ox + Math.cos(ang - spread) * len, Math.sin(ang - spread) * len);
        ctx.lineTo(ox + Math.cos(ang + spread) * len, Math.sin(ang + spread) * len);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      s.confetti.forEach((c) => {
        c.y += c.vy * s.speed * (1 + level * 2.5);
        c.rot += c.vr * s.speed;
        if (c.y > h + 20) { c.y = -20; c.x = rand(0, w); }
        ctx.save();
        ctx.translate(c.x + Math.sin(t + c.rot) * 10, c.y);
        ctx.rotate(c.rot);
        ctx.scale(1, Math.cos(t * 3 + c.rot));
        ctx.fillStyle = c.color;
        ctx.fillRect(-c.cw / 2, -c.ch / 2, c.cw, c.ch);
        ctx.restore();
      });
    },
  },

  // Floating hearts
  romance: {
    init: (w, h) => ({
      hearts: Array.from({ length: 40 }, () => ({
        x: rand(0, w), y: rand(0, h), size: rand(12, 34), speed: rand(0.4, 1.2),
        phase: rand(0, TAU), hue: rand(330, 360), alpha: rand(0.25, 0.7),
      })),
    }),
    draw: (ctx, w, h, s, t, level) => {
      fillBg(ctx, w, h, ['#4a0d2b', '#8e2a52', '#d8577e'], false);
      s.hearts.forEach((p) => {
        p.y -= p.speed * s.speed * (1 + level * 1.5);
        if (p.y < -50) { p.y = h + 50; p.x = rand(0, w); }
        const beat = 1 + level * 0.5 + Math.sin(t * 4 + p.phase) * 0.05;
        ctx.fillStyle = `hsla(${p.hue}, 90%, 70%, ${p.alpha})`;
        heartPath(ctx, p.x + Math.sin(t + p.phase) * 20, p.y, p.size * beat);
        ctx.fill();
      });
    },
  },

  // Spinning vinyl, film grain and scratches
  retro: {
    init: () => ({ angle: 0 }),
    draw: (ctx, w, h, s, t, level) => {
      fillBg(ctx, w, h, ['#5a4128', '#2b1d10', '#140c05'], true);
      const r = Math.min(w, h) * 0.32 * (1 + level * 0.04);
      const cx = w * 0.5;
      const cy = h * 0.5;
      s.angle += 0.035 * s.speed;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(s.angle);
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      for (let g = r * 0.4; g < r; g += 4) {
        ctx.beginPath();
        ctx.arc(0, 0, g, 0, TAU);
        ctx.stroke();
      }
      ctx.fillStyle = '#b03a2e';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.33, 0, Math.PI);
      ctx.fill();
      ctx.fillStyle = '#d9a066';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.33, Math.PI, TAU);
      ctx.fill();
      ctx.fillStyle = '#140c05';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.03, 0, TAU);
      ctx.fill();
      ctx.restore();
      const sheen = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      sheen.addColorStop(0.3, 'rgba(255,255,255,0)');
      sheen.addColorStop(0.5, 'rgba(255,255,255,0.08)');
      sheen.addColorStop(0.7, 'rgba(255,255,255,0)');
      ctx.fillStyle = sheen;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 235, 200, 0.25)';
      for (let i = 0; i < 250; i++) ctx.fillRect(rand(0, w), rand(0, h), 1.5, 1.5);
      if (Math.random() < 0.3) {
        ctx.fillStyle = 'rgba(255, 235, 200, 0.15)';
        ctx.fillRect(rand(0, w), 0, 1, h);
      }
      ctx.fillStyle = `rgba(40, 25, 10, ${rand(0, 0.08)})`;
      ctx.fillRect(0, 0, w, h);
    },
  },

  // Rain streaks with ripples on the ground
  rainy: {
    init: (w, h) => ({
      drops: Array.from({ length: 320 }, () => ({ x: rand(0, w), y: rand(0, h), len: rand(10, 25), speed: rand(7, 14) })),
      ripples: [],
    }),
    draw: (ctx, w, h, s, t, level) => {
      fillBg(ctx, w, h, ['#0f1820', '#1c2833', '#2e4053'], false);
      const wind = 1.5 + level * 3;
      ctx.strokeStyle = `rgba(174, 214, 241, ${0.35 + level * 0.3})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      s.drops.forEach((d) => {
        d.y += d.speed * s.speed * (1 + level);
        d.x += wind * s.speed;
        if (d.y > h) {
          if (Math.random() < 0.15) s.ripples.push({ x: d.x, y: h - rand(5, 60), r: 1, a: 0.5 });
          d.y = rand(-50, 0);
          d.x = rand(-50, w);
        }
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + wind * 2, d.y + d.len);
      });
      ctx.stroke();
      s.ripples = s.ripples.filter((rp) => rp.a > 0.02);
      s.ripples.forEach((rp) => {
        rp.r += 1.2;
        rp.a *= 0.94;
        ctx.strokeStyle = `rgba(174, 214, 241, ${rp.a})`;
        ctx.beginPath();
        ctx.ellipse(rp.x, rp.y, rp.r * 2, rp.r * 0.6, 0, 0, TAU);
        ctx.stroke();
      });
    },
  },

  // Twinkling stars under drifting aurora bands
  dreamy: {
    init: (w, h) => ({
      stars: Array.from({ length: 260 }, () => ({ x: rand(0, w), y: rand(0, h), r: rand(0.3, 1.6), tw: rand(0, TAU) })),
    }),
    draw: (ctx, w, h, s, t, level) => {
      fillBg(ctx, w, h, ['#020617', '#0b1d3a', '#10284d'], false);
      s.stars.forEach((st) => {
        const a = 0.4 + Math.sin(t * 2 + st.tw) * 0.4;
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(a, 0.05)})`;
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r * (1 + level), 0, TAU);
        ctx.fill();
      });
      ctx.globalCompositeOperation = 'lighter';
      const colors = ['126, 232, 199', '120, 140, 255', '200, 120, 255'];
      colors.forEach((c, i) => {
        const g = ctx.createLinearGradient(0, h * 0.15, 0, h * 0.65);
        g.addColorStop(0, `rgba(${c}, 0)`);
        g.addColorStop(0.5, `rgba(${c}, ${0.12 + level * 0.25})`);
        g.addColorStop(1, `rgba(${c}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 20) {
          const y = h * 0.4 + Math.sin(x * 0.004 + t * (0.3 + i * 0.1) + i * 2) * h * 0.12
            + Math.sin(x * 0.011 - t * 0.5) * h * 0.04;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();
      });
      ctx.globalCompositeOperation = 'source-over';
    },
  },
};

const CategoryScene = ({ category, playing, analyserRef }) => {
  const canvasRef = useRef(null);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    const scene = SCENES[category] || SCENES.romance;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0;
    let h = 0;
    let state = null;
    let level = 0;
    let freq = null;
    let frame;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      state = scene.init(w, h);
    };
    resize();
    window.addEventListener('resize', resize);

    const start = performance.now();
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
      state.speed = reduceMotion ? 0.25 : playingRef.current ? 1 : 0.35;
      scene.draw(ctx, w, h, state, (now - start) / 1000, reduceMotion ? 0 : level, playingRef.current ? freq : null);
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
