import React, { useState } from 'react';
import './ChannelForm.css';

function ChannelForm({ channel, onSubmit, onClose }) {
  const [formData, setFormData] = useState({
    name: channel?.name || '',
    streamId: channel?.streamId || '',
    multicastAddress: channel?.multicastAddress || '239.255.0.1',
    multicastPort: channel?.multicastPort || 5004,
    bufferStart: channel?.bufferStart || 100,
    bufferMax: channel?.bufferMax || 400,
    inputFps: channel?.inputFps || 'auto',
    timecodeSource: channel?.timecodeSource || 'none'
  });

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value, 10) : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Configure Channel {channel?.number}</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <h3>Basic Settings</h3>
            
            <div className="form-group">
              <label htmlFor="name">Title</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Camera 1"
              />
            </div>

            <div className="form-group">
              <label htmlFor="streamId">Stream ID</label>
              <input
                type="text"
                id="streamId"
                name="streamId"
                value={formData.streamId}
                onChange={handleChange}
                placeholder="e.g., camera1"
              />
              <span className="help-text">Unique identifier for this channel (like a password)</span>
            </div>
          </div>

          <div className="form-section">
            <h3>Multicast Output</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="multicastAddress">Multicast Address</label>
                <input
                  type="text"
                  id="multicastAddress"
                  name="multicastAddress"
                  value={formData.multicastAddress}
                  onChange={handleChange}
                  placeholder="239.255.0.1"
                />
              </div>

              <div className="form-group">
                <label htmlFor="multicastPort">Multicast Port</label>
                <input
                  type="number"
                  id="multicastPort"
                  name="multicastPort"
                  value={formData.multicastPort}
                  onChange={handleChange}
                  min="1024"
                  max="65535"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Buffer Settings</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="bufferStart">Buffer Start (ms)</label>
                <input
                  type="number"
                  id="bufferStart"
                  name="bufferStart"
                  value={formData.bufferStart}
                  onChange={handleChange}
                  min="0"
                  max="2000"
                />
              </div>

              <div className="form-group">
                <label htmlFor="bufferMax">Buffer Max (ms)</label>
                <input
                  type="number"
                  id="bufferMax"
                  name="bufferMax"
                  value={formData.bufferMax}
                  onChange={handleChange}
                  min="0"
                  max="5000"
                />
                <span className="help-text">0 = no drops, 100-400ms recommended</span>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Advanced</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="inputFps">Input FPS</label>
                <select
                  id="inputFps"
                  name="inputFps"
                  value={formData.inputFps}
                  onChange={handleChange}
                >
                  <option value="auto">Auto</option>
                  <option value="23.976">23.976</option>
                  <option value="24">24</option>
                  <option value="25">25</option>
                  <option value="29.97">29.97</option>
                  <option value="30">30</option>
                  <option value="50">50</option>
                  <option value="59.94">59.94</option>
                  <option value="60">60</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="timecodeSource">TimeCode Source</label>
                <select
                  id="timecodeSource"
                  name="timecodeSource"
                  value={formData.timecodeSource}
                  onChange={handleChange}
                >
                  <option value="none">None</option>
                  <option value="sei">SEI (Embedded)</option>
                  <option value="ltc">LTC (Audio)</option>
                  <option value="vitc">VITC</option>
                </select>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ChannelForm;
