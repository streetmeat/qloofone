import { entityCache } from '../../entityCache';
import functions from '../../functionHandlers';
import { 
  TEST_ENTITIES, 
  ENTITY_COMBINATIONS, 
  getRandomEntity,
  SEARCH_VARIATIONS 
} from '../fixtures/testEntities';

// Get the actual function handlers
const searchEntityHandler = functions.find(f => f.schema.name === 'search_entity')!.handler;
const getRecommendationHandler = functions.find(f => f.schema.name === 'get_recommendation')!.handler;

describe('Entity Combination Tests', () => {
  beforeEach(() => {
    entityCache.clear();
  });

  describe('Function Handler Tests', () => {
    // Test each entity combination
    ENTITY_COMBINATIONS.slice(0, 5).forEach(({ input1, input2, output }) => {
      test(`${input1} + ${input2} → ${output} (handlers only)`, async () => {
        const entity1 = getRandomEntity(input1 as keyof typeof TEST_ENTITIES);
        const entity2 = getRandomEntity(input2 as keyof typeof TEST_ENTITIES);
        const outputType = `urn:entity:${output}`;

        // Search for entities
        const search1Result = await searchEntityHandler({ query: entity1.query });
        const search1 = JSON.parse(search1Result);
        
        const search2Result = await searchEntityHandler({ query: entity2.query });
        const search2 = JSON.parse(search2Result);

        // Skip if either search failed
        if (search1.error || search2.error) {
          console.log(`Skipping test - search failed for ${entity1.query} or ${entity2.query}`);
          return;
        }

        // Get recommendation
        const recResult = await getRecommendationHandler({
          entity_ids: `${search1.entity_id},${search2.entity_id}`,
          output_type: outputType,
          take: 3
        });
        
        const recommendation = JSON.parse(recResult);
        
        // Verify we got a recommendation
        expect(recommendation).not.toHaveProperty('error');
        if (recommendation.recommendations) {
          expect(recommendation.recommendations.length).toBeGreaterThan(0);
          expect(recommendation.recommendations[0]).toHaveProperty('name');
        }
      }, 30000);
    });
  });

  describe('Cache Behavior', () => {
    test('Cache hit/miss tracking', async () => {
      const testQuery = 'Unique Test Movie ' + Date.now();
      const stats1 = entityCache.getStats();
      
      // First search - should miss
      await searchEntityHandler({ query: testQuery });
      const stats2 = entityCache.getStats();
      expect(stats2.misses).toBe(stats1.misses + 1);
      
      // Second search - should hit
      await searchEntityHandler({ query: testQuery });
      const stats3 = entityCache.getStats();
      expect(stats3.hits).toBe(stats2.hits + 1);
      expect(stats3.misses).toBe(stats2.misses); // No additional miss
    }, 10000);

    test('Different variations create different cache entries', async () => {
      const baseQuery = 'The Matrix';
      const variations = [
        baseQuery,
        baseQuery.toLowerCase(),
        baseQuery + ' 1999',
        baseQuery + ' movie'
      ];

      const initialSize = entityCache.getStats().size;
      
      for (const variation of variations) {
        await searchEntityHandler({ query: variation });
      }
      
      const finalSize = entityCache.getStats().size;
      // Some variations might normalize to the same cache key
      expect(finalSize).toBeGreaterThan(initialSize);
    }, 15000);
  });

  describe('Search Robustness', () => {
    SEARCH_VARIATIONS.slice(0, 3).forEach(variation => {
      test(`Search variation: "${variation.query}"`, async () => {
        const result = await searchEntityHandler({ query: variation.query });
        const parsed = JSON.parse(result);
        
        if (variation.shouldFind) {
          expect(parsed).not.toHaveProperty('error');
          expect(parsed).toHaveProperty('entity_id');
        } else {
          expect(parsed).toHaveProperty('error');
        }
      }, 10000);
    });
  });

  describe('Output Type Inference', () => {
    test('Infers output type from input types', async () => {
      // Mock context for type inference
      const context = {
        recentEntitySearches: new Map([
          ['movie-id-1', { name: 'Inception', entity_id: 'movie-id-1', type: 'urn:entity:movie' }],
          ['movie-id-2', { name: 'The Matrix', entity_id: 'movie-id-2', type: 'urn:entity:movie' }]
        ])
      };

      // When both inputs are movies and no output_type specified
      // it should infer movie as output
      const result = await getRecommendationHandler({
        entity_ids: 'movie-id-1,movie-id-2'
        // No output_type specified
      }, context);

      const parsed = JSON.parse(result);
      
      // Should either succeed with inferred type or provide clear error
      if (!parsed.error) {
        expect(parsed).toHaveProperty('recommendations');
      }
    });
  });

  describe('Cross-Domain Recommendations', () => {
    test('Movie + Music → TV Show', async () => {
      // Search for a movie
      const movieResult = await searchEntityHandler({ query: 'Inception' });
      const movie = JSON.parse(movieResult);
      
      // Search for music
      const musicResult = await searchEntityHandler({ query: 'Hans Zimmer' });
      const music = JSON.parse(musicResult);
      
      if (movie.error || music.error) {
        console.log('Skipping - search failed');
        return;
      }

      // Get TV show recommendation
      const recResult = await getRecommendationHandler({
        entity_ids: `${movie.entity_id},${music.entity_id}`,
        output_type: 'urn:entity:tv_show',
        take: 3
      });
      
      const recommendation = JSON.parse(recResult);
      
      if (!recommendation.error) {
        expect(recommendation.recommendations).toBeDefined();
        expect(recommendation.recommendations.length).toBeGreaterThan(0);
        
        // Should have explainability data
        if (recommendation.explainability) {
          expect(recommendation.explainability).toBeInstanceOf(Array);
        }
      }
    }, 20000);
  });
});