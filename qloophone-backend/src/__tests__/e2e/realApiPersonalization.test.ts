import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
dotenv.config();

const QLOO_API_KEY = process.env.QLOO_API_KEY || '';
const QLOO_API_URL = process.env.QLOO_API_URL || 'https://hackathon.api.qloo.com';

// Write results to file since console is mocked
const resultsPath = path.join(__dirname, 'api-test-results.json');

// Skip these tests in CI or if no API key
const describeIfApiKey = QLOO_API_KEY ? describe : describe.skip;

describeIfApiKey('Real API - Entity-Specific Venue Personalization', () => {
  // Real entity IDs from actual API searches
  const TAYLOR_SWIFT_ID = '4BBEF799-A0C4-4110-AB01-39216993C312';
  const THE_OFFICE_ID = 'E5AE1F26-04CB-4CDD-BBA4-87FB6541F848'; // Correct ID from search
  const FRIENDS_ID = '4E62202B-3672-4B2E-A21F-C5EA4A0BA01F'; // Correct ID from search
  
  async function makeRealApiCall(entityId: string): Promise<any> {
    const params = new URLSearchParams({
      'signal.interests.entities': entityId,
      'filter.type': 'urn:entity:place',
      'filter.location.query': 'New York City',
      'filter.tags': 'urn:tag:category:place:coffee_shop',
      'take': '10',
      'sort_by': 'affinity'
    });
    
    const response = await fetch(`${QLOO_API_URL}/v2/insights?${params}`, {
      headers: {
        'X-Api-Key': QLOO_API_KEY,
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorBody = await response.text();
      console.error('API Error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorBody,
        url: response.url
      });
      throw new Error(`API returned ${response.status}: ${response.statusText} - ${errorBody}`);
    }
    
    return response.json();
  }
  
  test('different entities return different coffee shop recommendations in NYC', async () => {
    // Get Taylor Swift fan coffee shops
    const swiftResponse = await makeRealApiCall(TAYLOR_SWIFT_ID);
    const swiftVenues = swiftResponse.results?.entities || [];
    
    // Get The Office fan coffee shops
    const officeResponse = await makeRealApiCall(THE_OFFICE_ID);
    const officeVenues = officeResponse.results?.entities || [];
    
    console.log('\nTaylor Swift coffee shops:', swiftVenues.slice(0, 5).map((v: any) => ({
      name: v.name,
      affinity: (v.query?.affinity || v.affinity || 0).toFixed(3),
      address: v.properties?.address
    })));
    
    console.log('\nThe Office coffee shops:', officeVenues.slice(0, 5).map((v: any) => ({
      name: v.name,
      affinity: (v.query?.affinity || v.affinity || 0).toFixed(3),
      address: v.properties?.address
    })));
    
    // Extract venue IDs
    const swiftVenueIds = swiftVenues.map((v: any) => v.entity_id);
    const officeVenueIds = officeVenues.map((v: any) => v.entity_id);
    
    // Calculate overlap
    const commonVenues = swiftVenueIds.filter((id: string) => officeVenueIds.includes(id));
    const overlapPercentage = (commonVenues.length / Math.min(swiftVenueIds.length, officeVenueIds.length)) * 100;
    
    console.log(`\nOverlap: ${commonVenues.length} common venues (${overlapPercentage.toFixed(1)}%)`);
    
    // Write results to file
    const results = {
      timestamp: new Date().toISOString(),
      test: 'different entities return different coffee shop recommendations',
      taylorSwift: {
        totalVenues: swiftVenues.length,
        top5: swiftVenues.slice(0, 5).map((v: any) => ({
          name: v.name,
          affinity: v.query?.affinity || v.affinity || 0,
          address: v.properties?.address
        }))
      },
      theOffice: {
        totalVenues: officeVenues.length,
        top5: officeVenues.slice(0, 5).map((v: any) => ({
          name: v.name,
          affinity: v.query?.affinity || v.affinity || 0,  
          address: v.properties?.address
        }))
      },
      overlap: {
        commonVenues: commonVenues.length,
        percentage: overlapPercentage,
        commonVenueIds: commonVenues
      }
    };
    
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    
    // Assertions
    expect(swiftVenues.length).toBeGreaterThan(0);
    expect(officeVenues.length).toBeGreaterThan(0);
    
    // We expect SOME difference in recommendations (not 100% overlap)
    expect(overlapPercentage).toBeLessThan(80); // Less than 80% overlap
    
    // Check that top recommendations are different
    if (swiftVenues.length > 0 && officeVenues.length > 0) {
      const topSwiftVenue = swiftVenues[0].entity_id;
      const topOfficeVenue = officeVenues[0].entity_id;
      
      // Top recommendation should be different for different fan bases
      expect(topSwiftVenue).not.toBe(topOfficeVenue);
    }
  }, 30000); // 30 second timeout for API calls
  
  test('three different entities show personalization patterns', async () => {
    // Get coffee shops for three different fan bases
    const [swiftResponse, officeResponse, marvelResponse] = await Promise.all([
      makeRealApiCall(TAYLOR_SWIFT_ID),
      makeRealApiCall(THE_OFFICE_ID),
      makeRealApiCall(FRIENDS_ID)
    ]);
    
    const swiftVenues = swiftResponse.results?.entities || [];
    const officeVenues = officeResponse.results?.entities || [];
    const friendsVenues = marvelResponse.results?.entities || [];
    
    // Get top 5 venues for each
    const getTop5 = (venues: any[]) => venues.slice(0, 5).map((v: any) => ({
      id: v.entity_id,
      name: v.name,
      affinity: v.query?.affinity || v.affinity || 0
    }));
    
    const swiftTop5 = getTop5(swiftVenues);
    const officeTop5 = getTop5(officeVenues);
    const friendsTop5 = getTop5(friendsVenues);
    
    console.log('\nTop 5 Coffee Shops by Fan Base:');
    console.log('Taylor Swift fans:', swiftTop5);
    console.log('The Office fans:', officeTop5);
    console.log('Friends fans:', friendsTop5);
    
    // Check uniqueness of top recommendations
    const allTopIds = [
      ...swiftTop5.map(v => v.id),
      ...officeTop5.map(v => v.id),
      ...friendsTop5.map(v => v.id)
    ];
    const uniqueIds = new Set(allTopIds);
    
    // We expect significant variation in top recommendations
    const uniquenessRatio = uniqueIds.size / allTopIds.length;
    console.log(`\nUniqueness ratio: ${(uniquenessRatio * 100).toFixed(1)}% unique venues across all top 5s`);
    
    expect(uniquenessRatio).toBeGreaterThan(0.5); // At least 50% unique venues
  }, 45000); // 45 second timeout for multiple API calls
  
  test('affinity scores reflect entity preferences', async () => {
    const swiftResponse = await makeRealApiCall(TAYLOR_SWIFT_ID);
    const swiftVenues = swiftResponse.results?.entities || [];
    
    if (swiftVenues.length > 1) {
      const affinities = swiftVenues.map((v: any) => v.query?.affinity || v.affinity || 0);
      
      // Verify affinity scores are properly ordered (descending)
      for (let i = 1; i < affinities.length; i++) {
        expect(affinities[i]).toBeLessThanOrEqual(affinities[i - 1]);
      }
      
      // Verify we have a range of affinity scores (personalization is working)
      const maxAffinity = Math.max(...affinities);
      const minAffinity = Math.min(...affinities);
      const range = maxAffinity - minAffinity;
      
      console.log(`\nAffinity range for Taylor Swift venues: ${minAffinity.toFixed(3)} - ${maxAffinity.toFixed(3)} (range: ${range.toFixed(3)})`);
      
      // We expect some variation in affinity scores
      expect(range).toBeGreaterThan(0.01); // At least 1% difference
    }
  }, 30000);
});