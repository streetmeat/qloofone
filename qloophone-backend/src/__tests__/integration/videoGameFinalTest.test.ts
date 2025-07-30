import functions from '../../functionHandlers';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

describe('Video Game Recommendations - Final Test', () => {
  const searchEntityHandler = functions.find(f => f.schema.name === 'search_entity')?.handler;
  const getRecommendationHandler = functions.find(f => f.schema.name === 'get_recommendation')?.handler;

  beforeAll(() => {
    if (!process.env.QLOO_API_KEY) {
      throw new Error('QLOO_API_KEY is required for integration tests');
    }
  });

  test('should handle video game recommendations correctly', async () => {
    console.log('\n=== Final Video Game Test ===\n');

    // Step 1: Search for video games
    const balatro = await searchEntityHandler!({ query: 'Balatro' });
    const balatroData = JSON.parse(balatro);
    console.log('Balatro:', balatroData.name, balatroData.type);

    const daveTheDiver = await searchEntityHandler!({ query: 'Dave the Diver' });
    const daveData = JSON.parse(daveTheDiver);
    console.log('Dave the Diver:', daveData.name, daveData.type);

    // Step 2: Test with explicit videogame type
    console.log('\n--- Testing with explicit urn:entity:videogame ---');
    const explicitResult = await getRecommendationHandler!({
      entity_ids: `${balatroData.entity_id},${daveData.entity_id}`,
      output_type: 'urn:entity:videogame'
    });
    const explicitData = JSON.parse(explicitResult);
    
    if (explicitData.error) {
      console.log('FAILED: Got error:', explicitData.error);
    } else {
      console.log('SUCCESS: Got recommendations');
      console.log('Source:', explicitData.source);
      console.log('Top pick:', explicitData.top_pick?.name);
      console.log('Fallback note:', explicitData.fallback_note || 'None');
    }

    // Step 3: Test with auto-inference
    console.log('\n--- Testing with auto-inference ---');
    const autoResult = await getRecommendationHandler!({
      entity_ids: `${balatroData.entity_id},${daveData.entity_id}`
    });
    const autoData = JSON.parse(autoResult);
    
    if (autoData.error) {
      console.log('FAILED: Got error:', autoData.error);
    } else {
      console.log('SUCCESS: Got recommendations');
      console.log('Source:', autoData.source);
      console.log('Top pick:', autoData.top_pick?.name);
      console.log('Fallback note:', autoData.fallback_note || 'None');
    }

    // Step 4: Test what LLM would pass (video_game with underscore gets mapped)
    console.log('\n--- Testing with urn:entity:video_game (gets mapped to videogame) ---');
    const llmResult = await getRecommendationHandler!({
      entity_ids: `${balatroData.entity_id},${daveData.entity_id}`,
      output_type: 'urn:entity:video_game'  // This should get mapped to videogame
    });
    const llmData = JSON.parse(llmResult);
    
    if (llmData.error) {
      console.log('FAILED: Got error:', llmData.error);
    } else {
      console.log('SUCCESS: Got recommendations'); 
      console.log('Source:', llmData.source);
      console.log('Top pick:', llmData.top_pick?.name);
      console.log('Fallback note:', llmData.fallback_note || 'None');
    }

    // All tests should succeed
    expect(explicitData.recommendations).toBeDefined();
    expect(autoData.recommendations).toBeDefined();
    expect(llmData.recommendations).toBeDefined();
  });
});