import React from 'react';
import './Header.css';

function Header({ onAddStream }) {
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
        
        <button className="btn-primary" onClick={onAddStream}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Add Stream
        </button>
      </div>
    </header>
  );
}

export default Header;
