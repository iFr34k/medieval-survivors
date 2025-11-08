// --- Magic Orb Effect ---
// Manages animated magic orb effects: pulsing glow and purple particle sparks

export class MagicOrbEffect {
  constructor(orbX, orbY, scale) {
    // Orb position in virtual screen coordinates
    this.orbX = orbX;
    this.orbY = orbY;
    this.scale = scale; // Background scaling factor (for glow/spark sizes)
    
    // Main container for all effects
    this.container = new PIXI.Container();
    
    // Pulsing glow properties
    this.glowSprite = null;
    this.glowTimer = 0;
    this.glowPulseSpeed = 2.0; // Speed of pulse animation (radians per second)
    
    // Spark particle properties
    this.sparks = [];
    this.sparkSpawnTimer = 0;
    this.sparkSpawnInterval = 0.6; // Base spawn interval (1-2 bursts per second)
    this.maxSparks = 15;
    
    // Fade support
    this.fadeAlpha = 1.0;
    
    // Color palette
    this.colors = {
      glowBlue: 0x4444FF,
      glowPurple: 0x8844FF,
      sparkLavender: 0xCC88FF,
      sparkViolet: 0x8844FF,
      sparkDeepPurple: 0x6633CC
    };
    
    this.initialize();
  }
  
  initialize() {
    // Create pulsing glow overlay
    this.createGlow();
    
    console.log('✨ Magic orb effect initialized');
  }
  
  createGlow() {
    // Create a circular gradient glow using concentric circles with decreasing alpha
    const baseRadius = 30 * this.scale; // Base radius of glow effect
    
    const glow = new PIXI.Graphics();
    
    // Draw multiple layers of circles with decreasing alpha for gradient effect
    const steps = 40; // Many steps for smooth gradient
    for (let i = steps; i > 0; i--) {
      const ratio = i / steps;
      
      // Scale the circle radius
      const radius = baseRadius * ratio;
      
      // Alpha fades towards edges with quadratic easing
      const alpha = (ratio * ratio) * 0.5; // Max alpha of 0.5 at center, quadratic falloff
      
      // Alternate between blue and purple for color variation
      const color = ratio > 0.5 ? this.colors.glowBlue : this.colors.glowPurple;
      
      glow.circle(0, 0, radius);
      glow.fill({ color: color, alpha: alpha });
    }
    
    // Use graphics directly for best compatibility
    this.glowSprite = glow;
    this.glowSprite.blendMode = 'add'; // Additive blending for glow effect
    
    // Position at orb center (already in screen coordinates)
    this.glowSprite.position.set(this.orbX, this.orbY);
    
    this.container.addChild(this.glowSprite);
  }
  
  spawnSparks() {
    if (this.sparks.length >= this.maxSparks) return;
    
    // Spawn 1-2 sparks per burst
    const sparkCount = Math.random() < 0.5 ? 1 : 2;
    
    for (let i = 0; i < sparkCount; i++) {
      // Random angle for 360° burst
      const angle = Math.random() * Math.PI * 2;
      
      // Random radius from orb edge (15-25px)
      const spawnRadius = (15 + Math.random() * 10) * this.scale;
      
      // Starting position on orb edge
      const startX = this.orbX + Math.cos(angle) * spawnRadius;
      const startY = this.orbY + Math.sin(angle) * spawnRadius;
      
      // Target position (extend outward ~40-60px)
      const travelDistance = (40 + Math.random() * 20) * this.scale;
      const targetX = this.orbX + Math.cos(angle) * (spawnRadius + travelDistance);
      const targetY = this.orbY + Math.sin(angle) * (spawnRadius + travelDistance);
      
      // Add curved motion offset (perpendicular to direction)
      const curveOffset = (Math.random() - 0.5) * 30 * this.scale;
      const perpAngle = angle + Math.PI / 2;
      const curveX = Math.cos(perpAngle) * curveOffset;
      const curveY = Math.sin(perpAngle) * curveOffset;
      
      // Random lifetime (0.8-1.5 seconds)
      const lifetime = 0.8 + Math.random() * 0.7;
      
      // Random color from lavender to violet
      const colorChoice = Math.random();
      let color;
      if (colorChoice < 0.33) {
        color = this.colors.sparkLavender; // Light lavender
      } else if (colorChoice < 0.67) {
        color = this.colors.sparkViolet; // Violet
      } else {
        color = this.colors.sparkDeepPurple; // Deep purple
      }
      
      // Create spark sprite (1-2px glowing dot)
      const sparkSize = 1 + Math.random(); // 1-2px
      const spark = new PIXI.Graphics();
      spark.circle(0, 0, sparkSize);
      spark.fill({ color: color, alpha: 0.9 });
      
      spark.position.set(startX, startY);
      spark.blendMode = 'add'; // Additive blending for glow
      
      this.container.addChild(spark);
      
      // Store spark data
      this.sparks.push({
        sprite: spark,
        startX: startX,
        startY: startY,
        targetX: targetX,
        targetY: targetY,
        curveX: curveX,
        curveY: curveY,
        lifetime: lifetime,
        age: 0,
        initialAlpha: 0.9
      });
    }
  }
  
