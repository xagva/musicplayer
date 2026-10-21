import React, { useMemo } from 'react';

// Generated cover art: every song gets its own design, seeded from its filename,
// using its category's palette and motif (sun, moon, lightning, hearts, vinyl...).

const hash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const rng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// [light, dark, highlight] per category
const PALETTES = {
  devotional: [['#ffb347', '#a0300a', '#fff1c8'], ['#ffcf6b', '#c2410c', '#fff7dd'], ['#f59e0b', '#7c2d12', '#fde68a']],
  sufi: [['#5b3a99', '#0f0a2e', '#e8c872'], ['#4c1d95', '#1e1b4b', '#fde68a'], ['#3730a3', '#0b0a23', '#f5d0fe']],
  rock: [['#ff4d4d', '#1a0000', '#ffd166'], ['#b91c1c', '#0a0a0a', '#f97316'], ['#7f1d1d', '#111827', '#e5e7eb']],
  party: [['#ff4fd8', '#4f3bff', '#fff35c'], ['#f43f5e', '#7c3aed', '#67e8f9'], ['#22d3ee', '#a21caf', '#fef08a']],
  romance: [['#ff9ab8', '#8e2a52', '#fff0f5'], ['#fda4af', '#9d174d', '#ffe4e6'], ['#f9a8d4', '#6b21a8', '#fdf2f8']],
  retro: [['#e0a96d', '#4a2f17', '#fff3d1'], ['#d97706', '#3f2a14', '#fde68a'], ['#c2410c', '#1c1917', '#fed7aa']],
  rainy: [['#8ec5e8', '#1c2833', '#e0f2fe'], ['#64748b', '#0f172a', '#bae6fd'], ['#5eead4', '#134e4a', '#ccfbf1']],
  dreamy: [['#7ee8c7', '#2b2f8f', '#ffffff'], ['#67e8f9', '#1e3a8a', '#f0fdfa'], ['#a5b4fc', '#0e7490', '#ffffff']],
};

const heart = (x, y, s) =>
  `M${x} ${y + s * 0.3}C${x} ${y} ${x - s * 0.5} ${y} ${x - s * 0.5} ${y + s * 0.3}C${x - s * 0.5} ${y + s * 0.6} ${x} ${y + s * 0.8} ${x} ${y + s}`
  + `C${x} ${y + s * 0.8} ${x + s * 0.5} ${y + s * 0.6} ${x + s * 0.5} ${y + s * 0.3}C${x + s * 0.5} ${y} ${x} ${y} ${x} ${y + s * 0.3}Z`;

const stars = (r, n, color, maxY = 70) =>
  Array.from({ length: n }, (_, i) => (
    <circle key={`s${i}`} cx={r() * 100} cy={r() * maxY} r={0.5 + r() * 1.3} fill={color} opacity={0.5 + r() * 0.5} />
  ));

// Background texture, picked per song
const pattern = (variant, color) => {
  switch (variant) {
    case 0:
      return Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1={-20 + i * 12} y1="0" x2={i * 12 + 20} y2="100" stroke={color} strokeWidth="3" opacity="0.08" />
      ));
    case 1:
      return Array.from({ length: 6 }, (_, i) => (
        <circle key={i} cx="80" cy="20" r={12 + i * 14} fill="none" stroke={color} strokeWidth="1.5" opacity="0.12" />
      ));
    case 2:
      return Array.from({ length: 5 }, (_, i) => (
        <path key={i} d={`M0 ${30 + i * 15} Q25 ${22 + i * 15} 50 ${30 + i * 15} T100 ${30 + i * 15}`} fill="none" stroke={color} strokeWidth="1.5" opacity="0.12" />
      ));
    default:
      return Array.from({ length: 36 }, (_, i) => (
        <circle key={i} cx={8 + (i % 6) * 17} cy={8 + Math.floor(i / 6) * 17} r="1.2" fill={color} opacity="0.15" />
      ));
  }
};

