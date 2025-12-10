#!/bin/bash

CHANNEL=${1:-1}
PORT=$((9000 + CHANNEL - 1))
STREAM_ID="line${CHANNEL}"

echo "Starting test stream to Channel ${CHANNEL}"
echo "  SRT Port: ${PORT}"
echo "  Stream ID: ${STREAM_ID}"
echo ""
echo "Press Ctrl+C to stop the stream"
echo ""

ffmpeg -re \
  -f lavfi -i "testsrc2=size=1920x1080:rate=30" \
  -f lavfi -i "sine=frequency=1000:sample_rate=48000" \
  -c:v libx264 -preset ultrafast -tune zerolatency -b:v 4000k \
  -c:a aac -b:a 128k \
  -f mpegts "srt://127.0.0.1:${PORT}?streamid=${STREAM_ID}&mode=caller"
