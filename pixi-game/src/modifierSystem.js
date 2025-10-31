// --- Modifier System ---
// Centralized stat modifier system for additive and multiplicative modifiers

export class ModifierSystem {
  constructor() {
    // Additive modifiers (flat values added to base)
    this.addMods = {
      maxHP: 0,
      armor: 0,
      damageReduction: 0,
      moveSpeed: 0,
      pickupRange: 0,
      xpGain: 0,
      luck: 0,
      // Weapon stats
      damage: 0,
      piercing: 0,
      projectileSpeed: 0,
      projectileSize: 0,
      critChance: 0,
      knockback: 0
    };
    
    // Multiplicative modifiers (percentages applied to base)
    this.multMods = {
      maxHP: 0,
      armor: 0,
      damageReduction: 0,
      moveSpeed: 0,
      pickupRange: 0,
      xpGain: 0,
      luck: 0,
      // Weapon stats
      damage: 0,
      attackSpeed: 0, // Negative values = faster attacks
      range: 0,
      piercing: 0,
      projectileSpeed: 0,
      projectileSize: 0,
      critChance: 0,
      critDamage: 0,
      knockback: 0
    };
  }

  // Add a modifier (additive or multiplicative)
  addModifier(stat, type, value) {
    if (!this.addMods.hasOwnProperty(stat) && !this.multMods.hasOwnProperty(stat)) {
      console.warn(`ModifierSystem: Unknown stat "${stat}"`);
      return;
    }
    
    if (type === 'add') {
      if (this.addMods.hasOwnProperty(stat)) {
        this.addMods[stat] += value;
      } else {
        console.warn(`ModifierSystem: Stat "${stat}" does not support additive modifiers`);
      }
    } else if (type === 'mult') {
      if (this.multMods.hasOwnProperty(stat)) {
        this.multMods[stat] += value;
      } else {
        console.warn(`ModifierSystem: Stat "${stat}" does not support multiplicative modifiers`);
      }
    } else {
      console.warn(`ModifierSystem: Invalid modifier type "${type}". Use 'add' or 'mult'`);
    }
  }

  // Remove a modifier
  removeModifier(stat, type, value) {
    if (type === 'add') {
      if (this.addMods.hasOwnProperty(stat)) {
        this.addMods[stat] -= value;
      }
    } else if (type === 'mult') {
      if (this.multMods.hasOwnProperty(stat)) {
        this.multMods[stat] -= value;
      }
    }
  }

  // Get final stat value after applying all modifiers
  getFinalStat(stat, baseValue) {
    let finalValue = baseValue;
    
    // Apply additive modifiers first
    if (this.addMods.hasOwnProperty(stat)) {
      finalValue += this.addMods[stat];
    }
    
    // Then apply multiplicative modifiers
    if (this.multMods.hasOwnProperty(stat)) {
      finalValue = finalValue * (1 + this.multMods[stat]);
    }
    
    return finalValue;
  }

  // Reset all modifiers (for new game)
  reset() {
    Object.keys(this.addMods).forEach(key => {
      this.addMods[key] = 0;
    });
    Object.keys(this.multMods).forEach(key => {
      this.multMods[key] = 0;
    });
  }

  // Get current modifier values for debugging
  getModifiers() {
    return {
      additive: { ...this.addMods },
      multiplicative: { ...this.multMods }
    };
  }
}

