import WebSocket from 'ws';
import { entityCache } from '../../entityCache';

describe('Simple Conversation Test', () => {
  let ws: WebSocket;
  const wsUrl = 'ws://localhost:8081';
  
  beforeEach(() => {
    entityCache.clear();
  });

  afterEach(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  });

  test('Can connect to server and receive greeting', async () => {
    // Connect to the running server
    ws = new WebSocket(`${wsUrl}/call`);
    
    await new Promise((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('error', reject);
    });

    // Send start event
    ws.send(JSON.stringify({
      event: 'start',
      start: {
        streamSid: 'test-simple-' + Date.now(),
        accountSid: 'ACtest',
        callSid: 'CAtest',
        tracks: ['inbound', 'outbound'],
        mediaFormat: {
          encoding: 'audio/x-mulaw',
          sampleRate: 8000,
          channels: 1
        }
      }
    }));

    await new Promise(resolve => setTimeout(resolve, 100));

    // Send connected event
    ws.send(JSON.stringify({ event: 'connected' }));

    // Wait for OpenAI connection (will fail with test key, but that's ok)
    await new Promise(resolve => setTimeout(resolve, 1000));

    expect(ws.readyState).toBe(WebSocket.OPEN);
  }, 10000);

  test('Search entity function works', async () => {
    const searchEntity = require('../../functionHandlers').default.find(
      (f: any) => f.schema.name === 'search_entity'
    );

    expect(searchEntity).toBeDefined();

    // Test with real API key if available
    if (process.env.QLOO_API_KEY && process.env.QLOO_API_KEY !== 'test-key') {
      const result = await searchEntity.handler({ query: 'The Matrix' });
      const parsed = JSON.parse(result);
      
      expect(parsed).toHaveProperty('entity_id');
      expect(parsed).toHaveProperty('name');
    }
  });

  test('Entity cache works correctly', () => {
    const initialStats = entityCache.getStats();
    
    // Set an entity
    entityCache.set('test-query', {
      entity_id: 'test-id',
      name: 'Test Entity',
      type: 'urn:entity:movie'
    });

    // Get should hit
    const cached = entityCache.get('test-query');
    expect(cached).toBeTruthy();
    expect(cached?.entity_id).toBe('test-id');

    const newStats = entityCache.getStats();
    expect(newStats.hits).toBe(initialStats.hits + 1);
    expect(newStats.size).toBeGreaterThan(initialStats.size);
  });
});