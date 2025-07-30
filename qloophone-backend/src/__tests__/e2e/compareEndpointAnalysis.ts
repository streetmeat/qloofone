import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const API_URL = process.env.QLOO_API_URL || 'https://hackathon.api.qloo.com';
const API_KEY = process.env.QLOO_API_KEY || '';

// Common entity IDs for testing
const ENTITIES = {
  // From user perspective: Grandma likes classic, you like modern
  grandma: {
    beatles: { id: 'A03FFE21-AD93-4FB1-94C0-C529A7CD2A26', name: 'The Beatles' },
    soundOfMusic: { id: 'F8E8B5F5-2D7C-4E89-9B6A-5C8A7D9E3F21', name: 'The Sound of Music' },
    casablanca: { id: 'E5B8C7D1-3F2A-4E89-9A6B-7C8D9E1F2A3B', name: 'Casablanca' }
  },
  youngPerson: {
    taylorSwift: { id: '4BBEF799-A0C4-4110-AB01-39216993C312', name: 'Taylor Swift' },
    theOffice: { id: 'E5AE1F26-04CB-4CDD-BBA4-87FB6541F848', name: 'The Office' },
    marvel: { id: 'C2A5E8F9-1D3B-4F67-89AB-CDEF01234567', name: 'Marvel' }
  }
};

interface CompareResponse {
  duration: number;
  results: {
    tags?: Array<{
      tag_id: string;
      name: string;
      types: string[];
      subtype: string;
      query: {
        a: { affinity: number };
        b: { affinity: number };
        affinity: number;
        delta: number;
      };
    }>;
    entities?: any[];
  };
}

