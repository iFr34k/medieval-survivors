// --- Item System ---
// Handles non-weapon items that modify player stats

export class ItemSystem {
  constructor(modifierSystem) {
    this.modifierSystem = modifierSystem;
    
    // Track owned items with their upgrade levels
    this.ownedItems = {}; // { itemName: { level: number, config: {...} } }
    
    // Item configurations
    this.itemConfigs = {
      'ScholarsTomb': {
        name: "Scholar's Tomb",
        description: "Ancient tome that grants insight.",
        iconTexture: null, // Can be set later if texture available
        type: 'passive',
        baseEffect: {
          stat: 'xpGain',
          type: 'mult',
          value: 0.05  // +5% XP Gain
        },
        upgradeScaling: {
          // Each upgrade adds the same base effect multiplied by rarity
          stat: 'xpGain',
          type: 'mult',
          baseValue: 0.05  // +5% per upgrade
        }
      }
      // Future items can be added here
    };
  }

  // Add an item to the player's inventory
  addItem(itemName) {
    const config = this.itemConfigs[itemName];
    if (!config) {
      console.warn(`ItemSystem: Unknown item "${itemName}"`);
      return false;
    }
    
    // If item already owned, increment level
    if (this.ownedItems[itemName]) {
      this.ownedItems[itemName].level += 1;
    } else {
      // New item - initialize it
      this.ownedItems[itemName] = {
        level: 1,
        config: config
      };
    }
    
    // Apply base effect on first acquisition
    if (this.ownedItems[itemName].level === 1) {
      this.modifierSystem.addModifier(
        config.baseEffect.stat,
        config.baseEffect.type,
        config.baseEffect.value
      );
    }
    
    console.log(`📦 Item added: ${config.name} (Level ${this.ownedItems[itemName].level})`);
    return true;
  }

  // Upgrade an existing item
  upgradeItem(itemName, rarity = 'Common') {
    if (!this.ownedItems[itemName]) {
      console.warn(`ItemSystem: Cannot upgrade unowned item "${itemName}"`);
      return false;
    }
    
    const item = this.ownedItems[itemName];
    const config = item.config;
    
    // Per-item rarity multipliers (custom scaling per item)
    const itemRarityValues = {
      'ScholarsTomb': {
        'Common': 0.025,      // +2.5% XP Gain
        'Uncommon': 0.05,      // +5% XP Gain
        'Rare': 0.075,         // +7.5% XP Gain
        'Epic': 0.10,          // +10% XP Gain
        'Legendary': 0.15      // +15% XP Gain
      }
      // Future items can be added here
    };
    
    // Get upgrade value for this item and rarity
    let upgradeValue;
    if (itemRarityValues[itemName] && itemRarityValues[itemName][rarity] !== undefined) {
      upgradeValue = itemRarityValues[itemName][rarity];
    } else {
      // Fallback to old system for items not in the custom list
      const rarityMultipliers = {
        'Common': 0.05,
        'Uncommon': 0.10,
        'Rare': 0.20,
        'Epic': 0.35,
        'Legendary': 0.50
      };
      const rarityMultiplier = rarityMultipliers[rarity] || 0.05;
      upgradeValue = config.upgradeScaling.baseValue * (1 + rarityMultiplier);
    }
    
    // Apply upgrade modifier
    this.modifierSystem.addModifier(
      config.upgradeScaling.stat,
      config.upgradeScaling.type,
      upgradeValue
    );
    
    item.level += 1;
    console.log(`⬆️ Item upgraded: ${config.name} (Level ${item.level}) - +${(upgradeValue * 100).toFixed(1)}% XP Gain`);
    return true;
  }

  // Get owned items
  getOwnedItems() {
    return { ...this.ownedItems };
  }

  // Get item configuration
  getItemConfig(itemName) {
    return this.itemConfigs[itemName];
  }

  // Check if item is owned
  isOwned(itemName) {
    return !!this.ownedItems[itemName];
  }

  // Reset item system (for new game)
  reset() {
    // Remove all item modifiers
    Object.keys(this.ownedItems).forEach(itemName => {
      const item = this.ownedItems[itemName];
      const config = item.config;
      
      // Remove base effect
      this.modifierSystem.removeModifier(
        config.baseEffect.stat,
        config.baseEffect.type,
        config.baseEffect.value
      );
      
      // Remove upgrade effects (simplified - would need to track each upgrade separately)
      // For now, we'll just reset and let items be re-acquired
    });
    
    this.ownedItems = {};
  }
}

