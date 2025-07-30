import { FunctionHandler, SessionContext } from "./types";
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { isLikelySequel, detectFranchiseCluster } from './sequelDetection';
import { entityCache } from './entityCache';

// Load environment variables
dotenv.config();

// Create API log file
const logFile = path.join(__dirname, '..', 'api_calls.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// Properly close log stream on exit
process.on('exit', () => {
  if (logStream.writable) {
    logStream.end();
  }
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  if (logStream.writable) {
    logStream.end();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (logStream.writable) {
    logStream.end();
  }
  process.exit(0);
});

function logApiCall(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(`[QLOO API] ${message}`);
  
  // Safely write to log stream, handling EPIPE errors
  try {
    if (logStream.writable) {
      logStream.write(logMessage, (err) => {
        if (err && (err as any).code === 'EPIPE') {
          // Silently ignore EPIPE errors during tests
          // The console.log above already captured the message
        }
      });
    }
  } catch (error: any) {
    // If write fails, just continue - console.log already captured the message
    if (error.code !== 'EPIPE') {
      console.error('[QLOO API] Log write error:', error.message);
    }
  }
}

const QLOO_API_KEY = process.env.QLOO_API_KEY || '';
const QLOO_API_URL = process.env.QLOO_API_URL || 'https://hackathon.api.qloo.com';

// Log startup (only once)
if (!process.env.HANDLERS_INITIALIZED) {
  logApiCall('=== Function handlers initialized ===');
  logApiCall(`API URL: ${QLOO_API_URL}`);
  logApiCall(`API Key: ${QLOO_API_KEY ? 'Set' : 'Missing'}`);
  process.env.HANDLERS_INITIALIZED = 'true';
}

// Helper function to add timeout to fetch requests
async function fetchWithTimeout(url: string, options: any, timeoutMs: number = 3000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeout);
    return response;
  } catch (error: any) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

// Simple entity type mapping for common user terms
const ENTITY_TYPE_MAP: { [key: string]: string } = {
  // Food & Dining
  'restaurant': 'urn:entity:place',
  'cafe': 'urn:entity:place',
  'bar': 'urn:entity:place',
  'food': 'urn:entity:place',
  'dining': 'urn:entity:place',
  'urn:entity:restaurant': 'urn:entity:place',  // Fix for invalid restaurant entity type
  
  // Music
  'artist': 'urn:entity:artist',  // Add direct mapping for when AI passes just "artist"
  'music': 'urn:entity:artist',
  'band': 'urn:entity:artist',
  'singer': 'urn:entity:artist',
  'musician': 'urn:entity:artist',
  'album': 'urn:entity:album',
  
  // Entertainment
  'movie': 'urn:entity:movie',
  'film': 'urn:entity:movie',
  'show': 'urn:entity:tv_show',
  'series': 'urn:entity:tv_show',
  'tv': 'urn:entity:tv_show',
  'game': 'urn:entity:videogame',
  'videogame': 'urn:entity:videogame',
  'video_game': 'urn:entity:videogame',
  
  // People
  'actor': 'urn:entity:person',
  'actress': 'urn:entity:person',
  'director': 'urn:entity:person',
  'author': 'urn:entity:person',
  'celebrity': 'urn:entity:person',
  
  // Other
  'book': 'urn:entity:book',
  'brand': 'urn:entity:brand',
  'company': 'urn:entity:brand',
  'podcast': 'urn:entity:podcast',
  'place': 'urn:entity:place',
  'venue': 'urn:entity:place',
  'store': 'urn:entity:place',
  'destination': 'urn:entity:destination',
  'travel': 'urn:entity:destination',
  'city': 'urn:entity:locality',
  'neighborhood': 'urn:entity:locality'
};

// Valid entity types for validation
const VALID_ENTITY_TYPES = [
  'urn:entity:artist',
  'urn:entity:album',
  'urn:entity:book',
  'urn:entity:brand',
  'urn:entity:destination',
  'urn:entity:movie',
  'urn:entity:person',
  'urn:entity:place',
  'urn:entity:podcast',
  'urn:entity:tv_show',
  'urn:entity:videogame',
  'urn:entity:locality'
];

// Place tag URN mapping - VERIFIED WORKING TAGS (Updated July 17, 2025)
// IMPORTANT: Use urn:tag:category:place format for venues, NOT urn:tag:genre:restaurant
const PLACE_TAG_URNS: { [key: string]: string } = {
  // Coffee shops - VERIFIED WORKING with accuracy rates ✅
  'coffee': 'urn:tag:category:place:coffee_shop',           // 55% accuracy
  'coffee_shop': 'urn:tag:category:place:coffee_shop',      // 55% accuracy
  'coffee_shops': 'urn:tag:category:place:coffee_shop',     // 55% accuracy
  'espresso': 'urn:tag:category:place:espresso_bar',        // 78.8% accuracy - BEST
  'espresso_bar': 'urn:tag:category:place:espresso_bar',    // 78.8% accuracy - BEST
  'cafe': 'urn:tag:category:place:cafe',                    // 45% accuracy
  'cafes': 'urn:tag:category:place:cafe',                   // 45% accuracy
  
  // Restaurants - WORKING but lower accuracy ✅
  'restaurant': 'urn:tag:category:place:restaurant',        // 35% accuracy
  'restaurants': 'urn:tag:category:place:restaurant',       // 35% accuracy
  
  // Bars and nightlife - VERIFIED WORKING ✅
  'bar': 'urn:tag:category:place:bar',                      // 30% accuracy
  'bars': 'urn:tag:category:place:bar',                     // 30% accuracy
  'pub': 'urn:tag:category:place:pub',                      // 40% accuracy
  'pubs': 'urn:tag:category:place:pub',                     // 40% accuracy
  
  // Museums - VERIFIED WORKING ✅
  'museum': 'urn:tag:category:place:museum',                // 43.3% accuracy
  'museums': 'urn:tag:category:place:museum',               // 43.3% accuracy
  
  // Food/Cuisine Tags - Added based on Discord insights
  'sushi': 'urn:tag:genre:place:restaurant:sushi',
  'italian': 'urn:tag:genre:place:restaurant:italian',
  'mexican': 'urn:tag:genre:place:restaurant:mexican',
  'chinese': 'urn:tag:genre:place:restaurant:chinese',
  'thai': 'urn:tag:genre:place:restaurant:thai',
  'indian': 'urn:tag:genre:place:restaurant:indian',
  'japanese': 'urn:tag:genre:place:restaurant:japanese',
  'korean': 'urn:tag:genre:place:restaurant:korean',
  'vietnamese': 'urn:tag:genre:place:restaurant:vietnamese',
  'french': 'urn:tag:genre:place:restaurant:french',
  'mediterranean': 'urn:tag:genre:place:restaurant:mediterranean',
  'american': 'urn:tag:genre:place:restaurant:american',
  'pizza': 'urn:tag:genre:place:restaurant:pizza',
  'burger': 'urn:tag:genre:place:restaurant:burger',
  'burgers': 'urn:tag:genre:place:restaurant:burger',
  'seafood': 'urn:tag:genre:place:restaurant:seafood',
  'steakhouse': 'urn:tag:genre:place:restaurant:steakhouse',
  'vegetarian': 'urn:tag:genre:place:restaurant:vegetarian',
  'vegan': 'urn:tag:genre:place:restaurant:vegan',
};

// Known brand entity IDs for chain filtering (100% accuracy)
const KNOWN_BRAND_IDS: { [key: string]: string } = {
  'starbucks': 'B13C02E3-BA3C-4B39-85B4-ACF12FEBC892',
  'dunkin': '5E978F43-4450-4F41-8EE4-A0421E8EC178',
  'dunkin donuts': '5E978F43-4450-4F41-8EE4-A0421E8EC178',
  'mcdonalds': '8417D6F9-C8C7-40AD-BE49-0987A4663228',
  'mcdonald\'s': '8417D6F9-C8C7-40AD-BE49-0987A4663228',
  'walmart': 'D72865CB-DDB5-4202-96A4-D0415C0ACBF3'
};

// Sequel detection logic has been moved to sequelDetection.ts for better testability

// Basic neighborhood POLYGON definitions for major NYC areas
const NEIGHBORHOOD_POLYGONS: { [key: string]: string } = {
  // Manhattan neighborhoods
  'soho': 'POLYGON((-74.0025 40.7280, -74.0025 40.7191, -73.9955 40.7191, -73.9955 40.7280, -74.0025 40.7280))',
  'tribeca': 'POLYGON((-74.0150 40.7253, -74.0150 40.7163, -74.0047 40.7163, -74.0047 40.7253, -74.0150 40.7253))',
  'east village': 'POLYGON((-73.9917 40.7336, -73.9917 40.7217, -73.9758 40.7217, -73.9758 40.7336, -73.9917 40.7336))',
  'west village': 'POLYGON((-74.0094 40.7406, -74.0094 40.7287, -73.9947 40.7287, -73.9947 40.7406, -74.0094 40.7406))',
  'chelsea': 'POLYGON((-74.0094 40.7559, -74.0094 40.7410, -73.9914 40.7410, -73.9914 40.7559, -74.0094 40.7559))',
  'midtown': 'POLYGON((-73.9935 40.7649, -73.9935 40.7459, -73.9733 40.7459, -73.9733 40.7649, -73.9935 40.7649))',
  
  // Brooklyn neighborhoods  
  'williamsburg': 'POLYGON((-73.9653 40.7308, -73.9653 40.7081, -73.9362 40.7081, -73.9362 40.7308, -73.9653 40.7308))',
  'dumbo': 'POLYGON((-73.9950 40.7081, -73.9950 40.6975, -73.9844 40.6975, -73.9844 40.7081, -73.9950 40.7081))',
};

// Helper function to detect neighborhood from text
function detectNeighborhood(text: string): string | null {
  const normalized = text.toLowerCase();
  for (const [name] of Object.entries(NEIGHBORHOOD_POLYGONS)) {
    if (normalized.includes(name)) {
      return name;
    }
  }
  return null;
}

// Helper function to generate taste bridge narrative from explainability data
function generateTasteBridge(_recommendation: any, inputEntities: Array<{name: string, entity_id: string}>, explainability: any[]): string | null {
  if (!explainability || explainability.length === 0) {
    return null;
  }
  
  // Sort explainability by score to identify strongest connections
  const sortedExplainability = explainability
    .map((exp: any) => ({
      entity_id: exp.entity_id,
      score: exp.score || exp.affinity || 0,
      inputEntity: inputEntities.find(e => e.entity_id === exp.entity_id)
    }))
    .filter(exp => exp.inputEntity)
    .sort((a, b) => b.score - a.score);
  
  if (sortedExplainability.length === 0) {
    return null;
  }
  
  // Generate narrative based on connection strengths
  if (sortedExplainability.length === 1) {
    const connection = sortedExplainability[0];
    return `Strong match for ${connection.inputEntity!.name} fans (${(connection.score * 100).toFixed(0)}% affinity)`;
  } else if (sortedExplainability.length >= 2) {
    const primary = sortedExplainability[0];
    const secondary = sortedExplainability[1];
    
    // Check if both have strong connections
    if (primary.score > 0.8 && secondary.score > 0.7) {
      return `Perfect blend of ${primary.inputEntity!.name} and ${secondary.inputEntity!.name} elements`;
    } else if (primary.score > secondary.score * 1.5) {
      // One is much stronger
      return `Especially great for ${primary.inputEntity!.name} fans, with elements of ${secondary.inputEntity!.name}`;
    } else {
      // Balanced connection
      return `Bridges ${primary.inputEntity!.name} and ${secondary.inputEntity!.name} preferences equally`;
    }
  }
  
  return null;
}

const functions: FunctionHandler[] = [];

// Search for any cultural entity
functions.push({
  schema: {
    type: "function",
    name: "search_entity",
    description: "Search for any cultural item (movie, music, TV show, book, place, etc)",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "What to search for",
        },
      },
      required: ["query"],
    },
  },
  handler: async (args: { query: string }, context?: SessionContext) => {
    logApiCall(`search_entity called with query: "${args.query}"`);
    const recentEntitySearches = context?.recentEntitySearches || new Map();
    
    // Check cache first
    const cached = entityCache.get(args.query);
    if (cached) {
      logApiCall(`[CACHE HIT] Found in cache: ${cached.name} (${cached.entity_id})`);
      
      // Also store in recentEntitySearches for sequel detection
      recentEntitySearches.set(cached.entity_id, {
        name: cached.name,
        entity_id: cached.entity_id,
        type: cached.type
      });
      
      return JSON.stringify({
        entity_id: cached.entity_id,
        name: cached.name,
        type: cached.type,
      });
    }
    
    // Cache miss - call API
    try {
      const url = `${QLOO_API_URL}/search?query=${encodeURIComponent(args.query)}`;
      const headers = {
        'X-Api-Key': QLOO_API_KEY,
        'Accept': 'application/json',
      };
      
      logApiCall(`[CACHE MISS] Calling: GET ${url}`);
      const response = await fetchWithTimeout(url, { headers }, 2500);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as any;
      logApiCall(`[QLOO API] Response: ${response.status}, found ${data.results?.length || 0} results`);
      
      // Return first result if found
      if (data.results && data.results.length > 0) {
        const entity = data.results[0];
        logApiCall(`[QLOO API] Returning: ${entity.name} (${entity.entity_id})`);
        
        // Store in entity cache for future use
        entityCache.set(args.query, {
          entity_id: entity.entity_id,
          name: entity.name,
          type: entity.types?.[0] || entity.type
        });
        
        // Store entity info for sequel detection and type inference
        recentEntitySearches.set(entity.entity_id, {
          name: entity.name,
          entity_id: entity.entity_id,
          type: entity.types?.[0] || entity.type
        });
        
        return JSON.stringify({
          entity_id: entity.entity_id,
          name: entity.name,
          type: entity.types?.[0] || entity.type, // Handle both response formats
        });
      } else {
        logApiCall(`[QLOO API] No results found for "${args.query}"`);
        return JSON.stringify({
          error: "No results found",
          suggestion: `Try a different spelling or related term for "${args.query}"`,
        });
      }
    } catch (error: any) {
      return JSON.stringify({
        error: "Search failed",
        details: error.message,
      });
    }
  },
});

