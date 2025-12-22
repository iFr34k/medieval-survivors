/**
 * Advanced Spawn Controller
 * Manages dynamic enemy spawning with difficulty scaling and boss events
 */

export class SpawnController {
  constructor(difficultySystem) {
    this.difficultySystem = difficultySystem;
    
    // Spawn timing
    this.spawnTimer = 0;
    this.baseSpawnInterval = 1.0; // seconds (reduced from 1.5 for faster spawning)
    
    // Enemy limits and management
    this.maxEnemies = 1000; // Increased from 500
    this.enemies = []; // Reference to enemies array
    this.enemiesContainer = null; // PIXI container for enemy sprites
    this.world = null; // PIXI world container for hitboxes
    
    // Spawn location parameters
    this.spawnDistance = 750; // pixels from player (just outside camera)
    this.spawnSafetyMargin = 250; // additional random distance to keep spawns off-screen
    
    // Boss management
    this.activeBoss = null;
    this.bossSpawnPaused = false;
    this.bossAnnouncementCallback = null;
    
    // Enemy creation callback
    this.createEnemyCallback = null;
    
    // Performance tracking
    this.totalEnemiesSpawned = 0;
    this.elitesSpawned = 0;
    this.bossesSpawned = 0;
    
    console.log('🏭 Spawn Controller initialized');
    console.log(`   📊 Max enemies increased: 50 → ${this.maxEnemies} (1000)`);
    console.log(`   ⚡ Base spawn interval: ${this.baseSpawnInterval}s`);
  }
  
  /**
   * Initialize spawn controller with required references
   * @param {Array} enemiesArray - Reference to enemies array
   * @param {PIXI.Container} enemiesContainer - Container for enemy sprites
   * @param {PIXI.Container} worldContainer - World container for hitboxes
   * @param {Function} createEnemyCallback - Function to create enemy instances
   * @param {Function} bossAnnouncementCallback - Function to show boss announcements
   */
  initialize(enemiesArray, enemiesContainer, worldContainer, createEnemyCallback, bossAnnouncementCallback) {
    this.enemies = enemiesArray;
    this.enemiesContainer = enemiesContainer;
    this.world = worldContainer;
    this.createEnemyCallback = createEnemyCallback;
    this.bossAnnouncementCallback = bossAnnouncementCallback;
    
    console.log('🏭 Spawn Controller initialized with game references');
  }
  
  /**
   * Update spawn controller logic
   * @param {number} deltaTime - Time since last frame in seconds
   * @param {object} player - Player object with x, y coordinates
   * @param {boolean} gamePaused - Whether game is paused
   * @param {boolean} gameOver - Whether game is over
   */
  update(deltaTime, player, gamePaused, gameOver) {
    if (gameOver || gamePaused) return;
    
    // Check for boss spawn
    if (this.difficultySystem.shouldSpawnBoss() && !this.activeBoss) {
      this.spawnBoss(player);
      return; // Skip normal spawning during boss spawn
    }
    
    // Normal enemy spawning (paused during boss encounters)
    if (!this.bossSpawnPaused && this.enemies.length < this.maxEnemies) {
      this.spawnTimer += deltaTime;
      const currentSpawnInterval = this.getCurrentSpawnInterval();
      
      if (this.spawnTimer >= currentSpawnInterval) {
        this.spawnTimer = 0;
        this.spawnEnemy(player);
      }
    }
  }
  
  /**
   * Calculate current spawn interval based on difficulty scaling
   * @returns {number} Current spawn interval in seconds
   */
  getCurrentSpawnInterval() {
    const spawnRateMultiplier = this.difficultySystem.getSpawnRateMultiplier();
    return this.baseSpawnInterval / spawnRateMultiplier;
  }
  
