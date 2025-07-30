import * as dotenv from 'dotenv';
dotenv.config();

const QLOO_API_KEY = process.env.QLOO_API_KEY || '';
const QLOO_API_URL = process.env.QLOO_API_URL || 'https://hackathon.api.qloo.com';

async function searchEntities() {
  const entitiesToSearch = ['The Office', 'Friends', 'Seinfeld', 'Brooklyn Nine-Nine'];
  
  for (const query of entitiesToSearch) {
    try {
      const searchUrl = `${QLOO_API_URL}/search?query=${encodeURIComponent(query)}&type=urn:entity:tv_show`;
      const response = await fetch(searchUrl, {
        headers: {
          'X-Api-Key': QLOO_API_KEY,
          'Accept': 'application/json',
        },
      });
      
      if (response.ok) {
        const data: any = await response.json();
        console.log(`\n${query}:`);
        data.results?.slice(0, 3).forEach((result: any) => {
          console.log(`  - ${result.name} (ID: ${result.entity_id})`);
        });
      }
    } catch (error) {
      console.error(`Error searching for ${query}:`, error);
    }
  }
}

searchEntities();