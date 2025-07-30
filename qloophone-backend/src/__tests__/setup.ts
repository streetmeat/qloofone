// Jest setup file
import * as dotenv from 'dotenv';

// Load environment variables for tests
dotenv.config();

// Set test environment variables if not already set
process.env.NODE_ENV = 'test';
process.env.QLOO_API_URL = process.env.QLOO_API_URL || 'https://hackathon.api.qloo.com';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Global test timeout
jest.setTimeout(10000);

// Clear entity cache before each test to ensure clean state
beforeEach(() => {
  const { entityCache } = require('../entityCache');
  entityCache.clear();
});

// Add custom matchers if needed
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}$/i;
    const pass = uuidRegex.test(received);
    
    return {
      pass,
      message: () => pass
        ? `expected ${received} not to be a valid UUID`
        : `expected ${received} to be a valid UUID`
    };
  }
});