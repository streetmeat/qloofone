#!/usr/bin/env node

/**
 * Comprehensive test script to debug entity type combinations in Qloo API
 * Based on Discord insights and API documentation
 */

require('dotenv').config();
const axios = require('axios');

const API_URL = process.env.QLOO_API_URL || 'https://hackathon.api.qloo.com';
const API_KEY = process.env.QLOO_API_KEY;

if (!API_KEY) {
  console.error('❌ QLOO_API_KEY not found in environment');
  process.exit(1);
}

// Test different entity combinations
const TEST_SCENARIOS = [
  {
    name: 'Same Type Entities (Movies)',
    description: 'Combining two movies - should blend genres',
    entities: [
      { id: '1318E55A-C4AD-48C0-8696-8CDC2CBEDDA1', name: 'The Shining', type: 'movie' },
      { id: '34D933F6-AF99-4302-9A03-E11FBE9B3F19', name: 'Shaun of the Dead', type: 'movie' }
    ],
    outputType: 'urn:entity:movie',
    expected: 'Horror-comedy blend'
  },
  {
    name: 'Cross-Media Entities (Movie + TV Show)',
    description: 'Can we get movies from TV show + movie combo?',
    entities: [
      { id: 'E5AE1F26-04CB-4CDD-BBA4-87FB6541F848', name: 'The Office', type: 'tv_show' },
      { id: 'D59BB2C8-06F1-4906-99E4-86E8A7A254F8', name: 'Final Destination', type: 'movie' }
    ],
    outputType: 'urn:entity:movie',
    expected: 'Movies that blend comedy and horror'
  },
  {
    name: 'Artist + Movie Combination',
    description: 'Music taste influencing movie recommendations',
    entities: [
      { id: '4BBEF799-A0C4-4110-AB01-39216993C312', name: 'Taylor Swift', type: 'artist' },
      { id: '00E45707-AE31-4215-A98D-56F427B28672', name: 'The Silence of the Lambs', type: 'movie' }
    ],
    outputType: 'urn:entity:movie',
    expected: 'Movies for Taylor Swift fans who like thrillers'
  },
  {
    name: 'Brand + Artist for Places',
    description: 'Finding venues based on brand and music preference',
    entities: [
      { id: 'B13C02E3-BA3C-4B39-85B4-ACF12FEBC892', name: 'Starbucks', type: 'brand' },
      { id: '4BBEF799-A0C4-4110-AB01-39216993C312', name: 'Taylor Swift', type: 'artist' }
    ],
    outputType: 'urn:entity:place',
    expected: 'Coffee shops that Taylor Swift fans frequent'
  },
  {
    name: 'Tag + Entity Combination',
    description: 'Using Marvel tag with a specific movie',
    entities: [
      { id: '904F1A2E-90DB-46F6-A129-D9AA355883C8', name: 'Marvel', type: 'tag' },
      { id: 'D59BB2C8-06F1-4906-99E4-86E8A7A254F8', name: 'Final Destination', type: 'movie' }
    ],
    outputType: 'urn:entity:movie',
    expected: 'Action movies with Final Destination intensity'
  }
];

