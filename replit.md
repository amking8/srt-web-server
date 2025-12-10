# SRT Web Server

## Overview
A web-based SRT (Secure Reliable Transport) streaming server that receives incoming SRT feeds and routes them to UDP multicast destinations on the local network. This is a web-based recreation of the SRT Mini Server functionality.

## Architecture (Matching SRT Mini Server)
- **16 Fixed Channel Lines**: Always-present channels in a 4x4 grid, each with unique Stream ID
- **Sequential SRT Ports**: Base port + channel number (e.g., 9000, 9001, ... 9015)
- **Stream ID Routing**: Each channel accepts connections matching its configured Stream ID
- **Status Indicators**: Gray (stopped), Yellow (waiting), Green (receiving)
- **Auto-Reconnect**: Channels automatically restart listening after disconnection

## Features
- **SRT Listener Server**: Accept incoming SRT streams using FFmpeg's SRT protocol support
- **UDP Multicast Output**: Route received streams to configurable multicast addresses
- **16 Channel Lines**: Fixed grid of channels with unique ports and Stream IDs
- **Real-time Monitoring**: WebSocket-based dashboard with live statistics
- **Passthrough Mode**: Forward streams as-is without decoding for minimal CPU usage
- **Connection Logging**: Real-time event and error logging
- **Enhanced Statistics**: Uptime, FPS, bitrate, packets lost/dropped, encoder IP display
- **Stream Recording**: Record incoming streams to TS or MP4 format
- **Disconnect/Reset Controls**: Manual disconnect and buffer reset buttons
- **Save/Load Configuration**: Export and import stream configurations

## Project Architecture

### Backend (Node.js/Express)
- `server/index.js` - Main Express server with WebSocket support for real-time updates
- `server/srt-manager.js` - SRT channel management class using FFmpeg:
  - Initializes 16 fixed channels on startup
  - Each channel gets port = basePort + (channelNumber - 1)
  - Spawns FFmpeg processes for each channel when server starts
  - SRT input: `srt://0.0.0.0:port?mode=listener&streamid=xxx&latency=yyy`
  - UDP multicast output: `udp://address:port`
  - Parses FFmpeg output for connection status and statistics
  - Auto-restarts channels after disconnection

### Frontend (React/Vite)
- `src/App.jsx` - Main application with WebSocket connection
- `src/components/Header.jsx` - Header with SRT port settings, Start/Stop Server controls
- `src/components/StatsPanel.jsx` - Dashboard statistics display (channels, receiving, waiting)
- `src/components/ChannelGrid.jsx` - 4x4 grid of 16 channel cards
- `src/components/ChannelCard.jsx` - Individual channel with status indicator and stats
- `src/components/ChannelForm.jsx` - Modal form for channel configuration
- `src/components/LogViewer.jsx` - Real-time log viewer

## How to Use

### Starting the Server
1. Click "Start Server" button in the header
2. All 16 channels will start listening for SRT connections
3. Channels show yellow indicator when waiting, green when receiving

### Configuring a Channel
1. Click the menu (⋮) on any channel card
2. Select "Configure" to edit:
   - **Title**: Friendly name for the channel
   - **Stream ID**: Unique identifier for routing (e.g., camera1, line1)
   - **Multicast Address**: UDP multicast destination (e.g., 239.255.0.1)
   - **Multicast Port**: UDP port for multicast output
   - **Buffer Settings**: Start and max buffer in milliseconds

### Sending an SRT Stream
From OBS, vMix, FFmpeg, or other SRT-capable encoders:
```
srt://your-server-ip:9000?streamid=line1    # Channel 1
srt://your-server-ip:9001?streamid=line2    # Channel 2
... (ports 9000-9015 for channels 1-16)
```

### Receiving the Multicast
Use VLC or any multicast-capable player:
```
udp://@239.255.0.1:5004   # Channel 1
udp://@239.255.0.2:5005   # Channel 2
... (addresses 239.255.0.1-16 for channels 1-16)
```

## Running the Application
```bash
npm install
npm run dev
```

- Frontend: Port 5000 (Vite dev server)
- API Backend: Port 3001

## Dependencies
- FFmpeg with SRT support (system dependency)
- Node.js 20
- Express, WebSocket, React, Vite

## Recent Changes
- December 2024: Initial project creation
- Implemented FFmpeg-based SRT handling for real SRT protocol support
- Added UDP multicast passthrough functionality
- Created responsive web dashboard with real-time updates
- December 2024 (Phase 1): Enhanced statistics, recording, disconnect/reset, save/load config
  - Added uptime, FPS, packets lost/dropped, RTT, encoder IP to stream stats
  - Implemented stream recording with TS/MP4 format selection
  - Added disconnect and reset buffer control buttons
  - Added save/load configuration functionality with JSON export/import
- December 2024 (Architecture Redesign): Match SRT Mini Server design
  - Replaced dynamic streams with 16 fixed channel lines
  - Implemented sequential SRT ports (basePort + channelNumber - 1)
  - Created 4x4 ChannelGrid with yellow/green/gray status indicators
  - Added Start/Stop Server controls in header
  - Auto-reconnect after channel disconnection
  - Each channel displays SRT port and multicast output
- December 2024 (Connection Types): Matching SRT Mini Server connection tabs
  - Added LOCALNET / INTERNET connection type tabs
  - Settings modal for configuring local IP and public IP/port
  - Auto-detect public IP via external API
  - Channel cards show dynamic SRT URLs based on active connection mode
  - Copy to clipboard buttons for connection strings
  - Added configurable channel count (4, 8, 12, or 16 channels)
- December 2024 (TimeCode Synchronization): Critical feature for live sports production
  - SMPTE timecode display (HH:MM:SS:FF) on each receiving channel
  - Timecode sources: uptime (elapsed time), stream (embedded SEI/LTC), or none
  - Channels receive video regardless of timecode sync status
  - Reference channel system for multi-camera sync offset calculation
  - Sync status indicators: REF, SYNC, DRIFT, OUT, WAIT, OFF (disabled)
  - Frame-accurate offset display showing +/-Nf relative to reference
  - Set any receiving channel as reference via channel menu
  - Sync can be disabled per-channel (syncEnabled flag)
  - Thresholds: 2 frames = synced, 5 frames = warning, >5 frames = out of sync
  - Reference channel persists when offline; other channels show WAIT status
  - Matches SRT Mini Server timecode workflow (SEI/LTC/VITC methods)
