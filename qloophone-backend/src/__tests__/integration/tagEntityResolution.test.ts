import functionHandlers from '../../functionHandlers';
import dotenv from 'dotenv';

dotenv.config();

// Find specific function handlers
const searchEntity = functionHandlers.find(f => f.schema.name === 'search_entity')!;
const getRecommendation = functionHandlers.find(f => f.schema.name === 'get_recommendation')!;

describe('Tag vs Entity Resolution and Influence', () => {
  const mockContext = {
    recentEntitySearches: new Map()
  };

  beforeEach(() => {
    mockContext.recentEntitySearches.clear();
  });

  describe('Entity Search Behavior', () => {
    it('should identify when search returns a tag vs entity', async () => {
      // Test cases that commonly return tags
      const tagSearches = [
        { query: 'Dune', expectedType: 'tag' },
        { query: 'Star Trek', expectedType: 'tag' },
        { query: 'Batman', expectedType: 'tag' },
        { query: 'Italian Food', expectedType: 'tag' }
      ];

      // Test cases that should return entities
      const entitySearches = [
        { query: 'Dune 2021', expectedType: 'entity' },
        { query: 'Star Trek: The Next Generation', expectedType: 'entity' },
        { query: 'The Dark Knight', expectedType: 'entity' },
        { query: 'Olive Garden', expectedType: 'entity' }
      ];

      console.log('\n=== Testing Tag-Returning Searches ===');
      for (const search of tagSearches) {
        const result = await searchEntity.handler({ query: search.query }, mockContext);
        const parsed = JSON.parse(result);
        
        if (!parsed.error) {
          const isTag = parsed.type?.includes('urn:tag');
          console.log(`Search "${search.query}": ${parsed.name} - Type: ${parsed.type} - Is Tag: ${isTag}`);
        }
      }

      console.log('\n=== Testing Entity-Returning Searches ===');
      for (const search of entitySearches) {
        const result = await searchEntity.handler({ query: search.query }, mockContext);
        const parsed = JSON.parse(result);
        
        if (!parsed.error) {
          const isTag = parsed.type?.includes('urn:tag');
          console.log(`Search "${search.query}": ${parsed.name} - Type: ${parsed.type} - Is Tag: ${isTag}`);
        }
      }
    });

    it('should test different search strategies for ambiguous terms', async () => {
      const term = 'Dune';
      const strategies = [
        { query: term },
        { query: `${term} movie` },
        { query: `${term} 2021` },
        { query: `${term} film` },
        { query: `${term} book` },
        { query: `${term} Frank Herbert` }
      ];

      console.log(`\n=== Testing Search Strategies for "${term}" ===`);
      for (const strategy of strategies) {
        const result = await searchEntity.handler({ query: strategy.query }, mockContext);
        const parsed = JSON.parse(result);
        
        if (!parsed.error) {
          console.log(`Strategy "${strategy.query}": ${parsed.name} - Type: ${parsed.type}`);
        }
      }
    });
  });

  describe('Tag Influence in Recommendations', () => {
    it('should test if tags actually influence recommendations when combined with entities', async () => {
      // First, get a known entity and tag
      const movieResult = await searchEntity.handler({ query: 'The Matrix' }, mockContext);
      const movieEntity = JSON.parse(movieResult);
      
      const tagResult = await searchEntity.handler({ query: 'Star Trek' }, mockContext);
      const tagEntity = JSON.parse(tagResult);

      if (!movieEntity.error && !tagEntity.error) {
        console.log('\n=== Testing Tag + Entity Combination ===');
        console.log(`Entity: ${movieEntity.name} (${movieEntity.type})`);
        console.log(`Tag: ${tagEntity.name} (${tagEntity.type})`);

        // Test 1: Entity only
        const entityOnlyResult = await getRecommendation.handler({
          entity_ids: movieEntity.entity_id,
          output_type: 'urn:entity:movie',
          take: 5
        }, mockContext);
        const entityOnlyRecs = JSON.parse(entityOnlyResult);

        // Test 2: Entity + Tag
        const comboResult = await getRecommendation.handler({
          entity_ids: `${movieEntity.entity_id},${tagEntity.entity_id}`,
          output_type: 'urn:entity:movie',
          take: 5
        }, mockContext);
        const comboRecs = JSON.parse(comboResult);

        if (!entityOnlyRecs.error && !comboRecs.error) {
          console.log('\n--- Entity Only Recommendations ---');
          entityOnlyRecs.recommendations?.slice(0, 3).forEach((rec: any, idx: number) => {
            console.log(`${idx + 1}. ${rec.name} (${rec.score})`);
          });

          console.log('\n--- Entity + Tag Recommendations ---');
          comboRecs.recommendations?.slice(0, 3).forEach((rec: any, idx: number) => {
            console.log(`${idx + 1}. ${rec.name} (${rec.score})`);
            
            // Check explainability
            if (rec.explainability) {
              console.log('   Influences:');
              rec.explainability.forEach((exp: any) => {
                const entityInfo = mockContext.recentEntitySearches.get(exp.entity_id);
                const name = entityInfo?.name || exp.entity_id;
                console.log(`   - ${name}: ${(exp.score * 100).toFixed(0)}%`);
              });
            }
          });

          // Compare results
          const sameOrder = entityOnlyRecs.recommendations?.every((rec: any, idx: number) => 
            rec.entity_id === comboRecs.recommendations?.[idx]?.entity_id
          );
          
          console.log(`\nRecommendations are ${sameOrder ? 'IDENTICAL' : 'DIFFERENT'}`);
        }
      }
    });

    it('should test tag influence with explicit tag parameters', async () => {
      // Test using signal.interests.tags instead of entities
      const movieResult = await searchEntity.handler({ query: 'Inception' }, mockContext);
      const movieEntity = JSON.parse(movieResult);

      if (!movieEntity.error) {
        console.log('\n=== Testing signal.interests.tags vs signal.interests.entities ===');
        
        // This would require modifying the getRecommendation handler to accept tag_ids parameter
        // For now, we'll document this as a finding
        console.log('NOTE: Current implementation puts tag IDs in signal.interests.entities');
        console.log('Qloo API documentation suggests tags should use signal.interests.tags parameter');
      }
    });
  });

  describe('Two Tags Combination Issue', () => {
    it('should demonstrate the failure when combining two tags', async () => {
      const tag1Result = await searchEntity.handler({ query: 'Baseball' }, mockContext);
      const tag1 = JSON.parse(tag1Result);
      
      const tag2Result = await searchEntity.handler({ query: 'Star Trek' }, mockContext);
      const tag2 = JSON.parse(tag2Result);

      if (!tag1.error && !tag2.error && tag1.type?.includes('tag') && tag2.type?.includes('tag')) {
        console.log('\n=== Testing Two Tags Combination ===');
        console.log(`Tag 1: ${tag1.name} (${tag1.type})`);
        console.log(`Tag 2: ${tag2.name} (${tag2.type})`);

        const result = await getRecommendation.handler({
          entity_ids: `${tag1.entity_id},${tag2.entity_id}`,
          take: 3
        }, mockContext);
        
        const parsed = JSON.parse(result);
        if (parsed.error) {
          console.log(`\nERROR (as expected): ${parsed.error}`);
          console.log('This fails because the system tries to use filter.type=urn:tag');
        }
      }
    });
  });
});