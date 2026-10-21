import React, { useState, useRef, useEffect } from 'react';
import { FaDownload } from 'react-icons/fa';
import CategoryScene from './CategoryScene';
import { CATEGORIES, categorize } from '../categories';

// Function to import all audio files from the directory, tagging each with a category
const importAll = (r) => {
  let files = [];
  r.keys().forEach((item) => {
    const url = r(item);
    const title = item.replace('./', '').split('/').pop();
    files.push({ title, url, category: categorize(title) });
  });
  return files;
};

// Import audio files from the 'src/audio' directory
const audioFiles = importAll(require.context('../audio', false, /\.(mp3|m4a|aac|mp4)$/i));

const MediaPlayer = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudio, setCurrentAudio] = useState(null);
  // Tracks the element's real play state (native controls included) for the animation
  const [playing, setPlaying] = useState(false);
  const [filter, setFilter] = useState('all');
  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);

  const visibleTracks = filter === 'all' ? audioFiles : audioFiles.filter((a) => a.category === filter);

  useEffect(() => {
    // Automatically select the first audio file if available
    if (audioFiles.length > 0) {
      setCurrentAudio(audioFiles[0]);
    } else {
      console.error('No audio files found!');
    }
  }, []);

  useEffect(() => {
    if (currentAudio && audioRef.current) {
      audioRef.current.src = currentAudio.url;
      if (isPlaying) {
        audioRef.current.play().catch((error) => {
          console.error('Playback error:', error);
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [currentAudio, isPlaying]);

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

  const handleAudioChange = (audio) => {
    setCurrentAudio(audio);
    setIsPlaying(true); // Auto-play the newly selected audio file
  };

  const playNext = () => {
    const list = visibleTracks.some((a) => a.url === currentAudio?.url) ? visibleTracks : audioFiles;
    const index = list.findIndex((a) => a.url === currentAudio?.url);
    handleAudioChange(list[(index + 1) % list.length]);
  };

  const category = CATEGORIES[currentAudio?.category];

  return (
    <>
      <CategoryScene category={currentAudio?.category} playing={playing} analyserRef={analyserRef} />
      <div className="player">
        <div className="panel now-playing" style={{ '--accent': category?.accent }}>
          <h2>Now Playing</h2>
          {currentAudio ? (
            <>
              <span className="badge">{category.emoji} {category.label}</span>
              <h3>{currentAudio.title}</h3>
              <audio
                ref={audioRef}
                controls
                onPlay={() => { connectAnalyser(); setPlaying(true); }}
                onPause={() => setPlaying(false)}
                onEnded={playNext}
                onError={(e) => console.error('Audio loading error:', e)}
              >
                <source src={currentAudio.url} type={`audio/${currentAudio.url.split('.').pop()}`} />
                Your browser does not support the audio element.
              </audio>
            </>
          ) : (
            <p>No audio file selected</p>
          )}
        </div>
        <div className="panel">
          <div className="chips">
            <button className={filter === 'all' ? 'chip active' : 'chip'} onClick={() => setFilter('all')}>
              🎵 All ({audioFiles.length})
            </button>
            {Object.entries(CATEGORIES).map(([key, c]) => (
              <button
                key={key}
                className={filter === key ? 'chip active' : 'chip'}
                style={{ '--accent': c.accent }}
                onClick={() => setFilter(key)}
              >
                {c.emoji} {c.label} ({audioFiles.filter((a) => a.category === key).length})
              </button>
            ))}
          </div>
          <div className="tracks">
            {visibleTracks.map((audio) => (
              <div key={audio.url} className="track">
                <button
                  className={currentAudio?.url === audio.url ? 'track-btn active' : 'track-btn'}
                  style={{ '--accent': CATEGORIES[audio.category].accent }}
                  onClick={() => handleAudioChange(audio)}
                >
                  <span className="track-emoji">{CATEGORIES[audio.category].emoji}</span>
                  {audio.title}
                </button>
                <a href={audio.url} download className="download" aria-label={`Download ${audio.title}`}>
                  <FaDownload size={16} />
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default MediaPlayer;
