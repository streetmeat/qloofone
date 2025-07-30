#!/usr/bin/env node

const dotenv = require('dotenv');
dotenv.config();

const QLOO_API_KEY = process.env.QLOO_API_KEY;
const QLOO_API_URL = process.env.QLOO_API_URL || 'https://hackathon.api.qloo.com';

async function testNeighborhoodPersonalization() {
  console.log('🎯 Testing Neighborhood Targeting + Entity Personalization\n');
  console.log('Question: Do we get different, personalized results for different fans');
  console.log('          while still properly targeting specific neighborhoods?\n');
  
  // Test different entities in the same neighborhood
  const tests = [
    {
      entity: "Taylor Swift",
      neighborhood: "Capitol Hill Seattle",
      venue_type: "coffee"
    },
    {
      entity: "Nirvana",
      neighborhood: "Capitol Hill Seattle", 
      venue_type: "coffee"
    },
    {
      entity: "The Office",
      neighborhood: "Capitol Hill Seattle",
      venue_type: "coffee"
    },
    {
      entity: "Friends",
      neighborhood: "Capitol Hill Seattle",
      venue_type: "coffee"
    }
  ];
  
  const allResults = {};
  
  // Run all tests
  for (const test of tests) {
    console.log(`\n📋 ${test.entity} fans - ${test.neighborhood} ${test.venue_type} shops`);
    console.log('─'.repeat(70));
    
    // Search for entity
    const entityResp = await fetch(`${QLOO_API_URL}/search?query=${encodeURIComponent(test.entity)}`, {
      headers: { 'X-Api-Key': QLOO_API_KEY, 'Accept': 'application/json' }
    });
    const entityData = await entityResp.json();
    const entity = entityData.results?.[0];
    
    if (!entity) {
      console.log('❌ Entity not found');
      continue;
    }
    
    console.log(`✅ Entity: ${entity.name} (${entity.entity_id})`);
    
    // Use filter.location.query for neighborhood
    const params = new URLSearchParams({
      'signal.interests.entities': entity.entity_id,
      'filter.type': 'urn:entity:place',
      'filter.location.query': test.neighborhood,
      'filter.location.radius': '1000',  // 1km to keep it neighborhood-focused
      'filter.tags': 'urn:tag:category:place:coffee_shop',
      'take': '10',
      'sort_by': 'affinity'  // Important: sort by affinity for personalization
    });
    
    const url = `${QLOO_API_URL}/v2/insights?${params}`;
    console.log(`🔍 Using filter.location.query: "${test.neighborhood}"`);
    
    const response = await fetch(url, {
      headers: { 'X-Api-Key': QLOO_API_KEY, 'Accept': 'application/json' }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.log(`❌ Error: ${response.status}`);
      continue;
    }
    
    if (data.results?.entities?.length > 0) {
      console.log(`\n📊 Top 5 results:`);
      const venues = data.results.entities.slice(0, 5);
      
      allResults[test.entity] = venues.map(v => ({
        name: v.name,
        address: v.properties?.address || '',
        affinity: v.query?.affinity || 0
      }));
      
      venues.forEach((venue, i) => {
        console.log(`${i+1}. ${venue.name} - ${(venue.query.affinity * 100).toFixed(1)}%`);
        
        // Check if address indicates Capitol Hill
        const addr = venue.properties?.address || '';
        if (addr.includes('98102') || addr.includes('98112') || 
            addr.toLowerCase().includes('broadway') || addr.toLowerCase().includes('pike') ||
            addr.toLowerCase().includes('15th ave') || addr.toLowerCase().includes('12th ave')) {
          console.log(`   ✅ ${addr} (Capitol Hill area)`);
        } else {
          console.log(`   📍 ${addr}`);
        }
      });
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Analysis
  console.log('\n\n📊 ANALYSIS: Comparing Results Across Different Entities');
  console.log('═'.repeat(80));
  
  // Check uniqueness
  const entityNames = Object.keys(allResults);
  const venueMatrix = {};
  
  // Build matrix of which venues appear for which entities
  entityNames.forEach(entity => {
    allResults[entity].forEach(venue => {
      if (!venueMatrix[venue.name]) {
        venueMatrix[venue.name] = [];
      }
      venueMatrix[venue.name].push({
        entity: entity,
        affinity: venue.affinity
      });
    });
  });
  
  // Count shared vs unique venues
  let sharedByAll = 0;
  let uniqueToOne = 0;
  let sharedBySome = 0;
  
  Object.entries(venueMatrix).forEach(([venue, appearances]) => {
    if (appearances.length === entityNames.length) {
      sharedByAll++;
    } else if (appearances.length === 1) {
      uniqueToOne++;
    } else {
      sharedBySome++;
    }
  });
  
  console.log('\n📈 Venue Distribution:');
  console.log(`   Shared by all ${entityNames.length} entities: ${sharedByAll} venues`);
  console.log(`   Shared by 2-${entityNames.length-1} entities: ${sharedBySome} venues`);
  console.log(`   Unique to one entity: ${uniqueToOne} venues`);
  
  // Show some examples
  console.log('\n🦄 Venues unique to specific fan bases:');
  Object.entries(venueMatrix).forEach(([venue, appearances]) => {
    if (appearances.length === 1) {
      console.log(`   ${venue} - Only for ${appearances[0].entity} fans (${(appearances[0].affinity * 100).toFixed(1)}%)`);
    }
  });
  
  console.log('\n🤝 Venues that appear for multiple (but not all) fan bases:');
  Object.entries(venueMatrix)
    .filter(([_, apps]) => apps.length > 1 && apps.length < entityNames.length)
    .slice(0, 3)
    .forEach(([venue, appearances]) => {
      const entities = appearances.map(a => `${a.entity} (${(a.affinity * 100).toFixed(1)}%)`).join(', ');
      console.log(`   ${venue} - ${entities}`);
    });
  
  // Check ordering differences
  console.log('\n🎯 Top venue for each fan base:');
  entityNames.forEach(entity => {
    const top = allResults[entity][0];
    console.log(`   ${entity}: ${top.name} (${(top.affinity * 100).toFixed(1)}%)`);
  });
  
  // Neighborhood accuracy check
  console.log('\n📍 Neighborhood Targeting Accuracy:');
  let inCapitolHill = 0;
  let total = 0;
  
  Object.values(allResults).forEach(venues => {
    venues.forEach(venue => {
      total++;
      const addr = venue.address;
      if (addr.includes('98102') || addr.includes('98112') || 
          addr.toLowerCase().includes('broadway') || addr.toLowerCase().includes('pike') ||
          addr.toLowerCase().includes('15th ave') || addr.toLowerCase().includes('12th ave')) {
        inCapitolHill++;
      }
    });
  });
  
  console.log(`   ${inCapitolHill} out of ${total} results appear to be in Capitol Hill`);
  console.log(`   Accuracy: ${((inCapitolHill / total) * 100).toFixed(1)}%`);
  
  // Final verdict
  console.log('\n\n✅ VERDICT:');
  console.log('─'.repeat(50));
  
  const hasPersonalization = uniqueToOne > 0 || sharedBySome > sharedByAll;
  const hasNeighborhoodTargeting = (inCapitolHill / total) > 0.5;
  
  if (hasPersonalization && hasNeighborhoodTargeting) {
    console.log('SUCCESS! The API provides:');
    console.log('1. ✅ Personalized results based on entity preferences');
    console.log('2. ✅ Proper neighborhood targeting without hardcoding');
    console.log('3. ✅ Different venue rankings for different fan bases');
    console.log('4. ✅ No need for coordinate hardcoding');
  } else {
    console.log('ISSUES FOUND:');
    if (!hasPersonalization) {
      console.log('❌ Limited personalization - most venues are the same');
    }
    if (!hasNeighborhoodTargeting) {
      console.log('❌ Poor neighborhood targeting - venues spread across city');
    }
  }
}

testNeighborhoodPersonalization().catch(console.error);