import React from 'react';
import './StatsPanel.css';

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatBitrate(kbps) {
  if (kbps >= 1000) {
    return (kbps / 1000).toFixed(2) + ' Mbps';
  }
  return kbps + ' Kbps';
}

function StatsPanel({ stats }) {
  return (
    <div className="stats-panel">
      <div className="stat-card">
        <div className="stat-icon channels">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
        </div>
        <div className="stat-info">
          <span className="stat-value">{stats.totalChannels || 16}</span>
          <span className="stat-label">Total Channels</span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon receiving">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <polygon points="10,8 16,12 10,16" fill="currentColor"/>
          </svg>
        </div>
        <div className="stat-info">
          <span className="stat-value">{stats.receivingChannels || 0}</span>
          <span className="stat-label">Receiving</span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon waiting">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
          </svg>
        </div>
        <div className="stat-info">
          <span className="stat-value">{stats.waitingChannels || 0}</span>
          <span className="stat-label">Waiting</span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon received">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7,10 12,15 17,10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </div>
        <div className="stat-info">
          <span className="stat-value">{formatBytes(stats.totalBytesReceived || 0)}</span>
          <span className="stat-label">Data Received</span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon sent">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17,8 12,3 7,8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <div className="stat-info">
          <span className="stat-value">{formatBytes(stats.totalBytesSent || 0)}</span>
          <span className="stat-label">Data Sent</span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon bitrate">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
          </svg>
        </div>
        <div className="stat-info">
          <span className="stat-value">{formatBitrate(stats.totalBitrate || 0)}</span>
          <span className="stat-label">Total Bitrate</span>
        </div>
      </div>
    </div>
  );
}

export default StatsPanel;
