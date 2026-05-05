// --- Level System ---
// Manages player XP, levels, and level-up calculations

export class LevelSystem {
  constructor() {
    this.level = 1;
    this.currentXP = 0;
    this.baseXP = 50; // Starting XP for level 2
    this.xpIncrement = 10; // Base increment per level (doubles every 10 levels)
  }
  
  // Calculate cumulative XP required to reach a specific level
  getXPForLevel(level) {
    if (level <= 1) return 0;
    
    // Sum XP for each level from 2 to target level
    let cumulativeXP = 0;
    let currentLevelXP = this.baseXP; // Start at 50 for level 2
    
    for (let lvl = 2; lvl <= level; lvl++) {
      cumulativeXP += currentLevelXP;
      
      // Increment multiplier: doubles every 10 levels (1-10, 11-20, 21-30, etc.)
      const bracketIndex = Math.floor((lvl - 1) / 10); // 0 for 1-10, 1 for 11-20, etc.
      const bracketMultiplier = Math.pow(2, bracketIndex);
      const currentIncrement = this.xpIncrement * bracketMultiplier;
      
      // Add increment for next level
      currentLevelXP += currentIncrement;
    }
    
    return Math.floor(cumulativeXP);
  }
  
  // Get XP required for next level
  getXPForNextLevel() {
    return this.getXPForLevel(this.level + 1);
  }
  
  // Get current XP progress within current level
  getCurrentLevelXP() {
    const currentLevelStart = this.getXPForLevel(this.level);
    return this.currentXP - currentLevelStart;
  }
  
  // Get XP needed to complete current level
  getXPNeededForCurrentLevel() {
    const currentLevelStart = this.getXPForLevel(this.level);
    const nextLevelStart = this.getXPForLevel(this.level + 1);
    return nextLevelStart - currentLevelStart;
  }
  
  // Add XP and check for level ups
  addXP(amount) {
    this.currentXP += amount;
    const levelsGained = [];
    
    // Check for multiple level ups with XP carryover
    while (this.currentXP >= this.getXPForNextLevel()) {
      this.level++;
      levelsGained.push(this.level);
      console.log(`🎉 Level Up! Now Level ${this.level}`);
    }
    
    return levelsGained;
  }
  
  // Get formatted XP display string
  getXPDisplayText() {
    const currentLevelXP = this.getCurrentLevelXP();
    const neededXP = this.getXPNeededForCurrentLevel();
    return `Level: ${this.level} | XP: ${currentLevelXP}/${neededXP}`;
  }
  
  // Reset to level 1 (for testing or new game)
  reset() {
    this.level = 1;
    this.currentXP = 0;
  }
  
  // Get current stats for debugging
  getStats() {
    return {
      level: this.level,
      currentXP: this.currentXP,
      currentLevelXP: this.getCurrentLevelXP(),
      neededXP: this.getXPNeededForCurrentLevel(),
      nextLevelTotalXP: this.getXPForNextLevel()
    };
  }
}



