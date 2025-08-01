import { useState, useEffect } from 'react';

const TrackUpdater = ({ children }) => {
  const [trackInfo, setTrackInfo] = useState(null);

  useEffect(() => {
    const eventSource = new EventSource(`${import.meta.env.VITE_API_BASE_URL}/track-updates`);

    const fetchTrackInfo = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/track-info/`);
        const data = await response.json();
        setTrackInfo(data);
      } catch (error) {
        console.error('Error fetching track info:', error);
      }
    };

    eventSource.onmessage = fetchTrackInfo;
    fetchTrackInfo(); 

    return () => eventSource.close();
  }, []);

  return children(trackInfo); 
};

export default TrackUpdater;