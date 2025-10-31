// --- Level System ---
// Manages player XP, levels, and level-up calculations

export class LevelSystem {
  constructor() {
    this.level = 1;
    this.currentXP = 0;
    this.baseXP = 50; // Base XP for level 1 (scaled x10 to match damage/health scaling)
    this.xpExponent = 1.75; // Exponential growth factor (steeper curve)
  }
  
  // Calculate XP required for a specific level
  getXPForLevel(level) {
    if (level <= 1) return 0;
    return Math.floor(this.baseXP * Math.pow(level - 1, this.xpExponent));
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



