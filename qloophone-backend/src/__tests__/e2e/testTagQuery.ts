import * as dotenv from 'dotenv';
dotenv.config();

const QLOO_API_KEY = process.env.QLOO_API_KEY || '';
const QLOO_API_URL = process.env.QLOO_API_URL || 'https://hackathon.api.qloo.com';

async function testTagQuery() {
  console.log('Testing Tag-based Entity Query...');
  console.log('API URL:', QLOO_API_URL);
  console.log('API Key:', QLOO_API_KEY ? 'Set' : 'Not set');
  
  try {
    // Step 1: Search for Community to get full entity details
    console.log('\n1. Searching for Community TV show...');
    const searchUrl = `${QLOO_API_URL}/search?query=Community`;
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'X-Api-Key': QLOO_API_KEY,
        'Accept': 'application/json',
      },
    });
    
    if (!searchResponse.ok) {
      const error = await searchResponse.text();
      console.error('Search failed:', searchResponse.status, error);
      return;
    }
    
    const searchData: any = await searchResponse.json();
    const community = searchData.results?.[0];
    console.log('Found:', community?.name, 'ID:', community?.entity_id);
    
    // Step 2: Get detailed entity info to see tags
    console.log('\n2. Getting detailed entity info with tags...');
    // First, let's try the insights endpoint to get full details
    const detailsUrl = `${QLOO_API_URL}/v2/insights?signal.interests.entities=${community.entity_id}&filter.type=urn:entity:tv_show&take=1`;
    const detailsResponse = await fetch(detailsUrl, {
      headers: {
        'X-Api-Key': QLOO_API_KEY,
        'Accept': 'application/json',
      },
    });
    
    if (detailsResponse.ok) {
      const detailsData: any = await detailsResponse.json();
      const entity = detailsData.results?.entities?.[0];
      console.log('Entity tags:', JSON.stringify(entity?.tags, null, 2));
      
      // Extract tag URNs (if they exist)
      const tagUrns = entity?.tags?.map((tag: any) => {
        // Tags might be objects with id/name or just strings
        return typeof tag === 'string' ? tag : tag.id || tag.urn;
      }).filter(Boolean);
      
      console.log('Tag URNs found:', tagUrns);
      
      // Step 3: Try to query for other entities with similar tags
      if (tagUrns && tagUrns.length > 0) {
        console.log('\n3. Searching for other TV shows with similar tags...');
        
        // Try with the first tag that might be "male wears underwear" related
        const targetTag = tagUrns.find((tag: string) => 
          tag.toLowerCase().includes('underwear') || 
          tag.toLowerCase().includes('male')
        ) || tagUrns[0];
        
        console.log('Using tag:', targetTag);
        
        const tagQueryUrl = `${QLOO_API_URL}/v2/insights?filter.type=urn:entity:tv_show&filter.tags=${encodeURIComponent(targetTag)}&take=10`;
        console.log('Query URL:', tagQueryUrl);
        
        const tagResponse = await fetch(tagQueryUrl, {
          headers: {
            'X-Api-Key': QLOO_API_KEY,
            'Accept': 'application/json',
          },
        });
        
        if (tagResponse.ok) {
          const tagData: any = await tagResponse.json();
          console.log('\nFound', tagData.results?.entities?.length || 0, 'TV shows with this tag:');
          
          tagData.results?.entities?.slice(0, 5).forEach((show: any, i: number) => {
            console.log(`${i + 1}. ${show.name}`);
            console.log(`   Tags: ${JSON.stringify(show.tags?.slice(0, 3))}`);
          });
        } else {
          const error = await tagResponse.text();
          console.error('Tag query failed:', tagResponse.status, error);
        }
      }
    }
    
    // Step 4: Force search with the specific "male wears underwear" tag
    console.log('\n4. Forcing search with "male wears underwear" tag...');
    
    // Try different possible URN formats for this tag
    const possibleTagUrns = [
      'urn:tag:keyword:media:male_wears_underwear',
      'urn:tag:keyword:tv_show:male_wears_underwear',
      'urn:tag:descriptor:tv_show:male_wears_underwear',
      'urn:tag:genre:tv_show:male_wears_underwear',
      'male wears underwear', // Try raw tag name
      'male_wears_underwear'
    ];
    
    for (const tagUrn of possibleTagUrns) {
      console.log(`\nTrying tag format: ${tagUrn}`);
      const underwearTagUrl = `${QLOO_API_URL}/v2/insights?filter.type=urn:entity:tv_show&filter.tags=${encodeURIComponent(tagUrn)}&take=10`;
      
      const underwearResponse = await fetch(underwearTagUrl, {
        headers: {
          'X-Api-Key': QLOO_API_KEY,
          'Accept': 'application/json',
        },
      });
      
      if (underwearResponse.ok) {
        const underwearData: any = await underwearResponse.json();
        if (underwearData.results?.entities?.length > 0) {
          console.log(`SUCCESS! Found ${underwearData.results.entities.length} TV shows with this tag:`);
          
          underwearData.results.entities.slice(0, 5).forEach((show: any, i: number) => {
            console.log(`${i + 1}. ${show.name}`);
            // Check if this show actually has the tag we're looking for
            const hasTag = show.tags?.some((tag: any) => 
              (typeof tag === 'string' ? tag : tag.name || '').toLowerCase().includes('underwear') ||
              (typeof tag === 'string' ? tag : tag.id || '').toLowerCase().includes('underwear')
            );
            console.log(`   Has underwear tag: ${hasTag}`);
            if (hasTag) {
              const underwearTag = show.tags.find((tag: any) => 
                (typeof tag === 'string' ? tag : tag.name || '').toLowerCase().includes('underwear') ||
                (typeof tag === 'string' ? tag : tag.id || '').toLowerCase().includes('underwear')
              );
              console.log(`   Underwear tag: ${JSON.stringify(underwearTag)}`);
            }
          });
          break; // Found results, stop trying other formats
        } else {
          console.log(`No results with this tag format`);
        }
      } else {
        const errorText = await underwearResponse.text();
        console.log(`Failed (${underwearResponse.status}): ${errorText.substring(0, 100)}...`);
      }
    }
    
    // Step 5: Alternative - search for any shows and check their tags
    console.log('\n5. Alternative: Check popular shows for underwear-related tags...');
    const popularShows = ['The Office', 'Parks and Recreation', 'Brooklyn Nine-Nine', '30 Rock', 'Scrubs'];
    
    for (const showName of popularShows) {
      const searchUrl = `${QLOO_API_URL}/search?query=${encodeURIComponent(showName)}`;
      const searchResponse = await fetch(searchUrl, {
        headers: {
          'X-Api-Key': QLOO_API_KEY,
          'Accept': 'application/json',
        },
      });
      
      if (searchResponse.ok) {
        const searchData: any = await searchResponse.json();
        const show = searchData.results?.[0];
        if (show) {
          // Get detailed info
          const detailsUrl = `${QLOO_API_URL}/v2/insights?signal.interests.entities=${show.entity_id}&filter.type=urn:entity:tv_show&take=1`;
          const detailsResponse = await fetch(detailsUrl, {
            headers: {
              'X-Api-Key': QLOO_API_KEY,
              'Accept': 'application/json',
            },
          });
          
          if (detailsResponse.ok) {
            const detailsData: any = await detailsResponse.json();
            const entity = detailsData.results?.entities?.[0];
            if (entity?.tags) {
              const underwearTags = entity.tags.filter((tag: any) => 
                (typeof tag === 'string' ? tag : tag.name || '').toLowerCase().includes('underwear') ||
                (typeof tag === 'string' ? tag : tag.id || '').toLowerCase().includes('underwear')
              );
              
              if (underwearTags.length > 0) {
                console.log(`\n${showName} has underwear-related tags:`);
                console.log(JSON.stringify(underwearTags, null, 2));
              }
            }
          }
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
testTagQuery();