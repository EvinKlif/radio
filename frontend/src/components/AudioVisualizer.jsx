import React, { useEffect, useRef, useState } from "react";
import "../styles/AudioVisualizer.css";

const AudioVisualizer = ({ playStream, albumCover, artistName, trackName }) => {
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const contextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationRef = useRef(null);
  const barHeightsRef = useRef([]);
  const gainNodeRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(10);
  const [isHovered, setIsHovered] = useState(false);

  const BAR_COUNT = 60;
  const MAX_FREQ_KHZ = 15;
  const SMOOTHING = 0.85;
  const fftSize = 2048;
  const sampleRate = 44100;

  // Добавляем @keyframes в DOM
  useEffect(() => {
    const styleTag = document.createElement('style');
    styleTag.innerHTML = `
      @keyframes glowing {
        0% { background-position: 0 0; }
        50% { background-position: 400% 0; }
        100% { background-position: 0 0; }
      }
    `;
    document.head.appendChild(styleTag);

    return () => document.head.removeChild(styleTag);
  }, []);

  // Функция для адаптивного размера canvas
  const updateCanvasSize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = canvas.parentElement;
    const containerWidth = container.offsetWidth;
    const maxWidth = Math.min(containerWidth * 0.9, 800);
    const height = Math.max(maxWidth * 0.25, 150);

    canvas.width = maxWidth;
    canvas.height = height;
    canvas.style.width = `${maxWidth}px`;
    canvas.style.height = `${height}px`;
  };

  useEffect(() => {
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  const startAudio = async () => {
    if (!playStream) return;
    
    await stopAudio();
    await new Promise(resolve => setTimeout(resolve, 100));

    const context = new (window.AudioContext || window.webkitAudioContext)();
    
    if (context.state === 'suspended') {
      await context.resume();
    }
    
    const analyser = context.createAnalyser();
    analyser.fftSize = fftSize;
    analyser.smoothingTimeConstant = 0;

    const source = context.createMediaStreamSource(playStream);
    const gainNode = context.createGain();
    gainNode.gain.value = volume / 20;

    source.connect(gainNode);
    gainNode.connect(analyser);

    const audioElement = document.createElement('audio');
    audioElement.srcObject = playStream;
    audioElement.volume = volume / 20;
    audioElement.autoplay = true;
    audioElement.muted = false;
    
    try {
      await audioElement.play();
    } catch (error) {
      console.error('Audio play error:', error);
    }

    analyserRef.current = analyser;
    contextRef.current = context;
    sourceRef.current = source;
    gainNodeRef.current = gainNode;
    audioRef.current = audioElement;

    barHeightsRef.current = new Array(BAR_COUNT).fill(0);
    draw();
    setIsPlaying(true);
  };

  const stopAudio = async () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
      audioRef.current.remove();
    }
    
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch (e) {}
    }
    
    if (gainNodeRef.current) {
      try {
        gainNodeRef.current.disconnect();
      } catch (e) {}
    }
    
    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch (e) {}
    }
    
    if (contextRef.current) {
      try {
        await contextRef.current.suspend();
        await contextRef.current.close();
      } catch (e) {}
    }

    audioRef.current = null;
    analyserRef.current = null;
    contextRef.current = null;
    sourceRef.current = null;
    gainNodeRef.current = null;
    setIsPlaying(false);
  };

  const handleVolumeChange = (newVolume) => {
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume / 20;
    }
  };

  const interpolate = (prev, next, alpha) => prev * alpha + next * (1 - alpha);

  const draw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser ? analyser.frequencyBinCount : 0);
    const nyquist = sampleRate / 2;
    const freqStep = nyquist / (analyser ? analyser.frequencyBinCount : 1);
    const maxFreqIndex = Math.floor(MAX_FREQ_KHZ * 1000 / freqStep);
    const step = Math.max(1, Math.floor(maxFreqIndex / BAR_COUNT));
        
    let time = 0;

    const render = () => {
      animationRef.current = requestAnimationFrame(render);
      time += 0.05;
            
      const width = canvas.width;
      const height = canvas.height;
            
      ctx.clearRect(0, 0, width, height);

      if (analyser && contextRef.current && contextRef.current.state === 'running') {
        analyser.getByteFrequencyData(dataArray);
      }

      const totalBarWidth = width * 0.8;
      const startX = (width - totalBarWidth) / 2;
      const barWidth = Math.max(2, width / BAR_COUNT / 20);
      const barSpacing = totalBarWidth / BAR_COUNT;

      for (let i = 0; i < BAR_COUNT; i++) {
        let amplitude;
                
        if (analyser && contextRef.current && contextRef.current.state === 'running') {
          const index = i * step;
          const raw = dataArray[index] || 0;
          const targetHeight = (raw / 255) * height * 0.8;
          barHeightsRef.current[i] = interpolate(barHeightsRef.current[i], targetHeight, SMOOTHING);
          amplitude = barHeightsRef.current[i];
        } else {
          const baseWave = Math.sin(time * 2 + i * 0.3) * 0.3;
          const detailWave = Math.sin(time * 4 + i * 0.1) * 0.2;
          const microWave = Math.sin(time * 6 + i * 0.05) * 0.1;
                    
          const pattern = (baseWave + detailWave + microWave + 1) / 2;
          amplitude = pattern * height * 0.6 + height * 0.1;
        }

        const x = startX + i * barSpacing - barWidth / 2;
        const barHeight = Math.max(amplitude, height * 0.05);
                
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                
        const barY = height - barHeight;
        const radius = barWidth / 2;
                
        ctx.beginPath();
        ctx.roundRect(x, barY, barWidth, barHeight, radius);
        ctx.fill();
                
        ctx.shadowColor = 'rgba(255, 255, 255, 0.91)';
        ctx.shadowBlur = 2;
        ctx.beginPath();
        ctx.roundRect(x, barY, barWidth, barHeight, radius);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      const dotRadius = Math.max(1, width / 400);
      const dotY = height - height * 0.05;
            
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(startX - 15 - i * 8, dotY, dotRadius, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fill();
      }
            
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(startX + totalBarWidth + 15 + i * 8, dotY, dotRadius, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fill();
      }
    };

    render();
  };

  useEffect(() => {
    draw();
    return () => stopAudio();
  }, []);

  const getBarColor = (index) => {
    const baseHue = 120;
    const hue = Math.max(baseHue - (index / 20) * 120, 0);
    return `hsl(${hue}, 100%, 50%)`;
  };

  const handleVolumeClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const barWidth = rect.width / 20;
    const newVolume = Math.min(20, Math.max(0, Math.floor(clickX / barWidth) + 1));
    handleVolumeChange(newVolume);
  };

  return (
    <div className="audio-visualizer-container">
      {/* Обложка альбома */}
      <div class="album-container">
      <div className="album-cover">
        {albumCover ? (
          <img src={albumCover} alt="Album cover" className="album-image" />
        ) : (
          <div className="album-placeholder">
            <div className="music-icon">♪</div>
          </div>
        )}
      </div>

      {/* Информация о треке */}
      <div className="track-info">
        <div className="artist-name">{artistName || "Unknown Artist"}</div>
        <div className="track-name">{trackName || "Unknown Track"}</div>
      </div>
      </div>

      {/* Аудиовизуализатор */}
      <canvas
        ref={canvasRef}
        className="visualizer-canvas"
      />
            
      {/* Контроль громкости */}
      <div className="volume-control-container">
        <div 
          className="volume-bars"
          onClick={handleVolumeClick}
        >
          {Array.from({ length: 20 }, (_, index) => (
            <div
              key={index}
              className={`volume-bar ${index < volume ? "active" : ""}`}
              style={{
                backgroundColor: index < volume ? getBarColor(index) : "#ccc",
              }}
            />
          ))}
        </div>
      </div>
            
      {/* Кнопка Play/Stop */}
      <button
        className={`play-button ${isPlaying ? 'playing' : ''} ${isHovered ? 'hovered' : ''}`}
        onClick={isPlaying ? stopAudio : startAudio}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {isPlaying ? "Stop" : "Play"}
        <div className="button-background"></div>
        <div className="button-glow"></div>
      </button>
    </div>
  );
};

export default AudioVisualizer;