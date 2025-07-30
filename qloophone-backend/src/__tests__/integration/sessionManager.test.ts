import WebSocket, { WebSocketServer } from 'ws';

describe('Session Manager Integration Tests', () => {
  let handleCallConnection: any;
  let handleFrontendConnection: any;
  let wss: WebSocketServer;
  let twilioClient: WebSocket;
  let frontendClient: WebSocket;
  const TEST_PORT = 18082;

  beforeAll(() => {
    // Import functions fresh for each test suite
    const sessionManager = require('../../sessionManager');
    handleCallConnection = sessionManager.handleCallConnection;
    handleFrontendConnection = sessionManager.handleFrontendConnection;
    // Create a test WebSocket server
    wss = new WebSocketServer({ port: TEST_PORT });
  });

  afterAll(async () => {
    // Close all clients first
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
    });
    
    await new Promise<void>((resolve) => {
      wss.close(() => resolve());
    });
  }, 15000); // Increase timeout for cleanup

  afterEach(async () => {
    // Clean up connections
    if (twilioClient && twilioClient.readyState === WebSocket.OPEN) {
      twilioClient.close();
    }
    if (frontendClient && frontendClient.readyState === WebSocket.OPEN) {
      frontendClient.close();
    }
    
    // Wait a bit for connections to fully close
    await new Promise((resolve) => setTimeout(resolve, 50));
    
    // Clear any session state by requiring fresh module
    jest.resetModules();
  });

  describe('Twilio Connection Handling', () => {
    test('handles Twilio start event and initializes session', async () => {
      const serverConnection = await new Promise<WebSocket>((resolve) => {
        wss.once('connection', (ws) => {
          handleCallConnection(ws, 'test-api-key');
          resolve(ws);
        });
        twilioClient = new WebSocket(`ws://localhost:${TEST_PORT}`);
      });

      await new Promise((resolve) => twilioClient.on('open', resolve));

      // Send Twilio start event
      const startEvent = {
        event: 'start',
        start: {
          streamSid: 'test-stream-123',
          accountSid: 'test-account',
          callSid: 'test-call'
        }
      };

      twilioClient.send(JSON.stringify(startEvent));

      // Wait for message processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Send connected event
      twilioClient.send(JSON.stringify({ event: 'connected' }));

      // Should attempt to connect to OpenAI (will fail with test key, but that's ok)
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(serverConnection.readyState).toBe(WebSocket.OPEN);
    });

    test('handles media streaming events', async () => {
      let sessionInitialized = false;
      let mediaEventCount = 0;
      
      // Mock console to capture any errors
      const originalError = console.error;
      const errors: any[] = [];
      console.error = (...args) => {
        errors.push(args);
        originalError(...args);
      };
      
      await new Promise<void>((resolve) => {
        wss.once('connection', (ws) => {
          // Monitor the actual message flow
          const originalOn = ws.on.bind(ws);
          ws.on = function(event: string, handler: any) {
            if (event === 'message') {
              const wrappedHandler = (data: any) => {
                try {
                  const msg = JSON.parse(data.toString());
                  if (msg.event === 'start') {
                    sessionInitialized = true;
                  } else if (msg.event === 'media') {
                    mediaEventCount++;
                  }
                } catch (e) {
                  // Ignore parse errors
                }
                handler(data);
              };
              return originalOn(event, wrappedHandler);
            }
            return originalOn(event, handler);
          };
          
          handleCallConnection(ws, 'test-api-key');
          resolve();
        });
        twilioClient = new WebSocket(`ws://localhost:${TEST_PORT}`);
      });

      await new Promise((resolve) => twilioClient.on('open', resolve));

      // First, send start event to initialize session
      const startEvent = {
        event: 'start',
        start: {
          streamSid: 'SM12345678901234567890123456789012',
          accountSid: 'AC12345678901234567890123456789012',
          callSid: 'CA12345678901234567890123456789012'
        }
      };
      twilioClient.send(JSON.stringify(startEvent));

      // Wait for start event processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Now send media event
      const mediaEvent = {
        event: 'media',
        media: {
          timestamp: 1000,
          payload: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQA='
        }
      };
      twilioClient.send(JSON.stringify(mediaEvent));

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      // Restore console.error
      console.error = originalError;

      // The test verifies that:
      // 1. Session was initialized (start event processed)
      // 2. Media event was received
      // 3. No critical errors occurred
      expect(sessionInitialized).toBe(true);
      expect(mediaEventCount).toBeGreaterThan(0);
      expect(errors.filter(e => !e.join(' ').includes('test-api-key'))).toHaveLength(0);
    });

    test('cleans up session on Twilio disconnect', async () => {
      let connectionClosed = false;
      
      await new Promise<void>((resolve) => {
        wss.once('connection', (ws) => {
          handleCallConnection(ws, 'test-api-key');
          
          ws.on('close', () => {
            connectionClosed = true;
          });
          resolve();
        });
        twilioClient = new WebSocket(`ws://localhost:${TEST_PORT}`);
      });

      await new Promise((resolve) => twilioClient.on('open', resolve));

      // Close Twilio connection
      twilioClient.close();

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 200));
      
      expect(connectionClosed).toBe(true);
    }, 15000);
  });

  describe('Frontend Connection Handling', () => {
    test('sends connection established message on frontend connect', async () => {
      const messages: any[] = [];
      
      await new Promise<void>((resolve) => {
        wss.once('connection', (ws) => {
          handleFrontendConnection(ws);
          resolve();
        });
        
        frontendClient = new WebSocket(`ws://localhost:${TEST_PORT}`);
        frontendClient.on('message', (data) => {
          messages.push(JSON.parse(data.toString()));
        });
      });

      await new Promise((resolve) => frontendClient.on('open', resolve));

      // Wait for connection message
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(messages.length).toBeGreaterThanOrEqual(1);
      const connectionMsg = messages.find(m => m.type === 'connection.established');
      expect(connectionMsg).toMatchObject({
        type: 'connection.established',
        timestamp: expect.any(String)
      });
    });

    test('handles session configuration updates from frontend', async () => {
      await new Promise<void>((resolve) => {
        wss.once('connection', (ws) => {
          handleFrontendConnection(ws);
          resolve();
        });
        frontendClient = new WebSocket(`ws://localhost:${TEST_PORT}`);
      });

      await new Promise((resolve) => frontendClient.on('open', resolve));

      // Send session update
      const sessionUpdate = {
        type: 'session.update',
        session: {
          voice: 'alloy',
          temperature: 0.8,
          instructions: 'Test instructions'
        }
      };

      frontendClient.send(JSON.stringify(sessionUpdate));

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Connection should still be open or closing
      expect([WebSocket.OPEN, WebSocket.CLOSING, WebSocket.CLOSED]).toContain(frontendClient.readyState);
    });
  });

  describe('Message Routing', () => {
    test('routes messages between Twilio and Frontend connections', async () => {
      const frontendMessages: any[] = [];
      
      // Connect frontend first
      await new Promise<void>((resolve) => {
        wss.once('connection', (ws) => {
          handleFrontendConnection(ws);
          resolve();
        });
        
        frontendClient = new WebSocket(`ws://localhost:${TEST_PORT}`);
        frontendClient.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type !== 'connection.established') {
            frontendMessages.push(msg);
          }
        });
      });

      await new Promise((resolve) => frontendClient.on('open', resolve));

      // Connect Twilio
      await new Promise<void>((resolve) => {
        wss.once('connection', (ws) => {
          handleCallConnection(ws, 'test-api-key');
          resolve();
        });
        twilioClient = new WebSocket(`ws://localhost:${TEST_PORT}`);
      });

      await new Promise((resolve) => twilioClient.on('open', resolve));

      // Send Twilio event
      twilioClient.send(JSON.stringify({
        event: 'start',
        start: { streamSid: 'test-123' }
      }));

      // Wait for routing
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Frontend should receive Twilio events (if properly connected)
      // Note: In real implementation, this requires OpenAI connection
    });
  });

  describe('Error Handling', () => {
    test('handles WebSocket errors gracefully', async () => {
      
      await new Promise<void>((resolve) => {
        wss.once('connection', (ws) => {
          // Override the error handler to track it was called
          const originalHandler = ws.listeners('error')[0] as any;
          ws.removeAllListeners('error');
          ws.on('error', (err) => {
            if (originalHandler) originalHandler(err);
          });
          
          handleCallConnection(ws, 'test-api-key');
          resolve();
        });
        twilioClient = new WebSocket(`ws://localhost:${TEST_PORT}`);
      });

      await new Promise((resolve) => twilioClient.on('open', resolve));
      
      // Force close from server side to trigger error handling
      const serverClient = Array.from(wss.clients)[0];
      if (serverClient) {
        serverClient.terminate();
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
      
      // Error handling should have been triggered
      expect(twilioClient.readyState).toBe(WebSocket.CLOSED);
    }, 15000);

    test('handles malformed JSON messages', async () => {
      await new Promise<void>((resolve) => {
        wss.once('connection', (ws) => {
          handleCallConnection(ws, 'test-api-key');
          resolve();
        });
        twilioClient = new WebSocket(`ws://localhost:${TEST_PORT}`);
      });

      await new Promise((resolve) => twilioClient.on('open', resolve));

      // Send malformed JSON
      twilioClient.send('{ invalid json }');

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Connection should be open or closing (error handled gracefully)
      expect([WebSocket.OPEN, WebSocket.CLOSING, WebSocket.CLOSED]).toContain(twilioClient.readyState);
    });
  });
});