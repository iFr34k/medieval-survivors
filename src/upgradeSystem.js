// --- Upgrade System ---
// Handles level-up upgrades with rarity, luck, and unlock support

export class UpgradeSystem {
  constructor(weaponSystem, itemSystem, modifierSystem) {
    this.weaponSystem = weaponSystem;
    this.itemSystem = itemSystem;
    this.modifierSystem = modifierSystem;
    
    this.testingMode = false;
    this.upgradeMultiplier = 1.0; // Multiplier for testing mode (10x boost)
    
    // Rarity system
    this.rarities = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
    this.rarityColors = {
      'Common': '#808080',      // Gray
      'Uncommon': '#00FF00',     // Green
      'Rare': '#0080FF',         // Blue
      'Epic': '#A020F0',         // Purple
      'Legendary': '#FFD700'     // Gold
    };
    
    // Rarity multipliers (for upgrade values)
    this.rarityMultipliers = {
      'Common': 0.05,      // +5%
      'Uncommon': 0.10,     // +10%
      'Rare': 0.20,         // +20%
      'Epic': 0.35,         // +35%
      'Legendary': 0.50     // +50%
    };
  }

  toggleTestingMode() {
    this.testingMode = !this.testingMode;
    this.upgradeMultiplier = this.testingMode ? 10.0 : 1.0;
    console.log(`🧪 Testing Mode ${this.testingMode ? 'ENABLED' : 'DISABLED'} - Upgrade multiplier: ${this.upgradeMultiplier}x`);
    return this.testingMode;
  }

  // Get rarity multiplier for upgrade value calculation
  getRarityMultiplier(rarity) {
    return this.rarityMultipliers[rarity] || 0.05;
  }

  // Calculate rarity based on luck with bracket system
  calculateRarity(luck = 0) {
    // Base weights at 0 luck: Common, Uncommon, Rare, Epic, Legendary
    // Legendary starts at 0.1% instead of 0%
    
    // Bracket system:
    // 0-10 luck: Uncommon peaks at 10
    // 10-20 luck: Rare peaks at 20
    // 20-30 luck: Epic peaks at 30
    // 30+ luck: Legendary weighted highest
    
    let weights = [0, 0, 0, 0, 0]; // [Common, Uncommon, Rare, Epic, Legendary]
    
    if (luck <= 10) {
      // Bracket 1: 0-10 luck (Uncommon peaks)
      // Only Common decreases, all others increase
      const t = luck / 10; // 0 to 1 progression
      weights = [
        70 - (t * 40),           // Common: 70% → 30% (only one that decreases)
        20 + (t * 25),           // Uncommon: 20% → 45% (peaks)
        8 + (t * 7),             // Rare: 8% → 15% (increases)
        2 + (t * 6),             // Epic: 2% → 8% (increases)
        0.1 + (t * 1.9)          // Legendary: 0.1% → 2% (increases)
      ];
    } else if (luck <= 20) {
      // Bracket 2: 10-20 luck (Rare peaks)
      // Only Common and Uncommon decrease, others increase
      const t = (luck - 10) / 10;
      weights = [
        30 - (t * 20),           // Common: 30% → 10% (decreases)
        45 - (t * 25),           // Uncommon: 45% → 20% (decreases, peaked in bracket 1)
        15 + (t * 30),           // Rare: 15% → 45% (peaks)
        8 + (t * 7),             // Epic: 8% → 15% (increases)
        2 + (t * 8)              // Legendary: 2% → 10% (increases)
      ];
    } else if (luck <= 30) {
      // Bracket 3: 20-30 luck (Epic peaks)
      // Only Common, Uncommon, and Rare decrease, Epic and Legendary increase
      const t = (luck - 20) / 10;
      weights = [
        10 - (t * 7),            // Common: 10% → 3% (decreases)
        20 - (t * 10),           // Uncommon: 20% → 10% (decreases)
        45 - (t * 25),           // Rare: 45% → 20% (decreases, peaked in bracket 2)
        15 + (t * 25),           // Epic: 15% → 40% (peaks)
        10 + (t * 17)            // Legendary: 10% → 27% (increases)
      ];
    } else {
      // Bracket 4: 30+ luck (Legendary dominant)
      // All can decrease except Legendary
      const t = Math.min((luck - 30) / 20, 1); // 30-50 progression, capped
      weights = [
        3 - (t * 1),             // Common: 3% → 2%
        10 - (t * 5),            // Uncommon: 10% → 5%
        20 - (t * 10),           // Rare: 20% → 10%
        40 - (t * 17),           // Epic: 40% → 23%
        27 + (t * 33)            // Legendary: 27% → 60%
      ];
    }
    
    // Normalize weights to sum to 100
    const total = weights.reduce((sum, w) => sum + w, 0);
    const normalized = weights.map(w => w / total);
    
    // Random selection
    const rand = Math.random();
    let cumulative = 0;
    for (let i = 0; i < this.rarities.length; i++) {
      cumulative += normalized[i];
      if (rand <= cumulative) {
        return this.rarities[i];
      }
    }
    
    return 'Common'; // Fallback
  }

