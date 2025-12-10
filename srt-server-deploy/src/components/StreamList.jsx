import React from 'react';
import StreamCard from './StreamCard';
import './StreamList.css';

function StreamList({ streams, onStart, onStop, onEdit, onDelete, onDisconnect, onResetBuffer, onRecord, onStopRecord }) {
  if (streams.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="6" y="10" width="36" height="28" rx="2"/>
            <circle cx="24" cy="24" r="6"/>
            <path d="M6 18h36"/>
          </svg>
        </div>
        <h3>No streams configured</h3>
        <p>Add a new stream to start receiving SRT feeds and routing them to multicast.</p>
      </div>
    );
  }

  return (
    <div className="stream-list">
      {streams.map(stream => (
        <StreamCard
          key={stream.id}
          stream={stream}
          onStart={() => onStart(stream.id)}
          onStop={() => onStop(stream.id)}
          onEdit={() => onEdit(stream)}
          onDelete={() => onDelete(stream.id)}
          onDisconnect={() => onDisconnect(stream.id)}
          onResetBuffer={() => onResetBuffer(stream.id)}
          onRecord={(format) => onRecord(stream.id, format)}
          onStopRecord={() => onStopRecord(stream.id)}
        />
      ))}
    </div>
  );
}

export default StreamList;
