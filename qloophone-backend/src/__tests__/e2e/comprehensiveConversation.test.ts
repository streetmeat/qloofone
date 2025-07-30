import { Server } from 'http';
import { AddressInfo } from 'net';
import WebSocket from 'ws';
import { MockOpenAIRealtimeServer } from '../mocks/mockOpenAIRealtimeServer';
import { 
  ConversationRecorder, 
  connectTwilioCall, 
  simulateUserSpeech,
  createFunctionCallResult
} from '../utils/conversationTestHelpers';
import { 
  TEST_ENTITIES, 
  ENTITY_COMBINATIONS, 
  getRandomEntity,
  SEARCH_VARIATIONS
} from '../fixtures/testEntities';
import { 
  CONVERSATION_SCENARIOS
} from '../fixtures/conversationScenarios';
import { entityCache } from '../../entityCache';

describe('Comprehensive Conversation Flow Tests', () => {
  let server: Server;
  let mockOpenAI: MockOpenAIRealtimeServer;
  let wsUrl: string;
  
  // Store the original WebSocket to restore later
  const originalWebSocket = (global as any).WebSocket;
  
  beforeAll(async () => {
    // Set up environment
    process.env.OPENAI_API_KEY = 'test-key-comprehensive';
    process.env.QLOO_API_KEY = process.env.QLOO_API_KEY || 'test-key';
    process.env.PORT = '0';
    process.env.PUBLIC_URL = 'https://test.example.com';

    // Clear module cache
    jest.resetModules();
    
    // Import server
    const serverModule = await import('../../server');
    server = serverModule.server;
    
    // Wait for server to start
    await new Promise((resolve) => {
      if (server.listening) resolve(undefined);
      else server.once('listening', resolve);
    });
    
    const address = server.address() as AddressInfo;
    wsUrl = `ws://localhost:${address.port}`;
    
    // Create mock OpenAI server
    mockOpenAI = new MockOpenAIRealtimeServer();
    await new Promise(resolve => {
      mockOpenAI.once('listening', resolve);
    });
    
    // Override WebSocket to connect to our mock
    const mockOpenAIPort = mockOpenAI.getPort();
    (global as any).WebSocket = class extends WebSocket {
      constructor(url: string | URL, options?: any) {
        // Intercept OpenAI connections
        if (typeof url === 'string' && url.includes('api.openai.com')) {
          super(`ws://localhost:${mockOpenAIPort}`, options);
        } else {
          super(url, options);
        }
      }
    };
  });

  afterAll(async () => {
    // Restore original WebSocket
    (global as any).WebSocket = originalWebSocket;
    
    // Close mock OpenAI server
    await mockOpenAI.close();
    
    // Close main server
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
    // Clear entity cache between tests
    entityCache.clear();
    
    // Reset mock OpenAI scenario
    mockOpenAI.setScenario({ 
      name: 'default', 
      toolsAvailable: true,
      toolsDelay: 100 // Small delay to simulate real behavior
    });
  });

  describe('Entity Type Combinations', () => {
    // Test all 36 combinations
    ENTITY_COMBINATIONS.forEach(({ input1, input2, output }) => {
      test(`${input1} + ${input2} → ${output}`, async () => {
        const entity1 = getRandomEntity(input1 as keyof typeof TEST_ENTITIES);
        const entity2 = getRandomEntity(input2 as keyof typeof TEST_ENTITIES);
        const outputType = `urn:entity:${output}`;
        
        const conversation = new ConversationRecorder();
        const twilioWs = await connectTwilioCall(wsUrl);
        conversation.attachToWebSocket(twilioWs);
        
        try {
          // Wait for greeting
          await conversation.waitForAssistantSpeech(/Hey, it's QlooPhone/);
          
          // User request
          const userInput = `I love ${entity1.query} and ${entity2.query}. What ${output.replace('_', ' ')} would you recommend?`;
          await simulateUserSpeech(twilioWs, userInput);
          
          // Mock OpenAI should respond with acknowledgment
          mockOpenAI.simulateUserTranscription(twilioWs, userInput);
          
          // Wait for acknowledgment
          await conversation.waitForAssistantSpeech(/interesting|perfect|great/, 3000);
          
          // Verify function calls
          const search1 = await conversation.waitForFunctionCall('search_entity', 
            { query: expect.stringContaining(entity1.query.split(' ')[0]) }
          );
          
          const search2 = await conversation.waitForFunctionCall('search_entity',
            { query: expect.stringContaining(entity2.query.split(' ')[0]) }
          );
          
          // Simulate function responses
          twilioWs.send(JSON.stringify(createFunctionCallResult(search1.call_id, {
            entity_id: `test-id-1`,
            name: entity1.query,
            type: entity1.type
          })));
          
          twilioWs.send(JSON.stringify(createFunctionCallResult(search2.call_id, {
            entity_id: `test-id-2`,
            name: entity2.query,
            type: entity2.type
          })));
          
          // Wait for recommendation call with correct output type
          const recommendation = await conversation.waitForFunctionCall('get_recommendation', {
            entity_ids: expect.any(String),
            output_type: outputType
          });
          
          expect(recommendation.arguments.output_type).toBe(outputType);
          
          // Verify conversation completed successfully
          const transcript = conversation.getTranscript();
          expect(transcript).toContain(entity1.query);
          expect(transcript).toContain(entity2.query);
          
        } finally {
          twilioWs.close();
        }
      }, 20000);
    });
  });

  describe('Cache Behavior', () => {
    test('First call hits API, second hits cache', async () => {
      const testEntity = 'Inception Movie Unique Test';
      const conversation1 = new ConversationRecorder();
      const conversation2 = new ConversationRecorder();
      
      // First call - should miss cache
      const twilioWs1 = await connectTwilioCall(wsUrl);
      conversation1.attachToWebSocket(twilioWs1);
      
      await conversation1.waitForAssistantSpeech(/Hey, it's QlooPhone/);
      await simulateUserSpeech(twilioWs1, `I love ${testEntity}`);
      mockOpenAI.simulateUserTranscription(twilioWs1, `I love ${testEntity}`);
      
      await conversation1.waitForFunctionCall('search_entity', { query: testEntity });
      
      // Check cache stats
      const statsAfterFirst = entityCache.getStats();
      
      twilioWs1.close();
      
      // Second call - should hit cache
      const twilioWs2 = await connectTwilioCall(wsUrl);
      conversation2.attachToWebSocket(twilioWs2);
      
      await conversation2.waitForAssistantSpeech(/Hey, it's QlooPhone/);
      await simulateUserSpeech(twilioWs2, `I love ${testEntity}`);
      mockOpenAI.simulateUserTranscription(twilioWs2, `I love ${testEntity}`);
      
      await conversation2.waitForFunctionCall('search_entity', { query: testEntity });
      
      const statsAfterSecond = entityCache.getStats();
      
      // Verify cache was hit
      expect(statsAfterSecond.hits).toBeGreaterThan(statsAfterFirst.hits);
      expect(statsAfterSecond.misses).toBe(statsAfterFirst.misses + 1); // Only first was a miss
      
      twilioWs2.close();
    }, 20000);

    test('Different variations bypass cache', async () => {
      const variations = [
        'The Matrix',
        'the matrix',
        'The Matrix 1999',
        'Matrix movie'
      ];
      
      for (const variation of variations) {
        const conversation = new ConversationRecorder();
        const twilioWs = await connectTwilioCall(wsUrl);
        conversation.attachToWebSocket(twilioWs);
        
        await conversation.waitForAssistantSpeech(/Hey, it's QlooPhone/);
        await simulateUserSpeech(twilioWs, `I love ${variation}`);
        mockOpenAI.simulateUserTranscription(twilioWs, `I love ${variation}`);
        
        await conversation.waitForFunctionCall('search_entity', { query: variation });
        
        twilioWs.close();
      }
      
      // Each variation should create a separate cache entry
      const stats = entityCache.getStats();
      expect(stats.size).toBeGreaterThanOrEqual(variations.length);
    }, 30000);
  });

  describe('Search Robustness', () => {
    SEARCH_VARIATIONS.filter(v => v.shouldFind).forEach(variation => {
      test(`Finds entity with query: "${variation.query}"`, async () => {
        const conversation = new ConversationRecorder();
        const twilioWs = await connectTwilioCall(wsUrl);
        conversation.attachToWebSocket(twilioWs);
        
        await conversation.waitForAssistantSpeech(/Hey, it's QlooPhone/);
        const input = `I love ${variation.query}`;
        await simulateUserSpeech(twilioWs, input);
        mockOpenAI.simulateUserTranscription(twilioWs, input);
        
        const search = await conversation.waitForFunctionCall('search_entity', 
          { query: variation.query }
        );
        
        // Simulate successful search
        twilioWs.send(JSON.stringify(createFunctionCallResult(search.call_id, {
          entity_id: 'found-id',
          name: 'Found Entity',
          type: 'urn:entity:movie'
        })));
        
        twilioWs.close();
      }, 10000);
    });
  });

  describe('Function Availability Issues', () => {
    test('Functions unavailable on first attempt', async () => {
      // Configure mock to simulate the issue
      mockOpenAI.setScenario({
        name: 'tools-delayed',
        toolsAvailable: false, // First update won't have tools
        errorOnGreeting: true
      });
      
      const conversation = new ConversationRecorder();
      const twilioWs = await connectTwilioCall(wsUrl);
      conversation.attachToWebSocket(twilioWs);
      
      // Should get greeting but then error
      await conversation.waitForAssistantSpeech(/Hey, it's QlooPhone/);
      
      const userInput = "I love The Matrix and jazz music";
      await simulateUserSpeech(twilioWs, userInput);
      mockOpenAI.simulateUserTranscription(twilioWs, userInput);
      
      // Should get an error
      const error = await conversation.waitForError(5000);
      expect(error.message).toContain('Function calling not available');
      
      twilioWs.close();
    }, 15000);

    test('Functions work after explicit request', async () => {
      const conversation = new ConversationRecorder();
      const twilioWs = await connectTwilioCall(wsUrl);
      conversation.attachToWebSocket(twilioWs);
      
      await conversation.waitForAssistantSpeech(/Hey, it's QlooPhone/);
      
      // First ask about tools
      await simulateUserSpeech(twilioWs, "What tools do you have?");
      mockOpenAI.simulateUserTranscription(twilioWs, "What tools do you have?");
      
      await conversation.waitForAssistantSpeech(/search|recommendation|tools/);
      
      // Now try to use them
      const userInput = "I love Inception and Radiohead";
      await simulateUserSpeech(twilioWs, userInput);
      mockOpenAI.simulateUserTranscription(twilioWs, userInput);
      
      // Should work now
      await conversation.waitForFunctionCall('search_entity', { query: expect.stringContaining('Inception') });
      await conversation.waitForFunctionCall('search_entity', { query: expect.stringContaining('Radiohead') });
      
      twilioWs.close();
    }, 20000);
  });

  describe('Conversation Scenarios', () => {
    CONVERSATION_SCENARIOS.forEach(scenario => {
      test(scenario.name, async () => {
        const conversation = new ConversationRecorder();
        const twilioWs = await connectTwilioCall(wsUrl);
        conversation.attachToWebSocket(twilioWs);
        
        let functionCallCount = 0;
        
        for (const step of scenario.steps) {
          if (step.speaker === 'user') {
            await simulateUserSpeech(twilioWs, step.text);
            mockOpenAI.simulateUserTranscription(twilioWs, step.text);
            
            // Wait for expected functions
            if (step.expectedFunctions) {
              for (const expectedFunc of step.expectedFunctions) {
                const funcCall = await conversation.waitForFunctionCall(
                  expectedFunc.name,
                  expectedFunc.args
                );
                functionCallCount++;
                
                // Simulate function response
                if (expectedFunc.name === 'search_entity') {
                  twilioWs.send(JSON.stringify(createFunctionCallResult(funcCall.call_id, {
                    entity_id: `mock-id-${functionCallCount}`,
                    name: expectedFunc.args?.query || 'Mock Entity',
                    type: 'urn:entity:movie'
                  })));
                } else if (expectedFunc.name === 'get_recommendation') {
                  twilioWs.send(JSON.stringify(createFunctionCallResult(funcCall.call_id, {
                    recommendations: [{
                      entity_id: 'rec-1',
                      name: 'Mock Recommendation',
                      score: 0.95
                    }]
                  })));
                }
              }
            }
          } else if (step.speaker === 'assistant') {
            // Wait for assistant response containing key words
            const keywords = step.text.match(/\b(\w+)\b/g)?.slice(0, 3) || [];
            if (keywords.length > 0) {
              await conversation.waitForAssistantSpeech(new RegExp(keywords.join('|'), 'i'));
            }
          }
        }
        
        // Verify outcome
        expect(functionCallCount).toBe(scenario.expectedOutcome.functionCallCount);
        
        twilioWs.close();
      }, 30000);
    });
  });

  describe('Performance and Timing', () => {
    test('Immediate acknowledgment within 1 second', async () => {
      const conversation = new ConversationRecorder();
      const twilioWs = await connectTwilioCall(wsUrl);
      conversation.attachToWebSocket(twilioWs);
      
      await conversation.waitForAssistantSpeech(/Hey, it's QlooPhone/);
      
      const userInput = "I love The Matrix and Daft Punk";
      const startTime = Date.now();
      
      await simulateUserSpeech(twilioWs, userInput);
      mockOpenAI.simulateUserTranscription(twilioWs, userInput);
      
      // Should acknowledge quickly
      await conversation.waitForAssistantSpeech(/interesting|perfect|combo/, 1500);
      
      const ackTime = Date.now() - startTime;
      expect(ackTime).toBeLessThan(1500); // Should acknowledge within 1.5s
      
      twilioWs.close();
    }, 10000);

    test('Complete recommendation flow under 10 seconds', async () => {
      const conversation = new ConversationRecorder();
      const twilioWs = await connectTwilioCall(wsUrl);
      conversation.attachToWebSocket(twilioWs);
      
      await conversation.waitForAssistantSpeech(/Hey, it's QlooPhone/);
      
      const startTime = Date.now();
      const userInput = "I love Inception and classical music, recommend a movie";
      
      await simulateUserSpeech(twilioWs, userInput);
      mockOpenAI.simulateUserTranscription(twilioWs, userInput);
      
      // Wait for all function calls
      const search1 = await conversation.waitForFunctionCall('search_entity');
      const search2 = await conversation.waitForFunctionCall('search_entity');
      
      // Simulate quick responses
      twilioWs.send(JSON.stringify(createFunctionCallResult(search1.call_id, {
        entity_id: 'inc-1',
        name: 'Inception',
        type: 'urn:entity:movie'
      })));
      
      twilioWs.send(JSON.stringify(createFunctionCallResult(search2.call_id, {
        entity_id: 'class-1',
        name: 'Classical Music',
        type: 'urn:entity:music'
      })));
      
      const rec = await conversation.waitForFunctionCall('get_recommendation');
      
      twilioWs.send(JSON.stringify(createFunctionCallResult(rec.call_id, {
        recommendations: [{
          entity_id: 'inter-1',
          name: 'Interstellar',
          score: 0.98
        }]
      })));
      
      // Wait for final recommendation
      await conversation.waitForAssistantSpeech(/Interstellar|recommend/);
      
      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(10000); // Should complete within 10s
      
      twilioWs.close();
    }, 15000);
  });
});