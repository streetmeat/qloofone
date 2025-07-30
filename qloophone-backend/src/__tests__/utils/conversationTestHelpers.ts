import WebSocket from 'ws';
import { EventEmitter } from 'events';

export interface ConversationEvent {
  timestamp: number;
  type: 'user' | 'assistant' | 'function_call' | 'function_result' | 'system';
  content: string;
  metadata?: any;
}

export interface FunctionCall {
  name: string;
  arguments: any;
  call_id: string;
}

export class ConversationRecorder extends EventEmitter {
  private events: ConversationEvent[] = [];
  private functionCalls: FunctionCall[] = [];

  constructor() {
    super();
  }

  attachToWebSocket(ws: WebSocket) {
    ws.on('message', (data: Buffer) => {
      const message = JSON.parse(data.toString());
      this.handleMessage(message);
    });
  }

  private handleMessage(message: any) {
    const timestamp = Date.now();

    switch (message.type) {
      case 'conversation.item.created':
        if (message.item.role === 'user') {
          const text = message.item.content?.[0]?.text || 
                       message.item.content?.[0]?.transcript || 
                       '[audio]';
          this.addEvent({
            timestamp,
            type: 'user',
            content: text
          });
        } else if (message.item.role === 'assistant') {
          // Assistant message will be built from deltas
        }
        break;

      case 'response.text.delta':
        // Accumulate text deltas
        break;

      case 'response.text.done':
        this.addEvent({
          timestamp,
          type: 'assistant',
          content: message.text
        });
        break;

      case 'response.output_item.done':
        if (message.item?.type === 'function_call') {
          const funcCall: FunctionCall = {
            name: message.item.name,
            arguments: JSON.parse(message.item.arguments || '{}'),
            call_id: message.item.call_id
          };
          this.functionCalls.push(funcCall);
          this.addEvent({
            timestamp,
            type: 'function_call',
            content: `Calling ${funcCall.name}(${JSON.stringify(funcCall.arguments)})`,
            metadata: funcCall
          });
          this.emit('function_call', funcCall);
        }
        break;

      case 'conversation.item.input_audio_transcription.completed':
        // Capture user transcriptions
        this.addEvent({
          timestamp,
          type: 'user',
          content: message.transcript
        });
        break;

      case 'error':
        this.addEvent({
          timestamp,
          type: 'system',
          content: `Error: ${message.error?.message || 'Unknown error'}`,
          metadata: message.error
        });
        this.emit('error', message.error);
        break;
    }

    // Emit raw message for detailed tracking
    this.emit('message', message);
  }

  private addEvent(event: ConversationEvent) {
    this.events.push(event);
    this.emit('event', event);
  }

  async waitForAssistantSpeech(pattern: RegExp | string, timeout: number = 5000): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout waiting for assistant speech matching: ${pattern}`));
      }, timeout);

      const checkExisting = () => {
        const found = this.events.find(e => 
          e.type === 'assistant' && 
          (typeof pattern === 'string' ? e.content.includes(pattern) : pattern.test(e.content))
        );
        if (found) {
          clearTimeout(timeoutId);
          resolve(found.content);
          return true;
        }
        return false;
      };

      // Check existing events first
      if (checkExisting()) return;

      // Listen for new events
      const listener = (event: ConversationEvent) => {
        if (event.type === 'assistant') {
          if (typeof pattern === 'string' ? event.content.includes(pattern) : pattern.test(event.content)) {
            clearTimeout(timeoutId);
            this.off('event', listener);
            resolve(event.content);
          }
        }
      };

      this.on('event', listener);
    });
  }

  async waitForFunctionCall(functionName: string, expectedArgs?: Partial<any>, timeout: number = 5000): Promise<FunctionCall> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout waiting for function call: ${functionName}`));
      }, timeout);

      const checkExisting = () => {
        const found = this.functionCalls.find(fc => {
          if (fc.name !== functionName) return false;
          if (expectedArgs) {
            return Object.entries(expectedArgs).every(([key, value]) => 
              fc.arguments[key] === value || 
              (value === expect.any(String) && typeof fc.arguments[key] === 'string')
            );
          }
          return true;
        });
        if (found) {
          clearTimeout(timeoutId);
          resolve(found);
          return true;
        }
        return false;
      };

      // Check existing calls first
      if (checkExisting()) return;

      // Listen for new function calls
      const listener = (funcCall: FunctionCall) => {
        if (funcCall.name === functionName) {
          if (!expectedArgs || Object.entries(expectedArgs).every(([key, value]) => 
            funcCall.arguments[key] === value ||
            (value === expect.any(String) && typeof funcCall.arguments[key] === 'string')
          )) {
            clearTimeout(timeoutId);
            this.off('function_call', listener);
            resolve(funcCall);
          }
        }
      };

      this.on('function_call', listener);
    });
  }

  async waitForError(timeout: number = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('No error occurred within timeout'));
      }, timeout);

      const listener = (error: any) => {
        clearTimeout(timeoutId);
        this.off('error', listener);
        resolve(error);
      };

      this.on('error', listener);
    });
  }

  getTranscript(): string {
    return this.events
      .map(e => `[${e.type.toUpperCase()}]: ${e.content}`)
      .join('\n');
  }

  getEvents(): ConversationEvent[] {
    return [...this.events];
  }

  getFunctionCalls(): FunctionCall[] {
    return [...this.functionCalls];
  }

  clear() {
    this.events = [];
    this.functionCalls = [];
  }
}

