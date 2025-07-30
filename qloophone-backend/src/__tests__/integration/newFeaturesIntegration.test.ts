import functions from '../../functionHandlers';
import * as dotenv from 'dotenv';

dotenv.config();

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('New Features Integration Tests', () => {
  const searchEntityHandler = functions.find(f => f.schema.name === 'search_entity')!.handler;
  const getRecommendationHandler = functions.find(f => f.schema.name === 'get_recommendation')!.handler;
  const searchTagsHandler = functions.find(f => f.schema.name === 'search_tags')!.handler;
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Video Game + Food Preferences Integration', () => {
    it('should handle a user who likes video games and wants sushi restaurants', async () => {
      // Step 1: Search for a video game
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{
            entity_id: 'ZELDA-123',
            name: 'The Legend of Zelda',
            types: ['urn:entity:videogame']
          }]
        })
      } as Response);

      const gameResult = await searchEntityHandler({ query: 'Zelda' });
      const gameParsed = JSON.parse(gameResult);
      expect(gameParsed.type).toBe('urn:entity:videogame');

      // Step 2: Get sushi restaurant recommendations for Zelda fans
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: {
            entities: [
              {
                entity_id: 'SUSHI-GAME-1',
                name: 'Katsu-Ya',
                query: { affinity: 0.85 },
                tags: [{ name: 'sushi' }, { name: 'japanese' }],
                properties: { address: '11680 Ventura Blvd, Studio City, CA' }
              },
              {
                entity_id: 'SUSHI-GAME-2',
                name: 'Sugarfish',
                query: { affinity: 0.82 },
                tags: [{ name: 'sushi' }]
              }
            ]
          }
        })
      } as Response);

      const sushiResult = await getRecommendationHandler({
        entity_ids: gameParsed.entity_id,
        output_type: 'urn:entity:place',
        place_tags: 'looking for sushi restaurants',
        location: 'Los Angeles'
      });

      const sushiParsed = JSON.parse(sushiResult);
      
      expect(sushiParsed.recommendations).toHaveLength(2);
      expect(sushiParsed.recommendations[0].name).toBe('Katsu-Ya');
      
      // Verify the correct sushi tag was used
      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      expect(lastCall[0]).toContain(encodeURIComponent('urn:tag:genre:place:restaurant:sushi'));
    });

    it('should combine multiple entity types with cuisine preferences', async () => {
      // Search for both a movie and a video game
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{
            entity_id: 'MARIO-123',
            name: 'Super Mario Bros.',
            types: ['urn:entity:videogame']
          }]
        })
      } as Response);

      const marioResult = await searchEntityHandler({ query: 'Mario' });
      const marioParsed = JSON.parse(marioResult);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{
            entity_id: 'INCEPTION-123',
            name: 'Inception',
            types: ['urn:entity:movie']
          }]
        })
      } as Response);

      const inceptionResult = await searchEntityHandler({ query: 'Inception' });
      const inceptionParsed = JSON.parse(inceptionResult);

      // Get Italian restaurant recommendations for fans of both
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: {
            entities: [
              {
                entity_id: 'ITALIAN-COMBO-1',
                name: 'Il Pastaio',
                query: { 
                  affinity: 0.88,
                  explainability: {
                    'signal.interests.entities': [
                      { entity_id: 'MARIO-123', score: 0.75 },
                      { entity_id: 'INCEPTION-123', score: 0.65 }
                    ]
                  }
                },
                tags: [{ name: 'italian' }, { name: 'pasta' }]
              }
            ]
          }
        })
      } as Response);

      const italianResult = await getRecommendationHandler({
        entity_ids: `${marioParsed.entity_id},${inceptionParsed.entity_id}`,
        output_type: 'urn:entity:place',
        place_tags: 'italian restaurants',
        location: 'Beverly Hills'
      });

      const italianParsed = JSON.parse(italianResult);
      
      expect(italianParsed.recommendations[0].name).toBe('Il Pastaio');
      expect(italianParsed.recommendations[0].explainability).toBeDefined();
      
      // Verify Italian tag was used
      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      expect(lastCall[0]).toContain(encodeURIComponent('urn:tag:genre:place:restaurant:italian'));
    });
  });

  describe('Complex Cuisine Matching', () => {
    it('should handle ambiguous cuisine requests intelligently', async () => {
      // Test when user mentions both a general term and specific cuisine
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: {
            entities: [
              {
                entity_id: 'VEGAN-SUSHI-1',
                name: 'Shojin',
                tags: [{ name: 'sushi' }, { name: 'vegan' }, { name: 'japanese' }]
              }
            ]
          }
        })
      } as Response);

      await getRecommendationHandler({
        entity_ids: 'HEALTH-CONSCIOUS-123',
        output_type: 'urn:entity:place',
        place_tags: 'vegan sushi restaurants', // Both vegan and sushi
        location: 'Los Angeles'
      });

      // Should prioritize the more specific tag (vegan or sushi, both are cuisine-specific)
      const lastCall = mockFetch.mock.calls[0];
      const url = lastCall[0] as string;
      
      // Should use one of the specific cuisine tags, not generic restaurant
      const hasVegan = url.includes(encodeURIComponent('urn:tag:genre:place:restaurant:vegan'));
      const hasSushi = url.includes(encodeURIComponent('urn:tag:genre:place:restaurant:sushi'));
      const hasGenericRestaurant = url.includes(encodeURIComponent('urn:tag:category:place:restaurant'));
      
      expect(hasVegan || hasSushi).toBe(true);
      expect(hasGenericRestaurant).toBe(false);
    });

    it('should handle cuisine + venue type combinations', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: {
            entities: [
              {
                entity_id: 'ITALIAN-COFFEE-1',
                name: 'Lavazza',
                tags: [{ name: 'coffee_shop' }, { name: 'italian' }, { name: 'cafe' }]
              }
            ]
          }
        })
      } as Response);

      await getRecommendationHandler({
        entity_ids: 'COFFEE-LOVER-123',
        output_type: 'urn:entity:place',
        place_tags: 'italian coffee shop for espresso', // Mix of cuisine and venue type
        location: 'Manhattan'
      });

      // Should still prioritize the cuisine tag
      const lastCall = mockFetch.mock.calls[0];
      expect(lastCall[0]).toContain(encodeURIComponent('urn:tag:genre:place:restaurant:italian'));
    });
  });

  describe('Tag Search Integration', () => {
    it('should find cuisine tags and use them in recommendations', async () => {
      // Step 1: Search for Korean food tags
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              id: 'urn:tag:genre:place:restaurant:korean',
              name: 'Korean',
              urn: 'urn:tag:genre:place:restaurant:korean',
              category: 'cuisine'
            },
            {
              id: 'urn:tag:genre:place:restaurant:korean_bbq',
              name: 'Korean BBQ',
              urn: 'urn:tag:genre:place:restaurant:korean_bbq'
            }
          ]
        })
      } as Response);

      const tagResult = await searchTagsHandler({
        query: 'korean',
        entity_type: 'place'
      });

      const tagParsed = JSON.parse(tagResult);
      expect(tagParsed.tags).toHaveLength(2);
      
      // Step 2: Use the tag in recommendations
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: {
            entities: [
              {
                entity_id: 'KBBQ-1',
                name: 'Kang Ho-dong Baekjeong',
                tags: [{ name: 'korean_bbq' }]
              }
            ]
          }
        })
      } as Response);

      const recResult = await getRecommendationHandler({
        tag_ids: tagParsed.tags[0].urn,
        output_type: 'urn:entity:place',
        location: 'Koreatown LA'
      });

      const recParsed = JSON.parse(recResult);
      expect(recParsed.recommendations[0].name).toBe('Kang Ho-dong Baekjeong');
    });
  });

  describe('Error Cases and Edge Scenarios', () => {
    it('should handle videogame type in mixed searches gracefully', async () => {
      // When searching returns mixed types including videogame
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              entity_id: 'MIXED-1',
              name: 'Pokemon',
              types: ['urn:entity:videogame', 'urn:entity:tv_show', 'urn:entity:movie']
            }
          ]
        })
      } as Response);

      const result = await searchEntityHandler({ query: 'Pokemon' });
      const parsed = JSON.parse(result);
      
      // Should pick the first type (videogame without underscore)
      expect(parsed.type).toBe('urn:entity:videogame');
    });

    it('should handle cuisine tags that dont exist gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: { entities: [] }
        })
      } as Response);

      const result = await getRecommendationHandler({
        entity_ids: 'ENTITY-123',
        output_type: 'urn:entity:place',
        place_tags: 'martian fusion molecular gastronomy', // Nonsense cuisine
        location: 'Area 51'
      });

      const parsed = JSON.parse(result);
      
      // Should still return valid JSON even if no results
      expect(parsed).toBeDefined();
      
      // Should not have added any bogus tags
      const lastCall = mockFetch.mock.calls[0];
      expect(lastCall[0]).not.toContain('martian');
      expect(lastCall[0]).not.toContain('molecular');
    });
  });

  describe('Real API Validation', () => {
    it('should work with real API for video game searches', async () => {
      if (!process.env.QLOO_API_KEY) {
        console.log('Skipping real API test - no QLOO_API_KEY set');
        return;
      }

      // Use real fetch
      mockFetch.mockImplementation((...args) => {
        const realFetch = jest.requireActual('node-fetch');
        return realFetch(...args);
      });

      // Search for a popular video game
      const result = await searchEntityHandler({ query: 'Minecraft' });
      const parsed = JSON.parse(result);
      
      console.log('Real API Minecraft search:', parsed);
      
      if (!parsed.error) {
        expect(parsed.entity_id).toBeTruthy();
        expect(parsed.name).toContain('Minecraft');
        
        // Get recommendations for Minecraft fans
        const recResult = await getRecommendationHandler({
          entity_ids: parsed.entity_id,
          output_type: 'urn:entity:videogame',
          take: 3
        });
        
        const recParsed = JSON.parse(recResult);
        console.log('Real API video game recommendations for Minecraft fans:', recParsed);
        
        if (!recParsed.error && recParsed.recommendations) {
          expect(recParsed.recommendations.length).toBeGreaterThan(0);
          // Should recommend other video games
          recParsed.recommendations.forEach((rec: any) => {
            console.log(`- ${rec.name} (${rec.score})`);
          });
        }
      }
    });

    it('should work with real API for cuisine-based place search', async () => {
      if (!process.env.QLOO_API_KEY) {
        console.log('Skipping real API test - no QLOO_API_KEY set');
        return;
      }

      // Use real fetch
      mockFetch.mockImplementation((...args) => {
        const realFetch = jest.requireActual('node-fetch');
        return realFetch(...args);
      });

      // Search for an entity first
      const entityResult = await searchEntityHandler({ query: 'Beyonce' });
      const entityParsed = JSON.parse(entityResult);
      
      if (!entityParsed.error) {
        // Get Mexican restaurant recommendations for Beyonce fans
        const recResult = await getRecommendationHandler({
          entity_ids: entityParsed.entity_id,
          output_type: 'urn:entity:place',
          place_tags: 'mexican restaurants with good tacos',
          location: 'Los Angeles'
        });
        
        const recParsed = JSON.parse(recResult);
        console.log('Real API Mexican restaurant recommendations:', recParsed);
        
        if (!recParsed.error && recParsed.recommendations) {
          expect(recParsed.recommendations).toBeDefined();
          
          // Log the recommendations
          recParsed.recommendations.forEach((rec: any) => {
            console.log(`- ${rec.name} (score: ${rec.score})`);
            if (rec.tags) {
              console.log(`  Tags: ${rec.tags.join(', ')}`);
            }
          });
        }
      }
    });
  });
});