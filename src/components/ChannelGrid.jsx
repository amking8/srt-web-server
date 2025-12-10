import React from 'react';
import ChannelCard from './ChannelCard';
import './ChannelGrid.css';

function ChannelGrid({ channels, serverConfig, onEdit, onDisconnect, onResetBuffer, onRecord, onStopRecord }) {
  return (
    <div className="channel-grid">
      {channels.map(channel => (
        <ChannelCard
          key={channel.id}
          channel={channel}
          serverConfig={serverConfig}
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
