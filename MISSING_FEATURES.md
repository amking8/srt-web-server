# SRT Mini Server - Missing Features & Implementation Roadmap

This document outlines all features from the original SRT Mini Server that are not yet implemented in our web-based version, organized by priority.

---

## Current Implementation Status

### What We Have:
- Basic SRT listener mode (via FFmpeg)
- UDP multicast output
- Stream name/port/Stream ID configuration
- Basic start/stop controls
- Real-time bitrate/bytes stats display
- WebSocket-based dashboard
- Connection logging

---

## MUST HAVE FEATURES (Priority 1)

### 1. Core Line Configuration
| Feature | Description | Complexity |
|---------|-------------|------------|
| Custom Line Titles/Names | Custom names per line used for NDI output naming and identification | Low |
| Input FPS Configuration | Ability to set input FPS per line (auto or manual) | Medium |
| Buffer Settings | Start and max buffer configuration (ms) for frame buffering | Medium |
| Passphrase/Encryption | SRT encryption passphrase support per line | Medium |
| Receiver Latency | Configurable SRT receiver latency per line | Low |
| Auto-Record on Connect | Pre-enable recording before stream starts | Medium |

### 2. Connection Modes
| Feature | Description | Complexity |
|---------|-------------|------------|
| Caller Mode | Server initiates connection to remote SRT source | High |
| Always On Reconnection | Auto-reconnect caller connections forever | Medium |

### 3. Processing Control
| Feature | Description | Complexity |
|---------|-------------|------------|
| Disconnect Button | Manual disconnect of active stream | Low |
| Reset Buffer Button | Drop frames to get real-time latency | Medium |
| Recording Button (R) | Start/stop recording during stream | Medium |
| Effective SRT Latency Display | Show actual SRT latency | Low |
| Encoder IP Display | Show connected encoder's IP address | Low |
| Uptime Counter | Display stream duration | Low |
| Decoded FPS Display | Show actual decoded framerate | Low |
| Loss Counter | Display lost packets count | Low |
| Drops Counter | Display dropped packets count | Low |

### 4. Stream Recording
| Feature | Description | Complexity |
|---------|-------------|------------|
| AS-IS Recording | Save incoming stream without processing | High |
| Recording Folder Selection | Configurable save location | Low |
| Recording Formats | TS, MP4, MOV format options | Medium |

### 5. TimeCode Synchronization
| Feature | Description | Complexity |
|---------|-------------|------------|
| TimeCode Setup | Read timecode from feed | High |
| SEI Method | Extract timecode from SEI NAL units | High |
| LTC (Audio) Method | Extract timecode from LTC audio track | High |
| VITC Method | Extract timecode from VITC | High |
| Multi-Feed Sync | Synchronize multiple feeds by timecode | Very High |
| Auto Sync Control | Automatically drop/insert frames for sync | High |

### 6. Settings
| Feature | Description | Complexity |
|---------|-------------|------------|
| Listen Port Configuration | Change main server port | Low |
| Network Interface Selection | Choose which NIC to use | Medium |
| Start Listen on Run | Auto-start server on launch | Low |
| Lines Count Selection | Choose 1-16 visible lines | Low |

### 7. Utility Features
| Feature | Description | Complexity |
|---------|-------------|------------|
| Save/Load Config | Export/import line configurations as JSON/INI | Medium |
| Reset Stream IDs | Generate new stream IDs for all lines | Low |
| Ignore Stream IDs | Reset all stream IDs and apply one default ID for all lines | Low |
| Logs Folder Access | View/download logs | Low |
| Broadcast Reports | View detailed per-line reports | Medium |

### 8. Output Options
| Feature | Description | Complexity |
|---------|-------------|------------|
| RTMP Output | Re-stream to RTMP destinations (YouTube, Twitch, etc.) | High |
| SRT Re-Stream | Forward SRT to another SRT destination | High |
| Multiple Outputs per Line | Send one input to multiple outputs | Medium |

---

## NICE TO HAVE FEATURES (Priority 2)

### 1. Additional Input Protocols
| Feature | Description | Complexity |
|---------|-------------|------------|
| HLS Input | Accept streams from HLS sources | High |
| RTMP Input | Accept streams from RTMP sources | High |
| RTSP Input | Accept streams from RTSP cameras | High |
| WebRTC (WHEP) Input | Accept WebRTC streams via WHEP | Very High |
| RIST Input | Accept RIST protocol streams | High |

