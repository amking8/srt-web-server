import React from 'react';
import './LogViewer.css';

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { 
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function LogViewer({ logs }) {
  if (logs.length === 0) {
    return (
      <div className="log-viewer empty">
        <p>No log entries yet</p>
      </div>
    );
  }

  return (
    <div className="log-viewer">
      {logs.map(log => (
        <div key={log.id} className={`log-entry ${log.level}`}>
          <span className="log-time">{formatTime(log.timestamp)}</span>
          <span className={`log-level ${log.level}`}>{log.level.toUpperCase()}</span>
          <span className="log-message">{log.message}</span>
        </div>
      ))}
    </div>
  );
}

export default LogViewer;
