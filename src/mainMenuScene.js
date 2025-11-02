// --- Main Menu Scene ---
// Manages the main menu with background, start button, and transitions

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
  }
  
  async initialize() {
    try {
      console.log('🔄 Loading main menu assets...');
      
      // Load background image
      const bgTexture = await PIXI.Assets.load('./src/assets/Main_Menu.png');
      bgTexture.source.scaleMode = 'nearest';
      console.log('✅ Background loaded:', bgTexture.width, 'x', bgTexture.height);
      
      this.background = new PIXI.Sprite(bgTexture);
      // Scale to fit 1200x800 virtual resolution (cover entire screen)
      const scaleX = this.VIRTUAL_W / bgTexture.width;
      const scaleY = this.VIRTUAL_H / bgTexture.height;
      const scale = Math.max(scaleX, scaleY); // Cover entire screen
      this.background.scale.set(scale);
      this.background.position.set(this.VIRTUAL_W / 2, this.VIRTUAL_H / 2);
      this.background.anchor.set(0.5);
      this.menuContainer.addChild(this.background);
      
      // Load button sprite
      const buttonTexture = await PIXI.Assets.load('./src/assets/Button.png');
      buttonTexture.source.scaleMode = 'nearest';
      console.log('✅ Button loaded:', buttonTexture.width, 'x', buttonTexture.height);
      
      this.button = new PIXI.Sprite(buttonTexture);
      this.button.anchor.set(0.5);
      this.button.scale.set(0.1125); // Compact list-style layout (1.5x larger)
      this.button.position.set(250, this.VIRTUAL_H / 2); // Left side, vertically centered
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