### 2. Advanced Recording
| Feature | Description | Complexity |
|---------|-------------|------------|
| Scheduled Recording | Time-based automatic recording | Medium |
| Continuous TS Dump | Per-line continuous recording mode | Medium |
| Segmented Recording | Split recordings into chunks | Medium |

### 3. Advanced Addons
| Feature | Description | Complexity |
|---------|-------------|------------|
| Cross Lines | Two-way communication between lines | Very High |
| Dynamic Overlay | Add text/image overlays to output | High |
| Backup Lines | Automatic failover between lines | High |
| HLS Output | Generate HLS streams for web playback | High |
| Link Generator | Generate encoder connection codes/QR | Medium |
| TalkBack Manager | Two-way communication with reporters | Very High |
| Conference Addon | Multi-party conferencing | Very High |
| RE-Stream Addon | Re-stream to multiple platforms | High |

### 4. Network Features
| Feature | Description | Complexity |
|---------|-------------|------------|
| Proxy Server Mode | Connect via cloud proxy for NAT traversal | Very High |
| Dynamic DNS | Auto-update DNS with public IP | Medium |
| SRT Speed Test | Test connection quality | Medium |
| Caller Connection Redundancy | Multiple backup caller destinations | High |
| Network Bonding | Combine multiple network connections | Very High |

### 5. Performance Features
| Feature | Description | Complexity |
|---------|-------------|------------|
| No Decode Mode | Forward stream without decoding (CPU saving) | Medium |
| GPU Decoding | Use hardware acceleration | High |
| Stress Test Tool | Built-in performance testing | Medium |

### 6. UI/UX Enhancements
| Feature | Description | Complexity |
|---------|-------------|------------|
| Language Selection | Multi-language UI support | Medium |
| Test NDI Generator | Built-in test NDI signal generator for testing | Medium |
| Test Signal Generator | Built-in test pattern generator | Medium |
| Video Preview | Show decoded video thumbnail | High |
| Audio Meters | Display audio levels | Medium |

---

## Implementation Order (Suggested)

### Phase 1: Core Enhancements
1. Enhanced line statistics (loss, drops, latency, FPS, uptime)
2. Disconnect and buffer reset controls
3. Stream recording with format selection
4. Save/load configuration

### Phase 2: Connection Flexibility
5. Caller mode implementation
6. Passphrase/encryption support
7. Buffer and latency configuration

### Phase 3: TimeCode & Sync
8. TimeCode extraction (SEI method first)
9. LTC timecode support
10. Multi-feed synchronization

### Phase 4: Output Expansion
11. RTMP output re-streaming
12. SRT re-streaming
13. Multiple outputs per line

### Phase 5: Advanced Features
14. Input protocol expansion (RTMP, RTSP, HLS)
15. Scheduled recording
16. Backup/failover lines
17. Dynamic overlays

---

## Technical Notes

### FFmpeg Flags Reference
Common FFmpeg flags needed for feature implementation:

```bash
# SRT with passphrase
-i "srt://0.0.0.0:9000?mode=listener&passphrase=secret123"

# SRT caller mode
-i "srt://remote-ip:port?mode=caller"

# Recording to file
-c copy -f mpegts output.ts
-c copy -f mp4 output.mp4

# RTMP output
-c copy -f flv rtmp://server/live/key

# Multiple outputs
-c copy -f mpegts udp://239.0.0.1:5004 -c copy -f flv rtmp://...

# Stats extraction
-progress pipe:1 (for progress stats)
-stats_period 1 (stats every second)
```

### SRT Statistics Available
- `msRTT` - Round-trip time
- `pktRecvLoss` - Packets lost
- `pktRecvDrop` - Packets dropped
- `mbpsRecvRate` - Receive bitrate
- `pktRecvTotal` - Total packets received

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| Dec 2024 | 0.1.0 | Initial implementation with basic SRT listener and UDP multicast |
| TBD | 0.2.0 | Enhanced statistics and recording |
| TBD | 0.3.0 | Caller mode and encryption |
| TBD | 0.4.0 | TimeCode synchronization |
| TBD | 0.5.0 | Multi-output support |
