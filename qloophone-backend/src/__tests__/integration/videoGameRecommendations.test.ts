import functions from '../../functionHandlers';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

describe('Video Game Recommendations Integration Test', () => {
  const searchEntityHandler = functions.find(f => f.schema.name === 'search_entity')?.handler;
  const getRecommendationHandler = functions.find(f => f.schema.name === 'get_recommendation')?.handler;

  beforeAll(() => {
    // Ensure we have API key
    if (!process.env.QLOO_API_KEY) {
      throw new Error('QLOO_API_KEY is required for integration tests');
    }
  });

  test('should handle video game recommendations with fallback to movies', async () => {
    console.log('\n=== Testing Video Game Recommendations ===\n');

    // Step 1: Search for two video games
    console.log('1. Searching for video games...');
    
    const balatro = await searchEntityHandler!({ query: 'Balatro' });
    const balatroData = JSON.parse(balatro);
    console.log('Balatro search result:', balatroData);
    expect(balatroData.entity_id).toBeTruthy();
    expect(balatroData.type).toBe('urn:entity:videogame');

    const daveTheDiver = await searchEntityHandler!({ query: 'Dave the Diver' });
    const daveData = JSON.parse(daveTheDiver);
    console.log('Dave the Diver search result:', daveData);
    expect(daveData.entity_id).toBeTruthy();
    expect(daveData.type).toBe('urn:entity:videogame');

    // Step 2: Try to get video game recommendations
    console.log('\n2. Attempting video game recommendations...');
    
    const gameRecs = await getRecommendationHandler!({
      entity_ids: `${balatroData.entity_id},${daveData.entity_id}`,
      output_type: 'urn:entity:videogame'
    });
    
    const gameRecsData = JSON.parse(gameRecs);
    console.log('Video game recommendation result:', gameRecsData);

    // Check if we got an error or successful fallback
    if (gameRecsData.error) {
      console.log('ERROR: Video game recommendations failed without fallback');
      console.log('Error details:', gameRecsData);
      
      // This should not happen with our fallback logic
      expect(gameRecsData.error).toBeNull(); // This will fail if fallback didn't work
    } else {
      // We should get movie recommendations
      expect(gameRecsData.recommendations).toBeDefined();
      expect(gameRecsData.recommendations.length).toBeGreaterThan(0);
      // Check that we got recommendations (the handler doesn't return output_type)
      expect(gameRecsData.top_pick).toBeDefined();
      
      console.log('SUCCESS: Got fallback movie recommendations');
      console.log('Fallback note:', gameRecsData.fallback_note);
      console.log('Top recommendation:', gameRecsData.top_pick?.name);
    }
  });

  test('should automatically infer video game type and fallback', async () => {
    console.log('\n=== Testing Automatic Type Inference ===\n');

    // Search for video games
    const blasphemous = await searchEntityHandler!({ query: 'Blasphemous' });
    const blasphemousData = JSON.parse(blasphemous);
    
    const deadCells = await searchEntityHandler!({ query: 'Dead Cells' });
    const deadCellsData = JSON.parse(deadCells);

    // Get recommendations WITHOUT specifying output_type
    console.log('Getting recommendations without output_type...');
    
    const autoRecs = await getRecommendationHandler!({
      entity_ids: `${blasphemousData.entity_id},${deadCellsData.entity_id}`
      // No output_type specified - should infer from inputs
    });
    
    const autoRecsData = JSON.parse(autoRecs);
    console.log('Auto-inference result:', autoRecsData);

    // Should either succeed with fallback or get recommendations
    if (autoRecsData.error) {
      console.log('ERROR: Auto-inference failed');
      console.log('Error details:', autoRecsData);
      expect(autoRecsData.error).toBeNull(); // This will fail if no fallback
    } else {
      expect(autoRecsData.recommendations).toBeDefined();
      expect(autoRecsData.recommendations.length).toBeGreaterThan(0);
      console.log('SUCCESS: Got recommendations');
      console.log('Source:', autoRecsData.source);
      console.log('Has fallback note:', !!autoRecsData.fallback_note);
    }
  });

  test('should handle explicit movie request with video game inputs', async () => {
    console.log('\n=== Testing Explicit Movie Request ===\n');

    // This should work as shown in the logs
    const hades = await searchEntityHandler!({ query: 'Hades' });
    const hadesData = JSON.parse(hades);
    
    const celeste = await searchEntityHandler!({ query: 'Celeste' });
    const celesteData = JSON.parse(celeste);

    const movieRecs = await getRecommendationHandler!({
      entity_ids: `${hadesData.entity_id},${celesteData.entity_id}`,
      output_type: 'urn:entity:movie' // Explicitly ask for movies
    });
    
    const movieRecsData = JSON.parse(movieRecs);
    console.log('Movie recommendation result:', movieRecsData);

    // This should always work
    expect(movieRecsData.recommendations).toBeDefined();
    expect(movieRecsData.recommendations.length).toBeGreaterThan(0);
    expect(movieRecsData.error).toBeUndefined();
    
    console.log('SUCCESS: Got movie recommendations for video game inputs');
    console.log('Top pick:', movieRecsData.top_pick?.name);
  });
});