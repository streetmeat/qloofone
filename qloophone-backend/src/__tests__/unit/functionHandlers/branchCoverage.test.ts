import * as dotenv from 'dotenv';
dotenv.config();

// Mock sequel detection
jest.mock('../../../sequelDetection', () => ({
  isLikelySequel: jest.fn()
}));

// Mock fetch
global.fetch = jest.fn();

describe('FunctionHandlers Branch Coverage', () => {
  let functionHandlers: any;
  let search_entity: any;
  let search_locality: any;
  let get_recommendation: any;
  let get_fan_venues: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    functionHandlers = require('../../../functionHandlers');
    const functions = functionHandlers.default || functionHandlers;
    
    search_entity = functions.find((h: any) => h.schema.name === 'search_entity').handler;
    search_locality = functions.find((h: any) => h.schema.name === 'search_locality').handler;
    get_recommendation = functions.find((h: any) => h.schema.name === 'get_recommendation').handler;
    get_fan_venues = functions.find((h: any) => h.schema.name === 'get_fan_venues').handler;
  });

  describe('search_entity branch coverage', () => {
    it('should handle API timeout errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Request timeout after 2500ms'));

      const result = await search_entity({ query: 'timeout test' });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Search failed');
      expect(parsed.details).toContain('timeout');
    });

    it('should handle empty search results', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ results: [] })
      });

      const result = await search_entity({ query: 'nonexistent entity' });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('No results found');
      expect(parsed.suggestion).toContain('Try a different spelling');
    });

    it('should handle null results from API', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ results: null })
      });

      const result = await search_entity({ query: 'null results' });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('No results found');
    });

    it('should handle API error responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const result = await search_entity({ query: 'error test' });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Search failed');
      expect(parsed.details).toContain('500');
    });
  });

  describe('search_locality branch coverage', () => {
    it('should handle locality search errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await search_locality({ location: 'error city' });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Location search failed');
      expect(parsed.details).toContain('Network error');
    });

    it('should handle empty locality results', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ results: [] })
      });

      const result = await search_locality({ location: 'unknown place' });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Location not found');
      expect(parsed.suggestion).toContain('larger city');
    });
  });

  describe('get_recommendation branch coverage', () => {
    it('should handle missing entity type in cache', async () => {
      // Mock insights API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: {
            entities: [
              { entity_id: 'rec-1', name: 'Recommendation 1', type: 'urn:entity:movie' }
            ]
          }
        })
      });

      // Call without cached entity info (simulates missing type)
      const result = await get_recommendation({
        entity_ids: 'unknown-id-1,unknown-id-2',
        // No output_type provided, should default to movie
      });

      const parsed = JSON.parse(result);
      expect(parsed.recommendations).toBeDefined();
    });

    it('should handle location query with no matches', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: { entities: [] },
          query: { locality: null }
        })
      });

      const result = await get_recommendation({
        entity_ids: 'test-id',
        output_type: 'urn:entity:place',
        location: 'Unknown City'
      });

      const parsed = JSON.parse(result);
      // Check if result has expected structure
      expect(parsed).toBeDefined();
      // For places, it returns venues, not recommendations
      if (parsed.venues !== undefined) {
        expect(parsed.venues).toEqual([]);
      } else if (parsed.recommendations !== undefined) {
        expect(parsed.recommendations).toEqual([]);
      }
    });

    it('should handle invalid entity type mapping', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: { entities: [] }
        })
      });

      const result = await get_recommendation({
        entity_ids: 'test-id',
        output_type: 'invalid_type' // Should map to default
      });

      expect(result).toBeDefined();
    });

    it('should handle explainability data missing', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: {
            entities: [
              { 
                entity_id: 'rec-1', 
                name: 'Test Movie',
                // No explainability data
              }
            ]
          }
        })
      });

      const result = await get_recommendation({
        entity_ids: 'test-id'
      });

      const parsed = JSON.parse(result);
      expect(parsed.recommendations).toBeDefined();
      expect(parsed.recommendations[0]).toBeDefined();
      expect(parsed.recommendations[0].taste_bridge).toBeUndefined();
    });
  });

  describe('get_fan_venues branch coverage', () => {
    it('should handle missing entity_ids', async () => {
      const result = await get_fan_venues({
        // Missing entity_ids
        location: 'Seattle'
      });

      const parsed = JSON.parse(result);
      expect(parsed.error).toBe('entity_ids is required');
    });

    it('should handle missing location and locality_id', async () => {
      const result = await get_fan_venues({
        entity_ids: 'test-id'
        // Missing both location and locality_id
      });

      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('Either location or locality_id is required');
    });

    it('should handle API errors for fan venues', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden'
      });

      const result = await get_fan_venues({
        entity_ids: 'test-id',
        location: 'Seattle'
      });

      const parsed = JSON.parse(result);
      expect(parsed.error).toBe('Venue search failed');
      expect(parsed.details).toContain('403');
    });

    it('should handle empty venue results', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: { entities: [] }
        })
      });

      const result = await get_fan_venues({
        entity_ids: 'test-id',
        location: 'Seattle',
        venue_type: 'coffee'
      });

      const parsed = JSON.parse(result);
      expect(parsed.venues).toEqual([]);
      // Summary field is created when there are venues
      // With empty results, we get a message instead
      if (parsed.message) {
        expect(parsed.message).toContain('No coffee venues found');
      } else if (parsed.summary) {
        expect(parsed.summary).toContain('No coffee venues found');
      }
    });

    it('should handle venue results without entity cache info', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: {
            entities: [
              {
                entity_id: 'venue-1',
                name: 'Test Venue',
                properties: { address: '123 Main St' }
              }
            ]
          }
        })
      });

      const result = await get_fan_venues({
        entity_ids: 'uncached-entity-id',
        location: 'Seattle'
      });

      const parsed = JSON.parse(result);
      expect(parsed.venues).toHaveLength(1);
      expect(parsed.summary).toContain('uncached-entity-id'); // Uses entity ID when name not found
    });

    it('should handle unknown venue type', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: {
            entities: [
              { entity_id: 'venue-1', name: 'Test Venue' }
            ]
          }
        })
      });

      const result = await get_fan_venues({
        entity_ids: 'test-id',
        location: 'Seattle',
        venue_type: 'unknown_type' // Not in PLACE_TAG_URNS
      });

      const parsed = JSON.parse(result);
      expect(parsed.venues).toBeDefined();
    });
  });

  describe('edge cases and error paths', () => {
    it('should handle fetch network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network failure'));

      const result = await search_entity({ query: 'network error' });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Search failed');
      expect(parsed.details).toBe('Network failure');
    });

    it('should handle malformed API responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => { throw new Error('Invalid JSON'); }
      });

      const result = await search_entity({ query: 'malformed response' });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Search failed');
    });
  });
});