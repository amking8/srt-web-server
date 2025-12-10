import React, { useState, useEffect } from 'react';
import './Header.css';

function Header({ serverConfig, serverRunning, onStartServer, onStopServer, onUpdateConfig, onSaveConfig, onLoadConfig }) {
  const [showSettings, setShowSettings] = useState(false);
  const [portValue, setPortValue] = useState(serverConfig?.srtPort || 9000);
  const [latencyValue, setLatencyValue] = useState(serverConfig?.latency || 200);

  useEffect(() => {
    if (serverConfig) {
      setPortValue(serverConfig.srtPort);
      setLatencyValue(serverConfig.latency);
    }
  }, [serverConfig]);

  const handleSaveSettings = () => {
    onUpdateConfig({
      srtPort: parseInt(portValue, 10),
      latency: parseInt(latencyValue, 10)
    });
    setShowSettings(false);
  };

  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <div className="logo-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#3b82f6"/>
              <path d="M10 12L16 8L22 12V20L16 24L10 20V12Z" stroke="white" strokeWidth="2" fill="none"/>
              <circle cx="16" cy="16" r="3" fill="white"/>
            </svg>
          </div>
          <div className="logo-text">
            <h1>SRT Web Server</h1>
            <span>Stream Routing & Multicast</span>
          </div>
        </div>

        <div className="server-controls">
          <div className="server-info">
            <span className="info-label">SRT Port:</span>
            <span className="info-value">{serverConfig?.srtPort || 9000}</span>
            <button 
              className="btn-icon-small" 
              onClick={() => setShowSettings(true)}
              title="Server Settings"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
          </div>
          
          <button 
            className={`btn-server ${serverRunning ? 'running' : ''}`}
            onClick={serverRunning ? onStopServer : onStartServer}
          >
            {serverRunning ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2"/>
                </svg>
                Stop Server
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,3 19,12 5,21"/>
                </svg>
                Start Server
              </>
            )}
          </button>
        </div>
        
        <div className="header-actions">
          <button className="btn-secondary" onClick={onLoadConfig} title="Load Configuration">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 12V14H14V12M8 2V10M8 10L4 6M8 10L12 6"/>
            </svg>
            Load
          </button>
          <button className="btn-secondary" onClick={onSaveConfig} title="Save Configuration">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 4V2H14V4M8 14V6M8 6L4 10M8 6L12 10"/>
            </svg>
            Save
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-modal" onClick={e => e.stopPropagation()}>
            <div className="settings-header">
              <h3>Server Settings</h3>
              <button className="close-btn" onClick={() => setShowSettings(false)}>&times;</button>
            </div>
            <div className="settings-body">
              <div className="setting-group">
                <label>SRT Listener Port</label>
                <input 
                  type="number" 
                  value={portValue}
                  onChange={e => setPortValue(e.target.value)}
                  min="1024"
                  max="65535"
                />
                <span className="help-text">Main port for all incoming SRT connections</span>
              </div>
              <div className="setting-group">
                <label>Default Latency (ms)</label>
                <input 
                  type="number" 
                  value={latencyValue}
                  onChange={e => setLatencyValue(e.target.value)}
                  min="20"
                  max="8000"
                />
                <span className="help-text">SRT receive buffer latency (default: 200ms)</span>
              </div>
            </div>
            <div className="settings-footer">
              <button className="btn-cancel" onClick={() => setShowSettings(false)}>Cancel</button>
              <button className="btn-save" onClick={handleSaveSettings}>Save Settings</button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export default Header;
