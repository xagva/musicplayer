// Saves album art for every song into public/covers and writes src/covers.json.
// 1. Uses artwork embedded in the audio file when there is one.
// 2. Otherwise searches the iTunes Search API and keeps a result only when its song name matches.
// Results (including misses) are cached in scripts/cover-cache.json so reruns only look up new songs.
// Run with: npm run covers
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mm = require('music-metadata');

const ROOT = path.join(__dirname, '..');
const AUDIO_DIR = path.join(ROOT, 'src', 'audio');
const OUT_DIR = path.join(ROOT, 'public', 'covers');
const MAP_FILE = path.join(ROOT, 'src', 'covers.json');
const CACHE_FILE = path.join(__dirname, 'cover-cache.json');
const DELAY_MS = 3500; // iTunes allows roughly 20 requests a minute

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const idFor = (file) => crypto.createHash('md5').update(file).digest('hex').slice(0, 12);
const norm = (s) => (s || '').toLowerCase().normalize('NFKD').replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

// Song name matches when the shorter normalised name is contained in the longer one
const sameSong = (a, b) => {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  return x.length <= y.length ? y.includes(x) : x.includes(y);
};

const search = async (term, entity) => {
  const url = `https://itunes.apple.com/search?${new URLSearchParams({ term, entity, limit: '10', country: 'IN' })}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url);
    if (res.status === 403 || res.status === 429) {
      await sleep(60000);
      continue;
    }
    if (!res.ok) return [];
    return (await res.json()).results || [];
  }
  return [];
};

const lookup = async ({ name, artist }) => {
  if (!name || /^track \d*$/i.test(name)) return null;
  const songs = await search(`${name} ${artist}`.trim(), 'song');
  await sleep(DELAY_MS);
  const scored = songs
    .filter((s) => sameSong(s.trackName, name))
    .map((s) => ({
      s,
      score: artist && (sameSong(s.artistName, artist) || sameSong(s.collectionName, artist)) ? 2 : 1,
    }))
    .sort((a, b) => b.score - a.score);
  if (scored.length) return scored[0].s.artworkUrl100;
  // Retry with just the song name when the artist/film part confused the search
  if (artist) {
    const byName = await search(name, 'song');
    await sleep(DELAY_MS);
    const hit = byName.find((s) => sameSong(s.trackName, name) && (sameSong(s.artistName, artist) || sameSong(s.collectionName, artist)));
    if (hit) return hit.artworkUrl100;
  }
  return null;
};

(async () => {
  // trackInfo.js is an ES module shared with the app, so load it from source
  const src = fs.readFileSync(path.join(ROOT, 'src', 'trackInfo.js'), 'utf8');
  const { parseTrack } = await import(`data:text/javascript,${encodeURIComponent(src)}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  let cache = {};
  try {
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch (e) {
    // Missing or damaged cache: covers already on disk are still picked up below
  }
  // Write to a temp file and rename so an interrupted run can't leave a half-written cache
  const saveCache = () => {
    fs.writeFileSync(`${CACHE_FILE}.tmp`, JSON.stringify(cache, null, 2));
    fs.renameSync(`${CACHE_FILE}.tmp`, CACHE_FILE);
  };
  const files = fs.readdirSync(AUDIO_DIR).filter((f) => /\.(mp3|m4a|aac|mp4)$/i.test(f));
  const map = {};
  const stats = { embedded: 0, itunes: 0, missing: 0 };

  for (const [i, file] of files.entries()) {
    const out = `covers/${idFor(file)}.jpg`;
    const outPath = path.join(ROOT, 'public', out);
    const cached = cache[file];

    if (fs.existsSync(outPath)) {
      map[file] = out;
      if (!cached || cached === 'none') cache[file] = 'itunes';
      stats[cache[file]] += 1;
      continue;
    }
    if (cached === 'none') {
      stats.missing += 1;
      continue;
    }

    let source = 'none';
    try {
      const meta = await mm.parseFile(path.join(AUDIO_DIR, file), { duration: false });
      const pic = meta.common.picture && meta.common.picture[0];
      if (pic) {
        fs.writeFileSync(outPath, pic.data);
        source = 'embedded';
      }
    } catch (e) {
      // unreadable tags: fall through to the online lookup
    }

    if (source === 'none') {
      try {
        const art = await lookup(parseTrack(file));
        if (art) {
          const res = await fetch(art.replace('100x100bb', '400x400bb'));
          if (res.ok) {
            fs.writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
            source = 'itunes';
          }
        }
      } catch (e) {
        console.warn(`  lookup failed for ${file}: ${e.message}`);
      }
    }

    cache[file] = source;
    if (source === 'none') stats.missing += 1;
    else {
      stats[source] += 1;
      map[file] = out;
    }
    console.log(`[${i + 1}/${files.length}] ${source.padEnd(8)} ${file}`);
    saveCache();
  }

  saveCache();
  fs.writeFileSync(MAP_FILE, JSON.stringify(map, null, 2));
  console.log(`\nDone: ${stats.embedded} embedded, ${stats.itunes} from iTunes, ${stats.missing} without art`);
})();
