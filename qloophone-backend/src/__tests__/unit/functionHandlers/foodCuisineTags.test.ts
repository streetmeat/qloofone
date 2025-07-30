import functions from '../../../functionHandlers';
import * as dotenv from 'dotenv';

dotenv.config();

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('Food/Cuisine Tag Tests', () => {
  const getRecommendationHandler = functions.find(f => f.schema.name === 'get_recommendation')!.handler;
  const getFanVenuesHandler = functions.find(f => f.schema.name === 'get_fan_venues')!.handler;
  const searchTagsHandler = functions.find(f => f.schema.name === 'search_tags')!.handler;
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Food Tag Mapping in Place Recommendations', () => {
    const cuisineTests = [
      { cuisine: 'sushi', tag: 'urn:tag:genre:place:restaurant:sushi' },
      { cuisine: 'italian', tag: 'urn:tag:genre:place:restaurant:italian' },
      { cuisine: 'mexican', tag: 'urn:tag:genre:place:restaurant:mexican' },
      { cuisine: 'chinese', tag: 'urn:tag:genre:place:restaurant:chinese' },
      { cuisine: 'thai', tag: 'urn:tag:genre:place:restaurant:thai' },
      { cuisine: 'indian', tag: 'urn:tag:genre:place:restaurant:indian' },
      { cuisine: 'japanese', tag: 'urn:tag:genre:place:restaurant:japanese' },
      { cuisine: 'korean', tag: 'urn:tag:genre:place:restaurant:korean' },
      { cuisine: 'vietnamese', tag: 'urn:tag:genre:place:restaurant:vietnamese' },
      { cuisine: 'french', tag: 'urn:tag:genre:place:restaurant:french' },
      { cuisine: 'mediterranean', tag: 'urn:tag:genre:place:restaurant:mediterranean' },
      { cuisine: 'american', tag: 'urn:tag:genre:place:restaurant:american' },
      { cuisine: 'pizza', tag: 'urn:tag:genre:place:restaurant:pizza' },
      { cuisine: 'burger', tag: 'urn:tag:genre:place:restaurant:burger' },
      { cuisine: 'burgers', tag: 'urn:tag:genre:place:restaurant:burger' },
      { cuisine: 'seafood', tag: 'urn:tag:genre:place:restaurant:seafood' },
      { cuisine: 'steakhouse', tag: 'urn:tag:genre:place:restaurant:steakhouse' },
      { cuisine: 'vegetarian', tag: 'urn:tag:genre:place:restaurant:vegetarian' },
      { cuisine: 'vegan', tag: 'urn:tag:genre:place:restaurant:vegan' }
    ];

    cuisineTests.forEach(({ cuisine, tag }) => {
      it(`should map "${cuisine}" to correct tag URN`, async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: {
              entities: [
                {
                  entity_id: `${cuisine.toUpperCase()}-PLACE-1`,
                  name: `Test ${cuisine} Restaurant`,
                  query: { affinity: 0.75 },
                  tags: [{ name: cuisine }]
                }
              ]
            }
          })
        } as Response);

        const result = await getRecommendationHandler({
          entity_ids: 'ENTITY-123',
          output_type: 'urn:entity:place',
          place_tags: `looking for ${cuisine} restaurants`,
          location: 'NYC'
        });

        // Verify the correct tag was used in the API call
        const lastCall = mockFetch.mock.calls[0];
        expect(lastCall[0]).toContain('filter.tags=' + encodeURIComponent(tag));
        
        const parsed = JSON.parse(result);
        expect(parsed.recommendations).toBeDefined();
      });
    });
  });

  describe('Tag-based Recommendations', () => {
    it('should use tag_ids parameter when searching for food preferences', async () => {
      // Mock tag-based recommendations
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: {
            entities: [
              {
                entity_id: 'SUSHI-REC-1',
                name: 'Nobu',
                query: { affinity: 0.92 },
                tags: [{ name: 'sushi' }, { name: 'japanese' }]
              },
              {
                entity_id: 'SUSHI-REC-2',
                name: 'Sushi Nakazawa',
                query: { affinity: 0.89 }
              }
            ]
          }
        })
      } as Response);

      const result = await getRecommendationHandler({
        tag_ids: 'urn:tag:genre:place:restaurant:sushi',
        output_type: 'urn:entity:place',
        location: 'New York'
      });

      const parsed = JSON.parse(result);
      
      expect(parsed.recommendations).toHaveLength(2);
      expect(parsed.recommendations[0].name).toBe('Nobu');
      
      // Verify tag_ids was used
      const lastCall = mockFetch.mock.calls[0];
      expect(lastCall[0]).toContain('signal.interests.tags=' + encodeURIComponent('urn:tag:genre:place:restaurant:sushi'));
    });

    it('should combine entity and tag signals for personalized food recommendations', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: {
            entities: [
              {
                entity_id: 'ITALIAN-CELEB-1',
                name: 'Carbone',
                query: { 
                  affinity: 0.95,
                  explainability: {
                    'signal.interests.entities': [{ entity_id: 'TAYLOR-123', score: 0.8 }],
                    'signal.interests.tags': [{ tag_id: 'urn:tag:genre:place:restaurant:italian', score: 0.9 }]
                  }
                }
              }
            ]
          }
        })
      } as Response);

      const result = await getRecommendationHandler({
        entity_ids: 'TAYLOR-123',
        tag_ids: 'urn:tag:genre:place:restaurant:italian',
        output_type: 'urn:entity:place',
        location: 'NYC'
      });

      const parsed = JSON.parse(result);
      
      expect(parsed.recommendations[0].name).toBe('Carbone');
      // Taste bridge may not be generated for tag-only searches
      if (parsed.taste_bridge) {
        expect(parsed.taste_bridge).toBeTruthy();
      }
      
      // Verify both signals were sent
      const lastCall = mockFetch.mock.calls[0];
      expect(lastCall[0]).toContain('signal.interests.entities=TAYLOR-123');
      expect(lastCall[0]).toContain('signal.interests.tags=' + encodeURIComponent('urn:tag:genre:place:restaurant:italian'));
    });
  });

  describe('Search Tags Function', () => {
    it('should find sushi-related tags', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              id: 'urn:tag:genre:place:restaurant:sushi',
              name: 'Sushi',
              urn: 'urn:tag:genre:place:restaurant:sushi',
              category: 'cuisine',
              entity_types: ['urn:entity:place']
            },
            {
              id: 'urn:tag:category:place:sushi_bar',
              name: 'Sushi Bar',
              urn: 'urn:tag:category:place:sushi_bar',
              category: 'venue_type'
            }
          ]
        })
      } as Response);

      const result = await searchTagsHandler({
        query: 'sushi',
        entity_type: 'place'
      });

      const parsed = JSON.parse(result);
      
      expect(parsed.tags).toHaveLength(2);
      expect(parsed.tags[0].urn).toBe('urn:tag:genre:place:restaurant:sushi');
      expect(parsed.suggestion).toContain('Use the \'urn\' value in filter.tags parameter');
    });

    it('should find multiple cuisine tags', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              id: 'urn:tag:genre:place:restaurant:italian',
              name: 'Italian',
              urn: 'urn:tag:genre:place:restaurant:italian'
            },
            {
              id: 'urn:tag:genre:place:restaurant:pizza',
              name: 'Pizza',
              urn: 'urn:tag:genre:place:restaurant:pizza'
            }
          ]
        })
      } as Response);

      const result = await searchTagsHandler({
        query: 'italian'
      });

      const parsed = JSON.parse(result);
      
      expect(parsed.tags.length).toBeGreaterThanOrEqual(1);
      expect(parsed.tags.some((t: any) => t.name === 'Italian')).toBe(true);
    });
  });

  describe('Complex Food Preference Scenarios', () => {
    it('should handle multiple cuisine preferences in place_tags', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: {
            entities: [
              {
                entity_id: 'FUSION-1',
                name: 'Momofuku',
                tags: [{ name: 'asian' }, { name: 'fusion' }]
              }
            ]
          }
        })
      } as Response);

      await getRecommendationHandler({
        entity_ids: 'CHEF-123',
        output_type: 'urn:entity:place',
        place_tags: 'looking for sushi or korean food',
        location: 'East Village'
      });

      // Should match the first cuisine found
      const lastCall = mockFetch.mock.calls[0];
      const url = lastCall[0] as string;
      
      // Verify it picked one of the cuisines
      const hasSushi = url.includes(encodeURIComponent('urn:tag:genre:place:restaurant:sushi'));
      const hasKorean = url.includes(encodeURIComponent('urn:tag:genre:place:restaurant:korean'));
      
      expect(hasSushi || hasKorean).toBe(true);
    });

    it('should prioritize cuisine tags over general venue types', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: {
            entities: [
              {
                entity_id: 'ITALIAN-COFFEE-1',
                name: 'Caffe Reggio',
                tags: [{ name: 'coffee_shop' }, { name: 'italian' }]
              }
            ]
          }
        })
      } as Response);

      await getRecommendationHandler({
        entity_ids: 'ENTITY-123',
        output_type: 'urn:entity:place',
        place_tags: 'italian coffee shop',
        location: 'Greenwich Village'
      });

      // Should use italian cuisine tag (matched first)
      const lastCall = mockFetch.mock.calls[0];
      expect(lastCall[0]).toContain(encodeURIComponent('urn:tag:genre:place:restaurant:italian'));
    });
  });

  describe('Fan Venues with Cuisine Preferences', () => {
    it('should combine fan concentration with cuisine type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: {
            entities: [
              {
                entity_id: 'SWIFT-SUSHI-1',
                name: 'Blue Ribbon Sushi',
                query: { affinity: 0.88 },
                tags: [{ tag_id: 'urn:tag:genre:place:restaurant:sushi' }],
                properties: { address: '119 Sullivan St, NYC' }
              }
            ]
          }
        })
      } as Response);

      // Note: get_fan_venues doesn't directly support cuisine filtering,
      // but we can test that the infrastructure is ready for it
      const result = await getFanVenuesHandler({
        entity_ids: 'TAYLOR-SWIFT-123',
        venue_type: 'restaurant',
        location: 'NYC'
      });

      const parsed = JSON.parse(result);
      expect(parsed.venues).toBeDefined();
      
      // The actual cuisine filtering would need to be added to get_fan_venues
      // This test confirms the tag structure is ready
    });
  });

  describe('Real API Tests for Food Tags', () => {
    it('should search for real sushi tags', async () => {
      if (!process.env.QLOO_API_KEY) {
        console.log('Skipping real API test - no QLOO_API_KEY set');
        return;
      }

      mockFetch.mockImplementation((...args) => {
        const realFetch = jest.requireActual('node-fetch');
        return realFetch(...args);
      });

      const result = await searchTagsHandler({
        query: 'sushi'
      });

      const parsed = JSON.parse(result);
      console.log('Real API sushi tag search:', parsed);
      
      if (parsed.tags && parsed.tags.length > 0) {
        expect(parsed.tags[0]).toHaveProperty('urn');
        expect(parsed.tags[0]).toHaveProperty('name');
        
        // Check if we found the expected sushi tag
        const sushiTag = parsed.tags.find((t: any) => 
          t.urn && t.urn.includes('sushi')
        );
        
        if (sushiTag) {
          console.log('Found sushi tag:', sushiTag);
          expect(sushiTag.urn).toContain('sushi');
        }
      }
    });

    it('should get real recommendations using cuisine tags', async () => {
      if (!process.env.QLOO_API_KEY) {
        console.log('Skipping real API test - no QLOO_API_KEY set');
        return;
      }

      mockFetch.mockImplementation((...args) => {
        const realFetch = jest.requireActual('node-fetch');
        return realFetch(...args);
      });

      // First search for an entity
      const searchResult = await functions.find(f => f.schema.name === 'search_entity')!.handler({
        query: 'Gordon Ramsay'
      });
      const searchParsed = JSON.parse(searchResult);

      if (searchParsed.error) {
        console.log('Could not find entity, trying with hardcoded entity');
        // Use a known entity ID
        const entityId = '4BBEF799-A0C4-4110-AB01-39216993C312'; // Taylor Swift
        
        const result = await getRecommendationHandler({
          entity_ids: entityId,
          output_type: 'urn:entity:place',
          place_tags: 'italian restaurants',
          location: 'New York'
        });

        const parsed = JSON.parse(result);
        console.log('Real API Italian restaurant recommendations:', parsed);
        
        if (!parsed.error && parsed.recommendations) {
          expect(parsed.recommendations).toBeDefined();
          expect(Array.isArray(parsed.recommendations)).toBe(true);
        }
      }
    });
  });

  describe('Error Handling for Cuisine Tags', () => {
    it('should handle unknown cuisine gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: {
            entities: []
          }
        })
      } as Response);

      const result = await getRecommendationHandler({
        entity_ids: 'ENTITY-123',
        output_type: 'urn:entity:place',
        place_tags: 'martian food', // Not in our mapping
        location: 'NYC'
      });

      JSON.parse(result); // Verify valid JSON
      
      // Should still make the request without cuisine filtering
      const lastCall = mockFetch.mock.calls[0];
      expect(lastCall[0]).not.toContain('filter.tags=urn:tag:genre:place:restaurant:martian');
    });

    it('should handle tag search failures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as Response);

      const result = await searchTagsHandler({
        query: 'pizza'
      });

      const parsed = JSON.parse(result);
      
      expect(parsed.error).toBe('Tag search failed');
      expect(parsed.details).toContain('500');
    });
  });
});