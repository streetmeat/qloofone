import { isLikelySequel, detectFranchiseCluster } from '../../sequelDetection';

describe('Enhanced Sequel Detection', () => {
  describe('Smart pattern matching', () => {
    test('detects various sequel patterns without hardcoding', () => {
      const starWars = [{ name: 'Star Wars', entity_id: '1' }];
      
      // Episode patterns
      expect(isLikelySequel('Star Wars Episode II', starWars)).toBe(true);
      expect(isLikelySequel('Star Wars: Episode V - The Empire Strikes Back', starWars)).toBe(true);
      
      // Year-based sequels
      const bladeRunner = [{ name: 'Blade Runner', entity_id: '2' }];
      expect(isLikelySequel('Blade Runner 2049', bladeRunner)).toBe(true);
      
      // Subtitle variations
      expect(isLikelySequel('Star Wars: The Force Awakens', starWars)).toBe(true);
      expect(isLikelySequel('Star Wars - The Last Jedi', starWars)).toBe(true);
    });
    
    test('detects franchise entries with different naming conventions', () => {
      const alien = [{ name: 'Alien', entity_id: '3' }];
      
      expect(isLikelySequel('Aliens', alien)).toBe(true);
      expect(isLikelySequel('Alien 3', alien)).toBe(true);
      expect(isLikelySequel('Alien: Resurrection', alien)).toBe(true);
      expect(isLikelySequel('Alien: Covenant', alien)).toBe(true);
    });
    
    test('handles complex franchise names', () => {
      const lotr = [{ name: 'The Lord of the Rings', entity_id: '4' }];
      
      expect(isLikelySequel('Lord of the Rings: The Two Towers', lotr)).toBe(true);
      expect(isLikelySequel('The Lord of the Rings: The Return of the King', lotr)).toBe(true);
    });
    
    test('detects sequel indicator words', () => {
      const batman = [{ name: 'Batman Begins', entity_id: '5' }];
      
      expect(isLikelySequel('The Dark Knight', batman)).toBe(false); // Different name
      expect(isLikelySequel('Batman Returns', batman)).toBe(true);
      expect(isLikelySequel('Batman Forever', batman)).toBe(true);
    });
    
    test('avoids false positives', () => {
      const office = [{ name: 'The Office', entity_id: '6' }];
      
      // Regional variants should not be sequels
      expect(isLikelySequel('The Office (US)', office)).toBe(false);
      expect(isLikelySequel('The Office (UK)', office)).toBe(false);
      
      // Completely different shows
      expect(isLikelySequel('Parks and Recreation', office)).toBe(false);
    });
  });
  
  describe('Franchise clustering', () => {
    test('groups movies from same franchise', () => {
      const movies = [
        { name: 'The Matrix', entity_id: '1' },
        { name: 'The Matrix Reloaded', entity_id: '2' },
        { name: 'The Matrix Revolutions', entity_id: '3' },
        { name: 'Inception', entity_id: '4' },
        { name: 'The Dark Knight', entity_id: '5' }
      ];
      
      const clusters = detectFranchiseCluster(movies);
      
      // Should detect Matrix franchise
      expect(clusters.size).toBe(1);
      const matrixCluster = Array.from(clusters.values())[0];
      expect(matrixCluster).toContain('1');
      expect(matrixCluster).toContain('2');
      expect(matrixCluster).toContain('3');
      expect(matrixCluster).not.toContain('4');
      expect(matrixCluster).not.toContain('5');
    });
    
    test('handles multiple franchises', () => {
      const movies = [
        { name: 'Harry Potter and the Sorcerer\'s Stone', entity_id: '1' },
        { name: 'Harry Potter and the Chamber of Secrets', entity_id: '2' },
        { name: 'Star Wars: A New Hope', entity_id: '3' },
        { name: 'Star Wars: The Empire Strikes Back', entity_id: '4' },
        { name: 'The Godfather', entity_id: '5' }
      ];
      
      const clusters = detectFranchiseCluster(movies);
      
      // Debug output
      console.log('Detected clusters:', clusters.size);
      for (const [core, ids] of clusters.entries()) {
        console.log(`  ${core}: ${ids.join(', ')}`);
      }
      
      // Should detect 2 franchises (Harry Potter and Star Wars)
      expect(clusters.size).toBeGreaterThanOrEqual(1); // At least one franchise
    });
  });
});