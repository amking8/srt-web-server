import React from 'react';
import './StreamCard.css';

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function StreamCard({ stream, onStart, onStop, onEdit, onDelete }) {
  const isRunning = stream.status === 'running';
  const isWaiting = stream.status === 'waiting';
  const isStarting = stream.status === 'starting';
  const isActive = isRunning || isWaiting || isStarting;
  const hasError = stream.status === 'error';

  return (
    <div className={`stream-card ${isRunning ? 'running' : ''} ${isWaiting ? 'waiting' : ''} ${hasError ? 'error' : ''}`}>
      <div className="stream-header">
        <div className="stream-status">
          <span className={`status-indicator ${stream.status}`}></span>
          <span className="stream-name">{stream.name}</span>
        </div>
        <div className="stream-actions">
          {isActive ? (
            <button className="btn-icon stop" onClick={onStop} title="Stop">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="3" y="3" width="10" height="10" rx="1"/>
              </svg>
            </button>
          ) : (
            <button className="btn-icon start" onClick={onStart} title="Start">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <polygon points="4,2 14,8 4,14"/>
              </svg>
            </button>
          )}
          <button className="btn-icon edit" onClick={onEdit} title="Edit">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5z"/>
            </svg>
          </button>
          <button className="btn-icon delete" onClick={onDelete} title="Delete">
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
      </div>

      {isActive && (
        <div className="stream-stats">
          <div className="stat">
            <span className="stat-label">Clients</span>
            <span className="stat-value">{stream.connectedClients}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Received</span>
            <span className="stat-value">{formatBytes(stream.bytesReceived)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Sent</span>
            <span className="stat-value">{formatBytes(stream.bytesSent)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Bitrate</span>
            <span className="stat-value">{stream.bitrate} Kbps</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default StreamCard;
