import { Server } from 'http';
import { AddressInfo } from 'net';
import WebSocket from 'ws';
import { 
  ENTITY_COMBINATIONS,
  TEST_ENTITIES,
  getRandomEntity
} from '../fixtures/testEntities';
import { entityCache } from '../../entityCache';

/**
 * True End-to-End Conversation Test
 * 
 * This test suite simulates the EXACT user experience with:
 * - Real OpenAI Realtime API connection
 * - Real Qloo API calls
 * - No mocks or fake data
 * - Complete conversation flow
 * 
 * Requirements:
 * - Valid OPENAI_API_KEY with Realtime API access
 * - Valid QLOO_API_KEY
 * - Running server with proper configuration
 */

// Skip tests if no real API keys are available
const hasRealKeys = 
  process.env.OPENAI_API_KEY && 
  process.env.OPENAI_API_KEY !== 'test-key' &&
  process.env.QLOO_API_KEY && 
  process.env.QLOO_API_KEY !== 'test-key';

const describeIfRealKeys = hasRealKeys ? describe : describe.skip;

// Helper to track conversation events
interface ConversationEvent {
  timestamp: number;
  type: string;
  data: any;
}

class RealConversationTracker {
  private events: ConversationEvent[] = [];
  private functionCalls: Map<string, any> = new Map();
  private ws: WebSocket;

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.attachListeners();
  }

  private attachListeners() {
    this.ws.on('message', (data: Buffer) => {
      const message = JSON.parse(data.toString());
      this.events.push({
        timestamp: Date.now(),
        type: message.type,
        data: message
      });

      // Track function calls
      if (message.type === 'response.output_item.done' && 
          message.item?.type === 'function_call') {
        this.functionCalls.set(message.item.call_id, {
          name: message.item.name,
          arguments: JSON.parse(message.item.arguments || '{}'),
          timestamp: Date.now()
        });
      }
    });
  }

  async waitForGreeting(timeout: number = 10000): Promise<string> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const greetingEvent = this.events.find(e => 
        e.type === 'response.audio_transcript.done' &&
        e.data.transcript?.toLowerCase().includes('qloophone')
      );
      
      if (greetingEvent) {
        return greetingEvent.data.transcript;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error('Timeout waiting for greeting');
  }

  async waitForFunctionCall(
    functionName: string, 
    timeout: number = 10000
  ): Promise<any> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const funcCall = Array.from(this.functionCalls.values()).find(
        fc => fc.name === functionName
      );
      
      if (funcCall) {
        return funcCall;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error(`Timeout waiting for function call: ${functionName}`);
  }

  async waitForRecommendation(timeout: number = 15000): Promise<any> {
    const recommendationCall = await this.waitForFunctionCall('get_recommendation', timeout);
    
    // Wait for the response to be spoken
    const startTime = Date.now();
    while (Date.now() - startTime < 5000) {
      const responseEvent = this.events.find(e => 
        e.type === 'response.audio_transcript.done' &&
        e.timestamp > recommendationCall.timestamp
      );
      
      if (responseEvent) {
        return {
          functionCall: recommendationCall,
          spokenResponse: responseEvent.data.transcript
        };
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return { functionCall: recommendationCall, spokenResponse: null };
  }

  getEvents(): ConversationEvent[] {
    return [...this.events];
  }

  getFunctionCalls(): any[] {
    return Array.from(this.functionCalls.values());
  }
}

describeIfRealKeys('Real End-to-End Conversation Tests', () => {
  let server: Server;
  let wsUrl: string;
  
  beforeAll(async () => {
    // Start server with real credentials
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
    if (server && server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }, 30000);

  beforeEach(() => {
    // Clear cache before each test
    entityCache.clear();
  });

  describe('Full Conversation Flow', () => {
    test('Complete user experience with real APIs', async () => {
      // 1. Connect as Twilio would
      const twilioWs = new WebSocket(`${wsUrl}/call`);
      
      await new Promise((resolve, reject) => {
        twilioWs.once('open', resolve);
        twilioWs.once('error', reject);
      });

      const tracker = new RealConversationTracker(twilioWs);

      // 2. Send Twilio start event
      twilioWs.send(JSON.stringify({
        event: 'start',
        start: {
          streamSid: 'real-test-' + Date.now(),
          accountSid: 'AC' + 'x'.repeat(30),
          callSid: 'CA' + 'x'.repeat(30),
          tracks: ['inbound', 'outbound'],
          mediaFormat: {
            encoding: 'audio/x-mulaw',
            sampleRate: 8000,
            channels: 1
          }
        }
      }));

      await new Promise(resolve => setTimeout(resolve, 100));

      // 3. Send connected event
      twilioWs.send(JSON.stringify({ event: 'connected' }));

      // 4. Wait for OpenAI connection and greeting
      const greeting = await tracker.waitForGreeting(15000);
      expect(greeting.toLowerCase()).toContain('qloophone');
      console.log('Received greeting:', greeting);

      // 5. Simulate user speaking (via text input to OpenAI)
      const userInput = "I love The Matrix and Radiohead. What TV show should I watch?";
      
      // Send as conversation item (how OpenAI expects user input in Realtime API)
      twilioWs.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{
            type: 'input_text',
            text: userInput
          }]
        }
      }));

      // Trigger response
      twilioWs.send(JSON.stringify({
        type: 'response.create'
      }));

      // 6. Wait for real function calls
      console.log('Waiting for entity searches...');
      const search1 = await tracker.waitForFunctionCall('search_entity', 20000);
      console.log('First search:', search1);
      
      const search2 = await tracker.waitForFunctionCall('search_entity', 20000);
      console.log('Second search:', search2);

      // 7. Wait for recommendation
      console.log('Waiting for recommendation...');
      const result = await tracker.waitForRecommendation(30000);
      console.log('Recommendation received:', result);

      // 8. Validate the complete flow
      expect(search1.arguments.query).toBeTruthy();
      expect(search2.arguments.query).toBeTruthy();
      expect(result.functionCall.arguments.output_type).toBe('urn:entity:tv_show');
      
      if (result.spokenResponse) {
        console.log('Assistant said:', result.spokenResponse);
      }

      // 9. Check performance
      const events = tracker.getEvents();
      const startTime = events[0].timestamp;
      const endTime = events[events.length - 1].timestamp;
      const totalTime = endTime - startTime;
      
      console.log(`Total conversation time: ${totalTime}ms`);
      expect(totalTime).toBeLessThan(30000); // Should complete within 30 seconds

      twilioWs.close();
    }, 60000); // 60 second timeout for full conversation
  });

  describe('Entity Combination Tests', () => {
    // Test first 5 combinations with real APIs
    ENTITY_COMBINATIONS.slice(0, 5).forEach(({ input1, input2, output }) => {
      test(`Real API: ${input1} + ${input2} → ${output}`, async () => {
        const entity1 = getRandomEntity(input1 as keyof typeof TEST_ENTITIES);
        const entity2 = getRandomEntity(input2 as keyof typeof TEST_ENTITIES);
        
        const twilioWs = new WebSocket(`${wsUrl}/call`);
        await new Promise((resolve) => twilioWs.once('open', resolve));
        
        const tracker = new RealConversationTracker(twilioWs);

        // Start call
        twilioWs.send(JSON.stringify({
          event: 'start',
          start: {
            streamSid: 'combo-test-' + Date.now(),
            accountSid: 'ACtest',
            callSid: 'CAtest',
            tracks: ['inbound', 'outbound']
          }
        }));

        await new Promise(resolve => setTimeout(resolve, 100));
        twilioWs.send(JSON.stringify({ event: 'connected' }));

        // Wait for greeting
        await tracker.waitForGreeting();

        // Send user input
        const userInput = `I enjoy ${entity1.query} and ${entity2.query}. What ${output.replace('_', ' ')} would you recommend?`;
        
        twilioWs.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [{
              type: 'input_text',
              text: userInput
            }]
          }
        }));

        twilioWs.send(JSON.stringify({
          type: 'response.create'
        }));

        // Track the full flow
        const recommendation = await tracker.waitForRecommendation(30000);
        
        // Validate correct output type was used
        expect(recommendation.functionCall.arguments.output_type).toBe(`urn:entity:${output}`);
        
        console.log(`✓ ${input1} + ${input2} → ${output}: Success`);
        
        twilioWs.close();
      }, 45000);
    });
  });

  describe('Performance Tests', () => {
    test('Response time under 6 seconds', async () => {
      const twilioWs = new WebSocket(`${wsUrl}/call`);
      await new Promise((resolve) => twilioWs.once('open', resolve));
      
      const tracker = new RealConversationTracker(twilioWs);

      // Start call
      twilioWs.send(JSON.stringify({
        event: 'start',
        start: { streamSid: 'perf-test-' + Date.now() }
      }));
      
      twilioWs.send(JSON.stringify({ event: 'connected' }));
      await tracker.waitForGreeting();

      const inputTime = Date.now();
      
      // Simple query
      twilioWs.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{
            type: 'input_text',
            text: "I like Inception and jazz music"
          }]
        }
      }));

      twilioWs.send(JSON.stringify({
        type: 'response.create'
      }));

      // Wait for first response
      const events = tracker.getEvents();
      let responseTime = 0;
      
      // Poll for audio response
      for (let i = 0; i < 60; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        const audioEvent = events.find(e => 
          e.type === 'response.audio.delta' && 
          e.timestamp > inputTime
        );
        if (audioEvent) {
          responseTime = audioEvent.timestamp - inputTime;
          break;
        }
      }

      console.log(`Response time: ${responseTime}ms`);
      expect(responseTime).toBeGreaterThan(0);
      expect(responseTime).toBeLessThan(6000);
      
      twilioWs.close();
    }, 30000);
  });

  describe('Error Scenarios', () => {
    test('Handles non-existent entity gracefully', async () => {
      const twilioWs = new WebSocket(`${wsUrl}/call`);
      await new Promise((resolve) => twilioWs.once('open', resolve));
      
      const tracker = new RealConversationTracker(twilioWs);

      twilioWs.send(JSON.stringify({
        event: 'start',
        start: { streamSid: 'error-test-' + Date.now() }
      }));
      
      twilioWs.send(JSON.stringify({ event: 'connected' }));
      await tracker.waitForGreeting();

      // Send query with non-existent entity
      twilioWs.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{
            type: 'input_text',
            text: "I love XYZ123NonExistentMovie and The Beatles"
          }]
        }
      }));

      twilioWs.send(JSON.stringify({
        type: 'response.create'
      }));

      // Should still get a response
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      const events = tracker.getEvents();
      const errorResponse = events.find(e => 
        e.type === 'response.audio_transcript.done' &&
        (e.data.transcript?.includes("couldn't find") || 
         e.data.transcript?.includes("Could you tell me more"))
      );
      
      expect(errorResponse).toBeTruthy();
      
      twilioWs.close();
    }, 30000);
  });
});