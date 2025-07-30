import { WebSocket, WebSocketServer } from 'ws';
import { EventEmitter } from 'events';

interface MockSession {
  id: string;
  tools: any[];
  voice: string;
  instructions: string;
  temperature: number;
}

interface MockScenario {
  name: string;
  toolsDelay?: number;
  toolsAvailable?: boolean;
  errorOnGreeting?: boolean;
  functionCallDelay?: number;
}

export class MockOpenAIRealtimeServer extends EventEmitter {
  private wss: WebSocketServer;
  private sessions: Map<string, MockSession> = new Map();
  private scenario: MockScenario = { name: 'default', toolsAvailable: true };
  private port: number;

  constructor(port: number = 0) {
    super();
    this.port = port;
    this.wss = new WebSocketServer({ port });
    
    this.wss.on('connection', (ws: WebSocket) => {
      this.handleConnection(ws);
    });

    // Get actual port if using 0 (random port)
    this.wss.on('listening', () => {
      const address = this.wss.address();
      if (address && typeof address !== 'string') {
        this.port = address.port;
      }
      this.emit('listening');
    });
  }

  private handleConnection(ws: WebSocket) {
    const sessionId = this.generateSessionId();
    const session: MockSession = {
      id: sessionId,
      tools: [],
      voice: 'alloy',
      instructions: '',
      temperature: 0.8
    };
    this.sessions.set(sessionId, session);

    // Send session.created immediately
    ws.send(JSON.stringify({
      type: 'session.created',
      session: {
        id: sessionId,
        voice: session.voice,
        tools: [], // Always start with 0 tools to match real behavior
        temperature: session.temperature
      }
    }));

    ws.on('message', (data: Buffer) => {
      const message = JSON.parse(data.toString());
      this.handleMessage(ws, session, message);
    });

    ws.on('close', () => {
      this.sessions.delete(sessionId);
    });
  }

  private handleMessage(ws: WebSocket, session: MockSession, message: any) {
    this.emit('message', message);

    switch (message.type) {
      case 'session.update':
        this.handleSessionUpdate(ws, session, message.session);
        break;
      case 'response.create':
        this.handleResponseCreate(ws, session, message.response);
        break;
      case 'conversation.item.create':
        this.handleConversationItemCreate(ws, session, message.item);
        break;
      case 'input_audio_buffer.append':
        // Handle audio input
        break;
    }
  }

  private handleSessionUpdate(ws: WebSocket, session: MockSession, update: any) {
    // Update session with provided values
    if (update.tools) session.tools = update.tools;
    if (update.voice) session.voice = update.voice;
    if (update.instructions) session.instructions = update.instructions;
    if (update.temperature !== undefined) session.temperature = update.temperature;

    // Simulate delay for tools loading if configured
    const delay = this.scenario.toolsDelay || 0;
    
    setTimeout(() => {
      // Send session.updated with actual tools if scenario allows
      const tools = this.scenario.toolsAvailable ? session.tools : [];
      
      ws.send(JSON.stringify({
        type: 'session.updated',
        session: {
          id: session.id,
          voice: session.voice,
          tools: tools,
          instructions: session.instructions,
          temperature: session.temperature
        }
      }));
    }, delay);
  }

  private handleResponseCreate(ws: WebSocket, session: MockSession, response: any) {
    const responseId = this.generateId();
    
    // Send response.created
    ws.send(JSON.stringify({
      type: 'response.created',
      response: { id: responseId }
    }));

    // Check if this is the greeting
    const isGreeting = !response || !response.content;
    
    if (isGreeting && this.scenario.errorOnGreeting) {
      // Simulate error on greeting
      setTimeout(() => {
        ws.send(JSON.stringify({
          type: 'error',
          error: {
            message: 'Function calling not available',
            type: 'invalid_request_error'
          }
        }));
      }, 100);
      return;
    }

    // Simulate assistant response
    this.simulateAssistantResponse(ws, session, responseId, isGreeting);
  }

  private handleConversationItemCreate(ws: WebSocket, session: MockSession, item: any) {
    // Echo back the conversation item created
    ws.send(JSON.stringify({
      type: 'conversation.item.created',
      item: {
        ...item,
        id: this.generateId()
      }
    }));

    // If it's a function call output, trigger a response
    if (item.type === 'function_call_output') {
      setTimeout(() => {
        this.handleResponseCreate(ws, session, {});
      }, 50);
    }
  }