// Test search endpoint with types parameter
async function testSearchEndpoint() {
  console.log('\n🔍 Testing Search Endpoint with Types Parameter\n');
  
  const searchTests = [
    { query: 'The Office', types: null },
    { query: 'The Office', types: ['urn:entity:tv_show'] },
    { query: 'The Office', types: ['urn:entity:tv_show', 'urn:entity:podcast'] },
    { query: 'Marvel', types: ['urn:entity:movie', 'urn:entity:brand'] },
    { query: 'Star Wars', types: ['urn:entity:movie', 'urn:entity:tv_show', 'urn:entity:videogame'] }
  ];

  for (const test of searchTests) {
    try {
      let url = `${API_URL}/search?query=${encodeURIComponent(test.query)}`;
      if (test.types) {
        url += `&types=${encodeURIComponent(test.types.join(','))}`;
      }

      console.log(`Query: "${test.query}"`);
      console.log(`Types filter: ${test.types ? test.types.join(', ') : 'none'}`);
      
      const response = await axios.get(url, {
        headers: { 'X-Api-Key': API_KEY }
      });

      const results = response.data.results || [];
      console.log(`Found: ${results.length} results`);
      
      // Analyze the types returned
      const typeCount = {};
      results.forEach(r => {
        const type = r.type || r.entity_type || 'unknown';
        typeCount[type] = (typeCount[type] || 0) + 1;
      });
      
      console.log('Type distribution:', typeCount);
      console.log('First 3 results:');
      results.slice(0, 3).forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.name} (${r.type || r.entity_type || 'type unknown'})`);
      });
      console.log('---\n');
    } catch (error) {
      console.log(`❌ Error: ${error.response?.status} ${error.response?.statusText || error.message}`);
      console.log('---\n');
    }
  }
}

// Test entity combinations
async function testEntityCombinations() {
  console.log('\n🧪 Testing Entity Combinations\n');

  for (const scenario of TEST_SCENARIOS) {
    console.log(`\n📊 ${scenario.name}`);
    console.log(`Description: ${scenario.description}`);
    console.log(`Entities: ${scenario.entities.map(e => `${e.name} (${e.type})`).join(' + ')}`);
    console.log(`Output type: ${scenario.outputType}`);
    console.log(`Expected: ${scenario.expected}`);
    console.log('-'.repeat(60));

    try {
      const params = new URLSearchParams({
        'signal.interests.entities': scenario.entities.map(e => e.id).join(','),
        'filter.type': scenario.outputType,
        'take': '5',
        'feature.explainability': 'true'
      });

      const startTime = Date.now();
      const response = await axios.get(`${API_URL}/v2/insights?${params}`, {
        headers: { 'X-Api-Key': API_KEY }
      });
      const duration = Date.now() - startTime;

      const results = response.data.results?.entities || [];
      console.log(`✅ Success! Got ${results.length} results in ${duration}ms`);
      
      if (results.length > 0) {
        console.log('\nTop 3 recommendations:');
        results.slice(0, 3).forEach((item, i) => {
          console.log(`${i + 1}. ${item.name}`);
          if (item.properties?.tags) {
            const tags = item.properties.tags.slice(0, 5).map(t => t.name || t);
            console.log(`   Tags: ${tags.join(', ')}`);
          }
          if (item.score || item.affinity_score) {
            console.log(`   Score: ${(item.score || item.affinity_score).toFixed(3)}`);
          }
        });
      }

      // Analyze if results match expectations
      console.log('\n📈 Analysis:');
      const resultNames = results.map(r => r.name.toLowerCase()).join(' ');
      const matchesExpectation = scenario.expected.toLowerCase().split(' ').some(word => 
        resultNames.includes(word)
      );
      console.log(`Matches expectation: ${matchesExpectation ? '✅ Yes' : '❓ Unclear'}`);

    } catch (error) {
      console.log(`❌ Error: ${error.response?.status} ${error.response?.statusText || error.message}`);
      if (error.response?.data) {
        console.log('Error details:', JSON.stringify(error.response.data, null, 2));
      }
    }
  }
}

// Test signal combinations with tags
async function testSignalCombinations() {
  console.log('\n\n🏷️ Testing Signal Combinations (Entities + Tags)\n');

  const signalTests = [
    {
      name: 'Entity + Tag Signal',
      entities: ['4BBEF799-A0C4-4110-AB01-39216993C312'], // Taylor Swift
      tags: ['urn:tag:mood:romantic', 'urn:tag:genre:pop'],
      outputType: 'urn:entity:movie',
      expected: 'Romantic movies for pop music fans'
    },
    {
      name: 'Multiple Entities + Multiple Tags',
      entities: [
        'E5AE1F26-04CB-4CDD-BBA4-87FB6541F848', // The Office
        '1BE5BC88-7B87-4825-B75B-60A5145C9D2C'  // Friends
      ],
      tags: ['urn:tag:category:place:coffee_shop'],
      outputType: 'urn:entity:place',
      expected: 'Coffee shops for sitcom fans'
    }
  ];

  for (const test of signalTests) {
    console.log(`\n📊 ${test.name}`);
    console.log(`Entities: ${test.entities.length}, Tags: ${test.tags.length}`);
    console.log(`Expected: ${test.expected}`);
    console.log('-'.repeat(40));

    try {
      const params = new URLSearchParams({
        'signal.interests.entities': test.entities.join(','),
        'signal.interests.tags': test.tags.join(','),
        'filter.type': test.outputType,
        'take': '3'
      });

      const response = await axios.get(`${API_URL}/v2/insights?${params}`, {
        headers: { 'X-Api-Key': API_KEY }
      });

      const results = response.data.results?.entities || [];
      console.log(`✅ Got ${results.length} results`);
      
      results.forEach((item, i) => {
        console.log(`${i + 1}. ${item.name}`);
      });

    } catch (error) {
      console.log(`❌ Error: ${error.response?.status}`);
    }
  }
}

// Test parameter validation
async function testParameterValidation() {
  console.log('\n\n⚠️ Testing Parameter Validation\n');

  const validationTests = [
    {
      name: 'Invalid entity type combination',
      params: {
        'signal.interests.entities': 'invalid-id-1,invalid-id-2',
        'filter.type': 'urn:entity:movie'
      }
    },
    {
      name: 'Mismatched filter.type',
      params: {
        'signal.interests.entities': '4BBEF799-A0C4-4110-AB01-39216993C312', // Artist
        'filter.type': 'urn:entity:book' // Asking for books from music artist
      }
    },
    {
      name: 'Empty signals',
      params: {
        'signal.interests.entities': '',
        'filter.type': 'urn:entity:movie'
      }
    }
  ];

  for (const test of validationTests) {
    console.log(`Testing: ${test.name}`);
    try {
      const params = new URLSearchParams(test.params);
      const response = await axios.get(`${API_URL}/v2/insights?${params}`, {
        headers: { 'X-Api-Key': API_KEY }
      });
      
      const results = response.data.results?.entities || [];
      console.log(`Result: ${results.length > 0 ? '✅ Got results' : '⚠️ No results'}`);
      
    } catch (error) {
      console.log(`Result: ❌ Error ${error.response?.status} - ${error.response?.data?.message || 'Unknown error'}`);
    }
    console.log('---');
  }
}

// Main test runner
async function runAllTests() {
  console.log('🔬 Qloo API Entity Combination Debugging Tests\n');
  console.log('Testing how different entity types can be combined...\n');

  await testSearchEndpoint();
  await testEntityCombinations();
  await testSignalCombinations();
  await testParameterValidation();

  console.log('\n\n📋 Key Findings Summary:');
  console.log('1. Check if search endpoint types parameter actually filters results');
  console.log('2. Verify which entity type combinations produce meaningful results');
  console.log('3. Understand how tags and entities can be combined as signals');
  console.log('4. Document any limitations or unexpected behaviors');
}

// Run tests
runAllTests().catch(console.error);