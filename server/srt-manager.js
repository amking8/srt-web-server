import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { spawn } from 'child_process';

export class SRTManager extends EventEmitter {
  constructor() {
    super();
    this.streams = new Map();
    this.logs = [];
    this.maxLogs = 500;
    this.ffmpegProcesses = new Map();
    this.statsInterval = null;
    
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
      ffmpegPid: null
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
            stream.lastActivity = new Date().toISOString();
            this.addLog('success', `SRT client connected to stream "${stream.name}"`);
            this.emit('streamUpdate', this.getStreams());
          }
        }

        // Parse stats from FFmpeg output (size, time, bitrate)
        const sizeMatch = output.match(/size=\s*(\d+)/);
        const bitrateMatch = output.match(/bitrate=\s*([\d.]+)([kmg])?bits?\/s/i);
        
        if (sizeMatch) {
          const newBytes = parseInt(sizeMatch[1]) * 1024; // Convert kB to bytes
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
        this.ffmpegProcesses.delete(id);
        
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
}