  private simulateAssistantResponse(ws: WebSocket, session: MockSession, responseId: string, isGreeting: boolean) {
    const itemId = this.generateId();
    
    // Send response.output_item.added
    ws.send(JSON.stringify({
      type: 'response.output_item.added',
      response_id: responseId,
      item: { id: itemId }
    }));

    // Send conversation.item.created
    ws.send(JSON.stringify({
      type: 'conversation.item.created',
      item: {
        id: itemId,
        type: 'message',
        role: 'assistant'
      }
    }));

    if (isGreeting) {
      // Simulate greeting text
      this.simulateTextResponse(ws, responseId, itemId, 
        "Hey, it's QlooPhone. Can't decide what to do? I got you. Name two things you love - I'll find your perfect match.");
    } else {
      // Check for function calling patterns
      const shouldCallFunctions = this.checkForFunctionCallPatterns(session);
      
      if (shouldCallFunctions && session.tools.length > 0) {
        // Simulate immediate acknowledgment
        this.simulateTextResponse(ws, responseId, itemId, "Oh, interesting combo...");
        
        // Then trigger function calls
        setTimeout(() => {
          this.simulateFunctionCalls(ws, session, responseId);
        }, this.scenario.functionCallDelay || 100);
      } else {
        // Normal text response
        this.simulateTextResponse(ws, responseId, itemId, "I'd love to help, but I need you to tell me what you enjoy first.");
      }
    }

    // Send response.done
    setTimeout(() => {
      ws.send(JSON.stringify({
        type: 'response.output_item.done',
        response_id: responseId,
        item: { id: itemId }
      }));
      
      ws.send(JSON.stringify({
        type: 'response.done',
        response: { id: responseId }
      }));
    }, 200);
  }

  private simulateTextResponse(ws: WebSocket, responseId: string, itemId: string, text: string) {
    // Simulate text delta events
    const words = text.split(' ');
    words.forEach((word, index) => {
      setTimeout(() => {
        ws.send(JSON.stringify({
          type: 'response.text.delta',
          response_id: responseId,
          item_id: itemId,
          delta: word + (index < words.length - 1 ? ' ' : '')
        }));
      }, index * 50);
    });

    // Send text.done
    setTimeout(() => {
      ws.send(JSON.stringify({
        type: 'response.text.done',
        response_id: responseId,
        item_id: itemId,
        text: text
      }));
    }, words.length * 50 + 100);
  }

  private checkForFunctionCallPatterns(_session: MockSession): boolean {
    // This would check conversation history for patterns
    // For now, return true to always trigger functions when available
    return true;
  }

  private simulateFunctionCalls(ws: WebSocket, session: MockSession, responseId: string) {
    // Find search_entity tool
    const searchEntityTool = session.tools.find(t => t.name === 'search_entity');
    if (!searchEntityTool) return;

    // Simulate searching for two entities
    const entities = ['The Matrix', 'Jazz Music'];
    
    entities.forEach((entity, index) => {
      setTimeout(() => {
        const callId = this.generateId();
        const functionItemId = this.generateId();
        
        // Create function call item
        ws.send(JSON.stringify({
          type: 'response.output_item.added',
          response_id: responseId,
          item: {
            id: functionItemId,
            type: 'function_call',
            name: 'search_entity',
            call_id: callId
          }
        }));

        // Send function call arguments
        ws.send(JSON.stringify({
          type: 'response.function_call_arguments.done',
          response_id: responseId,
          item_id: functionItemId,
          arguments: JSON.stringify({ query: entity })
        }));

        // Send output_item.done
        ws.send(JSON.stringify({
          type: 'response.output_item.done',
          response_id: responseId,
          item: {
            id: functionItemId,
            type: 'function_call',
            name: 'search_entity',
            call_id: callId,
            arguments: JSON.stringify({ query: entity })
          }
        }));
      }, index * 200);
    });

    // After entity searches, trigger recommendation
    setTimeout(() => {
      const recommendTool = session.tools.find(t => t.name === 'get_recommendation');
      if (recommendTool) {
        const callId = this.generateId();
        const functionItemId = this.generateId();
        
        ws.send(JSON.stringify({
          type: 'response.output_item.done',
          response_id: responseId,
          item: {
            id: functionItemId,
            type: 'function_call',
            name: 'get_recommendation',
            call_id: callId,
            arguments: JSON.stringify({
              entity_ids: 'mock-id-1,mock-id-2',
              output_type: 'urn:entity:movie'
            })
          }
        }));
      }
    }, 600);
  }

  public setScenario(scenario: Partial<MockScenario>) {
    this.scenario = { ...this.scenario, ...scenario };
  }

  public getPort(): number {
    return this.port;
  }

  public async close(): Promise<void> {
    return new Promise((resolve) => {
      this.wss.close(() => resolve());
    });
  }

  private generateSessionId(): string {
    return 'MS' + Math.random().toString(36).substr(2, 9);
  }

  private generateId(): string {
    return 'mock_' + Math.random().toString(36).substr(2, 9);
  }

  // Helper method to simulate user audio transcription
  public simulateUserTranscription(ws: WebSocket, text: string) {
    const itemId = this.generateId();
    
    ws.send(JSON.stringify({
      type: 'conversation.item.created',
      item: {
        id: itemId,
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text: text
        }]
      }
    }));

    // Also send transcription events
    ws.send(JSON.stringify({
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: itemId,
      transcript: text
    }));
  }
}