import * as dotenv from 'dotenv';
dotenv.config();

// Import the functions
import functionHandlers from '../../functionHandlers';

const get_recommendation = functionHandlers.find(h => h.schema.name === 'get_recommendation')!.handler;

async function debugLocationSignalError() {
  console.log('Debugging location_signal error...\n');

  try {
    console.log('Calling get_recommendation with only location_signal:');
    const result = await get_recommendation({
      location_signal: "NYC",
      output_type: "urn:entity:movie"
    });
    
    console.log('Result:', result);
  } catch (error: any) {
    console.error('Error caught:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugLocationSignalError().catch(console.error);