// Search for localities (cities, neighborhoods, regions)
functions.push({
  schema: {
    type: "function",
    name: "search_locality",
    description: "Search for a city, neighborhood, or location. Note: This is optional - you can now pass location names directly to get_fan_venues and get_recommendation functions.",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "City, neighborhood, or location name (e.g., 'Bend Oregon', 'NYC', 'Lower East Side', 'Seattle')",
        },
      },
      required: ["location"],
    },
  },
  handler: async (args: { location: string }, _context?: SessionContext) => {
    logApiCall(`search_locality called with location: "${args.location}"`);
    
    // Check cache first
    const cacheKey = `locality:${args.location}`;
    const cached = entityCache.get(cacheKey);
    if (cached) {
      logApiCall(`[CACHE HIT] Found locality in cache: ${cached.name} (${cached.entity_id})`);
      return JSON.stringify({
        entity_id: cached.entity_id,
        name: cached.name,
        type: 'urn:entity:locality',
      });
    }
    
    // Cache miss - call API
    try {
      const url = `${QLOO_API_URL}/search?query=${encodeURIComponent(args.location)}&type=urn:entity:locality`;
      const headers = {
        'X-Api-Key': QLOO_API_KEY,
        'Accept': 'application/json',
      };
      
      logApiCall(`Calling: GET ${url}`);
      const response = await fetchWithTimeout(url, { headers }, 2500);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as any;
      logApiCall(`Response: ${response.status}, found ${data.results?.length || 0} localities`);
      
      if (data.results && data.results.length > 0) {
        const locality = data.results[0];
        logApiCall(`Returning: ${locality.name} (${locality.entity_id})`);
        
        // Store in cache
        entityCache.set(cacheKey, {
          entity_id: locality.entity_id,
          name: locality.name,
          type: 'urn:entity:locality'
        });
        
        return JSON.stringify({
          entity_id: locality.entity_id,
          name: locality.name,
          type: 'urn:entity:locality',
        });
      } else {
        logApiCall(`No localities found for "${args.location}"`);
        return JSON.stringify({
          error: "Location not found",
          suggestion: `Try a different spelling or a larger city near "${args.location}"`,
        });
      }
    } catch (error: any) {
      return JSON.stringify({
        error: "Location search failed",
        details: error.message,
      });
    }
  },
});

