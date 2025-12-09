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
        <div className="stat-icon streams">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </div>
        <div className="stat-info">
          <span className="stat-value">{stats.totalStreams}</span>
          <span className="stat-label">Total Streams</span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon active">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <polygon points="10,8 16,12 10,16" fill="currentColor"/>
          </svg>
        </div>
        <div className="stat-info">
          <span className="stat-value">{stats.activeStreams}</span>
          <span className="stat-label">Active Streams</span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon clients">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <div className="stat-info">
          <span className="stat-value">{stats.totalClients}</span>
          <span className="stat-label">Connected Clients</span>
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
          <span className="stat-value">{formatBytes(stats.totalBytesReceived)}</span>
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
          <span className="stat-value">{formatBytes(stats.totalBytesSent)}</span>
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
          <span className="stat-value">{formatBitrate(stats.totalBitrate)}</span>
          <span className="stat-label">Total Bitrate</span>
        </div>
      </div>
    </div>
  );
}

export default StatsPanel;
