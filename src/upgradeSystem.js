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

  // Calculate number of upgrade cards based on luck (weighted probability)
  calculateCardCount(luck = 0) {
    const cardOptions = [3, 4, 5, 6];
    let weights = [0, 0, 0, 0]; // [3 cards, 4 cards, 5 cards, 6 cards]
    
    // Bracket system (similar to rarity weighting)
    if (luck <= 15) {
      // 0-15 luck: 3 cards dominant, 4 cards starts appearing
      const t = luck / 15;
      weights = [
        90 - (t * 40),  // 3 cards: 90% → 50%
        10 + (t * 40),  // 4 cards: 10% → 50%
        0,              // 5 cards: 0%
        0               // 6 cards: 0%
      ];
    } else if (luck <= 30) {
      // 15-30 luck: 4 cards peaks, 5 cards appears
      const t = (luck - 15) / 15;
      weights = [
        50 - (t * 35),  // 3 cards: 50% → 15%
        50 - (t * 10),  // 4 cards: 50% → 40% (peaked)
        0 + (t * 40),   // 5 cards: 0% → 40%
        0 + (t * 5)     // 6 cards: 0% → 5%
      ];
    } else if (luck <= 50) {
      // 30-50 luck: 5 cards peaks, 6 cards grows
      const t = (luck - 30) / 20;
      weights = [
        15 - (t * 10),  // 3 cards: 15% → 5%
        40 - (t * 20),  // 4 cards: 40% → 20%
        40 + (t * 10),  // 5 cards: 40% → 50% (peaks)
        5 + (t * 25)    // 6 cards: 5% → 30%
      ];
    } else {
      // 50+ luck: 6 cards dominant
      const t = Math.min((luck - 50) / 30, 1); // 50-80 progression, capped
      weights = [
        5 - (t * 3),    // 3 cards: 5% → 2%
        20 - (t * 10),  // 4 cards: 20% → 10%
        50 - (t * 28),  // 5 cards: 50% → 22%
        25 + (t * 41)   // 6 cards: 25% → 66%
      ];
    }
    
    // Normalize weights
    const total = weights.reduce((sum, w) => sum + w, 0);
    const normalized = weights.map(w => w / total);
    
    // Random selection based on weights
    const rand = Math.random();
    let cumulative = 0;
    for (let i = 0; i < cardOptions.length; i++) {
      cumulative += normalized[i];
      if (rand <= cumulative) {
        return cardOptions[i];
      }
    }
    
    return 3; // Fallback
  }

  // Helper method: Select a balanced upgrade (roll for type first, then weapon/item, then stat)
  selectBalancedUpgrade(upgradesPool, weapons, items) {
    // Separate upgrades by type
    const weaponUpgrades = upgradesPool.filter(u => u.type === 'weapon');
    const itemUpgrades = upgradesPool.filter(u => u.type === 'item');
    
    console.log(`🎲 Balanced selection: ${weaponUpgrades.length} weapon upgrades, ${itemUpgrades.length} item upgrades available`);
    
    // If no upgrades available, return null
    if (weaponUpgrades.length === 0 && itemUpgrades.length === 0) {
      return null;
    }
    
    // Stage 1: Roll for type (50/50 if both types exist, otherwise 100% for available type)
    let selectedType;
    if (weaponUpgrades.length > 0 && itemUpgrades.length > 0) {
      selectedType = Math.random() < 0.5 ? 'weapon' : 'item';
      
      // If rolled type has no upgrades left (e.g., only 1 item already selected), switch to other type
      if (selectedType === 'item' && itemUpgrades.length === 0) {
        console.log(`   → Rolled item but none left, switching to weapon`);
        selectedType = 'weapon';
      } else if (selectedType === 'weapon' && weaponUpgrades.length === 0) {
        console.log(`   → Rolled weapon but none left, switching to item`);
        selectedType = 'item';
      }
    } else if (weaponUpgrades.length > 0) {
      selectedType = 'weapon';
    } else {
      selectedType = 'item';
    }
    
    console.log(`   → Stage 1 - Type: ${selectedType}`);
    
    let selected;
    
    if (selectedType === 'weapon' && weaponUpgrades.length > 0) {
      // Stage 2: For weapons, group by weapon name to ensure equal representation per weapon
      const weaponGroups = {};
      weaponUpgrades.forEach(upgrade => {
        const weaponName = upgrade.targetWeapon ? upgrade.targetWeapon.name : 'Unknown';
        if (!weaponGroups[weaponName]) {
          weaponGroups[weaponName] = [];
        }
        weaponGroups[weaponName].push(upgrade);
      });
      
      const weaponNames = Object.keys(weaponGroups);
      
      // Roll which weapon
      const randomWeaponName = weaponNames[Math.floor(Math.random() * weaponNames.length)];
      console.log(`   → Stage 2 - Weapon: ${randomWeaponName}`);
      
      // Stage 3: Roll which stat upgrade for that weapon
      const weaponPool = weaponGroups[randomWeaponName];
      const randomIndex = Math.floor(Math.random() * weaponPool.length);
      selected = weaponPool[randomIndex];
      
      console.log(`   → Stage 3 - Stat: ${selected.effect.stat}`);
    } else if (selectedType === 'item' && itemUpgrades.length > 0) {
      // For items, just pick random (each item only has 1 stat anyway)
      const randomIndex = Math.floor(Math.random() * itemUpgrades.length);
      selected = itemUpgrades[randomIndex];
    } else {
      // Fallback: no upgrades of selected type available
      console.log(`   → No upgrades of type ${selectedType} available`);
      return null;
    }
    
    console.log(`   → Final: ${selected.displayName}`);
    
    // Remove selected card from the pool to prevent duplicates
    const indexInOriginal = upgradesPool.indexOf(selected);
    if (indexInOriginal > -1) {
      upgradesPool.splice(indexInOriginal, 1);
    }
    
    return selected;
  }

  // Generate upgrade cards with rarity and luck weighting
  generateUpgradeCards(weapons, items = [], luck = 0, playerLevel = 1, maxWeaponSlots = 3, maxItemSlots = 3, weaponIcons = {}) {
    const cardCount = this.calculateCardCount(luck);
    const allUpgrades = [];
    const unlockUpgrades = []; // Separate array for unlocks
    
    // Weapon upgrades
    weapons.forEach(weapon => {
      // Check if crit is capped (100%)
      const isCritCapped = weapon.critChance >= 1.0;
      
      // Determine scaling factors based on weapon type
      let damageScaling = 1.0;
      let knockbackScaling = 1.0;
      let rangeScaling = 1.0;
      let sizeScaling = 1.0;
      
      if (weapon.name === 'Shield') {
        damageScaling = 0.75; // 3/4 scaling
        knockbackScaling = 0.75;
        rangeScaling = 0.5; // 1/2 scaling
        sizeScaling = 0.5;
      }
      
      // Damage - will be set by rarity system (Common: 10%)
      allUpgrades.push({
        id: `upgrade_${weapon.name.toLowerCase()}_damage`,
        type: 'weapon',
        target: weapon.name,
        targetWeapon: weapon,
        effect: { stat: 'damage', type: 'mult', value: 0.10 }, // Placeholder, will be overridden by rarity
        displayName: weapon.name,
        description: '' // Will be filled with percentage after rarity calculation
      });
      
      // Attack Speed - not for Shield (always active)
      if (weapon.name !== 'Shield') {
        allUpgrades.push({
          id: `upgrade_${weapon.name.toLowerCase()}_attackSpeed`,
          type: 'weapon',
          target: weapon.name,
          targetWeapon: weapon,
          effect: { stat: 'attackSpeed', type: 'mult', value: -0.10 }, // Placeholder, will be overridden by rarity
          displayName: weapon.name,
          description: '' // Will be filled with percentage after rarity calculation
        });
      }
      
      // Knockback - will be set by rarity system (Common: 10%)
      allUpgrades.push({
        id: `upgrade_${weapon.name.toLowerCase()}_knockback`,
        type: 'weapon',
        target: weapon.name,
        targetWeapon: weapon,
        effect: { stat: 'knockback', type: 'mult', value: 0.10 }, // Placeholder, will be overridden by rarity
        displayName: weapon.name,
        description: '' // Will be filled with percentage after rarity calculation
      });
      
      // Range - only for Sword Slash and Shield
      if (weapon.name === 'Sword Slash' || weapon.name === 'Shield') {
        allUpgrades.push({
          id: `upgrade_${weapon.name.toLowerCase()}_range`,
          type: 'weapon',
          target: weapon.name,
          targetWeapon: weapon,
          effect: { stat: 'range', type: 'mult', value: 0.05 }, // Placeholder, will be overridden by rarity
          displayName: weapon.name,
          description: '' // Will be filled with percentage after rarity calculation
        });
      }
      
      // Projectile Size - only for Sword Slash and Shield
      if (weapon.name === 'Sword Slash' || weapon.name === 'Shield') {
        allUpgrades.push({
          id: `upgrade_${weapon.name.toLowerCase()}_projectileSize`,
          type: 'weapon',
          target: weapon.name,
          targetWeapon: weapon,
          effect: { stat: 'projectileSize', type: 'mult', value: 0.10 }, // Placeholder, will be overridden by rarity
          displayName: weapon.name,
          description: '' // Will be filled with percentage after rarity calculation
        });
      }
      
      // Projectile Speed removed - not a sword stat
      
      // Critical Chance - not for Shield (crit chance = 0 by design)
      // Only add if not capped at 100%
      if (weapon.name !== 'Shield' && !isCritCapped) {
        allUpgrades.push({
          id: `upgrade_${weapon.name.toLowerCase()}_critChance`,
          type: 'weapon',
          target: weapon.name,
          targetWeapon: weapon,
          effect: { stat: 'critChance', type: 'add', value: 0.025 }, // Placeholder, will be overridden by rarity
          displayName: weapon.name,
          description: '' // Will be filled with percentage after rarity calculation
        });
      } else if (isCritCapped) {
        console.log(`🎯 Crit capped for ${weapon.name} (${(weapon.critChance * 100).toFixed(1)}%) - filtering out crit chance upgrades`);
      }
      
      // Critical Damage - not for Shield (no crits)
      if (weapon.name !== 'Shield') {
        allUpgrades.push({
          id: `upgrade_${weapon.name.toLowerCase()}_critDamage`,
          type: 'weapon',
          target: weapon.name,
          targetWeapon: weapon,
          effect: { stat: 'critDamage', type: 'mult', value: 0.15 }, // Placeholder, will be overridden by rarity
          displayName: weapon.name,
          description: '' // Will be filled with percentage after rarity calculation
        });
      }
      
      // Piercing - not for Magic Staff or Shield
      if (weapon.name !== 'Magic Staff' && weapon.name !== 'Shield') {
        allUpgrades.push({
          id: `upgrade_${weapon.name.toLowerCase()}_piercing`,
          type: 'weapon',
          target: weapon.name,
          targetWeapon: weapon,
          effect: { stat: 'piercing', type: 'add', value: 1 }, // Placeholder, will be overridden by rarity
          displayName: weapon.name,
          description: '' // Will be filled with value after rarity calculation
        });
      }
      
      // Projectile Count - only for Longbow, Magic Staff, and Shield
      if (weapon.name === 'Longbow' || weapon.name === 'Magic Staff' || weapon.name === 'Shield') {
        allUpgrades.push({
          id: `upgrade_${weapon.name.toLowerCase()}_projectileCount`,
          type: 'weapon',
          target: weapon.name,
          targetWeapon: weapon,
          effect: { stat: 'projectileCount', type: 'add', value: 0.5 }, // Rarity: 0.5, 0.75, 1, 1.5, 2
          displayName: weapon.name,
          description: '' // Will be filled with value after rarity calculation
        });
      }
      
      // Projectile Speed (Orbit Speed) - only for Shield
      if (weapon.name === 'Shield') {
        allUpgrades.push({
          id: `upgrade_${weapon.name.toLowerCase()}_projectileSpeed`,
          type: 'weapon',
          target: weapon.name,
          targetWeapon: weapon,
          effect: { stat: 'projectileSpeed', type: 'mult', value: 0.10 }, // Rarity: 10%, 20%, 30%, 40%, 50%
          displayName: weapon.name,
          description: '' // Will be filled with percentage after rarity calculation
        });
      }
    });
    
    // Per-item rarity values (custom scaling per item)
    const itemRarityValues = {
      'ScholarsTomb': {
        'Common': 0.025,      // +2.5% XP Gain
        'Uncommon': 0.05,      // +5% XP Gain
        'Rare': 0.075,         // +7.5% XP Gain
        'Epic': 0.10,          // +10% XP Gain
        'Legendary': 0.15      // +15% XP Gain
      },
      'SoulCatcher': {
        'Common': 0.05,       // +5% pickup range
        'Uncommon': 0.075,     // +7.5% pickup range
        'Rare': 0.10,          // +10% pickup range
        'Epic': 0.125,         // +12.5% pickup range
        'Legendary': 0.15      // +15% pickup range
      },
      'RabbitsFoot': {
        'Common': 1,          // +1 Luck
        'Uncommon': 1.5,       // +1.5 Luck
        'Rare': 2,             // +2 Luck
        'Epic': 2.5,           // +2.5 Luck
        'Legendary': 3         // +3 Luck
      },
      'Gambeson': {
        'Common': 0.5,        // +0.5 Armor
        'Uncommon': 0.75,      // +0.75 Armor
        'Rare': 1,             // +1 Armor
        'Epic': 1.5,           // +1.5 Armor
        'Legendary': 2         // +2 Armor
      },
      'BloodstoneAmulet': {
        'Common': 0.075,      // +7.5% Max HP
        'Uncommon': 0.10,      // +10% Max HP
        'Rare': 0.125,         // +12.5% Max HP
        'Epic': 0.15,          // +15% Max HP
        'Legendary': 0.20      // +20% Max HP
      }
      // Future items can be added here
    };
    
    // Item upgrades (for owned items)
    console.log(`🔍 Generating item upgrades for owned items:`, Object.keys(items));
    Object.keys(items).forEach(itemName => {
      const item = items[itemName];
      allUpgrades.push({
        id: `upgrade_${itemName.toLowerCase()}`,
        type: 'item',
        target: itemName,
        targetItem: item,
        effect: item.config.upgradeScaling,
        displayName: item.config.name,
        description: '', // Will be filled with percentage after rarity calculation
        itemRarityValues: itemRarityValues[itemName] || null // Include item-specific rarity values
      });
      console.log(`  ✅ Added upgrade card for: ${item.config.name}`);
    });
    
    // Unlock upgrades (new weapons/items) - red border
    // Add to separate unlockUpgrades array
    
    // Check current item count for slot limit
    const currentItemCount = Object.keys(items).length;
    const hasItemSlot = currentItemCount < maxItemSlots;
    
    console.log(`🎰 Item unlock check: ${currentItemCount}/${maxItemSlots} items owned, hasItemSlot=${hasItemSlot}`);
    
    // Scholar's Tomb
    if (!items['ScholarsTomb'] && hasItemSlot) {
      const scholarsTombConfig = this.itemSystem.getItemConfig('ScholarsTomb');
      unlockUpgrades.push({
        id: 'unlock_scholarstomb',
        type: 'unlock',
        target: 'ScholarsTomb',
        effect: null,
        displayName: 'Scholar\'s Tomb',
        description: 'Unlock: +5% XP Gain',
        borderColor: '#FF0000', // Red for unlocks
        iconTexture: scholarsTombConfig ? scholarsTombConfig.iconTexture : null
      });
    }
    
    // Soul Catcher
    if (!items['SoulCatcher'] && hasItemSlot) {
      const soulCatcherConfig = this.itemSystem.getItemConfig('SoulCatcher');
      unlockUpgrades.push({
        id: 'unlock_soulcatcher',
        type: 'unlock',
        target: 'SoulCatcher',
        effect: null,
        displayName: 'Soul Catcher',
        description: 'Unlock: +10% Pickup Range',
        borderColor: '#FF0000',
        iconTexture: soulCatcherConfig ? soulCatcherConfig.iconTexture : null
      });
    }
    
    // Rabbit's Foot
    if (!items['RabbitsFoot'] && hasItemSlot) {
      const rabitsFootConfig = this.itemSystem.getItemConfig('RabbitsFoot');
      unlockUpgrades.push({
        id: 'unlock_rabitsfoot',
        type: 'unlock',
        target: 'RabbitsFoot',
        effect: null,
        displayName: 'Rabbit\'s Foot',
        description: 'Unlock: +2 Luck',
        borderColor: '#FF0000',
        iconTexture: rabitsFootConfig ? rabitsFootConfig.iconTexture : null
      });
    }
    
    // Gambeson
    if (!items['Gambeson'] && hasItemSlot) {
      const gamebesonConfig = this.itemSystem.getItemConfig('Gambeson');
      unlockUpgrades.push({
        id: 'unlock_gambeson',
        type: 'unlock',
        target: 'Gambeson',
        effect: null,
        displayName: 'Gambeson',
        description: 'Unlock: +2 Armor',
        borderColor: '#FF0000',
        iconTexture: gamebesonConfig ? gamebesonConfig.iconTexture : null
      });
    }
    
    // Bloodstone Amulet
    if (!items['BloodstoneAmulet'] && hasItemSlot) {
      const bloodstoneConfig = this.itemSystem.getItemConfig('BloodstoneAmulet');
      unlockUpgrades.push({
        id: 'unlock_bloodstoneamulet',
        type: 'unlock',
        target: 'BloodstoneAmulet',
        effect: null,
        displayName: 'Bloodstone Amulet',
        description: 'Unlock: +10% Max HP',
        borderColor: '#FF0000',
        iconTexture: bloodstoneConfig ? bloodstoneConfig.iconTexture : null
      });
    }
    
    // Weapon Unlocks (check if weapons exist in player's arsenal)
    const hasLongbow = weapons.some(w => w.name === 'Longbow');
    const hasStaff = weapons.some(w => w.name === 'Magic Staff');
    const hasShield = weapons.some(w => w.name === 'Shield');
    
    // Longbow Unlock
    if (!hasLongbow && weapons.length < maxWeaponSlots) {
      unlockUpgrades.push({
        id: 'unlock_longbow',
        type: 'weapon_unlock',
        target: 'Longbow',
        weaponConfig: 'longbowConfig', // Reference to config name
        effect: null,
        displayName: 'Longbow',
        description: 'Unlock: Ranged weapon with piercing arrows',
        borderColor: '#FF0000',
        iconTexture: weaponIcons.longbow || null
      });
    }
    
    // Magic Staff Unlock
    if (!hasStaff && weapons.length < maxWeaponSlots) {
      unlockUpgrades.push({
        id: 'unlock_magicstaff',
        type: 'weapon_unlock',
        target: 'Magic Staff',
        weaponConfig: 'magicStaffConfig',
        effect: null,
        displayName: 'Magic Staff',
        description: 'Unlock: Multi-target magic projectiles',
        borderColor: '#FF0000',
        iconTexture: weaponIcons.staff || null
      });
    }
    
    // Shield Unlock
    if (!hasShield && weapons.length < maxWeaponSlots) {
      unlockUpgrades.push({
        id: 'unlock_shield',
        type: 'weapon_unlock',
        target: 'Shield',
        weaponConfig: 'shieldConfig',
        effect: null,
        displayName: 'Shield',
        description: 'Unlock: Orbiting defensive weapon',
        borderColor: '#FF0000',
        iconTexture: weaponIcons.shield || null
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
      'projectileCount': { Common: 0.5, Uncommon: 0.75, Rare: 1.0, Epic: 1.5, Legendary: 2.0 }, // Projectile count (Longbow/Staff)
      'projectileSpeed': { Common: 0.10, Uncommon: 0.20, Rare: 0.30, Epic: 0.40, Legendary: 0.50 } // Shield orbit speed
    };
    
    // Assign rarity to each upgrade and calculate final descriptions with percentages
    console.log(`🎲 Processing ${allUpgrades.length} total upgrades (weapons + items)`);
    const upgradesWithRarity = allUpgrades.map(upgrade => {
      const rarity = this.calculateRarity(luck);
      
      // Apply rarity multiplier to upgrade effect value
      const upgradedEffect = { ...upgrade.effect };
      let finalDescription = upgrade.description;
      
      // Get weapon-specific scaling if applicable
      let weaponScaling = 1.0;
      if (upgrade.type === 'weapon' && upgrade.targetWeapon) {
        const weaponName = upgrade.targetWeapon.name;
        const stat = upgradedEffect.stat;
        
        if (weaponName === 'Shield') {
          if (stat === 'damage' || stat === 'knockback') weaponScaling = 0.75;
          if (stat === 'range' || stat === 'projectileSize') weaponScaling = 0.5;
        }
      }
      
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
          
          // Generate description based on stat type
          if (upgradedEffect.type === 'mult' || upgradedEffect.type === 'percentage') {
            const percentage = upgradedEffect.value * 100;
            const displayValue = percentage % 1 === 0 ? Math.round(percentage) : percentage.toFixed(1);
            
            const statNames = {
              'xpGain': 'XP Gain',
              'pickupRange': 'Pickup Range',
              'maxHP': 'Max HP'
            };
            const statName = statNames[upgradedEffect.stat] || upgradedEffect.stat;
            finalDescription = `+${displayValue}% ${statName}`;
          } else if (upgradedEffect.type === 'add' || upgradedEffect.type === 'flat') {
            const displayValue = upgradedEffect.value % 1 === 0 ? Math.round(upgradedEffect.value) : upgradedEffect.value.toFixed(1);
            
            const statNames = {
              'luck': 'Luck',
              'armor': 'Armor'
            };
            const statName = statNames[upgradedEffect.stat] || upgradedEffect.stat;
            finalDescription = `+${displayValue} ${statName}`;
          }
        }
        // Check if this stat has custom rarity multipliers (for weapons)
        else if (statRarityMultipliers[stat] && statRarityMultipliers[stat][rarity] !== undefined) {
          // Use custom rarity value for this stat
          if (stat === 'piercing' || stat === 'projectileCount') {
            // Piercing and projectileCount use flat values
            upgradedEffect.value = statRarityMultipliers[stat][rarity] * weaponScaling;
          } else if (upgradedEffect.type === 'add' || upgradedEffect.type === 'flat') {
            // For additive stats like critChance
            upgradedEffect.value = statRarityMultipliers[stat][rarity] * weaponScaling;
          } else {
            // For multiplicative stats
            const targetValue = statRarityMultipliers[stat][rarity] * weaponScaling;
            
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
              'projectileSpeed': 'Projectile Speed',
              'critDamage': 'Critical Damage',
              'xpGain': 'XP Gain',
              'knockback': 'Knockback'
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
              // Show 1 decimal for projectile count if not whole number
              const displayValue = upgradedEffect.value % 1 === 0 ? Math.round(upgradedEffect.value) : upgradedEffect.value.toFixed(1);
              finalDescription = `+${displayValue} Projectile${upgradedEffect.value > 1 ? 's' : ''}`;
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
    
    // Check if slots are available for weapons or items
    const hasWeaponSlot = weapons.length < maxWeaponSlots;
    const hasItemSlot_recalc = Object.keys(items).length < maxItemSlots;
    const hasSlotsAvailable = hasWeaponSlot || hasItemSlot_recalc;
    
    console.log(`🎯 upgradesWithRarity pool breakdown:`, upgradesWithRarity.reduce((acc, u) => {
      acc[u.type] = (acc[u.type] || 0) + 1;
      return acc;
    }, {}));
    console.log(`🔓 Available unlocks: ${unlockUpgrades.length} (${unlockUpgrades.map(u => u.displayName).join(', ')})`);
    console.log(`   Weapon slots: ${weapons.length}/${maxWeaponSlots}, Item slots: ${Object.keys(items).length}/${maxItemSlots}`);
    
    // If slots are available and there are unlocks, force first card to be an unlock
    let selected = [];
    if (hasSlotsAvailable && unlockUpgrades.length > 0) {
      // Assign rarity to unlock upgrades
      const unlocksWithRarity = unlockUpgrades.map(unlock => ({
        ...unlock,
        rarity: this.calculateRarity(luck),
        borderColor: unlock.borderColor || '#FF0000' // Red for unlocks
      }));
      
      // Pick random unlock for first slot
      const randomUnlock = unlocksWithRarity[Math.floor(Math.random() * unlocksWithRarity.length)];
      selected.push(randomUnlock);
      
      // Check what type of unlock was forced and filter accordingly
      const isWeaponUnlock = randomUnlock.type === 'weapon_unlock';
      const isItemUnlock = randomUnlock.type === 'unlock'; // Item unlocks use 'unlock' type
      const weaponSlotsFull = weapons.length >= maxWeaponSlots;
      const itemSlotsFull = Object.keys(items).length >= maxItemSlots;
      
      // Fill remaining slots with balanced selection
      // Make a copy of upgradesWithRarity since selectBalancedUpgrade modifies the array
      let upgradePool = [...upgradesWithRarity];
      
      // If weapon unlock forced and item slots full, remove item upgrades
      if (isWeaponUnlock && itemSlotsFull) {
        upgradePool = upgradePool.filter(u => u.type !== 'item');
        console.log(`🚫 Filtered out item upgrades (item slots full, prioritizing weapon unlocks)`);
      }
      // If item unlock forced and weapon slots full, remove weapon upgrades
      else if (isItemUnlock && weaponSlotsFull) {
        upgradePool = upgradePool.filter(u => u.type !== 'weapon');
        console.log(`🚫 Filtered out weapon upgrades (weapon slots full, prioritizing item unlocks)`);
      }
      
      const slotsToFill = cardCount - 1; // -1 because first slot is the unlock
      for (let i = 0; i < slotsToFill; i++) {
        const card = this.selectBalancedUpgrade(upgradePool, weapons, items);
        if (card) selected.push(card);
      }
      
      const unlockType = isWeaponUnlock ? 'weapon' : isItemUnlock ? 'item' : 'unknown';
      console.log(`🔓 Forced unlock card: ${randomUnlock.displayName} (${unlockType} unlock, slots: weapons=${hasWeaponSlot}, items=${hasItemSlot_recalc})`);
    } else {
      // Normal selection - balanced between weapons and items
      // Make a copy of upgradesWithRarity since selectBalancedUpgrade modifies the array
      const upgradePool = [...upgradesWithRarity];
      for (let i = 0; i < cardCount; i++) {
        const card = this.selectBalancedUpgrade(upgradePool, weapons, items);
        if (card) selected.push(card);
      }
    }
    
    console.log(`🎴 Final selected upgrade cards:`, selected.map(c => `${c.displayName} (${c.type})`));
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
      // Check if it's an item unlock
      const itemConfig = this.itemSystem.getItemConfig(target);
      if (itemConfig) {
        // Check if item slots are available (prevent exceeding max)
        const currentItemCount = Object.keys(this.itemSystem.getOwnedItems()).length;
        const maxItemSlots = 3; // Should match MAX_ITEM_SLOTS from main.js
        
        if (currentItemCount >= maxItemSlots) {
          console.warn(`❌ Cannot unlock item "${target}" - all ${maxItemSlots} item slots are full!`);
          return null;
        }
        
        this.itemSystem.addItem(target);
        return { unlocked: target };
      }
      
      // Check if it's a weapon unlock (will be handled when weapons are configured in main.js)
      // For now, weapon unlocks need to be handled in the main game initialization
      
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
    } else if (cardData.type === 'unlock' || cardData.type === 'weapon_unlock') {
      // For unlock cards (weapons and items), get icon from cardData
      if (cardData.iconTexture) {
        iconSprite = new PIXI.Sprite(cardData.iconTexture);
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
      fontSize: 13,
      fill: 0xFFFFFF,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: width - 10 // 5px padding on each side
    });
    nameText.anchor.set(0.5);
    nameText.position.set(width / 2, 18);
    this.container.addChild(nameText);
    
    // Upgrade description
    const descText = new PIXI.Text(cardData.description, {
      fontFamily: 'Arial, sans-serif',
      fontSize: 11,
      fill: 0xCCCCCC,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: width - 10 // 5px padding on each side
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
