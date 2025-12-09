import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { spawn } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

export class SRTManager extends EventEmitter {
  constructor() {
    super();
    this.streams = new Map();
    this.logs = [];
    this.maxLogs = 500;
    this.ffmpegProcesses = new Map();
    this.recordingProcesses = new Map();
    this.statsInterval = null;
    this.recordingsDir = './recordings';
    
    if (!existsSync(this.recordingsDir)) {
      mkdirSync(this.recordingsDir, { recursive: true });
    }
    
    this.startStatsCollection();
  }

  startStatsCollection() {
    this.statsInterval = setInterval(() => {
      const stats = this.getStats();
      this.emit('stats', stats);
    }, 1000);
  }

  getStreams() {
    return Array.from(this.streams.values());
  }

  getStream(id) {
    return this.streams.get(id);
  }

  createStream(config) {
    const id = uuidv4();
    const stream = {
      id,
      name: config.name || `Stream ${this.streams.size + 1}`,
      srtPort: config.srtPort || 9000 + this.streams.size,
      streamId: config.streamId || '',
      multicastAddress: config.multicastAddress || '',
      multicastPort: config.multicastPort || 5004,
      latency: config.latency || 200,
      passthrough: config.passthrough !== false,
      status: 'stopped',
      connectedClients: 0,
      bytesReceived: 0,
      bytesSent: 0,
      packetsReceived: 0,
      packetsSent: 0,
      bitrate: 0,
      createdAt: new Date().toISOString(),
      lastActivity: null,
      ffmpegPid: null,
      startedAt: null,
      uptime: 0,
      fps: 0,
      rtt: 0,
      packetsLost: 0,
      packetsDropped: 0,
      encoderIp: null,
      isRecording: false,
      recordingFile: null,
      recordingFormat: 'ts'
    };

    this.streams.set(id, stream);
    this.addLog('info', `Stream "${stream.name}" created on SRT port ${stream.srtPort}`);
    this.emit('streamUpdate', this.getStreams());
    return stream;
  }

  updateStream(id, config) {
    const stream = this.streams.get(id);
    if (!stream) return null;

    if (stream.status === 'running') {
      this.stopStream(id);
    }

    Object.assign(stream, {
      name: config.name ?? stream.name,
      srtPort: config.srtPort ?? stream.srtPort,
      streamId: config.streamId ?? stream.streamId,
      multicastAddress: config.multicastAddress ?? stream.multicastAddress,
      multicastPort: config.multicastPort ?? stream.multicastPort,
      latency: config.latency ?? stream.latency,
      passthrough: config.passthrough ?? stream.passthrough
    });

    this.addLog('info', `Stream "${stream.name}" configuration updated`);
    this.emit('streamUpdate', this.getStreams());
    return stream;
  }

  deleteStream(id) {
    const stream = this.streams.get(id);
    if (!stream) return false;

    if (stream.status === 'running') {
      this.stopStream(id);
    }

    this.streams.delete(id);
    this.addLog('info', `Stream "${stream.name}" deleted`);
    this.emit('streamUpdate', this.getStreams());
    return true;
  }