  /**
   * Spawn enemies based on difficulty and type probabilities
   * Spawns multiple enemies per event based on quantity scaling
   * @param {object} player - Player object with x, y coordinates
   */
  spawnEnemy(player) {
    if (!this.createEnemyCallback) {
      console.error('🏭 Spawn Controller: createEnemyCallback not set');
      return;
    }
    
    // Get how many enemies to spawn this event
    const spawnQuantity = this.difficultySystem.getSpawnQuantity();
    const stats = this.difficultySystem.getStats();
    
    // Spawn multiple enemies, distributing them around the player
    for (let i = 0; i < spawnQuantity; i++) {
      // Check enemy limit before spawning
      if (this.enemies.length >= this.maxEnemies) {
        break; // Stop spawning if we hit the limit
      }
      
      // Calculate spawn position in a ring outside the viewport
      const minDistance = this.spawnDistance;
      const maxDistance = this.spawnDistance + this.spawnSafetyMargin;
      const distance = minDistance + Math.random() * (maxDistance - minDistance);
      const spawnPos = this.calculateSpawnPosition(player, distance);
      
      // Determine enemy type (each enemy can be different type)
      const enemyType = this.selectEnemyType();
      
      // Create enemy with appropriate stats
      const enemy = this.createEnemyCallback(spawnPos.x, spawnPos.y, enemyType);
      
      // Add to containers
      this.enemiesContainer.addChild(enemy.sprite);
      this.world.addChild(enemy.hitboxGraphics);
      this.enemies.push(enemy);
      
      // Update statistics
      this.totalEnemiesSpawned++;
      if (enemyType === 'elite') this.elitesSpawned++;
      
      // Debug logging for special enemy types
      if (enemyType !== 'normal') {
        const weights = this.getEnemyTypeWeights();
        console.log(`🏭 Spawned ${enemyType.toUpperCase()} enemy (${this.enemies.length}/${this.maxEnemies}) - Weights: N${(weights.normal * 100).toFixed(0)}% R${(weights.ranged * 100).toFixed(0)}% E${(weights.elite * 100).toFixed(0)}%`);
      }
    }
    
    // Log quantity spawns for debugging
    if (spawnQuantity > 1 && window.upgradeSystemInstance && window.upgradeSystemInstance.testingMode) {
      console.log(`🏭 Spawned ${spawnQuantity} enemies this wave (${this.enemies.length}/${this.maxEnemies} total)`);
    }
  }
  
  /**
   * Spawn a boss enemy
   * @param {object} player - Player object with x, y coordinates
   */
  spawnBoss(player) {
    if (!this.createEnemyCallback || !this.bossAnnouncementCallback) {
      console.error('🏭 Spawn Controller: Boss spawn callbacks not set');
      return;
    }
    
    // Show boss announcement
    this.bossAnnouncementCallback();
    
    // Calculate spawn position (farther away for bosses)
    const spawnPos = this.calculateSpawnPosition(player, this.spawnDistance * 1.5);
    
    // Create boss enemy
    const boss = this.createEnemyCallback(spawnPos.x, spawnPos.y, 'boss');
    
    // Add to containers
    this.enemiesContainer.addChild(boss.sprite);
    this.world.addChild(boss.hitboxGraphics);
    this.enemies.push(boss);
    
    // Set as active boss and pause normal spawning
    this.activeBoss = boss;
    this.bossSpawnPaused = true;
    
    // Update statistics  
    this.totalEnemiesSpawned++;
    this.bossesSpawned++;
    
    const minutes = this.difficultySystem.getMinutesSurvived();
    console.log(`👑 BOSS SPAWNED! (${minutes.toFixed(1)}min survived) - Total bosses: ${this.bossesSpawned}`);
  }
  
  /**
   * Calculate spawn position outside viewport
   * @param {object} player - Player object with x, y coordinates
   * @param {number} distance - Optional custom spawn distance
   * @returns {object} Spawn position {x, y}
   */
  calculateSpawnPosition(player, distance = this.spawnDistance) {
    const angle = Math.random() * Math.PI * 2;
    const spawnX = player.x + Math.cos(angle) * distance;
    const spawnY = player.y + Math.sin(angle) * distance;
    
    return { x: spawnX, y: spawnY };
  }
  
