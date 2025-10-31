// --- System Imports ---
import { LevelSystem } from './levelSystem.js';
import { UpgradeSystem, UpgradeCard } from './upgradeSystem.js';
import { DifficultySystem } from './difficultySystem.js';
import { SpawnController } from './spawnController.js';
import { ModifierSystem } from './modifierSystem.js';
import { CharacterSystem } from './characterSystem.js';
import { WeaponSystem, Weapon } from './weaponSystem.js';
import { ItemSystem } from './itemSystem.js';

// --- Basiskonstanten ---
const VIRTUAL_W = 1200;
const VIRTUAL_H = 800;

  // --- Keyboard Input ---
  const keys = {};
  const baseMoveSpeed = 200; // Base pixel per second (will be modified by modifiers)

// --- Combat State Variables (Global) ---
let combatMode = 'auto'; // 'auto' or 'manual'

// --- Game State Variables ---
let gamePaused = false;
let levelUpPopupActive = false;
let gameOver = false;

// --- Global Reset Function Reference ---
let resetGameFunction = null;

function handleKeyDown(e) {
  keys[e.key.toLowerCase()] = true;
  
  // Combat mode toggle
  if (e.key.toLowerCase() === 'f') {
    combatMode = combatMode === 'auto' ? 'manual' : 'auto';
    console.log('Combat Mode:', combatMode);
  }
  
  // Restart game on R key (only when game over)
  if (e.key.toLowerCase() === 'r' && gameOver && resetGameFunction) {
    resetGameFunction();
  }
  
  // Toggle testing mode on T key
  if (e.key.toLowerCase() === 't') {
    toggleTestingModeGlobal();
  }
  
  // Debug features (only in testing mode)
  if (window.upgradeSystemInstance && window.upgradeSystemInstance.testingMode) {
    // Force spawn boss with B key
    if (e.key.toLowerCase() === 'b' && window.spawnControllerInstance && window.playerInstance) {
      window.spawnControllerInstance.debugSpawnBoss(window.playerInstance);
    }
    
    // Show difficulty stats with D key  
    if (e.key.toLowerCase() === 'd' && window.difficultySystemInstance && window.spawnControllerInstance) {
      const diffStats = window.difficultySystemInstance.getStats();
      const spawnStats = window.spawnControllerInstance.getStats();
      console.log('📊 DIFFICULTY STATS:', diffStats);
      console.log('🏭 SPAWN STATS:', spawnStats);
    }
  }
}

// --- Testing Mode Toggle (outside of async function) ---
function toggleTestingModeGlobal() {
  if (window.upgradeSystemInstance && window.testingModeIndicator) {
    const isTestingMode = window.upgradeSystemInstance.toggleTestingMode();
    window.testingModeIndicator.visible = isTestingMode;
    
    // Update all hitbox visibility
    if (window.enemiesArray) {
      window.enemiesArray.forEach(enemy => {
        enemy.updateHitboxVisuals();
      });
    }
    
    if (window.playerInstance) {
      window.playerInstance.updateHitboxVisuals();
    }
    
    if (window.projectilesArray) {
      window.projectilesArray.forEach(projectile => {
        projectile.updateHitboxVisuals();
      });
    }
  }
}

function handleKeyUp(e) {
  keys[e.key.toLowerCase()] = false;
}

window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', handleKeyUp);