  startStream(id) {
    const stream = this.streams.get(id);
    if (!stream) {
      throw new Error('Stream not found');
    }

    if (stream.status === 'running') {
      throw new Error('Stream is already running');
    }

    try {
      // Build SRT input URL
      let srtInput = `srt://0.0.0.0:${stream.srtPort}?mode=listener&latency=${stream.latency * 1000}`;
      if (stream.streamId) {
        srtInput += `&streamid=${encodeURIComponent(stream.streamId)}`;
      }

      // Build output - either UDP multicast or null output for monitoring only
      let output;
      let outputArgs;
      
      if (stream.multicastAddress) {
        output = `udp://${stream.multicastAddress}:${stream.multicastPort}?pkt_size=1316`;
        outputArgs = [
          '-c', 'copy',
          '-f', 'mpegts',
          output
        ];
      } else {
        // No multicast configured - just monitor the stream
        output = 'pipe:1';
        outputArgs = [
          '-c', 'copy',
          '-f', 'mpegts',
          '-'
        ];
      }

      // FFmpeg arguments for SRT to UDP multicast passthrough
      const ffmpegArgs = [
        '-hide_banner',
        '-loglevel', 'info',
        '-stats',
        '-i', srtInput,
        ...outputArgs
      ];

      this.addLog('info', `Starting FFmpeg for "${stream.name}": ffmpeg ${ffmpegArgs.join(' ')}`);

      const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      stream.ffmpegPid = ffmpegProcess.pid;
      this.ffmpegProcesses.set(id, ffmpegProcess);

      // Track connection state
      let connected = false;
      let lastBytesReceived = 0;

      // Parse FFmpeg stderr for stats and status
      ffmpegProcess.stderr.on('data', (data) => {
        const output = data.toString();
        
        // Check for SRT connection
        if (output.includes('Opening') && output.includes('srt://')) {
          stream.status = 'waiting';
          this.addLog('info', `Stream "${stream.name}" waiting for SRT connection on port ${stream.srtPort}`);
          this.emit('streamUpdate', this.getStreams());
        }

        // Check for successful connection
        if (output.includes('Input #0') || output.includes('Stream #0')) {
          if (!connected) {
            connected = true;
            stream.connectedClients = 1;
            stream.status = 'running';
            stream.startedAt = Date.now();
            stream.lastActivity = new Date().toISOString();
            this.addLog('success', `SRT client connected to stream "${stream.name}"`);
            this.emit('streamUpdate', this.getStreams());
          }
        }

        // Parse encoder IP from SRT connection info
        const ipMatch = output.match(/from\s+(\d+\.\d+\.\d+\.\d+)/);
        if (ipMatch && !stream.encoderIp) {
          stream.encoderIp = ipMatch[1];
        }

        // Parse stats from FFmpeg output (size, time, bitrate, fps)
        const sizeMatch = output.match(/size=\s*(\d+)/);
        const bitrateMatch = output.match(/bitrate=\s*([\d.]+)([kmg])?bits?\/s/i);
        const fpsMatch = output.match(/fps=\s*([\d.]+)/);
        const timeMatch = output.match(/time=(\d+):(\d+):(\d+)/);
        
        if (sizeMatch) {
          const newBytes = parseInt(sizeMatch[1]) * 1024;
          if (newBytes > stream.bytesReceived) {
            stream.bytesReceived = newBytes;
            stream.bytesSent = stream.multicastAddress ? newBytes : 0;
            stream.lastActivity = new Date().toISOString();
          }
        }

        if (bitrateMatch) {
          let bitrate = parseFloat(bitrateMatch[1]);
          const unit = (bitrateMatch[2] || '').toLowerCase();
          if (unit === 'k') bitrate = bitrate;
          else if (unit === 'm') bitrate = bitrate * 1000;
          else if (unit === 'g') bitrate = bitrate * 1000000;
          stream.bitrate = Math.round(bitrate);
        }

        if (fpsMatch) {
          stream.fps = parseFloat(fpsMatch[1]);
        }

        if (stream.startedAt) {
          stream.uptime = Math.floor((Date.now() - stream.startedAt) / 1000);
        }

        // Parse drop/loss info from FFmpeg output
        const dropMatch = output.match(/drop=(\d+)/);
        const dupMatch = output.match(/dup=(\d+)/);
        if (dropMatch) {
          stream.packetsDropped = parseInt(dropMatch[1]);
        }
        if (dupMatch) {
          stream.packetsLost = parseInt(dupMatch[1]);
        }

        // Log errors
        if (output.toLowerCase().includes('error') && !output.includes('hide_banner')) {
          this.addLog('error', `FFmpeg: ${output.trim().substring(0, 200)}`);
        }
      });

      ffmpegProcess.stdout.on('data', (data) => {
        // Count bytes for streams without multicast (piped to stdout)
        if (!stream.multicastAddress) {
          stream.bytesReceived += data.length;
          stream.packetsReceived++;
        }
      });

      ffmpegProcess.on('close', (code) => {
        stream.status = 'stopped';
        stream.connectedClients = 0;
        stream.bitrate = 0;
        stream.ffmpegPid = null;
        stream.startedAt = null;
        stream.uptime = 0;
        stream.fps = 0;
        stream.encoderIp = null;
        this.ffmpegProcesses.delete(id);
        
        if (stream.isRecording) {
          this.stopRecording(id);
        }
        
        if (code === 0) {
          this.addLog('info', `Stream "${stream.name}" ended normally`);
        } else if (code !== null) {
          this.addLog('warning', `Stream "${stream.name}" ended with code ${code}`);
        }
        this.emit('streamUpdate', this.getStreams());
      });

      ffmpegProcess.on('error', (err) => {
        stream.status = 'error';
        this.addLog('error', `Failed to start FFmpeg for "${stream.name}": ${err.message}`);
        this.emit('streamUpdate', this.getStreams());
      });

      stream.status = 'starting';
      this.addLog('info', `Stream "${stream.name}" starting...`);
      this.emit('streamUpdate', this.getStreams());

    } catch (error) {
      stream.status = 'error';
      this.addLog('error', `Failed to start stream "${stream.name}": ${error.message}`);
      this.emit('streamUpdate', this.getStreams());
      throw error;
    }
  }

