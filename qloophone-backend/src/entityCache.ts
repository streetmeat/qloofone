/**
 * Simple, performant entity cache implementation
 * No over-engineering - just a Map with TTL and file persistence
 */

import * as fs from 'fs';
import * as path from 'path';

interface CachedEntity {
  entity_id: string;
  name: string;
  type?: string;
  cachedAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
}

class EntityCache {
  private cache: Map<string, CachedEntity> = new Map();
  private stats: CacheStats = { hits: 0, misses: 0, evictions: 0 };
  
  // Simple configuration
  private readonly MAX_SIZE = 500; // Reasonable limit
  private readonly TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
  private readonly CACHE_FILE = path.join(__dirname, '../cache/entities.json');
  
  constructor() {
    // Skip loading from disk in test environment
    if (process.env.NODE_ENV !== 'test') {
      this.loadFromDisk();
    }
  }

  /**
   * Get entity from cache
   */
  get(query: string): CachedEntity | null {
    const key = this.makeKey(query);
    const cached = this.cache.get(key);
    
    if (!cached) {
      this.stats.misses++;
      return null;
    }
    
    // Check if expired
    if (Date.now() - cached.cachedAt > this.TTL_MS) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }
    
    this.stats.hits++;
    return cached;
  }

  /**
   * Add entity to cache
   */
  set(query: string, entity: { entity_id: string; name: string; type?: string }): void {
    const key = this.makeKey(query);
    
    // Simple LRU: if at capacity, remove oldest
    if (this.cache.size >= this.MAX_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
        this.stats.evictions++;
      }
    }
    
    this.cache.set(key, {
      ...entity,
      cachedAt: Date.now()
    });
    
    // Save to disk in background (don't block)
    setImmediate(() => this.saveToDisk());
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { size: number; hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0
    };
  }

  /**
   * Clear cache (useful for testing)
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  /**
   * Make cache key (case-insensitive, trimmed)
   */
  private makeKey(query: string): string {
    return query.toLowerCase().trim();
  }

  /**
   * Load cache from disk
   */
  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.CACHE_FILE)) {
        const data = fs.readFileSync(this.CACHE_FILE, 'utf8');
        const parsed = JSON.parse(data);
        
        // Rebuild Map from array
        if (Array.isArray(parsed.entities)) {
          parsed.entities.forEach(([key, value]: [string, CachedEntity]) => {
            // Skip expired entries
            if (Date.now() - value.cachedAt <= this.TTL_MS) {
              this.cache.set(key, value);
            }
          });
        }
        
        console.log(`[EntityCache] Loaded ${this.cache.size} entities from disk`);
      }
    } catch (error) {
      console.error('[EntityCache] Failed to load from disk:', error);
    }
  }

  /**
   * Save cache to disk (non-blocking)
   */
  private saveToDisk(): void {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.CACHE_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Convert Map to array for JSON serialization
      const data = {
        entities: Array.from(this.cache.entries()),
        savedAt: new Date().toISOString()
      };
      
      fs.writeFileSync(this.CACHE_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      // Don't crash the app if cache save fails
      console.error('[EntityCache] Failed to save to disk:', error);
    }
  }
}

// Singleton instance
export const entityCache = new EntityCache();

// No pre-populated entries - let the cache build naturally from actual queries
// This prevents false matches and cross-contamination between calls