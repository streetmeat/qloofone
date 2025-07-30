import * as dotenv from 'dotenv';
dotenv.config();

const QLOO_API_KEY = process.env.QLOO_API_KEY || '';
const QLOO_API_URL = process.env.QLOO_API_URL || 'https://hackathon.api.qloo.com';

// All entity types from hackathon documentation
const ENTITY_TYPES = [
  'urn:entity:artist',
  'urn:entity:book', 
  'urn:entity:brand',
  'urn:entity:destination',
  'urn:entity:movie',
  'urn:entity:person',
  'urn:entity:place',
  'urn:entity:podcast',
  'urn:entity:tv_show',
  'urn:entity:videogame'
];

// Test entities for each type
const TEST_ENTITIES: Record<string, { name: string, query: string }[]> = {
  'urn:entity:artist': [
    { name: 'Taylor Swift', query: 'Taylor Swift' },
    { name: 'The Beatles', query: 'The Beatles' }
  ],
  'urn:entity:book': [
    { name: 'Harry Potter', query: 'Harry Potter' },
    { name: '1984', query: '1984 George Orwell' }
  ],
  'urn:entity:brand': [
    { name: 'Nike', query: 'Nike' },
    { name: 'Apple', query: 'Apple brand' }
  ],
  'urn:entity:destination': [
    { name: 'Paris', query: 'Paris France' },
    { name: 'Tokyo', query: 'Tokyo Japan' }
  ],
  'urn:entity:movie': [
    { name: 'The Matrix', query: 'The Matrix' },
    { name: 'Star Wars', query: 'Star Wars' }
  ],
  'urn:entity:person': [
    { name: 'Tom Hanks', query: 'Tom Hanks' },
    { name: 'Meryl Streep', query: 'Meryl Streep' }
  ],
  'urn:entity:place': [
    { name: 'Central Park', query: 'Central Park New York' },
    { name: 'Starbucks', query: 'Starbucks coffee' }
  ],
  'urn:entity:podcast': [
    { name: 'Joe Rogan', query: 'Joe Rogan Experience' },
    { name: 'This American Life', query: 'This American Life' }
  ],
  'urn:entity:tv_show': [
    { name: 'The Office', query: 'The Office' },
    { name: 'Friends', query: 'Friends TV show' }
  ],
  'urn:entity:videogame': [
    { name: 'Minecraft', query: 'Minecraft' },
    { name: 'The Legend of Zelda', query: 'Legend of Zelda' }
  ]
};

async function testAllEntityTypes() {
  console.log('Testing All Entity Type Combinations from Hackathon Documentation\n');
  console.log('Entity types to test:', ENTITY_TYPES.length);
  console.log('Total combinations:', ENTITY_TYPES.length * ENTITY_TYPES.length, '\n');
  
  const results: any[] = [];
  
  // Test each output type
  for (const outputType of ENTITY_TYPES) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`OUTPUT TYPE: ${outputType}`);
    console.log('='.repeat(80));
    
    const typeResults: any = {
      outputType,
      combinations: []
    };
    
    // Test with 2 different input types
    for (const inputType of ENTITY_TYPES) {
      if (inputType === outputType) continue; // Skip same-type for now
      
      const testCase = TEST_ENTITIES[inputType][0];
      const testCase2 = TEST_ENTITIES[outputType][0]; // Mix types
      
      console.log(`\n${inputType} + ${outputType} → ${outputType}`);
      console.log(`Testing: "${testCase.query}" + "${testCase2.query}"`);
      
      const result = await testCombination(
        testCase.query,
        testCase2.query,
        outputType
      );
      
      typeResults.combinations.push({
        input1Type: inputType,
        input2Type: outputType,
        ...result
      });
    }
    
    results.push(typeResults);
  }
  
  // Summary
  console.log('\n\n' + '='.repeat(80));
  console.log('SUMMARY OF RESULTS');
  console.log('='.repeat(80));
  
  let successCount = 0;
  let partialCount = 0;
  let failCount = 0;
  
  results.forEach(typeResult => {
    console.log(`\n${typeResult.outputType}:`);
    
    typeResult.combinations.forEach((combo: any) => {
      const status = combo.success ? 
        (combo.hasBothConnections ? '✅ FULL' : '⚠️  PARTIAL') : 
        '❌ FAILED';
      
      if (combo.success && combo.hasBothConnections) successCount++;
      else if (combo.success) partialCount++;
      else failCount++;
      
      console.log(`  ${combo.input1Type} + ${combo.input2Type}: ${status} ${combo.message || ''}`);
    });
  });
  
  console.log('\n\nOVERALL STATS:');
  console.log(`✅ Full Success: ${successCount} combinations`);
  console.log(`⚠️  Partial Success: ${partialCount} combinations`);
  console.log(`❌ Failed: ${failCount} combinations`);
}

async function testCombination(query1: string, query2: string, outputType: string) {
  try {
    // Search for entities
    const search1 = await fetch(`${QLOO_API_URL}/search?query=${encodeURIComponent(query1)}`, {
      headers: { 'X-Api-Key': QLOO_API_KEY, 'Accept': 'application/json' },
    });
    const data1: any = await search1.json();
    const e1 = data1.results?.[0];
    
    const search2 = await fetch(`${QLOO_API_URL}/search?query=${encodeURIComponent(query2)}`, {
      headers: { 'X-Api-Key': QLOO_API_KEY, 'Accept': 'application/json' },
    });
    const data2: any = await search2.json();
    const e2 = data2.results?.[0];
    
    if (!e1 || !e2) {
      return { success: false, message: 'Entity search failed' };
    }
    
    console.log(`  Found: ${e1.name} & ${e2.name}`);
    
    // Get recommendations
    const params = new URLSearchParams({
      'signal.interests.entities': `${e1.entity_id},${e2.entity_id}`,
      'filter.type': outputType,
      'take': '3',
      'feature.explainability': 'true'
    });
    
    const response = await fetch(`${QLOO_API_URL}/v2/insights?${params}`, {
      headers: { 'X-Api-Key': QLOO_API_KEY, 'Accept': 'application/json' },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return { 
        success: false, 
        message: `API ${response.status}: ${errorText.substring(0, 50)}...` 
      };
    }
    
    const data: any = await response.json();
    const recommendations = data.results?.entities || [];
    
    if (recommendations.length === 0) {
      return { success: false, message: 'No recommendations returned' };
    }
    
    // Check explainability
    let hasBothConnections = false;
    let avgExplainabilityCount = 0;
    
    recommendations.forEach((rec: any) => {
      const exp = rec.query?.explainability?.['signal.interests.entities'] || [];
      avgExplainabilityCount += exp.length;
      if (exp.length >= 2) hasBothConnections = true;
    });
    
    avgExplainabilityCount = avgExplainabilityCount / recommendations.length;
    
    const topRecs = recommendations.slice(0, 3).map((r: any) => r.name).join(', ');
    console.log(`  Results: ${topRecs}`);
    console.log(`  Explainability: ${hasBothConnections ? 'Both entities' : 'Single entity only'}`);
    
    return {
      success: true,
      hasBothConnections,
      recommendationCount: recommendations.length,
      topRecommendations: topRecs,
      avgExplainabilityCount
    };
    
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// Run the test
testAllEntityTypes();