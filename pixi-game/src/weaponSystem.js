// --- Weapon System ---
// Handles all weapons, attacks, and scaling logic

export class Weapon {
  constructor(config) {
    // === BASIC INFO ===
    this.name = config.name;
    this.type = config.type;
    this.level = config.level || 1;
    this.iconTexture = config.iconTexture;
    
    // === CORE COMBAT STATS ===
    // Store base stats for upgrade tracking (hybrid approach)
    this.baseStats = {
      damage: config.damage || 1,
      attackSpeed: config.attackSpeed || 0.5,
      range: config.range || 1.5,
      piercing: config.piercing || 1,
      projectileSpeed: config.projectileSpeed || 600,
      projectileSize: config.projectileSize || 0.03,
      critChance: config.critChance || 0.1,
      critDamage: config.critDamage || 2.0,
      knockback: config.knockback || 0
    };
    
    // Direct properties for runtime (initialized from baseStats)
    this.damage = this.baseStats.damage;
    this.attackSpeed = this.baseStats.attackSpeed;
    this.range = this.baseStats.range;
    this.piercing = this.baseStats.piercing;
    this.projectileSpeed = this.baseStats.projectileSpeed;
    this.projectileSize = this.baseStats.projectileSize;
    this.critChance = this.baseStats.critChance;
    this.critDamage = this.baseStats.critDamage;
    this.knockback = this.baseStats.knockback;
    
    // === MULTI-PROJECTILE STATS ===
    this.projectileCount = config.projectileCount || 1;
    this.spreadAngle = config.spreadAngle || 0;
    
    // === AREA-OF-EFFECT STATS ===
    this.aoeRadius = config.aoeRadius || 0;
    this.aoeDamageMultiplier = config.aoeDamageMultiplier || 1.0;
    
    // === ELEMENTAL & STATUS EFFECTS ===
    this.elementType = config.elementType || 'physical';
    this.onHitEffect = config.onHitEffect || null;
    this.statusDuration = config.statusDuration || 0;
    this.statusDamage = config.statusDamage || 0;
    
    // === RESOURCE MANAGEMENT ===
    this.cooldown = config.cooldown || 0;
    this.ammo = config.ammo || null;
    this.currentAmmo = config.ammo || null;
    this.energyCost = config.energyCost || 0;
    this.reloadTime = config.reloadTime || 0;
    
    // === ADVANCED BEHAVIOR ===
    this.homingStrength = config.homingStrength || 0;
    this.chainTargets = config.chainTargets || 0;
    this.boomerang = config.boomerang || false;
    this.beamDuration = config.beamDuration || 0;
    
    // === VISUAL/BEHAVIOR ===
    this.projectileTexture = config.projectileTexture;
    
    // === INTERNAL STATE ===
    this.fireTimer = 0;
    this.cooldownTimer = 0;
    this.reloadTimer = 0;
  }
  
  update(deltaTime) {
    this.fireTimer += deltaTime;
  }
  
  canFire() {
    return this.fireTimer >= this.attackSpeed;
  }
  
  resetTimer() {
    this.fireTimer = 0;
  }
  
  // Calculate damage with crit chance
  calculateDamage() {
    const isCrit = Math.random() < this.critChance;
    const damage = Math.round(isCrit ? this.damage * this.critDamage : this.damage);
    return { damage, isCrit };
  }
  
  // Spawn projectile with weapon's stats
  // Note: Projectile class must be available in scope (defined in main.js or passed as parameter)
  fire(x, y, angle, projectilesContainer, projectiles, world, ProjectileClass) {
    if (!this.canFire()) return;
    
    const projectile = new ProjectileClass(
      x, y, angle,
      this.projectileSpeed,
      this.projectileTexture,
      this.projectileSize,
      this.range,
      this.piercing,
      this
    );
    projectilesContainer.addChild(projectile.sprite);
    world.addChild(projectile.hitboxGraphics);
    projectiles.push(projectile);
    this.resetTimer();
    
    console.log(`🗡️ ${this.name} fired!`);
  }
}

