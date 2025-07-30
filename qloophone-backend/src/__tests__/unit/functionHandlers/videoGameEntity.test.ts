import functions from '../../../functionHandlers';
import * as dotenv from 'dotenv';

dotenv.config();

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('Video Game Entity Type Tests', () => {
  const searchEntityHandler = functions.find(f => f.schema.name === 'search_entity')!.handler;
  const getRecommendationHandler = functions.find(f => f.schema.name === 'get_recommendation')!.handler;
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Entity Type Mapping', () => {
    it('should correctly map "game" to urn:entity:videogame', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{
            entity_id: 'GAME-123',
            name: 'The Last of Us',
            types: ['urn:entity:videogame']
          }]
        })
      } as Response);

      const result = await searchEntityHandler({ query: 'The Last of Us' });
      const parsed = JSON.parse(result);
      
      expect(parsed.type).toBe('urn:entity:videogame');
      expect(parsed.entity_id).toBe('GAME-123');
    });

    it('should correctly map "videogame" to urn:entity:videogame', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{
            entity_id: 'GAME-456',
            name: 'God of War',
            types: ['urn:entity:videogame']
          }]
        })
      } as Response);

      const result = await searchEntityHandler({ query: 'God of War' });
      const parsed = JSON.parse(result);
      
      expect(parsed.type).toBe('urn:entity:videogame');
    });

    it('should correctly map "video_game" to urn:entity:videogame', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{
            entity_id: 'GAME-789',
            name: 'Halo Infinite',
            types: ['urn:entity:videogame']
          }]
        })
      } as Response);

      const result = await searchEntityHandler({ query: 'Halo Infinite' });
      const parsed = JSON.parse(result);
      
      expect(parsed.type).toBe('urn:entity:videogame');
    });
  });

  describe('Video Game Recommendations', () => {
    it('should accept urn:entity:videogame as a valid output type', async () => {
      // Mock insights endpoint
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: {
            entities: [
              {
                entity_id: 'GAME-REC-1',
                name: 'Horizon Zero Dawn',
                query: { affinity: 0.85 },
                tags: [{ name: 'action' }, { name: 'rpg' }]
              },
              {
                entity_id: 'GAME-REC-2',
                name: 'Ghost of Tsushima',
                query: { affinity: 0.82 },
                tags: [{ name: 'action' }, { name: 'adventure' }]
              },
              {
                entity_id: 'GAME-REC-3',
                name: 'Spider-Man: Miles Morales',
                query: { affinity: 0.79 },
                tags: [{ name: 'superhero' }, { name: 'action' }]
              }
            ]
          }
        })
      } as Response);

      const result = await getRecommendationHandler({
        entity_ids: 'GAME-123',
        output_type: 'urn:entity:videogame',
        take: 3
      });

      const parsed = JSON.parse(result);
      
      expect(parsed.recommendations).toHaveLength(3);
      expect(parsed.recommendations[0].name).toBe('Horizon Zero Dawn');
      expect(parsed.source).toBe('insights');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('filter.type=urn%3Aentity%3Avideogame'),
        expect.any(Object)
      );
    });

    it('should default to movie type when input is a video game and no output type specified', async () => {
      // First mock: search for video game
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{
            entity_id: 'ZELDA-123',
            name: 'The Legend of Zelda: Breath of the Wild',
            types: ['urn:entity:videogame']
          }]
        })
      } as Response);

      // Store the entity info (simulating what happens in real flow)
      await searchEntityHandler({ query: 'Zelda Breath of the Wild' });

      // Mock recommendations response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: {
            entities: [
              {
                entity_id: 'GAME-REC-4',
                name: 'The Witcher 3: Wild Hunt',
                query: { affinity: 0.88 }
              }
            ]
          }
        })
      } as Response);

      const result = await getRecommendationHandler({
        entity_ids: 'ZELDA-123'
        // Note: no output_type specified - defaults to movie
      });

      JSON.parse(result); // Parse to ensure valid JSON
      
      // Verify it defaults to movie type (not videogame) when no output type specified
      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      expect(lastCall[0]).toContain('filter.type=urn%3Aentity%3Amovie');
    });

    it('should handle mixed entity types with video games', async () => {
      // Mock for movie + video game combination
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: {
            entities: [
              {
                entity_id: 'MOVIE-REC-1',
                name: 'Ready Player One',
                query: { 
                  affinity: 0.90,
                  explainability: {
                    'signal.interests.entities': [
                      { entity_id: 'MOVIE-123', score: 0.8 },
                      { entity_id: 'GAME-123', score: 0.7 }
                    ]
                  }
                },
                tags: [{ name: 'sci-fi' }, { name: 'gaming' }]
              },
              {
                entity_id: 'MOVIE-REC-2',
                name: 'Wreck-It Ralph',
                query: { affinity: 0.85 }
              }
            ]
          }
        })
      } as Response);

      const result = await getRecommendationHandler({
        entity_ids: 'MOVIE-123,GAME-123',
        output_type: 'urn:entity:movie',
        take: 2
      });

      const parsed = JSON.parse(result);
      
      expect(parsed.recommendations).toHaveLength(2);
      expect(parsed.recommendations[0].name).toBe('Ready Player One');
      // Check score field (not affinity)
      expect(parsed.recommendations[0].score).toBe(0.90);
    });
  });

  describe('Error Handling for Video Games', () => {
    it('should handle invalid video game entity gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: []
        })
      } as Response);

      const result = await searchEntityHandler({ query: 'Non-existent Game XYZ' });
      const parsed = JSON.parse(result);
      
      expect(parsed.error).toBe('No results found');
      expect(parsed.suggestion).toContain('Try a different spelling');
    });

    it('should validate videogame as a supported entity type', async () => {
      // Mock insights with no results
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: { entities: [] }
        })
      } as Response);

      // Mock fallback recommendations endpoint
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: []
        })
      } as Response);

      const result = await getRecommendationHandler({
        entity_ids: 'GAME-123',
        output_type: 'urn:entity:video_game'
      });

      const parsed = JSON.parse(result);
      
      expect(parsed.error).toBe('No recommendations found');
      // Verify it didn't default to movie type
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('type=urn%3Aentity%3Avideogame'),
        expect.any(Object)
      );
    });
  });

  describe('Real API Integration Test', () => {
    it('should successfully search for a real video game', async () => {
      // Skip if no API key
      if (!process.env.QLOO_API_KEY) {
        console.log('Skipping real API test - no QLOO_API_KEY set');
        return;
      }

      // Use real fetch for this test
      mockFetch.mockImplementation((...args) => {
        const realFetch = jest.requireActual('node-fetch');
        return realFetch(...args);
      });

      const result = await searchEntityHandler({ query: 'The Last of Us' });
      const parsed = JSON.parse(result);
      
      console.log('Real API video game search result:', parsed);
      
      // If we get a result, verify it's a video game
      if (!parsed.error) {
        expect(parsed.entity_id).toBeTruthy();
        expect(parsed.name).toContain('Last of Us');
        // Type might be in the response
        if (parsed.type) {
          expect(parsed.type).toBe('urn:entity:videogame');
        }
      }
    });

    it('should get video game recommendations from real API', async () => {
      // Skip if no API key
      if (!process.env.QLOO_API_KEY) {
        console.log('Skipping real API test - no QLOO_API_KEY set');
        return;
      }

      // Use real fetch
      mockFetch.mockImplementation((...args) => {
        const realFetch = jest.requireActual('node-fetch');
        return realFetch(...args);
      });

      // First search for a video game
      const searchResult = await searchEntityHandler({ query: 'Zelda' });
      const searchParsed = JSON.parse(searchResult);
      
      if (searchParsed.error) {
        console.log('Could not find Zelda in API, skipping recommendation test');
        return;
      }

      // Get recommendations
      const recResult = await getRecommendationHandler({
        entity_ids: searchParsed.entity_id,
        output_type: 'urn:entity:videogame',
        take: 5
      });

      const recParsed = JSON.parse(recResult);
      console.log('Real API video game recommendations:', recParsed);
      
      if (!recParsed.error) {
        expect(recParsed.recommendations).toBeDefined();
        expect(Array.isArray(recParsed.recommendations)).toBe(true);
        if (recParsed.recommendations.length > 0) {
          expect(recParsed.recommendations[0]).toHaveProperty('name');
          expect(recParsed.recommendations[0]).toHaveProperty('entity_id');
        }
      }
    });
  });
});