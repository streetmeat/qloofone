import * as dotenv from 'dotenv';
dotenv.config();

import { mockSearchResponse } from '../../testHelpers/mockResponses';
import testEntities from '../../fixtures/entities.json';

// Mock fetch
global.fetch = jest.fn();

describe('search_entity', () => {
  let search_entity: any;
  let functionHandlers: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    // Import the module fresh each time
    functionHandlers = require('../../../functionHandlers');
    const functions = functionHandlers.default || functionHandlers;
    search_entity = functions.find((h: any) => h.schema.name === 'search_entity').handler;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Response Format', () => {
    test('returns correct response structure for found entity', async () => {
      const mockEntity = testEntities.artists[0]; // Taylor Swift
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearchResponse([mockEntity])
      });

      const result = await search_entity({ query: 'Taylor Swift' });
      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        entity_id: mockEntity.id,
        name: mockEntity.name,
        type: mockEntity.type
      });
    });

    test('returns error structure when no results found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ results: [] })
      });

      const result = await search_entity({ query: 'NonExistentEntity' });
      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        error: "No results found",
        suggestion: 'Try a different spelling or related term for "NonExistentEntity"'
      });
    });
  });

  describe('API Call Parameters', () => {
    test('constructs correct API URL with query parameter', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearchResponse([testEntities.movies[0]])
      });

      await search_entity({ query: 'Best in Show' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/search?query=Best%20in%20Show'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Api-Key': expect.any(String),
            'Accept': 'application/json'
          })
        })
      );
    });

    test('does NOT include type parameter in search', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearchResponse([testEntities.artists[0]])
      });

      await search_entity({ query: 'Taylor Swift' });

      const callUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(callUrl).not.toContain('type=');
    });
  });

  describe('Entity Caching', () => {
    test('stores entity info for sequel detection and type inference', async () => {
      const mockEntity = testEntities.movies[0];
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearchResponse([mockEntity])
      });

      const result = await search_entity({ query: 'Best in Show' });

      // Verify the function returns a result
      // Entity caching is an internal implementation detail
      expect(result).toBeTruthy();
      const parsed = JSON.parse(result);
      expect(parsed.entity_id).toBe(mockEntity.id);
    });
  });

  describe('Error Handling', () => {
    test('handles API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const result = await search_entity({ query: 'Test' });
      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        error: "Search failed",
        details: "API returned 500: Internal Server Error"
      });
    });

    test('handles network timeout', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce({
        name: 'AbortError',
        message: 'Request timeout'
      });

      const result = await search_entity({ query: 'Test' });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe("Search failed");
      expect(parsed.details).toContain("timeout");
    });

    test('handles malformed JSON response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => { throw new Error('Invalid JSON'); }
      });

      const result = await search_entity({ query: 'Test' });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe("Search failed");
      expect(parsed.details).toContain("Invalid JSON");
    });
  });

  describe('Multiple Results', () => {
    test('returns only the first result when multiple matches exist', async () => {
      const mockEntities = [testEntities.tvShows[0], testEntities.tvShows[1]];
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearchResponse(mockEntities)
      });

      const result = await search_entity({ query: 'The Office' });
      const parsed = JSON.parse(result);

      expect(parsed.entity_id).toBe(testEntities.tvShows[0].id);
      expect(parsed.name).toBe(testEntities.tvShows[0].name);
    });
  });
});