const MOTIFS = {
  devotional: (r, [, dark, hi]) => {
    const x = 30 + r() * 40;
    return (
      <g>
        {Array.from({ length: 12 }, (_, i) => {
          const a = Math.PI + (i / 11) * Math.PI;
          return <line key={i} x1={x} y1="72" x2={x + Math.cos(a) * 60} y2={72 + Math.sin(a) * 60} stroke={hi} strokeWidth="1.5" opacity="0.35" />;
        })}
        <circle cx={x} cy="72" r="18" fill={hi} opacity="0.95" />
        <rect x="0" y="72" width="100" height="28" fill={dark} opacity="0.55" />
        <path d={`M${x - 12} 80 Q${x} 92 ${x + 12} 80 Z`} fill={dark} />
        <path d={`M${x} 66 Q${x + 4} 73 ${x} 78 Q${x - 4} 73 ${x} 66 Z`} fill="#fff8d6" />
      </g>
    );
  },
  sufi: (r, [, , hi], bgFill) => {
    const x = 35 + r() * 35;
    const y = 30 + r() * 15;
    return (
      <g>
        {stars(r, 18, hi)}
        <circle cx={x} cy={y} r="16" fill={hi} />
        <circle cx={x + 7} cy={y - 4} r="14" fill={bgFill} />
        {Array.from({ length: 14 }, (_, i) => {
          const a = i * 0.9;
          const rr = 8 + i * 2.6;
          return <circle key={i} cx={50 + Math.cos(a) * rr} cy={82 + Math.sin(a) * rr * 0.25} r="1.3" fill={hi} opacity="0.8" />;
        })}
      </g>
    );
  },
  rock: (r, [light, dark, hi]) => {
    const x = 35 + r() * 30;
    return (
      <g>
        <path d="M0 100 L18 62 L30 78 L48 48 L62 72 L78 55 L100 85 L100 100 Z" fill={dark} opacity="0.9" />
        <path d={`M${x + 8} 8 L${x - 6} 46 L${x + 4} 46 L${x - 8} 88 L${x + 16} 38 L${x + 5} 38 L${x + 16} 8 Z`} fill={hi} stroke={light} strokeWidth="1" />
      </g>
    );
  },
  party: (r, [light, , hi]) => {
    const cx = 30 + r() * 40;
    const cy = 30 + r() * 30;
    return (
      <g>
        {Array.from({ length: 18 }, (_, i) => {
          const a = (i / 18) * Math.PI * 2;
          return <line key={i} x1={cx + Math.cos(a) * 8} y1={cy + Math.sin(a) * 8} x2={cx + Math.cos(a) * 26} y2={cy + Math.sin(a) * 26} stroke={i % 2 ? hi : '#ffffff'} strokeWidth="2" strokeLinecap="round" />;
        })}
        {Array.from({ length: 14 }, (_, i) => (
          <rect key={`c${i}`} x={r() * 95} y={r() * 95} width="3" height="6" fill={[hi, light, '#ffffff'][i % 3]} transform={`rotate(${r() * 180} ${r() * 100} ${r() * 100})`} />
        ))}
      </g>
    );
  },
  romance: (r, [light, , hi]) => (
    <g>
      <path d={heart(50 + (r() - 0.5) * 20, 26, 44)} fill={hi} opacity="0.95" />
      <path d={heart(22 + r() * 10, 12, 14)} fill={light} opacity="0.8" />
      <path d={heart(74 + r() * 10, 64, 12)} fill={light} opacity="0.8" />
      {Array.from({ length: 8 }, (_, i) => (
        <ellipse key={i} cx={r() * 100} cy={r() * 100} rx="2.2" ry="1.2" fill="#ffffff" opacity="0.6" transform={`rotate(${r() * 180})`} />
      ))}
    </g>
  ),
  retro: (r, [light, dark, hi]) => {
    const x = 40 + r() * 25;
    return (
      <g>
        <circle cx={x} cy="55" r="36" fill="#141010" />
        {[30, 26, 22, 18].map((rr) => <circle key={rr} cx={x} cy="55" r={rr} fill="none" stroke="#ffffff" strokeWidth="0.5" opacity="0.12" />)}
        <circle cx={x} cy="55" r="11" fill={light} />
        <path d={`M${x - 11} 55 A11 11 0 0 1 ${x + 11} 55 Z`} fill={dark} opacity="0.35" />
        <circle cx={x} cy="55" r="1.6" fill="#141010" />
        <path d={`M${x - 26} 30 A36 36 0 0 1 ${x + 10} 20`} stroke={hi} strokeWidth="2" fill="none" opacity="0.4" />
      </g>
    );
  },
  rainy: (r, [light, , hi]) => {
    const x = 25 + r() * 30;
    return (
      <g>
        {Array.from({ length: 22 }, (_, i) => {
          const rx = r() * 110;
          const ry = 35 + r() * 60;
          return <line key={i} x1={rx} y1={ry} x2={rx - 4} y2={ry + 9} stroke={hi} strokeWidth="1.2" opacity="0.7" />;
        })}
        <g fill={light}>
          <circle cx={x + 10} cy="30" r="12" />
          <circle cx={x + 24} cy="24" r="15" />
          <circle cx={x + 38} cy="31" r="11" />
          <rect x={x + 8} y="30" width="32" height="11" rx="5" />
        </g>
        <g fill={hi} opacity="0.7">
          <circle cx={x + 20} cy="20" r="6" />
        </g>
      </g>
    );
  },
  dreamy: (r, [light, , hi]) => (
    <g>
      {stars(r, 22, hi, 60)}
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M0 ${55 + i * 9} Q30 ${40 + i * 9 + r() * 10} 55 ${55 + i * 9} T100 ${50 + i * 9}`} stroke={i === 1 ? hi : light} strokeWidth={4 - i} fill="none" opacity={0.55 - i * 0.12} strokeLinecap="round" />
      ))}
      <g fill="#ffffff" opacity="0.9">
        <circle cx="30" cy="84" r="9" />
        <circle cx="42" cy="80" r="11" />
        <circle cx="55" cy="85" r="8" />
        <rect x="26" y="84" width="34" height="8" rx="4" />
      </g>
    </g>
  ),
};

// Two more motifs per category so neighbouring songs don't look alike
const EXTRA_MOTIFS = {
  devotional: [
    // Lotus
    (r, [light, dark, hi]) => (
      <g>
        <circle cx="50" cy="46" r="30" fill={hi} opacity="0.25" />
        {[-50, -25, 0, 25, 50].map((a) => (
          <ellipse key={a} cx="50" cy="58" rx="8" ry="22" fill={a === 0 ? hi : light} stroke={dark} strokeWidth="0.8" transform={`rotate(${a} 50 74)`} />
        ))}
        <rect x="0" y="76" width="100" height="24" fill={dark} opacity="0.5" />
      </g>
    ),
    // Row of diyas
    (r, [, dark, hi]) => (
      <g>
        {stars(r, 10, hi, 50)}
        {[22, 50, 78].map((x, i) => (
          <g key={x}>
            <circle cx={x} cy={58 - (i === 1 ? 6 : 0)} r="13" fill={hi} opacity="0.3" />
            <path d={`M${x - 10} ${66 - (i === 1 ? 6 : 0)} Q${x} ${78 - (i === 1 ? 6 : 0)} ${x + 10} ${66 - (i === 1 ? 6 : 0)} Z`} fill={dark} />
            <path d={`M${x} ${50 - (i === 1 ? 6 : 0)} Q${x + 4} ${58 - (i === 1 ? 6 : 0)} ${x} ${64 - (i === 1 ? 6 : 0)} Q${x - 4} ${58 - (i === 1 ? 6 : 0)} ${x} ${50 - (i === 1 ? 6 : 0)} Z`} fill="#fff8d6" />
          </g>
        ))}
      </g>
    ),
  ],
  sufi: [
    // Whirling rings of light
    (r, [light, , hi]) => (
      <g>
        {stars(r, 14, hi)}
        {[34, 26, 18, 10].map((rr, i) => (
          <ellipse key={rr} cx="50" cy="54" rx={rr} ry={rr * 0.55} fill="none" stroke={i % 2 ? light : hi} strokeWidth="2" strokeDasharray="6 5" transform={`rotate(${i * 20 + r() * 20} 50 54)`} />
        ))}
        <circle cx="50" cy="54" r="4" fill={hi} />
      </g>
    ),
    // Hanging lantern under a moon
    (r, [, dark, hi], bgFill) => (
      <g>
        {stars(r, 12, hi)}
        <circle cx="76" cy="22" r="10" fill={hi} />
        <circle cx="80" cy="19" r="9" fill={bgFill} />
        <line x1="40" y1="0" x2="40" y2="34" stroke={hi} strokeWidth="1" />
        <circle cx="40" cy="58" r="26" fill={hi} opacity="0.18" />
        <path d="M30 36 L50 36 L54 48 L50 76 L30 76 L26 48 Z" fill={dark} stroke={hi} strokeWidth="1.5" />
        <rect x="32" y="46" width="16" height="22" rx="3" fill={hi} opacity="0.85" />
      </g>
    ),
  ],
  rock: [
    // Flaming guitar pick
    (r, [light, dark, hi]) => (
      <g>
        <path d="M50 92 C20 70 18 30 50 18 C82 30 80 70 50 92 Z" fill={dark} stroke={hi} strokeWidth="2" />
        <path d="M50 78 C38 66 40 52 48 44 C48 54 56 52 54 40 C64 50 66 66 50 78 Z" fill={hi} />
        <path d="M50 72 C44 64 46 58 50 54 C52 60 56 62 50 72 Z" fill={light} />
      </g>
    ),
    // Moon over jagged peaks
    (r, [light, dark, hi]) => (
      <g>
        <circle cx={30 + r() * 40} cy="30" r="14" fill={hi} opacity="0.9" />
        <path d="M0 100 L14 58 L26 74 L42 40 L56 66 L70 46 L86 70 L100 52 L100 100 Z" fill={dark} />
        <path d="M42 40 L48 50 L44 52 L50 60" stroke={light} strokeWidth="1.5" fill="none" />
      </g>
    ),
  ],
  party: [
    // Mirror ball
    (r, [light, , hi]) => (
      <g>
        <line x1="50" y1="0" x2="50" y2="22" stroke="#ffffff" strokeWidth="1" />
        <circle cx="50" cy="48" r="26" fill={light} />
        {Array.from({ length: 25 }, (_, i) => (
          <rect key={i} x={30 + (i % 5) * 8} y={28 + Math.floor(i / 5) * 8} width="7" height="7" fill={i % 3 ? '#ffffff' : hi} opacity={0.3 + r() * 0.6} />
        ))}
        <circle cx="50" cy="48" r="26" fill="none" stroke="#ffffff" strokeWidth="1.5" opacity="0.7" />
        {[[20, 82], [80, 80], [16, 30], [84, 26]].map(([x, y]) => <path key={x} d={`M${x} ${y - 5} L${x + 1.5} ${y} L${x} ${y + 5} L${x - 1.5} ${y} Z`} fill={hi} />)}
      </g>
    ),
    // Equalizer bars
    (r, [light, , hi]) => (
      <g>
        {Array.from({ length: 9 }, (_, i) => {
          const bh = 18 + r() * 60;
          return <rect key={i} x={8 + i * 10} y={92 - bh} width="7" height={bh} rx="2" fill={i % 2 ? hi : light} />;
        })}
      </g>
    ),
  ],
  romance: [
    // Rose
    (r, [light, dark, hi]) => (
      <g>
        <path d="M50 58 Q48 80 52 96" stroke="#3f6b3a" strokeWidth="3" fill="none" />
        <ellipse cx="42" cy="78" rx="8" ry="3.5" fill="#4d8a46" transform="rotate(-30 42 78)" />
        {[22, 16, 10, 5].map((rr, i) => (
          <circle key={rr} cx={50 + (i % 2 ? 2 : -2)} cy={42 + i} r={rr} fill={[dark, light, hi, dark][i]} opacity={0.9} />
        ))}
        <path d="M44 40 Q50 32 56 40" stroke={dark} strokeWidth="1.5" fill="none" />
      </g>
    ),
    // Two hearts tied by a ribbon
    (r, [light, , hi]) => (
      <g>
        <path d={heart(36, 30, 30)} fill={hi} />
        <path d={heart(64, 38, 30)} fill={light} />
        <path d="M10 80 Q30 66 50 76 T92 70" stroke="#ffffff" strokeWidth="2" fill="none" opacity="0.8" />
      </g>
    ),
  ],
  retro: [
    // Cassette tape
    (r, [light, dark, hi]) => (
      <g>
        <rect x="12" y="26" width="76" height="50" rx="5" fill={dark} />
        <rect x="20" y="32" width="60" height="16" rx="2" fill={hi} />
        <rect x="24" y="52" width="52" height="16" rx="8" fill="#141010" />
        <circle cx="36" cy="60" r="5" fill={light} />
        <circle cx="64" cy="60" r="5" fill={light} />
        <line x1="24" y1="38" x2="64" y2="38" stroke={dark} strokeWidth="1.5" opacity="0.6" />
      </g>
    ),
    // Old radio
    (r, [light, dark, hi]) => (
      <g>
        <line x1="62" y1="30" x2="80" y2="10" stroke={dark} strokeWidth="2" />
        <rect x="14" y="30" width="72" height="48" rx="8" fill={dark} />
        <circle cx="36" cy="54" r="15" fill={light} />
        {[0, 1, 2, 3].map((i) => <line key={i} x1="24" y1={46 + i * 5} x2="48" y2={46 + i * 5} stroke={dark} strokeWidth="1.2" opacity="0.5" />)}
        <circle cx="68" cy="46" r="5" fill={hi} />
        <circle cx="68" cy="63" r="5" fill={hi} />
      </g>
    ),
  ],
  rainy: [
    // Umbrella in the rain
    (r, [light, dark, hi]) => (
      <g>
        {Array.from({ length: 20 }, (_, i) => {
          const rx = r() * 110;
          const ry = r() * 95;
          return <line key={i} x1={rx} y1={ry} x2={rx - 3} y2={ry + 8} stroke={hi} strokeWidth="1" opacity="0.6" />;
        })}
        <path d="M18 52 Q50 14 82 52 Q74 46 66 52 Q58 46 50 52 Q42 46 34 52 Q26 46 18 52 Z" fill={light} stroke={dark} strokeWidth="1" />
        <path d="M50 52 L50 80 Q50 86 44 86" stroke={light} strokeWidth="2.5" fill="none" />
      </g>
    ),
    // Window with drops
    (r, [light, , hi]) => (
      <g>
        <rect x="16" y="14" width="68" height="72" rx="3" fill="none" stroke={light} strokeWidth="3" />
        <line x1="50" y1="14" x2="50" y2="86" stroke={light} strokeWidth="2" />
        <line x1="16" y1="50" x2="84" y2="50" stroke={light} strokeWidth="2" />
        {Array.from({ length: 14 }, (_, i) => (
          <ellipse key={i} cx={20 + r() * 60} cy={18 + r() * 64} rx="1.6" ry="2.6" fill={hi} opacity="0.85" />
        ))}
      </g>
    ),
  ],
  dreamy: [
    // Ringed planet
    (r, [light, , hi]) => (
      <g>
        {stars(r, 24, hi, 100)}
        <circle cx="50" cy="50" r="20" fill={light} />
        <ellipse cx="50" cy="50" rx="36" ry="9" fill="none" stroke={hi} strokeWidth="3" transform="rotate(-20 50 50)" />
        <path d="M31 46 A20 20 0 0 1 69 46" fill="#ffffff" opacity="0.25" />
      </g>
    ),
    // Paper plane over clouds
    (r, [light, , hi]) => (
      <g>
        {stars(r, 10, hi, 40)}
        <path d="M20 40 L82 22 L56 70 L48 50 Z" fill="#ffffff" />
        <path d="M48 50 L82 22 L54 56 Z" fill={light} />
        <path d="M14 58 Q30 50 46 56" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="3 3" fill="none" />
        <g fill="#ffffff" opacity="0.85">
          <circle cx="60" cy="86" r="9" />
          <circle cx="72" cy="82" r="11" />
          <rect x="54" y="86" width="30" height="8" rx="4" />
        </g>
      </g>
    ),
  ],
};

const SongArt = ({ track, size = 'sm' }) => {
  const art = useMemo(() => {
    const seed = hash(track.title);
    const r = rng(seed);
    const pal = PALETTES[track.category] || PALETTES.dreamy;
    const colors = pal[Math.floor(r() * pal.length)];
    const angle = Math.floor(r() * 360);
    const variant = Math.floor(r() * 4);
    const options = [MOTIFS[track.category] || MOTIFS.dreamy, ...(EXTRA_MOTIFS[track.category] || [])];
    const motif = options[Math.floor(r() * options.length)];
    return { seed, colors, angle, variant, motif };
  }, [track.title, track.category]);

  // A fresh RNG per render so the motif is identical every time
  const r = rng(art.seed + 1);
  const [light, dark] = art.colors;
  const id = `${size}-${art.seed}`;
  const { motif } = art;

  return (
    <svg className={`cover cover-${size}`} viewBox="0 0 100 100" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`bg-${id}`} gradientTransform={`rotate(${art.angle} 0.5 0.5)`}>
          <stop offset="0" stopColor={light} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <radialGradient id={`shine-${id}`} cx="0.25" cy="0.2" r="0.8">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#bg-${id})`} />
      {pattern(art.variant, '#ffffff')}
      {motif(r, art.colors, `url(#bg-${id})`)}
      <rect width="100" height="100" fill={`url(#shine-${id})`} />
    </svg>
  );
};

export default SongArt;
