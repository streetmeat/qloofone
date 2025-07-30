import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const API_URL = process.env.QLOO_API_URL || 'https://hackathon.api.qloo.com';
const API_KEY = process.env.QLOO_API_KEY || '';

interface CompareTestCase {
  name: string;
  params: any;
  expectedFields?: string[];
}

// Common entity IDs from the logs
const ENTITIES = {
  // Entertainment
  taylorSwift: { id: '4BBEF799-A0C4-4110-AB01-39216993C312', name: 'Taylor Swift' },
  theOffice: { id: 'E5AE1F26-04CB-4CDD-BBA4-87FB6541F848', name: 'The Office' },
  theNotebook: { id: 'AAC5EA69-8C23-412F-AF05-11F37955415F', name: 'The Notebook' },
  
  // Artists from logs
  artistB4A3: { id: 'B4A3F0F0-354D-4CAD-9F96-11A20709CB9C', name: 'Unknown Artist 1' },
  artistC0EA: { id: 'C0EAA2BE-987D-408C-AC2B-92F92E3D2035', name: 'Unknown Artist 2' },
  
  // Places
  starbucks: { id: 'B13C02E3-BA3C-4B39-85B4-ACF12FEBC892', name: 'Starbucks' }
};

async function runCompareTest(testCase: CompareTestCase): Promise<void> {
  console.log(`\n🧪 Test: ${testCase.name}`);
  console.log('📋 Parameters:', JSON.stringify(testCase.params, null, 2));
  
  try {
    const startTime = Date.now();
    
    // Build query string
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(testCase.params)) {
      queryParams.append(key, String(value));
    }
    
    const url = `${API_URL}/v2/insights/compare?${queryParams.toString()}`;
    console.log('🔗 URL:', url);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      headers: {
        'X-Api-Key': API_KEY,
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    const duration = Date.now() - startTime;
    const data = await response.json() as any;
    
    console.log(`${response.ok ? '✅ Success' : '❌ Failed'}! (${duration}ms)`);
    console.log(`📊 Status: ${response.status}`);
    
    if (!response.ok) {
      console.log('📄 Error Response:', data);
      return;
    }
    
    console.log('\n📦 Response Structure:');
    console.log('- Top level keys:', Object.keys(data));
    
    // Check for comparison data
    if (data.comparison) {
      console.log('\n🔍 Comparison Data:');
      console.log(JSON.stringify(data.comparison, null, 2));
    }
    
    // Check for overlap/similarity scores
    if (data.overlap || data.similarity || data.affinity) {
      console.log('\n📈 Similarity Metrics:');
      console.log('- Overlap:', data.overlap);
      console.log('- Similarity:', data.similarity);
      console.log('- Affinity:', data.affinity);
    }
    
    // Check for differences
    if (data.differences || data.contrast) {
      console.log('\n🔄 Differences:');
      console.log(JSON.stringify(data.differences || data.contrast, null, 2));
    }
    
    // Check for results/recommendations
    if (data.results) {
      console.log('\n🎯 Results:');
      if (data.results.entities) {
        console.log(`- Found ${data.results.entities.length} entity recommendations`);
        data.results.entities.slice(0, 3).forEach((entity: any, i: number) => {
          console.log(`  ${i+1}. ${entity.name || entity.display_name || 'Unknown'}`);
        });
      }
      if (data.results.tags) {
        console.log(`- Found ${data.results.tags.length} tag comparisons`);
      }
      if (data.results.audiences) {
        console.log(`- Found ${data.results.audiences.length} audience comparisons`);
      }
    }
    
    // Check for detailed analysis
    if (data.analysis) {
      console.log('\n🔬 Analysis:');
      console.log(JSON.stringify(data.analysis, null, 2).substring(0, 500) + '...');
    }
    
    // Log full response for debugging
    console.log('\n📄 Full Response (first 1000 chars):');
    console.log(JSON.stringify(data, null, 2).substring(0, 1000) + '...');
    
  } catch (error: any) {
    console.log(`❌ Error!`);
    if (error.name === 'AbortError') {
      console.log('🚫 Request timed out');
    } else {
      console.log('Error:', error.message);
    }
  }
}