// Get recommendations that bridge cultural preferences
functions.push({
  schema: {
    type: "function",
    name: "get_recommendation",
    description: "Get recommendations that bridge two cultural preferences. The output type will be intelligently inferred if not specified.",
    parameters: {
      type: "object",
      properties: {
        entity_ids: {
          type: "string",
          description: "Comma-separated entity IDs (from search_entity results)",
        },
        tag_ids: {
          type: "string",
          description: "Optional: Comma-separated tag IDs (when search returns tags instead of entities)",
        },
        output_type: {
          type: "string",
          description: "Optional: Type of recommendation to return. If not specified, will be intelligently inferred based on input types.",
        },
        take: {
          type: "number",
          description: "Number of recommendations (default 3)",
        },
        location: {
          type: "string",
          description: "Optional: Location name for place recommendations (e.g., 'Seattle', 'Capitol Hill Seattle', 'NYC')",
        },
        latitude: {
          type: "number",
          description: "Optional: Latitude for location-based search (e.g., 44.0582 for Bend, OR)",
        },
        longitude: {
          type: "number",
          description: "Optional: Longitude for location-based search (e.g., -121.3153 for Bend, OR)",
        },
        radius: {
          type: "number",
          description: "Optional: Search radius in meters for location queries (default 5000)",
        },
        place_tags: {
          type: "string",
          description: "Optional: Context about what they're looking for (e.g., 'something fun', 'date night', 'with friends')",
        },
        audience_ids: {
          type: "string",
          description: "Optional: Comma-separated audience IDs for demographic targeting (use get_audiences to find IDs)",
        },
        interest_tags: {
          type: "string",
          description: "Optional: Comma-separated tag URNs for interest filtering (use search_tags to find URNs)",
        },
      },
      required: [],  // Made empty since either entity_ids or tag_ids can be provided
    },
  },
  handler: async (args: { 
    entity_ids?: string; 
    tag_ids?: string;
    output_type?: string; 
    take?: number;
    location?: string;
    latitude?: number;
    longitude?: number;
    radius?: number;
    place_tags?: string;
    audience_ids?: string;
    interest_tags?: string;
  }, context?: SessionContext) => {
    logApiCall(`get_recommendation called`);
    logApiCall(`  Entity IDs: ${args.entity_ids || 'none'}`);
    logApiCall(`  Tag IDs: ${args.tag_ids || 'none'}`);
    logApiCall(`  Output type: ${args.output_type}`);
    
    // Validate inputs - need at least entity_ids or tag_ids
    if (!args.entity_ids && !args.tag_ids) {
      return JSON.stringify({
        error: "At least one of entity_ids or tag_ids is required",
        suggestion: "Provide entity IDs from search_entity or tag IDs from searches that return tags"
      });
    }
    
    // Store input entity details first
    const inputEntityIds = args.entity_ids ? args.entity_ids.split(',').map(id => id.trim()) : [];
    const inputEntities: Array<{name: string, entity_id: string, type?: string}> = [];
    
    // Get input entity details from our cache
    const recentEntitySearches = context?.recentEntitySearches || new Map();
    for (const entityId of inputEntityIds) {
      const entityInfo = recentEntitySearches.get(entityId);
      if (entityInfo) {
        inputEntities.push(entityInfo);
      }
    }
    
    // Infer output type if not provided
    let outputType = args.output_type;
    if (!outputType) {
      // Check for explicit place signals
      const wantsPlaces = args.location || (args.latitude && args.longitude) || args.place_tags;
      
      // Get input types
      const inputTypes = inputEntities.map(e => e.type).filter(Boolean);
      
      if (wantsPlaces) {
        // User explicitly wants places
        outputType = 'urn:entity:place';
      } else if (inputTypes.length === 0) {
        // No type info - default to movie
        outputType = 'urn:entity:movie';
      } else if (inputTypes.every(t => t === inputTypes[0])) {
        // All same type → same output
        outputType = inputTypes[0];
      } else {
        // Mixed types - pick first media type found
        const mediaTypes = ['urn:entity:movie', 'urn:entity:tv_show', 'urn:entity:artist', 
                           'urn:entity:album', 'urn:entity:book', 'urn:entity:podcast', 
                           'urn:entity:videogame'];
        
        // Find first media type in inputs
        const foundMediaType = inputTypes.find(t => t && mediaTypes.includes(t));
        outputType = foundMediaType || inputTypes[0] || 'urn:entity:movie';
      }
    } else if (!VALID_ENTITY_TYPES.includes(outputType)) {
      // Validate provided output_type
      const normalized = outputType.replace('urn:entity:', '').toLowerCase();
      if (ENTITY_TYPE_MAP[normalized]) {
        outputType = ENTITY_TYPE_MAP[normalized];
      } else {
        outputType = 'urn:entity:movie';
      }
    }
    // Entity details already collected above
    
    try {
      // Helper function to make API call with optional sequel filtering
      const makeRecommendationCall = async (excludeEntityIds: string[] = []): Promise<any> => {
        // Use insights endpoint as primary for better cross-domain results
        const insightsParams = new URLSearchParams({
          'filter.type': outputType!,  // outputType is guaranteed to be set by this point
          'take': String(args.take || 5),
          'feature.explainability': 'true',
          // Removed bias.trends to get personalized results instead of trending content
        });
        
        // Add entity signals if provided
        if (args.entity_ids) {
          insightsParams.append('signal.interests.entities', args.entity_ids);
        }
        
        // Add tag signals if provided
        if (args.tag_ids) {
          insightsParams.append('signal.interests.tags', args.tag_ids);
          logApiCall(`  Using tag signals: ${args.tag_ids}`);
        }
        
        // Add demographic audience filtering if provided
        if (args.audience_ids) {
          insightsParams.append('signal.demographics.audiences', args.audience_ids);
          logApiCall(`  Using demographic audiences: ${args.audience_ids}`);
        }
        
        // Add interest tag filtering if provided
        if (args.interest_tags) {
          // If existing filter.tags, append; otherwise set
          const existingTags = insightsParams.get('filter.tags');
          if (existingTags) {
            insightsParams.set('filter.tags', `${existingTags},${args.interest_tags}`);
          } else {
            insightsParams.append('filter.tags', args.interest_tags);
          }
          logApiCall(`  Using interest tags: ${args.interest_tags}`);
        }
        
        // Add location parameters for place recommendations
        if (outputType === 'urn:entity:place') {
          // First, check if place_tags contains a neighborhood name
          const neighborhood = args.place_tags ? detectNeighborhood(args.place_tags) : null;
          
          if (neighborhood && NEIGHBORHOOD_POLYGONS[neighborhood]) {
            // Use POLYGON for neighborhood search
            insightsParams.append('filter.location', NEIGHBORHOOD_POLYGONS[neighborhood]);
            logApiCall(`  Using neighborhood POLYGON: ${neighborhood}`);
          } else if (args.location) {
            // Use filter.location.query for flexible city/neighborhood search
            insightsParams.append('filter.location.query', args.location);
            logApiCall(`  Using location query: ${args.location}`);
          } else if (args.latitude && args.longitude) {
            // Use WKT POINT format: POINT(longitude latitude)
            const point = `POINT(${args.longitude} ${args.latitude})`;
            insightsParams.append('filter.location', point);
            logApiCall(`  Using coordinates: ${point}`);
          }
          
          // Add radius if specified
          if ((args.latitude && args.longitude) || args.location) {
            const radius = args.radius || (args.location ? 2000 : 5000); // Smaller radius for neighborhoods
            insightsParams.append('filter.location.radius', String(radius));
            logApiCall(`  Search radius: ${radius} meters`);
          }
          
          // Handle place_tags for specific venue types (coffee shops, restaurants, etc.)
          if (args.place_tags) {
            logApiCall(`  Place context: ${args.place_tags}`);
            
            // Extract venue type keywords and map to URN tags
            const placeTags = args.place_tags.toLowerCase();
            const matchedTags: Array<{keyword: string, urn: string, priority: number}> = [];
            
            // Check each word/phrase against our PLACE_TAG_URNS mapping
            for (const [keyword, urn] of Object.entries(PLACE_TAG_URNS)) {
              if (placeTags.includes(keyword)) {
                // Prioritize specific cuisine tags over general venue types
                let priority = 1; // Default priority
                if (urn.includes(':genre:place:restaurant:')) {
                  priority = 3; // Highest priority for specific cuisines
                } else if (keyword === 'restaurant' || keyword === 'restaurants') {
                  priority = 0; // Lowest priority for generic restaurant
                }
                
                matchedTags.push({ keyword, urn, priority });
                logApiCall(`  Matched venue type: ${keyword} → ${urn} (priority: ${priority})`);
              }
            }
            
            // If we found matching tags, add the highest priority one to the filter
            if (matchedTags.length > 0) {
              // Sort by priority (descending) and use the highest priority tag
              matchedTags.sort((a, b) => b.priority - a.priority);
              const bestMatch = matchedTags[0];
              insightsParams.append('filter.tags', bestMatch.urn);
              logApiCall(`  Filtering by venue type: ${bestMatch.urn} (selected from ${matchedTags.length} matches)`);
            }
          }
          
          // Sort by affinity for location names, distance for coordinates
          if (args.location) {
            insightsParams.append('sort_by', 'affinity');
          } else if (args.latitude && args.longitude) {
            // Coordinates provided - distance sorting makes sense
            insightsParams.append('sort_by', 'distance');
          }
        }
        
        // Add exclude parameter if we have sequel IDs to filter
        if (excludeEntityIds.length > 0) {
          insightsParams.append('filter.exclude.entities', excludeEntityIds.join(','));
        }

        const insightsUrl = `${QLOO_API_URL}/v2/insights?${insightsParams}`;
        
        const insightsResponse = await fetchWithTimeout(insightsUrl, {
          headers: {
            'X-Api-Key': QLOO_API_KEY,
            'Accept': 'application/json',
          },
        }, 3000);

        if (insightsResponse.ok) {
          const insightsData = await insightsResponse.json() as any;
          logApiCall(`Response: ${insightsResponse.status}, found ${insightsData.results?.entities?.length || 0} results`);
          
          if (insightsData.results?.entities && insightsData.results.entities.length > 0) {
            return { data: insightsData, source: 'insights' };
          }
        } else if (insightsResponse.status === 403 && outputType === 'urn:entity:videogame') {
          // Video game recommendations not supported, try movies instead
          logApiCall(`Video game insights returned 403, retrying with movies...`);
          insightsParams.set('filter.type', 'urn:entity:movie');
          
          const movieInsightsUrl = `${QLOO_API_URL}/v2/insights?${insightsParams}`;
          const movieResponse = await fetchWithTimeout(movieInsightsUrl, {
            headers: {
              'X-Api-Key': QLOO_API_KEY,
              'Accept': 'application/json',
            },
          }, 3000);
          
          if (movieResponse.ok) {
            const movieData = await movieResponse.json() as any;
            logApiCall(`Movie fallback response: ${movieResponse.status}, found ${movieData.results?.entities?.length || 0} results`);
            
            if (movieData.results?.entities && movieData.results.entities.length > 0) {
              return { 
                data: movieData, 
                source: 'insights',
                fallbackNote: "Since video game recommendations aren't available, here are movies that match your gaming preferences"
              };
            }
          }
        }
        
        return null;
      };
      
      // First attempt without filtering
      let result = await makeRecommendationCall();
      
      // If we got results, check for sequels and filter restaurants
      if (result && inputEntities.length > 0) {
        let entities = result.data.results.entities;
        
        // Process results
        
        const sequelIds: string[] = [];
        
        // Detect sequels in the results
        for (const entity of entities) {
          if (isLikelySequel(entity.name, inputEntities)) {
            sequelIds.push(entity.entity_id);
          }
        }
        
        // Also detect franchise clusters (multiple entries from same franchise)
        const franchiseClusters = detectFranchiseCluster(entities);
        if (franchiseClusters.size > 0) {
          logApiCall(`  Detected ${franchiseClusters.size} franchise clusters`);
          
          // For each franchise, keep only the first (usually best) entry
          for (const [franchiseCore, memberIds] of franchiseClusters.entries()) {
            if (memberIds.length > 1) {
              logApiCall(`    Franchise "${franchiseCore}": ${memberIds.length} entries`);
              // Add all but the first to sequel IDs
              sequelIds.push(...memberIds.slice(1));
            }
          }
        }
        
        // Remove duplicates
        const uniqueSequelIds = [...new Set(sequelIds)];
        
        // If we found sequels and they make up a significant portion of results, retry with filtering
        // Check both total results and top 3 that will be shown to user
        const top3Entities = entities.slice(0, 3);
        const sequelsInTop3 = top3Entities.filter((e: any) => uniqueSequelIds.includes(e.entity_id)).length;
        const sequelIsTopPick = uniqueSequelIds.length > 0 && uniqueSequelIds.includes(entities[0].entity_id);
        
        // Debug logging
        if (uniqueSequelIds.length > 0) {
          logApiCall(`  DEBUG: Found ${uniqueSequelIds.length} unique sequel IDs`);
          logApiCall(`  DEBUG: Top 3 entities: ${top3Entities.map((e: any) => e.name).join(', ')}`);
          logApiCall(`  DEBUG: Sequels in top 3: ${sequelsInTop3}`);
          logApiCall(`  DEBUG: Is top pick a sequel: ${sequelIsTopPick}`);
          logApiCall(`  DEBUG: Will filter: ${sequelIsTopPick || sequelsInTop3 > 0}`);
        }
        
        // Filter if: 2 or more sequels appear in top 3 results (less aggressive filtering)
        if (uniqueSequelIds.length > 0 && sequelsInTop3 >= 2) {
          logApiCall(`  Found ${uniqueSequelIds.length} sequels (${sequelsInTop3} in top 3), retrying with filter...`);
          const filteredResult = await makeRecommendationCall(uniqueSequelIds);
          if (filteredResult) {
            result = filteredResult;
          }
        }
      }
      
      if (result) {
        // Take the top 3 entities from the results
        const entities = result.data.results.entities.slice(0, 3);
        
        // Extract detailed information from each recommendation
        const recommendations = entities.map((ent: any) => {
          // Get the first few tag names
          const tagNames = ent.tags ? 
            ent.tags.slice(0, 5).map((t: any) => t.name || t.value || t).filter(Boolean) : 
            [];
          
          // Get explainability scores for this specific entity
          const entityExplainability = ent.query?.explainability?.['signal.interests.entities'] || [];
          
          return {
            name: ent.name,
            entity_id: ent.entity_id,
            score: ent.query?.affinity || ent.affinity || 0,
            tags: tagNames,
            description: ent.properties?.description || '',
            explainability: entityExplainability,
            disambiguation: ent.disambiguation || ''
          };
        });
        
        logApiCall(`Returning ${recommendations.length} recommendations with explainability`);
        
        // Generate taste bridge for top recommendation
        const topRec = recommendations[0];
        const tasteBridge = topRec ? generateTasteBridge(topRec, inputEntities, topRec.explainability) : null;
        
        // Log details of each recommendation
        recommendations.forEach((rec: any, i: number) => {
          logApiCall(`  ${i+1}. ${rec.name} (score: ${rec.score.toFixed(3)})`);
          if (rec.tags.length > 0) {
            logApiCall(`     Tags: ${rec.tags.join(', ')}`);
          }
          
          // Log explainability scores if available
          if (rec.explainability && rec.explainability.length > 0) {
            const explainParts = rec.explainability
              .map((exp: any) => {
                const inputEntity = inputEntities.find(e => e.entity_id === exp.entity_id);
                if (inputEntity) {
                  const percentage = ((exp.score || exp.affinity || 0) * 100).toFixed(0);
                  return `${inputEntity.name} (${percentage}%)`;
                }
                return null;
              })
              .filter(Boolean)
              .join(', ');
            
            if (explainParts) {
              logApiCall(`     Influence: ${explainParts}`);
            }
          }
        });
        
        if (tasteBridge) {
          logApiCall(`  Taste Bridge: ${tasteBridge}`);
        }
        
        return JSON.stringify({
          recommendations,
          top_pick: recommendations[0],
          taste_bridge: tasteBridge,
          source: result.source,
          count: result.data.results.entities.length,
          fallback_note: result.fallbackNote || null
        });
      }
      
      // If insights fails, try recommendations endpoint as fallback (only if we have entity_ids)
      if (!args.entity_ids) {
        logApiCall(`Cannot use recommendations endpoint without entity_ids (tags not supported)`);
        return JSON.stringify({
          error: "No recommendations found",
          suggestion: "The insights endpoint failed and the fallback endpoint doesn't support tags",
        });
      }
      
      logApiCall(`Insights failed, trying recommendations endpoint...`);
      
      // Helper function for fallback recommendations with sequel filtering
      const makeFallbackCall = async (excludeEntityIds: string[] = []): Promise<any> => {
        const recParams = new URLSearchParams({
          entity_ids: args.entity_ids!,  // We checked above that entity_ids exists
          type: outputType!,  // outputType is guaranteed to be set by this point
          take: String(args.take || 5),
        });
        
        // Note: The recommendations endpoint doesn't support filter.exclude.entities
        // So we'll need to filter results client-side for this endpoint
        
        const recUrl = `${QLOO_API_URL}/recommendations?${recParams}`;
        
        const recResponse = await fetchWithTimeout(recUrl, {
          headers: {
            'X-Api-Key': QLOO_API_KEY,
            'Accept': 'application/json',
          },
        }, 3000);
        
        if (!recResponse.ok) {
          // Special handling for video game recommendations
          if (recResponse.status === 403 && outputType === 'urn:entity:videogame') {
            logApiCall(`Video game recommendations returned 403, falling back to movies...`);
            
            // Retry with movie output type
            const movieParams = new URLSearchParams({
              entity_ids: args.entity_ids!,
              type: 'urn:entity:movie',
              take: String(args.take || 5),
            });
            
            const movieUrl = `${QLOO_API_URL}/recommendations?${movieParams}`;
            
            const movieResponse = await fetchWithTimeout(movieUrl, {
              headers: {
                'X-Api-Key': QLOO_API_KEY,
                'Accept': 'application/json',
              },
            }, 3000);
            
            if (movieResponse.ok) {
              const movieData = await movieResponse.json() as any;
              logApiCall(`Movie fallback response: ${movieResponse.status}, found ${movieData.results?.length || 0} results`);
              
              // Return movie results with a note about the fallback
              return {
                results: movieData.results,
                originalCount: movieData.results?.length || 0,
                fallbackNote: "Since video game recommendations aren't available, here are movies that match your gaming preferences"
              };
            }
          }
          
          throw new Error(`Both endpoints failed. Status: ${recResponse.status}`);
        }
        
        const recData = await recResponse.json() as any;
        logApiCall(`Recommendations response: ${recResponse.status}, found ${recData.results?.length || 0} results`);
        
        if (recData.results && recData.results.length > 0) {
          // Filter out sequels client-side if needed
          let filteredResults = recData.results;
          if (excludeEntityIds.length > 0) {
            filteredResults = recData.results.filter((rec: any) => 
              !excludeEntityIds.includes(rec.entity_id)
            );
            logApiCall(`  Filtered out ${recData.results.length - filteredResults.length} sequels`);
          }
          
          return { results: filteredResults, originalCount: recData.results.length };
        }
        
        return null;
      };
      
      // First attempt without filtering
      let fallbackResult = await makeFallbackCall();
      
      // Check for sequels if we have input entity info
      if (fallbackResult && inputEntities.length > 0) {
        const sequelIds: string[] = [];
        
        // Detect sequels in the results
        for (const rec of fallbackResult.results) {
          if (isLikelySequel(rec.name, inputEntities)) {
            sequelIds.push(rec.entity_id);
          }
        }
        
        // Check top 3 results for consistency with insights endpoint
        const top3Results = fallbackResult.results.slice(0, 3);
        const sequelsInTop3 = top3Results.filter((rec: any) => sequelIds.includes(rec.entity_id)).length;
        
        // Filter if: 2 or more sequels appear in top 3 results (consistent with insights endpoint)
        if (sequelIds.length > 0 && sequelsInTop3 >= 2) {
          logApiCall(`  Found ${sequelIds.length} sequels (${sequelsInTop3} in top 3), filtering...`);
          fallbackResult = await makeFallbackCall(sequelIds);
        }
      }
      
      if (fallbackResult && fallbackResult.results.length > 0) {
        const recommendations = fallbackResult.results.slice(0, 3).map((rec: any) => ({
          name: rec.name,
          entity_id: rec.entity_id,
          score: rec.query?.affinity || rec.score || 0,
          tags: rec.tags ? rec.tags.slice(0, 5).map((t: any) => t.name || t.value || t) : [],
          description: rec.properties?.description || '',
          disambiguation: rec.disambiguation || ''
        }));
        
        logApiCall(`Returning ${recommendations.length} recommendations from fallback`);
        
        // Log details of each recommendation
        recommendations.forEach((rec: any, i: number) => {
          logApiCall(`  ${i+1}. ${rec.name} (score: ${rec.score.toFixed(3)})`);
          if (rec.tags.length > 0) {
            logApiCall(`     Tags: ${rec.tags.join(', ')}`);
          }
          
          // Log explainability scores if available
          if (rec.explainability && rec.explainability.length > 0) {
            const explainParts = rec.explainability
              .map((exp: any) => {
                const inputEntity = inputEntities.find(e => e.entity_id === exp.entity_id);
                if (inputEntity) {
                  const percentage = ((exp.score || exp.affinity || 0) * 100).toFixed(0);
                  return `${inputEntity.name} (${percentage}%)`;
                }
                return null;
              })
              .filter(Boolean)
              .join(', ');
            
            if (explainParts) {
              logApiCall(`     Influence: ${explainParts}`);
            }
          }
        });
        
        // Add a note if location was requested but couldn't be honored
        const locationNote = (args.location || (args.latitude && args.longitude)) 
          ? "Note: Location filtering was requested but no results found in that area. Showing general recommendations instead."
          : null;
        
        return JSON.stringify({
          recommendations,
          top_pick: recommendations[0],
          source: "recommendations",
          count: fallbackResult.originalCount,
          location_note: locationNote,
          fallback_note: fallbackResult.fallbackNote || null
        });
      }
      
      return JSON.stringify({
        error: "No recommendations found",
        suggestion: "Try different inputs or a different output type",
      });
      
    } catch (error: any) {
      logApiCall(`Error: ${error.message}`);
      return JSON.stringify({
        error: "Recommendation failed",
        details: error.message,
      });
    }
  },
});

