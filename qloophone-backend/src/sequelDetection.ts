// Import the enhanced sequel detection
import { isLikelySequelEnhanced, detectFranchiseCluster } from './sequelDetectionEnhanced';

// Re-export the enhanced version as the main function
export const isLikelySequel = isLikelySequelEnhanced;
export { detectFranchiseCluster };

// Keep the original implementation for reference/testing
export function isLikelySequelOriginal(recommendationName: string, inputEntities: Array<{name: string, entity_id: string}>): boolean {
  const recNameLower = recommendationName.toLowerCase();
  
  for (const inputEntity of inputEntities) {
    const inputNameLower = inputEntity.name.toLowerCase();
    
    // Check for common sequel patterns
    // 1. Contains the original name plus a number (e.g., "Dark Souls" -> "Dark Souls II")
    if (recNameLower.includes(inputNameLower) && /\b(2|3|4|5|ii|iii|iv|v)\b/.test(recNameLower)) {
      return true;
    }
    
    // 2. Contains the original name plus common sequel words
    if (recNameLower.includes(inputNameLower) && 
        /\b(part|volume|vol\.|season|chapter)\s*(two|three|four|2|3|4|ii|iii|iv)\b/i.test(recNameLower)) {
      return true;
    }
    
    // 3. Franchise patterns (e.g., "The Terminator" -> "Terminator 2", "Terminator Salvation")
    const franchiseName = inputNameLower.replace(/^the\s+/, ''); // Remove leading "The"
    if (franchiseName !== inputNameLower && recNameLower.includes(franchiseName) && inputNameLower !== recNameLower) {
      // Check if the recommendation just adds a regional disambiguation
      // e.g., "The Office" -> "The Office (US)"
      const pattern = new RegExp(`^${inputNameLower}\\s*\\([^)]+\\)$`);
      if (pattern.test(recNameLower)) {
        continue;
      }
      // For franchises, if the core name is included and it's not the exact same title, it's likely related
      return true;
    }
    
    // 4. Handle subtitle patterns where the original is included
    if (recNameLower.startsWith(inputNameLower) && recNameLower.length > inputNameLower.length) {
      // Extract what comes after the base name
      const remainder = recommendationName.substring(inputEntity.name.length).trim();
      
      // Skip if it's just a region/disambiguation in parentheses like "(US)" or "(2020)"
      if (/^\([^)]+\)$/.test(remainder)) {
        continue;
      }
      
      // If it has a colon or dash followed by subtitle, it's likely a sequel
      if (/^[:–\-]/.test(remainder)) {
        return true;
      }
      
      // If it starts with "and the" or similar connectors, it's likely a sequel in a series
      if (/^and the/i.test(remainder)) {
        return true;
      }
      
      // If it contains sequel indicators, it's a sequel
      if (/\b(season|part|chapter|volume|2|3|4|5|ii|iii|iv|v)\b/i.test(remainder)) {
        return true;
      }
    }
  }
  
  return false;
}