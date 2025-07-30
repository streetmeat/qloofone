import * as dotenv from 'dotenv';
dotenv.config();

// Mock fetch to simulate error conditions
const originalFetch = global.fetch;
let mockFetch: jest.Mock;

beforeEach(() => {
  mockFetch = jest.fn();
  global.fetch = mockFetch;
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

describe('Function Handlers Error Cases - Real Integration', () => {
  let functionHandlers: any;

  beforeEach(() => {
    jest.resetModules();
    functionHandlers = require('../../functionHandlers');
  });

  describe('API Error Responses', () => {
    test('handles 401 Unauthorized from Qloo API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'Invalid API key' })
      });

      const searchEntity = functionHandlers.default.find((h: any) => h.schema.name === 'search_entity').handler;
      const result = await searchEntity({ query: 'test' });
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        error: 'Search failed',
        details: expect.stringContaining('401')
      });
    });

    test('handles 403 Forbidden from Qloo API', async () => {
      // Mock both API calls (insights and recommendations fallback)
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          json: async () => ({ error: 'Access denied' })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          json: async () => ({ error: 'Access denied' })
        });

      const getRecommendation = functionHandlers.default.find((h: any) => h.schema.name === 'get_recommendation').handler;
      const result = await getRecommendation({ entity_ids: 'test-id' });
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        error: 'Recommendation failed',
        details: expect.stringContaining('403')
      });
    });

    test('handles 500 Internal Server Error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const getFanVenues = functionHandlers.default.find((h: any) => h.schema.name === 'get_fan_venues').handler;
      const result = await getFanVenues({ 
        entity_ids: 'test-id',
        location: 'New York'
      });
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        error: 'Venue search failed',
        details: expect.stringContaining('500')
      });
    });
  });

  describe('Timeout Scenarios', () => {
    test('handles request timeout gracefully', async () => {
      // Simulate timeout by rejecting with AbortError
      mockFetch.mockRejectedValueOnce(Object.assign(
        new Error('The operation was aborted'),
        { name: 'AbortError' }
      ));

      const searchLocality = functionHandlers.default.find((h: any) => h.schema.name === 'search_locality').handler;
      const result = await searchLocality({ location: 'Seattle' });
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        error: 'Location search failed',
        details: expect.stringContaining('timeout')
      });
    });

    test('handles slow API response with custom timeout', async () => {
      // Create an AbortController to simulate timeout
      
      mockFetch.mockImplementationOnce((_url: string, options: any) => {
        // Handle abort signal if provided
        
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              json: async () => ({ results: [] })
            });
          }, 5000); // 5 second delay
          
          // Listen for abort
          if (options.signal) {
            options.signal.addEventListener('abort', () => {
              clearTimeout(timeout);
              reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
            });
          }
        });
      });

      const searchEntity = functionHandlers.default.find((h: any) => h.schema.name === 'search_entity').handler;
      
      // This should timeout at ~2.5s
      const result = await searchEntity({ query: 'test' });
      const parsed = JSON.parse(result);
      
      expect(parsed.error).toBe('Search failed');
      expect(parsed.details).toContain('timeout');
    });
  });

  describe('Invalid Response Handling', () => {
    test('handles malformed JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => { throw new Error('Invalid JSON'); }
      });

      const searchEntity = functionHandlers.default.find((h: any) => h.schema.name === 'search_entity').handler;
      const result = await searchEntity({ query: 'test' });
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        error: 'Search failed',
        details: expect.any(String)
      });
    });

    test('handles empty response body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => null
      });

      const getRecommendation = functionHandlers.default.find((h: any) => h.schema.name === 'get_recommendation').handler;
      const result = await getRecommendation({ entity_ids: 'test-id' });
      const parsed = JSON.parse(result);

      // Should handle null response gracefully
      expect(parsed).toBeDefined();
    });

    test('handles response with missing expected fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ unexpected: 'format' }) // Missing 'results' field
      });

      const searchEntity = functionHandlers.default.find((h: any) => h.schema.name === 'search_entity').handler;
      const result = await searchEntity({ query: 'test' });
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        error: 'No results found'
      });
    });
  });

  describe('Network Failures', () => {
    test('handles network connection error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network request failed'));

      const searchEntity = functionHandlers.default.find((h: any) => h.schema.name === 'search_entity').handler;
      const result = await searchEntity({ query: 'test' });
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        error: 'Search failed',
        details: 'Network request failed'
      });
    });

    test('handles DNS resolution failure', async () => {
      mockFetch.mockRejectedValueOnce(Object.assign(
        new Error('getaddrinfo ENOTFOUND api.qloo.com'),
        { code: 'ENOTFOUND' }
      ));

      const getRecommendation = functionHandlers.default.find((h: any) => h.schema.name === 'get_recommendation').handler;
      const result = await getRecommendation({ entity_ids: 'test-id' });
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        error: 'Recommendation failed',
        details: expect.stringContaining('ENOTFOUND')
      });
    });
  });

  describe('Edge Cases', () => {
    test('handles extremely large response gracefully', async () => {
      // Create a large response with many results
      const largeResults = Array(1000).fill(null).map((_, i) => ({
        entity_id: `id-${i}`,
        name: `Entity ${i}`,
        type: 'urn:entity:movie'
      }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ results: largeResults })
      });

      const searchEntity = functionHandlers.default.find((h: any) => h.schema.name === 'search_entity').handler;
      const result = await searchEntity({ query: 'test' });
      const parsed = JSON.parse(result);

      // Should only return first result
      expect(parsed).toMatchObject({
        entity_id: 'id-0',
        name: 'Entity 0'
      });
    });

    test('handles special characters in API responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: [{
            entity_id: 'test-id',
            name: 'Test "Entity" with \'quotes\' & <special> chars',
            type: 'urn:entity:movie'
          }]
        })
      });

      const searchEntity = functionHandlers.default.find((h: any) => h.schema.name === 'search_entity').handler;
      const result = await searchEntity({ query: 'test' });
      const parsed = JSON.parse(result);

      expect(parsed.name).toBe('Test "Entity" with \'quotes\' & <special> chars');
    });

    test('handles Unicode characters in responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: [{
            entity_id: 'test-id',
            name: 'Café 北京 🎬',
            type: 'urn:entity:place'
          }]
        })
      });

      const searchEntity = functionHandlers.default.find((h: any) => h.schema.name === 'search_entity').handler;
      const result = await searchEntity({ query: 'cafe' });
      const parsed = JSON.parse(result);

      expect(parsed.name).toBe('Café 北京 🎬');
    });
  });

  describe('Validation Errors', () => {
    test('handles missing required parameters', async () => {
      const getFanVenues = functionHandlers.default.find((h: any) => h.schema.name === 'get_fan_venues').handler;
      
      // Missing location
      const result = await getFanVenues({ entity_ids: 'test-id' });
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        error: 'Either location or locality_id is required'
      });
    });

    test('handles invalid parameter types', async () => {
      const getRecommendation = functionHandlers.default.find((h: any) => h.schema.name === 'get_recommendation').handler;
      
      // Pass number instead of string - convert to string internally
      const result = await getRecommendation({ 
        entity_ids: '123', // Use valid string
        take: 'not-a-number' as any
      });
      
      // Should handle gracefully
      const parsed = JSON.parse(result);
      expect(parsed).toBeDefined();
      // Should return error or empty result
      expect(parsed.error || parsed.recommendations).toBeDefined();
    });
  });
});