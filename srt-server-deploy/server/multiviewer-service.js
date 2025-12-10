import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

class MultiviewerService extends EventEmitter {
  constructor(srtManager) {
    super();
    this.srtManager = srtManager;
    this.hlsProcesses = new Map();
    this.audioProcesses = new Map();
    this.audioLevels = new Map();
    this.isRunning = false;
    this.hlsDir = '/tmp/hls';
    
    this.ensureHlsDirectory();
  }

  ensureHlsDirectory() {
    if (!fs.existsSync(this.hlsDir)) {
      fs.mkdirSync(this.hlsDir, { recursive: true });
    }
  }

  getChannelHlsDir(channelId) {
    const dir = path.join(this.hlsDir, `channel-${channelId}`);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    const channels = this.srtManager.getChannels();
    channels.forEach(channel => {
      if (channel.status === 'receiving') {
        this.startChannelHls(channel.id);
      }
    });

    this.srtManager.on('channelUpdate', (channels) => {
      if (!this.isRunning) return;
      channels.forEach(channel => {
        if (channel.status === 'receiving' && !this.hlsProcesses.has(channel.id)) {
          this.startChannelHls(channel.id);
        } else if (channel.status !== 'receiving' && this.hlsProcesses.has(channel.id)) {
          this.stopChannelHls(channel.id);
        }
      });
    });

    this.emit('started');
  }

  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;

    this.hlsProcesses.forEach((proc, id) => {
      this.stopChannelHls(id);
    });

    this.audioProcesses.forEach((proc, id) => {
      try { proc.kill('SIGTERM'); } catch (e) {}
    });
    this.audioProcesses.clear();
    this.audioLevels.clear();

