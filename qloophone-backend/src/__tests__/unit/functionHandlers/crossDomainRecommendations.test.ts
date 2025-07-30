import * as dotenv from 'dotenv';
dotenv.config();

import { 
  mockInsightsResponse, 
  mockSearchResponse
} from '../../testHelpers/mockResponses';

// Mock sequel detection
jest.mock('../../../sequelDetection', () => ({
  isLikelySequel: jest.fn()
}));

// Mock fetch
global.fetch = jest.fn();

describe('Cross-Domain Recommendations', () => {
  let functionHandlers: any;
  let search_entity: any;
  let get_recommendation: any;
  let isLikelySequel: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    const sequelDetection = require('../../../sequelDetection');
    isLikelySequel = sequelDetection.isLikelySequel as jest.Mock;
    isLikelySequel.mockReturnValue(false);
    
    functionHandlers = require('../../../functionHandlers');
    const functions = functionHandlers.default || functionHandlers;
    
    search_entity = functions.find((h: any) => h.schema.name === 'search_entity').handler;
    get_recommendation = functions.find((h: any) => h.schema.name === 'get_recommendation').handler;
  });

  describe('Movie + Music → Restaurant Recommendations', () => {
    test('returns restaurants that match movie and music taste profiles', async () => {
      // Setup: Search for Star Wars (movie) and Taylor Swift (artist)
      const starWarsId = '1234-star-wars';
      const taylorSwiftId = '5678-taylor-swift';
      
      // Mock the entity searches
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockSearchResponse([{
            id: starWarsId,
            name: 'Star Wars',
            type: 'urn:entity:movie'
          }])
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockSearchResponse([{
            id: taylorSwiftId,
            name: 'Taylor Swift',
            type: 'urn:entity:artist'
          }])
        });

      // Search for both entities
      const movieResult = await search_entity({ query: 'Star Wars' });
      const musicResult = await search_entity({ query: 'Taylor Swift' });
      
      const movieData = JSON.parse(movieResult);
      const musicData = JSON.parse(musicResult);

      // Mock restaurant recommendations based on movie + music
      const restaurantRecommendations = [
        {
          id: 'rest-1',
          name: 'Galaxy Diner',
          type: 'urn:entity:place',
          affinity: 0.95,
          tags: [{ name: 'themed restaurant' }, { name: 'american' }],
          properties: {
            address: '123 Hollywood Blvd, Los Angeles, CA',
            description: 'Space-themed diner with live acoustic performances'
          }
        },
        {
          id: 'rest-2',
          name: 'The Storyteller Café',
          type: 'urn:entity:place',
          affinity: 0.92,
          tags: [{ name: 'cafe' }, { name: 'live music' }],
          properties: {
            address: '456 Music Row, Nashville, TN',
            description: 'Cozy café featuring singer-songwriters'
          }
        }
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse(restaurantRecommendations, {
          includeAddress: true,
          includeExplainability: true
        })
      });

      // Get cross-domain recommendations
      const result = await get_recommendation({
        entity_ids: `${movieData.entity_id},${musicData.entity_id}`,
        output_type: 'urn:entity:place',
        place_tags: 'restaurant'
      });

      const recommendations = JSON.parse(result);
      
      expect(recommendations.recommendations).toHaveLength(2);
      expect(recommendations.recommendations[0].name).toBe('Galaxy Diner');
      expect(recommendations.recommendations[0].tags).toContain('themed restaurant');
      expect(recommendations.source).toBe('insights');
      
      // Verify the API was called with correct cross-domain parameters
      const lastCall = (global.fetch as jest.Mock).mock.calls[2];
      expect(lastCall[0]).toContain('/v2/insights');
      expect(lastCall[0]).toContain('signal.interests.entities=' + encodeURIComponent(`${starWarsId},${taylorSwiftId}`));
      expect(lastCall[0]).toContain('filter.type=urn%3Aentity%3Aplace');
    });
  });

  describe('Book + Brand → Travel Destination Recommendations', () => {
    test('finds travel destinations matching literary and lifestyle preferences', async () => {
      // Harry Potter (book) + Patagonia (brand) → Adventure destinations
      const harryPotterId = 'book-hp-123';
      const patagoniaId = 'brand-pat-456';
      
      // Mock entity searches
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockSearchResponse([{
            id: harryPotterId,
            name: 'Harry Potter',
            type: 'urn:entity:book'
          }])
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockSearchResponse([{
            id: patagoniaId,
            name: 'Patagonia',
            type: 'urn:entity:brand'
          }])
        });

      await search_entity({ query: 'Harry Potter' });
      await search_entity({ query: 'Patagonia' });

      // Mock destination recommendations
      const destinationRecommendations = [
        {
          id: 'dest-1',
          name: 'Scottish Highlands',
          type: 'urn:entity:destination',
          affinity: 0.96,
          tags: [{ name: 'mountains' }, { name: 'castles' }, { name: 'hiking' }],
          properties: {
            description: 'Mystical landscapes with ancient castles and epic hiking trails'
          }
        },
        {
          id: 'dest-2',
          name: 'New Zealand',
          type: 'urn:entity:destination',
          affinity: 0.94,
          tags: [{ name: 'adventure' }, { name: 'film locations' }, { name: 'outdoors' }],
          properties: {
            description: 'Middle-earth filming locations with world-class outdoor adventures'
          }
        }
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse(destinationRecommendations, {
          includeExplainability: true
        })
      });

      const result = await get_recommendation({
        entity_ids: `${harryPotterId},${patagoniaId}`,
        output_type: 'urn:entity:destination'
      });

      const recommendations = JSON.parse(result);
      
      expect(recommendations.recommendations).toHaveLength(2);
      expect(recommendations.recommendations[0].name).toBe('Scottish Highlands');
      expect(recommendations.recommendations[0].tags).toContain('castles');
      expect(recommendations.recommendations[0].tags).toContain('hiking');
      
      // Verify cross-domain magic happened
      expect(recommendations.recommendations[0].score).toBeGreaterThan(0.9);
    });
  });

  describe('TV Show + Podcast → Event Venue Recommendations', () => {
    test('suggests event venues based on TV and podcast preferences', async () => {
      // The Office (TV) + How I Built This (Podcast) → Business/comedy venues
      const officeId = 'tv-office-789';
      const podcastId = 'pod-hibt-012';
      
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockSearchResponse([{
            id: officeId,
            name: 'The Office',
            type: 'urn:entity:tv_show'
          }])
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockSearchResponse([{
            id: podcastId,
            name: 'How I Built This',
            type: 'urn:entity:podcast'
          }])
        });

      await search_entity({ query: 'The Office' });
      await search_entity({ query: 'How I Built This' });

      const venueRecommendations = [
        {
          id: 'venue-1',
          name: 'The Comedy Store',
          type: 'urn:entity:place',
          affinity: 0.91,
          tags: [{ name: 'comedy club' }, { name: 'entertainment' }],
          properties: {
            address: '8433 Sunset Blvd, West Hollywood, CA',
            description: 'Legendary comedy club featuring business humor and startup stories'
          }
        },
        {
          id: 'venue-2',
          name: 'WeWork Event Space',
          type: 'urn:entity:place',
          affinity: 0.89,
          tags: [{ name: 'event space' }, { name: 'coworking' }],
          properties: {
            address: '1 Market St, San Francisco, CA',
            description: 'Modern event space hosting startup talks and comedy nights'
          }
        }
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse(venueRecommendations, {
          includeAddress: true,
          includeExplainability: true
        })
      });

      const result = await get_recommendation({
        entity_ids: `${officeId},${podcastId}`,
        output_type: 'urn:entity:place',
        location: 'Los Angeles',
        place_tags: 'event venue'
      });

      const recommendations = JSON.parse(result);
      
      expect(recommendations.recommendations).toHaveLength(2);
      expect(recommendations.recommendations[0].name).toBe('The Comedy Store');
      expect(recommendations.recommendations[1].name).toBe('WeWork Event Space');
      
      // Verify location was included in the query
      const lastCall = (global.fetch as jest.Mock).mock.calls[2];
      expect(lastCall[0]).toContain('filter.location.query=Los+Angeles');
    });
  });

  describe('Game + Artist → Activity Recommendations', () => {
    test('finds activities bridging gaming and music interests', async () => {
      // Zelda (game) + Billie Eilish (artist) → Immersive experiences
      const zeldaId = 'game-zelda-345';
      const billieId = 'artist-billie-678';
      
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockSearchResponse([{
            id: zeldaId,
            name: 'The Legend of Zelda',
            type: 'urn:entity:videogame'
          }])
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockSearchResponse([{
            id: billieId,
            name: 'Billie Eilish',
            type: 'urn:entity:artist'
          }])
        });

      await search_entity({ query: 'Zelda' });
      await search_entity({ query: 'Billie Eilish' });

      const activityRecommendations = [
        {
          id: 'act-1',
          name: 'Meow Wolf',
          type: 'urn:entity:place',
          affinity: 0.97,
          tags: [{ name: 'immersive art' }, { name: 'interactive' }, { name: 'music venue' }],
          properties: {
            address: '1352 Rufina Cir, Santa Fe, NM',
            description: 'Immersive art installation with puzzle elements and ambient soundscapes'
          }
        },
        {
          id: 'act-2',
          name: 'Two Bit Circus',
          type: 'urn:entity:place',
          affinity: 0.93,
          tags: [{ name: 'arcade' }, { name: 'vr experience' }, { name: 'entertainment' }],
          properties: {
            address: '634 Mateo St, Los Angeles, CA',
            description: 'High-tech arcade with VR experiences and live DJ sets'
          }
        }
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse(activityRecommendations, {
          includeAddress: true,
          includeExplainability: true
        })
      });

      const result = await get_recommendation({
        entity_ids: `${zeldaId},${billieId}`,
        output_type: 'urn:entity:place',
        place_tags: 'activity entertainment'
      });

      const recommendations = JSON.parse(result);
      
      expect(recommendations.recommendations).toHaveLength(2);
      expect(recommendations.recommendations[0].name).toBe('Meow Wolf');
      expect(recommendations.recommendations[0].score).toBeGreaterThan(0.95);
      
      // Verify immersive/interactive elements in tags
      const tags = recommendations.recommendations[0].tags;
      expect(tags).toContain('immersive art');
      expect(tags).toContain('interactive');
    });
  });

  describe('Multi-Entity Combinations (3-5 entities)', () => {
    test('handles 3 entity combinations for richer taste profiles', async () => {
      // Marvel + Taylor Swift + Starbucks → Recommendations
      const marvelId = 'movie-marvel-111';
      const taylorId = 'artist-taylor-222';
      const starbucksId = 'brand-star-333';
      
      // Mock all three searches
      const entities = [
        { id: marvelId, name: 'Marvel Movies', type: 'urn:entity:movie' },
        { id: taylorId, name: 'Taylor Swift', type: 'urn:entity:artist' },
        { id: starbucksId, name: 'Starbucks', type: 'urn:entity:brand' }
      ];

      for (const entity of entities) {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockSearchResponse([entity])
        });
        await search_entity({ query: entity.name });
      }

      // Mock multi-entity recommendations
      const multiEntityRecs = [
        {
          id: 'multi-1',
          name: 'Barnes & Noble Café',
          type: 'urn:entity:place',
          affinity: 0.94,
          tags: [{ name: 'bookstore' }, { name: 'café' }, { name: 'events' }],
          properties: {
            description: 'Bookstore café hosting Marvel launches and Swift listening parties'
          }
        }
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse(multiEntityRecs, {
          includeExplainability: true
        })
      });

      const result = await get_recommendation({
        entity_ids: `${marvelId},${taylorId},${starbucksId}`,
        output_type: 'urn:entity:place'
      });

      const recommendations = JSON.parse(result);
      
      expect(recommendations.recommendations).toBeDefined();
      expect(recommendations.recommendations[0].name).toBe('Barnes & Noble Café');
      
      // Verify all 3 entities were sent
      const lastCall = (global.fetch as jest.Mock).mock.calls[3];
      expect(lastCall[0]).toContain(marvelId);
      expect(lastCall[0]).toContain(taylorId);
      expect(lastCall[0]).toContain(starbucksId);
    });

    test('handles 5 entity combinations for group recommendations', async () => {
      // Complex group taste profile
      const entityIds = [
        'ent-1', 'ent-2', 'ent-3', 'ent-4', 'ent-5'
      ];
      
      // Mock 5 different entity types
      const entityTypes = [
        'urn:entity:movie',
        'urn:entity:artist', 
        'urn:entity:tv_show',
        'urn:entity:book',
        'urn:entity:brand'
      ];

      entityIds.forEach((id, index) => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockSearchResponse([{
            id,
            name: `Entity ${index + 1}`,
            type: entityTypes[index]
          }])
        });
      });

      // Search for all entities
      for (let i = 0; i < 5; i++) {
        await search_entity({ query: `Entity ${i + 1}` });
      }

      // Mock group recommendations
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse([{
          id: 'group-rec-1',
          name: 'Universal Studios',
          type: 'urn:entity:destination',
          affinity: 0.88,
          tags: [{ name: 'theme park' }, { name: 'entertainment' }]
        }])
      });

      const result = await get_recommendation({
        entity_ids: entityIds.join(','),
        output_type: 'urn:entity:destination'
      });

      const recommendations = JSON.parse(result);
      
      expect(recommendations.recommendations).toBeDefined();
      expect(recommendations.top_pick.name).toBe('Universal Studios');
      
      // Verify all 5 entities were included
      const apiCall = (global.fetch as jest.Mock).mock.calls[5][0];
      entityIds.forEach(id => {
        expect(apiCall).toContain(id);
      });
    });
  });

  describe('Explainability and Taste Bridge Narratives', () => {
    test('returns explainability scores for each input entity', async () => {
      const entity1Id = 'ent-expl-1';
      const entity2Id = 'ent-expl-2';
      
      // Mock entity searches
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockSearchResponse([{
            id: entity1Id,
            name: 'Star Wars',
            type: 'urn:entity:movie'
          }])
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockSearchResponse([{
            id: entity2Id,
            name: 'Lord of the Rings',
            type: 'urn:entity:movie'
          }])
        });

      await search_entity({ query: 'Star Wars' });
      await search_entity({ query: 'Lord of the Rings' });

      // Mock recommendations with detailed explainability
      const recsWithExplainability = [{
        id: 'rec-1',
        name: 'Dune',
        type: 'urn:entity:movie',
        affinity: 0.95,
        tags: [{ name: 'epic' }, { name: 'sci-fi' }, { name: 'fantasy' }]
      }];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          results: {
            entities: recsWithExplainability.map(e => ({
              entity_id: e.id,
              name: e.name,
              tags: e.tags,
              query: {
                affinity: e.affinity,
                explainability: {
                  'signal.interests.entities': [
                    { entity_id: entity1Id, score: 0.92, name: 'Star Wars' },
                    { entity_id: entity2Id, score: 0.89, name: 'Lord of the Rings' }
                  ]
                }
              }
            }))
          }
        })
      });

      const result = await get_recommendation({
        entity_ids: `${entity1Id},${entity2Id}`
      });

      const recommendations = JSON.parse(result);
      
      expect(recommendations.recommendations[0].explainability).toBeDefined();
      expect(recommendations.recommendations[0].explainability).toHaveLength(2);
      expect(recommendations.recommendations[0].explainability[0].score).toBe(0.92);
      expect(recommendations.recommendations[0].explainability[1].score).toBe(0.89);
      
      // Verify the API call included explainability feature
      const apiCall = (global.fetch as jest.Mock).mock.calls[2][0];
      expect(apiCall).toContain('feature.explainability=true');
    });

    test('generates taste bridge narrative from explainability data', async () => {
      // This tests that explainability scores can be used to create narratives
      const comedyId = 'tv-comedy-123';
      const dramaId = 'tv-drama-456';
      
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockSearchResponse([{
            id: comedyId,
            name: 'Brooklyn Nine-Nine',
            type: 'urn:entity:tv_show'
          }])
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockSearchResponse([{
            id: dramaId,
            name: 'The Good Place',
            type: 'urn:entity:tv_show'
          }])
        });

      await search_entity({ query: 'Brooklyn Nine-Nine' });
      await search_entity({ query: 'The Good Place' });

      // Mock a recommendation that bridges comedy and philosophy
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          results: {
            entities: [{
              entity_id: 'bridge-show',
              name: 'Community',
              tags: [
                { name: 'comedy' },
                { name: 'philosophy' },
                { name: 'ensemble cast' }
              ],
              query: {
                affinity: 0.96,
                explainability: {
                  'signal.interests.entities': [
                    { entity_id: comedyId, score: 0.94, name: 'Brooklyn Nine-Nine' },
                    { entity_id: dramaId, score: 0.91, name: 'The Good Place' }
                  ]
                }
              },
              properties: {
                description: 'Smart comedy that tackles philosophical themes'
              }
            }]
          }
        })
      });

      const result = await get_recommendation({
        entity_ids: `${comedyId},${dramaId}`
      });

      const recommendations = JSON.parse(result);
      
      // Verify the recommendation bridges both inputs
      expect(recommendations.recommendations[0].name).toBe('Community');
      expect(recommendations.recommendations[0].tags).toContain('comedy');
      expect(recommendations.recommendations[0].tags).toContain('philosophy');
      
      // Check explainability shows strong connection to both inputs
      const expl = recommendations.recommendations[0].explainability;
      expect(expl[0].score).toBeGreaterThan(0.9); // Strong connection to comedy
      expect(expl[1].score).toBeGreaterThan(0.9); // Strong connection to drama/philosophy
    });
  });
});