  updateGlow(deltaTime) {
    this.glowTimer += deltaTime;
    
    // Smooth sine wave oscillation for alpha (0.8 to 1.0)
    const alphaCycle = Math.sin(this.glowTimer * this.glowPulseSpeed);
    const alpha = 0.9 + alphaCycle * 0.1; // 0.8 to 1.0
    
    // Smooth sine wave oscillation for scale (0.98 to 1.03)
    const scaleCycle = Math.sin(this.glowTimer * this.glowPulseSpeed * 0.8); // Slightly slower
    const scale = 1.005 + scaleCycle * 0.025; // 0.98 to 1.03
    
    // Optional subtle rotation for shimmer effect
    const rotation = this.glowTimer * 0.2; // Slow rotation
    
    this.glowSprite.alpha = alpha * this.fadeAlpha;
    this.glowSprite.scale.set(scale);
    this.glowSprite.rotation = rotation;
    
    // Subtle tint variation between blue and purple
    const tintCycle = Math.sin(this.glowTimer * 1.5);
    const tintRatio = (tintCycle + 1) / 2; // 0 to 1
    // Interpolate between blue and purple
    const r = Math.floor(0x44 + (0x88 - 0x44) * tintRatio);
    const g = 0x44;
    const b = 0xFF;
    const tint = (r << 16) | (g << 8) | b;
    this.glowSprite.tint = tint;
  }
  
  updateSparks(deltaTime) {
    // Spawn new sparks
    this.sparkSpawnTimer += deltaTime;
    const spawnInterval = this.sparkSpawnInterval + Math.random() * 0.4; // 0.6-1.0s (1-2 bursts/sec)
    
    if (this.sparkSpawnTimer >= spawnInterval) {
      this.sparkSpawnTimer = 0;
      this.spawnSparks();
    }
    
    // Update existing sparks
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const spark = this.sparks[i];
      spark.age += deltaTime;
      
      // Calculate progress (0 to 1)
      const progress = Math.min(spark.age / spark.lifetime, 1);
      
      // Update position with curved trajectory
      // Use quadratic easing for smooth deceleration
      const easedProgress = 1 - Math.pow(1 - progress, 2); // Ease-out
      
      // Base position (linear interpolation)
      const baseX = spark.startX + (spark.targetX - spark.startX) * easedProgress;
      const baseY = spark.startY + (spark.targetY - spark.startY) * easedProgress;
      
      // Add curve effect (peaks at midpoint)
      const curveStrength = Math.sin(progress * Math.PI); // 0 at start/end, 1 at middle
      const curvedX = baseX + spark.curveX * curveStrength;
      const curvedY = baseY + spark.curveY * curveStrength;
      
      spark.sprite.position.x = curvedX;
      spark.sprite.position.y = curvedY;
      
      // Fade out as it disperses (more aggressive fade at end)
      const fadeProgress = Math.pow(progress, 1.5); // Power curve for faster end fade
      spark.sprite.alpha = (1 - fadeProgress) * spark.initialAlpha * this.fadeAlpha;
      
      // Remove if lifetime exceeded or fully faded
      if (progress >= 1) {
        this.container.removeChild(spark.sprite);
        spark.sprite.destroy();
        this.sparks.splice(i, 1);
      }
    }
  }
  
  update(deltaTime) {
    this.updateGlow(deltaTime);
    this.updateSparks(deltaTime);
  }
  
  setFade(alpha) {
    this.fadeAlpha = Math.max(0, Math.min(1, alpha));
    
    // Update glow alpha
    if (this.glowSprite) {
      // Glow alpha is updated in updateGlow
    }
    
    // Spark alphas are updated in updateSparks
  }
  
  destroy() {
    // Clean up all sparks
    for (const spark of this.sparks) {
      spark.sprite.destroy();
    }
    this.sparks = [];
    
    // Destroy container
    this.container.destroy({ children: true });
    
    console.log('🗑️ Magic orb effect destroyed');
  }
}