// Weapon System - manages weapon configurations and upgrades
export class WeaponSystem {
  constructor() {
    // Upgrade scaling multipliers by rarity
    this.rarityMultipliers = {
      'Common': 0.05,      // +5%
      'Uncommon': 0.10,     // +10%
      'Rare': 0.20,         // +20%
      'Epic': 0.35,         // +35%
      'Legendary': 0.50     // +50%
    };
    
    // Weapon configurations
    // These are templates - actual weapons are created from these configs
    this.weaponConfigs = {
      // Future weapons can be added here
    };
  }

  // Get upgrade multiplier for a rarity
  getUpgradeMultiplier(rarity) {
    return this.rarityMultipliers[rarity] || 0.05; // Default to Common if unknown
  }

  // Create a weapon instance from a config
  createWeapon(config) {
    return new Weapon(config);
  }

  // Apply an upgrade to a weapon
  applyUpgrade(weapon, upgrade, rarity = 'Common') {
    // Support both 'name' and 'stat' properties (from UpgradeSystem vs direct calls)
    const stat = upgrade.stat || upgrade.name;
    const type = upgrade.type;
    const value = upgrade.value;
    
    if (!weapon.baseStats.hasOwnProperty(stat)) {
      console.warn(`WeaponSystem: Stat "${stat}" not found in baseStats`);
      return null;
    }
    
    // Value is already calculated with rarity in UpgradeSystem, so use it directly
    const effectiveValue = value;
    
    const oldValue = weapon[stat];
    let newValue;
    
    if (type === 'percentage' || type === 'mult') {
      // Percentage-based upgrade - multiply current base stat by (1 + value)
      // For damage, range, etc: baseStats * (1 + 0.10) = 10% increase
      newValue = weapon.baseStats[stat] * (1 + effectiveValue);
    } else if (type === 'flat' || type === 'add') {
      // Flat value upgrade - add to current base stat
      // For critChance, piercing: baseStats + 0.05 = +5% crit chance
      newValue = weapon.baseStats[stat] + effectiveValue;
    } else {
      // Default to flat
      newValue = weapon.baseStats[stat] + effectiveValue;
    }
    
    // Special handling for attackSpeed (negative values mean faster attacks)
    if (stat === 'attackSpeed') {
      // If value is negative, we multiply by (1 + negative) which reduces cooldown
      // For example: base 0.5 * (1 + -0.10) = 0.5 * 0.9 = 0.45 (faster)
      if (effectiveValue < 0) {
        newValue = weapon.baseStats[stat] * (1 + effectiveValue);
      } else {
        // Positive value also multiplies (increase speed = lower cooldown)
        newValue = weapon.baseStats[stat] * (1 - effectiveValue);
      }
      // Clamp minimum cooldown
      newValue = Math.max(0.1, newValue);
    }
    
    // Update both baseStats and direct property (they should stay in sync)
    weapon.baseStats[stat] = newValue;
    weapon[stat] = newValue;
    
    // Increment weapon level
    weapon.level = (weapon.level || 1) + 1;
    
    console.log(`⚔️ Upgrade applied to ${weapon.name}: ${stat} ${oldValue.toFixed(3)} → ${newValue.toFixed(3)} (${type}: ${effectiveValue})`);
    console.log(`   Current stats: damage=${weapon.damage}, attackSpeed=${weapon.attackSpeed.toFixed(3)}, range=${weapon.range.toFixed(3)}`);
    
    return {
      upgrade: upgrade,
      oldValue: oldValue,
      newValue: newValue
    };
  }

  // Register a weapon configuration
  registerWeaponConfig(name, config) {
    this.weaponConfigs[name] = config;
  }

  // Get weapon configuration
  getWeaponConfig(name) {
    return this.weaponConfigs[name];
  }
}


