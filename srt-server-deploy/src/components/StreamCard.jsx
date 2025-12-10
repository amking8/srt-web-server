import React, { useState } from 'react';
import './StreamCard.css';

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

function StreamCard({ stream, onStart, onStop, onEdit, onDelete, onDisconnect, onResetBuffer, onRecord, onStopRecord }) {
  const [showRecordOptions, setShowRecordOptions] = useState(false);
  const isRunning = stream.status === 'running';
  const isWaiting = stream.status === 'waiting';
  const isStarting = stream.status === 'starting';
  const isActive = isRunning || isWaiting || isStarting;
  const hasError = stream.status === 'error';

  const handleRecordClick = (format) => {
    setShowRecordOptions(false);
    onRecord(format);
  };

  return (
    <div className={`stream-card ${isRunning ? 'running' : ''} ${isWaiting ? 'waiting' : ''} ${hasError ? 'error' : ''} ${stream.isRecording ? 'recording' : ''}`}>
      <div className="stream-header">
        <div className="stream-status">
          <span className={`status-indicator ${stream.status}`}></span>
          <span className="stream-name">{stream.name}</span>
          {stream.isRecording && <span className="recording-badge">REC</span>}
        </div>
        <div className="stream-actions">
          {isActive ? (
            <>
              <button className="btn-icon stop" onClick={onStop} title="Stop">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="3" y="3" width="10" height="10" rx="1"/>
                </svg>
              </button>
              {isRunning && (
                <>
                  <button className="btn-icon disconnect" onClick={onDisconnect} title="Disconnect">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M2 2L14 14M8 4V2M8 14v-2M4 8H2M14 8h-2"/>
                    </svg>
                  </button>
                  <button className="btn-icon reset" onClick={onResetBuffer} title="Reset Buffer">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M2 8a6 6 0 1 1 1 3.5M2 14v-3h3"/>
                    </svg>
                  </button>
                  {stream.isRecording ? (
                    <button className="btn-icon record-stop" onClick={onStopRecord} title="Stop Recording">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <rect x="4" y="4" width="8" height="8" rx="1"/>
                      </svg>
                    </button>
                  ) : (
                    <div className="record-dropdown">
                      <button className="btn-icon record" onClick={() => setShowRecordOptions(!showRecordOptions)} title="Start Recording">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                          <circle cx="8" cy="8" r="5"/>
                        </svg>
                      </button>
                      {showRecordOptions && (
                        <div className="record-options">
                          <button onClick={() => handleRecordClick('ts')}>TS</button>
                          <button onClick={() => handleRecordClick('mp4')}>MP4</button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <button className="btn-icon start" onClick={onStart} title="Start">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <polygon points="4,2 14,8 4,14"/>
              </svg>
            </button>
          )}
          <button className="btn-icon edit" onClick={onEdit} title="Edit" disabled={isActive}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5z"/>
            </svg>
          </button>
          <button className="btn-icon delete" onClick={onDelete} title="Delete" disabled={isActive}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="stream-details">
        <div className="detail-row">
          <span className="detail-label">SRT Port:</span>
          <span className="detail-value">{stream.srtPort}</span>
        </div>
        {stream.streamId && (
          <div className="detail-row">
            <span className="detail-label">Stream ID:</span>
            <span className="detail-value mono">{stream.streamId}</span>
          </div>
        )}
        {stream.multicastAddress && (
          <div className="detail-row">
            <span className="detail-label">Multicast:</span>
            <span className="detail-value mono">{stream.multicastAddress}:{stream.multicastPort}</span>
          </div>
        )}
        <div className="detail-row">
          <span className="detail-label">Latency:</span>
          <span className="detail-value">{stream.latency} ms</span>
        </div>
        {stream.encoderIp && (
          <div className="detail-row">
            <span className="detail-label">Encoder IP:</span>
            <span className="detail-value mono">{stream.encoderIp}</span>
          </div>
        )}
      </div>

      {isActive && (
        <div className="stream-stats">
          <div className="stats-row primary">
            <div className="stat">
              <span className="stat-label">Uptime</span>
              <span className="stat-value">{formatUptime(stream.uptime)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Bitrate</span>
              <span className="stat-value">{stream.bitrate} Kbps</span>
            </div>
            <div className="stat">
              <span className="stat-label">FPS</span>
              <span className="stat-value">{stream.fps?.toFixed(1) || '0.0'}</span>
            </div>
          </div>
          <div className="stats-row secondary">
            <div className="stat">
              <span className="stat-label">Received</span>
              <span className="stat-value">{formatBytes(stream.bytesReceived)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Sent</span>
              <span className="stat-value">{formatBytes(stream.bytesSent)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Clients</span>
              <span className="stat-value">{stream.connectedClients}</span>
            </div>
          </div>
          <div className="stats-row tertiary">
            <div className="stat loss">
              <span className="stat-label">Lost</span>
              <span className="stat-value">{stream.packetsLost || 0}</span>
            </div>
            <div className="stat drops">
              <span className="stat-label">Dropped</span>
              <span className="stat-value">{stream.packetsDropped || 0}</span>
            </div>
            <div className="stat rtt">
              <span className="stat-label">RTT</span>
              <span className="stat-value">{stream.rtt || 0} ms</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StreamCard;
