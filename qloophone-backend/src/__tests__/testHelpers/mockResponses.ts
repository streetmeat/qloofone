// Mock response builders for Qloo API testing

export interface MockEntity {
  id: string;
  name: string;
  type: string;
  affinity?: number;
  tags?: Array<{ name: string }>;
  properties?: Record<string, any>;
}

export interface HeatmapArea {
  lat: number;
  lng: number;
  geohash: string;
  affinity: number;
  rank: number;
}

// Search endpoint mock response
export const mockSearchResponse = (entities: MockEntity[]) => ({
  results: entities.map(e => ({
    entity_id: e.id,
    name: e.name,
    types: [e.type]
  }))
});

// V2 Insights endpoint mock response
export const mockInsightsResponse = (
  entities: MockEntity[],
  options?: {
    includeDistance?: boolean;
    includeExplainability?: boolean;
    includeAddress?: boolean;
  }
) => ({
  success: true,
  results: {
    entities: entities.map(e => ({
      entity_id: e.id,
      name: e.name,
      query: {
        affinity: e.affinity || Math.random() * 0.3 + 0.7, // 0.7-1.0 range
        ...(options?.includeDistance && { distance: Math.floor(Math.random() * 5000) })
      },
      tags: e.tags || [],
      properties: {
        ...e.properties,
        ...(options?.includeAddress && { 
          address: e.properties?.address || '123 Main St, New York, NY 10013' 
        })
      },
      ...(options?.includeExplainability && {
        query: {
          affinity: e.affinity || 0.85,
          explainability: {
            'signal.interests.entities': [
              { entity_id: 'test-entity-1', score: 0.9 },
              { entity_id: 'test-entity-2', score: 0.8 }
            ]
          }
        }
      })
    }))
  }
});

// Heatmap response
export const mockHeatmapResponse = (areas: HeatmapArea[]) => ({
  success: true,
  results: {
    heatmap: areas.map(a => ({
      location: {
        latitude: a.lat,
        longitude: a.lng,
        geohash: a.geohash
      },
      query: {
        affinity: a.affinity,
        affinity_rank: a.rank,
        popularity: Math.random() * 0.3 + 0.7
      }
    }))
  }
});

// Recommendations endpoint mock (fallback)
export const mockRecommendationsResponse = (entities: MockEntity[]) => ({
  results: entities.map(e => ({
    entity_id: e.id,
    name: e.name,
    score: e.affinity || Math.random() * 0.3 + 0.7,
    tags: e.tags || [],
    properties: e.properties || {},
    disambiguation: ''
  }))
});

// Error responses
export const mockErrorResponse = (status: number, message: string) => ({
  ok: false,
  status,
  statusText: message,
  json: async () => ({ error: message })
});

// Empty successful response
export const mockEmptyResponse = () => ({
  ok: true,
  status: 200,
  json: async () => ({ results: [] })
});

// Neighborhood heatmap response
export const mockNeighborhoodHeatmapResponse = (neighborhoods: Array<{
  name: string;
  affinity: number;
  rank: number;
}>) => ({
  success: true,
  results: {
    entities: neighborhoods.map(n => ({
      name: n.name,
      entity_id: `locality-${n.name.toLowerCase().replace(/\s+/g, '-')}`,
      query: {
        affinity: n.affinity,
        affinity_rank: n.rank
      }
    }))
  }
});