// Get specific venues where fans hang out (coffee shops, bars, restaurants, etc.)
functions.push({
  schema: {
    type: "function",
    name: "get_fan_venues",
    description: "Find venues where fans gather or have high concentration. Use for any query about where fans hang out, concentrate, or prefer to go. Returns specific places (coffee shops, restaurants, bars, etc.) not neighborhoods.",
    parameters: {
      type: "object",
      properties: {
        entity_ids: {
          type: "string",
          description: "Entity ID from search_entity (e.g., Taylor Swift, The Office)"
        },
        venue_type: {
          type: "string",
          description: "Type of venue: coffee, restaurant, bar, or 'all' for mixed venues. Also supports specific chains: starbucks, dunkin, mcdonalds"
        },
        location: {
          type: "string",
          description: "Location name (e.g., 'Seattle', 'Capitol Hill Seattle', 'NYC', 'Lower East Side'). Can be a city or specific neighborhood."
        },
        locality_id: {
          type: "string",
          description: "Locality ID from search_locality (faster than location)"
        },
        radius: {
          type: "number",
          description: "Search radius in meters (default 5000, about 3 miles)"
        },
        sort_by: {
          type: "string",
          description: "Sort by 'affinity' for fan concentration/density or 'distance' for nearest venues"
        },
        take: {
          type: "number",
          description: "Number of venues to return (default 10)"
        }
      },
      required: ["entity_ids"]
    },
  },
  handler: async (args: { 
    entity_ids: string; 
    venue_type?: string; 
    location?: string;
    locality_id?: string;
    radius?: number;
    sort_by?: string;
    take?: number;
  }, context?: SessionContext) => {
    logApiCall(`get_fan_venues called`);
    logApiCall(`  Entity: ${args.entity_ids}`);
    logApiCall(`  Venue type: ${args.venue_type || 'all'}`);
    logApiCall(`  Location: ${args.location || args.locality_id || 'not specified'}`);
    
    // Validate required parameters
    if (!args.entity_ids) {
      return JSON.stringify({ error: "entity_ids is required" });
    }
    
    // Must have either location or locality_id
    if (!args.location && !args.locality_id) {
      return JSON.stringify({ 
        error: "Either location or locality_id is required",
        suggestion: "Specify a location like 'Seattle' or use search_locality to get a locality_id"
      });
    }
    
    try {
      // Build base parameters
      const params = new URLSearchParams({
        'signal.interests.entities': args.entity_ids,
        'filter.type': 'urn:entity:place',
        'take': String(args.take || 15),
        'sort_by': args.sort_by || 'affinity'  // Default to affinity for fan concentration
      });

      // Handle location parameters
      if (args.locality_id) {
        params.append('filter.location', args.locality_id);
        params.append('filter.location.radius', String(args.radius || 5000));
        logApiCall(`  Using locality ID for fast query: ${args.locality_id}`);
      } else if (args.location) {
        params.append('filter.location.query', args.location);
        params.append('filter.location.radius', String(args.radius || 2000));
        logApiCall(`  Using filter.location.query for flexible search`);
      }
      
      logApiCall(`  Sort by: ${args.sort_by || 'affinity'} (for ${args.sort_by === 'distance' ? 'proximity' : 'fan concentration'})`);

      // Handle venue type filtering
      const venueType = args.venue_type || 'all';
      const venueTypeLower = venueType.toLowerCase();
      const knownBrandId = KNOWN_BRAND_IDS[venueTypeLower];
      
      if (knownBrandId) {
        // Use filter.references_brand for 100% accuracy
        params.append('filter.references_brand', knownBrandId);
        logApiCall(`  Using brand filter for ${args.venue_type}: ${knownBrandId}`);
      } else if (venueType !== 'all') {
        // Use category tags for general venue types
        const venueTag = PLACE_TAG_URNS[venueTypeLower] || 
                        PLACE_TAG_URNS[venueTypeLower.replace(/_/g, ' ')];
        
        if (venueTag) {
          params.append('filter.tags', venueTag);
          logApiCall(`  Using category tag: ${venueTag}`);
        } else {
          logApiCall(`  No specific tag found for ${venueType}, returning all places`);
        }
      } else {
        // 'all' venue type - return mixed venues
        logApiCall(`  Returning all venue types (mixed results)`);
      }
      
      const url = `${QLOO_API_URL}/v2/insights?${params}`;
      
      const response = await fetchWithTimeout(url, {
        headers: {
          'X-Api-Key': QLOO_API_KEY,
          'Accept': 'application/json',
        },
      }, 3000);
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json() as any;
      logApiCall(`Response: ${response.status}, found ${data.results?.entities?.length || 0} venues`);
      
      if (data.results?.entities && data.results.entities.length > 0) {
        // Get entity info from cache
        const recentEntitySearches = context?.recentEntitySearches || new Map();
        const entityInfo = recentEntitySearches.get(args.entity_ids);
        
        // Format venue results
        const venues = data.results.entities.map((place: any) => {
          // Detect venue type from tags for mixed results
          let detectedType = venueType !== 'all' ? venueType : 'venue';
          if (venueType === 'all' && place.tags) {
            for (const tag of place.tags) {
              const tagStr = typeof tag === 'string' ? tag : (tag.tag_id || tag.id || tag.value || tag.name || '');
              if (tagStr.includes('coffee_shop')) {
                detectedType = 'coffee';
                break;
              } else if (tagStr.includes('bar')) {
                detectedType = 'bar';
                break;
              } else if (tagStr.includes('restaurant')) {
                detectedType = 'restaurant';
                break;
              }
            }
          }
          
          return {
            name: place.name,
            entity_id: place.entity_id,
            address: place.properties?.address || '',
            distance: place.query?.distance || null,
            tags: place.tags ? place.tags.slice(0, 3).map((t: any) => t.name || t.value || t) : [],
            score: Math.round((place.query?.affinity || place.affinity || 0) * 100),
            type: detectedType
          };
        });
        
        logApiCall(`Returning ${venues.length} ${args.venue_type} venues for ${entityInfo?.name || 'fans'}`);
        
        // Log the actual venue names
        venues.forEach((venue: any, i: number) => {
          logApiCall(`  ${i + 1}. ${venue.name}${venue.address ? ` - ${venue.address}` : ''}`);
        });
        
        // Check if we got a matched locality in the response
        const matchedLocation = data.query?.locality?.filter?.name || args.location;
        
        // Create summary based on context
        const fanEntityName = entityInfo?.name || args.entity_ids;
        
        return JSON.stringify({
          fan_entity: fanEntityName,
          venue_type: venueType,
          location_searched: matchedLocation,
          venues: venues,
          summary: `Found ${venues.length} ${venueType === 'all' ? 'venues' : venueType + 's'} in ${matchedLocation} with high ${fanEntityName} fan concentration`
        });
      } else {
        return JSON.stringify({
          fan_entity: (context?.recentEntitySearches || new Map()).get(args.entity_ids)?.name || args.entity_ids,
          venue_type: venueType,
          venues: [],
          error: `No ${venueType === 'all' ? 'venues' : venueType + 's'} found in this area`,
          suggestion: "Try a larger radius or different venue type"
        });
      }
    } catch (error: any) {
      logApiCall(`Error in get_fan_venues: ${error.message}`);
      return JSON.stringify({
        error: "Venue search failed",
        details: error.message
      });
    }
  },
});

