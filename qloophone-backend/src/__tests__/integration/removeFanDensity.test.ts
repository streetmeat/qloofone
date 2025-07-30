import * as dotenv from 'dotenv';
dotenv.config();

import { mockInsightsResponse } from '../testHelpers/mockResponses';
import testEntities from '../fixtures/entities.json';

// Mock fetch
global.fetch = jest.fn();

describe('Remove analyze_fan_density - Validate get_fan_venues handles all cases', () => {
  let get_fan_venues: any;
  let functions: any[];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    const functionHandlers = require('../../functionHandlers');
    functions = functionHandlers.default || functionHandlers;
    get_fan_venues = functions.find((h: any) => h.schema.name === 'get_fan_venues')?.handler;
  });

  describe('Verify analyze_fan_density removal', () => {
    test('analyze_fan_density should not exist after removal', () => {
      const analyze_fan_density = functions.find((h: any) => h.schema.name === 'analyze_fan_density');
      // This will fail initially, then pass after we remove the function
      expect(analyze_fan_density).toBeUndefined();
    });

    test('get_fan_venues should exist and be enhanced', () => {
      expect(get_fan_venues).toBeDefined();
      const venueFunction = functions.find((h: any) => h.schema.name === 'get_fan_venues');
      expect(venueFunction.schema.description).toContain('concentration');
    });
  });

  describe('get_fan_venues handles all venue queries', () => {
    test('handles "where do fans hang out" style queries', async () => {
      const mockVenues = [
        {
          ...testEntities.places[0],
          affinity: 0.95,
          properties: { address: '450 W 15th St, New York, NY 10014' }
        },
        {
          ...testEntities.places[1],
          affinity: 0.92,
          properties: { address: '100 Broadway, New York, NY 10005' }
        }
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse(mockVenues, { includeDistance: true, includeAddress: true })
      });

      const result = await get_fan_venues({
        entity_ids: testEntities.artists[0].id,
        location: 'New York'
      });
      const parsed = JSON.parse(result);

      expect(parsed.venues).toHaveLength(2);
      expect(parsed.venues[0].score).toBeGreaterThan(90); // High concentration
      expect(parsed.summary).toContain('fan');
    });

    test('handles queries without specific venue type (all venues)', async () => {
      const mockMixedVenues = [
        {
          id: '1',
          name: 'Blue Bottle Coffee',
          type: 'urn:entity:place',
          affinity: 0.95,
          tags: [{name: 'urn:tag:category:place:coffee_shop'}],
          properties: { 
            address: '450 W 15th St, New York, NY 10014'
          }
        },
        {
          id: '2',
          name: 'The Dead Rabbit',
          type: 'urn:entity:place',
          affinity: 0.93,
          tags: [{name: 'urn:tag:category:place:bar'}],
          properties: { 
            address: '30 Water St, New York, NY 10004'
          }
        },
        {
          id: '3',
          name: 'Eleven Madison Park',
          type: 'urn:entity:place',
          affinity: 0.91,
          tags: [{name: 'urn:tag:category:place:restaurant'}],
          properties: { 
            address: '11 Madison Ave, New York, NY 10010'
          }
        }
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse(mockMixedVenues, { includeDistance: true, includeAddress: true })
      });

      const result = await get_fan_venues({
        entity_ids: testEntities.artists[0].id,
        location: 'New York'
        // No venue_type specified - should return all types
      });
      const parsed = JSON.parse(result);

      expect(parsed.venues).toHaveLength(3);
      expect(parsed.venues.map((v: any) => v.type)).toContain('coffee');
      expect(parsed.venues.map((v: any) => v.type)).toContain('bar');
      expect(parsed.venues.map((v: any) => v.type)).toContain('restaurant');
      expect(parsed.venue_type).toBe('all');
    });

    test('properly describes fan concentration in summary', async () => {
      const mockVenues = [{
        ...testEntities.places[0],
        affinity: 0.98,
        properties: { address: '123 Main St' }
      }];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse(mockVenues)
      });

      const result = await get_fan_venues({
        entity_ids: testEntities.artists[0].id,
        venue_type: 'coffee',
        location: 'Seattle'
      });
      const parsed = JSON.parse(result);

      expect(parsed.summary).toMatch(/concentration|density|popular|gathering/i);
    });

    test('handles both specific venue types and general queries', async () => {
      const testCases = [
        { venue_type: 'coffee', expected: 'coffee' },
        { venue_type: 'bar', expected: 'bar' },
        { venue_type: 'restaurant', expected: 'restaurant' },
        { venue_type: undefined, expected: 'all' }
      ];

      for (const testCase of testCases) {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockInsightsResponse([testEntities.places[0]])
        });

        const args: any = {
          entity_ids: testEntities.artists[0].id,
          location: 'New York'
        };
        
        if (testCase.venue_type) {
          args.venue_type = testCase.venue_type;
        }

        const result = await get_fan_venues(args);
        const parsed = JSON.parse(result);

        expect(parsed.venue_type).toBe(testCase.expected);
      }
    });

    test('maintains backward compatibility with existing calls', async () => {
      const mockVenues = [{
        ...testEntities.places[2],
        affinity: 0.88,
        properties: { address: '789 Broadway' }
      }];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse(mockVenues)
      });

      // Old style call with all parameters
      const result = await get_fan_venues({
        entity_ids: testEntities.artists[0].id,
        venue_type: 'bar',
        locality_id: testEntities.localities[0].id,
        radius: 5,
        sort_by: 'affinity'
      });
      const parsed = JSON.parse(result);

      expect(parsed.venues).toBeDefined();
      expect(parsed.venue_type).toBe('bar');
    });
  });

  describe('Error handling', () => {
    test('handles missing entity_ids', async () => {
      const result = await get_fan_venues({
        location: 'New York'
      });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('entity_ids is required');
    });

    test('handles API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await get_fan_venues({
        entity_ids: testEntities.artists[0].id,
        location: 'New York'
      });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Venue search failed');
      expect(parsed.details).toContain('Network error');
    });
  });
});