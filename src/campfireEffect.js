// --- Campfire Effect ---
// Manages animated campfire effects: flickering glow and ember particles

export class CampfireEffect {
  constructor(campfireX, campfireY, scale) {
    // Campfire position in virtual screen coordinates
    this.campfireX = campfireX;
    this.campfireY = campfireY;
    this.scale = scale; // Background scaling factor (for ember/glow sizes)
    
    // Main container for all effects
    this.container = new PIXI.Container();
    
    // Flicker glow properties
    this.glowSprite = null;
    this.flickerTimer = 0;
    this.flickerInterval = 0.1; // 100ms between flicker updates
    
    // Ember particle properties
    this.embers = [];
    this.emberSpawnTimer = 0;
    this.emberSpawnInterval = 0.3; // Base spawn interval
    this.maxEmbers = 12;
    
    // Fade support
    this.fadeAlpha = 1.0;
    
    // Color palette
    this.colors = {
      glowOrange: 0xFF6600,
      glowYellow: 0xFF9933,
      emberBright: 0xFFCC00,
      emberOrange: 0xFF6600,
      emberRed: 0xCC3300
    };
    
    this.initialize();
  }
  
  initialize() {
    // Create flicker glow overlay
    this.createFlickerGlow();
    
    console.log('🔥 Campfire effect initialized');
  }
  
  createFlickerGlow() {
    // Create a diamond-shaped glow using two triangles with gradient fade
    // Diamond dimensions (78.125% of original size - previous + 25%)
    const halfWidth = 50.78125 * this.scale; // ±50.78px horizontally (101.56px total)
    const heightUp = 78.125 * this.scale; // 78.125px upward
    const heightDown = 27.34375 * this.scale; // 27.34px downward
    
    const glow = new PIXI.Graphics();
    
    // Draw multiple layers of diamond shapes with decreasing alpha for gradient effect
    const steps = 50; // Many steps for very smooth gradient
    for (let i = steps; i > 0; i--) {
      const ratio = i / steps;
      
      // Scale the diamond size
      const w = halfWidth * ratio;
      const hUp = heightUp * ratio;
      const hDown = heightDown * ratio;
      
      // Alpha fades towards edges with cubic easing for aggressive fade
      const alpha = (ratio * ratio * ratio) * 0.03; // Max alpha of 0.03 at center, cubic falloff
      
      // Upper triangle (campfire to flame tip)
      glow.moveTo(0, 0); // Center (campfire center)
      glow.lineTo(-w, 0); // Left
      glow.lineTo(0, -hUp); // Top (flame tip)
      glow.lineTo(w, 0); // Right
      glow.closePath();
      glow.fill({ color: this.colors.glowOrange, alpha: alpha });
      
      // Lower triangle (campfire to wood base)
      glow.moveTo(0, 0); // Center (campfire center)
      glow.lineTo(-w, 0); // Left
      glow.lineTo(0, hDown); // Bottom (wood base)
      glow.lineTo(w, 0); // Right
      glow.closePath();
      glow.fill({ color: this.colors.glowOrange, alpha: alpha });
    }
    
    // Use graphics directly for best compatibility
    this.glowSprite = glow;
    this.glowSprite.blendMode = 'add'; // Additive blending for glow effect
    
    // Position at campfire center (already in screen coordinates)
    this.glowSprite.position.set(this.campfireX, this.campfireY);
    
    this.container.addChild(this.glowSprite);
  }
  
