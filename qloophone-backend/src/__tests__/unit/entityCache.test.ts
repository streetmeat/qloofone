import { entityCache } from '../../entityCache';
import * as fs from 'fs';

// Mock fs module
jest.mock('fs');

describe('EntityCache', () => {
  beforeEach(() => {
    // Clear cache before each test
    entityCache.clear();
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('should return null for cache miss', () => {
      const result = entityCache.get('non-existent-query');
      expect(result).toBeNull();
    });

    it('should store and retrieve entities', () => {
      const entity = {
        entity_id: 'test-123',
        name: 'Test Entity',
        type: 'urn:entity:test'
      };

      entityCache.set('test query', entity);
      const retrieved = entityCache.get('test query');

      expect(retrieved).toMatchObject({
        entity_id: 'test-123',
        name: 'Test Entity',
        type: 'urn:entity:test'
      });
      expect(retrieved?.cachedAt).toBeDefined();
    });

    it('should handle case-insensitive queries', () => {
      const entity = {
        entity_id: 'test-456',
        name: 'Case Test',
        type: 'urn:entity:test'
      };

      entityCache.set('TeSt QuErY', entity);
      
      expect(entityCache.get('test query')).toBeTruthy();
      expect(entityCache.get('TEST QUERY')).toBeTruthy();
      expect(entityCache.get('Test Query')).toBeTruthy();
    });

    it('should trim whitespace from queries', () => {
      const entity = {
        entity_id: 'test-789',
        name: 'Trim Test',
        type: 'urn:entity:test'
      };

      entityCache.set('  trim test  ', entity);
      
      expect(entityCache.get('trim test')).toBeTruthy();
      expect(entityCache.get('  trim test')).toBeTruthy();
      expect(entityCache.get('trim test  ')).toBeTruthy();
    });
  });

  describe('cache stats', () => {
    it('should track hits and misses', () => {
      const entity = {
        entity_id: 'stats-123',
        name: 'Stats Test',
        type: 'urn:entity:test'
      };

      // Initial stats
      let stats = entityCache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);

      // Cache miss
      entityCache.get('missing');
      stats = entityCache.getStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(0);

      // Add to cache
      entityCache.set('stats test', entity);

      // Cache hit
      entityCache.get('stats test');
      stats = entityCache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);

      // Another hit
      entityCache.get('stats test');
      stats = entityCache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
    });

    it('should calculate hit rate correctly', () => {
      const entity = {
        entity_id: 'rate-123',
        name: 'Rate Test',
        type: 'urn:entity:test'
      };

      entityCache.set('rate test', entity);

      // 3 hits, 2 misses = 60% hit rate
      entityCache.get('rate test'); // hit
      entityCache.get('rate test'); // hit
      entityCache.get('rate test'); // hit
      entityCache.get('missing1'); // miss
      entityCache.get('missing2'); // miss

      const stats = entityCache.getStats();
      expect(stats.hitRate).toBeCloseTo(0.6, 2);
    });
  });

  describe('cache limits', () => {
    it('should evict oldest entries when at capacity', () => {
      // Note: MAX_SIZE is set to 500 in the implementation
      // For testing, we'll just verify eviction works with a few entries
      
      // Add first entity
      entityCache.set('first', {
        entity_id: 'first-id',
        name: 'First Entity',
        type: 'urn:entity:test'
      });

      // Verify it's cached
      expect(entityCache.get('first')).toBeTruthy();

      // Add many more entities (simulate reaching capacity)
      for (let i = 0; i < 501; i++) {
        entityCache.set(`entity-${i}`, {
          entity_id: `id-${i}`,
          name: `Entity ${i}`,
          type: 'urn:entity:test'
        });
      }

      // Check cache size doesn't exceed limit
      const stats = entityCache.getStats();
      expect(stats.size).toBeLessThanOrEqual(500);
      expect(stats.evictions).toBeGreaterThan(0);
    });
  });

  describe('TTL expiration', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return null for expired entries', () => {
      const entity = {
        entity_id: 'ttl-test-1',
        name: 'TTL Test Entity',
        type: 'urn:entity:test'
      };

      entityCache.set('ttl test', entity);
      
      // Verify entity is cached
      expect(entityCache.get('ttl test')).toBeTruthy();

      // Fast forward past TTL (7 days + 1 second)
      jest.advanceTimersByTime(7 * 24 * 60 * 60 * 1000 + 1000);

      // Should return null for expired entry
      expect(entityCache.get('ttl test')).toBeNull();
    });

    it('should remove expired entries from cache', () => {
      const entity = {
        entity_id: 'ttl-test-2',
        name: 'TTL Test Entity 2',
        type: 'urn:entity:test'
      };

      entityCache.set('ttl test 2', entity);
      
      // Get initial cache size
      let stats = entityCache.getStats();
      const initialSize = stats.size;

      // Fast forward past TTL
      jest.advanceTimersByTime(7 * 24 * 60 * 60 * 1000 + 1000);

      // Access the expired entry
      entityCache.get('ttl test 2');

      // Cache size should be reduced
      stats = entityCache.getStats();
      expect(stats.size).toBe(initialSize - 1);
    });

    it('should track expired entries as misses', () => {
      const entity = {
        entity_id: 'ttl-test-3',
        name: 'TTL Test Entity 3',
        type: 'urn:entity:test'
      };

      entityCache.set('ttl test 3', entity);
      
      // Get initial miss count
      let stats = entityCache.getStats();
      const initialMisses = stats.misses;

      // Fast forward past TTL
      jest.advanceTimersByTime(7 * 24 * 60 * 60 * 1000 + 1000);

      // Access the expired entry
      entityCache.get('ttl test 3');

      // Should count as a miss
      stats = entityCache.getStats();
      expect(stats.misses).toBe(initialMisses + 1);
    });

    it('should not expire entries within TTL period', () => {
      const entity = {
        entity_id: 'ttl-test-4',
        name: 'TTL Test Entity 4',
        type: 'urn:entity:test'
      };

      entityCache.set('ttl test 4', entity);
      
      // Fast forward less than TTL (6 days)
      jest.advanceTimersByTime(6 * 24 * 60 * 60 * 1000);

      // Should still return the entity
      const retrieved = entityCache.get('ttl test 4');
      expect(retrieved).toBeTruthy();
      expect(retrieved?.entity_id).toBe('ttl-test-4');
    });
  });

  describe('disk persistence', () => {
    it('should handle missing cache directory when saving', () => {
      const mockExistsSync = fs.existsSync as jest.Mock;
      const mockMkdirSync = fs.mkdirSync as jest.Mock;
      const mockWriteFileSync = fs.writeFileSync as jest.Mock;
      
      // Mock directory doesn't exist
      mockExistsSync.mockReturnValue(false);
      
      // Add an entity to trigger save
      entityCache.set('save test', {
        entity_id: 'save-test-1',
        name: 'Save Test',
        type: 'urn:entity:test'
      });
      
      // Use setImmediate to wait for async save
      return new Promise<void>((resolve) => {
        setImmediate(() => {
          // Should create directory
          expect(mockMkdirSync).toHaveBeenCalledWith(
            expect.stringContaining('cache'),
            { recursive: true }
          );
          
          // Should write file
          expect(mockWriteFileSync).toHaveBeenCalled();
          resolve();
        });
      });
    });

    it('should handle write failures gracefully', () => {
      const mockExistsSync = fs.existsSync as jest.Mock;
      const mockWriteFileSync = fs.writeFileSync as jest.Mock;
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock directory exists
      mockExistsSync.mockReturnValue(true);
      
      // Mock write failure
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('Write failed');
      });
      
      // Add an entity to trigger save
      entityCache.set('write fail test', {
        entity_id: 'write-fail-1',
        name: 'Write Fail Test',
        type: 'urn:entity:test'
      });
      
      // Use setImmediate to wait for async save
      return new Promise<void>((resolve) => {
        setImmediate(() => {
          // Should log error but not throw
          expect(consoleErrorSpy).toHaveBeenCalledWith(
            '[EntityCache] Failed to save to disk:',
            expect.any(Error)
          );
          
          // Cache should still work
          const retrieved = entityCache.get('write fail test');
          expect(retrieved).toBeTruthy();
          
          consoleErrorSpy.mockRestore();
          resolve();
        });
      });
    });

    it('should save cache data in correct format', () => {
      const mockExistsSync = fs.existsSync as jest.Mock;
      const mockWriteFileSync = fs.writeFileSync as jest.Mock;
      
      // Mock directory exists
      mockExistsSync.mockReturnValue(true);
      
      // Capture written data
      let writtenData: any;
      mockWriteFileSync.mockImplementation((_path, data) => {
        writtenData = JSON.parse(data);
      });
      
      // Add multiple entities
      entityCache.set('entity 1', {
        entity_id: 'id-1',
        name: 'Entity 1',
        type: 'urn:entity:test'
      });
      
      entityCache.set('entity 2', {
        entity_id: 'id-2',
        name: 'Entity 2',
        type: 'urn:entity:test'
      });
      
      // Use setImmediate to wait for async save
      return new Promise<void>((resolve) => {
        setImmediate(() => {
          // Check data format
          expect(writtenData).toHaveProperty('entities');
          expect(writtenData).toHaveProperty('savedAt');
          expect(Array.isArray(writtenData.entities)).toBe(true);
          expect(writtenData.entities.length).toBeGreaterThanOrEqual(2);
          
          // Check entity format
          const [key, value] = writtenData.entities[0];
          expect(typeof key).toBe('string');
          expect(value).toHaveProperty('entity_id');
          expect(value).toHaveProperty('name');
          expect(value).toHaveProperty('cachedAt');
          
          resolve();
        });
      });
    });
  });

  describe('loadFromDisk', () => {
    // We need to test the constructor's loadFromDisk behavior
    // Since entityCache is a singleton, we'll need to use a different approach
    
    beforeEach(() => {
      // Reset NODE_ENV to allow disk loading
      delete process.env.NODE_ENV;
      
      // Clear the module cache to force re-initialization
      jest.resetModules();
    });
    
    afterEach(() => {
      // Restore NODE_ENV
      process.env.NODE_ENV = 'test';
    });
    
    it('should load valid cache file on startup', () => {
      const mockExistsSync = require('fs').existsSync as jest.Mock;
      const mockReadFileSync = require('fs').readFileSync as jest.Mock;
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Mock cache file exists
      mockExistsSync.mockReturnValue(true);
      
      // Mock valid cache data
      const validCacheData = {
        entities: [
          ['test entity', {
            entity_id: 'loaded-1',
            name: 'Loaded Entity',
            type: 'urn:entity:test',
            cachedAt: Date.now() - 1000 // Recent entry
          }]
        ],
        savedAt: new Date().toISOString()
      };
      
      mockReadFileSync.mockReturnValue(JSON.stringify(validCacheData));
      
      // Re-import to trigger constructor
      require('../../entityCache');
      
      // Should log successful load
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[EntityCache] Loaded 1 entities from disk'
      );
      
      consoleLogSpy.mockRestore();
    });
    
    it('should handle corrupted cache file gracefully', () => {
      const mockExistsSync = require('fs').existsSync as jest.Mock;
      const mockReadFileSync = require('fs').readFileSync as jest.Mock;
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock cache file exists
      mockExistsSync.mockReturnValue(true);
      
      // Mock corrupted JSON
      mockReadFileSync.mockReturnValue('{ invalid json');
      
      // Re-import to trigger constructor
      require('../../entityCache');
      
      // Should log error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[EntityCache] Failed to load from disk:',
        expect.any(Error)
      );
      
      consoleErrorSpy.mockRestore();
    });
    
    it('should skip expired entries when loading', () => {
      const mockExistsSync = require('fs').existsSync as jest.Mock;
      const mockReadFileSync = require('fs').readFileSync as jest.Mock;
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Mock cache file exists
      mockExistsSync.mockReturnValue(true);
      
      // Mock cache data with expired and valid entries
      const cacheData = {
        entities: [
          ['expired entity', {
            entity_id: 'expired-1',
            name: 'Expired Entity',
            type: 'urn:entity:test',
            cachedAt: Date.now() - (8 * 24 * 60 * 60 * 1000) // 8 days old
          }],
          ['valid entity', {
            entity_id: 'valid-1',
            name: 'Valid Entity',
            type: 'urn:entity:test',
            cachedAt: Date.now() - 1000 // Recent
          }]
        ],
        savedAt: new Date().toISOString()
      };
      
      mockReadFileSync.mockReturnValue(JSON.stringify(cacheData));
      
      // Re-import to trigger constructor
      require('../../entityCache');
      
      // Should only load 1 entity (the valid one)
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[EntityCache] Loaded 1 entities from disk'
      );
      
      consoleLogSpy.mockRestore();
    });
  });
});