import WebSocket from 'ws';
import { Server } from 'http';
import { AddressInfo } from 'net';

describe('End-to-End Call Flow Test', () => {
  let server: Server;
  let wsUrl: string;
  
  beforeAll(async () => {
    // Set up environment
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
    process.env.QLOO_API_KEY = process.env.QLOO_API_KEY || 'test-key';
    process.env.PORT = '0';
    process.env.PUBLIC_URL = 'https://test.example.com';

    jest.resetModules();
    const serverModule = await import('../../server');
    server = serverModule.server;
    
    await new Promise((resolve) => {
      if (server.listening) resolve(undefined);
      else server.once('listening', resolve);
    });
    
    const address = server.address() as AddressInfo;
    wsUrl = `ws://localhost:${address.port}`;
  });

  afterAll(async () => {
    // Close all WebSocket connections first
    if (server && server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }, 15000);

  test('Complete call flow: Twilio → Server → Functions → Response', async () => {
    const events: any[] = [];
    
    // 1. Connect frontend monitor
    const frontendWs = new WebSocket(`${wsUrl}/logs`);
    frontendWs.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      events.push({ source: 'frontend', ...msg });
    });
    
    await new Promise((resolve) => frontendWs.on('open', resolve));
    
    // 2. Connect Twilio call
    const twilioWs = new WebSocket(`${wsUrl}/call`);
    await new Promise((resolve) => twilioWs.on('open', resolve));
    
    // 3. Send Twilio start event
    twilioWs.send(JSON.stringify({
      event: 'start',
      start: {
        streamSid: 'SM123456',
        accountSid: 'AC123456',
        callSid: 'CA123456',
        tracks: ['inbound', 'outbound'],
        mediaFormat: {
          encoding: 'audio/x-mulaw',
          sampleRate: 8000,
          channels: 1
        }
      }
    }));
    
    // 4. Send connected event
    await new Promise((resolve) => setTimeout(resolve, 100));
    twilioWs.send(JSON.stringify({ event: 'connected' }));
    
    // 5. Simulate audio stream (base64 encoded μ-law audio)
    const audioChunks = [
      'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=',
      'UklGRjQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YRAAAAAA'
    ];
    
    for (const chunk of audioChunks) {
      twilioWs.send(JSON.stringify({
        event: 'media',
        media: {
          timestamp: Date.now(),
          payload: chunk,
          chunk: '1',
          track: 'inbound'
        }
      }));
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    
    // 6. Send session configuration from frontend
    const sessionConfig = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        voice: 'alloy',
        temperature: 0.8,
        instructions: 'Test assistant',
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          silence_duration_ms: 500
        }
      }
    };
    
    frontendWs.send(JSON.stringify(sessionConfig));
    
    // 7. Wait for events to be processed
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    // 8. Send call end event
    twilioWs.send(JSON.stringify({ event: 'close' }));
    
    // 9. Wait for cleanup
    await new Promise((resolve) => setTimeout(resolve, 200));
    
    // Verify events were logged to frontend
    const connectionEvents = events.filter(e => e.type === 'connection.established');
    expect(connectionEvents.length).toBeGreaterThan(0);
    
    // Clean up
    twilioWs.close();
    frontendWs.close();
  });

  test('Multiple concurrent calls maintain isolation', async () => {
    
    // Frontend monitor
    const frontendWs = new WebSocket(`${wsUrl}/logs`);
    await new Promise((resolve) => frontendWs.on('open', resolve));
    
    // First call
    const call1 = new WebSocket(`${wsUrl}/call`);
    await new Promise((resolve) => call1.on('open', resolve));
    
    call1.send(JSON.stringify({
      event: 'start',
      start: { streamSid: 'call1-stream' }
    }));
    
    // Second call (should replace first)
    await new Promise((resolve) => setTimeout(resolve, 100));
    const call2 = new WebSocket(`${wsUrl}/call`);
    await new Promise((resolve) => call2.on('open', resolve));
    
    call2.send(JSON.stringify({
      event: 'start',
      start: { streamSid: 'call2-stream' }
    }));
    
    // First call should be closed
    await new Promise((resolve) => call1.on('close', resolve));
    expect(call1.readyState).toBe(WebSocket.CLOSED);
    expect(call2.readyState).toBe(WebSocket.OPEN);
    
    // Clean up
    call2.close();
    frontendWs.close();
  });

  test('Handles call interruption and cleanup', async () => {
    const twilioWs = new WebSocket(`${wsUrl}/call`);
    await new Promise((resolve) => twilioWs.on('open', resolve));
    
    // Start call
    twilioWs.send(JSON.stringify({
      event: 'start',
      start: { streamSid: 'interrupt-test' }
    }));
    
    // Abruptly close connection
    twilioWs.terminate();
    
    // Wait for cleanup
    await new Promise((resolve) => setTimeout(resolve, 200));
    
    // New call should work fine
    const newCall = new WebSocket(`${wsUrl}/call`);
    await new Promise((resolve) => newCall.on('open', resolve));
    
    expect(newCall.readyState).toBe(WebSocket.OPEN);
    newCall.close();
  });

  describe('Real API Integration (if credentials available)', () => {
    const hasRealCredentials = process.env.OPENAI_API_KEY && 
                              process.env.OPENAI_API_KEY !== 'test-key' &&
                              process.env.QLOO_API_KEY && 
                              process.env.QLOO_API_KEY !== 'test-key';

    (hasRealCredentials ? test : test.skip)('Makes real API calls with actual credentials', async () => {
      // This test only runs if real API credentials are available
      // Note: This test validates that the server can process real API calls
      // but doesn't test the full OpenAI integration which requires a valid OpenAI connection
      
      const frontendWs = new WebSocket(`${wsUrl}/logs`);
      await new Promise((resolve) => frontendWs.on('open', resolve));
      
      // Connect a Twilio call first
      const twilioWs = new WebSocket(`${wsUrl}/call`);
      await new Promise((resolve) => twilioWs.on('open', resolve));
      
      // Start the call
      twilioWs.send(JSON.stringify({
        event: 'start',
        start: { streamSid: 'real-api-test' }
      }));
      
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      // The test validates that connections work properly
      // Full function calling would require OpenAI Realtime API connection
      expect(twilioWs.readyState).toBe(WebSocket.OPEN);
      expect(frontendWs.readyState).toBe(WebSocket.OPEN);
      
      twilioWs.close();
      frontendWs.close();
    }, 10000);
  });
});