// --- Pixi App auf eigenem Canvas (async in v8) ---
(async () => {
  // Wait for fonts to load before initializing
  await document.fonts.ready;
  
  // Pixelart scharf halten - MUSS VOR der App-Initialisierung gesetzt werden!
  PIXI.TextureSource.defaultOptions.scaleMode = 'nearest';

  const canvas = document.getElementById('game');
  const app = new PIXI.Application();
  
  await app.init({
    canvas: canvas,
    width: VIRTUAL_W,
    height: VIRTUAL_H,
    backgroundColor: 0x0b0b0b,
    antialias: false,
    hello: true,
    preference: 'webgl', // WebGL für bessere Performance
  });

  // Top-down 2D game - single layer system (no parallax needed)
  // world: all game objects in same coordinate space (1:1 camera movement)
  // ui: HUD and menus
  const world = new PIXI.Container();
  const combatFX = new PIXI.Container();
  const ui = new PIXI.Container();
  app.stage.addChild(world, combatFX, ui);

  // --- Grass-Terrain ---
  const grassTexture = await PIXI.Assets.load('./src/assets/grass_tileset_v2.png');
  grassTexture.source.scaleMode = 'nearest';
  
  // Ensure pixel-perfect rendering
  grassTexture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;

  // TilingSprite für wiederholbares Gras - added directly to world (no parallax)
  const grass = new PIXI.TilingSprite(grassTexture);
  grass.width = VIRTUAL_W * 3;   // Extra groß für Scroll
  grass.height = VIRTUAL_H * 3;
  grass.position.set(-VIRTUAL_W, -VIRTUAL_H);  // Position angepasst
  grass.tileScale.set(0.25, 0.25);  // Textur-Wiederholung
  grass.tilePosition.set(0, 0);   // Initialer Offset explizit auf 0
  world.addChild(grass);
  
  console.log('🌱 TilingSprite erstellt:', grass.width, 'x', grass.height);

  // --- Knight Character ---
  const knightTexture = await PIXI.Assets.load('./src/assets/Knight.png');
  knightTexture.source.scaleMode = 'nearest';
  
  const player = new PIXI.Sprite(knightTexture);
  player.anchor.set(0.5); // Center anchor
  player.scale.set(0.1, 0.1); // Scale down to reasonable size
  player.position.set(VIRTUAL_W / 2, VIRTUAL_H / 2);
  world.addChild(player);
  
  // 🧪 Player Hitbox Visualization (Testing Mode)
  player.hitboxGraphics = new PIXI.Graphics();
  world.addChild(player.hitboxGraphics);
  
  // Player hitbox update function
  player.updateHitboxVisuals = function() {
    this.hitboxGraphics.clear();
    
    if (window.upgradeSystemInstance && window.upgradeSystemInstance.testingMode) {
      // Draw player collision radius (20px, blue circle)
      this.hitboxGraphics.circle(0, 0, 20)
        .stroke({ color: 0x00AAFF, width: 2, alpha: 0.7 });
        
      this.hitboxGraphics.visible = true;
    } else {
      this.hitboxGraphics.visible = false;
    }
  };
  
  // Player stats will be initialized after systems are created
  player.invulnerable = false;
  player.invulnerabilityTimer = 0;
  player.invulnerabilityDuration = 1.0; // seconds
  player.damageFlashTimer = 0;
  player.damageFlashDuration = 0.15; // seconds
  
  console.log('⚔️ Knight loaded:', knightTexture.width, 'x', knightTexture.height);

  // --- Sword Slash Projectile Texture ---
  const swordSlashTexture = await PIXI.Assets.load('./src/assets/sword_slash.png');
  swordSlashTexture.source.scaleMode = 'nearest';
  
  console.log('⚔️ Sword slash loaded:', swordSlashTexture.width, 'x', swordSlashTexture.height);

  // --- Enemy Textures ---
  const skeletonTexture = await PIXI.Assets.load('./src/assets/Skeleton.png');
  skeletonTexture.source.scaleMode = 'nearest';
  
  const skeletonEliteTexture = await PIXI.Assets.load('./src/assets/Skeleton_elite.png');
  skeletonEliteTexture.source.scaleMode = 'nearest';
  
  const skeletonBossTexture = await PIXI.Assets.load('./src/assets/Skeleton_Boss.png');
  skeletonBossTexture.source.scaleMode = 'nearest';
  
  console.log('💀 Skeleton loaded:', skeletonTexture.width, 'x', skeletonTexture.height);
  console.log('👑 Elite Skeleton loaded:', skeletonEliteTexture.width, 'x', skeletonEliteTexture.height);
  console.log('🏛️ Boss Skeleton loaded:', skeletonBossTexture.width, 'x', skeletonBossTexture.height);

  // --- Death Cloud and XP Orb Textures ---
  const deathCloudTexture = await PIXI.Assets.load('./src/assets/death_cloud.png');
  deathCloudTexture.source.scaleMode = 'nearest';

  const expOrbTexture = await PIXI.Assets.load('./src/assets/EXP.png');
  expOrbTexture.source.scaleMode = 'nearest';
  
  console.log('☁️ Death cloud loaded:', deathCloudTexture.width, 'x', deathCloudTexture.height);
  console.log('✨ XP Orb loaded:', expOrbTexture.width, 'x', expOrbTexture.height);
  
  // --- Sword Icon Texture ---
  const swordIconTexture = await PIXI.Assets.load('./src/assets/sword.png');
  swordIconTexture.source.scaleMode = 'nearest';
  console.log('🗡️ Sword icon loaded');

  // --- Projectile Class ---
  class Projectile {
    constructor(x, y, angle, speed, texture, size, rangeMultiplier, piercing, weapon) {
      this.sprite = new PIXI.Sprite(texture);
      this.sprite.anchor.set(0.5);
      this.sprite.scale.set(size, size);
      this.sprite.position.set(x, y);
      this.sprite.rotation = angle;
      
      this.angle = angle;
      this.speed = speed;
      this.lifetime = rangeMultiplier * 1.5; // Base 1.5 seconds * range multiplier
      this.age = 0;
      this.piercing = piercing || 1; // Number of enemies that can be hit total (piercing=1 means hits 1 enemy, no piercing)
      this.hitCount = 0; // Tracks total enemies hit
      this.hitEnemies = null; // Set to track which enemies have been hit (prevents double-hitting)
      this.weapon = weapon;
      
      // Store base texture dimensions for hitbox calculation
      this.baseTextureWidth = texture.width;
      this.baseTextureHeight = texture.height;
      this.spriteScale = size;
      this.collisionMultiplier = 0.9; // 90% of sprite size for tighter collision
      
      // 🧪 Projectile Hitbox Visualization (Testing Mode)
      this.hitboxGraphics = new PIXI.Graphics();
      this.updateHitboxVisuals();
      
      // Debug: Log texture dimensions and calculated hitbox
      const calculatedRadius = this.getHitboxRadius();
      console.log(`🚀 Projectile created: ${texture.width}x${texture.height}px texture, scale: ${size}, hitbox radius: ${calculatedRadius.toFixed(1)}px`);
    }
    
    // Calculate dynamic hitbox radius based on sprite size
    getHitboxRadius() {
      // Use the larger dimension (width or height) for circular hitbox
      const baseDimension = Math.max(this.baseTextureWidth, this.baseTextureHeight);
      return (baseDimension * this.spriteScale * this.collisionMultiplier) / 2;
    }
    
    update(deltaTime) {
      this.age += deltaTime;
      
      // Move projectile
      this.sprite.x += Math.cos(this.angle) * this.speed * deltaTime;
      this.sprite.y += Math.sin(this.angle) * this.speed * deltaTime;
      
      // Update hitbox position
      this.hitboxGraphics.x = this.sprite.x;
      this.hitboxGraphics.y = this.sprite.y;
      
      return this.age >= this.lifetime;
    }
    
    // 🧪 Update hitbox visualization based on testing mode
    updateHitboxVisuals() {
      this.hitboxGraphics.clear();
      
      if (window.upgradeSystemInstance && window.upgradeSystemInstance.testingMode) {
        // Draw projectile collision radius (dynamic size, yellow circle)
        const radius = this.getHitboxRadius();
        this.hitboxGraphics.circle(0, 0, radius)
          .stroke({ color: 0xFFAA00, width: 2, alpha: 0.6 });
          
        this.hitboxGraphics.visible = true;
        
        // Debug log for hitbox size (only once per projectile)
        if (!this.debugLogged) {
          console.log(`🎯 Projectile hitbox radius: ${radius.toFixed(1)}px (scale: ${this.spriteScale})`);
          this.debugLogged = true;
        }
      } else {
        this.hitboxGraphics.visible = false;
      }
    }
    
    destroy() {
      if (this.sprite.parent) {
        this.sprite.parent.removeChild(this.sprite);
      }
      if (this.hitboxGraphics.parent) {
        this.hitboxGraphics.parent.removeChild(this.hitboxGraphics);
      }
    }
  }

  // --- Enemy Class ---
  class Enemy {
    constructor(x, y, enemyType = 'normal', difficultySystem = null) {
      // Enemy type and base stats
      this.enemyType = enemyType;
      this.baseHp = 30;
      this.baseSpeed = 100;
      this.baseXPReward = 10; // Scaled to match 10x health/damage scaling
      
      // Select appropriate texture and stats based on enemy type
      let texture, spriteScale, statsMultiplier;
      
      switch (enemyType) {
        case 'elite':
          texture = skeletonEliteTexture;
          spriteScale = 0.065; // 1.3x normal size (0.05 * 1.3)
          statsMultiplier = {
            health: 3.0,
            speed: 1.2,
            xpReward: 3.0 // 3x XP (matches 3x health)
          };
          break;
          
        case 'boss':
          texture = skeletonBossTexture;
          spriteScale = 0.1; // 2.0x normal size (0.05 * 2.0)
          statsMultiplier = {
            health: 10.0,
            speed: 0.8,
            xpReward: 10.0 // 10x XP (matches 10x health)
          };
          break;
          
        default: // 'normal'
          texture = skeletonTexture;
          spriteScale = 0.05;
          statsMultiplier = {
            health: 1.0,
            speed: 1.0,
            xpReward: 1.0
          };
          break;
      }
      
      // Create sprite with selected texture
      this.sprite = new PIXI.Sprite(texture);
      this.sprite.anchor.set(0.5);
      this.sprite.scale.set(spriteScale, spriteScale);
      this.sprite.position.set(x, y);
      this.sprite.tint = 0xFFFFFF; // Start with normal color
      
      // Position
      this.x = x;
      this.y = y;
      
      // Apply difficulty scaling if provided
      let difficultyHealthMultiplier = 1.0;
      let difficultySpeedMultiplier = 1.0;
      let difficultyXPMultiplier = 1.0;
      
      if (difficultySystem) {
        difficultyHealthMultiplier = difficultySystem.getHealthMultiplier();
        difficultySpeedMultiplier = difficultySystem.getSpeedMultiplier();
        difficultyXPMultiplier = difficultySystem.getXPMultiplier();
      }
      
      // Elite/Boss-specific scaling multipliers on top of difficulty scaling
      const eliteMultiplier = enemyType === 'elite' ? 1.2 : enemyType === 'boss' ? 1.5 : 1.0;
      
      // Calculate final stats with type, difficulty, and elite/boss scaling
      const finalHealthMultiplier = statsMultiplier.health * difficultyHealthMultiplier * eliteMultiplier;
      const finalSpeedMultiplier = statsMultiplier.speed * difficultySpeedMultiplier * eliteMultiplier;
      const finalXPMultiplier = statsMultiplier.xpReward * difficultyXPMultiplier * eliteMultiplier;
      
      // Apply calculated stats
      this.maxHp = Math.ceil(this.baseHp * finalHealthMultiplier);
      this.hp = this.maxHp;
      this.speed = this.baseSpeed * finalSpeedMultiplier;
      this.xpReward = Math.ceil(this.baseXPReward * finalXPMultiplier);
      
      // Damage and visual effects
      this.damageFlashTimer = 0;
      this.damageFlashDuration = 0.15; // seconds (same as player)
      
      // Store dimensions for dynamic hitbox calculation
      this.baseTextureWidth = texture.width;
      this.baseTextureHeight = texture.height;
      this.spriteScale = spriteScale;
      this.collisionMultiplier = 0.8; // Slightly smaller than visual for gameplay feel
      
      // 🧪 Testing Mode - Hitbox visualization
      this.hitboxGraphics = new PIXI.Graphics();
      this.collisionThisFrame = false; // Track collisions for debugging
      this.updateHitboxVisuals();
      
      // Debug: Log enemy creation with stats
      const hitboxRadius = this.getHitboxRadius();
      const attackRadius = this.getAttackRadius();
      const difficultyInfo = difficultySystem ? ` (D: H${difficultyHealthMultiplier.toFixed(2)}x S${difficultySpeedMultiplier.toFixed(2)}x)` : '';
      console.log(`${this.getEnemyIcon()} ${enemyType.toUpperCase()} enemy: HP:${this.hp} Speed:${this.speed.toFixed(0)} XP:${this.xpReward} Scale:${spriteScale} Hitbox:${hitboxRadius.toFixed(1)}px${difficultyInfo}`);
    }
    
    /**
     * Get appropriate emoji icon for enemy type
     * @returns {string} Emoji icon
     */
    getEnemyIcon() {
      switch (this.enemyType) {
        case 'elite': return '👑';
        case 'boss': return '🏛️';
        default: return '💀';
      }
    }
    
    // Calculate dynamic hitbox radius based on sprite size
    getHitboxRadius() {
      // Use the smaller dimension for enemy hitbox (more forgiving)
      const baseDimension = Math.min(this.baseTextureWidth, this.baseTextureHeight);
      return (baseDimension * this.spriteScale * this.collisionMultiplier) / 2;
    }
    
    // Get attack radius (110% of hitbox radius)
    getAttackRadius() {
      return this.getHitboxRadius() * 1.1;
    }
    
    update(deltaTime, playerX, playerY) {
      // Move toward player (homing behavior)
      const dx = playerX - this.x;
      const dy = playerY - this.y;
      const dist = Math.hypot(dx, dy);
      
      if (dist > 0) {
        this.x += (dx / dist) * this.speed * deltaTime;
        this.y += (dy / dist) * this.speed * deltaTime;
      }
      
      this.sprite.x = this.x;
      this.sprite.y = this.y;
      
      // Update hitbox graphics position
      this.hitboxGraphics.x = this.x;
      this.hitboxGraphics.y = this.y;
      
      // Mirror sprite to face player direction
      if (dx > 0) {
        this.sprite.scale.x = Math.abs(this.sprite.scale.x); // Face right
      } else {
        this.sprite.scale.x = -Math.abs(this.sprite.scale.x); // Face left
      }
      
      // Update damage flash (same as player)
      if (this.damageFlashTimer > 0) {
        this.damageFlashTimer -= deltaTime;
        if (this.damageFlashTimer <= 0) {
          this.sprite.tint = 0xFFFFFF; // Reset to normal color
        }
      }
      
      return this.hp <= 0; // Return true if dead
    }
    
    // 🧪 Update hitbox visualization based on testing mode
    updateHitboxVisuals() {
      this.hitboxGraphics.clear();
      
      if (window.upgradeSystemInstance && window.upgradeSystemInstance.testingMode) {
        const enemyRadius = this.getHitboxRadius();
        const attackRadius = this.getAttackRadius();
        
        // Choose colors based on collision state
        const attackColor = this.collisionThisFrame ? 0xFFFF00 : 0xFF0000; // Yellow if colliding, red if not
        const hitboxColor = this.collisionThisFrame ? 0xFFFF44 : 0xFF4444; // Lighter if colliding
        const attackAlpha = this.collisionThisFrame ? 0.9 : 0.6; // More opaque if colliding
        
        // Draw attack radius (110% of enemy hitbox, outer circle)
        this.hitboxGraphics.circle(0, 0, attackRadius)
          .stroke({ color: attackColor, width: 2, alpha: attackAlpha });
        
        // Draw projectile collision radius (enemy radius only, inner circle)
        this.hitboxGraphics.circle(0, 0, enemyRadius)
          .stroke({ color: hitboxColor, width: 1, alpha: 0.8 });
          
        this.hitboxGraphics.visible = true;
      } else {
        this.hitboxGraphics.visible = false;
      }
    }
    
    takeDamage(amount, isCrit = false) {
      this.hp -= amount;
      
      // Critical hits get shorter, orange flash; normal hits get red flash
      if (isCrit) {
        this.damageFlashTimer = 0.1; // 0.1s flash for crits
        this.sprite.tint = 0xFFA500; // Orange flash for critical hits
        this.isCritFlash = true; // Track crit state for update()
      } else {
        this.damageFlashTimer = this.damageFlashDuration; // 0.15s for normal
        this.sprite.tint = 0xFF0000; // Red flash (same as player)
        this.isCritFlash = false;
      }
    }
    
    destroy() {
      if (this.sprite.parent) {
        this.sprite.parent.removeChild(this.sprite);
      }
      if (this.hitboxGraphics.parent) {
        this.hitboxGraphics.parent.removeChild(this.hitboxGraphics);
      }
    }
  }

  // --- DeathCloud Class ---
  class DeathCloud {
    constructor(x, y) {
      this.sprite = new PIXI.Sprite(deathCloudTexture);
      this.sprite.anchor.set(0.5);
      this.sprite.scale.set(0.1, 0.1); // Reduced by 50% (0.2 * 0.5 = 0.1)
      this.sprite.position.set(x, y);
      
      this.lifetime = 0.3; // 0.3 seconds
      this.age = 0;
    }
    
    update(deltaTime) {
      this.age += deltaTime;
      return this.age >= this.lifetime;
    }
    
    destroy() {
      if (this.sprite.parent) {
        this.sprite.parent.removeChild(this.sprite);
      }
    }
  }

  // --- DamageNumber Class ---
  class DamageNumber {
    constructor(x, y, damage, isCrit = false, customColor = null) {
      // Configure text style based on crit or custom color
      const fontSize = isCrit ? 16 : 12;
      const fillColor = customColor || (isCrit ? 0xFFA500 : 0xFFFFFF); // Custom color, orange for crit, white for normal
      const fontFamily = '"Press Start 2P", monospace'; // Pixel font with fallback
      
      // Store custom color for reset
      this.customColor = customColor;
      
      this.text = new PIXI.Text(damage.toString(), {
        fontFamily: fontFamily,
        fontSize: fontSize,
        fill: fillColor,
        align: 'center',
        fontWeight: isCrit ? 'bold' : 'normal'
      });
      this.text.anchor.set(0.5);
      this.text.position.set(x, y);
      
      // Track crit state for animations
      this.isCrit = isCrit;
      
      // Animation properties
      this.startX = x;
      this.startY = y;
      this.lifetime = 0.8; // 0.8 seconds
      this.age = 0;
      this.velocityY = -(80 + Math.random() * 40); // -80 to -120 px/s (upward)
      this.driftX = (Math.random() - 0.5) * 40; // ±20px horizontal drift
      
      // For crits: slight scale pulse effect
      if (isCrit) {
        this.text.scale.set(1.2, 1.2); // Start slightly larger
      }
      
      this.isActive = true;
    }
    
    update(deltaTime) {
      if (!this.isActive) return true; // Ready for recycling
      
      this.age += deltaTime;
      const progress = this.age / this.lifetime;
      
      // Move upward
      this.text.y = this.startY + this.velocityY * this.age;
      
      // Apply horizontal drift
      this.text.x = this.startX + (this.driftX * progress);
      
      // Fade out
      this.text.alpha = 1.0 - progress;
      
      // For crits: scale pulse (slight bounce)
      if (this.isCrit) {
        const pulse = 1.0 + Math.sin(progress * Math.PI * 3) * 0.1; // Subtle pulse
        this.text.scale.x = 1.2 * pulse;
        this.text.scale.y = 1.2 * pulse;
      }
      
      // Check if animation complete
      if (this.age >= this.lifetime) {
        return true; // Ready for recycling
      }
      
      return false;
    }
    
    reset(x, y, damage, isCrit = false, customColor = null) {
      // Reuse existing text object
      this.text.text = damage.toString();
      this.text.position.set(x, y);
      
      // Update crit state and custom color
      this.isCrit = isCrit;
      this.customColor = customColor;
      
      // Reset style for crit/normal/custom
      const fontSize = isCrit ? 16 : 12;
      const fillColor = customColor || (isCrit ? 0xFFA500 : 0xFFFFFF);
      const fontFamily = '"Press Start 2P", monospace'; // Pixel font with fallback
      
      this.text.style.fontFamily = fontFamily;
      this.text.style.fontSize = fontSize;
      this.text.style.fill = fillColor;
      this.text.style.fontWeight = isCrit ? 'bold' : 'normal';
      
      // Reset animation properties
      this.startX = x;
      this.startY = y;
      this.age = 0;
      this.velocityY = -(80 + Math.random() * 40);
      this.driftX = (Math.random() - 0.5) * 40;
      this.text.alpha = 1.0;
      
      // Reset scale
      if (isCrit) {
        this.text.scale.set(1.2, 1.2);
      } else {
        this.text.scale.set(1.0, 1.0);
      }
      
      this.isActive = true;
    }
    
    destroy() {
      if (this.text.parent) {
        this.text.parent.removeChild(this.text);
      }
      this.isActive = false;
    }
  }

  // --- XPOrb Class ---
  // World-space object - position uses world coordinates, moved by camera via world container
  class XPOrb {
    constructor(x, y, xpValue = 1) {
      this.sprite = new PIXI.Sprite(expOrbTexture);
      this.sprite.anchor.set(0.5);
      
      // Scale XP orb size based on XP value (larger orbs for more XP, scaled for x10 values)
      const baseScale = 0.02;
      // Scale based on XP value: normalize to old scale (divide by 10), then apply growth
      const normalizedXP = xpValue / 10;
      const sizeMultiplier = Math.min(1 + (normalizedXP - 1) * 0.1, 2.0); // Grow by 10% per extra normalized XP, cap at 2x
      const finalScale = baseScale * sizeMultiplier;
      this.sprite.scale.set(finalScale, finalScale);
      
      // Color tint based on enemy type (scaled x10)
      if (xpValue >= 100) {
        this.sprite.tint = 0xFF0000; // Red for boss XP (100+)
      } else if (xpValue >= 30) {
        this.sprite.tint = 0x00FF00; // Green for elite XP (30+)
      } else {
        this.sprite.tint = 0xFFFFFF; // Normal sprite (no tint) for normal enemy XP (10-29)
      }
      
      // Set position in world coordinates (not parallax-adjusted)
      this.sprite.position.set(x, y);
      
      this.xpValue = xpValue;
      this.pickupRadius = 40; // Doubled from 20 to 40
      this.collectionRadius = 15; // Radius at which XP is actually collected (very close to player)
      this.isBeingPulled = false;
      this.pullSpeed = 400; // Speed at which orb moves toward player (px/s)
      this.rotationSpeed = 0; // For optional rotation effect
      this.baseScale = finalScale; // Store original scale for animation
    }
    
    update(deltaTime, playerX, playerY) {
      // Check distance to player in world coordinates
      const dx = playerX - this.sprite.x;
      const dy = playerY - this.sprite.y;
      const dist = Math.hypot(dx, dy);
      
      // If within pickup radius but not collected yet, start magnetic pull
      if (dist < this.pickupRadius && dist > this.collectionRadius) {
        if (!this.isBeingPulled) {
          this.isBeingPulled = true;
          this.rotationSpeed = 5; // Start rotation when pulled
        }
        
        // Calculate direction to player
        const dirX = dx / dist;
        const dirY = dy / dist;
        
        // Move toward player (magnetic pull)
        const moveDistance = this.pullSpeed * deltaTime;
        this.sprite.x += dirX * moveDistance;
        this.sprite.y += dirY * moveDistance;
        
        // Rotate the sprite for visual effect
        if (this.rotationSpeed > 0) {
          this.sprite.rotation += this.rotationSpeed * deltaTime;
        }
        
        // Scale up slightly when being pulled (pulsing effect)
        const pullProgress = (this.pickupRadius - dist) / (this.pickupRadius - this.collectionRadius);
        const pulseScale = 1.0 + Math.sin(pullProgress * Math.PI * 4) * 0.1; // Subtle pulse
        const targetScale = this.baseScale * 1.1 * pulseScale;
        this.sprite.scale.x = targetScale;
        this.sprite.scale.y = targetScale;
        
        return false; // Not collected yet
      }
      
      // If very close to player, collect it
      if (dist <= this.collectionRadius) {
        return true; // Collected
      }
      
      // Reset pull state if moved out of range (shouldn't happen, but safety check)
      if (this.isBeingPulled && dist >= this.pickupRadius) {
        this.isBeingPulled = false;
        this.rotationSpeed = 0;
        this.sprite.rotation = 0;
        this.sprite.scale.set(this.baseScale, this.baseScale);
      }
      
      return false;
    }
    
    destroy() {
      if (this.sprite.parent) {
        this.sprite.parent.removeChild(this.sprite);
      }
      return this.xpValue; // Return XP value when destroyed
    }
  }

  // Weapon class is now imported from weaponSystem.js

  // --- Aiming Line ---
  const aimRay = new PIXI.Graphics();
  world.addChild(aimRay);

  // --- Aim Cone Visualization ---
  const aimCone = new PIXI.Graphics();
  world.addChild(aimCone);

  // --- Mouse Input ---
  const mouse = { x: VIRTUAL_W/2, y: VIRTUAL_H/2 };
  window.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) * (VIRTUAL_W / rect.width);
    const ny = (e.clientY - rect.top) * (VIRTUAL_H / rect.height);
    mouse.x = nx; 
    mouse.y = ny;
  });

  // Mouse button tracking for manual fire
  window.addEventListener('mousedown', (e) => {
    mousePressed = true;
  });
  
  window.addEventListener('mouseup', (e) => {
    mousePressed = false;
  });

  // --- Responsive Skalierung (letterbox, behält Seitenverhältnis) ---
  function resize() {
    const sw = window.innerWidth;
    const sh = window.innerHeight;
    const scale = Math.min(sw / VIRTUAL_W, sh / VIRTUAL_H);

    // Setze die CSS-Größe (skaliert visuell), Renderer bleibt in virtueller Auflösung
    const cssW = Math.floor(VIRTUAL_W * scale);
    const cssH = Math.floor(VIRTUAL_H * scale);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';

    // Zentrieren
    canvas.style.position = 'absolute';
    canvas.style.left = ((sw - cssW) / 2) + 'px';
    canvas.style.top = ((sh - cssH) / 2) + 'px';
  }
  window.addEventListener('resize', resize);
  resize();

  // --- Camera System ---
  const camera = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    followSpeed: 8 // Camera follow speed multiplier
  };

  // --- Combat State Variables ---
  let mousePressed = false;
  const projectiles = [];

  // --- Projectile Container ---
  const projectilesContainer = new PIXI.Container();
  world.addChild(projectilesContainer);

  // --- Enemy System ---
  const enemiesContainer = new PIXI.Container();
  world.addChild(enemiesContainer);

  const enemies = [];
  
  // --- Difficulty & Spawn Systems ---
  const difficultySystem = new DifficultySystem();
  const spawnController = new SpawnController(difficultySystem);
  
  // Create enemy function for spawn controller
  function createEnemyWithScaling(x, y, enemyType = 'normal') {
    return new Enemy(x, y, enemyType, difficultySystem);
  }
  
  // --- Boss Announcement UI ---
  let bossAnnouncementContainer = null;
  let bossAnnouncementTimer = 0;
  const bossAnnouncementDuration = 3.0; // seconds
  
  function showBossAnnouncement() {
    console.log('👑 BOSS SPAWNING! ⚔️ A Boss Approaches! ⚔️');
    
    // Create announcement container if not exists
    if (!bossAnnouncementContainer) {
      bossAnnouncementContainer = new PIXI.Container();
      ui.addChild(bossAnnouncementContainer);
    }
    
    // Clear any existing announcement
    bossAnnouncementContainer.removeChildren();
    
    // Create background overlay
    const overlay = new PIXI.Graphics();
    overlay.rect(0, 0, VIRTUAL_W, 120);
    overlay.fill(0x000000, 0.8);
    overlay.position.set(0, VIRTUAL_H / 2 - 60);
    bossAnnouncementContainer.addChild(overlay);
    
    // Main announcement text
    const mainText = new PIXI.Text('⚔️ A BOSS APPROACHES! ⚔️', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: 24,
      fill: 0xFF0000,
      fontWeight: 'bold',
      align: 'center'
    });
    mainText.anchor.set(0.5);
    mainText.position.set(VIRTUAL_W / 2, VIRTUAL_H / 2 - 20);
    bossAnnouncementContainer.addChild(mainText);
    
    // Warning subtitle
    const subtitleText = new PIXI.Text('Prepare for battle!', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: 14,
      fill: 0xFFD700,
      align: 'center'
    });
    subtitleText.anchor.set(0.5);
    subtitleText.position.set(VIRTUAL_W / 2, VIRTUAL_H / 2 + 25);
    bossAnnouncementContainer.addChild(subtitleText);
    
    // Show announcement and start timer
    bossAnnouncementContainer.visible = true;
    bossAnnouncementTimer = bossAnnouncementDuration;
    
    // Add pulsing animation effect
    const pulseAnimation = () => {
      if (bossAnnouncementContainer && bossAnnouncementContainer.visible) {
        const scale = 1 + Math.sin(Date.now() * 0.008) * 0.1;
        mainText.scale.set(scale, scale);
      }
    };
    
    // Start animation
    const animationInterval = setInterval(() => {
      pulseAnimation();
      if (bossAnnouncementTimer <= 0) {
        clearInterval(animationInterval);
      }
    }, 16); // ~60fps
  }
  
  function updateBossAnnouncement(deltaTime) {
    if (bossAnnouncementContainer && bossAnnouncementContainer.visible) {
      bossAnnouncementTimer -= deltaTime;
      
      if (bossAnnouncementTimer <= 0) {
        bossAnnouncementContainer.visible = false;
      }
    }
  }
  
  // Initialize spawn controller
  spawnController.initialize(enemies, enemiesContainer, world, createEnemyWithScaling, showBossAnnouncement);

  // --- Core Systems Initialization (order matters) ---
  const modifierSystem = new ModifierSystem();
  const characterSystem = new CharacterSystem(modifierSystem);
  const weaponSystem = new WeaponSystem();
  const itemSystem = new ItemSystem(modifierSystem);
  const levelSystem = new LevelSystem();
  const upgradeSystem = new UpgradeSystem(weaponSystem, itemSystem, modifierSystem);
  
  // --- Player Initialization via Character System ---
  const selectedCharacter = characterSystem.getSelectedCharacter();
  const baseStats = characterSystem.getBaseStats(selectedCharacter);
  const finalStats = characterSystem.getFinalStats(1, selectedCharacter); // Level 1
  
  // Initialize player stats
  player.maxHp = finalStats.maxHP;
  player.hp = player.maxHp;
  player.armor = finalStats.armor;
  player.damageReduction = finalStats.damageReduction;
  player.moveSpeed = finalStats.moveSpeed;
  player.pickupRange = finalStats.pickupRange;
  player.xpGain = finalStats.xpGain;
  player.luck = finalStats.luck;
  
  const xpOrbs = [];
  const deathClouds = [];
  const damageNumbers = [];
  const damageNumberPool = [];
  
  // --- Damage Number Pool & Creation Function ---
  function createDamageNumber(x, y, damage, isCrit = false, customColor = null) {
    let dmgNum;
    
    // Try to reuse from pool
    if (damageNumberPool.length > 0) {
      dmgNum = damageNumberPool.pop();
      dmgNum.reset(x, y, damage, isCrit, customColor);
    } else {
      // Create new instance if pool empty
      dmgNum = new DamageNumber(x, y, damage, isCrit, customColor);
    }
    
    // Add to combatFX container
    combatFX.addChild(dmgNum.text);
    damageNumbers.push(dmgNum);
    
    // Limit active damage numbers (performance safeguard)
    if (damageNumbers.length > 100) {
      const oldest = damageNumbers.shift();
      oldest.destroy();
      damageNumberPool.push(oldest);
    }
  }
  
  // --- Make systems globally accessible for testing and debugging ---
  window.upgradeSystemInstance = upgradeSystem;
  window.difficultySystemInstance = difficultySystem;
  window.spawnControllerInstance = spawnController;
  window.enemiesArray = enemies; // Make enemies accessible for hitbox toggling
  window.playerInstance = player; // Make player accessible for hitbox toggling
  window.projectilesArray = projectiles; // Make projectiles accessible for hitbox toggling
  
  // --- Initialize player hitbox ---
  player.hitboxGraphics.x = player.x;
  player.hitboxGraphics.y = player.y;
  player.updateHitboxVisuals();
  
  // --- Log testing mode status ---
  console.log(`🧪 Testing Mode: ${upgradeSystem.testingMode ? 'ENABLED' : 'DISABLED'} - Percentage upgrades are ${upgradeSystem.testingMode ? '10x boosted' : 'normal values'}`);
  console.log(`🎯 Testing Mode Features: 10x upgrades + DYNAMIC hitbox visualization + Debug tools:`);
  console.log(`   🔴 Red circles: Enemy hitboxes (DYNAMIC - match sprite size)`);
  console.log(`     - Outer circle: Attack range (110% of enemy hitbox)`);
  console.log(`     - Inner circle: Projectile collision range (enemy hitbox only)`);
  console.log(`     - 🟡 YELLOW when colliding with other enemies!`);
  console.log(`   🔵 Blue circles: Player hitboxes (visual reference only)`);
  console.log(`   🟡 Yellow circles: Projectile hitboxes (90% of sprite size - scales with size upgrades)`);
  console.log(`   ⚡ Multi-hit: Projectiles can hit multiple enemies simultaneously if hitboxes overlap`);
  console.log(`   ⚔️ Enemy-Enemy Collisions: Enemies push each other apart using dynamic hitboxes`);
  console.log(`   📊 Difficulty Scaling: Enemy stats scale exponentially over time`);
  console.log(`   👑 Elite & Boss Enemies: Tougher variants with enhanced rewards`);
  console.log(`🎮 Controls: T=Toggle testing mode, B=Force boss spawn, D=Show difficulty stats`);
  
  // --- XP Orbs Container ---
  // Note: In world container - parallax should NOT be applied here since orbs are world-space objects
  const xpOrbsContainer = new PIXI.Container();
  world.addChild(xpOrbsContainer);
  
  // --- Death Clouds Container ---
  const deathCloudsContainer = new PIXI.Container();
  world.addChild(deathCloudsContainer);

  // --- Level-Up Popup Container ---
  const levelUpContainer = new PIXI.Container();
  levelUpContainer.visible = false;
  ui.addChild(levelUpContainer);

  // --- Timer UI Display ---
  const timerText = new PIXI.Text('00:00', {
    fontFamily: '"Press Start 2P", monospace',
    fontSize: 16,
    fill: 0xFFFFFF,
    align: 'center',
    fontWeight: 'bold'
  });
  timerText.anchor.set(0.5);
  timerText.position.set(VIRTUAL_W / 2, 30);
  ui.addChild(timerText);

  // --- XP UI Display ---
  const xpText = new PIXI.Text(levelSystem.getXPDisplayText(), {
    fontFamily: '"Press Start 2P", monospace',
    fontSize: 14,
    fill: 0xFFFFFF,
    align: 'center'
  });
  xpText.anchor.set(0.5);
  xpText.position.set(VIRTUAL_W / 2, VIRTUAL_H - 30);
  ui.addChild(xpText);
  
  // --- Future Weapon Types ---
  // Example structures for additional weapons:
  // - Bow: high range, low attack speed, piercing arrows
  // - Fireball: AOE damage, slower projectiles, burn effect
  // - Magic Staff: multiple projectiles, homing behavior
  // - Throwing Axe: boomerang return, high damage
  
  // --- Example Weapon Configurations for Future Implementation ---
  
  // BOW (High range, piercing arrows)
  // {
  //   name: 'Longbow',
  //   type: 'ranged_physical',
  //   damage: 2,
  //   attackSpeed: 0.8,
  //   range: 3.0,
  //   piercing: 3,
  //   projectileSpeed: 800,
  //   knockback: 50
  // }
  
  // FIREBALL (AOE, burn effect)
  // {
  //   name: 'Fireball',
  //   type: 'ranged_magic',
  //   damage: 3,
  //   attackSpeed: 1.2,
  //   range: 2.0,
  //   projectileSpeed: 400,
  //   aoeRadius: 100,
  //   elementType: 'fire',
  //   onHitEffect: 'burn',
  //   statusDuration: 3.0,
  //   statusDamage: 1
  // }
  
  // SHOTGUN (Multi-projectile spread)
  // {
  //   name: 'Shotgun',
  //   type: 'ranged_physical',
  //   damage: 1,
  //   attackSpeed: 1.0,
  //   range: 0.8,
  //   projectileCount: 8,
  //   spreadAngle: Math.PI / 6,
  //   ammo: 12,
  //   reloadTime: 2.0
  // }
  
  // MAGIC STAFF (Homing missiles)
  // {
  //   name: 'Magic Staff',
  //   type: 'ranged_magic',
  //   damage: 2,
  //   attackSpeed: 0.6,
  //   range: 2.5,
  //   projectileCount: 3,
  //   homingStrength: 200,
  //   energyCost: 10
  // }
  
  // ICE WAND (Slow effect)
  // {
  //   name: 'Frost Wand',
  //   type: 'ranged_magic',
  //   damage: 1,
  //   attackSpeed: 0.7,
  //   elementType: 'ice',
  //   onHitEffect: 'slow',
  //   statusDuration: 2.0
  // }
  
  // THROWING AXE (Boomerang)
  // {
  //   name: 'Throwing Axe',
  //   type: 'melee_projectile',
  //   damage: 4,
  //   attackSpeed: 1.5,
  //   range: 1.5,
  //   piercing: 999,
  //   boomerang: true
  // }
  
  // CHAIN LIGHTNING
  // {
  //   name: 'Chain Lightning',
  //   type: 'ranged_magic',
  //   damage: 2,
  //   attackSpeed: 0.8,
  //   elementType: 'holy',
  //   chainTargets: 5,
  //   energyCost: 15
  // }
  
  // LASER BEAM (Continuous)
  // {
  //   name: 'Laser Rifle',
  //   type: 'ranged_tech',
  //   damage: 1,
  //   beamDuration: 2.0,
  //   range: 3.0,
  //   energyCost: 5
  // }
  
  // --- Original Weapon Configuration ---
  const originalSwordConfig = {
    // Basic info
    name: 'Sword Slash',
    type: 'melee_projectile',
    level: 1,
    iconTexture: swordIconTexture,
    projectileTexture: swordSlashTexture,
    
    // Core combat
    damage: 10,
    attackSpeed: 0.5,
    range: 0.375,
    piercing: 1,
    projectileSpeed: 600,
    projectileSize: 0.03,
    
    // Critical hits
    critChance: 0.1,
    critDamage: 2.0,
    
    // Multi-projectile (unused for sword)
    projectileCount: 1,
    spreadAngle: 0,
    
    // AOE (unused for sword)
    aoeRadius: 0,
    aoeDamageMultiplier: 1.0,
    
    // Knockback & physics
    knockback: 1,
    
    // Elemental & status
    elementType: 'physical',
    onHitEffect: null,
    statusDuration: 0,
    statusDamage: 0,
    
    // Resources (unlimited for sword)
    cooldown: 0,
    ammo: null,
    energyCost: 0,
    reloadTime: 0,
    
    // Advanced behavior (unused for sword)
    homingStrength: 0,
    chainTargets: 0,
    boomerang: false,
    beamDuration: 0
  };
  
  // --- Load Item Sprites ---
  const scholarsTombTexture = await PIXI.Assets.load('./src/assets/Scholars_tomb.png');
  scholarsTombTexture.source.scaleMode = 'nearest';
  
  // Set item icon textures
  itemSystem.itemConfigs['ScholarsTomb'].iconTexture = scholarsTombTexture;
  
  // --- Starting Weapon via WeaponSystem ---
  const swordWeapon = weaponSystem.createWeapon(originalSwordConfig);
  
  player.weapons = [swordWeapon];
  player.currentWeapon = swordWeapon;
  
  // --- HP UI Display ---
  const hpText = new PIXI.Text(`HP: ${player.maxHp}/${player.maxHp}`, {
    fontFamily: '"Press Start 2P", monospace',
    fontSize: 14,
    fill: 0xFF6B6B,
    align: 'left'
  });
  hpText.anchor.set(0);
  hpText.position.set(20, VIRTUAL_H - 50);
  ui.addChild(hpText);
  
  // --- Game Over Text ---
  const gameOverText = new PIXI.Text('GAME OVER', {
    fontFamily: '"Press Start 2P", monospace',
    fontSize: 32,
    fill: 0xFF0000,
    align: 'center',
    stroke: 0x000000,
    strokeThickness: 4
  });
  gameOverText.anchor.set(0.5);
  gameOverText.position.set(VIRTUAL_W / 2, VIRTUAL_H / 2 - 40);
  gameOverText.visible = false;
  ui.addChild(gameOverText);
  
  // --- Restart Instructions ---
  const restartText = new PIXI.Text('Press R to restart', {
    fontFamily: '"Press Start 2P", monospace',
    fontSize: 14,
    fill: 0xFFFFFF,
    align: 'center',
    stroke: 0x000000,
    strokeThickness: 2
  });
  restartText.anchor.set(0.5);
  restartText.position.set(VIRTUAL_W / 2, VIRTUAL_H / 2 + 40);
  restartText.visible = false;
  ui.addChild(restartText);
  
  // --- Testing Mode Indicator ---
  const testingModeText = new PIXI.Text('🧪 TESTING MODE - 10x Upgrades + Hitboxes', {
    fontFamily: '"Press Start 2P", monospace',
    fontSize: 10,
    fill: 0x00FF00,
    align: 'left',
    stroke: 0x000000,
    strokeThickness: 1
  });
  testingModeText.anchor.set(0);
  testingModeText.position.set(20, 20);
  testingModeText.visible = upgradeSystem.testingMode;
  ui.addChild(testingModeText);
  
  // --- Make testing mode indicator globally accessible ---
  window.testingModeIndicator = testingModeText;
  
  // --- Weapons UI Display (Top-Right) ---
  const weaponsUIContainer = new PIXI.Container();
  weaponsUIContainer.position.set(VIRTUAL_W - 100, 20);
  ui.addChild(weaponsUIContainer);
  
  // --- Items UI Display (Left of Weapons UI) ---
  const itemsUIContainer = new PIXI.Container();
  itemsUIContainer.position.set(VIRTUAL_W - 160, 20); // Left of weapons UI (50px gap)
  ui.addChild(itemsUIContainer);
  
  function updateWeaponsUI() {
    weaponsUIContainer.removeChildren();
    
    player.weapons.forEach((weapon, index) => {
      const weaponBox = new PIXI.Graphics();
      weaponBox.rect(0, 0, 50, 50)
        .fill(0x2a2a2a)
        .stroke({ color: 0x555555, width: 2 });
      weaponBox.position.set(0, index * 60);
      
      const icon = new PIXI.Sprite(weapon.iconTexture);
      icon.anchor.set(0.5);
      icon.scale.set(0.08, 0.08); // Adjust for sword icon
      icon.position.set(25, 25);
      weaponBox.addChild(icon);
      
      const levelText = new PIXI.Text(`Lv${weapon.level}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 8,
        fill: 0xFFFFFF
      });
      levelText.anchor.set(0.5);
      levelText.position.set(25, 45);
      weaponBox.addChild(levelText);
      
      weaponsUIContainer.addChild(weaponBox);
    });
  }
  
  function updateItemsUI() {
    itemsUIContainer.removeChildren();
    
    const ownedItems = itemSystem.getOwnedItems();
    const itemNames = Object.keys(ownedItems);
    
    itemNames.forEach((itemName, index) => {
      const item = ownedItems[itemName];
      const config = item.config;
      
      if (!config.iconTexture) return; // Skip if no icon
      
      const itemBox = new PIXI.Graphics();
      itemBox.rect(0, 0, 50, 50)
        .fill(0x2a2a2a)
        .stroke({ color: 0x555555, width: 2 });
      itemBox.position.set(0, index * 60);
      
      const icon = new PIXI.Sprite(config.iconTexture);
      icon.anchor.set(0.5);
      
      // Adjust scale for Scholar's Tomb (it's a larger sprite)
      if (itemName === 'ScholarsTomb') {
        icon.scale.set(0.05, 0.05); // Smaller scale for Scholar's Tomb
      } else {
        icon.scale.set(0.08, 0.08); // Same scale as weapons for other items
      }
      
      icon.position.set(25, 25);
      itemBox.addChild(icon);
      
      const levelText = new PIXI.Text(`Lv${item.level}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 8,
        fill: 0xFFFFFF
      });
      levelText.anchor.set(0.5);
      levelText.position.set(25, 45);
      itemBox.addChild(levelText);
      
      itemsUIContainer.addChild(itemBox);
    });
  }
  
  updateWeaponsUI();
  updateItemsUI();

  // --- Fire Weapon Function ---
  function fireWeapon(angle) {
    player.currentWeapon.fire(
      player.x, player.y, angle,
      projectilesContainer, projectiles,
      world,
      Projectile // Pass Projectile class to Weapon.fire()
    );
  }
  
  // --- Player Take Damage Function ---
  function takeDamage(amount) {
    if (player.invulnerable) return; // Already invulnerable
    
    // Apply armor (flat damage reduction)
    const baseArmor = characterSystem.getBaseStats().armor || 0;
    const finalArmor = modifierSystem.getFinalStat('armor', baseArmor);
    let finalDamage = Math.max(0, amount - finalArmor);
    
    // Apply damage reduction (percentage-based, Knight's unique stat)
    const baseDamageReduction = characterSystem.getBaseStats().damageReduction || 0;
    const finalDamageReduction = modifierSystem.getFinalStat('damageReduction', baseDamageReduction);
    const maxDamageReductionCap = characterSystem.characterConfigs[characterSystem.getSelectedCharacter()].maxDamageReductionCap || 0.50;
    const cappedDamageReduction = Math.min(finalDamageReduction, maxDamageReductionCap);
    
    finalDamage = finalDamage * (1 - cappedDamageReduction);
    
    const actualDamage = Math.round(finalDamage);
    player.hp -= actualDamage;
    player.damageFlashTimer = player.damageFlashDuration;
    player.tint = 0xff0000; // Red flash
    
    // Spawn player damage number with health bar color
    createDamageNumber(player.x, player.y - 40, actualDamage, false, 0xFF6B6B);
    
    // Set invulnerability
    player.invulnerable = true;
    player.invulnerabilityTimer = player.invulnerabilityDuration;
    
    console.log(`💔 Player took damage! (${amount} -> ${actualDamage} after armor/damageReduction) HP: ${player.hp}`);
  }

  // --- Level Up Popup Functions ---
  function showLevelUpPopup() {
    if (levelUpPopupActive) return; // Prevent multiple popups
    
    levelUpPopupActive = true;
    gamePaused = true;
    
    // Clear existing popup content
    levelUpContainer.removeChildren();
    
    // Semi-transparent background
    const overlay = new PIXI.Graphics();
    overlay.rect(0, 0, VIRTUAL_W, VIRTUAL_H)
      .fill({ color: 0x000000, alpha: 0.7 });
    levelUpContainer.addChild(overlay);
    
    // Popup background
    const popupWidth = 600;
    const popupHeight = 300;
    const popupX = (VIRTUAL_W - popupWidth) / 2;
    const popupY = (VIRTUAL_H - popupHeight) / 2;
    
    const popup = new PIXI.Graphics();
    popup.rect(0, 0, popupWidth, popupHeight)
      .fill(0x1a1a1a)
      .stroke({ color: 0x555555, width: 3 });
    popup.position.set(popupX, popupY);
    levelUpContainer.addChild(popup);
    
    // Title
    const titleText = new PIXI.Text(`LEVEL ${levelSystem.level}!`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: 20,
      fill: 0xFFD700,
      align: 'center',
      stroke: 0x000000,
      strokeThickness: 2
    });
    titleText.anchor.set(0.5);
    titleText.position.set(popupWidth / 2, 40);
    popup.addChild(titleText);
    
    // Subtitle
    const subtitleText = new PIXI.Text('Choose an upgrade:', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: 12,
      fill: 0xFFFFFF,
      align: 'center'
    });
    subtitleText.anchor.set(0.5);
    subtitleText.position.set(popupWidth / 2, 80);
    popup.addChild(subtitleText);
    
    // Apply character growth first (before showing upgrades)
    characterSystem.applyLevelGrowth(levelSystem.level);
    
    // Update player stats based on level growth
    const selectedCharacter = characterSystem.getSelectedCharacter();
    const updatedFinalStats = characterSystem.getFinalStats(levelSystem.level, selectedCharacter);
    
    // Update maxHP (scale current HP proportionally if maxHP increased)
    const oldMaxHP = player.maxHp;
    const hpRatio = oldMaxHP > 0 ? player.hp / oldMaxHP : 1.0; // Preserve HP percentage
    player.maxHp = updatedFinalStats.maxHP;
    player.hp = Math.round(player.maxHp * hpRatio); // Scale HP proportionally
    
    // Update damage reduction (this is already applied in takeDamage via modifier system)
    player.damageReduction = updatedFinalStats.damageReduction;
    
    // Get current luck stat from modifier system
    const baseLuck = characterSystem.getBaseStats().luck || 0;
    const currentLuck = modifierSystem.getFinalStat('luck', baseLuck);
    
    // Get owned items for upgrade generation
    const ownedItems = itemSystem.getOwnedItems();
    
    // Generate upgrade cards with rarity and luck
    const upgradeCards = upgradeSystem.generateUpgradeCards(
      player.weapons,
      ownedItems,
      currentLuck,
      levelSystem.level
    );
    
    const cardWidth = 150;
    const cardHeight = 120;
    const cardSpacing = 20;
    const totalCardsWidth = (cardWidth * upgradeCards.length) + (cardSpacing * (upgradeCards.length - 1));
    const cardsStartX = (popupWidth - totalCardsWidth) / 2;
    
    upgradeCards.forEach((cardData, index) => {
      const cardX = cardsStartX + (index * (cardWidth + cardSpacing));
      const cardY = 120;
      
      const card = new UpgradeCard(cardData, cardX, cardY, cardWidth, cardHeight);
      popup.addChild(card.container);
      
      // Add click handler for upgrade selection
      card.container.on('pointerdown', () => {
        selectUpgrade(cardData);
      });
    });
    
    levelUpContainer.visible = true;
    console.log('🎉 Level up popup displayed!');
  }
  
  function selectUpgrade(cardData) {
    console.log(`🔧 Selected upgrade: ${cardData.displayName}`);
    
    // Apply the upgrade via UpgradeSystem (routes to appropriate system)
    const result = upgradeSystem.applyUpgrade(cardData);
    
    // Update weapons UI and items UI
    updateWeaponsUI();
    updateItemsUI();
    
    // Close popup
    hideLevelUpPopup();
    
    if (result) {
      if (result.unlocked) {
        console.log(`✅ Unlocked: ${result.unlocked}`);
      } else if (result.upgrade) {
        console.log(`✅ Upgrade applied! ${result.upgrade.stat}: ${result.newValue}`);
      } else {
        console.log(`✅ Upgrade applied!`);
      }
    }
  }
  
  function hideLevelUpPopup() {
    levelUpContainer.visible = false;
    levelUpContainer.removeChildren();
    levelUpPopupActive = false;
    gamePaused = false;
    
    console.log('🎮 Game resumed after upgrade selection');
  }

  // --- Game Reset Function ---
  function resetGame() {
    console.log('🔄 Resetting game...');
    
    // Reset player stats
    player.hp = player.maxHp;
    player.invulnerable = false;
    player.invulnerabilityTimer = 0;
    player.damageFlashTimer = 0;
    player.tint = 0xFFFFFF;
    
    // Reset player position
    player.x = VIRTUAL_W / 2;
    player.y = VIRTUAL_H / 2;
    
    // Reset systems
    modifierSystem.reset();
    characterSystem.reset();
    itemSystem.reset();
    
    // Re-initialize player stats
    const resetFinalStats = characterSystem.getFinalStats(1, selectedCharacter);
    player.maxHp = resetFinalStats.maxHP;
    player.hp = player.maxHp;
    player.armor = resetFinalStats.armor;
    player.damageReduction = resetFinalStats.damageReduction;
    player.moveSpeed = resetFinalStats.moveSpeed;
    player.pickupRange = resetFinalStats.pickupRange;
    player.xpGain = resetFinalStats.xpGain;
    player.luck = resetFinalStats.luck;
    
    // Reset weapon to original configuration
    const resetSwordConfig = { ...originalSwordConfig };
    Object.assign(swordWeapon, weaponSystem.createWeapon(resetSwordConfig));
    swordWeapon.fireTimer = 0;
    swordWeapon.iconTexture = originalSwordConfig.iconTexture;
    swordWeapon.projectileTexture = originalSwordConfig.projectileTexture;
    
    // Reset level system
    levelSystem.reset();
    
    // Reset difficulty and spawn systems
    difficultySystem.reset();
    spawnController.reset();
    
    // Clear all game objects
    enemies.length = 0;
    enemiesContainer.removeChildren();
    
    projectiles.length = 0;
    projectilesContainer.removeChildren();
    
    xpOrbs.length = 0;
    xpOrbsContainer.removeChildren();
    
    deathClouds.length = 0;
    deathCloudsContainer.removeChildren();
    
    // Reset game state
    gameOver = false;
    gamePaused = false;
    levelUpPopupActive = false;
    
    // Reset UI
    gameOverText.visible = false;
    restartText.visible = false;
    levelUpContainer.visible = false;
    levelUpContainer.removeChildren();
    
    // Update UI displays
    updateWeaponsUI();
    updateItemsUI();
    
    console.log('✅ Game reset complete!');
  }
  
  // --- Assign Reset Function to Global Reference ---
  resetGameFunction = resetGame;

  // --- Old spawn function removed - now using SpawnController ---

  // --- Collision Detection Function ---
  function checkProjectileCollisions() {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const proj = projectiles[i];
      
      // Get dynamic hitbox radius for projectile
      const projRadius = proj.getHitboxRadius();
      
      // Collect all enemies within collision range that haven't been hit yet
      const validTargets = [];
      
      for (let j = 0; j < enemies.length; j++) {
        const enemy = enemies[j];
        
        // Skip if we've already hit this enemy with this projectile
        if (proj.hitEnemies && proj.hitEnemies.has(enemy)) {
          continue;
        }
        
        const dx = proj.sprite.x - enemy.x;
        const dy = proj.sprite.y - enemy.y;
        const dist = Math.hypot(dx, dy);
        
        // Dynamic collision detection: projectile radius + enemy radius
        const enemyRadius = enemy.getHitboxRadius();
        if (dist < (projRadius + enemyRadius)) {
          validTargets.push({ enemy, distance: dist });
        }
      }
      
      // Sort by distance - hit closest enemies first
      validTargets.sort((a, b) => a.distance - b.distance);
      
      // Hit enemies up to piercing limit
      const remainingHits = proj.piercing - proj.hitCount;
      const enemiesToHit = validTargets.slice(0, remainingHits);
      
      for (const target of enemiesToHit) {
        const enemy = target.enemy;
        
        // Calculate damage with crit chance
        const { damage, isCrit } = proj.weapon.calculateDamage();
        
        // Apply damage with crit info
        enemy.takeDamage(damage, isCrit);
        
        // Apply knockback if weapon has knockback
        if (proj.weapon.knockback > 0) {
          // Calculate direction from enemy to projectile (push enemy away from projectile)
          const knockbackDx = enemy.x - proj.sprite.x;
          const knockbackDy = enemy.y - proj.sprite.y;
          const knockbackDist = Math.hypot(knockbackDx, knockbackDy);
          
          // Only apply knockback if distance is valid (avoid division by zero)
          if (knockbackDist > 0) {
            const knockbackDirX = knockbackDx / knockbackDist; // Normalized direction (away from projectile)
            const knockbackDirY = knockbackDy / knockbackDist;
            enemy.x += knockbackDirX * proj.weapon.knockback;
            enemy.y += knockbackDirY * proj.weapon.knockback;
            
            // Update sprite position to match enemy position
            enemy.sprite.x = enemy.x;
            enemy.sprite.y = enemy.y;
          }
        }
        
        // Spawn floating damage number (lower for crits to prevent clipping)
        const spawnOffsetY = isCrit ? -45 : -30; // Crits spawn lower due to larger size
        createDamageNumber(enemy.x, enemy.y + spawnOffsetY, damage, isCrit);
        
        if (isCrit) {
          console.log('💥 CRITICAL HIT!');
        }
        
        // Track this enemy as hit by this projectile
        if (!proj.hitEnemies) {
          proj.hitEnemies = new Set();
        }
        proj.hitEnemies.add(enemy);
        
        proj.hitCount++;
      }
      
      if (enemiesToHit.length > 0) {
        const firstEnemyRadius = enemiesToHit[0].enemy.getHitboxRadius();
        console.log(`🎯 Projectile hit ${enemiesToHit.length} enemies (${proj.hitCount}/${proj.piercing} total), proj radius: ${projRadius.toFixed(1)}px, enemy radius: ${firstEnemyRadius.toFixed(1)}px`);
      }
      
      // Destroy projectile if it has hit maximum number of enemies
      if (proj.hitCount >= proj.piercing) {
        proj.destroy();
        projectiles.splice(i, 1);
      }
    }
  }
  
  // --- Enemy-Enemy Collision Detection ---
  function checkEnemyCollisions() {
    if (!gamePaused && enemies.length > 1) {
      let collisionCount = 0;
      
      // Check all enemy pairs for collisions
      for (let i = 0; i < enemies.length - 1; i++) {
        const enemy1 = enemies[i];
        
        for (let j = i + 1; j < enemies.length; j++) {
          const enemy2 = enemies[j];
          
          // Calculate distance between enemy centers
          const dx = enemy2.x - enemy1.x;
          const dy = enemy2.y - enemy1.y;
          const distance = Math.hypot(dx, dy);
          
          // Get combined collision radius
          const combinedRadius = enemy1.getHitboxRadius() + enemy2.getHitboxRadius();
          
          // Check if enemies are colliding
          if (distance < combinedRadius && distance > 0) {
            collisionCount++;
            
            // Calculate separation needed
            const overlap = combinedRadius - distance;
            const separationDistance = overlap / 2; // Split separation equally
            
            // Calculate normalized direction vector
            const directionX = dx / distance;
            const directionY = dy / distance;
            
            // Push enemies apart (50/50 split)
            enemy1.x -= directionX * separationDistance;
            enemy1.y -= directionY * separationDistance;
            enemy2.x += directionX * separationDistance;
            enemy2.y += directionY * separationDistance;
            
            // Update sprite positions
            enemy1.sprite.x = enemy1.x;
            enemy1.sprite.y = enemy1.y;
            enemy1.hitboxGraphics.x = enemy1.x;
            enemy1.hitboxGraphics.y = enemy1.y;
            
            enemy2.sprite.x = enemy2.x;
            enemy2.sprite.y = enemy2.y;
            enemy2.hitboxGraphics.x = enemy2.x;
            enemy2.hitboxGraphics.y = enemy2.y;
            
            // Mark collision for debugging
            enemy1.collisionThisFrame = true;
            enemy2.collisionThisFrame = true;
          }
        }
      }
      
      // Debug logging for collisions (only log when collisions occur)
      if (collisionCount > 0 && window.upgradeSystemInstance && window.upgradeSystemInstance.testingMode) {
        console.log(`⚔️ Enemy collisions this frame: ${collisionCount} (${enemies.length} enemies total)`);
      }
    }
  }
  
  // --- Player-Enemy Collision Detection ---
  function checkPlayerEnemyCollisions() {
    for (const enemy of enemies) {
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const dist = Math.hypot(dx, dy);
      
      // Dynamic collision detection: 110% of enemy hitbox radius as attack range
      const attackRadius = enemy.getAttackRadius();
      
      if (dist < attackRadius && !player.invulnerable) {
        takeDamage(10);
        
        // Apply knockback - push player away from enemy
        const knockbackDistance = 20;
        if (dist > 0) {
          player.x += (dx / dist) * knockbackDistance;
          player.y += (dy / dist) * knockbackDistance;
        }
        
        break; // Only hit once per frame
      }
    }
  }

  // --- Game Loop (ohne Ticker) ---
  let lastTime = 0;
  function gameLoop(currentTime) {
    const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
    lastTime = currentTime;
    
    // Check game over state
    if (player.hp <= 0 && !gameOver) {
      gameOver = true;
      gameOverText.visible = true;
      restartText.visible = true;
      console.log('💀 GAME OVER - All upgrades will be reset on restart');
    }
    
    // Update invulnerability timer
    if (player.invulnerabilityTimer > 0) {
      player.invulnerabilityTimer -= deltaTime;
      if (player.invulnerabilityTimer <= 0) {
        player.invulnerable = false;
      }
    }
    
    // Update damage flash timer
    if (player.damageFlashTimer > 0) {
      player.damageFlashTimer -= deltaTime;
      if (player.damageFlashTimer <= 0) {
        player.tint = 0xFFFFFF; // Reset to normal color
      }
    }
    
    // Update HP UI
    hpText.text = `HP: ${player.hp}/${player.maxHp}`;
    
    // --- WASD Movement ---
    let dx = 0;
    let dy = 0;
    
    // Disable movement if game over or paused
    if (!gameOver && !gamePaused) {
      if (keys["w"] || keys["arrowup"]) dy -= 1;
      if (keys["s"] || keys["arrowdown"]) dy += 1;
      if (keys["a"] || keys["arrowleft"]) dx -= 1;
      if (keys["d"] || keys["arrowright"]) dx += 1;

      // Normalize diagonal movement
      const length = Math.hypot(dx, dy);
      if (length > 0) {
        dx /= length;
        dy /= length;
      }

      // Apply movement to player in world space (using modifier system)
      const baseSpeed = baseMoveSpeed;
      const finalMoveSpeed = modifierSystem.getFinalStat('moveSpeed', baseSpeed);
      player.x += dx * finalMoveSpeed * deltaTime;
      player.y += dy * finalMoveSpeed * deltaTime;
      
      // Update player hitbox position
      player.hitboxGraphics.x = player.x;
      player.hitboxGraphics.y = player.y;
    }
    
    // Mirror player sprite based on movement direction
    if (dx > 0) {
      player.scale.x = -Math.abs(player.scale.x); // Face right when moving right
    } else if (dx < 0) {
      player.scale.x = Math.abs(player.scale.x); // Face left when moving left
    }
    // If dx == 0, keep current facing direction
    
    // --- Camera Follow System ---
    // Set camera target to center player on screen (inverted for world scrolling)
    camera.targetX = VIRTUAL_W / 2 - player.x;
    camera.targetY = VIRTUAL_H / 2 - player.y;
    
    // Smooth camera movement using lerp
    camera.x += (camera.targetX - camera.x) * camera.followSpeed * deltaTime;
    camera.y += (camera.targetY - camera.y) * camera.followSpeed * deltaTime;
    
    // Apply camera transform to world and combatFX containers (1:1 movement for top-down view)
    // No parallax - all objects in world layer move together in same coordinate space
    world.x = camera.x;
    world.y = camera.y;
    combatFX.x = camera.x;
    combatFX.y = camera.y;
    
    // --- Combat System Update ---
    // Update projectiles
    if (!gamePaused) {
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        if (projectile.update(deltaTime)) {
          projectile.destroy();
          projectiles.splice(i, 1);
        }
      }
    }

    // Update difficulty and spawn systems
    if (!gameOver && !gamePaused) {
      difficultySystem.update(deltaTime);
      spawnController.update(deltaTime, player, gamePaused, gameOver);
    }

    // Update enemies
    if (!gamePaused) {
      // Reset collision flags for all enemies at start of frame
      for (const enemy of enemies) {
        enemy.collisionThisFrame = false;
      }
      
      for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        if (enemy.update(deltaTime, player.x, player.y)) {
          // Spawn death effects
          const deathCloud = new DeathCloud(enemy.x, enemy.y);
          deathCloudsContainer.addChild(deathCloud.sprite);
          deathClouds.push(deathCloud);
          
          // Spawn XP orb with scaled reward
          const xpOrb = new XPOrb(enemy.x, enemy.y, enemy.xpReward);
          xpOrbsContainer.addChild(xpOrb.sprite);
          xpOrbs.push(xpOrb);
          
          // Clean up enemy references from projectile hit tracking
          projectiles.forEach(proj => {
            if (proj.hitEnemies && proj.hitEnemies.has(enemy)) {
              proj.hitEnemies.delete(enemy);
            }
          });
          
          // Notify spawn controller if boss was defeated
          if (spawnController.isBoss(enemy)) {
            spawnController.onBossDefeated(enemy);
          }
          
          enemy.destroy();
          enemies.splice(i, 1);
        }
      }

      // Check collisions
      checkEnemyCollisions(); // Check enemy-enemy collisions first
      
      // Update visual debugging after collision detection
      if (window.upgradeSystemInstance && window.upgradeSystemInstance.testingMode) {
        for (const enemy of enemies) {
          enemy.updateHitboxVisuals();
        }
      }
      
      checkProjectileCollisions();
      
      // Check player-enemy collisions
      if (!gameOver) {
        checkPlayerEnemyCollisions();
      }
    }

    // Update death clouds
    for (let i = deathClouds.length - 1; i >= 0; i--) {
      const cloud = deathClouds[i];
      if (cloud.update(deltaTime)) {
        cloud.destroy();
        deathClouds.splice(i, 1);
      }
    }

    // Update damage numbers
    for (let i = damageNumbers.length - 1; i >= 0; i--) {
      const dmgNum = damageNumbers[i];
      if (dmgNum.update(deltaTime)) {
        // Animation complete - recycle to pool
        dmgNum.destroy();
        damageNumbers.splice(i, 1);
        damageNumberPool.push(dmgNum);
      }
    }

    // Update XP orbs and check collection
    // No parallax applied - XP orbs exist in world-space like enemies, 
    // so they automatically move with the camera via the world container transform
    if (!gamePaused) {
      for (let i = xpOrbs.length - 1; i >= 0; i--) {
        const orb = xpOrbs[i];
        
        if (orb.update(deltaTime, player.x, player.y)) {
          const baseXpGain = characterSystem.getBaseStats().xpGain || 1.0;
          const finalXpGain = modifierSystem.getFinalStat('xpGain', baseXpGain);
          const xpGained = orb.destroy() * finalXpGain; // Apply XP gain multiplier
          const levelsGained = levelSystem.addXP(Math.round(xpGained));
          xpOrbs.splice(i, 1);
          
          // Trigger level up popup if player leveled up
          if (levelsGained.length > 0) {
            showLevelUpPopup();
          }
        }
      }
    }

    // Update Timer UI (MM:SS format)
    if (!gameOver && !gamePaused && difficultySystem) {
      const totalSeconds = Math.floor(difficultySystem.getCurrentGameTime());
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      timerText.text = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // Update XP UI
    xpText.text = levelSystem.getXPDisplayText();
    
    // Update boss announcement
    updateBossAnnouncement(deltaTime);

    // Update weapon timers
    if (!gameOver && !gamePaused) {
      player.currentWeapon.update(deltaTime);
    }

    // Auto-fire logic
    if (!gameOver && !gamePaused && combatMode === 'auto') {
      if (player.currentWeapon.canFire()) {
        // Find nearest enemy for auto-aim
        let nearestEnemy = null;
        let nearestDistance = Infinity;
        
        for (const enemy of enemies) {
          const dx = enemy.x - player.x;
          const dy = enemy.y - player.y;
          const distance = Math.hypot(dx, dy);
          
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestEnemy = enemy;
          }
        }
        
        // Only fire if there are enemies to target AND within weapon range
        if (nearestEnemy) {
          // Calculate effective weapon range (travel distance: speed * range * lifetime_multiplier)
          const effectiveRange = player.currentWeapon.projectileSpeed * player.currentWeapon.range * 1.5;
          
          // Only fire if enemy is within range
          if (nearestDistance <= effectiveRange) {
            const angle = Math.atan2(nearestEnemy.y - player.y, nearestEnemy.x - player.x);
            fireWeapon(angle);
          }
        }
      }
    }

    // Manual fire logic
    if (!gameOver && !gamePaused && combatMode === 'manual' && mousePressed) {
      if (player.currentWeapon.canFire()) {
        // Calculate mouse angle for aim cone
        const worldMouseX = mouse.x - camera.x;
        const worldMouseY = mouse.y - camera.y;
        const mouseAngle = Math.atan2(worldMouseY - player.y, worldMouseX - player.x);
        
        // Find nearest enemy within 60° aim cone
        let nearestEnemyInCone = null;
        let nearestDistance = Infinity;
        const coneHalfAngle = Math.PI / 6; // 30 degrees
        
        for (const enemy of enemies) {
          const dx = enemy.x - player.x;
          const dy = enemy.y - player.y;
          const distance = Math.hypot(dx, dy);
          const enemyAngle = Math.atan2(dy, dx);
          
          // Calculate angle difference
          let angleDiff = Math.abs(enemyAngle - mouseAngle);
          // Handle angle wrapping
          if (angleDiff > Math.PI) {
            angleDiff = 2 * Math.PI - angleDiff;
          }
          
          // Check if enemy is within aim cone
          if (angleDiff <= coneHalfAngle && distance < nearestDistance) {
            nearestDistance = distance;
            nearestEnemyInCone = enemy;
          }
        }
        
        // Fire at nearest enemy in cone, or fallback to mouse direction
        let angle;
        if (nearestEnemyInCone) {
          angle = Math.atan2(nearestEnemyInCone.y - player.y, nearestEnemyInCone.x - player.x);
        } else {
          angle = mouseAngle;
        }
        
        fireWeapon(angle);
      }
    }

    // --- Aiming and Visual Feedback ---
    const worldMouseX = mouse.x - camera.x;
    const worldMouseY = mouse.y - camera.y;
    const mouseAngle = Math.atan2(worldMouseY - player.y, worldMouseX - player.x);
    
    // Draw aim cone (60° cone around player facing direction)
    if (combatMode === 'manual') {
      const coneHalfAngle = Math.PI / 6; // 30 degrees
      const coneLength = 150;
      aimCone.clear()
        .moveTo(player.x, player.y)
        .lineTo(player.x + Math.cos(mouseAngle - coneHalfAngle) * coneLength,
                player.y + Math.sin(mouseAngle - coneHalfAngle) * coneLength)
        .moveTo(player.x, player.y)
        .lineTo(player.x + Math.cos(mouseAngle + coneHalfAngle) * coneLength,
                player.y + Math.sin(mouseAngle + coneHalfAngle) * coneLength)
        .stroke({ color: 0xff6b6b, width: 1, alpha: 0.6 });
    } else {
      aimCone.clear(); // Hide cone in auto mode
    }
    
    requestAnimationFrame(gameLoop);
  }
  
  // Start game loop
  requestAnimationFrame(gameLoop);

})();