async function main() {
  console.log('🔍 Testing Qloo /v2/insights/compare Endpoint');
  console.log('================================================');
  console.log(`🌐 API URL: ${API_URL}`);
  console.log(`🔑 API Key: ${API_KEY ? 'Set' : 'Missing'}`);
  
  if (!API_KEY) {
    console.error('❌ API Key is missing! Set QLOO_API_KEY in .env file');
    return;
  }
  
  const testCases: CompareTestCase[] = [
    // Test 1: Basic comparison - young vs old preferences
    {
      name: "Basic Comparison: Taylor Swift vs The Office",
      params: {
        'a.signal.interests.entities': ENTITIES.taylorSwift.id,
        'b.signal.interests.entities': ENTITIES.theOffice.id,
        'filter.type': 'urn:entity:movie',
        'take': 5
      }
    },
    
    // Test 2: Multiple entities per group
    {
      name: "Multiple Entities: Modern vs Classic Entertainment",
      params: {
        'a.signal.interests.entities': `${ENTITIES.taylorSwift.id},${ENTITIES.theOffice.id}`,
        'b.signal.interests.entities': ENTITIES.theNotebook.id,
        'filter.type': 'urn:entity:movie',
        'take': 10
      }
    },
    
    // Test 3: Tag comparison (as shown in test file)
    {
      name: "Tag Comparison: Find Common Genres",
      params: {
        'a.signal.interests.entities': ENTITIES.taylorSwift.id,
        'b.signal.interests.entities': ENTITIES.theOffice.id,
        'filter.type': 'urn:tag',
        'filter.subtype': 'urn:tag:genre',
        'take': 20
      }
    },
    
    // Test 4: Cross-domain comparison
    {
      name: "Cross-Domain: Music Artist vs TV Show",
      params: {
        'a.signal.interests.entities': ENTITIES.taylorSwift.id,
        'b.signal.interests.entities': ENTITIES.theOffice.id,
        'filter.type': 'urn:entity:brand',
        'take': 5
      }
    },
    
    // Test 5: With model parameter
    {
      name: "With Predictive Model",
      params: {
        'a.signal.interests.entities': ENTITIES.taylorSwift.id,
        'b.signal.interests.entities': ENTITIES.theNotebook.id,
        'filter.type': 'urn:entity:movie',
        'model': 'predictive',
        'take': 5
      }
    },
    
    // Test 6: With pagination
    {
      name: "With Pagination Parameters",
      params: {
        'a.signal.interests.entities': ENTITIES.taylorSwift.id,
        'b.signal.interests.entities': ENTITIES.theOffice.id,
        'filter.type': 'urn:entity:tv_show',
        'page': 1,
        'take': 3,
        'offset': 0
      }
    },
    
    // Test 7: Audience comparison
    {
      name: "Audience/Demographic Comparison",
      params: {
        'a.signal.interests.entities': ENTITIES.taylorSwift.id,
        'b.signal.interests.entities': ENTITIES.theNotebook.id,
        'filter.type': 'urn:demographics',
        'take': 10
      }
    },
    
    // Test 8: Place comparison
    {
      name: "Place/Venue Comparison",
      params: {
        'a.signal.interests.entities': ENTITIES.taylorSwift.id,
        'b.signal.interests.entities': ENTITIES.theOffice.id,
        'filter.type': 'urn:entity:place',
        'take': 5
      }
    },
    
    // Test 9: With location filter
    {
      name: "With Location Filter",
      params: {
        'a.signal.interests.entities': ENTITIES.taylorSwift.id,
        'b.signal.interests.entities': ENTITIES.theOffice.id,
        'filter.type': 'urn:entity:place',
        'filter.location.query': 'New York City',
        'take': 5
      }
    },
    
    // Test 10: Minimal parameters
    {
      name: "Minimal Parameters Test",
      params: {
        'a.signal.interests.entities': ENTITIES.taylorSwift.id,
        'b.signal.interests.entities': ENTITIES.theOffice.id
      }
    }
  ];
  
  // Run all tests
  for (const testCase of testCases) {
    await runCompareTest(testCase);
    
    // Small delay between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n\n🏁 All tests completed!');
  console.log('\n📊 Summary:');
  console.log('- The /v2/insights/compare endpoint should help identify:');
  console.log('  1. Overlap percentage between two taste profiles');
  console.log('  2. Common elements (genres, themes, attributes)');
  console.log('  3. Key differences between the groups');
  console.log('  4. Recommendations that bridge both tastes');
}

// Run the tests
main().catch(console.error);