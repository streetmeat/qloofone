// Simple test to verify concurrent session handling
const WebSocket = require('ws');

const WS_URL = 'ws://localhost:8081/call';

console.log('Testing concurrent session handling...');

// Simulate two concurrent calls
function simulateCall(callId) {
  console.log(`\n[Call ${callId}] Connecting...`);
  const ws = new WebSocket(WS_URL);
  
  ws.on('open', () => {
    console.log(`[Call ${callId}] Connected`);
    
    // Send start message with unique streamSid
    const streamSid = `SM${callId}_${Date.now()}`;
    ws.send(JSON.stringify({
      event: 'start',
      start: {
        streamSid: streamSid,
        tracks: ['inbound'],
        mediaFormat: {
          encoding: 'audio/x-mulaw',
          sampleRate: 8000,
          channels: 1
        }
      }
    }));
    
    // Send connected event after a short delay
    setTimeout(() => {
      console.log(`[Call ${callId}] Sending connected event`);
      ws.send(JSON.stringify({
        event: 'connected'
      }));
    }, 100);
    
    // Close after 5 seconds
    setTimeout(() => {
      console.log(`[Call ${callId}] Closing connection`);
      ws.close();
    }, 5000);
  });
  
  ws.on('error', (err) => {
    console.error(`[Call ${callId}] Error:`, err.message);
  });
  
  ws.on('close', () => {
    console.log(`[Call ${callId}] Disconnected`);
  });
}

// Start two calls with a small delay between them
simulateCall(1);
setTimeout(() => simulateCall(2), 1000);

// Exit after 10 seconds
setTimeout(() => {
  console.log('\nTest completed');
  process.exit(0);
}, 10000);