// Get available audience segments for demographic targeting
functions.push({
  schema: {
    type: "function",
    name: "get_audiences",
    description: "Get available audience segments for demographic targeting (e.g., age groups, lifestyle segments)",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Optional: Filter by audience category (age, lifestyle, interest)",
        },
      },
      required: [],
    },
  },
  handler: async (args: { category?: string }, _context?: SessionContext) => {
    logApiCall(`get_audiences called with category: ${args.category || 'all'}`);
    
    try {
      const params = new URLSearchParams();
      if (args.category) {
        params.append('filter.category', args.category);
      }
      
      const url = `${QLOO_API_URL}/v2/audiences${params.toString() ? '?' + params : ''}`;
      logApiCall(`Calling: GET ${url}`);
      
      const response = await fetchWithTimeout(url, {
        headers: {
          'X-Api-Key': QLOO_API_KEY,
          'Accept': 'application/json',
        },
      }, 3000);
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json() as any;
      logApiCall(`Response: ${response.status}, found ${data.results?.length || 0} audiences`);
      
      if (data.results && data.results.length > 0) {
        const audiences = data.results.map((audience: any) => ({
          audience_id: audience.id,
          name: audience.name,
          category: audience.category || 'general',
          description: audience.description || '',
          size: audience.properties?.size || 'unknown'
        }));
        
        return JSON.stringify({
          audiences,
          total: audiences.length,
          categories: [...new Set(audiences.map((a: any) => a.category))]
        });
      } else {
        return JSON.stringify({
          audiences: [],
          total: 0,
          message: "No audience segments found"
        });
      }
    } catch (error: any) {
      logApiCall(`Error in get_audiences: ${error.message}`);
      return JSON.stringify({
        error: "Failed to fetch audiences",
        details: error.message
      });
    }
  },
});

