// --- Main Menu Scene ---
// Manages the main menu with background, start button, and transitions

// Background configuration - Change this to switch backgrounds
const MENU_CONFIG = {
  backgrounds: ['Main_Menu.png', 'Main_Menu_alt.png'],
  currentBackgroundIndex: 1, // 0 for Main_Menu.png, 1 for Main_Menu_alt.png
  showLogo: true
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
    this.switchButton = null;
    this.switchButtonText = null;
    this.bgTextures = []; // Store both background textures
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
      const scale = Math.max(scaleX, scaleY); // Cover entire screen
      this.background.scale.set(scale);
      this.background.position.set(this.VIRTUAL_W / 2, this.VIRTUAL_H / 2);
      this.background.anchor.set(0.5);
      this.menuContainer.addChild(this.background);
      
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
      
      // Add "START" text on button
      this.startText = new PIXI.Text('START', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 16,
        fill: 0xFFFFFF,
        stroke: { color: 0x000000, width: 3 }
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
      
      // Click handler
      this.button.on('pointerdown', () => {
        this.startGame();
      });
      
      // Add background switch button (bottom-right corner)
      this.switchButton = new PIXI.Graphics();
      this.switchButton.rect(0, 0, 100, 40);
      this.switchButton.fill(0x333333);
      this.switchButton.position.set(this.VIRTUAL_W - 120, this.VIRTUAL_H - 60);
      this.switchButton.eventMode = 'static';
      this.switchButton.cursor = 'pointer';
      this.menuContainer.addChild(this.switchButton);
      
      this.switchButtonText = new PIXI.Text('BG', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 12,
        fill: 0xFFFFFF
      });
      this.switchButtonText.anchor.set(0.5);
      this.switchButtonText.position.set(
        this.switchButton.x + 50,
        this.switchButton.y + 20
      );
      this.menuContainer.addChild(this.switchButtonText);
      
      // Hover effects
      this.switchButton.on('pointerover', () => {
        this.switchButton.tint = 0xAAAAAA;
      });
      this.switchButton.on('pointerout', () => {
        this.switchButton.tint = 0xFFFFFF;
      });
      
      // Click handler to toggle background
      this.switchButton.on('pointerdown', () => {
        this.toggleBackground();
      });
      
      console.log('🎮 Main Menu initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing main menu:', error);
      throw error;
    }
  }
  
  show() {
    // Add menu to stage
    this.app.stage.addChild(this.menuContainer);
    console.log('📺 Main Menu displayed');
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
        this.fadeOverlay.alpha = Math.min(elapsed / duration, 1);
        
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
  
  async startGame() {
    console.log('🎮 Starting game...');
    await this.hide();
    this.destroy();
    
    if (this.onStartGame) {
      this.onStartGame();
    }
  }
  
  toggleBackground() {
    // Toggle to next background
    MENU_CONFIG.currentBackgroundIndex = 
      (MENU_CONFIG.currentBackgroundIndex + 1) % MENU_CONFIG.backgrounds.length;
    
    const newTexture = this.bgTextures[MENU_CONFIG.currentBackgroundIndex];
    this.background.texture = newTexture;
    
    // Recalculate scale for new texture dimensions
    const scaleX = this.VIRTUAL_W / newTexture.width;
    const scaleY = this.VIRTUAL_H / newTexture.height;
    const scale = Math.max(scaleX, scaleY);
    this.background.scale.set(scale);
    
    console.log('🔄 Switched to:', MENU_CONFIG.backgrounds[MENU_CONFIG.currentBackgroundIndex]);
  }
  
  destroy() {
    // Remove menu from stage
    if (this.menuContainer.parent) {
      this.app.stage.removeChild(this.menuContainer);
    }
    
    // Destroy all children
    this.menuContainer.destroy({ children: true });
    
    console.log('🗑️ Main Menu destroyed');
  }
}

