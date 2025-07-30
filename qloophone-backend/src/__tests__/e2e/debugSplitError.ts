import * as dotenv from 'dotenv';
dotenv.config();

// Import the functions
import functionHandlers from '../../functionHandlers';

const get_recommendation = functionHandlers.find(h => h.schema.name === 'get_recommendation')!.handler;

async function debugSplitError() {
  console.log('Testing the exact error case from OpenAI...\n');

  // This is what OpenAI sent in the first attempt:
  // get_recommendation({ "entity_ids": "movies,New York City", "output_type": "movies" })
  
  try {
    console.log('Test 1: Invalid entity_ids format (what OpenAI sent)');
    const result1 = await get_recommendation({
      entity_ids: "movies,New York City",
      output_type: "movies"  // Note: OpenAI sent "movies" not "urn:entity:movie"
    });
    
    console.log('Result:', result1);
  } catch (error: any) {
    console.error('Error caught:', error.message);
    console.error('Stack:', error.stack);
  }

  // Let's also test with undefined to see if that causes the split error
  try {
    console.log('\nTest 2: Testing with undefined entity_ids');
    const args: any = {
      output_type: "urn:entity:movie"
    };
    args.entity_ids = undefined; // Explicitly set to undefined
    
    const result2 = await get_recommendation(args);
    console.log('Result:', result2);
  } catch (error: any) {
    console.error('Error caught:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugSplitError().catch(console.error);