import React, { useState, useEffect } from 'react';
import './StreamForm.css';

function StreamForm({ stream, onSubmit, onClose }) {
  const [formData, setFormData] = useState({
    name: '',
    srtPort: 9000,
    streamId: '',
    multicastAddress: '',
    multicastPort: 5000,
    latency: 200,
    passthrough: true
  });

  useEffect(() => {
    if (stream) {
      setFormData({
        name: stream.name || '',
        srtPort: stream.srtPort || 9000,
        streamId: stream.streamId || '',
        multicastAddress: stream.multicastAddress || '',
        multicastPort: stream.multicastPort || 5000,
        latency: stream.latency || 200,
        passthrough: stream.passthrough !== false
      });
    }
  }, [stream]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseInt(value) || 0 : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{stream ? 'Edit Stream' : 'New Stream'}</h2>
          <button className="btn-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4l12 12M16 4L4 16"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Stream Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Camera 1"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="srtPort">SRT Port</label>
              <input
                type="number"
                id="srtPort"
                name="srtPort"
                value={formData.srtPort}
                onChange={handleChange}
                min="1024"
                max="65535"
                required
              />
              <span className="help-text">Port to listen for incoming SRT connections</span>
            </div>

            <div className="form-group">
              <label htmlFor="latency">Latency (ms)</label>
              <input
                type="number"
                id="latency"
                name="latency"
                value={formData.latency}
                onChange={handleChange}
                min="20"
                max="8000"
              />
              <span className="help-text">SRT receive buffer latency</span>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="streamId">Stream ID (optional)</label>
            <input
              type="text"
              id="streamId"
              name="streamId"
              value={formData.streamId}
              onChange={handleChange}
              placeholder="e.g., live/camera1"
            />
            <span className="help-text">Used for stream routing with multiple sources</span>
          </div>

          <div className="form-section">
            <h3>Multicast Output</h3>
            <p className="section-desc">Configure UDP multicast destination to distribute the stream on your local network.</p>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="multicastAddress">Multicast Address</label>
                <input
                  type="text"
                  id="multicastAddress"
                  name="multicastAddress"
                  value={formData.multicastAddress}
                  onChange={handleChange}
                  placeholder="e.g., 239.255.0.1"
                />
                <span className="help-text">Leave empty to disable multicast</span>
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

          <div className="form-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="passthrough"
                checked={formData.passthrough}
                onChange={handleChange}
              />
              <span className="checkmark"></span>
              <span className="label-text">
                Passthrough Mode (No Decode)
                <span className="sublabel">Forward stream as-is without decoding for lower CPU usage</span>
              </span>
            </label>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {stream ? 'Save Changes' : 'Create Stream'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default StreamForm;