export async function simulateUserSpeech(twilioWs: WebSocket, text: string, _streamSid: string = 'test-stream') {
  // First send some audio chunks to simulate speech
  const audioChunks = generateMockAudioChunks(text.length);
  
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
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  // OpenAI will handle the transcription
  // In real scenario, OpenAI would detect speech and transcribe it
  // For testing, we can simulate the transcription event
  return text;
}

export async function connectTwilioCall(
  wsUrl: string, 
  streamSid: string = 'test-stream-' + Date.now()
): Promise<WebSocket> {
  const twilioWs = new WebSocket(`${wsUrl}/call`);
  
  await new Promise((resolve, reject) => {
    twilioWs.once('open', resolve);
    twilioWs.once('error', reject);
  });

  // Send start event
  twilioWs.send(JSON.stringify({
    event: 'start',
    start: {
      streamSid: streamSid,
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

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 100));

  // Send connected event
  twilioWs.send(JSON.stringify({ event: 'connected' }));

  // Wait for connection to be established
  await new Promise(resolve => setTimeout(resolve, 200));

  return twilioWs;
}

export async function connectFrontendMonitor(wsUrl: string): Promise<WebSocket> {
  const frontendWs = new WebSocket(`${wsUrl}/logs`);
  
  await new Promise((resolve, reject) => {
    frontendWs.once('open', resolve);
    frontendWs.once('error', reject);
  });

  // Wait for connection established message
  await new Promise(resolve => {
    frontendWs.once('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'connection.established') {
        resolve(undefined);
      }
    });
  });

  return frontendWs;
}

function generateMockAudioChunks(textLength: number): string[] {
  // Generate fake base64 audio chunks based on text length
  // More text = more chunks to simulate longer speech
  const numChunks = Math.max(2, Math.floor(textLength / 20));
  const chunks: string[] = [];
  
  // These are valid but silent μ-law audio chunks
  const baseChunk = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
  
  for (let i = 0; i < numChunks; i++) {
    chunks.push(baseChunk);
  }
  
  return chunks;
}

export function createFunctionCallResult(call_id: string, result: any): any {
  return {
    type: 'conversation.item.create',
    item: {
      type: 'function_call_output',
      call_id: call_id,
      output: JSON.stringify(result)
    }
  };
}

export async function simulateFullConversation(
  twilioWs: WebSocket,
  _mockOpenAI: WebSocket,
  userInput: string,
  expectedFunctions: string[]
): Promise<ConversationRecorder> {
  const recorder = new ConversationRecorder();
  recorder.attachToWebSocket(twilioWs);

  // Simulate user speech
  await simulateUserSpeech(twilioWs, userInput);

  // Mock OpenAI should transcribe and respond
  // This would be handled by the mock server
  
  // Wait for all expected function calls
  for (const funcName of expectedFunctions) {
    await recorder.waitForFunctionCall(funcName);
  }

  return recorder;
}