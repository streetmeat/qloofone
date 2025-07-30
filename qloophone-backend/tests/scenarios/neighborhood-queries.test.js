#!/usr/bin/env node

const dotenv = require('dotenv');
dotenv.config();

const QLOO_API_KEY = process.env.QLOO_API_KEY;
const QLOO_API_URL = process.env.QLOO_API_URL || 'https://hackathon.api.qloo.com';

async function testNeighborhoodQueries() {
  console.log('🏘️ Testing Neighborhood-Specific Queries\n');
  
  // Test cases
  const tests = [
    {
      name: "Seattle city-wide search",
      location: {
        type: "locality",
        query: "Seattle"
      },
      entity: "Nirvana",
      venue_type: "bar"
    },
    {
      name: "Capitol Hill with coordinates",
      location: {
        type: "coordinates",
        lat: 47.6253,
        lng: -122.3204,
        radius: 1000  // 1km = ~0.6 miles
      },
      entity: "Nirvana", 
      venue_type: "bar"
    },
    {
      name: "Capitol Hill as locality search",
      location: {
        type: "locality",
        query: "Capitol Hill Seattle"
      },
      entity: "Nirvana",
      venue_type: "bar"
    },
    {
      name: "Fan density heatmap - Seattle",
      location: {
        type: "locality",
        query: "Seattle"
      },
      entity: "Nirvana",
      analysis_type: "heatmap"
    }
  ];
  
  for (const test of tests) {
    console.log(`\n📋 ${test.name}`);
    console.log('─'.repeat(60));
    
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
    
    if (test.analysis_type === 'heatmap') {
      // Test heatmap functionality
      let locationParam = {};
      
      if (test.location.type === 'locality') {
        const locResp = await fetch(`${QLOO_API_URL}/search?query=${encodeURIComponent(test.location.query)}&type=urn:entity:locality`, {
          headers: { 'X-Api-Key': QLOO_API_KEY, 'Accept': 'application/json' }
        });
        const locData = await locResp.json();
        const locality = locData.results?.[0];
        
        if (locality) {
          locationParam = { 'filter.location': locality.entity_id };
          console.log(`📍 Location: ${locality.name}`);
        }
      }
      
      const heatmapParams = new URLSearchParams({
        'filter.type': 'urn:heatmap',
        'signal.interests.entities': entity.entity_id,
        'output.heatmap.boundary': 'urn:entity:locality',
        'take': '10',
        ...locationParam
      });
      
      console.log('\n🔥 Getting fan density heatmap...');
      const heatmapResp = await fetch(`${QLOO_API_URL}/v2/insights?${heatmapParams}`, {
        headers: { 'X-Api-Key': QLOO_API_KEY, 'Accept': 'application/json' }
      });
      
      const heatmapData = await heatmapResp.json();
      
      if (heatmapData.results?.entities) {
        console.log('\nTop neighborhoods by fan density:');
        heatmapData.results.entities.slice(0, 5).forEach((area, i) => {
          const affinity = area.query?.affinity || 0;
          console.log(`${i+1}. ${area.name} - ${(affinity * 100).toFixed(1)}% concentration`);
        });
      } else {
        console.log('❌ No heatmap data returned');
      }
      
    } else {
      // Test venue search
      let locationFilter = '';
      let sortBy = 'affinity';
      
      if (test.location.type === 'locality') {
        // Search for locality
        const locResp = await fetch(`${QLOO_API_URL}/search?query=${encodeURIComponent(test.location.query)}&type=urn:entity:locality`, {
          headers: { 'X-Api-Key': QLOO_API_KEY, 'Accept': 'application/json' }
        });
        const locData = await locResp.json();
        const locality = locData.results?.[0];
        
        if (locality) {
          locationFilter = locality.entity_id;
          console.log(`📍 Location: ${locality.name} (${locality.entity_id})`);
        } else {
          console.log(`❌ Location not found: ${test.location.query}`);
          continue;
        }
      } else if (test.location.type === 'coordinates') {
        // Use WKT POINT
        locationFilter = `POINT(${test.location.lng} ${test.location.lat})`;
        sortBy = 'distance';  // Distance makes sense with coordinates
        console.log(`📍 Coordinates: ${test.location.lat}, ${test.location.lng}`);
        console.log(`   Radius: ${test.location.radius}m`);
      }
      
      // Get venues
      const params = new URLSearchParams({
        'signal.interests.entities': entity.entity_id,
        'filter.type': 'urn:entity:place',
        'filter.location': locationFilter,
        'filter.location.radius': String(test.location.radius || 5000),
        'filter.tags': 'urn:tag:category:place:bar',
        'take': '10',
        'sort_by': sortBy
      });
      
      console.log(`\n🍺 Getting ${test.venue_type}s...`);
      const venueResp = await fetch(`${QLOO_API_URL}/v2/insights?${params}`, {
        headers: { 'X-Api-Key': QLOO_API_KEY, 'Accept': 'application/json' }
      });
      
      const venueData = await venueResp.json();
      
      if (venueData.results?.entities?.length > 0) {
        console.log(`\nFound ${venueData.results.entities.length} venues:`);
        venueData.results.entities.slice(0, 5).forEach((venue, i) => {
          console.log(`${i+1}. ${venue.name}`);
          if (venue.properties?.address) {
            console.log(`   ${venue.properties.address}`);
          }
          if (venue.query?.distance && sortBy === 'distance') {
            console.log(`   Distance: ${Math.round(venue.query.distance)}m`);
          }
          if (venue.query?.affinity) {
            console.log(`   Affinity: ${(venue.query.affinity * 100).toFixed(1)}%`);
          }
        });
      } else {
        console.log('❌ No venues found');
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n\n💡 Key Findings:');
  console.log('─'.repeat(50));
  console.log('1. City-wide searches return venues from all neighborhoods');
  console.log('2. Coordinate-based searches can target specific areas');
  console.log('3. Neighborhood names as localities may not be specific enough');
  console.log('4. Heatmaps show which neighborhoods have highest fan density');
}

testNeighborhoodQueries().catch(console.error);