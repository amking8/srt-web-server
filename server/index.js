import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import os from 'os';
import { SRTManager } from './srt-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(cors());
app.use(express.json());

app.use(express.static(join(__dirname, '../dist')));

const srtManager = new SRTManager();

const wsClients = new Set();

wss.on('connection', (ws) => {
  wsClients.add(ws);
  
  ws.send(JSON.stringify({
    type: 'init',
    data: {
      channels: srtManager.getChannels(),
      logs: srtManager.getLogs(),
      serverConfig: srtManager.getServerConfig(),
      stats: srtManager.getStats()
    }
  }));

  ws.on('close', () => {
    wsClients.delete(ws);
  });
});

function broadcast(message) {
  const data = JSON.stringify(message);
  wsClients.forEach(client => {
    if (client.readyState === 1) {
      client.send(data);
    }
  });
}

srtManager.on('channelUpdate', (channels) => {
  broadcast({ type: 'channels', data: channels });
});

srtManager.on('log', (log) => {
  broadcast({ type: 'log', data: log });
});

srtManager.on('stats', (stats) => {
  broadcast({ type: 'stats', data: stats });
});

srtManager.on('configUpdate', (config) => {
  broadcast({ type: 'serverConfig', data: config });
});

srtManager.on('timecodeUpdate', (channels) => {
  broadcast({ type: 'timecode', data: channels });
});

app.get('/api/channels', (req, res) => {
  res.json(srtManager.getChannels());
});

app.get('/api/channels/:id', (req, res) => {
  const channel = srtManager.getChannel(req.params.id);
  if (channel) {
    res.json(channel);
  } else {
    res.status(404).json({ error: 'Channel not found' });
  }
});

app.put('/api/channels/:id', (req, res) => {
  try {
    const channel = srtManager.updateChannel(req.params.id, req.body);
    if (channel) {
      res.json(channel);
    } else {
      res.status(404).json({ error: 'Channel not found' });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/server-config', (req, res) => {
  res.json(srtManager.getServerConfig());
});

app.put('/api/server-config', (req, res) => {
  try {
    const config = srtManager.updateServerConfig(req.body);
    res.json(config);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/server/start', (req, res) => {
  try {
    srtManager.startAllChannels();
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/server/stop', (req, res) => {
  try {
    srtManager.stopAllChannels();
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/channels/:id/disconnect', (req, res) => {
  try {
    srtManager.disconnectChannel(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/channels/:id/reset-buffer', (req, res) => {
  try {
    srtManager.resetBuffer(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/channels/:id/set-reference', (req, res) => {
  try {
    srtManager.setReferenceChannel(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/timecode/reference', (req, res) => {
  res.json({ referenceChannelId: srtManager.getReferenceChannel() });
});

app.post('/api/channels/:id/record/start', (req, res) => {
  try {
    const format = req.body.format || 'ts';
    const result = srtManager.startRecording(req.params.id, format);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/channels/:id/record/stop', (req, res) => {
  try {
    srtManager.stopRecording(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/config/save', (req, res) => {
  try {
    const filename = req.body.filename || 'srt-config.json';
    const config = srtManager.saveConfig(filename);
    res.json({ success: true, config });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/config/load', (req, res) => {
  try {
    const filename = req.body.filename || 'srt-config.json';
    const config = srtManager.loadConfig(filename);
    res.json({ success: true, config });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/config/list', (req, res) => {
  res.json(srtManager.getConfigList());
});

app.get('/api/logs', (req, res) => {
  res.json(srtManager.getLogs());
});

app.delete('/api/logs', (req, res) => {
  srtManager.clearLogs();
  res.status(204).send();
});

app.get('/api/stats', (req, res) => {
  res.json(srtManager.getStats());
});

app.get('/api/network/interfaces', (req, res) => {
  const interfaces = os.networkInterfaces();
  const result = [];
  
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        result.push({
          name: name,
          address: addr.address,
          netmask: addr.netmask
        });
      }
    }
  }
  
  res.json(result);
});

app.get('/api/network/public-ip', async (req, res) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch('https://api.ipify.org?format=json', {
      signal: controller.signal
    });
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error('Failed to fetch public IP');
    }
    
    const data = await response.json();
    res.json({ ip: data.ip });
  } catch (error) {
    res.status(503).json({ error: 'Unable to detect public IP', message: error.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../dist/index.html'));
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`SRT Web Server API running on port ${PORT}`);
  srtManager.addLog('info', `Server started on port ${PORT}`);
});
