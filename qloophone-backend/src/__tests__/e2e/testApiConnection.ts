import * as dotenv from 'dotenv';
dotenv.config();

const QLOO_API_KEY = process.env.QLOO_API_KEY || '';
const QLOO_API_URL = process.env.QLOO_API_URL || 'https://hackathon.api.qloo.com';

async function testConnection() {
  console.log('Testing Qloo API connection...');
  console.log('API URL:', QLOO_API_URL);
  console.log('API Key:', QLOO_API_KEY ? 'Set' : 'Not set');
  
  // First, search for Taylor Swift
  try {
    console.log('\n1. Searching for Taylor Swift...');
    const searchUrl = `${QLOO_API_URL}/search?query=Taylor%20Swift`;
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'X-Api-Key': QLOO_API_KEY,
        'Accept': 'application/json',
      },
    });
    
    if (!searchResponse.ok) {
      const error = await searchResponse.text();
      console.error('Search failed:', searchResponse.status, error);
      return;
    }
    
    const searchData: any = await searchResponse.json();
    const taylorSwift = searchData.results?.[0];
    console.log('Found:', taylorSwift?.name, 'ID:', taylorSwift?.entity_id);
    
    // Search for NYC
    console.log('\n2. Searching for NYC...');
    const nycUrl = `${QLOO_API_URL}/search?query=New%20York%20City&type=urn:entity:locality`;
    const nycResponse = await fetch(nycUrl, {
      headers: {
        'X-Api-Key': QLOO_API_KEY,
        'Accept': 'application/json',
      },
    });
    
    const nycData: any = await nycResponse.json();
    const nyc = nycData.results?.[0];
    console.log('Found:', nyc?.name, 'ID:', nyc?.entity_id);
    
    // Now try insights with location.query
    console.log('\n3. Testing insights with location.query...');
    const insightsParams = new URLSearchParams({
      'signal.interests.entities': taylorSwift.entity_id,
      'filter.type': 'urn:entity:place',
      'filter.location.query': 'New York City',
      'filter.tags': 'urn:tag:category:place:coffee_shop',
      'take': '5'
    });
    
    const insightsUrl = `${QLOO_API_URL}/v2/insights?${insightsParams}`;
    console.log('URL:', insightsUrl);
    
    const insightsResponse = await fetch(insightsUrl, {
      headers: {
        'X-Api-Key': QLOO_API_KEY,
        'Accept': 'application/json',
      },
    });
    
    if (!insightsResponse.ok) {
      const error = await insightsResponse.text();
      console.error('Insights failed:', insightsResponse.status, error);
      return;
    }
    
    const insightsData: any = await insightsResponse.json();
    console.log('Success! Found', insightsData.results?.entities?.length || 0, 'coffee shops');
    
    // Show first few results
    insightsData.results?.entities?.slice(0, 3).forEach((place: any, i: number) => {
      console.log(`${i + 1}. ${place.name} - Affinity: ${(place.query?.affinity || 0).toFixed(3)}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
testConnection();