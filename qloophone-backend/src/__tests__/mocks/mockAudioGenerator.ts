/**
 * Mock audio generator for testing
 * Generates valid μ-law encoded audio chunks for Twilio
 */

// Base64 encoded silent μ-law audio (valid WAV header + silent data)
const SILENT_AUDIO_BASE64 = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';

// Slightly different chunks to simulate variation
const AUDIO_CHUNKS = [
  'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=',
  'UklGRjQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YRAAAAAA',
  'UklGRkQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'UklGRlQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YTAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
];

export interface AudioChunk {
  timestamp: number;
  payload: string;
  duration: number;
}

export class MockAudioGenerator {
  private baseTimestamp: number;
  private chunkDuration: number;

  constructor(startTimestamp: number = Date.now(), chunkDuration: number = 20) {
    this.baseTimestamp = startTimestamp;
    this.chunkDuration = chunkDuration; // milliseconds per chunk
  }

  /**
   * Generate audio chunks based on text length
   * Longer text = more chunks = longer "speech"
   */
  generateAudioChunksForText(text: string): AudioChunk[] {
    // Estimate speaking rate: ~150 words per minute
    const words = text.split(' ').length;
    const estimatedDurationMs = (words / 150) * 60 * 1000;
    const numChunks = Math.max(2, Math.ceil(estimatedDurationMs / this.chunkDuration));

    const chunks: AudioChunk[] = [];
    let timestamp = this.baseTimestamp;

    for (let i = 0; i < numChunks; i++) {
      chunks.push({
        timestamp,
        payload: AUDIO_CHUNKS[i % AUDIO_CHUNKS.length],
        duration: this.chunkDuration
      });
      timestamp += this.chunkDuration;
    }

    return chunks;
  }

  /**
   * Generate Twilio media events from audio chunks
   */
  generateMediaEvents(chunks: AudioChunk[], streamSid: string = 'test-stream'): any[] {
    return chunks.map((chunk, index) => ({
      event: 'media',
      sequenceNumber: String(index + 1),
      media: {
        track: 'inbound',
        chunk: String(index + 1),
        timestamp: String(chunk.timestamp),
        payload: chunk.payload
      },
      streamSid
    }));
  }

  /**
   * Generate a complete speech event sequence
   * Includes start of speech, audio chunks, and end of speech
   */
  generateSpeechSequence(text: string, streamSid: string = 'test-stream'): any[] {
    const chunks = this.generateAudioChunksForText(text);
    const mediaEvents = this.generateMediaEvents(chunks, streamSid);
    
    return [
      // Speech detection would happen on OpenAI side
      ...mediaEvents
    ];
  }

  /**
   * Generate interruption sequence
   * User starts speaking while assistant is talking
   */
  generateInterruptionSequence(streamSid: string = 'test-stream'): any[] {
    // Just a few chunks to simulate brief interruption
    const chunks = this.generateAudioChunksForText("Wait, I have another question");
    return this.generateMediaEvents(chunks.slice(0, 2), streamSid);
  }

  /**
   * Generate silence (user not speaking)
   */
  generateSilence(durationMs: number, streamSid: string = 'test-stream'): any[] {
    const numChunks = Math.ceil(durationMs / this.chunkDuration);
    const events: any[] = [];
    let timestamp = this.baseTimestamp;

    for (let i = 0; i < numChunks; i++) {
      events.push({
        event: 'media',
        sequenceNumber: String(i + 1),
        media: {
          track: 'inbound',
          chunk: String(i + 1),
          timestamp: String(timestamp),
          payload: SILENT_AUDIO_BASE64 // Completely silent
        },
        streamSid
      });
      timestamp += this.chunkDuration;
    }

    return events;
  }

  /**
   * Simulate various audio quality issues
   */
  generateProblematicAudio(problemType: 'garbled' | 'cutout' | 'echo'): AudioChunk[] {
    switch (problemType) {
      case 'garbled':
        // Corrupted base64 (but still valid length)
        return [{
          timestamp: this.baseTimestamp,
          payload: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
          duration: this.chunkDuration
        }];
      
      case 'cutout':
        // Intermittent silence
        return [
          { timestamp: this.baseTimestamp, payload: AUDIO_CHUNKS[0], duration: 20 },
          { timestamp: this.baseTimestamp + 20, payload: SILENT_AUDIO_BASE64, duration: 100 },
          { timestamp: this.baseTimestamp + 120, payload: AUDIO_CHUNKS[1], duration: 20 }
        ];
      
      case 'echo':
        // Duplicate chunks (echo effect)
        return [
          { timestamp: this.baseTimestamp, payload: AUDIO_CHUNKS[0], duration: 20 },
          { timestamp: this.baseTimestamp + 10, payload: AUDIO_CHUNKS[0], duration: 20 },
          { timestamp: this.baseTimestamp + 20, payload: AUDIO_CHUNKS[1], duration: 20 },
          { timestamp: this.baseTimestamp + 30, payload: AUDIO_CHUNKS[1], duration: 20 }
        ];
    }
  }

  /**
   * Reset timestamp for new session
   */
  reset(newTimestamp: number = Date.now()) {
    this.baseTimestamp = newTimestamp;
  }
}

// Singleton instance for tests
export const mockAudioGenerator = new MockAudioGenerator();

// Helper function to simulate realistic conversation timing
export async function simulateRealisticSpeech(
  ws: WebSocket, 
  text: string, 
  streamSid: string = 'test-stream'
): Promise<void> {
  const generator = new MockAudioGenerator();
  const events = generator.generateSpeechSequence(text, streamSid);
  
  for (const event of events) {
    ws.send(JSON.stringify(event));
    // Simulate real-time delivery
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  
  // Add natural pause after speech
  await new Promise(resolve => setTimeout(resolve, 300));
}