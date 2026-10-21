import React, { useState, useRef, useEffect } from 'react';
import {
  IoPlay, IoPause, IoPlaySkipForward, IoPlaySkipBack, IoShuffle, IoRepeat,
  IoVolumeHigh, IoVolumeMute, IoSearch, IoDownloadOutline, IoMusicalNotes,
} from 'react-icons/io5';
import CategoryScene from './CategoryScene';
import { CATEGORIES, categorize } from '../categories';
import { parseTrack } from '../trackInfo';

// Function to import all audio files from the directory, tagging each with a category
const importAll = (r) => {
  let files = [];
  r.keys().forEach((item) => {
    const url = r(item);
    const title = item.replace('./', '').split('/').pop();
    files.push({ title, url, category: categorize(title), ...parseTrack(title) });
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

const Cover = ({ category, size = 'sm' }) => {
  const c = CATEGORIES[category];
  return (
    <div className={`cover cover-${size}`} style={{ background: c.art }} aria-hidden="true">
      <span>{c.emoji}</span>
    </div>
  );
};

// Animated bars shown next to the song that is playing
const Equalizer = ({ paused }) => (
  <span className={paused ? 'eq paused' : 'eq'} aria-hidden="true">
    <i /><i /><i />
  </span>
);

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
  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const autoplayRef = useRef(false);

  const q = query.trim().toLowerCase();
  const visibleTracks = audioFiles.filter(
    (a) => (filter === 'all' || a.category === filter)
      && (!q || `${a.name} ${a.artist} ${a.title}`.toLowerCase().includes(q)),
  );

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
    setCurrentAudio(track);
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
    else playTrack(shuffle ? visibleTracks[Math.floor(Math.random() * visibleTracks.length)] : visibleTracks[0]);
  };

  // Space bar toggles playback (unless typing in the search box)
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName)) {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('nexttrack', playNext);
    navigator.mediaSession.setActionHandler('previoustrack', playPrev);
  });

  const category = currentAudio ? CATEGORIES[currentAudio.category] : null;
  const view = filter === 'all'
    ? { label: 'All Songs', emoji: '🎵', art: 'linear-gradient(135deg, #8b5cf6, #ec4899 50%, #f59e0b)', tagline: 'Everything in your library' }
    : CATEGORIES[filter];
  const viewPlaying = playing && visibleTracks.some((a) => a.url === currentAudio?.url);
  const countFor = (key) => audioFiles.filter((a) => a.category === key).length;
  const progress = duration ? (time / duration) * 100 : 0;

  return (
    <div className="app-shell" style={{ '--accent': category?.accent || '#8b5cf6' }}>
      <CategoryScene category={currentAudio?.category} playing={playing} analyserRef={analyserRef} />
      <div className="scrim" />

      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon"><IoMusicalNotes /></span>
          MPlayer
        </div>
        <p className="nav-heading">Your library</p>
        <nav className="nav">
          <button className={filter === 'all' ? 'nav-item active' : 'nav-item'} onClick={() => setFilter('all')}>
            <span className="nav-cover" style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }}>🎵</span>
            <span className="nav-text">
              <strong>All Songs</strong>
              <small>{audioFiles.length} songs</small>
            </span>
          </button>
          {Object.entries(CATEGORIES).map(([key, c]) => (
            <button key={key} className={filter === key ? 'nav-item active' : 'nav-item'} onClick={() => setFilter(key)}>
              <span className="nav-cover" style={{ background: c.art }}>{c.emoji}</span>
              <span className="nav-text">
                <strong>{c.label}</strong>
                <small>{countFor(key)} songs</small>
              </span>
              {playing && currentAudio?.category === key && <Equalizer />}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main">
        <div className="topbar">
          <label className="search">
            <IoSearch />
            <input
              type="search"
              placeholder="Search songs, artists, films"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>

        <div className="chips">
          <button className={filter === 'all' ? 'chip active' : 'chip'} onClick={() => setFilter('all')}>All</button>
          {Object.entries(CATEGORIES).map(([key, c]) => (
            <button key={key} className={filter === key ? 'chip active' : 'chip'} onClick={() => setFilter(key)}>
              {c.emoji} {c.label}
            </button>
          ))}
        </div>

        <header className="hero">
          <div className="cover cover-lg" style={{ background: view.art }} aria-hidden="true">
            <span>{view.emoji}</span>
          </div>
          <div className="hero-text">
            <span className="eyebrow">Playlist</span>
            <h1>{view.label}</h1>
            <p>{view.tagline} · {visibleTracks.length} songs</p>
          </div>
        </header>

        <div className="actions">
          <button className="play-big" onClick={playView} aria-label={viewPlaying ? 'Pause' : 'Play'} disabled={!visibleTracks.length}>
            {viewPlaying ? <IoPause /> : <IoPlay className="nudge" />}
          </button>
          <button className={shuffle ? 'icon-btn on' : 'icon-btn'} onClick={() => setShuffle(!shuffle)} aria-label="Shuffle" title="Shuffle">
            <IoShuffle />
          </button>
        </div>

        <div className="tracklist" role="list">
          <div className="track-head">
            <span>#</span>
            <span>Title</span>
            <span className="col-cat">Mood</span>
            <span />
          </div>
          {visibleTracks.length === 0 && <p className="empty">No songs match “{query}”.</p>}
          {visibleTracks.map((audio, index) => {
            const isCurrent = currentAudio?.url === audio.url;
            const c = CATEGORIES[audio.category];
            return (
              <div
                key={audio.url}
                role="listitem"
                className={isCurrent ? 'track current' : 'track'}
                onDoubleClick={() => playTrack(audio)}
              >
                <button className="track-num" onClick={() => playTrack(audio)} aria-label={`Play ${audio.name}`}>
                  {isCurrent ? <Equalizer paused={!playing} /> : <span className="num">{index + 1}</span>}
                  <span className="hover-icon">{isCurrent && playing ? <IoPause /> : <IoPlay />}</span>
                </button>
                <button className="track-main" onClick={() => playTrack(audio)}>
                  <Cover category={audio.category} />
                  <span className="track-text">
                    <span className="track-name">{audio.name}</span>
                    <span className="track-artist">{audio.artist || c.label}</span>
                  </span>
                </button>
                <span className="col-cat">
                  <span className="pill" style={{ '--pill': c.accent }}>{c.emoji} {c.label}</span>
                </span>
                <a href={audio.url} download className="download" aria-label={`Download ${audio.name}`} title="Download">
                  <IoDownloadOutline />
                </a>
              </div>
            );
          })}
        </div>
      </main>

      <footer className="playerbar">
        <div className="pb-track">
          {currentAudio && (
            <>
              <Cover category={currentAudio.category} size="md" />
              <div className="pb-text">
                <strong>{currentAudio.name}</strong>
                <small>{currentAudio.artist || category.label}</small>
              </div>
            </>
          )}
        </div>

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
          {category && <span className="pill" style={{ '--pill': category.accent }}>{category.emoji} {category.label}</span>}
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