// Search for tags to filter recommendations
functions.push({
  schema: {
    type: "function",
    name: "search_tags",
    description: "Search for available tags (genres, cuisines, interests) to use in filtering",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Tag search term (e.g., 'italian', 'comedy', 'outdoor')",
        },
        entity_type: {
          type: "string",
          description: "Optional: Filter tags by entity type (e.g., 'place', 'movie', 'artist')",
        },
      },
      required: ["query"],
    },
  },
  handler: async (args: { query: string; entity_type?: string }, _context?: SessionContext) => {
    logApiCall(`search_tags called with query: "${args.query}", type: ${args.entity_type || 'all'}`);
    
    try {
      const params = new URLSearchParams({
        'query': args.query
      });
      
      if (args.entity_type) {
        // Map user-friendly type to URN format
        const urnType = ENTITY_TYPE_MAP[args.entity_type] || args.entity_type;
        if (urnType.startsWith('urn:entity:')) {
          params.append('filter.entity_type', urnType);
        }
      }
      
      const url = `${QLOO_API_URL}/v2/tags?${params}`;
      logApiCall(`Calling: GET ${url}`);
      
      const response = await fetchWithTimeout(url, {
        headers: {
          'X-Api-Key': QLOO_API_KEY,
          'Accept': 'application/json',
        },
      }, 2500);
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json() as any;
      logApiCall(`Response: ${response.status}, found ${data.results?.length || 0} tags`);
      
      if (data.results && data.results.length > 0) {
        const tags = data.results.map((tag: any) => ({
          tag_id: tag.id,
          name: tag.name,
          urn: tag.urn || tag.id, // Full URN for use in filters
          category: tag.category || 'general',
          entity_types: tag.entity_types || [],
          popularity: tag.properties?.popularity || 0
        }));
        
        return JSON.stringify({
          tags,
          total: tags.length,
          suggestion: `Use the 'urn' value in filter.tags parameter`
        });
      } else {
        return JSON.stringify({
          tags: [],
          total: 0,
          suggestion: `No tags found for "${args.query}". Try a different search term.`
        });
      }
    } catch (error: any) {
      logApiCall(`Error in search_tags: ${error.message}`);
      return JSON.stringify({
        error: "Tag search failed",
        details: error.message
      });
    }
  },
});

export default functions;
