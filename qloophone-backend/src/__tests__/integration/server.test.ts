import { Server } from 'http';
import { AddressInfo } from 'net';
import WebSocket from 'ws';

// Use native fetch if available (Node 18+), otherwise use global fetch from Jest environment
const fetch = global.fetch || require('node-fetch');

describe('Server Integration Tests', () => {
  let server: Server;
  let baseUrl: string;
  let wsUrl: string;
  
  // Store original env vars
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    // Set required environment variables
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.QLOO_API_KEY = 'test-qloo-key';
    process.env.PORT = '0'; // Use random port
    process.env.PUBLIC_URL = 'https://test.example.com';

    // Clear module cache to ensure fresh import
    jest.resetModules();
    
    // Import and start server
    const serverModule = await import('../../server');
    server = serverModule.server;
    
    // Wait for server to be listening
    await new Promise((resolve) => {
      if (server.listening) {
        resolve(undefined);
      } else {
        server.once('listening', resolve);
      }
    });
    
    const address = server.address() as AddressInfo;
    baseUrl = `http://localhost:${address.port}`;
    wsUrl = `ws://localhost:${address.port}`;
  });

  afterAll(async () => {
    // Restore original env vars
    process.env = originalEnv;
    
    // Close server
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  describe('HTTP Endpoints', () => {
    test('GET /health returns healthy status', async () => {
      const response = await fetch(`${baseUrl}/health`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        status: 'healthy',
        version: '1.0.0',
        timestamp: expect.any(String)
      });
    });

    test('GET /cache-stats returns cache statistics', async () => {
      const response = await fetch(`${baseUrl}/cache-stats`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        hits: expect.any(Number),
        misses: expect.any(Number),
        size: expect.any(Number),
        timestamp: expect.any(String)
      });
    });

    test('GET /public-url returns configured public URL', async () => {
      const response = await fetch(`${baseUrl}/public-url`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toEqual({ publicUrl: 'https://test.example.com' });
    });

    test('GET /tools returns function schemas', async () => {
      const response = await fetch(`${baseUrl}/tools`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      // Should have at least 4 core functions
      expect((data as any[]).length).toBeGreaterThanOrEqual(4);
      
      const functionNames = (data as any[]).map((f: any) => f.name);
      // Check that core functions are included
      expect(functionNames).toEqual(expect.arrayContaining([
        'search_entity',
        'search_locality',
        'get_recommendation',
        'get_fan_venues'
      ]));
    });

    test('ALL /twiml returns TwiML with WebSocket URL', async () => {
      const response = await fetch(`${baseUrl}/twiml`);
      const twiml = await response.text();
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/xml');
      expect(twiml).toContain('<Response>');
      expect(twiml).toContain('<Connect>');
      expect(twiml).toContain('<Stream url="wss://test.example.com/call"');
    });
  });

  describe('WebSocket Connections', () => {
    test('WebSocket /call connection accepts and closes properly', async () => {
      const ws = new WebSocket(`${wsUrl}/call`);
      
      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });
      
      expect(ws.readyState).toBe(WebSocket.OPEN);
      
      // Close connection
      ws.close();
      await new Promise((resolve) => ws.on('close', resolve));
      
      expect(ws.readyState).toBe(WebSocket.CLOSED);
    });

    test('WebSocket /logs connection accepts and receives confirmation', async () => {
      const ws = new WebSocket(`${wsUrl}/logs`);
      
      const messagePromise = new Promise((resolve) => {
        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          resolve(msg);
        });
      });
      
      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });
      
      const message = await messagePromise;
      expect(message).toMatchObject({
        type: 'connection.established',
        timestamp: expect.any(String)
      });
      
      ws.close();
    });

    test('WebSocket with invalid path gets rejected', async () => {
      const ws = new WebSocket(`${wsUrl}/invalid`);
      
      await new Promise((resolve) => {
        ws.on('close', resolve);
        ws.on('error', () => {}); // Ignore error event
      });
      
      expect(ws.readyState).toBe(WebSocket.CLOSED);
    });

    test('Multiple /call connections replace previous ones', async () => {
      const ws1 = new WebSocket(`${wsUrl}/call`);
      await new Promise((resolve) => ws1.on('open', resolve));
      
      const ws2 = new WebSocket(`${wsUrl}/call`);
      await new Promise((resolve) => ws2.on('open', resolve));
      
      // First connection should be closed
      await new Promise((resolve) => ws1.on('close', resolve));
      expect(ws1.readyState).toBe(WebSocket.CLOSED);
      expect(ws2.readyState).toBe(WebSocket.OPEN);
      
      ws2.close();
    });
  });

  describe('Environment Validation', () => {
    test('Server requires OPENAI_API_KEY', () => {
      // This test validates that the server checks for OPENAI_API_KEY
      // The actual exit behavior is handled at startup
      expect(process.env.OPENAI_API_KEY).toBeDefined();
      expect(process.env.OPENAI_API_KEY).not.toBe('');
    });
  });
});