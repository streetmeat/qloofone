import functions from '../../functionHandlers';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

describe('Video Game Type Validation', () => {
  const getRecommendationHandler = functions.find(f => f.schema.name === 'get_recommendation')?.handler;

  beforeAll(() => {
    if (!process.env.QLOO_API_KEY) {
      throw new Error('QLOO_API_KEY is required for integration tests');
    }
  });

  test('should test both videogame and video_game types (video_game gets mapped)', async () => {
    const videoGameIds = 'AF4578FE-B78B-4264-850B-A35F6F70E0B7,66C2DD84-4516-492B-B171-669B21DA764B'; // Balatro, Dave the Diver
    
    console.log('\n=== Testing urn:entity:videogame (no underscore) ===');
    const videogameResult = await getRecommendationHandler!({
      entity_ids: videoGameIds,
      output_type: 'urn:entity:videogame'
    });
    const videogameData = JSON.parse(videogameResult);
    console.log('Result with videogame:', videogameData.error ? 'ERROR' : 'SUCCESS');
    if (videogameData.recommendations) {
      console.log('Got recommendations:', videogameData.recommendations.map((r: any) => r.name));
    } else {
      console.log('Error:', videogameData.error);
    }

    console.log('\n=== Testing urn:entity:video_game (with underscore) ===');
    const videoGameResult = await getRecommendationHandler!({
      entity_ids: videoGameIds,
      output_type: 'urn:entity:video_game'
    });
    const videoGameData = JSON.parse(videoGameResult);
    console.log('Result with video_game:', videoGameData.error ? 'ERROR' : 'SUCCESS');
    if (videoGameData.recommendations) {
      console.log('Got recommendations:', videoGameData.recommendations.map((r: any) => r.name));
    } else {
      console.log('Error:', videoGameData.error);
    }

    // Test what the API actually accepts
    console.log('\n=== Direct API Test ===');
    const testUrl = `https://hackathon.api.qloo.com/v2/insights?filter.type=urn%3Aentity%3Avideogame&take=3&signal.interests.entities=${videoGameIds}`;
    
    try {
      const response = await fetch(testUrl, {
        headers: {
          'X-Api-Key': process.env.QLOO_API_KEY!,
          'Accept': 'application/json',
        },
      });
      
      console.log('Direct API call with videogame:', response.status);
      if (response.ok) {
        const data = await response.json() as any;
        console.log('Response has results:', !!data.results?.entities?.length);
      }
    } catch (err) {
      console.log('Direct API error:', err);
    }
  });
});