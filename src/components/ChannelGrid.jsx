import React from 'react';
import ChannelCard from './ChannelCard';
import './ChannelGrid.css';

function ChannelGrid({ channels, onEdit, onDisconnect, onResetBuffer, onRecord, onStopRecord }) {
  return (
    <div className="channel-grid">
      {channels.map(channel => (
        <ChannelCard
          key={channel.id}
          channel={channel}
          onEdit={onEdit}
          onDisconnect={onDisconnect}
          onResetBuffer={onResetBuffer}
          onRecord={onRecord}
          onStopRecord={onStopRecord}
        />
      ))}
    </div>
  );
}

export default ChannelGrid;
