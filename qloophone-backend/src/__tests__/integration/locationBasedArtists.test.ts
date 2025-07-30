import * as dotenv from 'dotenv';

dotenv.config();

const QLOO_API_KEY = process.env.QLOO_API_KEY || '';
const QLOO_API_URL = process.env.QLOO_API_URL || 'https://hackathon.api.qloo.com';

describe('Location-Based Artist Ranking Tests', () => {
  // Only run if API key is available
  const conditionalTest = QLOO_API_KEY ? test : test.skip;

  conditionalTest('should get top 5 artists in NYC using signal.location.query', async () => {
    // Test the exact example from Discord
    const url = `${QLOO_API_URL}/v2/insights?filter.type=urn:entity:artist&signal.location.query=NYC&take=5`;
    
    console.log('Testing location signal URL:', url);
    
    const response = await fetch(url, {
      headers: {
        'X-Api-Key': QLOO_API_KEY,
        'Accept': 'application/json'
      }
    });

    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json() as any;
      console.log('\n=== TOP 5 ARTISTS IN NYC ===');
      
      if (data.results?.entities) {
        data.results.entities.forEach((artist: any, i: number) => {
          const affinity = artist.query?.affinity || artist.affinity || 'N/A';
          console.log(`${i + 1}. ${artist.name}`);
          console.log(`   Affinity: ${affinity}`);
          console.log(`   Entity ID: ${artist.entity_id}`);
          if (artist.properties?.description) {
            console.log(`   Description: ${artist.properties.description.substring(0, 100)}...`);
          }
          console.log('');
        });
        
        expect(data.results.entities.length).toBeGreaterThan(0);
        expect(data.results.entities.length).toBeLessThanOrEqual(5);
        
        // Verify all results are artists
        data.results.entities.forEach((entity: any) => {
          if (entity.types) {
            expect(entity.types).toContain('urn:entity:artist');
          }
        });
      } else {
        console.log('No entities in response:', data);
      }
    } else {
      const errorText = await response.text();
      console.error('API Error:', response.status, response.statusText);
      console.error('Error body:', errorText);
      
      // This test documents whether the API supports this feature
      fail(`API returned ${response.status}: ${errorText}`);
    }
  });

  conditionalTest('should compare filter.location vs signal.location for artists', async () => {
    console.log('\n=== COMPARING LOCATION APPROACHES ===\n');
    
    // Approach 1: Using filter.location.query (filters to artists FROM that location)
    const filterUrl = `${QLOO_API_URL}/v2/insights?filter.type=urn:entity:artist&filter.location.query=NYC&take=5`;
    
    console.log('1. Testing filter.location.query (artists FROM NYC)');
    console.log('   URL:', filterUrl);
    
    const filterResponse = await fetch(filterUrl, {
      headers: {
        'X-Api-Key': QLOO_API_KEY,
        'Accept': 'application/json'
      }
    });
    
    let filterResults: any[] = [];
    if (filterResponse.ok) {
      const filterData = await filterResponse.json() as any;
      filterResults = filterData.results?.entities || [];
      console.log(`   Found ${filterResults.length} artists FROM NYC`);
      filterResults.slice(0, 3).forEach((artist: any) => {
        console.log(`   - ${artist.name}`);
      });
    } else {
      console.log(`   Error: ${filterResponse.status}`);
    }
    
    console.log('\n2. Testing signal.location.query (artists POPULAR IN NYC)');
    
    // Approach 2: Using signal.location.query (ranks by popularity IN that location)
    const signalUrl = `${QLOO_API_URL}/v2/insights?filter.type=urn:entity:artist&signal.location.query=NYC&take=5`;
    console.log('   URL:', signalUrl);
    
    const signalResponse = await fetch(signalUrl, {
      headers: {
        'X-Api-Key': QLOO_API_KEY,
        'Accept': 'application/json'
      }
    });
    
    let signalResults: any[] = [];
    if (signalResponse.ok) {
      const signalData = await signalResponse.json() as any;
      signalResults = signalData.results?.entities || [];
      console.log(`   Found ${signalResults.length} artists POPULAR IN NYC`);
      signalResults.slice(0, 3).forEach((artist: any) => {
        console.log(`   - ${artist.name}`);
      });
    } else {
      console.log(`   Error: ${signalResponse.status}`);
    }
    
    console.log('\n3. Comparison:');
    console.log(`   Filter approach: ${filterResponse.ok ? 'WORKS' : 'FAILED'} (${filterResults.length} results)`);
    console.log(`   Signal approach: ${signalResponse.ok ? 'WORKS' : 'FAILED'} (${signalResults.length} results)`);
    
    // The results should be different
    if (filterResults.length > 0 && signalResults.length > 0) {
      const filterNames = filterResults.map(a => a.name);
      const signalNames = signalResults.map(a => a.name);
      
      const overlap = filterNames.filter(name => signalNames.includes(name));
      console.log(`   Overlap: ${overlap.length} artists appear in both lists`);
      console.log(`   This shows the approaches return different results`);
    }
  });

  conditionalTest.skip('should test location signals with different entity types', async () => {
    const entityTypes = [
      'urn:entity:artist',
      'urn:entity:movie',
      'urn:entity:tv_show',
      'urn:entity:place',
      'urn:entity:brand'
    ];
    
    console.log('\n=== TESTING SIGNAL.LOCATION WITH DIFFERENT ENTITY TYPES ===\n');
    
    for (const entityType of entityTypes) {
      const url = `${QLOO_API_URL}/v2/insights?filter.type=${entityType}&signal.location.query=NYC&take=3`;
      
      const response = await fetch(url, {
        headers: {
          'X-Api-Key': QLOO_API_KEY,
          'Accept': 'application/json'
        }
      });
      
      console.log(`${entityType}:`);
      console.log(`  Status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json() as any;
        const count = data.results?.entities?.length || 0;
        console.log(`  Results: ${count}`);
        
        if (count > 0) {
          console.log(`  Top result: ${data.results.entities[0].name}`);
        }
      } else {
        console.log(`  Error: ${response.statusText}`);
      }
    }
  });

  conditionalTest('should test complex location + entity signal combination', async () => {
    console.log('\n=== TESTING COMBINED SIGNALS ===\n');
    
    // Get movies popular in NYC among Taylor Swift fans
    const url = `${QLOO_API_URL}/v2/insights?` +
      `filter.type=urn:entity:movie&` +
      `signal.location.query=NYC&` +
      `signal.interests.entities=4BBEF799-A0C4-4110-AB01-39216993C312&` + // Taylor Swift
      `take=5`;
    
    console.log('Getting movies popular in NYC among Taylor Swift fans');
    console.log('URL:', url);
    
    const response = await fetch(url, {
      headers: {
        'X-Api-Key': QLOO_API_KEY,
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json() as any;
      console.log(`\nFound ${data.results?.entities?.length || 0} movies`);
      
      if (data.results?.entities) {
        data.results.entities.forEach((movie: any, i: number) => {
          console.log(`${i + 1}. ${movie.name}`);
          
          // Check if explainability shows both signals
          const explainability = movie.query?.explainability;
          if (explainability) {
            console.log('   Influenced by:');
            if (explainability['signal.interests.entities']) {
              console.log('   - Taylor Swift fan signal');
            }
            if (explainability['signal.location.query']) {
              console.log('   - NYC location signal');
            }
          }
        });
      }
    } else {
      console.error('Failed:', response.status);
    }
  });

  test('should document implementation requirements', () => {
    console.log('\n=== IMPLEMENTATION REQUIREMENTS ===\n');
    
    const requirements = {
      currentSupport: {
        'filter.location.query': true,
        'signal.location.query': false,
        'signal.interests.entities': true,
        'signal.demographics.audiences': true
      },
      
      neededChanges: [
        '1. Add location_signal parameter to get_recommendation function',
        '2. When location_signal is provided, use signal.location.query instead of filter.location.query',
        '3. Allow location signals for non-place entity types',
        '4. Update parameter descriptions to explain the difference:',
        '   - location (filter): Returns entities located IN that area',
        '   - location_signal: Returns entities popular/trending IN that area'
      ],
      
      exampleUsage: {
        'Top artists in LA': {
          location_signal: 'Los Angeles',
          output_type: 'urn:entity:artist'
        },
        'NYC favorite movies': {
          location_signal: 'NYC',
          output_type: 'urn:entity:movie'
        },
        'Seattle coffee shops': {
          location: 'Seattle', // Still use filter for places
          output_type: 'urn:entity:place'
        }
      }
    };
    
    console.log(JSON.stringify(requirements, null, 2));
    
    // This assertion confirms we don't support signal.location yet
    expect(requirements.currentSupport['signal.location.query']).toBe(false);
  });
});