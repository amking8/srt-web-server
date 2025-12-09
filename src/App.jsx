import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import StreamList from './components/StreamList';
import StreamForm from './components/StreamForm';
import LogViewer from './components/LogViewer';
import StatsPanel from './components/StatsPanel';
import './App.css';

function App() {
  const [streams, setStreams] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({
    totalStreams: 0,
    activeStreams: 0,
    totalClients: 0,
    totalBytesReceived: 0,
    totalBytesSent: 0,
    totalBitrate: 0
  });
  const [showForm, setShowForm] = useState(false);
  const [editingStream, setEditingStream] = useState(null);
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
          setStreams(message.data.streams);
          setLogs(message.data.logs);
          break;
        case 'streams':
          setStreams(message.data);
          break;
        case 'log':
          if (message.data.cleared) {
            setLogs([]);
          } else {
            setLogs(prev => [message.data, ...prev].slice(0, 500));
          }
          break;
        case 'stats':
          setStats(message.data);
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

  const handleCreateStream = async (config) => {
    try {
      const response = await fetch('/api/streams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (response.ok) {
        setShowForm(false);
      }
    } catch (error) {
      console.error('Failed to create stream:', error);
    }
  };

  const handleUpdateStream = async (id, config) => {
    try {
      const response = await fetch(`/api/streams/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (response.ok) {
        setEditingStream(null);
        setShowForm(false);
      }
    } catch (error) {
      console.error('Failed to update stream:', error);
    }
  };

  const handleDeleteStream = async (id) => {
    if (!confirm('Are you sure you want to delete this stream?')) return;
    try {
      await fetch(`/api/streams/${id}`, { method: 'DELETE' });
    } catch (error) {
      console.error('Failed to delete stream:', error);
    }
  };

  const handleStartStream = async (id) => {
    try {
      await fetch(`/api/streams/${id}/start`, { method: 'POST' });
    } catch (error) {
      console.error('Failed to start stream:', error);
    }
  };

  const handleStopStream = async (id) => {
    try {
      await fetch(`/api/streams/${id}/stop`, { method: 'POST' });
    } catch (error) {
      console.error('Failed to stop stream:', error);
    }
  };

  const handleEditStream = (stream) => {
    setEditingStream(stream);
    setShowForm(true);
  };

  const handleClearLogs = async () => {
    try {
      await fetch('/api/logs', { method: 'DELETE' });
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };

  const handleDisconnectStream = async (id) => {
    try {
      await fetch(`/api/streams/${id}/disconnect`, { method: 'POST' });
    } catch (error) {
      console.error('Failed to disconnect stream:', error);
    }
  };

  const handleResetBuffer = async (id) => {
    try {
      await fetch(`/api/streams/${id}/reset-buffer`, { method: 'POST' });
    } catch (error) {
      console.error('Failed to reset buffer:', error);
    }
  };

  const handleStartRecording = async (id, format) => {
    try {
      await fetch(`/api/streams/${id}/record/start`, {
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
      await fetch(`/api/streams/${id}/record/stop`, { method: 'POST' });
    } catch (error) {
      console.error('Failed to stop recording:', error);
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
        onAddStream={() => {
          setEditingStream(null);
          setShowForm(true);
        }}
        onSaveConfig={handleSaveConfig}
        onLoadConfig={handleLoadConfig}
      />
      
      <main className="main-content">
        <StatsPanel stats={stats} />
        
        <div className="content-grid">
          <div className="streams-section">
            <div className="section-header">
              <h2>Stream Lines</h2>
              <span className="count">{streams.length} configured</span>
            </div>
            <StreamList
              streams={streams}
              onStart={handleStartStream}
              onStop={handleStopStream}
              onEdit={handleEditStream}
              onDelete={handleDeleteStream}
              onDisconnect={handleDisconnectStream}
              onResetBuffer={handleResetBuffer}
              onRecord={handleStartRecording}
              onStopRecord={handleStopRecording}
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

      {showForm && (
        <StreamForm
          stream={editingStream}
          onSubmit={editingStream 
            ? (config) => handleUpdateStream(editingStream.id, config)
            : handleCreateStream
          }
          onClose={() => {
            setShowForm(false);
            setEditingStream(null);
          }}
        />
      )}
    </div>
  );
}

export default App;
