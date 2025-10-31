/**
 * Dynamic Difficulty Scaling System
 * Manages progressive enemy difficulty based on survival time
 */

export class DifficultySystem {
  constructor() {
    // Base values for scaling calculations
    this.baseHealthMultiplier = 1.0;
    this.baseSpeedMultiplier = 1.0;
    this.baseSpawnRateMultiplier = 1.0;
    this.baseXPMultiplier = 1.0;
    
    // Scaling rates (exponential growth per minute)
    this.healthGrowthRate = 0.04;  // 4% compound growth per minute
    this.speedGrowthRate = 0.02;   // 2% compound growth per minute  
    this.spawnRateGrowthRate = 0.06; // 6% faster spawning per minute
    this.spawnQuantityGrowthRate = 0.20; // 20% quantity increase per minute (steep for 15-min runs)
    
    // Time tracking
    this.gameStartTime = Date.now();
    this.currentGameTime = 0; // seconds
    this.lastUpdateTime = 0;
    this.updateInterval = 35; // seconds (30-45 range)
    
    // Difficulty settings for future expansion
    this.difficultyModifier = 1.0; // 0.7 = easy, 1.0 = normal, 1.3 = hard
    
    // Current scaling multipliers (cached for performance)
    this.currentHealthMultiplier = 1.0;
    this.currentSpeedMultiplier = 1.0;
    this.currentSpawnRateMultiplier = 1.0;
    this.currentSpawnQuantityMultiplier = 1.0; // Number of enemies per spawn event
    this.currentXPMultiplier = 1.0;
    
    // Elite and boss progression
    this.baseEliteChance = 0.02; // 2%
    this.eliteChanceGrowthRate = 0.01; // 1% per minute
    this.maxEliteChance = 0.15; // 15% cap
    this.bossInterval = 120; // 2 minutes in seconds
    this.nextBossTime = this.bossInterval;
    this.firstBossSpawned = false;
    
    console.log('🎯 Difficulty System initialized - Exponential scaling active');
    console.log(`   📈 Growth rates: Health +${(this.healthGrowthRate * 100).toFixed(1)}%/min, Speed +${(this.speedGrowthRate * 100).toFixed(1)}%/min, Spawn Rate +${(this.spawnRateGrowthRate * 100).toFixed(1)}%/min, Quantity +${(this.spawnQuantityGrowthRate * 100).toFixed(1)}%/min`);
  }
  
  /**
   * Update difficulty scaling based on elapsed game time
   * @param {number} deltaTime - Time since last frame in seconds
   */
  update(deltaTime) {
    this.currentGameTime += deltaTime;
    
    // Update scaling multipliers every update interval
    if (this.currentGameTime - this.lastUpdateTime >= this.updateInterval) {
      this.calculateScalingMultipliers();
      this.lastUpdateTime = this.currentGameTime;
      
      // Debug output every difficulty update
      const minutes = this.getMinutesSurvived();
      const spawnQty = this.getSpawnQuantity();
      console.log(`🎯 Difficulty Update (${minutes.toFixed(1)}min): Health x${this.currentHealthMultiplier.toFixed(2)}, Speed x${this.currentSpeedMultiplier.toFixed(2)}, Spawn Rate x${this.currentSpawnRateMultiplier.toFixed(2)}, Quantity: ${spawnQty} enemies/spawn`);
    }
  }
  
  /**
   * Calculate current scaling multipliers using exponential growth
   */
  calculateScalingMultipliers() {
    const minutes = this.getMinutesSurvived();
    
    // Apply exponential scaling: base * (1 + growthRate)^minutes
    this.currentHealthMultiplier = this.baseHealthMultiplier * Math.pow(1 + this.healthGrowthRate, minutes) * this.difficultyModifier;
    this.currentSpeedMultiplier = this.baseSpeedMultiplier * Math.pow(1 + this.speedGrowthRate, minutes) * this.difficultyModifier;
    this.currentXPMultiplier = this.currentHealthMultiplier; // XP scales with health (enemy difficulty)
    
    // Spawn rate scaling (inverse - higher multiplier = faster spawning)
    this.currentSpawnRateMultiplier = Math.pow(1 + this.spawnRateGrowthRate, minutes) * this.difficultyModifier;
    
    // Spawn quantity scaling (more enemies per spawn event over time)
    this.currentSpawnQuantityMultiplier = Math.pow(1 + this.spawnQuantityGrowthRate, minutes) * this.difficultyModifier;
  }
  
