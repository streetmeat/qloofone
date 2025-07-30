import * as dotenv from 'dotenv';
dotenv.config();

import { mockSearchResponse } from '../../testHelpers/mockResponses';
import testEntities from '../../fixtures/entities.json';

// Mock fetch
global.fetch = jest.fn();

describe('search_locality', () => {
  let search_locality: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    const functionHandlers = require('../../../functionHandlers');
    const functions = functionHandlers.default || functionHandlers;
    search_locality = functions.find((h: any) => h.schema.name === 'search_locality').handler;
  });

  describe('Response Format', () => {
    test('returns correct response structure for found locality', async () => {
      const mockLocality = testEntities.localities[0]; // New York
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearchResponse([mockLocality])
      });

      const result = await search_locality({ location: 'New York' });
      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        entity_id: mockLocality.id,
        name: mockLocality.name,
        type: 'urn:entity:locality'
      });
    });

    test('returns error when location not found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ results: [] })
      });

      const result = await search_locality({ location: 'Atlantis' });
      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        error: "Location not found",
        suggestion: 'Try a different spelling or a larger city near "Atlantis"'
      });
    });
  });

  describe('API Call Parameters', () => {
    test('includes type=urn:entity:locality in API call', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearchResponse([testEntities.localities[0]])
      });

      await search_locality({ location: 'New York' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('type=urn:entity:locality'),
        expect.any(Object)
      );
    });

    test('properly encodes location names with spaces', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearchResponse([testEntities.localities[1]])
      });

      await search_locality({ location: 'Los Angeles' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('query=Los%20Angeles'),
        expect.any(Object)
      );
    });
  });

  describe('Locality Types', () => {
    test('finds cities', async () => {
      const nyc = testEntities.localities[0];
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearchResponse([nyc])
      });

      const result = await search_locality({ location: 'New York City' });
      const parsed = JSON.parse(result);

      expect(parsed.name).toBe('New York');
      expect(parsed.entity_id).toBe(nyc.id);
    });

    test('finds neighborhoods', async () => {
      const soho = testEntities.localities[2];
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearchResponse([soho])
      });

      const result = await search_locality({ location: 'SoHo' });
      const parsed = JSON.parse(result);

      expect(parsed.name).toBe('SoHo');
      expect(parsed.type).toBe('urn:entity:locality');
    });

    test('handles location variations', async () => {
      const mockLocality = testEntities.localities[0];
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearchResponse([mockLocality])
      });

      await search_locality({ location: 'NYC' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('query=NYC'),
        expect.any(Object)
      );
    });
  });

  describe('Error Handling', () => {
    test('handles API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const result = await search_locality({ location: 'Test City' });
      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        error: "Location search failed",
        details: "API returned 404: Not Found"
      });
    });

    test('handles timeout', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce({
        name: 'AbortError',
        message: 'Request timeout after 2500ms'
      });

      const result = await search_locality({ location: 'Test' });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe("Location search failed");
      expect(parsed.details).toContain("timeout");
    });
  });

  describe('Integration with Other Functions', () => {
    test('returned entity_id can be used for location filtering', async () => {
      const mockLocality = testEntities.localities[0];
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearchResponse([mockLocality])
      });

      const result = await search_locality({ location: 'New York' });
      const parsed = JSON.parse(result);

      // The returned entity_id should be a valid UUID format
      expect(parsed.entity_id).toMatch(/^[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}$/);
      
      // This ID can be used in get_recommendation's locality_id parameter
      expect(parsed.entity_id).toBe(mockLocality.id);
    });
  });
});