  spawnEmber() {
    if (this.embers.length >= this.maxEmbers) return;
    
    // Random starting position around campfire (in screen space)
    const offsetX = (Math.random() - 0.5) * 60 * this.scale; // ±30px scaled
    const offsetY = (Math.random() - 0.5) * 20 * this.scale; // ±10px scaled
    
    const startX = this.campfireX + offsetX;
    const startY = this.campfireY + offsetY;
    
    // Random target position (rising upward ~200px)
    const targetOffsetX = (Math.random() - 0.5) * 40 * this.scale; // ±20px horizontal drift
    const riseDistance = 200 * this.scale; // Rise about 200 background pixels
    const targetY = this.campfireY - riseDistance; // Rise upward
    
    // Random lifetime (1-2 seconds)
    const lifetime = 1.0 + Math.random() * 1.0;
    
    // Random color temperature
    const colorChoice = Math.random();
    let color;
    if (colorChoice < 0.3) {
      color = this.colors.emberBright; // Bright yellow
    } else if (colorChoice < 0.7) {
      color = this.colors.emberOrange; // Orange
    } else {
      color = this.colors.emberRed; // Deep red
    }
    
    // Create ember sprite (1-2px glowing dot)
    const emberSize = 1 + Math.random(); // 1-2px
    const ember = new PIXI.Graphics();
    ember.circle(0, 0, emberSize);
    ember.fill({ color: color, alpha: 0.8 });
    
    ember.position.set(startX, startY);
    ember.blendMode = 'add'; // Additive blending for glow
    
    this.container.addChild(ember);
    
    // Store ember data
    this.embers.push({
      sprite: ember,
      startX: startX,
      startY: startY,
      targetX: this.campfireX + targetOffsetX,
      targetY: targetY,
      lifetime: lifetime,
      age: 0,
      initialAlpha: 0.8
    });
  }
  
  updateFlicker(deltaTime) {
    this.flickerTimer += deltaTime;
    
    if (this.flickerTimer >= this.flickerInterval) {
      this.flickerTimer = 0;
      
      // Randomize glow properties
      const alpha = 0.7 + Math.random() * 0.3; // 0.7 to 1.0
      const scale = 0.95 + Math.random() * 0.1; // 0.95 to 1.05
      
      // Slight tint variation between orange and yellow
      const tintChoice = Math.random();
      const tint = tintChoice < 0.5 ? this.colors.glowOrange : this.colors.glowYellow;
      
      this.glowSprite.alpha = alpha * this.fadeAlpha;
      this.glowSprite.scale.set(scale);
      this.glowSprite.tint = tint;
    }
  }
  
  updateEmbers(deltaTime) {
    // Spawn new embers
    this.emberSpawnTimer += deltaTime;
    const spawnInterval = this.emberSpawnInterval + Math.random() * 0.2; // 0.3-0.5s
    
    if (this.emberSpawnTimer >= spawnInterval) {
      this.emberSpawnTimer = 0;
      
      // Spawn 1-2 embers
      const count = Math.random() < 0.5 ? 1 : 2;
      for (let i = 0; i < count; i++) {
        this.spawnEmber();
      }
    }
    
    // Update existing embers
    for (let i = this.embers.length - 1; i >= 0; i--) {
      const ember = this.embers[i];
      ember.age += deltaTime;
      
      // Calculate progress (0 to 1)
      const progress = Math.min(ember.age / ember.lifetime, 1);
      
      // Update position (linear interpolation with slight easing)
      const easedProgress = progress * progress; // Ease-in for slower start
      ember.sprite.position.x = ember.startX + (ember.targetX - ember.startX) * easedProgress;
      ember.sprite.position.y = ember.startY + (ember.targetY - ember.startY) * progress;
      
      // Fade out as it rises
      ember.sprite.alpha = (1 - progress) * ember.initialAlpha * this.fadeAlpha;
      
      // Remove if lifetime exceeded or fully faded
      if (progress >= 1) {
        this.container.removeChild(ember.sprite);
        ember.sprite.destroy();
        this.embers.splice(i, 1);
      }
    }
  }
  
  update(deltaTime) {
    this.updateFlicker(deltaTime);
    this.updateEmbers(deltaTime);
  }
  
  setFade(alpha) {
    this.fadeAlpha = Math.max(0, Math.min(1, alpha));
    
    // Update glow alpha
    if (this.glowSprite) {
      this.glowSprite.alpha *= this.fadeAlpha;
    }
    
    // Ember alphas are updated in updateEmbers
  }
  
  destroy() {
    // Clean up all embers
    for (const ember of this.embers) {
      ember.sprite.destroy();
    }
    this.embers = [];
    
    // Destroy container
    this.container.destroy({ children: true });
    
    console.log('🗑️ Campfire effect destroyed');
  }
}

