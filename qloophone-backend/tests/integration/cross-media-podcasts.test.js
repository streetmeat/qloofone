#!/usr/bin/env node

/**
 * Test cross-media recommendations: Can TV + Movie return Podcasts?
 */

require('dotenv').config();
const axios = require('axios');

const API_URL = process.env.QLOO_API_URL || 'https://hackathon.api.qloo.com';
const API_KEY = process.env.QLOO_API_KEY;

async function testCrossMediaPodcasts() {
  console.log('🎙️ Testing Cross-Media Recommendations: TV + Movie → Podcasts\n');

  const tests = [
    {
      name: 'Popular TV + Movie → Podcasts',
      entities: [
        { id: 'E5AE1F26-04CB-4CDD-BBA4-87FB6541F848', name: 'The Office', type: 'tv_show' },
        { id: '8F45F677-1C67-4306-985C-40BA1D18D5B1', name: 'Star Wars', type: 'movie' }
      ],
      expected: 'Comedy/sci-fi podcasts'
    },
    {
      name: 'True Crime Show + Documentary → Podcasts',
      entities: [
        { id: '24BF33A5-4F79-4A77-8A73-D9EFD4F0D276', name: 'Making a Murderer', type: 'tv_show' },
        { id: '00E45707-AE31-4215-A98D-56F427B28672', name: 'The Silence of the Lambs', type: 'movie' }
      ],
      expected: 'True crime podcasts'
    },
    {
      name: 'Comedy Show + Comedy Movie → Podcasts',
      entities: [
        { id: '1BE5BC88-7B87-4825-B75B-60A5145C9D2C', name: 'Friends', type: 'tv_show' },
        { id: '95DC0B4E-F8A8-4C14-8C96-4B14A65C3D26', name: 'Anchorman', type: 'movie' }
      ],
      expected: 'Comedy podcasts'
    }
  ];

  for (const test of tests) {
    console.log(`\n📊 ${test.name}`);
    console.log(`Input: ${test.entities.map(e => `${e.name} (${e.type})`).join(' + ')}`);
    console.log(`Expected: ${test.expected}`);
    console.log('-'.repeat(50));

    try {
      const params = new URLSearchParams({
        'signal.interests.entities': test.entities.map(e => e.id).join(','),
        'filter.type': 'urn:entity:podcast',
        'take': '5',
        'feature.explainability': 'true'
      });

      const response = await axios.get(`${API_URL}/v2/insights?${params}`, {
        headers: { 'X-Api-Key': API_KEY }
      });

      const podcasts = response.data.results?.entities || [];
      
      if (podcasts.length > 0) {
        console.log(`✅ Success! Found ${podcasts.length} podcast recommendations:\n`);
        podcasts.forEach((p, i) => {
          console.log(`${i + 1}. ${p.name}`);
          if (p.properties?.description) {
            console.log(`   ${p.properties.description.substring(0, 100)}...`);
          }
          if (p.properties?.tags) {
            const genres = p.properties.tags
              .filter(t => t.includes('genre') || t.includes('category'))
              .slice(0, 3);
            if (genres.length > 0) {
              console.log(`   Genres: ${genres.join(', ')}`);
            }
          }
        });
      } else {
        console.log('❌ No podcast recommendations returned');
      }

    } catch (error) {
      console.log(`❌ Error: ${error.response?.status} - ${error.response?.statusText}`);
      if (error.response?.data?.message) {
        console.log(`   Details: ${error.response.data.message}`);
      }
    }
  }

  console.log('\n\n📋 Summary:');
  console.log('According to API documentation, cross-media recommendations SHOULD work.');
  console.log('The API accepts signal.interests.entities of any type when filter.type=urn:entity:podcast');
}

testCrossMediaPodcasts().catch(console.error);