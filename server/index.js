import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { SRTManager } from './srt-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// Serve static files in production
app.use(express.static(join(__dirname, '../dist')));

// SRT Stream Manager
const srtManager = new SRTManager();

// WebSocket connections for real-time updates
const wsClients = new Set();

wss.on('connection', (ws) => {
  wsClients.add(ws);
  
  // Send current state on connection
  ws.send(JSON.stringify({
    type: 'init',
    data: {
      streams: srtManager.getStreams(),
      logs: srtManager.getLogs()
    }
  }));

  ws.on('close', () => {
    wsClients.delete(ws);
  });
});

// Broadcast updates to all connected clients
function broadcast(message) {
  const data = JSON.stringify(message);
  wsClients.forEach(client => {
    if (client.readyState === 1) {
      client.send(data);
    }
  });
}

// Set up event listeners for SRT manager
srtManager.on('streamUpdate', (streams) => {
  broadcast({ type: 'streams', data: streams });
});

srtManager.on('log', (log) => {
  broadcast({ type: 'log', data: log });
});

srtManager.on('stats', (stats) => {
  broadcast({ type: 'stats', data: stats });
});

// API Routes

// Get all stream configurations
app.get('/api/streams', (req, res) => {
  res.json(srtManager.getStreams());
});

// Get a single stream configuration
app.get('/api/streams/:id', (req, res) => {
  const stream = srtManager.getStream(req.params.id);
  if (stream) {
    res.json(stream);
  } else {
    res.status(404).json({ error: 'Stream not found' });
  }
});

// Create a new stream configuration
app.post('/api/streams', (req, res) => {
  try {
    const stream = srtManager.createStream(req.body);
    res.status(201).json(stream);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update a stream configuration
app.put('/api/streams/:id', (req, res) => {
  try {
    const stream = srtManager.updateStream(req.params.id, req.body);
    if (stream) {
      res.json(stream);
    } else {
      res.status(404).json({ error: 'Stream not found' });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete a stream configuration
app.delete('/api/streams/:id', (req, res) => {
  const success = srtManager.deleteStream(req.params.id);
  if (success) {
    res.status(204).send();
  } else {
    res.status(404).json({ error: 'Stream not found' });
  }
});

// Start a stream
app.post('/api/streams/:id/start', (req, res) => {
  try {
    srtManager.startStream(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Stop a stream
app.post('/api/streams/:id/stop', (req, res) => {
  try {
    srtManager.stopStream(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get logs
app.get('/api/logs', (req, res) => {
  res.json(srtManager.getLogs());
});

// Clear logs
app.delete('/api/logs', (req, res) => {
  srtManager.clearLogs();
  res.status(204).send();
});

// Get server stats
app.get('/api/stats', (req, res) => {
  res.json(srtManager.getStats());
});

// Catch-all for SPA routing
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../dist/index.html'));
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`SRT Web Server API running on port ${PORT}`);
  srtManager.addLog('info', `Server started on port ${PORT}`);
});
