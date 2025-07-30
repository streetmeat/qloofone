import { isLikelySequel } from '../sequelDetection';

describe('isLikelySequel', () => {
  describe('Number-based sequels', () => {
    const darkSoulsInput = [{ name: 'Dark Souls', entity_id: '123' }];
    
    test('detects numbered sequels (Arabic numerals)', () => {
      expect(isLikelySequel('Dark Souls 2', darkSoulsInput)).toBe(true);
      expect(isLikelySequel('Dark Souls 3', darkSoulsInput)).toBe(true);
      expect(isLikelySequel('Dark Souls 4', darkSoulsInput)).toBe(true);
    });

    test('detects Roman numeral sequels', () => {
      expect(isLikelySequel('Dark Souls II', darkSoulsInput)).toBe(true);
      expect(isLikelySequel('Dark Souls III', darkSoulsInput)).toBe(true);
      expect(isLikelySequel('Dark Souls IV', darkSoulsInput)).toBe(true);
    });

    test('handles case insensitivity', () => {
      expect(isLikelySequel('DARK SOULS 2', darkSoulsInput)).toBe(true);
      expect(isLikelySequel('dark souls ii', darkSoulsInput)).toBe(true);
    });

    test('does not false positive on unrelated titles with numbers', () => {
      expect(isLikelySequel('Blade Runner 2049', darkSoulsInput)).toBe(false);
      expect(isLikelySequel('2 Fast 2 Furious', darkSoulsInput)).toBe(false);
    });
  });

  describe('Subtitle-based sequels', () => {
    const harryPotterInput = [{ name: 'Harry Potter', entity_id: '456' }];
    const spiderManInput = [{ name: 'Spider-Man', entity_id: '789' }];

    test('detects sequels with subtitles', () => {
      expect(isLikelySequel('Harry Potter and the Chamber of Secrets', harryPotterInput)).toBe(true);
      expect(isLikelySequel('Spider-Man: Far From Home', spiderManInput)).toBe(true);
    });

    test('detects "Part" sequels', () => {
      expect(isLikelySequel('Harry Potter: Part 2', harryPotterInput)).toBe(true);
      expect(isLikelySequel('The Hobbit: Part Two', [{ name: 'The Hobbit', entity_id: '111' }])).toBe(true);
    });

    test('detects "Volume" sequels', () => {
      expect(isLikelySequel('Kill Bill: Volume 2', [{ name: 'Kill Bill', entity_id: '222' }])).toBe(true);
      expect(isLikelySequel('Kill Bill: Vol. 2', [{ name: 'Kill Bill', entity_id: '222' }])).toBe(true);
    });
  });

  describe('Franchise detection', () => {
    const terminatorInput = [{ name: 'The Terminator', entity_id: '333' }];
    const toyStoryInput = [{ name: 'Toy Story', entity_id: '444' }];

    test('detects franchise entries', () => {
      expect(isLikelySequel('Terminator 2: Judgment Day', terminatorInput)).toBe(true);
      expect(isLikelySequel('Terminator Salvation', terminatorInput)).toBe(true);
      expect(isLikelySequel('Terminator: Dark Fate', terminatorInput)).toBe(true);
    });

    test('handles variations in naming', () => {
      expect(isLikelySequel('Toy Story 2', toyStoryInput)).toBe(true);
      expect(isLikelySequel('Toy Story 3', toyStoryInput)).toBe(true);
      expect(isLikelySequel('Toy Story 4', toyStoryInput)).toBe(true);
    });
  });

  describe('Multiple input entities', () => {
    const multipleInputs = [
      { name: 'Star Wars', entity_id: '555' },
      { name: 'Lord of the Rings', entity_id: '666' }
    ];

    test('checks against all input entities', () => {
      expect(isLikelySequel('Star Wars: The Empire Strikes Back', multipleInputs)).toBe(true);
      expect(isLikelySequel('Lord of the Rings: The Two Towers', multipleInputs)).toBe(true);
      expect(isLikelySequel('Harry Potter 2', multipleInputs)).toBe(false);
    });
  });

  describe('Edge cases', () => {
    test('handles empty input array', () => {
      expect(isLikelySequel('Any Movie', [])).toBe(false);
    });

    test('handles special characters in names', () => {
      const input = [{ name: 'Mission: Impossible', entity_id: '777' }];
      expect(isLikelySequel('Mission: Impossible 2', input)).toBe(true);
      expect(isLikelySequel('Mission: Impossible - Fallout', input)).toBe(true);
    });

    test('avoids false positives for similar but unrelated titles', () => {
      const starInput = [{ name: 'Star Wars', entity_id: '888' }];
      expect(isLikelySequel('Star Trek', starInput)).toBe(false);
      expect(isLikelySequel('Lone Star', starInput)).toBe(false);
      expect(isLikelySequel('A Star is Born', starInput)).toBe(false);
    });

    test('handles TV show season naming', () => {
      const officeInput = [{ name: 'The Office', entity_id: '999' }];
      expect(isLikelySequel('The Office Season 2', officeInput)).toBe(true);
      expect(isLikelySequel('The Office (US)', officeInput)).toBe(false); // Not a sequel
    });
  });

  describe('Real-world examples from Qloo API', () => {
    test('detects Marvel sequels', () => {
      const input = [{ name: 'Iron Man', entity_id: 'aaa' }];
      expect(isLikelySequel('Iron Man 2', input)).toBe(true);
      expect(isLikelySequel('Iron Man 3', input)).toBe(true);
    });

    test('detects music album sequels', () => {
      const input = [{ name: 'Taylor Swift', entity_id: 'bbb' }];
      // These should NOT be detected as sequels - they're different works
      expect(isLikelySequel('Fearless', input)).toBe(false);
      expect(isLikelySequel('Red', input)).toBe(false);
    });

    test('handles game franchises', () => {
      const input = [{ name: 'The Legend of Zelda', entity_id: 'ccc' }];
      expect(isLikelySequel('The Legend of Zelda: Breath of the Wild', input)).toBe(true);
      expect(isLikelySequel('The Legend of Zelda II', input)).toBe(true);
    });
  });
});