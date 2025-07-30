#!/usr/bin/env node
import * as dotenv from 'dotenv';
import WebSocket from 'ws';

dotenv.config();

async function debugTest() {
  console.log('Starting debug test...');
  console.log('PORT:', process.env.PORT);
  
  // Set a different port to avoid conflicts
  process.env.PORT = '8082';
  
  // Start server
  const { server } = await import('../../server');
  await new Promise((resolve) => {
    if (server.listening) resolve(undefined);
    else server.once('listening', resolve);
  });
  
  const port = (server.address() as any).port;
  console.log(`Server on port ${port}`);
  
  // Connect
  const ws = new WebSocket(`ws://localhost:${port}/call`);
  
  ws.on('open', () => {
    console.log('WebSocket connected');
    
    // Send Twilio start
    ws.send(JSON.stringify({
      event: 'start',
      start: {
        streamSid: 'debug-test-' + Date.now(),
        accountSid: 'ACtest',
        callSid: 'CAtest',
        tracks: ['inbound', 'outbound']
      }
    }));
    
    setTimeout(() => {
      ws.send(JSON.stringify({ event: 'connected' }));
    }, 100);
  });
  
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log(`[${new Date().toISOString().slice(11,19)}] ${msg.type}`, 
                msg.type === 'response.audio_transcript.done' ? msg.transcript : '');
  });
  
  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
  
  // Wait 20 seconds
  setTimeout(() => {
    console.log('Test complete');
    ws.close();
    server.close();
    process.exit(0);
  }, 20000);
}

debugTest().catch(console.error);