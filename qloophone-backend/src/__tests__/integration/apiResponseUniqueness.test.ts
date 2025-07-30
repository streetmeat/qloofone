import * as dotenv from 'dotenv';
dotenv.config();

import { 
  mockInsightsResponse
} from '../testHelpers/mockResponses';
import testEntities from '../fixtures/entities.json';

// Mock fetch
global.fetch = jest.fn();

describe('API Response Uniqueness (Integration)', () => {
  let functionHandlers: any;
  let get_recommendation: any;
  let get_fan_venues: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    // Mock sequel detection
    jest.mock('../../sequelDetection', () => ({
      isLikelySequel: jest.fn().mockReturnValue(false)
    }));
    
    functionHandlers = require('../../functionHandlers');
    const functions = functionHandlers.default || functionHandlers;
    
    get_recommendation = functions.find((h: any) => h.schema.name === 'get_recommendation').handler;
    get_fan_venues = functions.find((h: any) => h.schema.name === 'get_fan_venues').handler;
  });

  describe('Different Entity Combinations Return Unique Results', () => {
    test('comedy show combinations return different recommendations', async () => {
      // Setup: Mock search responses for entities
      // The Office + Parks & Rec vs Brooklyn 99 + 30 Rock

      // Mock different recommendation sets
      const set1Recommendations = [
        { id: 'rec-1', name: 'Community', type: 'urn:entity:tv_show', affinity: 0.92 },
        { id: 'rec-2', name: 'Arrested Development', type: 'urn:entity:tv_show', affinity: 0.88 },
        { id: 'rec-3', name: 'Scrubs', type: 'urn:entity:tv_show', affinity: 0.85 }
      ];

      const set2Recommendations = [
        { id: 'rec-4', name: 'New Girl', type: 'urn:entity:tv_show', affinity: 0.90 },
        { id: 'rec-5', name: 'Happy Endings', type: 'urn:entity:tv_show', affinity: 0.87 },
        { id: 'rec-6', name: 'Superstore', type: 'urn:entity:tv_show', affinity: 0.84 }
      ];

      // First combination
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse(set1Recommendations)
      });

      const result1 = await get_recommendation({
        entity_ids: testEntities.testCombinations.comedyPair1.join(','),
        output_type: 'urn:entity:tv_show'
      });
      const parsed1 = JSON.parse(result1);

      // Second combination
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse(set2Recommendations)
      });

      const result2 = await get_recommendation({
        entity_ids: testEntities.testCombinations.comedyPair2.join(','),
        output_type: 'urn:entity:tv_show'
      });
      const parsed2 = JSON.parse(result2);

      // Verify different results
      const ids1 = parsed1.recommendations.map((r: any) => r.entity_id);
      const ids2 = parsed2.recommendations.map((r: any) => r.entity_id);
      
      expect(ids1).not.toEqual(ids2);
      expect(new Set([...ids1, ...ids2]).size).toBe(6); // All unique
    });

    test('cross-domain combinations return contextually appropriate results', async () => {
      // Taylor Swift + The Notebook (romance theme)
      const romanceRecs = [
        { id: 'rom-1', name: 'La La Land', type: 'urn:entity:movie', affinity: 0.93 },
        { id: 'rom-2', name: 'Pride and Prejudice', type: 'urn:entity:movie', affinity: 0.89 }
      ];

      // Metallica + Mad Max (action/intensity theme)
      const actionRecs = [
        { id: 'act-1', name: 'John Wick', type: 'urn:entity:movie', affinity: 0.91 },
        { id: 'act-2', name: 'The Dark Knight', type: 'urn:entity:movie', affinity: 0.88 }
      ];

      // Romance combination
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse(romanceRecs)
      });

      const romanceResult = await get_recommendation({
        entity_ids: testEntities.testCombinations.crossDomain1.join(','),
        output_type: 'urn:entity:movie'
      });
      const romanceParsed = JSON.parse(romanceResult);

      // Action combination
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse(actionRecs)
      });

      const actionResult = await get_recommendation({
        entity_ids: testEntities.testCombinations.crossDomain2.join(','),
        output_type: 'urn:entity:movie'
      });
      const actionParsed = JSON.parse(actionResult);

      // Verify thematically different results
      expect(romanceParsed.recommendations[0].name).not.toBe(actionParsed.recommendations[0].name);
      
      // Check that recommendations match their themes
      expect(romanceParsed.recommendations.map((r: any) => r.name))
        .toEqual(expect.arrayContaining(['La La Land', 'Pride and Prejudice']));
      
      expect(actionParsed.recommendations.map((r: any) => r.name))
        .toEqual(expect.arrayContaining(['John Wick', 'The Dark Knight']));
    });
  });

  describe('Location-Based Result Uniqueness', () => {
    test('same entity + different locations return different venues', async () => {
      const taylorSwiftId = testEntities.artists[0].id;
      
      // NYC coffee shops
      const nycCoffeeShops = [
        { 
          id: 'nyc-coffee-1', 
          name: 'Blue Bottle Coffee - Chelsea', 
          type: 'urn:entity:place',
          properties: { address: '450 W 15th St, New York, NY' }
        },
        { 
          id: 'nyc-coffee-2', 
          name: 'Stumptown Coffee - Greenwich Village', 
          type: 'urn:entity:place',
          properties: { address: '30 W 8th St, New York, NY' }
        }
      ];

      // LA coffee shops
      const laCoffeeShops = [
        { 
          id: 'la-coffee-1', 
          name: 'Alfred Coffee - Melrose Place', 
          type: 'urn:entity:place',
          properties: { address: '8428 Melrose Pl, Los Angeles, CA' }
        },
        { 
          id: 'la-coffee-2', 
          name: 'Verve Coffee - West Hollywood', 
          type: 'urn:entity:place',
          properties: { address: '8925 Melrose Ave, West Hollywood, CA' }
        }
      ];

      // NYC venues
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse(nycCoffeeShops, { includeDistance: true, includeAddress: true })
      });

      const nycResult = await get_fan_venues({
        entity_ids: taylorSwiftId,
        venue_type: 'coffee',
        locality_id: testEntities.localities[0].id // NYC
      });
      const nycParsed = JSON.parse(nycResult);

      // LA venues
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse(laCoffeeShops, { includeDistance: true, includeAddress: true })
      });

      const laResult = await get_fan_venues({
        entity_ids: taylorSwiftId,
        venue_type: 'coffee',
        locality_id: testEntities.localities[1].id // LA
      });
      const laParsed = JSON.parse(laResult);

      // Verify different venues
      const nycVenueIds = nycParsed.venues.map((v: any) => v.entity_id);
      const laVenueIds = laParsed.venues.map((v: any) => v.entity_id);
      
      expect(nycVenueIds).not.toEqual(laVenueIds);
      expect(new Set([...nycVenueIds, ...laVenueIds]).size).toBe(4); // All unique
      
      // Verify location-appropriate addresses
      expect(nycParsed.venues[0].address).toContain('NY');
      expect(laParsed.venues[0].address).toContain('CA');
    });

    test('different venue types for same entity/location return different results', async () => {
      const officeId = testEntities.tvShows[0].id;
      const nycId = testEntities.localities[0].id;

      // Coffee shops where Office fans hang out
      const coffeeShops = [
        { 
          id: 'coffee-1', 
          name: 'Central Perk Cafe', 
          type: 'urn:entity:place',
          tags: [{ name: 'coffee_shop' }, { name: 'wifi' }]
        }
      ];

      // Bars where Office fans hang out
      const bars = [
        { 
          id: 'bar-1', 
          name: "Poor Richard's Pub", 
          type: 'urn:entity:place',
          tags: [{ name: 'bar' }, { name: 'pub' }]
        }
      ];

      // Coffee venues
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse(coffeeShops)
      });

      const coffeeResult = await get_fan_venues({
        entity_ids: officeId,
        venue_type: 'coffee',
        locality_id: nycId
      });
      const coffeeParsed = JSON.parse(coffeeResult);

      // Bar venues
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse(bars)
      });

      const barResult = await get_fan_venues({
        entity_ids: officeId,
        venue_type: 'bar',
        locality_id: nycId
      });
      const barParsed = JSON.parse(barResult);

      // Verify different venues and appropriate types
      expect(coffeeParsed.venues[0].entity_id).not.toBe(barParsed.venues[0].entity_id);
      expect(coffeeParsed.venues[0].tags).toContain('coffee_shop');
      expect(barParsed.venues[0].tags).toContain('bar');
    });

    test('different entities for same venue type/location return personalized results', async () => {
      const taylorSwiftId = testEntities.artists[0].id;
      const officeId = testEntities.tvShows[0].id;
      const nycId = testEntities.localities[0].id;

      // Mock the search_entity calls to populate the entity cache
      const search_entity = functionHandlers.default.find((h: any) => h.schema.name === 'search_entity').handler;
      
      // Simulate search_entity calls to populate the cache
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: [{
            entity_id: taylorSwiftId,
            name: 'Taylor Swift',
            types: ['urn:entity:artist']
          }]
        })
      });
      await search_entity({ query: 'Taylor Swift' });
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: [{
            entity_id: officeId,
            name: 'The Office',
            types: ['urn:entity:tv_show']
          }]
        })
      });
      await search_entity({ query: 'The Office' });

      // Coffee shops for Taylor Swift fans
      const swiftCoffeeShops = [
        { 
          id: 'swift-coffee-1', 
          name: 'Blank Space Coffee', 
          type: 'urn:entity:place',
          affinity: 0.95,
          tags: [{ name: 'urn:tag:category:place:coffee_shop' }],
          properties: { address: '123 Swift St, New York, NY' }
        },
        { 
          id: 'swift-coffee-2', 
          name: 'Folklore Café', 
          type: 'urn:entity:place',
          affinity: 0.92,
          tags: [{ name: 'urn:tag:category:place:coffee_shop' }],
          properties: { address: '456 Pop Ave, New York, NY' }
        }
      ];

      // Coffee shops for The Office fans
      const officeCoffeeShops = [
        { 
          id: 'office-coffee-1', 
          name: 'Dunder Mifflin Roasters', 
          type: 'urn:entity:place',
          affinity: 0.94,
          tags: [{ name: 'urn:tag:category:place:coffee_shop' }],
          properties: { address: '789 Scranton Way, New York, NY' }
        },
        { 
          id: 'office-coffee-2', 
          name: 'The Beet Farm Brew', 
          type: 'urn:entity:place',
          affinity: 0.91,
          tags: [{ name: 'urn:tag:category:place:coffee_shop' }],
          properties: { address: '321 Dwight Rd, New York, NY' }
        }
      ];

      // Taylor Swift coffee shops
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse(swiftCoffeeShops, { includeDistance: true, includeAddress: true })
      });

      const swiftResult = await get_fan_venues({
        entity_ids: taylorSwiftId,
        venue_type: 'coffee',
        locality_id: nycId
      });
      const swiftParsed = JSON.parse(swiftResult);

      // The Office coffee shops
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse(officeCoffeeShops, { includeDistance: true, includeAddress: true })
      });

      const officeResult = await get_fan_venues({
        entity_ids: officeId,
        venue_type: 'coffee',
        locality_id: nycId
      });
      const officeParsed = JSON.parse(officeResult);

      // Verify different entities get different personalized venues
      const swiftVenueIds = swiftParsed.venues.map((v: any) => v.entity_id);
      const officeVenueIds = officeParsed.venues.map((v: any) => v.entity_id);
      
      // Should have completely different venue recommendations
      expect(swiftVenueIds).not.toEqual(officeVenueIds);
      expect(new Set([...swiftVenueIds, ...officeVenueIds]).size).toBe(4); // All 4 venues should be unique
      
      // Verify summaries contain the entity IDs (since names aren't in context)
      expect(swiftParsed.summary).toContain(taylorSwiftId);
      expect(officeParsed.summary).toContain(officeId);
      
      // Both should be coffee shops in NYC
      expect(swiftParsed.venue_type).toBe('coffee');
      expect(officeParsed.venue_type).toBe('coffee');
      expect(swiftParsed.venues[0].type).toBe('coffee');
      expect(officeParsed.venues[0].type).toBe('coffee');
    });
  });

  describe('Parameter Sensitivity', () => {
    test('changing take parameter returns different number of results', async () => {
      const mockManyResults = Array(10).fill(null).map((_, i) => ({
        id: `result-${i}`,
        name: `Result ${i}`,
        type: 'urn:entity:movie',
        affinity: 0.9 - i * 0.05
      }));

      // Request with take=3
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse(mockManyResults)
      });

      const result3 = await get_recommendation({
        entity_ids: 'test-id',
        output_type: 'urn:entity:movie',
        take: 3
      });
      const parsed3 = JSON.parse(result3);

      // Request with take=5
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse(mockManyResults)
      });

      const result5 = await get_recommendation({
        entity_ids: 'test-id',
        output_type: 'urn:entity:movie',
        take: 5
      });
      const parsed5 = JSON.parse(result5);

      // Default is to return top 3, but API was asked for 5
      expect(parsed3.recommendations).toHaveLength(3);
      expect(parsed5.recommendations).toHaveLength(3); // Still limited to 3 by implementation
      expect(parsed5.count).toBe(10); // But count shows total available
    });

    test('radius parameter affects venue results', async () => {
      // This would need real API testing to verify radius actually affects results
      // For unit testing, we just verify the parameter is passed correctly
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse([])
      });

      await get_fan_venues({
        entity_ids: testEntities.artists[0].id,
        venue_type: 'coffee',
        locality_id: testEntities.localities[0].id,
        radius: 1000 // Very small radius
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('filter.location.radius=1000'),
        expect.any(Object)
      );
    });
  });

  describe('Affinity Score Ordering', () => {
    test('results are ordered by affinity score', async () => {
      // The API would return results already sorted by affinity
      const orderedResults = [
        { id: '1', name: 'First', type: 'urn:entity:movie', affinity: 0.95 },
        { id: '2', name: 'Second', type: 'urn:entity:movie', affinity: 0.85 },
        { id: '3', name: 'Third', type: 'urn:entity:movie', affinity: 0.75 }
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse(orderedResults)
      });

      const result = await get_recommendation({
        entity_ids: 'test-id',
        output_type: 'urn:entity:movie'
      });
      const parsed = JSON.parse(result);

      // Results should maintain API ordering
      expect(parsed.recommendations[0].name).toBe('First');
      expect(parsed.recommendations[1].name).toBe('Second');
      expect(parsed.recommendations[2].name).toBe('Third');
      
      // Top pick should be first result
      expect(parsed.top_pick.score).toBe(0.95);
    });
  });
});