  // Calculate number of upgrade cards based on luck
  calculateCardCount(luck = 0) {
    const baseCards = 3;
    const additionalCards = Math.floor(luck / 2); // +1 card per 2 luck
    const totalCards = baseCards + additionalCards;
    return Math.min(totalCards, 8); // Hard cap at 8
  }

  // Generate upgrade cards with rarity and luck weighting
  generateUpgradeCards(weapons, items = [], luck = 0, playerLevel = 1) {
    const cardCount = this.calculateCardCount(luck);
    const allUpgrades = [];
    
    // Weapon upgrades
    weapons.forEach(weapon => {
      // Damage - will be set by rarity system (Common: 10%)
      allUpgrades.push({
        id: `upgrade_${weapon.name.toLowerCase()}_damage`,
        type: 'weapon',
        target: weapon.name,
        targetWeapon: weapon,
        effect: { stat: 'damage', type: 'mult', value: 0.10 }, // Placeholder, will be overridden by rarity
        displayName: 'Damage +',
        description: '' // Will be filled with percentage after rarity calculation
      });
      
      // Attack Speed - will be set by rarity system (Common: 10%)
      allUpgrades.push({
        id: `upgrade_${weapon.name.toLowerCase()}_attackSpeed`,
        type: 'weapon',
        target: weapon.name,
        targetWeapon: weapon,
        effect: { stat: 'attackSpeed', type: 'mult', value: -0.10 }, // Placeholder, will be overridden by rarity
        displayName: 'Attack Speed +',
        description: '' // Will be filled with percentage after rarity calculation
      });
      
      // Knockback - will be set by rarity system (Common: 10%)
      allUpgrades.push({
        id: `upgrade_${weapon.name.toLowerCase()}_knockback`,
        type: 'weapon',
        target: weapon.name,
        targetWeapon: weapon,
        effect: { stat: 'knockback', type: 'mult', value: 0.10 }, // Placeholder, will be overridden by rarity
        displayName: 'Knockback +',
        description: '' // Will be filled with percentage after rarity calculation
      });
      
      // Range - will be set by rarity system (Common: 5%)
      allUpgrades.push({
        id: `upgrade_${weapon.name.toLowerCase()}_range`,
        type: 'weapon',
        target: weapon.name,
        targetWeapon: weapon,
        effect: { stat: 'range', type: 'mult', value: 0.05 }, // Placeholder, will be overridden by rarity
        displayName: 'Range +',
        description: '' // Will be filled with percentage after rarity calculation
      });
      
      // Projectile Size - will be set by rarity system (Common: 10%)
      allUpgrades.push({
        id: `upgrade_${weapon.name.toLowerCase()}_projectileSize`,
        type: 'weapon',
        target: weapon.name,
        targetWeapon: weapon,
        effect: { stat: 'projectileSize', type: 'mult', value: 0.10 }, // Placeholder, will be overridden by rarity
        displayName: 'Projectile Size +',
        description: '' // Will be filled with percentage after rarity calculation
      });
      
      // Projectile Speed removed - not a sword stat
      
      // Critical Chance - will be set by rarity system (Common: 2.5%)
      allUpgrades.push({
        id: `upgrade_${weapon.name.toLowerCase()}_critChance`,
        type: 'weapon',
        target: weapon.name,
        targetWeapon: weapon,
        effect: { stat: 'critChance', type: 'add', value: 0.025 }, // Placeholder, will be overridden by rarity
        displayName: 'Crit Chance +',
        description: '' // Will be filled with percentage after rarity calculation
      });
      
      // Critical Damage - will be set by rarity system (Common: 15%)
      allUpgrades.push({
        id: `upgrade_${weapon.name.toLowerCase()}_critDamage`,
        type: 'weapon',
        target: weapon.name,
        targetWeapon: weapon,
        effect: { stat: 'critDamage', type: 'mult', value: 0.15 }, // Placeholder, will be overridden by rarity
        displayName: 'Crit Damage +',
        description: '' // Will be filled with percentage after rarity calculation
      });
      
      // Piercing - will be set by rarity system (Common: +1)
      allUpgrades.push({
        id: `upgrade_${weapon.name.toLowerCase()}_piercing`,
        type: 'weapon',
        target: weapon.name,
        targetWeapon: weapon,
        effect: { stat: 'piercing', type: 'add', value: 1 }, // Placeholder, will be overridden by rarity
        displayName: 'Piercing +',
        description: '' // Will be filled with value after rarity calculation
      });
      
      // Multi-Shot removed - not applicable to sword
    });
    
    // Per-item rarity values (custom scaling per item)
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
    
    // Item upgrades (for owned items)
    Object.keys(items).forEach(itemName => {
      const item = items[itemName];
      allUpgrades.push({
        id: `upgrade_${itemName.toLowerCase()}`,
        type: 'item',
        target: itemName,
        targetItem: item,
        effect: item.config.upgradeScaling,
        displayName: `${item.config.name} +`,
        description: '', // Will be filled with percentage after rarity calculation
        itemRarityValues: itemRarityValues[itemName] || null // Include item-specific rarity values
      });
    });
    
    // Unlock upgrades (new weapons/items) - red border
    // For now, only Scholar's Tomb is unlockable
    if (!items['ScholarsTomb']) {
      const scholarsTombConfig = this.itemSystem.getItemConfig('ScholarsTomb');
      allUpgrades.push({
        id: 'unlock_scholarstomb',
        type: 'unlock',
        target: 'ScholarsTomb',
        effect: null,
        displayName: 'Scholar\'s Tomb',
        description: 'Unlock: +5% XP Gain',
        borderColor: '#FF0000', // Red for unlocks
        iconTexture: scholarsTombConfig ? scholarsTombConfig.iconTexture : null // Include icon for unlock cards
      });
    }
    
    // Per-stat rarity multipliers (custom scaling per stat)
    const statRarityMultipliers = {
      'damage': { Common: 0.20, Uncommon: 0.40, Rare: 0.60, Epic: 0.80, Legendary: 1.00 }, // 20%, 40%, 60%, 80%, 100%
      'attackSpeed': { Common: 0.05, Uncommon: 0.10, Rare: 0.15, Epic: 0.20, Legendary: 0.25 }, // 5%, 10%, 15%, 20%, 25%
      'knockback': { Common: 0.05, Uncommon: 0.10, Rare: 0.15, Epic: 0.20, Legendary: 0.25 }, // 5%, 10%, 15%, 20%, 25%
      'range': { Common: 0.05, Uncommon: 0.10, Rare: 0.15, Epic: 0.20, Legendary: 0.25 }, // 5%, 10%, 15%, 20%, 25%
      'projectileSize': { Common: 0.10, Uncommon: 0.15, Rare: 0.20, Epic: 0.25, Legendary: 0.30 }, // 10%, 15%, 20%, 25%, 30%
      'critChance': { Common: 0.025, Uncommon: 0.05, Rare: 0.075, Epic: 0.10, Legendary: 0.15 }, // 2.5%, 5%, 7.5%, 10%, 15%
      'critDamage': { Common: 0.15, Uncommon: 0.20, Rare: 0.25, Epic: 0.30, Legendary: 0.40 }, // 15%, 20%, 25%, 30%, 40%
      'piercing': { Common: 1.0, Uncommon: 1.2, Rare: 1.5, Epic: 1.7, Legendary: 2.0 }, // Flat values
    };
    
    // Assign rarity to each upgrade and calculate final descriptions with percentages
    const upgradesWithRarity = allUpgrades.map(upgrade => {
      const rarity = this.calculateRarity(luck);
      
      // Apply rarity multiplier to upgrade effect value
      const upgradedEffect = { ...upgrade.effect };
      let finalDescription = upgrade.description;
      
      // Normalize baseValue to value for items
      if (upgradedEffect && upgradedEffect.baseValue !== undefined && upgradedEffect.value === undefined) {
        upgradedEffect.value = upgradedEffect.baseValue;
      }
      
      if (upgradedEffect && upgradedEffect.value !== undefined && upgradedEffect.stat) {
        const stat = upgradedEffect.stat;
        const baseValue = upgradedEffect.value;
        
        // Check if this is an item upgrade with custom rarity values
        if (upgrade.type === 'item' && upgrade.itemRarityValues && upgrade.itemRarityValues[rarity] !== undefined) {
          // Use custom rarity value for this item
          upgradedEffect.value = upgrade.itemRarityValues[rarity];
          const percentage = upgradedEffect.value * 100;
          const displayValue = percentage % 1 === 0 ? Math.round(percentage) : percentage.toFixed(1);
          finalDescription = `+${displayValue}% XP Gain`;
        }
        // Check if this stat has custom rarity multipliers (for weapons)
        else if (statRarityMultipliers[stat] && statRarityMultipliers[stat][rarity] !== undefined) {
          // Use custom rarity value for this stat
          if (stat === 'piercing') {
            // Piercing uses flat values
            upgradedEffect.value = statRarityMultipliers[stat][rarity];
          } else if (upgradedEffect.type === 'add' || upgradedEffect.type === 'flat') {
            // For additive stats like critChance
            upgradedEffect.value = statRarityMultipliers[stat][rarity];
          } else {
            // For multiplicative stats
            const targetValue = statRarityMultipliers[stat][rarity];
            
            if (stat === 'attackSpeed') {
              // Attack speed is negative (faster = lower cooldown)
              upgradedEffect.value = -targetValue;
            } else {
              upgradedEffect.value = targetValue;
            }
          }
        } else {
          // Fallback to old system for stats not in the custom list
          const rarityMultiplier = this.getRarityMultiplier(rarity);
          upgradedEffect.value = baseValue * (1 + rarityMultiplier);
        }
        
        // Generate description with percentage (rounded to whole numbers or 1 decimal for crit chance)
        // Only generate if description wasn't already set (e.g., by item custom values)
        if (finalDescription === '' && upgradedEffect.value !== undefined) {
          if (upgradedEffect.type === 'mult' || upgradedEffect.type === 'percentage') {
            const percentage = Math.abs(upgradedEffect.value) * 100;
            const roundedPercentage = Math.round(percentage);
            
            // Map stat names to display names
            const statDisplayNames = {
              'damage': 'Damage',
              'attackSpeed': 'Attack Speed',
              'range': 'Range',
              'projectileSize': 'Projectile Size',
              'critDamage': 'Critical Damage',
              'xpGain': 'XP Gain'
            };
            
            const displayName = statDisplayNames[upgradedEffect.stat] || upgradedEffect.stat;
            finalDescription = `+${roundedPercentage}% ${displayName}`;
          } else if (upgradedEffect.type === 'add' || upgradedEffect.type === 'flat') {
            if (upgradedEffect.stat === 'critChance') {
              const percentage = upgradedEffect.value * 100;
              // Show 1 decimal for crit chance (2.5%, 7.5%)
              const displayValue = percentage % 1 === 0 ? Math.round(percentage) : percentage.toFixed(1);
              finalDescription = `+${displayValue}% Critical Chance`;
            } else if (upgradedEffect.stat === 'piercing') {
              // Show 1 decimal for piercing if not whole number
              const displayValue = upgradedEffect.value % 1 === 0 ? Math.round(upgradedEffect.value) : upgradedEffect.value.toFixed(1);
              finalDescription = `+${displayValue} Piercing`;
            } else if (upgradedEffect.stat === 'projectileCount') {
              finalDescription = `+${Math.round(upgradedEffect.value)} Projectile`;
            } else {
              finalDescription = `+${Math.round(upgradedEffect.value)}`;
            }
          }
        }
        
        // Fallback: if description is still empty, generate a generic one
        if (finalDescription === '' && upgradedEffect && upgradedEffect.stat) {
          const statName = upgradedEffect.stat.charAt(0).toUpperCase() + upgradedEffect.stat.slice(1).replace(/([A-Z])/g, ' $1');
          finalDescription = `Upgrade ${statName}`;
        }
      }
      
      return {
        ...upgrade,
        rarity: rarity,
        borderColor: upgrade.borderColor || this.rarityColors[rarity],
        effect: upgradedEffect,
        description: finalDescription,
        level: upgrade.type === 'weapon' && upgrade.targetWeapon ? upgrade.targetWeapon.level : undefined
      };
    });
    
    // Select random upgrades
    const shuffled = [...upgradesWithRarity].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, cardCount);
    
