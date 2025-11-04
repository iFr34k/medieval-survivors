// --- Main Menu Scene ---
// Manages the main menu with background, start button, and transitions

import { CampfireEffect } from './campfireEffect.js';
import { MagicOrbEffect } from './magicOrbEffect.js';
import { CharacterSelectScreen } from './characterSelectScreen.js';

// Background configuration - Main_Menu_alt.png is the default
const MENU_CONFIG = {
  backgrounds: ['Main_Menu_alt.png'],
  currentBackgroundIndex: 0, // Always use Main_Menu_alt.png
  showLogo: true,
  campfireCoords: { x: 725, y: 865 }, // Campfire position in background image coordinates
  magicOrbCoords: { x: 1262, y: 490 } // Magic orb position in background image coordinates
};

export class MainMenuScene {
  constructor(app, virtualWidth, virtualHeight, onStartGameCallback) {
    this.app = app;
    this.VIRTUAL_W = virtualWidth;
    this.VIRTUAL_H = virtualHeight;
    this.onStartGame = onStartGameCallback;
    
    this.menuContainer = new PIXI.Container();
    this.background = null;
    this.button = null;
    this.startText = null;
    this.fadeOverlay = null;
    this.logo = null;
    this.bgTextures = []; // Store background textures
    this.campfireEffect = null;
    this.magicOrbEffect = null;
    this.characterSelectScreen = null;
    this.backgroundScale = 1.0; // Track background scale for effect positioning
    this.updateTicker = null; // Animation ticker
  }
  
