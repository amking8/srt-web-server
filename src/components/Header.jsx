import React, { useState, useEffect } from 'react';
import './Header.css';

function Header({ serverConfig, serverRunning, onStartServer, onStopServer, onUpdateConfig, onSaveConfig, onLoadConfig, timecodeConfig, onToggleTimecodeSync, onUpdateTimecodeConfig }) {
  const [showSettings, setShowSettings] = useState(false);
  const [portValue, setPortValue] = useState(serverConfig?.srtPort || 9000);
  const [latencyValue, setLatencyValue] = useState(serverConfig?.latency || 200);
  const [connectionMode, setConnectionMode] = useState(serverConfig?.connectionMode || 'local');
  const [localIp, setLocalIp] = useState(serverConfig?.localIp || '');
  const [publicIp, setPublicIp] = useState(serverConfig?.publicIp || '');
  const [publicPort, setPublicPort] = useState(serverConfig?.publicPort || 9000);
  const [channelCount, setChannelCount] = useState(serverConfig?.channelCount || 16);
  const [syncShiftMs, setSyncShiftMs] = useState(timecodeConfig?.syncShiftMs || 0);
  const [networkInterfaces, setNetworkInterfaces] = useState([]);
  const [loadingPublicIp, setLoadingPublicIp] = useState(false);

  useEffect(() => {
    if (serverConfig) {
      setPortValue(serverConfig.srtPort);
      setLatencyValue(serverConfig.latency);
      setConnectionMode(serverConfig.connectionMode || 'local');
      setLocalIp(serverConfig.localIp || '');
      setPublicIp(serverConfig.publicIp || '');
      setPublicPort(serverConfig.publicPort || serverConfig.srtPort);
      setChannelCount(serverConfig.channelCount || 16);
    }
  }, [serverConfig]);

  useEffect(() => {
    if (timecodeConfig) {
      setSyncShiftMs(timecodeConfig.syncShiftMs || 0);
    }
  }, [timecodeConfig]);

  useEffect(() => {
    if (showSettings) {
      fetch('/api/network/interfaces')
        .then(res => res.json())
        .then(data => {
          setNetworkInterfaces(data);
          if (!localIp && data.length > 0) {
            setLocalIp(data[0].address);
          }
        })
        .catch(console.error);
    }
  }, [showSettings]);

  const fetchPublicIp = async () => {
    setLoadingPublicIp(true);
    try {
      const res = await fetch('/api/network/public-ip');
      if (res.ok) {
        const data = await res.json();
        setPublicIp(data.ip);
      }
    } catch (error) {
      console.error('Failed to fetch public IP:', error);
    } finally {
      setLoadingPublicIp(false);
    }
  };

  const handleSaveSettings = () => {
    onUpdateConfig({
      srtPort: parseInt(portValue, 10),
      latency: parseInt(latencyValue, 10),
      connectionMode,
      localIp,
      publicIp,
      publicPort: parseInt(publicPort, 10),
      channelCount: parseInt(channelCount, 10)
    });
    onUpdateTimecodeConfig({
      syncShiftMs: parseInt(syncShiftMs, 10)
    });
    setShowSettings(false);
  };

  const handleTabChange = (mode) => {
    setConnectionMode(mode);
    onUpdateConfig({ connectionMode: mode });
  };

  const getDisplayIp = () => {
    if (connectionMode === 'internet') {
      return publicIp || 'Not detected';
    }
    return localIp || 'Not configured';
  };

  const getDisplayPort = () => {
    if (connectionMode === 'internet') {
      return publicPort || portValue;
    }
    return portValue;
  };

  const copyConnectionInfo = () => {
    const ip = getDisplayIp();
    const port = getDisplayPort();
    if (ip && ip !== 'Not detected' && ip !== 'Not configured') {
      navigator.clipboard.writeText(`${ip}:${port}`);
    }
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

        <div className="connection-tabs">
          <button 
            className={`tab-btn ${connectionMode === 'local' ? 'active' : ''}`}
            onClick={() => handleTabChange('local')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <path d="M8 21h8M12 17v4"/>
            </svg>
            LOCALNET
          </button>
          <button 
            className={`tab-btn ${connectionMode === 'internet' ? 'active' : ''}`}
            onClick={() => handleTabChange('internet')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            INTERNET
          </button>
        </div>

        <div className="server-controls">
          <div className="connection-info">
            <span className="connection-label">
              {connectionMode === 'internet' ? 'Public IP:' : 'Local IP:'}
            </span>
            <span className="connection-value">{getDisplayIp()}</span>
            <span className="connection-port">:{getDisplayPort()}</span>
            <button 
              className="btn-icon-small" 
              onClick={copyConnectionInfo}
              title="Copy to clipboard"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
            <button 
              className="btn-icon-small" 
              onClick={() => setShowSettings(true)}
              title="Connection Settings"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
          <button 
            className={`btn-timecode-sync ${timecodeConfig?.syncEnabled ? 'active' : ''}`}
            onClick={() => onToggleTimecodeSync(!timecodeConfig?.syncEnabled)}
            title="Toggle TimeCode Sync"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12,6 12,12 16,14"/>
            </svg>
            TC Sync
          </button>
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
              <h3>Connection Settings</h3>
              <button className="close-btn" onClick={() => setShowSettings(false)}>&times;</button>
            </div>
            <div className="settings-body">
              <div className="settings-section">
                <h4>Server Settings</h4>
                <div className="setting-group">
                  <label>Number of Channels</label>
                  <select 
                    value={channelCount} 
                    onChange={e => setChannelCount(e.target.value)}
                  >
                    <option value="4">4 Channels</option>
                    <option value="8">8 Channels</option>
                    <option value="12">12 Channels</option>
                    <option value="16">16 Channels</option>
                  </select>
                  <span className="help-text">Number of channel lines to display</span>
                </div>
                <div className="setting-group">
                  <label>SRT Base Port</label>
                  <input 
                    type="number" 
                    value={portValue}
                    onChange={e => setPortValue(e.target.value)}
                    min="1024"
                    max="65535"
                  />
                  <span className="help-text">Channels use ports {portValue} - {parseInt(portValue) + parseInt(channelCount) - 1}</span>
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
                  <span className="help-text">SRT receive buffer latency</span>
                </div>
              </div>

              <div className="settings-section">
                <h4>LOCALNET Settings</h4>
                <div className="setting-group">
                  <label>Local IP Address</label>
                  <select 
                    value={localIp} 
                    onChange={e => setLocalIp(e.target.value)}
                  >
                    <option value="">Select interface...</option>
                    {networkInterfaces.map((iface, idx) => (
                      <option key={idx} value={iface.address}>
                        {iface.name}: {iface.address}
                      </option>
                    ))}
                  </select>
                  <span className="help-text">IP address for local network connections</span>
                </div>
              </div>

              <div className="settings-section">
                <h4>TimeCode Sync Settings</h4>
                <div className="setting-group">
                  <label>Sync Shift (ms)</label>
                  <input 
                    type="number" 
                    value={syncShiftMs}
                    onChange={e => setSyncShiftMs(e.target.value)}
                    min="-60000"
                    max="60000"
                  />
                  <span className="help-text">SyncTime = RealTime - SyncShift (offset from UTC)</span>
                </div>
                <div className="setting-group">
                  <label>Timecode Source</label>
                  <select 
                    value={timecodeConfig?.defaultTimecodeSource || 'sei'}
                    onChange={e => onUpdateTimecodeConfig({ defaultTimecodeSource: e.target.value })}
                  >
                    <option value="sei">SEI (H.264 metadata)</option>
                    <option value="ltc">LTC (Audio channel)</option>
                    <option value="vitc">VITC (Video pixels)</option>
                  </select>
                  <span className="help-text">Method to read embedded timecode</span>
                </div>
              </div>

              <div className="settings-section">
                <h4>INTERNET Settings</h4>
                <div className="setting-group">
                  <label>Public IP Address</label>
                  <div className="input-with-button">
                    <input 
                      type="text" 
                      value={publicIp}
                      onChange={e => setPublicIp(e.target.value)}
                      placeholder="Click Detect to find your IP"
                    />
                    <button 
                      className="btn-detect" 
                      onClick={fetchPublicIp}
                      disabled={loadingPublicIp}
                    >
                      {loadingPublicIp ? 'Detecting...' : 'Detect'}
                    </button>
                  </div>
                  <span className="help-text">Your public IP for internet connections</span>
                </div>
                <div className="setting-group">
                  <label>Public Port</label>
                  <input 
                    type="number" 
                    value={publicPort}
                    onChange={e => setPublicPort(e.target.value)}
                    min="1024"
                    max="65535"
                  />
                  <span className="help-text">Port forwarded from router (may differ from local port)</span>
                </div>
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
