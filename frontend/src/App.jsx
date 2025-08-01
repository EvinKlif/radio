import React, { useState } from 'react';
import Orb from './components/Orb';
import TrackUpdater from './components/TrackUpdater';
import WelcomePage from './components/WelcomePage';
import AudioVisualizer from './components/AudioVisualizer';
import RadioPlayer from './components/RadioPlayer';
import './styles/App.css';


function App() {
  const [showWelcome, setShowWelcome] = useState(true);

  return (
    <div className="my-background" style={{ position: 'relative' }}>
      <TrackUpdater>
        {(trackInfo) => (
          <RadioPlayer>
            {({ playStream }) => (
              <AudioVisualizer
                playStream={playStream}
                albumCover={
                    trackInfo?.cover_url 
                      ? `${import.meta.env.VITE_MINIO_URL}/image/${trackInfo.cover_url}`
                      : "default.jpg"
                  }
                artistName={trackInfo?.artist || "Unknown Artist"}
                trackName={trackInfo?.title || "Unknown Track"}
              />
            )}
          </RadioPlayer>
        )}
      </TrackUpdater>
      <Orb />
      {showWelcome && <WelcomePage onClose={() => setShowWelcome(false)} />}
      
    </div>
  );
}
export default App;

