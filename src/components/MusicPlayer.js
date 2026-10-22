import React, { useState, useRef, useEffect } from 'react';
import {
  IoPlay, IoPause, IoPlaySkipForward, IoPlaySkipBack, IoShuffle, IoRepeat,
  IoVolumeHigh, IoVolumeMute, IoSearch, IoDownloadOutline, IoMusicalNotes,
  IoChevronDown, IoChevronUp, IoChevronBack, IoChevronForward,
} from 'react-icons/io5';
import CategoryScene from './CategoryScene';
import SongArt from './SongArt';
import { CATEGORIES, categorize } from '../categories';
import { parseTrack } from '../trackInfo';
import covers from '../covers.json';

// Function to import all audio files from the directory, tagging each with a category
// and its album cover (from scripts/fetch-covers.js) when one was found
const importAll = (r) => {
  let files = [];
  r.keys().forEach((item) => {
    const url = r(item);
    const title = item.replace('./', '').split('/').pop();
    const cover = covers[title] ? `${process.env.PUBLIC_URL}/${covers[title]}` : null;
    files.push({ title, url, cover, category: categorize(title), ...parseTrack(title) });
  });
  return files;
};

// Import audio files from the 'src/audio' directory
const audioFiles = importAll(require.context('../audio', false, /\.(mp3|m4a|aac|mp4)$/i));

const formatTime = (sec) => {
  if (!Number.isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

// Stable per-song number so "popular" tie-breaks don't reshuffle on every render
const hashOf = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const loadJSON = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (e) {
    return fallback;
  }
};

const saveJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) { /* storage unavailable */ }
};

// Animated bars shown on the song that is playing
const Equalizer = ({ paused }) => (
  <span className={paused ? 'eq paused' : 'eq'} aria-hidden="true">
    <i /><i /><i />
  </span>
);

const Card = ({ track, active, playing, onSelect }) => (
  <button className={active ? 'card active' : 'card'} onClick={() => onSelect(track)}>
    <span className="card-art">
      <SongArt track={track} size="card" />
      <span className="card-play" aria-hidden="true">{active && playing ? <IoPause /> : <IoPlay className="nudge" />}</span>
      {active && <span className="card-eq"><Equalizer paused={!playing} /></span>}
    </span>
    <span className="card-title">{track.name}</span>
    <span className="card-sub">{track.artist || CATEGORIES[track.category].label}</span>
  </button>
);

// A titled, horizontally scrolling row of cards
const Shelf = ({ eyebrow, title, tracks, onMore, renderCard, big = false }) => {
  const rowRef = useRef(null);
  const scroll = (dir) => rowRef.current?.scrollBy({ left: dir * rowRef.current.clientWidth * 0.85, behavior: 'smooth' });
  if (!tracks.length) return null;
  return (
    <section className="shelf">
      <div className="shelf-head">
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h2>{title}</h2>
        </div>
        <div className="shelf-actions">
          {onMore && <button className="more-btn" onClick={onMore}>More</button>}
          <button className="icon-btn round" onClick={() => scroll(-1)} aria-label="Scroll left"><IoChevronBack /></button>
          <button className="icon-btn round" onClick={() => scroll(1)} aria-label="Scroll right"><IoChevronForward /></button>
        </div>
      </div>
      <div className={big ? 'shelf-row big' : 'shelf-row'} ref={rowRef}>{tracks.map(renderCard)}</div>
    </section>
  );
};

