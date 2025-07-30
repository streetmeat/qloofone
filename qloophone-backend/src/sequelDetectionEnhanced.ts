// Enhanced sequel detection with smart pattern matching

// Extract the "core" name of a franchise by removing common prefixes/suffixes
function extractFranchiseCore(title: string): string {
  let core = title.toLowerCase();
  
  // Remove common articles
  core = core.replace(/^(the|a|an)\s+/i, '');
  
  // Remove year patterns
  core = core.replace(/\s*\b(19|20)\d{2}\b\s*$/, '');
  
  // Remove common subtitle separators and everything after
  core = core.replace(/\s*[:–\-]\s*.*$/, '');
  
  // Remove episode numbers
  core = core.replace(/\s+(episode\s+)?(i+|[ivx]+|\d+)\s*$/, '');
  
  // Remove "Part" indicators
  core = core.replace(/\s+part\s+(one|two|three|four|five|\d+|i+|[ivx]+)\s*$/i, '');
  
  return core.trim();
}

// Calculate similarity between two strings (0-1)
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  // Check if shorter is contained in longer
  if (longer.includes(shorter)) {
    return shorter.length / longer.length;
  }
  
  // Levenshtein distance for close matches
  const editDistance = getEditDistance(shorter, longer);
  return (longer.length - editDistance) / longer.length;
}

// Simple Levenshtein distance
function getEditDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Patterns that strongly indicate a sequel/franchise entry
const SEQUEL_INDICATORS = [
  // Numbering patterns
  /\b\d+\b/, // Any number
  /\b(ii|iii|iv|v|vi|vii|viii|ix|x)\b/i, // Roman numerals
  /\b(two|three|four|five|six|seven|eight|nine|ten)\b/i, // Written numbers
  
  // Episode/Part patterns
  /\bepisode\s+/i,
  /\bpart\s+/i,
  /\bvolume\s+/i,
  /\bvol\.\s*/i,
  /\bchapter\s+/i,
  /\bseason\s+/i,
  /\bbook\s+/i,
  
  // Sequel/Prequel indicators
  /\b(sequel|prequel|origins?|beginnings?|returns?|reloaded|revolutions?|reborn|rises?|awakens?)\b/i,
  /\b(continues?|conclusion|finale|endgame|infinity|forever|again|another)\b/i,
  
  // Franchise indicators
  /\b(chronicles|saga|trilogy|anthology|collection|legacy|generations?)\b/i,
  
  // Reboot/Remake indicators
  /\b(the\s+)?(new|amazing|incredible|ultimate|spectacular)\b/i,
  
  // Time-based indicators
  /\b(first|last|final|beginning|end)\b/i,
  
  // Subtitle separators that often indicate sequels
  /:\s*(the|a)\s+/i,
];

// Words that, when added to a base title, strongly suggest a sequel
const SEQUEL_SUFFIX_WORDS = new Set([
  'returns', 'reloaded', 'revolutions', 'resurrection', 'requiem',
  'revenge', 'redemption', 'reckoning', 'revelations', 'rising',
  'forever', 'endgame', 'infinity', 'origins', 'beginning',
  'aftermath', 'awakening', 'ascension', 'apocalypse', 'armageddon'
]);

export function isLikelySequelEnhanced(
  recommendationName: string, 
  inputEntities: Array<{name: string, entity_id: string}>
): boolean {
  const recNameLower = recommendationName.toLowerCase();
  
  for (const inputEntity of inputEntities) {
    const inputNameLower = inputEntity.name.toLowerCase();
    
    // Quick exact match check (not a sequel if same name)
    if (recNameLower === inputNameLower) {
      continue;
    }
    
    // 1. Check if recommendation contains the input name
    if (recNameLower.includes(inputNameLower)) {
      // Check for regional variants (not sequels)
      if (/^\s*\([^)]+\)\s*$/.test(recNameLower.replace(inputNameLower, ''))) {
        continue;
      }
      
      // If it contains the input name + anything substantial, likely a sequel
      const remainder = recNameLower.replace(inputNameLower, '').trim();
      if (remainder.length > 3) { // More than just punctuation
        return true;
      }
    }
    
    // 2. Extract franchise cores and compare
    const inputCore = extractFranchiseCore(inputEntity.name);
    const recCore = extractFranchiseCore(recommendationName);
    
    // If cores are very similar (>80% match), check for sequel indicators
    const similarity = calculateSimilarity(inputCore, recCore);
    if (similarity > 0.8) {
      // Check if recommendation has sequel indicators that input doesn't
      for (const pattern of SEQUEL_INDICATORS) {
        if (pattern.test(recNameLower) && !pattern.test(inputNameLower)) {
          return true;
        }
      }
    }
    
    // 3. Check for franchise patterns where core name is shared
    if (recCore === inputCore || recNameLower.includes(inputCore)) {
      // Different full names but same core = likely franchise entry
      if (recNameLower !== inputNameLower) {
        return true;
      }
    }
    
    // 4. Check for sequel suffix words
    const recWords = recNameLower.split(/\s+/);
    const inputWords = new Set(inputNameLower.split(/\s+/));
    
    for (const word of recWords) {
      if (SEQUEL_SUFFIX_WORDS.has(word) && !inputWords.has(word)) {
        // Has a sequel word that wasn't in original
        // Check if there's significant overlap in other words
        const commonWords = recWords.filter(w => inputWords.has(w)).length;
        if (commonWords >= Math.min(2, inputWords.size * 0.5)) {
          return true;
        }
      }
    }
    
    // 5. Smart year detection (e.g., "Blade Runner" -> "Blade Runner 2049")
    const inputYear = inputNameLower.match(/\b(19|20)\d{2}\b/);
    const recYear = recNameLower.match(/\b(19|20)\d{2}\b/);
    
    if (!inputYear && recYear) {
      // Recommendation has a year but input doesn't
      const withoutYear = recNameLower.replace(/\s*\b(19|20)\d{2}\b\s*/, ' ').trim();
      if (calculateSimilarity(withoutYear, inputNameLower) > 0.9) {
        return true;
      }
    }
  }
  
  return false;
}

// Additional helper: Detect if multiple recommendations are from same franchise
export function detectFranchiseCluster(
  recommendations: Array<{name: string, entity_id: string}>, 
  threshold: number = 0.7  // Lower threshold for better detection
): Map<string, string[]> {
  const franchises = new Map<string, string[]>();
  const processed = new Set<number>();
  
  for (let i = 0; i < recommendations.length; i++) {
    if (processed.has(i)) continue;
    
    const core1 = extractFranchiseCore(recommendations[i].name);
    const cluster = [recommendations[i].entity_id];
    processed.add(i);
    
    // Look for other entries that might be in same franchise
    for (let j = i + 1; j < recommendations.length; j++) {
      if (processed.has(j)) continue;
      
      const core2 = extractFranchiseCore(recommendations[j].name);
      const similarity = calculateSimilarity(core1, core2);
      
      // Also check if one contains the other (common in franchises)
      const name1Lower = recommendations[i].name.toLowerCase();
      const name2Lower = recommendations[j].name.toLowerCase();
      const coreContained = name1Lower.includes(core2) || name2Lower.includes(core1);
      
      if (similarity > threshold || coreContained) {
        cluster.push(recommendations[j].entity_id);
        processed.add(j);
      }
    }
    
    // Only keep clusters with 2+ members
    if (cluster.length >= 2) {
      franchises.set(core1, cluster);
    }
  }
  
  return franchises;
}

// Export the enhanced version as the default
export const isLikelySequel = isLikelySequelEnhanced;