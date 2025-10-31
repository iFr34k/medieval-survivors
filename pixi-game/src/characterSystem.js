// --- Character System ---
// Manages playable characters and their stat progression

export class CharacterSystem {
  constructor(modifierSystem) {
    this.modifierSystem = modifierSystem;
    this.selectedCharacter = 'Knight';
    this.currentLevel = 1; // Track current level for growth calculation
    
    // Character configurations
    this.characterConfigs = {
      Knight: {
        name: 'Knight',
        startingWeapon: 'Sword',
        baseStats: {
          maxHP: 50,
          armor: 0,
          damageReduction: 0,
          moveSpeed: 1.0,
          pickupRange: 1.0,
          xpGain: 1.0,
          luck: 0
        },
        perLevelGrowth: {
          maxHP: 0.01,        // +1% HP per level
          damageReduction: 0.01  // +1% damage reduction per level (capped at 50%)
        },
        maxDamageReductionCap: 0.50  // 50% cap for Knight's unique damage reduction
      }
      // Future characters can be added here
    };
  }

  // Get base stats for a character (without modifiers or growth)
  getBaseStats(characterName = this.selectedCharacter) {
    const config = this.characterConfigs[characterName];
    if (!config) {
      console.warn(`CharacterSystem: Unknown character "${characterName}"`);
      return null;
    }
    return { ...config.baseStats };
  }

  // Apply level growth modifiers
  applyLevelGrowth(level, characterName = this.selectedCharacter) {
    const config = this.characterConfigs[characterName];
    if (!config) {
      console.warn(`CharacterSystem: Unknown character "${characterName}"`);
      return;
    }

    // Remove previous level growth modifiers (from previous level)
    if (this.currentLevel > 1) {
      Object.keys(config.perLevelGrowth).forEach(stat => {
        const growthPerLevel = config.perLevelGrowth[stat];
        const previousTotalGrowth = growthPerLevel * (this.currentLevel - 1);
        
        if (stat === 'damageReduction' && config.maxDamageReductionCap !== undefined) {
          const previousCappedGrowth = Math.min(previousTotalGrowth, config.maxDamageReductionCap);
          this.modifierSystem.removeModifier(stat, 'mult', previousCappedGrowth);
        } else {
          this.modifierSystem.removeModifier(stat, 'mult', previousTotalGrowth);
        }
      });
    }
    
    // Apply new level growth modifiers
    Object.keys(config.perLevelGrowth).forEach(stat => {
      const growthPerLevel = config.perLevelGrowth[stat];
      const totalGrowth = growthPerLevel * level; // Cumulative growth
      
      // Check for caps
      if (stat === 'damageReduction' && config.maxDamageReductionCap !== undefined) {
        const cappedGrowth = Math.min(totalGrowth, config.maxDamageReductionCap);
        // Apply as multiplicative modifier
        this.modifierSystem.addModifier(stat, 'mult', cappedGrowth);
      } else {
        // Apply as multiplicative modifier
        this.modifierSystem.addModifier(stat, 'mult', totalGrowth);
      }
    });
    
    // Update current level
    this.currentLevel = level;
  }

  // Get final stats for a character at a specific level (after modifiers)
  getFinalStats(level = 1, characterName = this.selectedCharacter) {
    const baseStats = this.getBaseStats(characterName);
    if (!baseStats) return null;

    // Apply level growth first (this modifies the modifier system)
    // Note: In practice, level growth should be tracked separately per level
    // For now, we'll compute final values using the modifier system
    
    const finalStats = {};
    Object.keys(baseStats).forEach(stat => {
      finalStats[stat] = this.modifierSystem.getFinalStat(stat, baseStats[stat]);
    });
    
    return finalStats;
  }

  // Set selected character (for future character selection)
  setCharacter(characterName) {
    if (!this.characterConfigs[characterName]) {
      console.warn(`CharacterSystem: Unknown character "${characterName}"`);
      return false;
    }
    this.selectedCharacter = characterName;
    return true;
  }

  // Get selected character
  getSelectedCharacter() {
    return this.selectedCharacter;
  }

  // Get starting weapon name for selected character
  getStartingWeapon() {
    const config = this.characterConfigs[this.selectedCharacter];
    return config ? config.startingWeapon : null;
  }

  // Reset character system (for new game)
  reset() {
    // Reset modifier system (which will clear all modifiers)
    // Note: Character selection persists, but modifiers are cleared
    this.modifierSystem.reset();
    this.currentLevel = 1;
  }
}