    return selected;
  }

  // Apply an upgrade
  applyUpgrade(upgradeData) {
    const { type, target, effect, rarity = 'Common' } = upgradeData;
    
    if (type === 'weapon') {
      // Find weapon by name
      const weapon = upgradeData.targetWeapon;
      if (!weapon) {
        console.warn(`UpgradeSystem: Weapon "${target}" not found`);
        return null;
      }
      
      // Apply upgrade via WeaponSystem
      // Effect structure: { stat, type, value }
      console.log(`📝 Applying weapon upgrade: ${effect.stat}, type: ${effect.type}, value: ${effect.value}, rarity: ${rarity}`);
      console.log(`   Before upgrade - damage: ${weapon.damage}, attackSpeed: ${weapon.attackSpeed}, range: ${weapon.range}`);
      
      const upgradeObj = {
        stat: effect.stat,  // Use 'stat' to be consistent
        type: effect.type,
        value: effect.value
      };
      const result = this.weaponSystem.applyUpgrade(weapon, upgradeObj, rarity);
      
      if (result) {
        console.log(`   After upgrade - damage: ${weapon.damage}, attackSpeed: ${weapon.attackSpeed}, range: ${weapon.range}`);
      }
      
      return result;
      
    } else if (type === 'item') {
      // Apply item upgrade via ItemSystem
      const result = this.itemSystem.upgradeItem(target, rarity);
      return result;
      
    } else if (type === 'unlock') {
      // Unlock new weapon/item
      if (target === 'ScholarsTomb') {
        this.itemSystem.addItem('ScholarsTomb');
        return { unlocked: 'ScholarsTomb' };
      }
      
      // Future unlocks can be added here
      console.warn(`UpgradeSystem: Unknown unlock "${target}"`);
      return null;
    }
    
    console.warn(`UpgradeSystem: Unknown upgrade type "${type}"`);
    return null;
  }
}