  /**
   * Get enemy type weights based on game time
   * @returns {object} Weights object {normal, ranged, elite}
   */
  getEnemyTypeWeights() {
    const minutes = this.difficultySystem.getMinutesSurvived();
    const hasDefeatedBoss = this.bossesSpawned > 0; // Track if any boss has spawned (defeated or not)
    
    // Early game (0-2 min): Very few ranged enemies
    if (minutes < 2) {
      return {
        normal: 0.97,
        ranged: 0.03,
        elite: 0.0
      };
    }
    
    // Mid game (2-6 min): More ranged enemies appear
    if (minutes < 6 && !hasDefeatedBoss) {
      return {
        normal: 0.80,
        ranged: 0.15,
        elite: 0.05
      };
    }
    
    // Post-boss: Slightly increased ranged spawn chance
    if (hasDefeatedBoss && minutes < 10) {
      return {
        normal: 0.75,
        ranged: 0.15,
        elite: 0.10
      };
    }
    
    // Late game (10+ min): More archer-focused harassment waves
    return {
      normal: 0.60,
      ranged: 0.25,
      elite: 0.15
    };
  }
  
  /**
   * Select enemy type based on weighted probabilities
   * @returns {string} Enemy type ('normal', 'ranged', 'elite', 'boss')
   */
  selectEnemyType() {
    // Bosses are handled separately in spawnBoss()
    const weights = this.getEnemyTypeWeights();
    
    // Normalize weights to ensure they sum to 1.0
    const totalWeight = weights.normal + weights.ranged + weights.elite;
    const normalized = {
      normal: weights.normal / totalWeight,
      ranged: weights.ranged / totalWeight,
      elite: weights.elite / totalWeight
    };
    
    // Weighted random selection
    const rand = Math.random();
    let cumulative = 0;
    
    cumulative += normalized.normal;
    if (rand < cumulative) {
      return 'normal';
    }
    
    cumulative += normalized.ranged;
    if (rand < cumulative) {
      return 'ranged';
    }
    
    return 'elite';
  }
  
  /**
   * Notify spawn controller that a boss has been defeated
   * @param {object} bossEnemy - The defeated boss enemy
   */
  onBossDefeated(bossEnemy) {
    if (this.activeBoss === bossEnemy) {
      this.activeBoss = null;
      this.bossSpawnPaused = false;
      
      console.log('👑 Boss defeated! Normal spawning resumed');
    }
  }
  
  /**
   * Check if an enemy is the active boss
   * @param {object} enemy - Enemy to check
   * @returns {boolean} True if enemy is active boss
   */
  isBoss(enemy) {
    return this.activeBoss === enemy;
  }
  
  /**
   * Get current spawn statistics
   * @returns {object} Spawn statistics
   */
  getStats() {
    const currentInterval = this.getCurrentSpawnInterval();
    const difficultyStats = this.difficultySystem.getStats();
    
    return {
      totalEnemiesSpawned: this.totalEnemiesSpawned,
      elitesSpawned: this.elitesSpawned,
      bossesSpawned: this.bossesSpawned,
      currentEnemyCount: this.enemies.length,
      maxEnemies: this.maxEnemies,
      currentSpawnInterval: currentInterval,
      baseSpawnInterval: this.baseSpawnInterval,
      spawnRateMultiplier: difficultyStats.spawnRateMultiplier,
      spawnQuantity: difficultyStats.spawnQuantity,
      spawnQuantityMultiplier: difficultyStats.spawnQuantityMultiplier,
      activeBoss: this.activeBoss !== null,
      bossSpawnPaused: this.bossSpawnPaused,
      eliteChance: difficultyStats.eliteChance
    };
  }
  
  /**
   * Reset spawn controller for new game
   */
  reset() {
    this.spawnTimer = 0;
    this.activeBoss = null;
    this.bossSpawnPaused = false;
    this.totalEnemiesSpawned = 0;
    this.elitesSpawned = 0;
    this.bossesSpawned = 0;
    
    console.log('🏭 Spawn Controller reset for new game');
  }
  
  /**
   * Set maximum enemy limit
   * @param {number} maxEnemies - New maximum enemy count
   */
  setMaxEnemies(maxEnemies) {
    this.maxEnemies = maxEnemies;
    console.log(`🏭 Max enemies set to ${maxEnemies}`);
  }
  
  /**
   * Force spawn boss for testing (optional debug feature)
   * @param {object} player - Player object with x, y coordinates
   */
  debugSpawnBoss(player) {
    if (!this.activeBoss) {
      this.spawnBoss(player);
    }
  }
  
  /**
   * Get time until next boss spawn
   * @returns {number} Seconds until next boss
   */
  getTimeUntilNextBoss() {
    return this.difficultySystem.getTimeUntilNextBoss();
  }
}