async function searchEntity(query: string): Promise<string | null> {
  try {
    const url = `${API_URL}/search?query=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        'X-Api-Key': API_KEY,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json() as any;
    if (data.results && data.results.length > 0) {
      console.log(`Found "${query}": ${data.results[0].name} (${data.results[0].entity_id})`);
      return data.results[0].entity_id;
    }
    return null;
  } catch (error) {
    console.error(`Error searching for ${query}:`, error);
    return null;
  }
}

async function analyzeCompareResponse(
  name: string,
  groupA: string[],
  groupB: string[],
  filterType: string
): Promise<void> {
  console.log(`\n📊 Analysis: ${name}`);
  console.log(`Group A: ${groupA.length} entities`);
  console.log(`Group B: ${groupB.length} entities`);
  console.log(`Filter: ${filterType}`);
  
  try {
    const params = new URLSearchParams({
      'a.signal.interests.entities': groupA.join(','),
      'b.signal.interests.entities': groupB.join(','),
      'filter.type': filterType,
      'take': '20'
    });
    
    const response = await fetch(`${API_URL}/v2/insights/compare?${params}`, {
      headers: {
        'X-Api-Key': API_KEY,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.log(`❌ Failed: ${response.status}`);
      return;
    }
    
    const data = await response.json() as CompareResponse;
    
    // Analyze the response
    console.log('\n🔍 What the API Actually Returns:');
    
    if (data.results.tags && data.results.tags.length > 0) {
      console.log(`\n✅ Returns TAG comparisons (not entity recommendations!)`);
      console.log(`Found ${data.results.tags.length} tags\n`);
      
      // Calculate overlap percentage
      const avgDelta = data.results.tags.reduce((sum, tag) => sum + tag.query.delta, 0) / data.results.tags.length;
      const avgAffinityA = data.results.tags.reduce((sum, tag) => sum + tag.query.a.affinity, 0) / data.results.tags.length;
      const avgAffinityB = data.results.tags.reduce((sum, tag) => sum + tag.query.b.affinity, 0) / data.results.tags.length;
      
      console.log('📈 Metrics:');
      console.log(`- Average Delta: ${avgDelta.toFixed(2)} (how different the groups are)`);
      console.log(`- Group A avg affinity: ${(avgAffinityA * 100).toFixed(3)}%`);
      console.log(`- Group B avg affinity: ${(avgAffinityB * 100).toFixed(3)}%`);
      
      // Find strongest overlaps (lowest delta)
      const overlaps = data.results.tags
        .sort((a, b) => a.query.delta - b.query.delta)
        .slice(0, 5);
      
      console.log('\n🤝 Top 5 Overlapping Interests (lowest delta = most similar):');
      overlaps.forEach((tag, i) => {
        const percentA = (tag.query.a.affinity * 100).toFixed(3);
        const percentB = (tag.query.b.affinity * 100).toFixed(3);
        console.log(`${i+1}. ${tag.name} (delta: ${tag.query.delta.toFixed(2)})`);
        console.log(`   Group A: ${percentA}% | Group B: ${percentB}%`);
      });
      
      // Find biggest differences (highest delta)
      const differences = data.results.tags
        .sort((a, b) => b.query.delta - a.query.delta)
        .slice(0, 5);
      
      console.log('\n🔄 Top 5 Differences (highest delta = most different):');
      differences.forEach((tag, i) => {
        const percentA = (tag.query.a.affinity * 100).toFixed(3);
        const percentB = (tag.query.b.affinity * 100).toFixed(3);
        console.log(`${i+1}. ${tag.name} (delta: ${tag.query.delta.toFixed(2)})`);
        console.log(`   Group A: ${percentA}% | Group B: ${percentB}%`);
      });
      
    } else {
      console.log('❌ No tag comparisons returned');
    }
    
    if (data.results.entities && data.results.entities.length > 0) {
      console.log(`\n✅ Also returns ${data.results.entities.length} entity recommendations`);
    } else {
      console.log('\n❌ No entity recommendations (only tag analysis)');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

async function testBridgingRecommendations(
  groupA: string[],
  groupB: string[]
): Promise<void> {
  console.log('\n\n🌉 Testing Bridging Recommendations');
  console.log('Can we get actual movie/TV recommendations that bridge tastes?');
  
  // Test 1: Regular insights with both entity groups
  console.log('\n1️⃣ Using regular /v2/insights with combined entities:');
  
  const combinedParams = new URLSearchParams({
    'signal.interests.entities': [...groupA, ...groupB].join(','),
    'filter.type': 'urn:entity:movie',
    'take': '5',
    'feature.explainability': 'true'
  });
  
  try {
    const response = await fetch(`${API_URL}/v2/insights?${combinedParams}`, {
      headers: {
        'X-Api-Key': API_KEY,
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json() as any;
      if (data.results?.entities?.length > 0) {
        console.log(`✅ Found ${data.results.entities.length} bridging recommendations:`);
        data.results.entities.slice(0, 3).forEach((entity: any, i: number) => {
          console.log(`${i+1}. ${entity.name || entity.display_name}`);
          if (entity.properties?.explainability) {
            console.log(`   Explainability: ${JSON.stringify(entity.properties.explainability)}`);
          }
        });
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

async function main() {
  console.log('🔬 Qloo /v2/insights/compare Endpoint Deep Analysis');
  console.log('==================================================\n');
  
  // First, search for classic entities
  console.log('🔍 Searching for classic entities...');
  const beatlesId = await searchEntity('The Beatles');
  const soundOfMusicId = await searchEntity('The Sound of Music'); 
  
  // Use actual IDs or our test IDs
  const grandmaEntities = [
    beatlesId || ENTITIES.grandma.beatles.id,
    soundOfMusicId || ENTITIES.grandma.soundOfMusic.id
  ].filter(Boolean);
  
  const youngEntities = [
    ENTITIES.youngPerson.taylorSwift.id,
    ENTITIES.youngPerson.theOffice.id
  ];
  
  // Test different scenarios
  await analyzeCompareResponse(
    'Grandma vs Young Person - Movies',
    grandmaEntities,
    youngEntities,
    'urn:entity:movie'
  );
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await analyzeCompareResponse(
    'Grandma vs Young Person - TV Shows', 
    grandmaEntities,
    youngEntities,
    'urn:entity:tv_show'
  );
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await analyzeCompareResponse(
    'Grandma vs Young Person - Brands',
    grandmaEntities,
    youngEntities,
    'urn:entity:brand'
  );
  
  // Test bridging recommendations
  await testBridgingRecommendations(grandmaEntities, youngEntities);
  
  console.log('\n\n📝 Key Findings:');
  console.log('1. The /v2/insights/compare endpoint returns TAG comparisons, not entity recommendations');
  console.log('2. It shows affinity scores and delta (difference) between groups for each tag');
  console.log('3. Lower delta = more overlap between groups');
  console.log('4. This could be used to find common ground in terms of themes/genres');
  console.log('5. For actual bridging recommendations, use regular /v2/insights with combined entities');
  
  console.log('\n💡 For Your Use Case:');
  console.log('- Use compare endpoint to find common themes (e.g., "both groups like comedy")');
  console.log('- Then use regular insights to get specific recommendations based on those themes');
  console.log('- Or skip compare and just use combined entities in regular insights endpoint');
}

main().catch(console.error);