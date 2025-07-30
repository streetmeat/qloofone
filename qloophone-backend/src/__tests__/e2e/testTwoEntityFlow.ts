import * as dotenv from 'dotenv';
dotenv.config();

const QLOO_API_KEY = process.env.QLOO_API_KEY || '';
const QLOO_API_URL = process.env.QLOO_API_URL || 'https://hackathon.api.qloo.com';

async function testTwoEntityFlow() {
  console.log('Testing 2-Entity Combination Flow...\n');
  
  try {
    // Step 1: Search for two entities (like the app does)
    console.log('1. SEARCHING FOR ENTITIES (as app does):');
    console.log('   User says: "I love Taylor Swift and sushi"\n');
    
    // Search for Taylor Swift
    const taylorUrl = `${QLOO_API_URL}/search?query=Taylor%20Swift`;
    const taylorResponse = await fetch(taylorUrl, {
      headers: { 'X-Api-Key': QLOO_API_KEY, 'Accept': 'application/json' },
    });
    const taylorData: any = await taylorResponse.json();
    const taylorSwift = taylorData.results?.[0];
    console.log('   Found:', taylorSwift?.name, 'ID:', taylorSwift?.entity_id);
    
    // Search for sushi
    const sushiUrl = `${QLOO_API_URL}/search?query=sushi`;
    const sushiResponse = await fetch(sushiUrl, {
      headers: { 'X-Api-Key': QLOO_API_KEY, 'Accept': 'application/json' },
    });
    const sushiData: any = await sushiResponse.json();
    const sushi = sushiData.results?.[0];
    console.log('   Found:', sushi?.name, 'ID:', sushi?.entity_id);
    
    // Step 2: Call insights endpoint with both entity IDs
    console.log('\n2. GETTING RECOMMENDATIONS (actual API call):');
    const insightsParams = new URLSearchParams({
      'signal.interests.entities': `${taylorSwift.entity_id},${sushi.entity_id}`,
      'filter.type': 'urn:entity:place', // Looking for places
      'take': '5',
      'feature.explainability': 'true'
    });
    
    const insightsUrl = `${QLOO_API_URL}/v2/insights?${insightsParams}`;
    console.log('   URL:', insightsUrl);
    
    const insightsResponse = await fetch(insightsUrl, {
      headers: { 'X-Api-Key': QLOO_API_KEY, 'Accept': 'application/json' },
    });
    
    if (!insightsResponse.ok) {
      console.error('   Failed:', insightsResponse.status);
      return;
    }
    
    const insightsData: any = await insightsResponse.json();
    const recommendations = insightsData.results?.entities || [];
    
    console.log(`\n3. RESULTS (${recommendations.length} recommendations):`);
    
    // Analyze the first 3 recommendations
    recommendations.slice(0, 3).forEach((rec: any, i: number) => {
      console.log(`\n   ${i + 1}. ${rec.name}`);
      console.log(`      Affinity Score: ${(rec.query?.affinity || 0).toFixed(3)}`);
      
      // Check explainability
      const explainability = rec.query?.explainability?.['signal.interests.entities'] || [];
      console.log('      Explainability:');
      
      explainability.forEach((exp: any) => {
        const entityName = exp.entity_id === taylorSwift.entity_id ? 'Taylor Swift' : 'Sushi';
        console.log(`        - ${entityName}: ${(exp.score || 0).toFixed(3)}`);
      });
      
      // Show some tags
      const tags = rec.tags?.slice(0, 3).map((t: any) => t.name || t).join(', ');
      if (tags) console.log(`      Tags: ${tags}`);
    });
    
    // Step 3: Test different combinations
    console.log('\n\n4. TESTING OTHER COMBINATIONS:');
    
    // Test 1: Two movies
    console.log('\n   Test: "The Matrix" + "Inception" → Movies');
    await testCombination('The Matrix', 'Inception', 'urn:entity:movie');
    
    // Test 2: TV show + Food
    console.log('\n   Test: "The Office" + "Pizza" → Places');
    await testCombination('The Office', 'Pizza', 'urn:entity:place');
    
    // Test 3: Same type inputs
    console.log('\n   Test: "Friends" + "Seinfeld" → TV Shows (auto-inferred)');
    await testCombination('Friends', 'Seinfeld', null); // Let it auto-infer
    
  } catch (error) {
    console.error('Error:', error);
  }
}

async function testCombination(entity1: string, entity2: string, outputType: string | null) {
  try {
    // Search for both entities
    const search1 = await fetch(`${QLOO_API_URL}/search?query=${encodeURIComponent(entity1)}`, {
      headers: { 'X-Api-Key': QLOO_API_KEY, 'Accept': 'application/json' },
    });
    const data1: any = await search1.json();
    const e1 = data1.results?.[0];
    
    const search2 = await fetch(`${QLOO_API_URL}/search?query=${encodeURIComponent(entity2)}`, {
      headers: { 'X-Api-Key': QLOO_API_KEY, 'Accept': 'application/json' },
    });
    const data2: any = await search2.json();
    const e2 = data2.results?.[0];
    
    if (!e1 || !e2) {
      console.log('     Failed to find entities');
      return;
    }
    
    // Get recommendations
    const params = new URLSearchParams({
      'signal.interests.entities': `${e1.entity_id},${e2.entity_id}`,
      'take': '3',
      'feature.explainability': 'true'
    });
    
    if (outputType) {
      params.append('filter.type', outputType);
    }
    
    const response = await fetch(`${QLOO_API_URL}/v2/insights?${params}`, {
      headers: { 'X-Api-Key': QLOO_API_KEY, 'Accept': 'application/json' },
    });
    
    if (response.ok) {
      const data: any = await response.json();
      const recs = data.results?.entities || [];
      console.log(`     Results: ${recs.slice(0, 3).map((r: any) => r.name).join(', ')}`);
      
      // Check if type inference worked
      if (!outputType && recs.length > 0) {
        const inferredType = recs[0].types?.[0] || 'unknown';
        console.log(`     Inferred type: ${inferredType}`);
      }
    } else {
      console.log('     Failed:', response.status);
    }
  } catch (error) {
    console.log('     Error:', error);
  }
}

// Run the test
testTwoEntityFlow();