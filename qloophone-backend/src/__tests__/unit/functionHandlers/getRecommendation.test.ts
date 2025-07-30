import * as dotenv from 'dotenv';
dotenv.config();

import { 
  mockInsightsResponse, 
  mockRecommendationsResponse
} from '../../testHelpers/mockResponses';
import testEntities from '../../fixtures/entities.json';

// Mock sequel detection
jest.mock('../../../sequelDetection', () => ({
  isLikelySequel: jest.fn()
}));

// Mock fetch
global.fetch = jest.fn();

describe('get_recommendation', () => {
  let get_recommendation: any;
  let isLikelySequel: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    const sequelDetection = require('../../../sequelDetection');
    isLikelySequel = sequelDetection.isLikelySequel as jest.Mock;
    
    const functionHandlers = require('../../../functionHandlers');
    const functions = functionHandlers.default || functionHandlers;
    get_recommendation = functions.find((h: any) => h.schema.name === 'get_recommendation').handler;
  });

  describe('Response Format', () => {
    test('returns correct structure with recommendations array', async () => {
      const mockEntities = [
        { ...testEntities.tvShows[0], affinity: 0.95 },
        { ...testEntities.tvShows[1], affinity: 0.90 }
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse(mockEntities)
      });

      isLikelySequel.mockReturnValue(false);

      const result = await get_recommendation({
        entity_ids: 'test-id-1,test-id-2',
        output_type: 'urn:entity:tv_show'
      });
      const parsed = JSON.parse(result);

      expect(parsed).toHaveProperty('recommendations');
      expect(parsed).toHaveProperty('top_pick');
      expect(parsed).toHaveProperty('source');
      expect(parsed).toHaveProperty('count');
      
      expect(parsed.recommendations).toHaveLength(2);
      expect(parsed.top_pick).toEqual(parsed.recommendations[0]);
      expect(parsed.source).toBe('insights');
    });

    test('limits recommendations to top 3 even if more returned', async () => {
      const mockEntities = Array(5).fill(null).map((_, i) => ({
        ...testEntities.movies[0],
        id: `movie-${i}`,
        name: `Movie ${i}`,
        affinity: 0.9 - i * 0.1
      }));

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse(mockEntities)
      });

      isLikelySequel.mockReturnValue(false);

      const result = await get_recommendation({
        entity_ids: 'test-id',
        output_type: 'urn:entity:movie'
      });
      const parsed = JSON.parse(result);

      expect(parsed.recommendations).toHaveLength(3);
      expect(parsed.count).toBe(5);
    });
  });

  describe('Type Inference', () => {
    test('infers movie type when both inputs are movies', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse([testEntities.movies[0]])
      });

      await get_recommendation({
        entity_ids: `${testEntities.movies[0].id},${testEntities.movies[1].id}`
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('filter.type=urn%3Aentity%3Amovie'),
        expect.any(Object)
      );
    });

    test('infers place type when location parameters provided', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse([testEntities.places[0]])
      });

      // Note: locality_id is NOT a location parameter in the implementation
      // Only location, latitude/longitude, or place_tags trigger place inference
      await get_recommendation({
        entity_ids: testEntities.artists[0].id,
        location: 'Seattle'  // Use location instead of locality_id
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('filter.type=urn%3Aentity%3Aplace'),
        expect.any(Object)
      );
    });

    test('maps invalid entity types to valid ones', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse([testEntities.places[0]])
      });

      await get_recommendation({
        entity_ids: 'test-id',
        output_type: 'restaurant' // Invalid type
      });

      // Should map to urn:entity:place
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('filter.type=urn%3Aentity%3Aplace'),
        expect.any(Object)
      );
    });
  });

  describe('Location Filtering', () => {
    test('uses location for location filtering', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse([testEntities.places[0]], { includeDistance: true })
      });

      await get_recommendation({
        entity_ids: testEntities.artists[0].id,
        output_type: 'urn:entity:place',
        location: 'Seattle'  // The implementation uses filter.location.query for location names
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`filter.location.query=Seattle`),
        expect.any(Object)
      );
    });

    test('uses WKT POINT format for coordinates', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse([testEntities.places[0]], { includeDistance: true })
      });

      await get_recommendation({
        entity_ids: testEntities.artists[0].id,
        output_type: 'urn:entity:place',
        latitude: 40.7831,
        longitude: -73.9712
      });

      // Note: WKT format is POINT(longitude latitude)
      // URL encoding may use + for spaces
      const callUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(callUrl).toContain('filter.location=POINT');
      expect(callUrl).toContain('-73.9712');
      expect(callUrl).toContain('40.7831');
    });

    test('detects and uses neighborhood POLYGON', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse([testEntities.places[0]], { includeDistance: true })
      });

      await get_recommendation({
        entity_ids: testEntities.artists[0].id,
        output_type: 'urn:entity:place',
        place_tags: 'coffee shops in soho'
      });

      // Should use POLYGON for SoHo
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('filter.location=POLYGON'),
        expect.any(Object)
      );
    });

    test('adds radius for location queries', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse([testEntities.places[0]], { includeDistance: true })
      });

      await get_recommendation({
        entity_ids: testEntities.artists[0].id,
        output_type: 'urn:entity:place',
        location: 'Seattle',  // Use location instead of locality_id
        radius: 10000
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('filter.location.radius=10000'),
        expect.any(Object)
      );
    });

    test('sorts by affinity for location queries', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse([testEntities.places[0]], { includeDistance: true })
      });

      await get_recommendation({
        entity_ids: testEntities.artists[0].id,
        output_type: 'urn:entity:place',
        location: 'Seattle'  // Location names sort by affinity, not distance
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('sort_by=affinity'),
        expect.any(Object)
      );
    });
  });

  describe('Sequel Filtering', () => {
    test('does not filter when few sequels detected', async () => {
      const mockWithFewSequels = [
        { ...testEntities.movies[0], name: 'Star Wars', entity_id: 'sw-1' },
        { ...testEntities.movies[1], name: 'Star Wars 2', entity_id: 'sw-2' },
        { ...testEntities.movies[2], name: 'Blade Runner', entity_id: 'br-1' },
        { ...testEntities.movies[3], name: 'The Matrix', entity_id: 'matrix-1' }
      ];

      // First call returns some sequels but not majority
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockInsightsResponse(mockWithFewSequels)
        });

      // Only 1 out of 4 is a sequel (< 50%) - should NOT trigger filtering
      isLikelySequel
        .mockReturnValueOnce(false)  // Star Wars
        .mockReturnValueOnce(true)   // Star Wars 2 (sequel)
        .mockReturnValueOnce(false)  // Blade Runner
        .mockReturnValueOnce(false); // The Matrix

      await get_recommendation({
        entity_ids: 'star-wars-id',
        output_type: 'urn:entity:movie'
      });

      // Should only make one call since < 50% are sequels
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Fallback Behavior', () => {
    test('falls back to recommendations endpoint when insights fails', async () => {
      // Clear all mocks to ensure clean state
      jest.clearAllMocks();
      (global.fetch as jest.Mock).mockClear();
      
      const mockFallbackData = [testEntities.movies[0]];

      (global.fetch as jest.Mock)
        // First call to insights fails with non-ok status
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error'
        })
        // Second call to recommendations succeeds
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockRecommendationsResponse(mockFallbackData)
        });

      isLikelySequel.mockReturnValue(false);

      const result = await get_recommendation({
        entity_ids: 'test-id',
        output_type: 'urn:entity:movie'
      });
      const parsed = JSON.parse(result);

      expect(parsed.source).toBe('recommendations');
      expect(global.fetch).toHaveBeenCalledTimes(2);
      
      // Check that second call went to recommendations endpoint
      expect(global.fetch).toHaveBeenNthCalledWith(2,
        expect.stringContaining('/recommendations?'),
        expect.any(Object)
      );
    });

    test('adds location note when location filtering not available in fallback', async () => {
      (global.fetch as jest.Mock)
        // First call returns empty insights
        .mockResolvedValueOnce({ 
          ok: true, 
          status: 200,
          json: async () => ({ results: { entities: [] } })
        })
        // Second call to recommendations endpoint
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockRecommendationsResponse([testEntities.movies[0]])
        });

      const result = await get_recommendation({
        entity_ids: 'test-id',
        output_type: 'urn:entity:movie',
        location: 'Seattle'  // Use location instead of locality_id
      });
      const parsed = JSON.parse(result);

      expect(parsed.location_note).toContain('Location filtering was requested');
    });
  });

  describe('Place Tag Filtering', () => {
    test('maps coffee shop tags correctly', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse([testEntities.places[0]], { includeAddress: true })
      });

      await get_recommendation({
        entity_ids: testEntities.artists[0].id,
        output_type: 'urn:entity:place',
        locality_id: testEntities.localities[0].id,
        place_tags: 'coffee shops'
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('filter.tags=urn%3Atag%3Acategory%3Aplace%3Acoffee_shop'),
        expect.any(Object)
      );
    });

    test('uses best matching tag for venue type', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse([testEntities.places[0]], { includeAddress: true })
      });

      await get_recommendation({
        entity_ids: testEntities.artists[0].id,
        output_type: 'urn:entity:place',
        locality_id: testEntities.localities[0].id,
        place_tags: 'espresso bars'
      });

      // Should use espresso_bar tag (78.8% accuracy)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('filter.tags=urn%3Atag%3Acategory%3Aplace%3Aespresso_bar'),
        expect.any(Object)
      );
    });
  });

  describe('Error Handling', () => {
    test('handles no recommendations found', async () => {
      // Mock insights endpoint failing (non-ok response)
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ 
          ok: false, 
          status: 404,
          statusText: 'Not Found'
        })
        // Mock recommendations endpoint also failing - this throws an error
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found'
        });

      const result = await get_recommendation({
        entity_ids: 'test-id',
        output_type: 'urn:entity:movie'
      });
      const parsed = JSON.parse(result);

      // When recommendations endpoint fails, it throws an error caught by try-catch
      expect(parsed.error).toBe("Recommendation failed");
      expect(parsed.details).toContain("Both endpoints failed");
    });

    test('handles timeout gracefully', async () => {
      // Mock first insights call timing out - this will throw and be caught
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Request timeout after 3000ms'));

      const result = await get_recommendation({
        entity_ids: 'test-id',
        output_type: 'urn:entity:movie'
      });
      const parsed = JSON.parse(result);

      // The error is caught by the outer try-catch
      expect(parsed.error).toBe("Recommendation failed");
      expect(parsed.details).toContain("timeout");
    });
  });

  describe('API Parameters', () => {
    test('does not include bias.trends parameter', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse([testEntities.movies[0]])
      });

      await get_recommendation({
        entity_ids: 'test-id',
        output_type: 'urn:entity:movie'
      });

      const callUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(callUrl).not.toContain('bias.trends');
    });

    test('includes explainability feature', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse([testEntities.movies[0]], { includeExplainability: true })
      });

      await get_recommendation({
        entity_ids: 'test-id',
        output_type: 'urn:entity:movie'
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('feature.explainability=true'),
        expect.any(Object)
      );
    });
  });
});