import * as dotenv from 'dotenv';
dotenv.config();

import { mockInsightsResponse } from '../../testHelpers/mockResponses';
import testEntities from '../../fixtures/entities.json';

// Mock fetch
global.fetch = jest.fn();

describe('get_fan_venues', () => {
  let get_fan_venues: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    const functionHandlers = require('../../../functionHandlers');
    const functions = functionHandlers.default || functionHandlers;
    get_fan_venues = functions.find((h: any) => h.schema.name === 'get_fan_venues').handler;
  });

  describe('Response Format', () => {
    test('returns correct venue structure', async () => {
      const mockVenues = [
        {
          ...testEntities.places[0],
          affinity: 0.92,
          properties: { address: '450 W 15th St, New York, NY 10014' }
        },
        {
          ...testEntities.places[2],
          affinity: 0.88,
          properties: { address: '30 Water St, New York, NY 10004' }
        }
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse(mockVenues, { includeDistance: true, includeAddress: true })
      });

      const result = await get_fan_venues({
        entity_ids: testEntities.artists[0].id,
        venue_type: 'coffee',
        locality_id: testEntities.localities[0].id
      });
      const parsed = JSON.parse(result);

      expect(parsed).toHaveProperty('fan_entity');
      expect(parsed).toHaveProperty('venue_type', 'coffee');
      expect(parsed).toHaveProperty('venues');
      expect(parsed).toHaveProperty('summary');
      
      expect(parsed.venues).toHaveLength(2);
      expect(parsed.venues[0]).toHaveProperty('name');
      expect(parsed.venues[0]).toHaveProperty('entity_id');
      expect(parsed.venues[0]).toHaveProperty('address');
      expect(parsed.venues[0]).toHaveProperty('distance');
      expect(parsed.venues[0]).toHaveProperty('tags');
      expect(parsed.venues[0]).toHaveProperty('score');
    });

    test('handles empty results gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, results: { entities: [] } })
      });

      const result = await get_fan_venues({
        entity_ids: testEntities.artists[0].id,
        venue_type: 'coffee',
        location: 'New York'
      });
      const parsed = JSON.parse(result);

      expect(parsed.venues).toEqual([]);
      expect(parsed.error).toBe('No coffees found in this area');
      expect(parsed.suggestion).toBe('Try a larger radius or different venue type');
    });
  });

  describe('API Parameters', () => {
    test('constructs correct API call for general venue types', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse([testEntities.places[0]], { includeDistance: true })
      });

      await get_fan_venues({
        entity_ids: testEntities.artists[0].id,
        venue_type: 'coffee',
        location: 'New York',
        radius: 3000
      });

      const callUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      
      // Check all required parameters
      expect(callUrl).toContain(`signal.interests.entities=${testEntities.artists[0].id}`);
      expect(callUrl).toContain('filter.type=urn%3Aentity%3Aplace');
      expect(callUrl).toContain('filter.location.query=New+York');
      expect(callUrl).toContain('filter.location.radius=3000');
      expect(callUrl).toContain('sort_by=affinity');
    });

    test('maps coffee venue types to correct tag URN', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse([testEntities.places[0]])
      });

      await get_fan_venues({
        entity_ids: testEntities.artists[0].id,
        venue_type: 'coffee',
        locality_id: testEntities.localities[0].id
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('filter.tags=urn%3Atag%3Acategory%3Aplace%3Acoffee_shop'),
        expect.any(Object)
      );
    });

    test('uses espresso_bar tag for espresso venues', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse([testEntities.places[0]])
      });

      await get_fan_venues({
        entity_ids: testEntities.artists[0].id,
        venue_type: 'espresso',
        locality_id: testEntities.localities[0].id
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('filter.tags=urn%3Atag%3Acategory%3Aplace%3Aespresso_bar'),
        expect.any(Object)
      );
    });

    test('uses default radius when not specified', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse([])
      });

      await get_fan_venues({
        entity_ids: testEntities.artists[0].id,
        venue_type: 'bar',
        location: 'New York'
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('filter.location.radius=2000'),
        expect.any(Object)
      );
    });

    test('limits results with take parameter', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse([])
      });

      await get_fan_venues({
        entity_ids: testEntities.artists[0].id,
        venue_type: 'restaurant',
        locality_id: testEntities.localities[0].id,
        take: 20
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('take=20'),
        expect.any(Object)
      );
    });
  });

  describe('Brand Filtering', () => {
    test('uses brand ID for specific chains like Starbucks', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse([
          {
            id: 'starbucks-location-1',
            name: 'Starbucks',
            type: 'urn:entity:place',
            properties: { address: '123 Main St' }
          }
        ])
      });

      await get_fan_venues({
        entity_ids: testEntities.artists[0].id,
        venue_type: 'starbucks',
        locality_id: testEntities.localities[0].id
      });

      // Should use filter.references_brand instead of filter.tags
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('filter.references_brand=B13C02E3-BA3C-4B39-85B4-ACF12FEBC892'),
        expect.any(Object)
      );
      
      // Should NOT include filter.tags
      const callUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(callUrl).not.toContain('filter.tags');
    });

    test('handles Dunkin variations', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse([])
      });

      await get_fan_venues({
        entity_ids: testEntities.artists[0].id,
        venue_type: 'dunkin donuts',
        locality_id: testEntities.localities[0].id
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('filter.references_brand=5E978F43-4450-4F41-8EE4-A0421E8EC178'),
        expect.any(Object)
      );
    });
  });

  describe('Venue Type Mapping', () => {
    const venueTypeMappings = [
      { input: 'coffee', expectedTag: 'urn:tag:category:place:coffee_shop' },
      { input: 'coffee_shop', expectedTag: 'urn:tag:category:place:coffee_shop' },
      { input: 'espresso', expectedTag: 'urn:tag:category:place:espresso_bar' },
      { input: 'cafe', expectedTag: 'urn:tag:category:place:cafe' },
      { input: 'restaurant', expectedTag: 'urn:tag:category:place:restaurant' },
      { input: 'bar', expectedTag: 'urn:tag:category:place:bar' },
      { input: 'pub', expectedTag: 'urn:tag:category:place:pub' },
      { input: 'museum', expectedTag: 'urn:tag:category:place:museum' }
    ];

    venueTypeMappings.forEach(({ input, expectedTag }) => {
      test(`maps '${input}' to correct tag URN`, async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockInsightsResponse([])
        });

        await get_fan_venues({
          entity_ids: testEntities.artists[0].id,
          venue_type: input,
          locality_id: testEntities.localities[0].id
        });

        const encodedTag = encodeURIComponent(expectedTag);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(`filter.tags=${encodedTag}`),
          expect.any(Object)
        );
      });
    });

    test('falls back to all places for unknown venue types', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse([])
      });

      await get_fan_venues({
        entity_ids: testEntities.artists[0].id,
        venue_type: 'unknown_venue_type',
        locality_id: testEntities.localities[0].id
      });

      // Should not include filter.tags at all
      const callUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(callUrl).not.toContain('filter.tags');
    });
  });

  describe('Error Handling', () => {
    test('handles API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const result = await get_fan_venues({
        entity_ids: testEntities.artists[0].id,
        venue_type: 'coffee',
        location: 'New York'
      });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('Venue search failed');
      expect(parsed.details).toContain('500');
    });

    test('handles missing required parameters', async () => {
      // The function should be called with all required params
      // This test verifies the schema requirements
      const schema = require('../../../functionHandlers').default
        .find((h: any) => h.schema.name === 'get_fan_venues').schema;

      expect(schema.parameters.required).toEqual(['entity_ids']);
    });
  });

  describe('Result Processing', () => {
    test('extracts venue details correctly', async () => {
      const mockVenue = {
        id: 'venue-123',
        name: 'Trendy Coffee Shop',
        type: 'urn:entity:place',
        affinity: 0.95,
        tags: [
          { name: 'coffee_shop' },
          { name: 'wifi' },
          { name: 'organic' }
        ],
        properties: {
          address: '123 Hipster Lane, Brooklyn, NY 11211'
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse([mockVenue], { includeDistance: true })
      });

      const result = await get_fan_venues({
        entity_ids: testEntities.artists[0].id,
        venue_type: 'coffee',
        location: 'New York'
      });
      const parsed = JSON.parse(result);

      const venue = parsed.venues[0];
      expect(venue.name).toBe('Trendy Coffee Shop');
      expect(venue.entity_id).toBe('venue-123');
      expect(venue.address).toBe('123 Hipster Lane, Brooklyn, NY 11211');
      expect(venue.tags).toEqual(['coffee_shop', 'wifi', 'organic']);
      expect(venue.score).toBe(95);
      expect(venue.distance).toBeDefined();
    });

    test('includes fan entity name in summary', async () => {
      // Mock the recentEntitySearches to include Taylor Swift
      // This would need to be set up in the actual implementation
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse([testEntities.places[0]])
      });

      const result = await get_fan_venues({
        entity_ids: testEntities.artists[0].id,
        venue_type: 'coffee',
        location: 'New York'
      });
      const parsed = JSON.parse(result);

      expect(parsed.summary).toMatch(/Found \d+ coffees? in New York with high .* fan concentration/);
    });
  });
});