  stopStream(id) {
    const stream = this.streams.get(id);
    if (!stream) {
      throw new Error('Stream not found');
    }

    const ffmpegProcess = this.ffmpegProcesses.get(id);
    if (ffmpegProcess) {
      // Send SIGTERM for graceful shutdown
      ffmpegProcess.kill('SIGTERM');
      
      // Force kill after 3 seconds if still running
      setTimeout(() => {
        if (this.ffmpegProcesses.has(id)) {
          ffmpegProcess.kill('SIGKILL');
        }
      }, 3000);
    }

    stream.status = 'stopping';
    this.addLog('info', `Stopping stream "${stream.name}"...`);
    this.emit('streamUpdate', this.getStreams());
  }

  addLog(level, message) {
    const log = {
      id: uuidv4(),
      level,
      message,
      timestamp: new Date().toISOString()
    };

    this.logs.unshift(log);
    
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    this.emit('log', log);
    return log;
  }

  getLogs() {
    return this.logs;
  }

  clearLogs() {
    this.logs = [];
    this.emit('log', { cleared: true });
  }

  getStats() {
    const streams = this.getStreams();
    return {
      totalStreams: streams.length,
      activeStreams: streams.filter(s => s.status === 'running' || s.status === 'waiting').length,
      totalClients: streams.reduce((acc, s) => acc + s.connectedClients, 0),
      totalBytesReceived: streams.reduce((acc, s) => acc + s.bytesReceived, 0),
      totalBytesSent: streams.reduce((acc, s) => acc + s.bytesSent, 0),
      totalBitrate: streams.reduce((acc, s) => acc + s.bitrate, 0)
    };
  }

  disconnectStream(id) {
    const stream = this.streams.get(id);
    if (!stream) {
      throw new Error('Stream not found');
    }

    if (stream.status !== 'running' && stream.status !== 'waiting') {
      throw new Error('Stream is not active');
    }

    if (stream.isRecording) {
      this.stopRecording(id);
    }
    
    this.stopStream(id);
    
    stream.bytesReceived = 0;
    stream.bytesSent = 0;
    stream.packetsLost = 0;
    stream.packetsDropped = 0;
    
    this.addLog('info', `Stream "${stream.name}" disconnected by user`);
    return stream;
  }

  resetBuffer(id) {
    const stream = this.streams.get(id);
    if (!stream) {
      throw new Error('Stream not found');
    }

    if (stream.status !== 'running') {
      throw new Error('Stream is not running');
    }

    const wasRecording = stream.isRecording;
    const recordingFormat = stream.recordingFormat;
    
    if (stream.isRecording) {
      this.stopRecording(id);
    }
    
    this.stopStream(id);
    
    stream.bytesReceived = 0;
    stream.bytesSent = 0;
    
    setTimeout(() => {
      try {
        this.startStream(id);
        this.addLog('info', `Buffer reset completed for stream "${stream.name}"`);
        if (wasRecording) {
          setTimeout(() => {
            try {
              this.startRecording(id, recordingFormat);
            } catch (e) {
              this.addLog('warning', `Could not resume recording: ${e.message}`);
            }
          }, 2000);
        }
      } catch (e) {
        this.addLog('error', `Failed to restart stream after buffer reset: ${e.message}`);
      }
    }, 500);
    
    this.addLog('info', `Resetting buffer for stream "${stream.name}"...`);
    return stream;
  }

