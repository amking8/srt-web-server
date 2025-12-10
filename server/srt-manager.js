import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { spawn } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export class SRTManager extends EventEmitter {
  constructor() {
    super();
    this.channels = new Map();
    this.logs = [];
    this.maxLogs = 500;
    this.ffmpegProcesses = new Map();
    this.recordingProcesses = new Map();
    this.timecodeProcesses = new Map();
    this.statsInterval = null;
    this.timecodeInterval = null;
    this.recordingsDir = './recordings';
    this.numChannels = 16;
    this.referenceChannelId = null;
    
    this.serverConfig = {
      srtPort: 9000,
      latency: 200,
      encryption: 'none',
      passphrase: '',
      connectionMode: 'local',
      localIp: '',
      publicIp: '',
      publicPort: 9000,
      channelCount: 16
    };
    
    this.timecodeConfig = {
      syncEnabled: false,
      syncShiftMs: 0,
      defaultTimecodeSource: 'sei'
    };
    
    if (!existsSync(this.recordingsDir)) {
      mkdirSync(this.recordingsDir, { recursive: true });
    }
    
    this.initializeChannels();
    this.startStatsCollection();
  }

  initializeChannels() {
    for (let i = 1; i <= this.numChannels; i++) {
      const id = uuidv4();
      const channel = {
        id,
        number: i,
        name: `Line ${i}`,
        streamId: `line${i}`,
        srtPort: this.serverConfig.srtPort + (i - 1),
        multicastAddress: `239.255.0.${i}`,
        multicastPort: 5004 + (i - 1),
        status: 'stopped',
        connectedClients: 0,
        bytesReceived: 0,
        bytesSent: 0,
        bitrate: 0,
        startedAt: null,
        uptime: 0,
        fps: 0,
        rtt: 0,
        packetsLost: 0,
        packetsDropped: 0,
        encoderIp: null,
        isRecording: false,
        recordingFile: null,
        recordingFormat: 'ts',
        bufferStart: 100,
        bufferMax: 400,
        inputFps: 'auto',
        timecodeSource: 'sei',
        timecode: '00:00:00:00',
        timecodeFrames: 0,
        embeddedTimecode: null,
        syncOffset: 0,
        syncStatus: 'unknown',
        isReference: false
      };
      this.channels.set(id, channel);
    }
    this.addLog('info', `Initialized ${this.numChannels} channels`);
    this.startTimecodeCollection();
  }

  startTimecodeCollection() {
    this.timecodeInterval = setInterval(() => {
      this.channels.forEach(channel => {
        if (channel.status === 'receiving') {
          this.updateChannelTimecode(channel);
        } else {
          channel.timecode = '00:00:00:00';
          channel.timecodeFrames = 0;
          channel.embeddedTimecode = null;
        }
      });
      
      if (this.timecodeConfig.syncEnabled) {
        this.calculateSyncOffsets();
      }
    }, 33);
  }

  startTimecodeWorker(channelId) {
    const channel = this.channels.get(channelId);
    if (!channel || this.timecodeProcesses.has(channelId)) return;

    if (channel.timecodeSource === 'none' || !this.timecodeConfig.syncEnabled) {
      return;
    }

    const udpInput = `udp://${channel.multicastAddress}:${channel.multicastPort}?fifo_size=1000000&overrun_nonfatal=1`;
    
    const ffmpegArgs = [
      '-hide_banner',
      '-loglevel', 'info',
      '-re',
      '-i', udpInput,
      '-vf', 'showinfo,fps=1',
      '-an',
      '-f', 'null',
      '-'
    ];

    const process = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    this.timecodeProcesses.set(channelId, process);

    let buffer = '';
    
    process.stderr.on('data', (data) => {
      const output = data.toString();
      buffer += output;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      lines.forEach(line => {
        const tcMatch = line.match(/timecode[:\s=]+(\d{2}:\d{2}:\d{2}[:;]\d{2})/i);
        if (tcMatch) {
          this.setEmbeddedTimecode(channelId, tcMatch[1]);
          return;
        }

        const seiMatch = line.match(/SEI.*?(\d{2}:\d{2}:\d{2}[:;]\d{2})/i);
        if (seiMatch) {
          this.setEmbeddedTimecode(channelId, seiMatch[1]);
          return;
        }

        const ptsMatch = line.match(/pts:\s*(\d+)\s/);
        const ptsTimeMatch = line.match(/pts_time:([0-9.]+)/);
        if (ptsTimeMatch) {
          const pts = parseFloat(ptsTimeMatch[1]);
          const fps = channel.fps > 0 ? channel.fps : 30;
          const tc = this.ptsToTimecode(pts, fps);
          this.setEmbeddedTimecode(channelId, tc);
        }
      });
    });

    process.on('close', (code) => {
      this.timecodeProcesses.delete(channelId);
      
      if (channel.status === 'receiving' && this.timecodeConfig.syncEnabled && channel.timecodeSource !== 'none') {
        setTimeout(() => {
          if (channel.status === 'receiving' && this.timecodeConfig.syncEnabled) {
            this.startTimecodeWorker(channelId);
          }
        }, 3000);
      }
    });

    process.on('error', (err) => {
      this.timecodeProcesses.delete(channelId);
    });
  }

  startAllTimecodeWorkers() {
    if (!this.timecodeConfig.syncEnabled) return;
    
    this.channels.forEach(channel => {
      if (channel.status === 'receiving' && channel.timecodeSource !== 'none') {
        this.startTimecodeWorker(channel.id);
      }
    });
  }

  stopAllTimecodeWorkers() {
    this.timecodeProcesses.forEach((process, id) => {
      try {
        process.kill('SIGTERM');
      } catch (e) {}
    });
    this.timecodeProcesses.clear();
  }

  stopTimecodeWorker(channelId) {
    const process = this.timecodeProcesses.get(channelId);
    if (process) {
      try {
        process.kill('SIGTERM');
      } catch (e) {}
      this.timecodeProcesses.delete(channelId);
    }
  }

  updateChannelTimecode(channel) {
    if (channel.embeddedTimecode) {
      channel.timecode = channel.embeddedTimecode;
      const fps = channel.fps > 0 ? channel.fps : 30;
      channel.timecodeFrames = this.timecodeToFrames(channel.embeddedTimecode, fps);
    } else {
      channel.timecode = '00:00:00:00';
      channel.timecodeFrames = 0;
    }
  }

  setEmbeddedTimecode(channelId, timecode) {
    const channel = this.channels.get(channelId);
    if (!channel) return;
    
    channel.embeddedTimecode = timecode;
    channel.timecode = timecode;
    const fps = channel.fps > 0 ? channel.fps : 30;
    channel.timecodeFrames = this.timecodeToFrames(timecode, fps);
  }

  getCurrentSyncTime() {
    const now = new Date();
    const utcMs = now.getTime() - this.timecodeConfig.syncShiftMs;
    const syncDate = new Date(utcMs);
    
    const hours = syncDate.getUTCHours();
    const minutes = syncDate.getUTCMinutes();
    const seconds = syncDate.getUTCSeconds();
    const ms = syncDate.getUTCMilliseconds();
    const fps = 30;
    const frames = Math.floor((ms / 1000) * fps);
    
    return {
      timecode: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(frames).padStart(2, '0')}`,
      totalFrames: (hours * 3600 + minutes * 60 + seconds) * fps + frames
    };
  }

  setTimecodeConfig(config) {
    this.timecodeConfig = { ...this.timecodeConfig, ...config };
    this.addLog('info', `TimeCode config updated: sync=${this.timecodeConfig.syncEnabled}, shift=${this.timecodeConfig.syncShiftMs}ms`);
    this.emit('timecodeConfigUpdate', this.timecodeConfig);
  }

  getTimecodeConfig() {
    return this.timecodeConfig;
  }

  toggleTimecodeSync(enabled) {
    this.timecodeConfig.syncEnabled = enabled;
    if (enabled) {
      this.startAllTimecodeWorkers();
    } else {
      this.stopAllTimecodeWorkers();
      this.channels.forEach(ch => {
        ch.syncStatus = 'unknown';
        ch.syncOffset = 0;
        ch.embeddedTimecode = null;
      });
    }
    this.addLog('info', `TimeCode sync ${enabled ? 'enabled' : 'disabled'}`);
    this.emit('timecodeConfigUpdate', this.timecodeConfig);
    this.emit('channelUpdate', this.getChannels());
  }

  framesToTimecode(totalFrames, fps) {
    const framesPerSecond = Math.round(fps);
    if (framesPerSecond <= 0) return '--:--:--:--';
    
    const hours = Math.floor(totalFrames / (framesPerSecond * 3600));
    const minutes = Math.floor((totalFrames % (framesPerSecond * 3600)) / (framesPerSecond * 60));
    const seconds = Math.floor((totalFrames % (framesPerSecond * 60)) / framesPerSecond);
    const frames = totalFrames % framesPerSecond;
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
  }

  timecodeToFrames(timecode, fps) {
    const parts = timecode.split(/[:;]/);
    if (parts.length !== 4) return 0;
    
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseInt(parts[2], 10);
    const frames = parseInt(parts[3], 10);
    
    return Math.round((hours * 3600 + minutes * 60 + seconds) * fps + frames);
  }

  ptsToTimecode(pts, fps) {
    const totalFrames = Math.round(pts * fps);
    const framesPerSecond = Math.round(fps);
    
    const hours = Math.floor(totalFrames / (framesPerSecond * 3600));
    const minutes = Math.floor((totalFrames % (framesPerSecond * 3600)) / (framesPerSecond * 60));
    const seconds = Math.floor((totalFrames % (framesPerSecond * 60)) / framesPerSecond);
    const frames = totalFrames % framesPerSecond;
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
  }

  calculateSyncOffsets() {
    const syncTime = this.getCurrentSyncTime();
    const receivingChannels = Array.from(this.channels.values())
      .filter(c => c.status === 'receiving');
    
    this.channels.forEach(ch => {
      if (ch.status !== 'receiving') {
        ch.syncStatus = 'unknown';
        ch.syncOffset = 0;
        ch.isReference = false;
      }
    });
    
    if (receivingChannels.length === 0) {
      this.emit('timecodeUpdate', this.getChannels());
      return;
    }

    const frameThreshold = 2;
    const warningThreshold = 5;

    receivingChannels.forEach(channel => {
      if (!channel.embeddedTimecode || channel.timecodeFrames === 0) {
        channel.syncStatus = 'no_tc';
        channel.syncOffset = 0;
        channel.isReference = false;
        return;
      }

      const offsetFrames = channel.timecodeFrames - syncTime.totalFrames;
      channel.syncOffset = offsetFrames;
      
      const absOffset = Math.abs(offsetFrames);
      if (absOffset <= frameThreshold) {
        channel.syncStatus = 'synced';
      } else if (absOffset <= warningThreshold) {
        channel.syncStatus = 'warning';
      } else {
        channel.syncStatus = 'out_of_sync';
      }
    });

    this.emit('timecodeUpdate', this.getChannels());
  }

  setReferenceChannel(id) {
    this.channels.forEach(channel => {
      channel.isReference = (channel.id === id);
    });
    this.referenceChannelId = id;
    this.addLog('info', `Reference channel set to ${this.channels.get(id)?.name || 'Unknown'}`);
    this.emit('channelUpdate', this.getChannels());
  }

  getReferenceChannel() {
    return this.referenceChannelId;
  }

  startStatsCollection() {
    this.statsInterval = setInterval(() => {
      this.channels.forEach(channel => {
        if (channel.status === 'receiving' && channel.startedAt) {
          channel.uptime = Math.floor((Date.now() - channel.startedAt) / 1000);
        }
      });
      
      const stats = this.getStats();
      this.emit('stats', stats);
      this.emit('channelUpdate', this.getChannels());
    }, 1000);
  }

  getChannels() {
    return Array.from(this.channels.values()).sort((a, b) => a.number - b.number);
  }

  getChannel(id) {
    return this.channels.get(id);
  }

  getChannelByNumber(number) {
    return Array.from(this.channels.values()).find(c => c.number === number);
  }

  getChannelByStreamId(streamId) {
    return Array.from(this.channels.values()).find(c => c.streamId === streamId);
  }

  getServerConfig() {
    return { ...this.serverConfig };
  }

  updateServerConfig(config) {
    const wasRunning = this.isServerRunning();
    
    if (wasRunning) {
      this.stopAllChannels();
    }
    
    const newChannelCount = config.channelCount ?? this.serverConfig.channelCount;
    const channelCountChanged = newChannelCount !== this.serverConfig.channelCount;
    
    this.serverConfig = {
      ...this.serverConfig,
      srtPort: config.srtPort ?? this.serverConfig.srtPort,
      latency: config.latency ?? this.serverConfig.latency,
      encryption: config.encryption ?? this.serverConfig.encryption,
      passphrase: config.passphrase ?? this.serverConfig.passphrase,
      connectionMode: config.connectionMode ?? this.serverConfig.connectionMode,
      localIp: config.localIp ?? this.serverConfig.localIp,
      publicIp: config.publicIp ?? this.serverConfig.publicIp,
      publicPort: config.publicPort ?? this.serverConfig.publicPort,
      channelCount: newChannelCount
    };
    
    if (channelCountChanged) {
      this.updateChannelCount(newChannelCount);
    }
    
    this.addLog('info', `Server config updated: SRT port ${this.serverConfig.srtPort}`);
    this.emit('configUpdate', this.getServerConfig());
    
    if (wasRunning) {
      this.startAllChannels();
    }
    
    return this.serverConfig;
  }

  updateChannel(id, config) {
    const channel = this.channels.get(id);
    if (!channel) return null;

    const wasReceiving = channel.status === 'receiving';
    if (wasReceiving) {
      this.stopChannel(id);
    }

    Object.assign(channel, {
      name: config.name ?? channel.name,
      streamId: config.streamId ?? channel.streamId,
      multicastAddress: config.multicastAddress ?? channel.multicastAddress,
      multicastPort: config.multicastPort ?? channel.multicastPort,
      bufferStart: config.bufferStart ?? channel.bufferStart,
      bufferMax: config.bufferMax ?? channel.bufferMax,
      inputFps: config.inputFps ?? channel.inputFps,
      timecodeSource: config.timecodeSource ?? channel.timecodeSource
    });

    this.addLog('info', `Channel ${channel.number} "${channel.name}" updated`);
    this.emit('channelUpdate', this.getChannels());
    
    if (wasReceiving) {
      this.startChannel(id);
    }
    
    return channel;
  }

  isServerRunning() {
    return this.ffmpegProcesses.size > 0;
  }

  updateChannelCount(newCount) {
    const currentCount = this.channels.size;
    
    if (newCount === currentCount) return;
    
    if (newCount < currentCount) {
      const channelsArray = Array.from(this.channels.values()).sort((a, b) => a.number - b.number);
      for (let i = newCount; i < currentCount; i++) {
        const channel = channelsArray[i];
        if (channel) {
          this.stopChannel(channel.id);
          this.channels.delete(channel.id);
        }
      }
      this.addLog('info', `Reduced to ${newCount} channels`);
    } else {
      for (let i = currentCount + 1; i <= newCount; i++) {
        const id = uuidv4();
        const channel = {
          id,
          number: i,
          name: `Line ${i}`,
          streamId: `line${i}`,
          srtPort: this.serverConfig.srtPort + (i - 1),
          multicastAddress: `239.255.0.${i}`,
          multicastPort: 5004 + (i - 1),
          status: 'stopped',
          connectedClients: 0,
          bytesReceived: 0,
          bytesSent: 0,
          bitrate: 0,
          startedAt: null,
          uptime: 0,
          fps: 0,
          rtt: 0,
          packetsLost: 0,
          packetsDropped: 0,
          encoderIp: null,
          isRecording: false,
          recordingFile: null,
          recordingFormat: 'ts',
          bufferStart: 100,
          bufferMax: 400,
          inputFps: 'auto',
          timecodeSource: 'stream',
          timecode: null,
          timecodeFrames: 0,
          syncOffset: 0,
          syncStatus: 'unknown',
          isReference: false
        };
        this.channels.set(id, channel);
      }
      this.addLog('info', `Expanded to ${newCount} channels`);
    }
    
    this.numChannels = newCount;
    this.emit('channelUpdate', this.getChannels());
  }

  getChannelPort(channel) {
    return this.serverConfig.srtPort + (channel.number - 1);
  }

  startChannel(id) {
    const channel = this.channels.get(id);
    if (!channel) {
      throw new Error('Channel not found');
    }

    if (this.ffmpegProcesses.has(id)) {
      return channel;
    }

    const channelPort = this.getChannelPort(channel);
    
    let srtInput = `srt://0.0.0.0:${channelPort}?mode=listener&latency=${this.serverConfig.latency * 1000}`;
    
    if (channel.streamId) {
      srtInput += `&streamid=${encodeURIComponent(channel.streamId)}`;
    }

    channel.srtPort = channelPort;

    const ffmpegArgs = [
      '-hide_banner',
      '-loglevel', 'info',
      '-stats',
      '-stats_period', '1',
      '-i', srtInput,
      '-c', 'copy',
      '-f', 'mpegts',
      `udp://${channel.multicastAddress}:${channel.multicastPort}?pkt_size=1316`
    ];

    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    this.ffmpegProcesses.set(id, ffmpegProcess);
    channel.status = 'waiting';
    channel.ffmpegPid = ffmpegProcess.pid;

    ffmpegProcess.stderr.on('data', (data) => {
      this.parseFFmpegOutput(id, data.toString());
    });

    ffmpegProcess.on('close', (code) => {
      const wasReceiving = channel.status === 'receiving';
      const wasWaiting = channel.status === 'waiting';
      const shouldRestart = wasReceiving || wasWaiting;
      
      this.ffmpegProcesses.delete(id);
      channel.ffmpegPid = null;
      
      if (wasReceiving) {
        channel.connectedClients = 0;
        channel.encoderIp = null;
        this.addLog('info', `Channel ${channel.number} "${channel.name}" disconnected`);
      }
      
      if (shouldRestart) {
        channel.status = 'waiting';
        
        setTimeout(() => {
          if (!this.ffmpegProcesses.has(id) && channel.status === 'waiting') {
            try {
              this.startChannel(id);
            } catch (e) {
              this.addLog('warning', `Failed to restart channel ${channel.number}: ${e.message}`);
            }
          }
        }, 1000);
      } else {
        channel.status = 'stopped';
      }
      
      if (code !== 0 && code !== null && code !== 255) {
        if (!wasReceiving && !wasWaiting) {
          this.addLog('warning', `Channel ${channel.number} FFmpeg exited with code ${code}`);
        }
      }
      
      this.emit('channelUpdate', this.getChannels());
    });

    this.addLog('info', `Channel ${channel.number} "${channel.name}" listening on port ${channelPort} (Stream ID: ${channel.streamId})`);
    this.emit('channelUpdate', this.getChannels());
    return channel;
  }

  stopChannel(id) {
    const channel = this.channels.get(id);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const process = this.ffmpegProcesses.get(id);
    if (process) {
      process.kill('SIGTERM');
      setTimeout(() => {
        if (process.exitCode === null) {
          process.kill('SIGKILL');
        }
      }, 2000);
      this.ffmpegProcesses.delete(id);
    }

    this.stopTimecodeWorker(id);

    if (channel.isRecording) {
      this.stopRecording(id);
    }

    channel.status = 'stopped';
    channel.connectedClients = 0;
    channel.bytesReceived = 0;
    channel.bytesSent = 0;
    channel.bitrate = 0;
    channel.encoderIp = null;
    channel.startedAt = null;
    channel.uptime = 0;

    this.emit('channelUpdate', this.getChannels());
    return channel;
  }

  startAllChannels() {
    const channels = this.getChannels();
    channels.forEach(channel => {
      try {
        this.startChannel(channel.id);
      } catch (e) {
        this.addLog('error', `Failed to start channel ${channel.number}: ${e.message}`);
      }
    });
    this.addLog('success', `Started all ${this.numChannels} channels on SRT port ${this.serverConfig.srtPort}`);
  }

  stopAllChannels() {
    const channels = this.getChannels();
    channels.forEach(channel => {
      try {
        this.stopChannel(channel.id);
      } catch (e) {
      }
    });
    this.addLog('info', 'Stopped all channels');
  }

  parseFFmpegOutput(id, output) {
    const channel = this.channels.get(id);
    if (!channel) return;

    const connectionMatch = /Connection (from|accepted)/i.test(output);
    const inputMatch = output.includes('Input #0') && output.includes('srt://');
    const frameMatch = channel.status === 'waiting' && /frame=\s*\d+/.test(output);
    
    if ((connectionMatch || inputMatch || frameMatch) && channel.status !== 'receiving') {
      channel.status = 'receiving';
      channel.startedAt = Date.now();
      channel.connectedClients = 1;
      
      const ipMatch = output.match(/(\d+\.\d+\.\d+\.\d+)/);
      if (ipMatch && ipMatch[1] !== '0.0.0.0') {
        channel.encoderIp = ipMatch[1];
      }
      
      if (this.timecodeConfig.syncEnabled && channel.timecodeSource !== 'none') {
        setTimeout(() => this.startTimecodeWorker(id), 1000);
      }
      
      this.addLog('success', `Channel ${channel.number} "${channel.name}" connected`);
      this.emit('channelUpdate', this.getChannels());
    }

    if (output.includes('Connection reset') || output.includes('Connection timed out') || output.includes('Connection refused')) {
      channel.status = 'waiting';
      channel.connectedClients = 0;
      channel.encoderIp = null;
      channel.startedAt = null;
      channel.embeddedTimecode = null;
      this.stopTimecodeWorker(id);
      this.addLog('info', `Channel ${channel.number} "${channel.name}" disconnected`);
      this.emit('channelUpdate', this.getChannels());
    }

    const sizeMatch = output.match(/size=\s*(\d+)(\w+)/);
    if (sizeMatch) {
      const size = parseInt(sizeMatch[1]);
      const unit = sizeMatch[2].toLowerCase();
      let bytes = size;
      if (unit === 'kb' || unit === 'kib') bytes = size * 1024;
      else if (unit === 'mb' || unit === 'mib') bytes = size * 1024 * 1024;
      channel.bytesReceived = bytes;
      channel.bytesSent = bytes;
    }

    const bitrateMatch = output.match(/bitrate=\s*([\d.]+)(\w+)/);
    if (bitrateMatch) {
      let bitrate = parseFloat(bitrateMatch[1]);
      const unit = bitrateMatch[2].toLowerCase();
      if (unit === 'mbits/s' || unit === 'mbit/s') bitrate *= 1000;
      channel.bitrate = Math.round(bitrate);
    }

    const fpsMatch = output.match(/fps=\s*([\d.]+)/);
    if (fpsMatch) {
      channel.fps = parseFloat(fpsMatch[1]);
    }

    const dropMatch = output.match(/drop=\s*(\d+)/);
    if (dropMatch) {
      channel.packetsDropped = parseInt(dropMatch[1]);
    }

    const dupMatch = output.match(/dup=\s*(\d+)/);
    if (dupMatch) {
      channel.packetsLost = parseInt(dupMatch[1]);
    }

    const timecodeMatch = output.match(/timecode\s*[:=]\s*(\d{2}:\d{2}:\d{2}[:;]\d{2})/i);
    if (timecodeMatch) {
      this.setEmbeddedTimecode(id, timecodeMatch[1]);
    }

    const smpteMatch = output.match(/(\d{2}:\d{2}:\d{2}[:;]\d{2})/);
    if (smpteMatch && output.toLowerCase().includes('sei')) {
      this.setEmbeddedTimecode(id, smpteMatch[1]);
    }
  }

  disconnectChannel(id) {
    const channel = this.channels.get(id);
    if (!channel) {
      throw new Error('Channel not found');
    }

    if (channel.status !== 'receiving') {
      throw new Error('Channel is not receiving');
    }

    this.stopChannel(id);
    
    setTimeout(() => {
      this.startChannel(id);
    }, 500);
    
    this.addLog('info', `Channel ${channel.number} "${channel.name}" disconnected by user`);
    return channel;
  }

  resetBuffer(id) {
    const channel = this.channels.get(id);
    if (!channel) {
      throw new Error('Channel not found');
    }

    if (channel.status !== 'receiving') {
      throw new Error('Channel is not receiving');
    }

    const wasRecording = channel.isRecording;
    const recordingFormat = channel.recordingFormat;
    
    this.stopChannel(id);
    
    setTimeout(() => {
      this.startChannel(id);
      this.addLog('info', `Buffer reset for channel ${channel.number}`);
      
      if (wasRecording) {
        setTimeout(() => {
          try {
            this.startRecording(id, recordingFormat);
          } catch (e) {
          }
        }, 2000);
      }
    }, 500);
    
    return channel;
  }

  startRecording(id, format = 'ts') {
    const channel = this.channels.get(id);
    if (!channel) {
      throw new Error('Channel not found');
    }

    if (channel.isRecording) {
      throw new Error('Already recording');
    }

    if (channel.status !== 'receiving') {
      throw new Error('Channel must be receiving to record');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = channel.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const filename = `${safeName}_${timestamp}.${format}`;
    const filepath = join(this.recordingsDir, filename);

    const formatArgs = format === 'mp4' 
      ? ['-c', 'copy', '-movflags', '+faststart', '-f', 'mp4', filepath]
      : ['-c', 'copy', '-f', 'mpegts', filepath];

    const ffmpegArgs = [
      '-hide_banner',
      '-loglevel', 'warning',
      '-i', `udp://${channel.multicastAddress}:${channel.multicastPort}`,
      ...formatArgs
    ];

    const recProcess = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    this.recordingProcesses.set(id, recProcess);
    channel.isRecording = true;
    channel.recordingFile = filepath;
    channel.recordingFormat = format;

    recProcess.stderr.on('data', (data) => {
      const output = data.toString();
      if (output.toLowerCase().includes('error') && !output.includes('No such file')) {
        this.addLog('error', `Recording error: ${output.trim().substring(0, 200)}`);
      }
    });

    recProcess.on('close', (code) => {
      channel.isRecording = false;
      this.recordingProcesses.delete(id);
      if (code === 0 || code === 255) {
        this.addLog('success', `Recording saved: ${filename}`);
      } else if (code !== null) {
        this.addLog('warning', `Recording ended with code ${code}`);
      }
      this.emit('channelUpdate', this.getChannels());
    });

    this.addLog('info', `Started recording channel ${channel.number} to ${filename}`);
    this.emit('channelUpdate', this.getChannels());
    return { filepath, filename };
  }

  stopRecording(id) {
    const channel = this.channels.get(id);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const recProcess = this.recordingProcesses.get(id);
    if (recProcess) {
      recProcess.kill('SIGINT');
      setTimeout(() => {
        if (recProcess.exitCode === null) {
          recProcess.kill('SIGKILL');
        }
      }, 3000);
    }

    channel.isRecording = false;
    this.recordingProcesses.delete(id);
    this.addLog('info', `Stopped recording channel ${channel.number}`);
    this.emit('channelUpdate', this.getChannels());
    return channel;
  }

  addLog(level, message) {
    const log = {
      id: uuidv4(),
      level,
      message,
      timestamp: Date.now()
    };
    
    this.logs.unshift(log);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }
    
    this.emit('log', log);
  }

  getLogs() {
    return this.logs;
  }

  clearLogs() {
    this.logs = [];
    this.emit('logsCleared');
  }

  getStats() {
    const channels = this.getChannels();
    const receiving = channels.filter(c => c.status === 'receiving');
    const waiting = channels.filter(c => c.status === 'waiting');
    
    return {
      totalChannels: channels.length,
      receivingChannels: receiving.length,
      waitingChannels: waiting.length,
      connectedClients: receiving.length,
      totalBytesReceived: channels.reduce((acc, c) => acc + c.bytesReceived, 0),
      totalBytesSent: channels.reduce((acc, c) => acc + c.bytesSent, 0),
      totalBitrate: channels.reduce((acc, c) => acc + c.bitrate, 0),
      srtPort: this.serverConfig.srtPort
    };
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
    const channels = this.getChannels();
    const config = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      serverConfig: this.serverConfig,
      channels: channels.map(c => ({
        number: c.number,
        name: c.name,
        streamId: c.streamId,
        multicastAddress: c.multicastAddress,
        multicastPort: c.multicastPort,
        bufferStart: c.bufferStart,
        bufferMax: c.bufferMax,
        inputFps: c.inputFps,
        timecodeSource: c.timecodeSource
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

    if (!config.channels || !Array.isArray(config.channels)) {
      throw new Error('Invalid configuration: missing channels array');
    }

    this.stopAllChannels();
    
    if (config.serverConfig) {
      this.serverConfig = { ...this.serverConfig, ...config.serverConfig };
    }

    config.channels.forEach(channelConfig => {
      const channel = this.getChannelByNumber(channelConfig.number);
      if (channel) {
        Object.assign(channel, {
          name: channelConfig.name || channel.name,
          streamId: channelConfig.streamId || channel.streamId,
          multicastAddress: channelConfig.multicastAddress || channel.multicastAddress,
          multicastPort: channelConfig.multicastPort || channel.multicastPort,
          bufferStart: channelConfig.bufferStart ?? channel.bufferStart,
          bufferMax: channelConfig.bufferMax ?? channel.bufferMax,
          inputFps: channelConfig.inputFps || channel.inputFps,
          timecodeSource: channelConfig.timecodeSource || channel.timecodeSource
        });
      }
    });

    this.emit('channelUpdate', this.getChannels());
    this.emit('configUpdate', this.getServerConfig());
    this.addLog('success', `Loaded configuration from ${safeFilename}`);
    return config;
  }

  getConfigList() {
    const configDir = './configs';
    if (!existsSync(configDir)) {
      return [];
    }
    
    return readdirSync(configDir)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  }

  shutdown() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }
    
    this.stopAllChannels();
    
    this.recordingProcesses.forEach((process) => {
      process.kill('SIGINT');
    });
    this.recordingProcesses.clear();
  }
}

export default SRTManager;
