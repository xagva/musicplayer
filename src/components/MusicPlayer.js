import React, { useState, useRef, useEffect } from 'react';

// Function to import all audio files from the directory (supports .mp3 and .m4a)
const importAll = (r) => {
  let files = [];
  r.keys().forEach((item) => {
    const url = r(item);
    const title = item.replace('./', '').split('/').pop();
    files.push({ title, url });
    console.log(`Loaded file: ${title}, URL: ${url}`); // Debugging: log each loaded file
  });
  return files;
};

// Import audio files from the 'src/audio' directory
const audioFiles = importAll(require.context('../audio', false, /\.(mp3|m4a)$/));

const MediaPlayer = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudio, setCurrentAudio] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    // Check if audio files were correctly imported
    console.log('Audio files:', audioFiles);

    // Automatically select and play the first audio file if available
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

  
  const handleAudioChange = (audio) => {
    console.log(`Changing audio to: ${audio.title}`);
    setCurrentAudio(audio);
    setIsPlaying(true); // Auto-play the newly selected audio file
  };

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center'  }}>
      <div style={{ marginBottom: '20px', width: '100%', maxWidth: '600px' }}>
        <h2 style={{ color: 'blue' }}>Now Playing </h2>
        {currentAudio ? (
          <>
            <h3 style={{ color: 'red' }}>{currentAudio.title}</h3 >
            <audio
              ref={audioRef}
              controls
              style={{ marginTop: '10px' }}
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
      <div style={{ width: '100%', maxWidth: '600px' }}>
        <h3>Play List</h3>
        <div style={{ mmarginTop: '10px', maxHeight: '600px', overflowY: 'auto'}}>
          {audioFiles.map((audio, index) => (
            <button
              key={index}
              onClick={() => handleAudioChange(audio)}
              style={{
                display: 'block',
                margin: '5px',
                padding: '10px',
                backgroundColor: currentAudio?.url === audio.url ? 'lightblue' : 'white',
              }}
            >
              {audio.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MediaPlayer;