    this.cleanupHlsFiles();
    this.emit('stopped');
  }

  startChannelHls(channelId) {
    const channel = this.srtManager.getChannel(channelId);
    if (!channel || this.hlsProcesses.has(channelId)) return;

    const hlsDir = this.getChannelHlsDir(channelId);
    const outputPath = path.join(hlsDir, 'stream.m3u8');
    // Use localhost UDP instead of multicast (multicast doesn't work on cloud/AWS)
    const udpInput = `udp://127.0.0.1:${channel.multicastPort}?fifo_size=1000000&overrun_nonfatal=1`;

    const ffmpegArgs = [
      '-hide_banner',
      '-loglevel', 'warning',
      '-analyzeduration', '10000000',
      '-probesize', '10000000',
      '-fflags', '+genpts+discardcorrupt',
      '-flags', 'low_delay',
      '-i', udpInput,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-tune', 'zerolatency',
      '-g', '30',
      '-sc_threshold', '0',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ac', '2',
      '-f', 'hls',
      '-hls_time', '1',
      '-hls_list_size', '3',
      '-hls_flags', 'delete_segments+independent_segments+omit_endlist',
      '-hls_segment_type', 'mpegts',
      '-hls_segment_filename', path.join(hlsDir, 'segment_%03d.ts'),
      outputPath
    ];

    const process = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    this.hlsProcesses.set(channelId, process);

    process.stderr.on('data', (data) => {
      const output = data.toString();
      if (output.includes('error') || output.includes('Error')) {
        console.error(`[Multiviewer] Channel ${channelId} HLS error:`, output);
      }
    });

    process.on('close', (code) => {
      this.hlsProcesses.delete(channelId);
      const currentChannel = this.srtManager.getChannel(channelId);
      if (this.isRunning && currentChannel && currentChannel.status === 'receiving') {
        setTimeout(() => {
          const ch = this.srtManager.getChannel(channelId);
          if (this.isRunning && ch && ch.status === 'receiving') {
            this.startChannelHls(channelId);
          }
        }, 2000);
      }
    });

    process.on('error', (err) => {
      console.error(`[Multiviewer] Channel ${channelId} process error:`, err.message);
      this.hlsProcesses.delete(channelId);
    });

    this.startAudioLevelMonitor(channelId);
  }

  stopChannelHls(channelId) {
    const process = this.hlsProcesses.get(channelId);
    if (process) {
      try {
        process.kill('SIGTERM');
      } catch (e) {}
      this.hlsProcesses.delete(channelId);
    }

    const audioProcess = this.audioProcesses.get(channelId);
    if (audioProcess) {
      try {
        audioProcess.kill('SIGTERM');
      } catch (e) {}
      this.audioProcesses.delete(channelId);
    }

    this.audioLevels.delete(channelId);

    const hlsDir = this.getChannelHlsDir(channelId);
    try {
      const files = fs.readdirSync(hlsDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(hlsDir, file));
      });
    } catch (e) {}
  }

  startAudioLevelMonitor(channelId) {
    const channel = this.srtManager.getChannel(channelId);
    if (!channel || this.audioProcesses.has(channelId)) return;

    // Use localhost UDP instead of multicast (multicast doesn't work on cloud/AWS)
    const udpInput = `udp://127.0.0.1:${channel.multicastPort}?fifo_size=500000&overrun_nonfatal=1`;

    const ffmpegArgs = [
      '-hide_banner',
      '-loglevel', 'info',
      '-i', udpInput,
      '-af', 'ebur128=peak=true:framelog=verbose',
      '-f', 'null',
      '-'
    ];

    const process = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    this.audioProcesses.set(channelId, process);

    let buffer = '';
    process.stderr.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      lines.forEach(line => {
        const mMatch = line.match(/M:\s*([-\d.]+)/);
        const sMatch = line.match(/S:\s*([-\d.]+)/);
        const peakMatch = line.match(/FTPK:\s*([-\d.]+)\s+([-\d.]+)/);
        
        if (mMatch || peakMatch) {
          const momentary = mMatch ? parseFloat(mMatch[1]) : -70;
          let peakL = -70, peakR = -70;
          
          if (peakMatch) {
            peakL = parseFloat(peakMatch[1]);
            peakR = parseFloat(peakMatch[2]);
          }

          const levels = {
            momentary: Math.max(-70, Math.min(0, momentary)),
            peakL: Math.max(-70, Math.min(0, peakL)),
            peakR: Math.max(-70, Math.min(0, peakR)),
            levelL: this.dbToPercent(peakL),
            levelR: this.dbToPercent(peakR)
          };

          this.audioLevels.set(channelId, levels);
          this.emit('audioLevels', { channelId, levels });
        }
      });
    });

    process.on('close', () => {
      this.audioProcesses.delete(channelId);
    });

    process.on('error', () => {
      this.audioProcesses.delete(channelId);
    });
  }

  dbToPercent(db) {
    if (db <= -70) return 0;
    if (db >= 0) return 100;
    return Math.round(((db + 70) / 70) * 100);
  }

  getAudioLevels() {
    const levels = {};
    this.audioLevels.forEach((value, key) => {
      levels[key] = value;
    });
    return levels;
  }

  getHlsPath(channelId) {
    return path.join(this.hlsDir, `channel-${channelId}`, 'stream.m3u8');
  }

  isChannelReady(channelId) {
    const hlsPath = this.getHlsPath(channelId);
    return fs.existsSync(hlsPath);
  }

  cleanupHlsFiles() {
    try {
      const dirs = fs.readdirSync(this.hlsDir);
      dirs.forEach(dir => {
        const dirPath = path.join(this.hlsDir, dir);
        if (fs.statSync(dirPath).isDirectory()) {
          const files = fs.readdirSync(dirPath);
          files.forEach(file => {
            fs.unlinkSync(path.join(dirPath, file));
          });
          fs.rmdirSync(dirPath);
        }
      });
    } catch (e) {}
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      activeStreams: this.hlsProcesses.size,
      channels: Array.from(this.hlsProcesses.keys())
    };
  }
}

export default MultiviewerService;