  startRecording(id, format = 'ts') {
    const stream = this.streams.get(id);
    if (!stream) {
      throw new Error('Stream not found');
    }

    if (stream.isRecording) {
      throw new Error('Already recording');
    }

    if (stream.status !== 'running') {
      throw new Error('Stream must be running to record');
    }

    if (!stream.multicastAddress) {
      this.addLog('warning', `Recording requires multicast output to be configured`);
      throw new Error('Recording requires multicast output');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = stream.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const filename = `${safeName}_${timestamp}.${format}`;
    const filepath = join(this.recordingsDir, filename);

    const formatArgs = format === 'mp4' 
      ? ['-c', 'copy', '-movflags', '+faststart', '-f', 'mp4', filepath]
      : ['-c', 'copy', '-f', 'mpegts', filepath];

    const ffmpegArgs = [
      '-hide_banner',
      '-loglevel', 'warning',
      '-i', `udp://${stream.multicastAddress}:${stream.multicastPort}`,
      ...formatArgs
    ];

    const recProcess = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    this.recordingProcesses.set(id, recProcess);
    stream.isRecording = true;
    stream.recordingFile = filepath;
    stream.recordingFormat = format;

    recProcess.stderr.on('data', (data) => {
      const output = data.toString();
      if (output.toLowerCase().includes('error') && !output.includes('No such file')) {
        this.addLog('error', `Recording error: ${output.trim().substring(0, 200)}`);
      }
    });

    recProcess.on('close', (code) => {
      stream.isRecording = false;
      this.recordingProcesses.delete(id);
      if (code === 0 || code === 255) {
        this.addLog('success', `Recording saved: ${filename}`);
      } else if (code !== null) {
        this.addLog('warning', `Recording ended with code ${code}`);
      }
      this.emit('streamUpdate', this.getStreams());
    });

    this.addLog('info', `Started recording stream "${stream.name}" to ${filename}`);
    this.emit('streamUpdate', this.getStreams());
    return { filepath, filename };
  }

  stopRecording(id) {
    const stream = this.streams.get(id);
    if (!stream) {
      throw new Error('Stream not found');
    }

    const recProcess = this.recordingProcesses.get(id);
    if (recProcess) {
      recProcess.kill('SIGTERM');
      setTimeout(() => {
        if (this.recordingProcesses.has(id)) {
          recProcess.kill('SIGKILL');
        }
      }, 3000);
    }

    stream.isRecording = false;
    this.addLog('info', `Stopped recording stream "${stream.name}"`);
    this.emit('streamUpdate', this.getStreams());
    return stream;
  }

  sanitizeFilename(filename) {
    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
    if (!sanitized.endsWith('.json')) {
      return sanitized + '.json';
    }
    return sanitized;
  }

  saveConfig(filename = 'srt-config.json') {
    const safeFilename = this.sanitizeFilename(filename);
    const streams = this.getStreams();
    const config = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      streams: streams.map(s => ({
        name: s.name,
        srtPort: s.srtPort,
        streamId: s.streamId,
        multicastAddress: s.multicastAddress,
        multicastPort: s.multicastPort,
        latency: s.latency,
        passthrough: s.passthrough,
        recordingFormat: s.recordingFormat
      }))
    };

    const filepath = join('./configs', safeFilename);
    if (!existsSync('./configs')) {
      mkdirSync('./configs', { recursive: true });
    }
    
    writeFileSync(filepath, JSON.stringify(config, null, 2));
    this.addLog('success', `Configuration saved to ${safeFilename}`);
    return config;
  }

  loadConfig(filename = 'srt-config.json') {
    const safeFilename = this.sanitizeFilename(filename);
    const filepath = join('./configs', safeFilename);
    
    if (!existsSync(filepath)) {
      throw new Error(`Configuration file not found: ${safeFilename}`);
    }

    const data = readFileSync(filepath, 'utf-8');
    let config;
    try {
      config = JSON.parse(data);
    } catch (e) {
      throw new Error('Invalid configuration file format');
    }

    if (!config.streams || !Array.isArray(config.streams)) {
      throw new Error('Invalid configuration: missing streams array');
    }

    this.getStreams().forEach(s => {
      if (s.status === 'running' || s.status === 'waiting') {
        this.stopStream(s.id);
      }
    });
    
    setTimeout(() => {
      this.streams.clear();
      
      config.streams.forEach(streamConfig => {
        if (streamConfig.name && streamConfig.srtPort) {
          this.createStream(streamConfig);
        }
      });
      
      this.emit('streamUpdate', this.getStreams());
    }, 500);

    this.addLog('success', `Loading ${config.streams.length} streams from ${safeFilename}`);
    return config;
  }

  getConfigList() {
    const configDir = './configs';
    if (!existsSync(configDir)) {
      return [];
    }
    
    const files = [];
    try {
      const { readdirSync, statSync } = require('fs');
      readdirSync(configDir).forEach(file => {
        if (file.endsWith('.json')) {
          const stat = statSync(join(configDir, file));
          files.push({
            filename: file,
            size: stat.size,
            modified: stat.mtime.toISOString()
          });
        }
      });
    } catch (e) {
      return [];
    }
    return files;
  }

  getRecordingsList() {
    if (!existsSync(this.recordingsDir)) {
      return [];
    }
    
    const files = [];
    try {
      const { readdirSync, statSync } = require('fs');
      readdirSync(this.recordingsDir).forEach(file => {
        if (file.endsWith('.ts') || file.endsWith('.mp4') || file.endsWith('.mov')) {
          const stat = statSync(join(this.recordingsDir, file));
          files.push({
            filename: file,
            size: stat.size,
            created: stat.birthtime.toISOString()
          });
        }
      });
    } catch (e) {
      return [];
    }
    return files;
  }
}
