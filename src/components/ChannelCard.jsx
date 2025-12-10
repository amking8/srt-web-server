import React, { useState } from 'react';
import './ChannelCard.css';

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatUptime(seconds) {
  if (!seconds) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function ChannelCard({ channel, onEdit, onDisconnect, onResetBuffer, onRecord, onStopRecord }) {
  const [showMenu, setShowMenu] = useState(false);

  const getStatusClass = () => {
    if (channel.status === 'receiving') return 'status-receiving';
    if (channel.status === 'waiting') return 'status-waiting';
    return 'status-stopped';
  };

  const getStatusIndicator = () => {
    if (channel.status === 'receiving') return 'green';
    if (channel.status === 'waiting') return 'yellow';
    return 'gray';
  };

  return (
    <div className={`channel-card ${getStatusClass()}`}>
      <div className="channel-header">
        <div className="channel-number">
          <span className={`status-dot ${getStatusIndicator()}`}></span>
          <span className="number">{channel.number}</span>
        </div>
        <div className="channel-title">
          <span className="name">{channel.name}</span>
          <span className="stream-id">{channel.streamId}</span>
        </div>
        <button 
          className="menu-btn"
          onClick={() => setShowMenu(!showMenu)}
        >
          ⋮
        </button>
        
        {showMenu && (
          <div className="channel-menu">
            <button onClick={() => { onEdit(channel); setShowMenu(false); }}>
              Configure
            </button>
            {channel.status === 'receiving' && (
              <>
                <button onClick={() => { onDisconnect(channel.id); setShowMenu(false); }}>
                  Disconnect
                </button>
                <button onClick={() => { onResetBuffer(channel.id); setShowMenu(false); }}>
                  Reset Buffer
                </button>
                {!channel.isRecording ? (
                  <button onClick={() => { onRecord(channel.id, 'ts'); setShowMenu(false); }}>
                    Start Recording
                  </button>
                ) : (
                  <button onClick={() => { onStopRecord(channel.id); setShowMenu(false); }}>
                    Stop Recording
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="channel-status">
        {channel.status === 'receiving' ? (
          <div className="status-info">
            <div className="stat-row">
              <span className="label">Bitrate:</span>
              <span className="value">{channel.bitrate} Kbps</span>
            </div>
            <div className="stat-row">
              <span className="label">FPS:</span>
              <span className="value">{channel.fps.toFixed(1)}</span>
            </div>
            <div className="stat-row">
              <span className="label">Uptime:</span>
              <span className="value">{formatUptime(channel.uptime)}</span>
            </div>
            <div className="stat-row">
              <span className="label">Data:</span>
              <span className="value">{formatBytes(channel.bytesReceived)}</span>
            </div>
            {channel.encoderIp && (
              <div className="stat-row encoder-ip">
                <span className="label">Source:</span>
                <span className="value">{channel.encoderIp}</span>
              </div>
            )}
            {channel.isRecording && (
              <div className="recording-indicator">
                <span className="rec-dot"></span> REC
              </div>
            )}
          </div>
        ) : channel.status === 'waiting' ? (
          <div className="waiting-status">
            <span className="waiting-text">Waiting for connection...</span>
            <span className="srt-port">SRT Port: {channel.srtPort}</span>
            <span className="multicast-out">→ {channel.multicastAddress}:{channel.multicastPort}</span>
          </div>
        ) : (
          <div className="stopped-status">
            <span className="stopped-text">Channel stopped</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChannelCard;
