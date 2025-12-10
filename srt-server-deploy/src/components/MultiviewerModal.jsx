import React, { useEffect, useRef, useState } from 'react';
import './MultiviewerModal.css';

function MultiviewerModal({ isOpen, onClose, channels, audioLevels }) {
  const [hlsLoaded, setHlsLoaded] = useState({});
  const [errors, setErrors] = useState({});
  const videoRefs = useRef({});
  const hlsInstances = useRef({});

  const activeChannels = channels.filter(ch => ch.status === 'receiving' || ch.status === 'waiting');
  const channelCount = channels.length;

  const getGridClass = () => {
    if (channelCount <= 4) return 'grid-2x2';
    if (channelCount <= 8) return 'grid-4x2';
    if (channelCount <= 12) return 'grid-4x3';
    return 'grid-4x4';
  };

  useEffect(() => {
    if (!isOpen) {
      Object.values(hlsInstances.current).forEach(hls => {
        if (hls) hls.destroy();
      });
      hlsInstances.current = {};
      setHlsLoaded({});
      setErrors({});
      return;
    }

    const loadHls = async () => {
      if (typeof window !== 'undefined' && !window.Hls) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
        script.async = true;
        script.onload = () => initializePlayers();
        document.head.appendChild(script);
      } else {
        initializePlayers();
      }
    };

    loadHls();

    return () => {
      Object.values(hlsInstances.current).forEach(hls => {
        if (hls) hls.destroy();
      });
      hlsInstances.current = {};
    };
  }, [isOpen, channels]);

  const initializePlayers = () => {
    channels.forEach(channel => {
      if (channel.status === 'receiving') {
        initializePlayer(channel.id);
      }
    });
  };

  const initializePlayer = (channelId) => {
    const video = videoRefs.current[channelId];
    if (!video || !window.Hls) return;

    if (hlsInstances.current[channelId]) {
      hlsInstances.current[channelId].destroy();
    }

    const hlsUrl = `/hls/${channelId}/stream.m3u8`;

    if (window.Hls.isSupported()) {
      const hls = new window.Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 0,
        maxBufferLength: 2,
        maxMaxBufferLength: 4,
        liveSyncDurationCount: 1,
        liveMaxLatencyDurationCount: 3,
        liveDurationInfinity: true,
      });

      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      
      hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
        setHlsLoaded(prev => ({ ...prev, [channelId]: true }));
        setErrors(prev => ({ ...prev, [channelId]: null }));
      });

      hls.on(window.Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          setErrors(prev => ({ ...prev, [channelId]: 'Stream error' }));
          setHlsLoaded(prev => ({ ...prev, [channelId]: false }));
          setTimeout(() => {
            if (hlsInstances.current[channelId]) {
              hls.loadSource(hlsUrl);
            }
          }, 3000);
        }
      });

      hlsInstances.current[channelId] = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(() => {});
        setHlsLoaded(prev => ({ ...prev, [channelId]: true }));
      });
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    channels.forEach(channel => {
      if (channel.status === 'receiving' && !hlsInstances.current[channel.id] && !hlsLoaded[channel.id]) {
        setTimeout(() => initializePlayer(channel.id), 2000);
      } else if (channel.status !== 'receiving' && hlsInstances.current[channel.id]) {
        hlsInstances.current[channel.id].destroy();
        delete hlsInstances.current[channel.id];
        setHlsLoaded(prev => ({ ...prev, [channel.id]: false }));
      }
    });
  }, [channels, isOpen]);

  const getAudioLevel = (channelId, side) => {
    const levels = audioLevels[channelId];
    if (!levels) return 0;
    return side === 'L' ? levels.levelL : levels.levelR;
  };

  const getLevelColor = (level) => {
    if (level > 90) return '#ef4444';
    if (level > 75) return '#f59e0b';
    return '#22c55e';
  };

  if (!isOpen) return null;

  return (
    <div className="multiviewer-overlay" onClick={onClose}>
      <div className="multiviewer-modal" onClick={e => e.stopPropagation()}>
        <div className="multiviewer-header">
          <h2>Multiviewer</h2>
          <div className="multiviewer-info">
            {activeChannels.filter(c => c.status === 'receiving').length} / {channelCount} receiving
          </div>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        
        <div className={`multiviewer-grid ${getGridClass()}`}>
          {channels.map(channel => (
            <div 
              key={channel.id} 
              className={`multiviewer-cell ${channel.status}`}
            >
              <div className="video-container">
                {channel.status === 'receiving' ? (
                  <>
                    <video
                      ref={el => videoRefs.current[channel.id] = el}
                      autoPlay
                      muted
                      playsInline
                      className={hlsLoaded[channel.id] ? 'loaded' : ''}
                    />
                    {!hlsLoaded[channel.id] && !errors[channel.id] && (
                      <div className="loading-overlay">
                        <div className="spinner"></div>
                        <span>Loading stream...</span>
                      </div>
                    )}
                    {errors[channel.id] && (
                      <div className="error-overlay">
                        <span>{errors[channel.id]}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="no-video">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="2" y="4" width="20" height="16" rx="2"/>
                      <path d="M2 4l20 16M22 4L2 20"/>
                    </svg>
                    <span>
                      {channel.status === 'waiting' ? 'Waiting for signal...' : 'No Video'}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="channel-overlay">
                <div className="channel-label">
                  <span className={`status-dot ${channel.status}`}></span>
                  <span className="channel-number">{channel.channelNumber}</span>
                  <span className="channel-title">{channel.title}</span>
                </div>
                
                {channel.status === 'receiving' && (
                  <div className="audio-meters">
                    <div className="meter-container">
                      <div className="meter-label">L</div>
                      <div className="meter-bar">
                        <div 
                          className="meter-fill"
                          style={{ 
                            height: `${getAudioLevel(channel.id, 'L')}%`,
                            backgroundColor: getLevelColor(getAudioLevel(channel.id, 'L'))
                          }}
                        />
                      </div>
                    </div>
                    <div className="meter-container">
                      <div className="meter-label">R</div>
                      <div className="meter-bar">
                        <div 
                          className="meter-fill"
                          style={{ 
                            height: `${getAudioLevel(channel.id, 'R')}%`,
                            backgroundColor: getLevelColor(getAudioLevel(channel.id, 'R'))
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {channel.status === 'receiving' && channel.embeddedTimecode && (
                <div className="timecode-overlay">
                  {channel.embeddedTimecode}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MultiviewerModal;