  /**
   * Get minutes survived since game start
   * @returns {number} Minutes survived
   */
  getMinutesSurvived() {
    return this.currentGameTime / 60;
  }
  
  /**
   * Get current game time in seconds
   * @returns {number} Current game time in seconds
   */
  getCurrentGameTime() {
    return this.currentGameTime;
  }
  
  /**
   * Get current enemy health multiplier
   * @returns {number} Health scaling multiplier
   */
  getHealthMultiplier() {
    return this.currentHealthMultiplier;
  }
  
  /**
   * Get current enemy speed multiplier
   * @returns {number} Speed scaling multiplier
   */
  getSpeedMultiplier() {
    return this.currentSpeedMultiplier;
  }
  
  /**
   * Get current spawn rate multiplier (higher = faster spawning)
   * @returns {number} Spawn rate scaling multiplier
   */
  getSpawnRateMultiplier() {
    return this.currentSpawnRateMultiplier;
  }
  
  /**
   * Get current XP reward multiplier
   * @returns {number} XP scaling multiplier
   */
  getXPMultiplier() {
    return this.currentXPMultiplier;
  }
  
  /**
   * Get current spawn quantity (number of enemies per spawn event)
   * @returns {number} Number of enemies to spawn (rounded to nearest integer, minimum 1)
   */
  getSpawnQuantity() {
    return Math.max(1, Math.round(this.currentSpawnQuantityMultiplier));
  }
  
  /**
   * Get current elite spawn chance (after first boss)
   * @returns {number} Elite spawn chance (0.0 to 1.0)
   */
  getEliteChance() {
    if (!this.firstBossSpawned) {
      return 0; // No elites before first boss
    }
    
    const minutes = this.getMinutesSurvived();
    const eliteChance = this.baseEliteChance + (minutes * this.eliteChanceGrowthRate / 60);
    return Math.min(eliteChance, this.maxEliteChance);
  }
  
  /**
   * Check if it's time for a boss spawn
   * @returns {boolean} True if boss should spawn
   */
  shouldSpawnBoss() {
    if (this.currentGameTime >= this.nextBossTime) {
      this.nextBossTime += this.bossInterval;
      this.firstBossSpawned = true;
      return true;
    }
    return false;
  }
  
  /**
   * Get time until next boss spawn
   * @returns {number} Seconds until next boss
   */
  getTimeUntilNextBoss() {
    return Math.max(0, this.nextBossTime - this.currentGameTime);
  }
  
  /**
   * Set difficulty modifier for easy/normal/hard modes
   * @param {number} modifier - Difficulty multiplier (0.7 = easy, 1.0 = normal, 1.3 = hard)
   */
  setDifficultyModifier(modifier) {
    this.difficultyModifier = modifier;
    this.calculateScalingMultipliers(); // Recalculate with new modifier
    console.log(`🎯 Difficulty modifier set to ${modifier} (${modifier < 1 ? 'Easy' : modifier > 1 ? 'Hard' : 'Normal'})`);
  }
  
  /**
   * Reset difficulty system for new game
   */
  reset() {
    this.gameStartTime = Date.now();
    this.currentGameTime = 0;
    this.lastUpdateTime = 0;
    this.nextBossTime = this.bossInterval;
    this.firstBossSpawned = false;
    
    // Reset multipliers to base values
    this.currentHealthMultiplier = 1.0;
    this.currentSpeedMultiplier = 1.0;
    this.currentSpawnRateMultiplier = 1.0;
    this.currentSpawnQuantityMultiplier = 1.0;
    this.currentXPMultiplier = 1.0;
    
    console.log('🎯 Difficulty System reset for new game');
  }
  
  /**
   * Get current difficulty statistics for debugging
   * @returns {object} Difficulty stats object
   */
  getStats() {
    return {
      minutesSurvived: this.getMinutesSurvived(),
      healthMultiplier: this.currentHealthMultiplier,
      speedMultiplier: this.currentSpeedMultiplier,
      spawnRateMultiplier: this.currentSpawnRateMultiplier,
      spawnQuantityMultiplier: this.currentSpawnQuantityMultiplier,
      spawnQuantity: this.getSpawnQuantity(),
      xpMultiplier: this.currentXPMultiplier,
      eliteChance: this.getEliteChance(),
      timeUntilNextBoss: this.getTimeUntilNextBoss(),
      difficultyModifier: this.difficultyModifier
    };
  }
}


