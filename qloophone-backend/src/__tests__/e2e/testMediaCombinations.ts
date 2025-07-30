import * as dotenv from 'dotenv';
dotenv.config();

const QLOO_API_KEY = process.env.QLOO_API_KEY || '';
const QLOO_API_URL = process.env.QLOO_API_URL || 'https://hackathon.api.qloo.com';

async function testMediaCombinations() {
  console.log('Testing 2-Entity Media Combinations (Movies, TV, Music, Books)...\n');
  
  try {
    // Test 1: Two Movies
    console.log('TEST 1: MOVIES + MOVIES');
    console.log('User: "I love The Matrix and Inception"\n');
    await testCombination('The Matrix', 'Inception', 'urn:entity:movie', 'Movies');
    
    // Test 2: Two TV Shows  
    console.log('\n\nTEST 2: TV SHOWS + TV SHOWS');
    console.log('User: "I love The Office and Parks and Recreation"\n');
    await testCombination('The Office', 'Parks and Recreation', 'urn:entity:tv_show', 'TV Shows');
    
    // Test 3: Music Artists
    console.log('\n\nTEST 3: MUSIC + MUSIC');
    console.log('User: "I love Taylor Swift and Beyonce"\n');
    await testCombination('Taylor Swift', 'Beyonce', 'urn:entity:artist', 'Artists');
    
    // Test 4: Cross-Media - Movie + TV Show
    console.log('\n\nTEST 4: CROSS-MEDIA (Movie + TV Show)');
    console.log('User: "I love Star Wars and Game of Thrones"\n');
    await testCombination('Star Wars', 'Game of Thrones', null, 'Auto-infer');
    
    // Test 5: Music + Movie
    console.log('\n\nTEST 5: CROSS-MEDIA (Music + Movie)');
    console.log('User: "I love Radiohead and Blade Runner"\n');
    await testCombination('Radiohead', 'Blade Runner', 'urn:entity:movie', 'Movies');
    
    // Test 6: Books
    console.log('\n\nTEST 6: BOOKS + BOOKS');
    console.log('User: "I love Harry Potter and Lord of the Rings"\n');
    await testCombination('Harry Potter', 'Lord of the Rings', 'urn:entity:book', 'Books');
    
    // Test 7: TV Comedy Shows
    console.log('\n\nTEST 7: COMEDY TV SHOWS');
    console.log('User: "I love Friends and Seinfeld"\n');
    await testCombination('Friends', 'Seinfeld', 'urn:entity:tv_show', 'TV Shows');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

async function testCombination(entity1: string, entity2: string, outputType: string | null, description: string) {
  try {
    // Step 1: Search for both entities
    console.log('1. Searching for entities:');
    
    const search1 = await fetch(`${QLOO_API_URL}/search?query=${encodeURIComponent(entity1)}`, {
      headers: { 'X-Api-Key': QLOO_API_KEY, 'Accept': 'application/json' },
    });
    const data1: any = await search1.json();
    const e1 = data1.results?.[0];
    console.log(`   Found: ${e1?.name} (${e1?.entity_id})`);
    
    const search2 = await fetch(`${QLOO_API_URL}/search?query=${encodeURIComponent(entity2)}`, {
      headers: { 'X-Api-Key': QLOO_API_KEY, 'Accept': 'application/json' },
    });
    const data2: any = await search2.json();
    const e2 = data2.results?.[0];
    console.log(`   Found: ${e2?.name} (${e2?.entity_id})`);
    
    if (!e1 || !e2) {
      console.log('   ❌ Failed to find entities');
      return;
    }
    
    // Step 2: Get recommendations
    console.log('\n2. Getting recommendations:');
    const params = new URLSearchParams({
      'signal.interests.entities': `${e1.entity_id},${e2.entity_id}`,
      'take': '5',
      'feature.explainability': 'true'
    });
    
    if (outputType) {
      params.append('filter.type', outputType);
    }
    
    const url = `${QLOO_API_URL}/v2/insights?${params}`;
    console.log(`   Requesting ${description}...`);
    
    const response = await fetch(url, {
      headers: { 'X-Api-Key': QLOO_API_KEY, 'Accept': 'application/json' },
    });
    
    if (!response.ok) {
      console.log(`   ❌ Failed: ${response.status}`);
      const errorText = await response.text();
      console.log(`   Error: ${errorText.substring(0, 100)}...`);
      return;
    }
    
    const data: any = await response.json();
    const recommendations = data.results?.entities || [];
    
    console.log(`\n3. Results (${recommendations.length} ${description}):`);
    
    // Analyze top 3 recommendations
    recommendations.slice(0, 3).forEach((rec: any, i: number) => {
      console.log(`\n   ${i + 1}. ${rec.name}`);
      console.log(`      Score: ${(rec.query?.affinity || 0).toFixed(3)}`);
      
      // Check explainability
      const explainability = rec.query?.explainability?.['signal.interests.entities'] || [];
      if (explainability.length > 0) {
        console.log('      Connections:');
        explainability.forEach((exp: any) => {
          const entityName = exp.entity_id === e1.entity_id ? e1.name : 
                            exp.entity_id === e2.entity_id ? e2.name : 'Unknown';
          console.log(`        - ${entityName}: ${(exp.score || 0).toFixed(3)}`);
        });
      } else {
        console.log('      Connections: No explainability data');
      }
      
      // Show relevant tags
      const tags = rec.tags?.slice(0, 5).map((t: any) => t.name || t).filter(Boolean);
      if (tags?.length > 0) {
        console.log(`      Tags: ${tags.join(', ')}`);
      }
    });
    
    // Analyze the pattern
    console.log('\n4. Analysis:');
    const hasBothConnections = recommendations.some((rec: any) => {
      const exp = rec.query?.explainability?.['signal.interests.entities'] || [];
      return exp.length >= 2;
    });
    
    if (hasBothConnections) {
      console.log('   ✅ Shows connections to BOTH input entities');
    } else {
      console.log('   ⚠️  Only shows connection to ONE entity (incomplete data)');
    }
    
    // Check relevance
    const topRec = recommendations[0];
    if (topRec) {
      const exp = topRec.query?.explainability?.['signal.interests.entities'] || [];
      if (exp.length === 2) {
        const scores = exp.map((e: any) => e.score || 0);
        const diff = Math.abs(scores[0] - scores[1]);
        if (diff < 0.2) {
          console.log('   ✅ Balanced recommendation (bridges both tastes)');
        } else {
          console.log('   ⚠️  Skewed toward one input');
        }
      }
    }
    
  } catch (error) {
    console.log('   ❌ Error:', error);
  }
}

// Run the test
testMediaCombinations();