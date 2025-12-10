import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import ChannelGrid from './components/ChannelGrid';
import ChannelForm from './components/ChannelForm';
import LogViewer from './components/LogViewer';
import StatsPanel from './components/StatsPanel';
import './App.css';

function App() {
  const [channels, setChannels] = useState([]);
  const [logs, setLogs] = useState([]);
  const [serverConfig, setServerConfig] = useState({
    srtPort: 9000,
    latency: 200
  });
  const [stats, setStats] = useState({
    totalChannels: 16,
    receivingChannels: 0,
    waitingChannels: 0,
    totalBytesReceived: 0,
    totalBytesSent: 0,
    totalBitrate: 0,
    srtPort: 9000
  });
  const [showForm, setShowForm] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [serverRunning, setServerRunning] = useState(false);
  const [ws, setWs] = useState(null);

  const connectWebSocket = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('WebSocket connected');
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'init':
          setChannels(message.data.channels || []);
          setLogs(message.data.logs || []);
          if (message.data.serverConfig) setServerConfig(message.data.serverConfig);
          if (message.data.stats) setStats(prev => ({ ...prev, ...message.data.stats }));
          break;
        case 'channels':
          setChannels(message.data);
          const hasRunning = message.data.some(c => c.status === 'waiting' || c.status === 'receiving');
          setServerRunning(hasRunning);
          break;
        case 'log':
          if (message.data.cleared) {
            setLogs([]);
          } else {
            setLogs(prev => [message.data, ...prev].slice(0, 500));
          }
          break;
        case 'stats':
          if (message.data) setStats(prev => ({ ...prev, ...message.data }));
          break;
        case 'serverConfig':
          setServerConfig(message.data);
          break;
        case 'timecode':
          setChannels(message.data);
          break;
      }
    };

    socket.onclose = () => {
      console.log('WebSocket disconnected, reconnecting...');
      setTimeout(connectWebSocket, 2000);
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    setWs(socket);

    return () => {
      socket.close();
    };
  }, []);

  useEffect(() => {
    const cleanup = connectWebSocket();
    return cleanup;
  }, [connectWebSocket]);

  const handleUpdateChannel = async (id, config) => {
    try {
      const response = await fetch(`/api/channels/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (response.ok) {
        setEditingChannel(null);
        setShowForm(false);
      }
    } catch (error) {
      console.error('Failed to update channel:', error);
    }
  };

  const handleEditChannel = (channel) => {
    setEditingChannel(channel);
    setShowForm(true);
  };

  const handleClearLogs = async () => {
    try {
      await fetch('/api/logs', { method: 'DELETE' });
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };

  const handleDisconnectChannel = async (id) => {
    try {
      await fetch(`/api/channels/${id}/disconnect`, { method: 'POST' });
    } catch (error) {
      console.error('Failed to disconnect channel:', error);
    }
  };

  const handleResetBuffer = async (id) => {
    try {
      await fetch(`/api/channels/${id}/reset-buffer`, { method: 'POST' });
    } catch (error) {
      console.error('Failed to reset buffer:', error);
    }
  };

  const handleStartRecording = async (id, format) => {
    try {
      await fetch(`/api/channels/${id}/record/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format })
      });
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const handleStopRecording = async (id) => {
    try {
      await fetch(`/api/channels/${id}/record/stop`, { method: 'POST' });
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const handleSetReference = async (id) => {
    try {
      await fetch(`/api/channels/${id}/set-reference`, { method: 'POST' });
    } catch (error) {
      console.error('Failed to set reference channel:', error);
    }
  };

  const handleStartServer = async () => {
    try {
      await fetch('/api/server/start', { method: 'POST' });
      setServerRunning(true);
    } catch (error) {
      console.error('Failed to start server:', error);
    }
  };

  const handleStopServer = async () => {
    try {
      await fetch('/api/server/stop', { method: 'POST' });
      setServerRunning(false);
    } catch (error) {
      console.error('Failed to stop server:', error);
    }
  };

  const handleUpdateServerConfig = async (config) => {
    try {
      await fetch('/api/server-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
    } catch (error) {
      console.error('Failed to update server config:', error);
    }
  };

  const handleSaveConfig = async () => {
    const filename = prompt('Enter config filename:', 'srt-config.json');
    if (!filename) return;
    try {
      const response = await fetch('/api/config/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      });
      if (response.ok) {
        alert('Configuration saved successfully!');
      }
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  };

  const handleLoadConfig = async () => {
    const filename = prompt('Enter config filename to load:', 'srt-config.json');
    if (!filename) return;
    try {
      const response = await fetch('/api/config/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      });
      if (response.ok) {
        alert('Configuration loaded successfully!');
      } else {
        const data = await response.json();
        alert(`Failed to load: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  return (
    <div className="app">
      <Header 
        serverConfig={serverConfig}
        serverRunning={serverRunning}
        onStartServer={handleStartServer}
        onStopServer={handleStopServer}
        onUpdateConfig={handleUpdateServerConfig}
        onSaveConfig={handleSaveConfig}
        onLoadConfig={handleLoadConfig}
      />
      
      <main className="main-content">
        <StatsPanel stats={stats} />
        
        <div className="content-grid">
          <div className="channels-section">
            <div className="section-header">
              <h2>Channel Lines</h2>
              <span className="count">
                {stats.receivingChannels} receiving / {stats.waitingChannels} waiting
              </span>
            </div>
            <ChannelGrid
              channels={channels}
              serverConfig={serverConfig}
              onEdit={handleEditChannel}
              onDisconnect={handleDisconnectChannel}
              onResetBuffer={handleResetBuffer}
              onRecord={handleStartRecording}
              onStopRecord={handleStopRecording}
              onSetReference={handleSetReference}
            />
          </div>
          
          <div className="logs-section">
            <div className="section-header">
              <h2>Connection Log</h2>
              <button className="btn-text" onClick={handleClearLogs}>Clear</button>
            </div>
            <LogViewer logs={logs} />
          </div>
        </div>
      </main>

      {showForm && editingChannel && (
        <ChannelForm
          channel={editingChannel}
          onSubmit={(config) => handleUpdateChannel(editingChannel.id, config)}
          onClose={() => {
            setShowForm(false);
            setEditingChannel(null);
          }}
        />
      )}
    </div>
  );
}

export default App;
