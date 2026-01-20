#!/usr/bin/env node

// Simple WebSocket test server for debugging Akalynth client connection
const WebSocket = require('ws');
const http = require('http');

const PORT = 3000;

// Create HTTP server
const server = http.createServer();

// Create WebSocket server
const wss = new WebSocket.Server({ server });

console.log('🎮 Akalynth Test Server Starting...');

wss.on('connection', function connection(ws, req) {
  const clientId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  console.log(`✅ New connection: ${clientId} from ${req.socket.remoteAddress}`);

  // Send welcome message immediately on connection
  ws.send(JSON.stringify({
    type: 'welcome',
    message: 'Welcome to Azura!',
    playerId: clientId,
    timestamp: new Date().toISOString()
  }));

  // Handle incoming messages
  ws.on('message', function message(data) {
    try {
      const msg = JSON.parse(data.toString());
      console.log(`📨 Message from ${clientId}:`, msg);

      // Echo back different message types
      switch (msg.type) {
        case 'connect':
          ws.send(JSON.stringify({
            type: 'connected',
            status: 'success',
            playerId: clientId
          }));
          break;

        case 'ping':
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: new Date().toISOString()
          }));
          break;

        default:
          ws.send(JSON.stringify({
            type: 'echo',
            original: msg,
            timestamp: new Date().toISOString()
          }));
      }
    } catch (error) {
      console.error(`❌ Error parsing message from ${clientId}:`, error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid JSON'
      }));
    }
  });

  // Handle connection close
  ws.on('close', function close() {
    console.log(`❌ Connection closed: ${clientId}`);
  });

  // Handle errors
  ws.on('error', function error(err) {
    console.error(`💥 WebSocket error for ${clientId}:`, err);
  });

  // Send periodic heartbeat
  const heartbeat = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'heartbeat',
        timestamp: new Date().toISOString()
      }));
    } else {
      clearInterval(heartbeat);
    }
  }, 30000); // Every 30 seconds
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Test server listening on port ${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}`);
  console.log(`🌐 Test in browser: connect to ws://localhost:${PORT}`);
});

// Handle server errors
server.on('error', (err) => {
  console.error('💥 Server error:', err);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down test server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

console.log('📝 Test server ready! Use Ctrl+C to stop.');