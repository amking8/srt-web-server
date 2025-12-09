# SRT Web Server

## Overview
A web-based SRT (Secure Reliable Transport) streaming server that receives incoming SRT feeds and routes them to UDP multicast destinations on the local network. This is a web-based recreation of the SRT Mini Server functionality.

## Features
- **SRT Listener Server**: Accept incoming SRT streams using FFmpeg's SRT protocol support
- **UDP Multicast Output**: Route received streams to configurable multicast addresses
- **Multiple Stream Lines**: Configure up to 16 concurrent streams with unique ports and Stream IDs
- **Real-time Monitoring**: WebSocket-based dashboard with live statistics
- **Passthrough Mode**: Forward streams as-is without decoding for minimal CPU usage
- **Connection Logging**: Real-time event and error logging

## Project Architecture

### Backend (Node.js/Express)
- `server/index.js` - Main Express server with WebSocket support for real-time updates
- `server/srt-manager.js` - SRT stream management class using FFmpeg:
  - Spawns FFmpeg processes for each stream line
  - SRT input: `srt://0.0.0.0:port?mode=listener&latency=xxx`
  - UDP multicast output: `udp://address:port`
  - Parses FFmpeg output for connection status and statistics

### Frontend (React/Vite)
- `src/App.jsx` - Main application with WebSocket connection
- `src/components/Header.jsx` - Application header with add stream button
- `src/components/StatsPanel.jsx` - Dashboard statistics display
- `src/components/StreamList.jsx` - List of configured streams
- `src/components/StreamCard.jsx` - Individual stream with controls and stats
- `src/components/StreamForm.jsx` - Modal form for stream configuration
- `src/components/LogViewer.jsx` - Real-time log viewer

## How to Use

### Creating a Stream
1. Click "Add Stream" button
2. Configure:
   - **Name**: Friendly name for the stream
   - **SRT Port**: Port to listen for incoming SRT connections (e.g., 9000)
   - **Stream ID**: Optional identifier for stream routing
   - **Multicast Address**: UDP multicast destination (e.g., 239.255.0.1)
   - **Multicast Port**: UDP port for multicast output
   - **Latency**: SRT receive buffer latency in milliseconds

### Sending an SRT Stream
From OBS, vMix, FFmpeg, or other SRT-capable encoders:
```
srt://your-server-ip:9000?streamid=your-stream-id
```

### Receiving the Multicast
Use VLC or any multicast-capable player:
```
udp://@239.255.0.1:5004
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
