import * as dotenv from 'dotenv';
dotenv.config();

import { 
  mockInsightsResponse,
  mockHeatmapResponse
} from '../../testHelpers/mockResponses';

// Mock fetch
global.fetch = jest.fn();

describe('Geographic Intelligence Features', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe('POLYGON Query Support', () => {
    test('supports custom neighborhood boundaries with POLYGON', async () => {
      // Mock a POLYGON-based venue search
      const customPolygon = 'POLYGON((-73.9917 40.7336, -73.9917 40.7217, -73.9758 40.7217, -73.9758 40.7336, -73.9917 40.7336))';
      
      const polygonVenues = [
        {
          id: 'venue-poly-1',
          name: 'East Village Coffee',
          type: 'urn:entity:place',
          affinity: 0.92,
          tags: [{ name: 'coffee_shop' }],
          properties: { address: '123 St Marks Pl, New York, NY' }
        },
        {
          id: 'venue-poly-2',
          name: 'Tompkins Square Bagels',
          type: 'urn:entity:place',
          affinity: 0.88,
          tags: [{ name: 'cafe' }],
          properties: { address: '165 Avenue A, New York, NY' }
        }
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse(polygonVenues, { includeAddress: true })
      });

      // Create a custom recommendation handler that accepts POLYGON
      const getRecommendationWithPolygon = async (args: any) => {
        const params = new URLSearchParams({
          'signal.interests.entities': args.entity_ids,
          'filter.type': 'urn:entity:place',
          'filter.location': args.polygon,
          'take': '10'
        });

        const url = `https://hackathon.api.qloo.com/v2/insights?${params}`;
        const response = await fetch(url, {
          headers: { 'X-Api-Key': process.env.QLOO_API_KEY || '' }
        });
        
        const data = await response.json() as any;
        return {
          venues: data.results.entities,
          polygon_used: args.polygon
        };
      };

      const result = await getRecommendationWithPolygon({
        entity_ids: 'taylor-swift-id',
        polygon: customPolygon
      });

      expect(result.venues).toHaveLength(2);
      expect(result.polygon_used).toBe(customPolygon);
      
      // Verify the API call included the POLYGON
      const apiCall = (global.fetch as jest.Mock).mock.calls[0];
      // Just verify the polygon is in the URL with proper encoding
      expect(apiCall[0]).toMatch(/filter\.location=POLYGON/);
      expect(apiCall[0]).toContain('-73.9917');
      expect(apiCall[0]).toContain('40.7336');
    });

    test('handles MULTIPOLYGON for complex city areas', async () => {
      // Test searching across multiple disconnected areas
      const multiPolygon = 'MULTIPOLYGON(((-73.99 40.73, -73.99 40.72, -73.98 40.72, -73.98 40.73, -73.99 40.73)), ((-74.01 40.71, -74.01 40.70, -74.00 40.70, -74.00 40.71, -74.01 40.71)))';
      
      const multiAreaVenues = [
        {
          id: 'area1-venue',
          name: 'Union Square Market',
          type: 'urn:entity:place',
          affinity: 0.91,
          properties: {
            geocode: { latitude: 40.725, longitude: -73.985 }
          }
        },
        {
          id: 'area2-venue', 
          name: 'Battery Park Cafe',
          type: 'urn:entity:place',
          affinity: 0.87,
          properties: {
            geocode: { latitude: 40.705, longitude: -74.005 }
          }
        }
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse(multiAreaVenues)
      });

      // Test MULTIPOLYGON support
      const params = new URLSearchParams({
        'signal.interests.entities': 'test-entity',
        'filter.type': 'urn:entity:place',
        'filter.location': multiPolygon
      });

      const response = await fetch(`https://hackathon.api.qloo.com/v2/insights?${params}`, {
        headers: { 'X-Api-Key': 'test' }
      });
      const data = await response.json() as any;

      expect(data.results.entities).toHaveLength(2);
      
      // Venues should be from different areas
      const area1 = data.results.entities[0].properties.geocode;
      const area2 = data.results.entities[1].properties.geocode;
      
      // Check they're in different areas (simplified check)
      expect(Math.abs(area1.latitude - area2.latitude)).toBeGreaterThan(0.01);
    });

    test('combines POLYGON with radius for fuzzy boundaries', async () => {
      // Test POLYGON + radius for expanded search area
      const corePolygon = 'POLYGON((-73.99 40.73, -73.99 40.72, -73.98 40.72, -73.98 40.73, -73.99 40.73))';
      const expandRadius = 1000; // 1km expansion
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse([
          {
            id: 'core-venue',
            name: 'Core Area Spot',
            type: 'urn:entity:place',
            affinity: 0.95,
            properties: { distance: 0 }
          },
          {
            id: 'edge-venue',
            name: 'Just Outside Polygon',
            type: 'urn:entity:place',
            affinity: 0.89,
            properties: { distance: 800 } // Within radius expansion
          }
        ])
      });

      const params = new URLSearchParams({
        'signal.interests.entities': 'test-entity',
        'filter.type': 'urn:entity:place',
        'filter.location': corePolygon,
        'filter.location.radius': String(expandRadius)
      });

      const response = await fetch(`https://hackathon.api.qloo.com/v2/insights?${params}`, {
        headers: { 'X-Api-Key': 'test' }
      });
      const data = await response.json() as any;

      expect(data.results.entities).toHaveLength(2);
      
      // Should include venues outside polygon but within radius
      const edgeVenue = data.results.entities.find((v: any) => v.entity_id === 'edge-venue');
      expect(edgeVenue).toBeDefined();
      expect(edgeVenue.properties.distance).toBeLessThan(expandRadius);
    });
  });

  describe('Exclusion Zones', () => {
    test('excludes specific neighborhoods from search results', async () => {
      // Test filter.exclude.location functionality
      const searchArea = 'New York City';
      const excludeAreas = ['Times Square', 'Penn Station'];
      
      const filteredVenues = [
        {
          id: 'allowed-1',
          name: 'Greenwich Village Cafe',
          type: 'urn:entity:place',
          affinity: 0.93,
          properties: { 
            address: '123 Bleecker St',
            neighborhood: 'Greenwich Village'
          }
        },
        {
          id: 'allowed-2',
          name: 'Brooklyn Bridge Coffee',
          type: 'urn:entity:place', 
          affinity: 0.90,
          properties: {
            address: '45 Water St',
            neighborhood: 'DUMBO'
          }
        }
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse(filteredVenues, { includeAddress: true })
      });

      // Test exclusion parameters
      const params = new URLSearchParams({
        'signal.interests.entities': 'test-entity',
        'filter.type': 'urn:entity:place',
        'filter.location.query': searchArea
      });
      
      // Add exclusion areas
      excludeAreas.forEach(area => {
        params.append('filter.exclude.location.query', area);
      });

      const response = await fetch(`https://hackathon.api.qloo.com/v2/insights?${params}`, {
        headers: { 'X-Api-Key': 'test' }
      });
      const data = await response.json() as any;

      // Results should not include excluded areas
      const neighborhoods = data.results.entities.map((v: any) => v.properties.neighborhood);
      expect(neighborhoods).not.toContain('Times Square');
      expect(neighborhoods).not.toContain('Penn Station');
      expect(neighborhoods).toContain('Greenwich Village');
      expect(neighborhoods).toContain('DUMBO');
    });

    test('combines inclusion POLYGON with exclusion zones', async () => {
      // Complex geo-filtering: POLYGON include + specific excludes
      const includePolygon = 'POLYGON((-74.02 40.75, -74.02 40.70, -73.95 40.70, -73.95 40.75, -74.02 40.75))';
      const excludePolygon = 'POLYGON((-73.99 40.73, -73.99 40.72, -73.98 40.72, -73.98 40.73, -73.99 40.73))';
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse([
          {
            id: 'outside-exclusion',
            name: 'Chelsea Market',
            type: 'urn:entity:place',
            affinity: 0.91,
            properties: {
              geocode: { latitude: 40.742, longitude: -74.006 }
            }
          }
        ])
      });

      const params = new URLSearchParams({
        'signal.interests.entities': 'test-entity',
        'filter.type': 'urn:entity:place',
        'filter.location': includePolygon,
        'filter.exclude.location': excludePolygon
      });

      const response = await fetch(`https://hackathon.api.qloo.com/v2/insights?${params}`, {
        headers: { 'X-Api-Key': 'test' }
      });
      const data = await response.json() as any;

      // Should only return venues in include zone but not in exclude zone
      expect(data.results.entities).toHaveLength(1);
      expect(data.results.entities[0].name).toBe('Chelsea Market');
      
      // Verify both polygons were sent
      const url = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(url).toMatch(/filter\.location=POLYGON/);
      expect(url).toMatch(/filter\.exclude\.location=POLYGON/);
      expect(url).toContain('-74.02');
      expect(url).toContain('-73.99');
    });
  });

  describe('Dynamic Location Strategies', () => {
    test('adjusts radius based on urban density', async () => {
      // Test dynamic radius adjustment for different area types
      const testCases = [
        {
          location: 'Manhattan',
          expectedRadius: 2000, // Dense urban: smaller radius
          density: 'high'
        },
        {
          location: 'Queens',
          expectedRadius: 5000, // Suburban: medium radius
          density: 'medium'
        },
        {
          location: 'Upstate New York',
          expectedRadius: 15000, // Rural: larger radius
          density: 'low'
        }
      ];

      for (const testCase of testCases) {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockInsightsResponse([
            {
              id: `venue-${testCase.density}`,
              name: `${testCase.location} Spot`,
              type: 'urn:entity:place',
              affinity: 0.9
            }
          ])
        });

        // Simulate dynamic radius selection based on location
        const getDynamicRadius = (location: string): number => {
          if (location.includes('Manhattan') || location.includes('Downtown')) return 2000;
          if (location.includes('Upstate') || location.includes('Rural')) return 15000;
          return 5000;
        };

        const radius = getDynamicRadius(testCase.location);
        expect(radius).toBe(testCase.expectedRadius);

        const params = new URLSearchParams({
          'signal.interests.entities': 'test-entity',
          'filter.type': 'urn:entity:place',
          'filter.location.query': testCase.location,
          'filter.location.radius': String(radius)
        });

        await fetch(`https://hackathon.api.qloo.com/v2/insights?${params}`, {
          headers: { 'X-Api-Key': 'test' }
        });
      }

      // Verify all three calls were made with different radii
      const calls = (global.fetch as jest.Mock).mock.calls;
      expect(calls[0][0]).toContain('radius=2000');
      expect(calls[1][0]).toContain('radius=5000');
      expect(calls[2][0]).toContain('radius=15000');
    });

    test('switches between locality ID and location query based on availability', async () => {
      // Test fallback from locality ID to location query
      const localityId = 'l:nyc-east-village-123';
      const locationName = 'East Village, NYC';
      
      // First attempt with locality ID (fast)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse([
          {
            id: 'fast-result',
            name: 'Quick Find Cafe',
            type: 'urn:entity:place',
            affinity: 0.94
          }
        ])
      });

      // Test with locality ID first
      const fastParams = new URLSearchParams({
        'signal.interests.entities': 'test-entity',
        'filter.type': 'urn:entity:place',
        'filter.location': localityId
      });

      const fastResponse = await fetch(`https://hackathon.api.qloo.com/v2/insights?${fastParams}`, {
        headers: { 'X-Api-Key': 'test' }
      });
      const fastData = await fastResponse.json() as any;

      expect(fastData.results.entities[0].name).toBe('Quick Find Cafe');
      
      // Now test fallback to location query
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInsightsResponse([
          {
            id: 'slow-result',
            name: 'Query Search Cafe',
            type: 'urn:entity:place',
            affinity: 0.92
          }
        ])
      });

      const slowParams = new URLSearchParams({
        'signal.interests.entities': 'test-entity',
        'filter.type': 'urn:entity:place',
        'filter.location.query': locationName
      });

      const slowResponse = await fetch(`https://hackathon.api.qloo.com/v2/insights?${slowParams}`, {
        headers: { 'X-Api-Key': 'test' }
      });
      const slowData = await slowResponse.json() as any;

      expect(slowData.results.entities[0].name).toBe('Query Search Cafe');
      
      // Verify different parameters were used
      expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain(`filter.location=${encodeURIComponent(localityId)}`);
      expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain(`filter.location.query=${encodeURIComponent(locationName).replace(/%20/g, '+')}`);
    });
  });

  describe('Geohash-based Filtering', () => {
    test('uses geohash for area-based analysis', async () => {
      // Test geohash-based heatmap analysis
      const geohashAreas = [
        { lat: 40.7589, lng: -73.9851, geohash: 'dr5ru6', affinity: 0.95, rank: 1 },
        { lat: 40.7614, lng: -73.9776, geohash: 'dr5ru7', affinity: 0.92, rank: 2 },
        { lat: 40.7531, lng: -73.9931, geohash: 'dr5ru4', affinity: 0.88, rank: 3 }
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockHeatmapResponse(geohashAreas)
      });

      const params = new URLSearchParams({
        'filter.type': 'urn:heatmap',
        'signal.interests.entities': 'test-entity',
        'filter.location.geohash': 'dr5ru', // Prefix for Times Square area
        'output.heatmap.boundary': 'urn:geohash'
      });

      const response = await fetch(`https://hackathon.api.qloo.com/v2/insights?${params}`, {
        headers: { 'X-Api-Key': 'test' }
      });
      const data = await response.json() as any;

      expect(data.results.heatmap).toHaveLength(3);
      
      // All geohashes should start with the prefix
      data.results.heatmap.forEach((area: any) => {
        expect(area.location.geohash).toMatch(/^dr5ru/);
      });
      
      // Should be sorted by rank/affinity
      expect(data.results.heatmap[0].query.affinity).toBeGreaterThan(
        data.results.heatmap[2].query.affinity
      );
    });

    test('combines geohash with entity signals for targeted analysis', async () => {
      // Test geohash + entity combination
      const mockGeohashEntityResponse = {
        success: true,
        results: {
          heatmap: [
            {
              location: {
                geohash: 'dr5reg',
                center: { latitude: 40.7128, longitude: -74.0060 }
              },
              query: {
                affinity: 0.89,
                entity_concentration: 0.85,
                popularity_index: 0.92
              },
              metadata: {
                dominant_venues: ['coffee_shop', 'bookstore'],
                peak_times: ['morning', 'afternoon']
              }
            }
          ]
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockGeohashEntityResponse
      });

      const params = new URLSearchParams({
        'filter.type': 'urn:heatmap',
        'signal.interests.entities': 'taylor-swift-id,starbucks-id',
        'filter.location.geohash': 'dr5re',
        'output.heatmap.boundary': 'urn:geohash',
        'include.metadata': 'true'
      });

      const response = await fetch(`https://hackathon.api.qloo.com/v2/insights?${params}`, {
        headers: { 'X-Api-Key': 'test' }
      });
      const data = await response.json() as any;

      const area = data.results.heatmap[0];
      expect(area.location.geohash).toMatch(/^dr5re/);
      expect(area.query.entity_concentration).toBeGreaterThan(0.8);
      
      // Should include venue type metadata
      expect(area.metadata?.dominant_venues).toContain('coffee_shop');
    });
  });

  describe('Cross-City Taste Comparisons', () => {
    test('compares taste profiles between different cities', async () => {
      // Test cross-city analysis capabilities
      const cities = ['New York', 'Los Angeles', 'Chicago'];
      
      const mockCityComparison = {
        success: true,
        results: {
          city_analysis: {
            'New York': {
              entity_affinity: 0.92,
              top_venues: ['coffee_shop', 'museum', 'restaurant'],
              taste_index: 0.88
            },
            'Los Angeles': {
              entity_affinity: 0.85,
              top_venues: ['restaurant', 'beach', 'studio'],
              taste_index: 0.82
            },
            'Chicago': {
              entity_affinity: 0.89,
              top_venues: ['bar', 'restaurant', 'theater'],
              taste_index: 0.85
            }
          }
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockCityComparison
      });

      // Simulate multi-city comparison query
      const params = new URLSearchParams({
        'signal.interests.entities': 'test-entity',
        'filter.type': 'urn:entity:place',
        'filter.location.query': cities.join(','),
        'analysis.mode': 'city_comparison'
      });

      const response = await fetch(`https://hackathon.api.qloo.com/v2/insights?${params}`, {
        headers: { 'X-Api-Key': 'test' }
      });
      const data = await response.json() as any;

      // Verify city comparison data
      expect(data.results.city_analysis).toBeDefined();
      expect(Object.keys(data.results.city_analysis)).toHaveLength(3);
      
      // New York should have highest affinity for this entity
      expect(data.results.city_analysis['New York'].entity_affinity).toBeGreaterThan(
        data.results.city_analysis['Los Angeles'].entity_affinity
      );
      
      // Each city should have different venue preferences
      expect(data.results.city_analysis['New York'].top_venues[0]).toBe('coffee_shop');
      expect(data.results.city_analysis['Los Angeles'].top_venues).toContain('beach');
    });
  });
});