// --- Upgrade Card UI ---
// Visual representation of an upgrade option
export class UpgradeCard {
  constructor(cardData, x, y, width, height) {
    this.cardData = cardData;
    this.container = new PIXI.Container();
    this.container.position.set(x, y);
    this.container.interactive = true;
    this.container.cursor = 'pointer';
    
    // Determine border color based on rarity or unlock
    const borderColor = cardData.borderColor || cardData.rarityColor || '#555555';
    const borderColorHex = parseInt(borderColor.replace('#', ''), 16);
    
    // Card background
    const bg = new PIXI.Graphics();
    bg.rect(0, 0, width, height)
      .fill(0x2a2a2a)
      .stroke({ color: borderColorHex, width: 3 }); // Rarity-colored border
    this.container.addChild(bg);
    
    // Icon/Sprite centered in background
    let iconSprite = null;
    if (cardData.type === 'weapon' && cardData.targetWeapon && cardData.targetWeapon.iconTexture) {
      iconSprite = new PIXI.Sprite(cardData.targetWeapon.iconTexture);
    } else if (cardData.type === 'item' && cardData.targetItem && cardData.targetItem.config.iconTexture) {
      iconSprite = new PIXI.Sprite(cardData.targetItem.config.iconTexture);
    } else if (cardData.type === 'unlock') {
      // For unlock cards, get icon from item system
      if (cardData.target === 'ScholarsTomb') {
        // Try to get icon from upgrade system's item system reference
        // If not available, we'll need to pass it through cardData
        if (cardData.iconTexture) {
          iconSprite = new PIXI.Sprite(cardData.iconTexture);
        }
      }
    }
    
    if (iconSprite) {
      iconSprite.anchor.set(0.5);
      iconSprite.position.set(width / 2, height / 2);
      
      // Scale sprite to fit
      let maxSpriteSize = Math.min(width * 0.7, height * 0.7);
      
      // Adjust scale for Scholar's Tomb (it's larger, needs to be smaller)
      if (cardData.target === 'ScholarsTomb' || (cardData.type === 'item' && cardData.targetItem && cardData.targetItem.config.name === "Scholar's Tomb")) {
        maxSpriteSize = Math.min(width * 0.5, height * 0.5); // Smaller size for Scholar's Tomb
      }
      
      const spriteScale = maxSpriteSize / Math.max(iconSprite.width, iconSprite.height);
      iconSprite.scale.set(spriteScale, spriteScale);
      iconSprite.alpha = 0.3;
      
      this.container.addChild(iconSprite);
    }
    
    // Card hover effect
    this.container.on('pointerenter', () => {
      bg.clear();
      bg.rect(0, 0, width, height)
        .fill(0x3a3a3a)
        .stroke({ color: borderColorHex, width: 4 }); // Thicker border on hover
    });
    
    this.container.on('pointerleave', () => {
      bg.clear();
      bg.rect(0, 0, width, height)
        .fill(0x2a2a2a)
        .stroke({ color: borderColorHex, width: 3 });
    });
    
    // Upgrade name
    const nameText = new PIXI.Text(cardData.displayName, {
      fontFamily: 'Arial, sans-serif',
      fontSize: 14,
      fill: 0xFFFFFF,
      align: 'center'
    });
    nameText.anchor.set(0.5);
    nameText.position.set(width / 2, 20);
    this.container.addChild(nameText);
    
    // Upgrade description
    const descText = new PIXI.Text(cardData.description, {
      fontFamily: 'Arial, sans-serif',
      fontSize: 12,
      fill: 0xCCCCCC,
      align: 'center'
    });
    descText.anchor.set(0.5);
    descText.position.set(width / 2, 50);
    this.container.addChild(descText);
    
    // Rarity text (if applicable)
    if (cardData.rarity && cardData.type !== 'unlock') {
      const rarityText = new PIXI.Text(cardData.rarity, {
        fontFamily: 'Arial, sans-serif',
        fontSize: 10,
        fill: borderColorHex,
        align: 'center'
      });
      rarityText.anchor.set(0.5);
      rarityText.position.set(width / 2, height - 30);
      this.container.addChild(rarityText);
    }
    
    // Level text (if repeatable upgrade)
    if (cardData.level !== undefined) {
      const levelText = new PIXI.Text(`Lv ${cardData.level}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: 10,
        fill: 0x888888,
        align: 'center'
      });
      levelText.anchor.set(0.5);
      levelText.position.set(width / 2, height - 15);
      this.container.addChild(levelText);
    } else if (cardData.type === 'item' && cardData.targetItem) {
      // Show item level
      const levelText = new PIXI.Text(`Lv ${cardData.targetItem.level}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: 10,
        fill: 0x888888,
        align: 'center'
      });
      levelText.anchor.set(0.5);
      levelText.position.set(width / 2, height - 15);
      this.container.addChild(levelText);
    }
  }
}