  async initialize() {
    try {
      console.log('🔄 Loading main menu assets...');
      
      // Preload both background images
      for (const bgFile of MENU_CONFIG.backgrounds) {
        const bgTexture = await PIXI.Assets.load(`./src/assets/${bgFile}`);
        bgTexture.source.scaleMode = 'nearest';
        this.bgTextures.push(bgTexture);
        console.log('✅ Background loaded:', bgFile, bgTexture.width, 'x', bgTexture.height);
      }
      
      // Set initial background
      const initialTexture = this.bgTextures[MENU_CONFIG.currentBackgroundIndex];
      this.background = new PIXI.Sprite(initialTexture);
      // Scale to fit 1200x800 virtual resolution (cover entire screen)
      const scaleX = this.VIRTUAL_W / initialTexture.width;
      const scaleY = this.VIRTUAL_H / initialTexture.height;
      this.backgroundScale = Math.max(scaleX, scaleY); // Cover entire screen
      this.background.scale.set(this.backgroundScale);
      this.background.position.set(this.VIRTUAL_W / 2, this.VIRTUAL_H / 2);
      this.background.anchor.set(0.5);
      this.menuContainer.addChild(this.background);
      
      // Create campfire effect for Main_Menu_alt.png
      this.createCampfireEffect();
      
      // Create magic orb effect for Main_Menu_alt.png
      this.createMagicOrbEffect();
      
      // Load and add logo
      if (MENU_CONFIG.showLogo) {
        const logoTexture = await PIXI.Assets.load('./src/assets/Logo.png');
        logoTexture.source.scaleMode = 'nearest';
        console.log('✅ Logo loaded:', logoTexture.width, 'x', logoTexture.height);
        
      this.logo = new PIXI.Sprite(logoTexture);
      this.logo.anchor.set(0.5);
      // Scale to appropriate size (adjust based on logo dimensions)
      this.logo.scale.set(0.35);
      // Position at top-center of screen
      this.logo.position.set(this.VIRTUAL_W / 2, 150);
        this.menuContainer.addChild(this.logo);
      }
      
      // Load button sprite
      const buttonTexture = await PIXI.Assets.load('./src/assets/Button.png');
      buttonTexture.source.scaleMode = 'nearest';
      console.log('✅ Button loaded:', buttonTexture.width, 'x', buttonTexture.height);
      
      this.button = new PIXI.Sprite(buttonTexture);
      this.button.anchor.set(0.5);
      this.button.scale.set(0.1125); // Compact list-style layout (1.5x larger)
      this.button.position.set(150, this.VIRTUAL_H / 2); // Left side, vertically centered
      this.button.eventMode = 'static'; // Make interactive
      this.button.cursor = 'pointer';
      this.menuContainer.addChild(this.button);
      
      // Add "Choose Character" text on button
      this.startText = new PIXI.Text('Choose\nCharacter', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 12,
        fill: 0xFFFFFF,
        stroke: { color: 0x000000, width: 3 },
        align: 'center'
      });
      this.startText.anchor.set(0.5);
      this.startText.position.set(this.button.x, this.button.y);
      this.menuContainer.addChild(this.startText);
      
      // Button hover effects
      this.button.on('pointerover', () => {
        this.button.tint = 0xDDDDDD; // Brighten on hover
        this.button.scale.set(0.12, 0.12); // Slightly larger
      });
      
      this.button.on('pointerout', () => {
        this.button.tint = 0xFFFFFF; // Normal color
        this.button.scale.set(0.1125, 0.1125); // Normal size
      });
      
      // Click handler - Opens character select popup (does NOT start game)
      this.button.on('pointerdown', () => {
        this.openCharacterSelect();
      });
      
      // Initialize character selection screen
      this.characterSelectScreen = new CharacterSelectScreen(
        this.app, 
        this.VIRTUAL_W, 
        this.VIRTUAL_H,
        (selectedCharacter) => this.startGame(selectedCharacter)
      );
      await this.characterSelectScreen.initialize();
      
      console.log('🎮 Main Menu initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing main menu:', error);
      throw error;
    }
  }
  
  createCampfireEffect() {
    // Convert background image coordinates to virtual screen coordinates
    // Background is centered with anchor (0.5, 0.5) at (VIRTUAL_W/2, VIRTUAL_H/2)
    const bgTexture = this.bgTextures[MENU_CONFIG.currentBackgroundIndex];
    const bgCenterX = bgTexture.width / 2;
    const bgCenterY = bgTexture.height / 2;
    
    // Campfire position relative to background center
    const relX = MENU_CONFIG.campfireCoords.x - bgCenterX;
    const relY = MENU_CONFIG.campfireCoords.y - bgCenterY;
    
    // Scale and translate to virtual screen space
    const screenX = (this.VIRTUAL_W / 2) + (relX * this.backgroundScale);
    const screenY = (this.VIRTUAL_H / 2) + (relY * this.backgroundScale);
    
    this.campfireEffect = new CampfireEffect(screenX, screenY, this.backgroundScale);
    
    // Add campfire container after background but before UI elements
    // Insert after background (index 1, since background is at index 0)
    this.menuContainer.addChildAt(this.campfireEffect.container, 1);
    
    console.log(`🔥 Campfire effect added at (${screenX.toFixed(1)}, ${screenY.toFixed(1)}) with scale ${this.backgroundScale.toFixed(3)}`);
  }
  
  createMagicOrbEffect() {
    // Convert background image coordinates to virtual screen coordinates
    // Background is centered with anchor (0.5, 0.5) at (VIRTUAL_W/2, VIRTUAL_H/2)
    const bgTexture = this.bgTextures[MENU_CONFIG.currentBackgroundIndex];
    const bgCenterX = bgTexture.width / 2;
    const bgCenterY = bgTexture.height / 2;
    
    // Magic orb position relative to background center
    const relX = MENU_CONFIG.magicOrbCoords.x - bgCenterX;
    const relY = MENU_CONFIG.magicOrbCoords.y - bgCenterY;
    
    // Scale and translate to virtual screen space
    const screenX = (this.VIRTUAL_W / 2) + (relX * this.backgroundScale);
    const screenY = (this.VIRTUAL_H / 2) + (relY * this.backgroundScale);
    
    this.magicOrbEffect = new MagicOrbEffect(screenX, screenY, this.backgroundScale);
    
    // Add magic orb container after campfire but before UI elements
    // Insert after campfire (index 2, since background is 0 and campfire is 1)
    this.menuContainer.addChildAt(this.magicOrbEffect.container, 2);
    
    console.log(`✨ Magic orb effect added at (${screenX.toFixed(1)}, ${screenY.toFixed(1)}) with scale ${this.backgroundScale.toFixed(3)}`);
  }
  
  update(deltaTime) {
    // Update campfire animation
    if (this.campfireEffect) {
      this.campfireEffect.update(deltaTime);
    }
    
    // Update magic orb animation
    if (this.magicOrbEffect) {
      this.magicOrbEffect.update(deltaTime);
    }
  }
  
  show() {
    // Add menu to stage
    this.app.stage.addChild(this.menuContainer);
    
    // Add character select screen (initially hidden)
    if (this.characterSelectScreen) {
      this.app.stage.addChild(this.characterSelectScreen.container);
    }
    
    // Start animation loop
    let lastTime = Date.now();
    this.updateTicker = () => {
      const now = Date.now();
      const deltaTime = (now - lastTime) / 1000; // Convert to seconds
      lastTime = now;
      
      this.update(deltaTime);
    };
    
    this.app.ticker.add(this.updateTicker);
    
    console.log('📺 Main Menu displayed');
  }
  
  async openCharacterSelect() {
    // Dim background effects slightly
    if (this.campfireEffect) {
      this.campfireEffect.setFade(0.7);
    }
    if (this.magicOrbEffect) {
      this.magicOrbEffect.setFade(0.7);
    }
    
    // Show character select popup
    if (this.characterSelectScreen) {
      await this.characterSelectScreen.show();
    }
    
    console.log('🎭 Character selection opened');
  }
  
  async hide() {
    // Disable button to prevent multiple clicks
    if (this.button) {
      this.button.eventMode = 'none';
    }
    
    // Create black fade overlay
    this.fadeOverlay = new PIXI.Graphics();
    this.fadeOverlay.rect(0, 0, this.VIRTUAL_W, this.VIRTUAL_H);
    this.fadeOverlay.fill(0x000000);
    this.fadeOverlay.alpha = 0;
    this.menuContainer.addChild(this.fadeOverlay);
    
    // Fade to black over 1.5 seconds
    const duration = 1.5;
    let elapsed = 0;
    
    return new Promise(resolve => {
      const startTime = Date.now();
      
      const fadeUpdate = () => {
        elapsed = (Date.now() - startTime) / 1000;
        const fadeProgress = Math.min(elapsed / duration, 1);
        this.fadeOverlay.alpha = fadeProgress;
        
        // Fade campfire effect along with screen
        if (this.campfireEffect) {
          this.campfireEffect.setFade(1 - fadeProgress);
        }
        
        // Fade magic orb effect along with screen
        if (this.magicOrbEffect) {
          this.magicOrbEffect.setFade(1 - fadeProgress);
        }
        
        if (elapsed >= duration) {
          console.log('🌑 Fade out complete');
          resolve();
        } else {
          requestAnimationFrame(fadeUpdate);
        }
      };
      
      fadeUpdate();
    });
  }
  
  async startGame(selectedCharacter) {
    console.log('🎮 Starting game with character:', selectedCharacter?.name);
    
    // Restore effect brightness before fade
    if (this.campfireEffect) {
      this.campfireEffect.setFade(1.0);
    }
    if (this.magicOrbEffect) {
      this.magicOrbEffect.setFade(1.0);
    }
    
    await this.hide();
    this.destroy();
    
    if (this.onStartGame) {
      this.onStartGame(selectedCharacter);
    }
  }
  
  destroy() {
    // Stop animation ticker
    if (this.updateTicker) {
      this.app.ticker.remove(this.updateTicker);
      this.updateTicker = null;
    }
    
    // Destroy campfire effect
    if (this.campfireEffect) {
      this.campfireEffect.destroy();
      this.campfireEffect = null;
    }
    
    // Destroy magic orb effect
    if (this.magicOrbEffect) {
      this.magicOrbEffect.destroy();
      this.magicOrbEffect = null;
    }
    
    // Destroy character select screen
    if (this.characterSelectScreen) {
      this.characterSelectScreen.destroy();
      this.characterSelectScreen = null;
    }
    
    // Remove menu from stage
    if (this.menuContainer.parent) {
      this.app.stage.removeChild(this.menuContainer);
    }
    
    // Destroy all children
    this.menuContainer.destroy({ children: true });
    
    console.log('🗑️ Main Menu destroyed');
  }
}

