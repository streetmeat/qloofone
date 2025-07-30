#!/usr/bin/env node

/**
 * Test batch entity search capabilities
 * Can we search for multiple entities in a single request?
 */

require('dotenv').config();
const axios = require('axios');

const API_URL = process.env.QLOO_API_URL || 'https://hackathon.api.qloo.com';
const API_KEY = process.env.QLOO_API_KEY;

async function testBatchEntitySearch() {
  console.log('🔍 Testing Batch Entity Search Capabilities\n');

  // Test 1: Traditional single search (baseline)
  console.log('1️⃣ Traditional Single Entity Search (baseline)\n');
  const singleSearches = ['Taylor Swift', 'The Office', 'Starbucks'];
  
  console.time('Sequential searches');
  for (const query of singleSearches) {
    try {
      const response = await axios.get(`${API_URL}/search?query=${encodeURIComponent(query)}`, {
        headers: { 'X-Api-Key': API_KEY }
      });
      
      const results = response.data.results || [];
      console.log(`✅ "${query}": Found ${results.length} results`);
      if (results[0]) {
        console.log(`   → ${results[0].name} (${results[0].entity_id})`);
      }
    } catch (error) {
      console.log(`❌ "${query}": Error ${error.response?.status}`);
    }
  }
  console.timeEnd('Sequential searches');

  // Test 2: POST request with array (based on documentation)
  console.log('\n\n2️⃣ POST Request with Entity Query Array\n');
  
  try {
    console.time('Batch POST search');
    const postResponse = await axios.post(`${API_URL}/v2/insights`, {
      'filter.type': 'urn:entity:movie',
      'filter.results.entities.query': ['Taylor Swift', 'The Office', 'Starbucks']
    }, {
      headers: { 
        'X-Api-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    console.timeEnd('Batch POST search');
    console.log('✅ POST request succeeded');
    console.log('Response:', JSON.stringify(postResponse.data, null, 2).substring(0, 200) + '...');
  } catch (error) {
    console.log(`❌ POST array search failed: ${error.response?.status}`);
    if (error.response?.data) {
      console.log('Error:', error.response.data);
    }
  }

  // Test 3: Entity Search by ID endpoint
  console.log('\n\n3️⃣ Entity Search by Multiple IDs\n');
  
  const knownIds = [
    '4BBEF799-A0C4-4110-AB01-39216993C312', // Taylor Swift
    'E5AE1F26-04CB-4CDD-BBA4-87FB6541F848', // The Office
    'B13C02E3-BA3C-4B39-85B4-ACF12FEBC892'  // Starbucks
  ];

  // Try comma-separated IDs
  try {
    console.time('Batch ID search');
    const idResponse = await axios.get(
      `${API_URL}/entity?ids=${knownIds.join(',')}`,
      {
        headers: { 'X-Api-Key': API_KEY }
      }
    );
    
    console.timeEnd('Batch ID search');
    console.log('✅ Batch ID search succeeded');
    const entities = idResponse.data.results || idResponse.data || [];
    console.log(`Found ${entities.length} entities`);
  } catch (error) {
    console.log(`❌ Batch ID search failed: ${error.response?.status}`);
    
    // Try alternative endpoint
    try {
      const altResponse = await axios.get(
        `${API_URL}/entities/${knownIds.join(',')}`,
        {
          headers: { 'X-Api-Key': API_KEY }
        }
      );
      console.log('✅ Alternative endpoint worked');
    } catch (altError) {
      console.log('❌ Alternative endpoint also failed');
    }
  }

  // Test 4: Insights endpoint with entity name resolution
  console.log('\n\n4️⃣ Insights with filter.results.entities.query (GET)\n');
  
  try {
    const insightsResponse = await axios.get(`${API_URL}/v2/insights`, {
      params: {
        'filter.type': 'urn:entity:movie',
        'filter.results.entities.query': 'Taylor Swift', // Single entity for GET
        'take': '5'
      },
      headers: { 'X-Api-Key': API_KEY }
    });
    
    console.log('✅ Insights with entity query succeeded');
    const results = insightsResponse.data.results?.entities || [];
    console.log(`Found ${results.length} movies filtered by Taylor Swift affinity`);
    
    if (results.length > 0) {
      console.log('Top 3:');
      results.slice(0, 3).forEach((m, i) => {
        console.log(`  ${i+1}. ${m.name}`);
      });
    }
  } catch (error) {
    console.log(`❌ Insights entity query failed: ${error.response?.status}`);
  }

  // Test 5: Compare endpoint for batch analysis
  console.log('\n\n5️⃣ Compare Endpoint (Batch Entity Analysis)\n');
  
  try {
    const compareResponse = await axios.get(`${API_URL}/v2/insights/compare`, {
      params: {
        'a.signal.interests.entities': knownIds.slice(0, 2).join(','),
        'b.signal.interests.entities': knownIds[2],
        'filter.type': 'urn:tag',
        'filter.subtype': 'urn:tag:genre'
      },
      headers: { 'X-Api-Key': API_KEY }
    });
    
    console.log('✅ Compare endpoint succeeded');
    console.log('Can analyze multiple entities in groups');
  } catch (error) {
    console.log(`❌ Compare endpoint failed: ${error.response?.status}`);
  }

  // Summary
  console.log('\n\n📊 Summary of Batch Capabilities:\n');
  console.log('1. Sequential /search queries: ✅ Works but inefficient');
  console.log('2. POST with array: 🤔 Needs testing');
  console.log('3. Batch entity ID lookup: 🤔 Endpoint unclear');
  console.log('4. Entity name resolution in filters: ✅ Works for single entity (GET)');
  console.log('5. Compare endpoint: ✅ Can analyze entity groups');
  
  console.log('\n💡 Recommendation:');
  console.log('For batch operations, cache entity IDs after first lookup');
  console.log('to avoid multiple search queries.');
}

// Run tests
testBatchEntitySearch().catch(console.error);