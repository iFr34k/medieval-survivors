// --- Character System ---
// Manages playable characters and their stat progression

export class CharacterSystem {
  constructor(modifierSystem) {
    this.modifierSystem = modifierSystem;
    this.selectedCharacter = 'Knight';

    this.characterConfigs = {
      Knight: {
        name: 'Knight',
        startingWeapon: 'Sword',
        baseStats: {
          maxHP: 100,
          armor: 0,
          damageReduction: 0,
          moveSpeed: 1.0,
          pickupRange: 80,
          xpGain: 1.0,
          luck: 0
        },
        perLevelGrowth: {
          maxHP: 0.01,
          damageReduction: 0.01
        },
        maxDamageReductionCap: 0.50
      },
      Ranger: {
        name: 'Ranger',
        startingWeapon: 'Longbow',
        baseStats: {
          maxHP: 50,
          armor: 0,
          damageReduction: 0,
          moveSpeed: 1.5,
          pickupRange: 120,
          xpGain: 1.0,
          luck: 5
        },
        perLevelGrowth: {},
        customPerLevelGrowth: (level) => {
          const effectiveLevels = Math.max(level - 1, 0);
          const critLevels = Math.min(effectiveLevels, 50);

          return {
            critChanceBonus: critLevels * 0.01,
            globalDamageMultiplier: effectiveLevels * 0.01
          };
        }
      }
    };

    this.currentLevels = {};
    Object.keys(this.characterConfigs).forEach(name => {
      this.currentLevels[name] = 1;
    });
  }

  getBaseStats(characterName = this.selectedCharacter) {
    const config = this.characterConfigs[characterName];
    if (!config) {
      console.warn(`CharacterSystem: Unknown character "${characterName}"`);
      return null;
    }
    return { ...config.baseStats };
  }

  applyLevelGrowth(level, characterName = this.selectedCharacter) {
    const config = this.characterConfigs[characterName];
    if (!config) {
      console.warn(`CharacterSystem: Unknown character "${characterName}"`);
      return;
    }

    const previousLevel = this.currentLevels[characterName] || 1;
    const prevGrowthLevels = Math.max(previousLevel - 1, 0);
    const newGrowthLevels = Math.max(level - 1, 0);

    Object.keys(config.perLevelGrowth).forEach(stat => {
      const growthPerLevel = config.perLevelGrowth[stat];
      const previousTotalGrowth = growthPerLevel * prevGrowthLevels;

      if (previousTotalGrowth !== 0) {
        if (stat === 'damageReduction' && config.maxDamageReductionCap !== undefined) {
          const previousCappedGrowth = Math.min(previousTotalGrowth, config.maxDamageReductionCap);
          this.modifierSystem.removeModifier(stat, 'mult', previousCappedGrowth);
        } else {
          this.modifierSystem.removeModifier(stat, 'mult', previousTotalGrowth);
        }
      }
    });

    Object.keys(config.perLevelGrowth).forEach(stat => {
      const growthPerLevel = config.perLevelGrowth[stat];
      const totalGrowth = growthPerLevel * newGrowthLevels;

      if (totalGrowth !== 0) {
        if (stat === 'damageReduction' && config.maxDamageReductionCap !== undefined) {
          const cappedGrowth = Math.min(totalGrowth, config.maxDamageReductionCap);
          this.modifierSystem.addModifier(stat, 'mult', cappedGrowth);
        } else {
          this.modifierSystem.addModifier(stat, 'mult', totalGrowth);
        }
      }
    });

    if (typeof config.customPerLevelGrowth === 'function') {
      const previousCustomGrowth = config.customPerLevelGrowth(previousLevel);
      const newCustomGrowth = config.customPerLevelGrowth(level);

      this.applyCustomGrowth(previousCustomGrowth, 'remove');
      this.applyCustomGrowth(newCustomGrowth, 'add');
    }

    this.currentLevels[characterName] = level;
  }

  getFinalStats(level = 1, characterName = this.selectedCharacter) {
    const baseStats = this.getBaseStats(characterName);
    if (!baseStats) return null;

    const finalStats = {};
    Object.keys(baseStats).forEach(stat => {
      finalStats[stat] = this.modifierSystem.getFinalStat(stat, baseStats[stat]);
    });

    return finalStats;
  }

  setCharacter(characterName) {
    if (!this.characterConfigs[characterName]) {
      console.warn(`CharacterSystem: Unknown character "${characterName}"`);
      return false;
    }
    this.selectedCharacter = characterName;
    return true;
  }

  getSelectedCharacter() {
    return this.selectedCharacter;
  }

  getStartingWeapon() {
    const config = this.characterConfigs[this.selectedCharacter];
    return config ? config.startingWeapon : null;
  }

  reset() {
    this.modifierSystem.reset();
    Object.keys(this.currentLevels).forEach(name => {
      this.currentLevels[name] = 1;
    });
  }

  applyCustomGrowth(growthMap, mode = 'add') {
    if (!growthMap) return;

    Object.entries(growthMap).forEach(([key, value]) => {
      if (!value) return;

      const amount = mode === 'add' ? value : -value;

      switch (key) {
        case 'critChanceBonus':
          this.modifierSystem.addGlobalCritChanceBonus(amount);
          break;
        case 'globalDamageMultiplier':
          this.modifierSystem.addGlobalDamageMultiplier(amount);
          break;
        default:
          console.warn(`CharacterSystem: Unknown custom growth stat "${key}"`);
      }
    });
  }
}

