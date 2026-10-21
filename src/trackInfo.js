// Turns messy download filenames into a display name and artist/album line,
// e.g. "[Songs.PK] Cocktail - 01 - Tum Hi Ho Bandhu.mp3" -> "Tum Hi Ho Bandhu" / "Cocktail"

// Parts that should be read as the artist (or film) rather than the song name
const KNOWN_ARTISTS = /^(linkin park|nirvana|coldplay|green day|pink floyd|imagine dragons|taylor swift|maroon 5|(dev & )?enrique iglesias.*|ellie goulding|avril lavigne|lady gaga|lana del rey|david guetta|pitbull|flo rida|icona pop|alexandra stan|ed sheeran|jagjit singh|hari om sharan|lata mangeshkar|kishore kumar|rahat fateh ali khan|mohd\. rafi|a r rahman|rashid ali.*|shaan|amit trivedi|junoon|eluveitie|lenka|blue|the local train|the train|gajendra verma|runa rizvi|ronan keating.*|ayushmann khurrana|gunday|kinara|ghar|rampur ka laxman|yeh jawaani hai deewani|i me aur main)$/i;

// Download-site tags and video labels that aren't part of the song name
const JUNK = /\[songs\.pk\]|\(?www\.songs\.pk\)?|@ ?fmw11\.com|\(papuyaar\.com\)|\(?mp3pk\.com\)?|downloadming\.se|\[wikiseda\]|\[www\.djmaza\.com\]|\[dm\]|\(itunes rip\)|\(official[^)]*\)|\[official video\]|\(music video\)|\(audio\)|\(hd\)|\(\d+\)|full song|official|studio recording.*$|\bhq\b|- copy$/gi;

const GENERIC_PARTS = /^(bhajans?|bhajjan|song|title song|lyrics|hindi songs)$/i;

// Display names that the rules above can't work out
const OVERRIDES = [
  [/^Prabhu Tero Naam/, { name: 'Prabhu Tero Naam', artist: 'Lata Mangeshkar · Hum Dono' }],
  [/^delhibelly/i, { name: 'Delhi Belly', artist: '' }],
];

const titleCase = (s) =>
  s === s.toUpperCase() || s === s.toLowerCase()
    ? s.toLowerCase().replace(/(^|[\s(])([a-z])/g, (m, pre, c) => pre + c.toUpperCase())
    : s;

const tidy = (s) => titleCase(s.replace(/\s+/g, ' ').replace(/ song\s*$/i, '').replace(/^[\s\-.]+|[\s\-.]+$/g, ''));

// Known artists get consistent capitalisation ("Linkin park" -> "Linkin Park")
const artistCase = (s) => (KNOWN_ARTISTS.test(s) ? s.replace(/(^|\s)([a-z])/g, (m, pre, c) => pre + c.toUpperCase()) : s);

export const parseTrack = (filename) => {
  const base = filename.replace(/\.[^.]+$/, '');
  const override = OVERRIDES.find(([pattern]) => pattern.test(base));
  if (override) return override[1];

  let s = base
    // Undo the "!s" rename suffix on a few files ("102 sama hai suhanas", "Chalte chalte01s")
    .replace(/^(\d{3}\.? .*)s$/, '$1')
    .replace(/\d{2}s$/, '')
    // "(06) [Linkin Park] Song" -> "Linkin Park - Song"
    .replace(/^\(\d+\)\s*\[(.+?)\]\s*/, '$1 - ')
    // "Atlas(Coldplay)" -> "Atlas - Coldplay"
    .replace(/^(.+?)\s*\(([^)]+)\)$/, (m, a, b) => (KNOWN_ARTISTS.test(b) ? `${a} - ${b}` : m))
    .replace(JUNK, ' ')
    .replace(/_+/g, ' - ')
    .replace(/-bhajan$/i, '');

  let parts = s.split(/\s+-+\s+|\s*--\s*|^\s*-+\s*|\s*-+\s*$/);
  // "Avril Lavigne-Everybody Hurts": split on a bare dash when there is no spaced one
  if (parts.filter(Boolean).length === 1 && /^[^-]{2,}-[^-]{2,}$/.test(s.trim())) parts = s.trim().split('-');

  parts = parts
    .map((p) => tidy(p.replace(/^\d+(?:[.)]\s*|\s+)(?=\S)/, '')))
    .filter((p) => p && !GENERIC_PARTS.test(p));
  // Drop bare track numbers ("Rockstar - 13 - Kun Faya Kun"), but keep a song called "22"
  parts = parts.filter((p, i) => !/^\d+$/.test(p) || (i > 0 && parts.length <= 2)).map(artistCase);

  if (parts.length === 0) return { name: `Track ${(base.match(/^\d+/) || [''])[0]}`.trim(), artist: '' };
  if (parts.length === 1) return { name: parts[0], artist: '' };

  const idx = parts.findIndex((p) => KNOWN_ARTISTS.test(p));
  if (idx === -1) return { name: parts[1], artist: parts[0] };

  const others = parts.filter((_, i) => i !== idx);
  // "Film - Song - Singer": the song is the middle part
  if (idx === parts.length - 1 && parts.length >= 3) return { name: others[1], artist: `${parts[idx]} · ${others[0]}` };
  return { name: idx === 0 ? others.join(' – ') : others[0], artist: parts[idx] };
};
