import { isLikelySequel } from '../../sequelDetection';

describe('Sequel Filtering Consistency', () => {
  describe('Less aggressive sequel filtering (2+ in top 3)', () => {
    const testCases = [
      {
        name: 'Should NOT filter when only 1 sequel in top 3',
        inputEntity: { name: 'Counter-Strike', entity_id: 'cs-id' },
        recommendations: [
          { name: 'Counter-Strike 2', entity_id: 'cs2-id' }, // Sequel
          { name: 'Valorant', entity_id: 'val-id' },
          { name: 'Overwatch', entity_id: 'ow-id' }
        ],
        shouldFilter: false
      },
      {
        name: 'Should filter when 2 sequels in top 3',
        inputEntity: { name: 'The Matrix', entity_id: 'matrix-id' },
        recommendations: [
          { name: 'The Matrix Reloaded', entity_id: 'matrix2-id' }, // Sequel
          { name: 'The Matrix Revolutions', entity_id: 'matrix3-id' }, // Sequel
          { name: 'Inception', entity_id: 'inception-id' }
        ],
        shouldFilter: true
      },
      {
        name: 'Should filter when all 3 are sequels',
        inputEntity: { name: 'Iron Man', entity_id: 'iron-man-id' },
        recommendations: [
          { name: 'Iron Man 2', entity_id: 'iron2-id' }, // Sequel
          { name: 'Iron Man 3', entity_id: 'iron3-id' }, // Sequel
          { name: 'Iron Man: Armored Adventures', entity_id: 'iron-tv-id' } // Sequel
        ],
        shouldFilter: true
      },
      {
        name: 'Should handle mixed game/book entities correctly',
        inputEntity: { name: 'Shadowrun', entity_id: 'shadowrun-game-id' },
        recommendations: [
          { name: 'Shadowrun Returns', entity_id: 'sr-returns-id' }, // Game sequel
          { name: 'Cyberpunk 2077', entity_id: 'cp2077-id' },
          { name: 'Deus Ex', entity_id: 'deus-ex-id' }
        ],
        shouldFilter: false // Only 1 sequel in top 3
      }
    ];

    testCases.forEach(testCase => {
      it(testCase.name, () => {
        // Count sequels in top 3
        const top3 = testCase.recommendations.slice(0, 3);
        const sequelsInTop3 = top3.filter(rec => 
          isLikelySequel(rec.name, [testCase.inputEntity])
        ).length;

        // Apply the new filtering logic: filter if 2+ sequels in top 3
        const shouldFilterByNewLogic = sequelsInTop3 >= 2;

        expect(shouldFilterByNewLogic).toBe(testCase.shouldFilter);
      });
    });
  });

  describe('Sequel detection accuracy', () => {
    it('should correctly identify Counter-Strike 2 as a sequel of Counter-Strike', () => {
      const result = isLikelySequel('Counter-Strike 2', [
        { name: 'Counter-Strike', entity_id: 'cs-id' }
      ]);
      expect(result).toBe(true);
    });

    it('should correctly identify Shadowrun Returns as a sequel of Shadowrun', () => {
      const result = isLikelySequel('Shadowrun Returns', [
        { name: 'Shadowrun', entity_id: 'shadowrun-id' }
      ]);
      expect(result).toBe(true);
    });

    it('should not identify Valorant as a sequel of Counter-Strike', () => {
      const result = isLikelySequel('Valorant', [
        { name: 'Counter-Strike', entity_id: 'cs-id' }
      ]);
      expect(result).toBe(false);
    });

    it('should not identify The Office (US) as a sequel of The Office', () => {
      const result = isLikelySequel('The Office (US)', [
        { name: 'The Office', entity_id: 'office-uk-id' }
      ]);
      expect(result).toBe(false);
    });
  });
});