const MediaPlayer = () => {
  const [currentAudio, setCurrentAudio] = useState(audioFiles[0] || null);
  const [playing, setPlaying] = useState(false);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('off'); // off | all | one
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [muted, setMuted] = useState(false);
  const [nowOpen, setNowOpen] = useState(false);
  const [playCounts, setPlayCounts] = useState(() => loadJSON('playCounts', {}));
  const [recent, setRecent] = useState(() => loadJSON('recent', []));
  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const autoplayRef = useRef(false);

  // Most played first; before there is any history, songs with real covers and artists lead
  const popularity = (t) => (playCounts[t.title] || 0) * 1000 + (t.cover ? 100 : 0) + (t.artist ? 50 : 0) + (hashOf(t.title) % 50);
  const byPopularity = (list) => [...list].sort((a, b) => popularity(b) - popularity(a));

  const q = query.trim().toLowerCase();
  const visibleTracks = byPopularity(audioFiles.filter(
    (a) => (filter === 'all' || a.category === filter)
      && (!q || `${a.name} ${a.artist} ${a.title}`.toLowerCase().includes(q)),
  ));

  useEffect(() => {
    if (!currentAudio) console.error('No audio files found!');
  }, [currentAudio]);

  // Load the selected track, and start it if the user asked for playback
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentAudio) return;
    audio.src = currentAudio.url;
    setTime(0);
    if (autoplayRef.current) {
      audio.play().catch((error) => console.error('Playback error:', error));
    }
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: currentAudio.name,
        artist: currentAudio.artist || CATEGORIES[currentAudio.category].label,
        artwork: currentAudio.cover ? [{ src: currentAudio.cover, sizes: '400x400', type: 'image/jpeg' }] : [],
      });
    }
  }, [currentAudio]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = muted;
    }
  }, [volume, muted]);

  // Route the <audio> element through an analyser so the scenes can react to the music.
  // Created on first play because browsers only allow audio contexts after a user gesture.
  const connectAnalyser = () => {
    if (!audioCtxRef.current) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const source = ctx.createMediaElementSource(audioRef.current);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyser.connect(ctx.destination);
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;
      } catch (error) {
        console.error('Audio analyser unavailable:', error);
        return;
      }
    }
    audioCtxRef.current.resume();
  };

  const recordPlay = (track) => {
    setPlayCounts((prev) => {
      const next = { ...prev, [track.title]: (prev[track.title] || 0) + 1 };
      saveJSON('playCounts', next);
      return next;
    });
    setRecent((prev) => {
      const next = [track.title, ...prev.filter((t) => t !== track.title)].slice(0, 20);
      saveJSON('recent', next);
      return next;
    });
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    connectAnalyser();
    autoplayRef.current = true;
    if (audio.paused) audio.play().catch((error) => console.error('Playback error:', error));
    else audio.pause();
  };

  const playTrack = (track) => {
    if (track.url === currentAudio?.url) {
      togglePlay();
      return;
    }
    connectAnalyser();
    autoplayRef.current = true;
    recordPlay(track);
    setCurrentAudio(track);
  };

  // Picking a song plays it and opens the full-screen view
  const selectTrack = (track) => {
    if (track.url !== currentAudio?.url) playTrack(track);
    else if (audioRef.current?.paused) togglePlay();
    setNowOpen(true);
  };

  // Next/previous stay inside the current view when the playing song is in it
  const queue = () => (visibleTracks.some((a) => a.url === currentAudio?.url) ? visibleTracks : audioFiles);

  const playNext = () => {
    const list = queue();
    if (shuffle && list.length > 1) {
      let next;
      do next = list[Math.floor(Math.random() * list.length)];
      while (next.url === currentAudio?.url);
      playTrack(next);
      return;
    }
    const index = list.findIndex((a) => a.url === currentAudio?.url);
    playTrack(list[(index + 1) % list.length]);
  };

  const playPrev = () => {
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    const list = queue();
    const index = list.findIndex((a) => a.url === currentAudio?.url);
    playTrack(list[(index - 1 + list.length) % list.length]);
  };

  const handleEnded = () => {
    if (repeat === 'one') {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      return;
    }
    const list = queue();
    const isLast = list.findIndex((a) => a.url === currentAudio?.url) === list.length - 1;
    if (repeat === 'off' && isLast && !shuffle) return;
    playNext();
  };

  const playView = () => {
    if (visibleTracks.length === 0) return;
    const inView = visibleTracks.some((a) => a.url === currentAudio?.url);
    if (inView) togglePlay();
    else selectTrack(shuffle ? visibleTracks[Math.floor(Math.random() * visibleTracks.length)] : visibleTracks[0]);
  };

  // Space toggles playback (unless typing); Escape closes the full-screen view
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName)) {
        e.preventDefault();
        togglePlay();
      }
      if (e.key === 'Escape') setNowOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('nexttrack', playNext);
    navigator.mediaSession.setActionHandler('previoustrack', playPrev);
  });

  const pickGenre = (key) => {
    setFilter(key);
    setQuery('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const category = currentAudio ? CATEGORIES[currentAudio.category] : null;
  const viewPlaying = playing && visibleTracks.some((a) => a.url === currentAudio?.url);
  const progress = duration ? (time / duration) * 100 : 0;
  const recentTracks = recent.map((title) => audioFiles.find((a) => a.title === title)).filter(Boolean);

  const renderCard = (track) => (
    <Card key={track.url} track={track} active={currentAudio?.url === track.url} playing={playing} onSelect={selectTrack} />
  );

  let content;
  if (q || filter !== 'all') {
    const genre = CATEGORIES[filter];
    content = (
      <>
        <header className="genre-hero" style={{ '--g': genre ? genre.accent : 'var(--accent)' }}>
          <div>
            <span className="eyebrow">{q ? 'Search' : 'Genre'}</span>
            <h1>{q ? `“${query.trim()}”` : `${genre.emoji} ${genre.label}`}</h1>
            <p>{q ? `${visibleTracks.length} songs found${genre ? ` in ${genre.label}` : ''}` : `${genre.tagline} · ${visibleTracks.length} songs`}</p>
          </div>
          <div className="actions">
            <button className="play-big" onClick={playView} aria-label={viewPlaying ? 'Pause' : 'Play'} disabled={!visibleTracks.length}>
              {viewPlaying ? <IoPause /> : <IoPlay className="nudge" />}
            </button>
            <button className={shuffle ? 'icon-btn on' : 'icon-btn'} onClick={() => setShuffle(!shuffle)} aria-label="Shuffle" title="Shuffle">
              <IoShuffle />
            </button>
          </div>
        </header>
        {visibleTracks.length === 0 ? <p className="empty">No songs match “{query}”.</p> : <div className="grid">{visibleTracks.map(renderCard)}</div>}
      </>
    );
  } else {
    content = (
      <>
        <Shelf eyebrow="Pick up where you left off" title="Listen again" tracks={recentTracks} renderCard={renderCard} />
        <Shelf eyebrow="From your library" title="Popular picks" tracks={byPopularity(audioFiles).slice(0, 18)} renderCard={renderCard} big />
        {Object.entries(CATEGORIES).map(([key, c]) => (
          <Shelf
            key={key}
            eyebrow={c.tagline}
            title={`${c.emoji} ${c.label}`}
            tracks={byPopularity(audioFiles.filter((a) => a.category === key)).slice(0, 14)}
            onMore={() => pickGenre(key)}
            renderCard={renderCard}
          />
        ))}
      </>
    );
  }

  return (
    <div className={nowOpen ? 'app-shell now-open' : 'app-shell'}>
      <header className="topbar">
        <button className="brand" onClick={() => pickGenre('all')}>
          <span className="brand-icon"><IoMusicalNotes /></span>
          MPlayer
        </button>
        <label className="search">
          <IoSearch />
          <input
            type="search"
            placeholder="Search songs, artists, films"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </header>

      <nav className="genre-bar" aria-label="Genres">
        <button className={filter === 'all' ? 'chip active' : 'chip'} onClick={() => pickGenre('all')}>Home</button>
        {Object.entries(CATEGORIES).map(([key, c]) => (
          <button key={key} className={filter === key ? 'chip active' : 'chip'} onClick={() => pickGenre(key)}>
            {c.emoji} {c.label}
          </button>
        ))}
      </nav>

      <main className="main">{content}</main>

      {nowOpen && currentAudio && (
        <div className="now" role="dialog" aria-modal="true" aria-label={`Now playing: ${currentAudio.name}`}>
          <div className="now-bg">
            {currentAudio.cover
              ? <img key={currentAudio.url} className="now-bg-img" src={currentAudio.cover} alt="" />
              : <CategoryScene category={currentAudio.category} playing={playing} analyserRef={analyserRef} />}
            <div className="now-shade" />
          </div>
          <button className="icon-btn now-close" onClick={() => setNowOpen(false)} aria-label="Close now playing" title="Close">
            <IoChevronDown />
          </button>
          <div className="now-body" key={currentAudio.url}>
            <div className={playing ? 'now-art playing' : 'now-art'}>
              <SongArt track={currentAudio} size="xl" />
            </div>
            <div className="now-meta">
              <span className="pill" style={{ '--pill': category.accent }}>{category.emoji} {category.label}</span>
              <h2>{currentAudio.name}</h2>
              <p>{currentAudio.artist || category.label}</p>
              <a href={currentAudio.url} download className="now-download">
                <IoDownloadOutline /> Download
              </a>
            </div>
          </div>
        </div>
      )}

      <footer className="playerbar">
        <button className="pb-track" onClick={() => setNowOpen(!nowOpen)} aria-label={nowOpen ? 'Close now playing' : 'Open now playing'}>
          {currentAudio && (
            <>
              <SongArt track={currentAudio} size="md" />
              <span className="pb-text">
                <strong>{currentAudio.name}</strong>
                <small>{currentAudio.artist || category.label}</small>
              </span>
              <span className="pb-expand">{nowOpen ? <IoChevronDown /> : <IoChevronUp />}</span>
            </>
          )}
        </button>

        <div className="pb-center">
          <div className="pb-controls">
            <button className={shuffle ? 'icon-btn on' : 'icon-btn'} onClick={() => setShuffle(!shuffle)} aria-label="Shuffle" title="Shuffle">
              <IoShuffle />
            </button>
            <button className="icon-btn" onClick={playPrev} aria-label="Previous" title="Previous"><IoPlaySkipBack /></button>
            <button className="play-btn" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
              {playing ? <IoPause /> : <IoPlay className="nudge" />}
            </button>
            <button className="icon-btn" onClick={playNext} aria-label="Next" title="Next"><IoPlaySkipForward /></button>
            <button
              className={repeat !== 'off' ? 'icon-btn on' : 'icon-btn'}
              onClick={() => setRepeat(repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off')}
              aria-label={`Repeat: ${repeat}`}
              title={`Repeat: ${repeat}`}
            >
              <IoRepeat />
              {repeat === 'one' && <span className="repeat-one">1</span>}
            </button>
          </div>
          <div className="pb-seek">
            <span>{formatTime(time)}</span>
            <input
              type="range"
              className="slider"
              min={0}
              max={duration || 0}
              step={0.1}
              value={time}
              style={{ '--fill': `${progress}%` }}
              onChange={(e) => {
                audioRef.current.currentTime = Number(e.target.value);
                setTime(Number(e.target.value));
              }}
              aria-label="Seek"
            />
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="pb-right">
          <button className="icon-btn" onClick={() => setMuted(!muted)} aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted || volume === 0 ? <IoVolumeMute /> : <IoVolumeHigh />}
          </button>
          <input
            type="range"
            className="slider volume"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            style={{ '--fill': `${(muted ? 0 : volume) * 100}%` }}
            onChange={(e) => { setVolume(Number(e.target.value)); setMuted(false); }}
            aria-label="Volume"
          />
        </div>

        <div className="pb-progress-mobile" style={{ width: `${progress}%` }} />

        <audio
          ref={audioRef}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={handleEnded}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onError={(e) => console.error('Audio loading error:', e)}
        />
      </footer>
    </div>
  );
};

export default MediaPlayer;
