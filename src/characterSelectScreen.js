// --- Character Selection Screen ---
// Medieval-themed character selection popup overlay

// Character data structure
const CHARACTERS = [
  {
    id: 'knight',
    characterKey: 'Knight',
    name: 'The Knight',
    unlocked: true,
    portrait: 'Knight_Portrait.png',
    weapon: 'Sword',
    startingWeaponKey: 'Sword',
    passive: 'Iron Will - Increased defense and\nhealth gain per level',
    description: 'A steadfast warrior clad in steel,\nready to face the endless hordes.'
  },
  {
    id: 'ranger',
    characterKey: 'Ranger',
    name: 'The Ranger',
    unlocked: true,
    portrait: 'Ranger_portrait.png',
    weapon: 'Sylvan Bow',
    startingWeaponKey: 'Longbow',
    passive: 'Verdant Pulse - Increases crit chance and\nattack power with every level',
    description: 'A hooded marksman who rains arrows\nwith relentless precision.'
  }
];

export class CharacterSelectScreen {
  constructor(app, virtualWidth, virtualHeight, onStartGame) {
    this.app = app;
    this.VIRTUAL_W = virtualWidth;
    this.VIRTUAL_H = virtualHeight;
    this.onStartGame = onStartGame; // Callback to actually start the game
    
    this.container = new PIXI.Container();
    this.container.visible = false; // Initially hidden
    
    this.dimOverlay = null;
    this.popupFrame = null;
    this.characterCards = [];
    this.startButton = null;
    this.startButtonText = null;
    this.buttonTexture = null; // Store button texture
    
    this.selectedCharacterIndex = -1; // No character selected initially
    this.isVisible = false;
    
    // Color palette
    this.colors = {
      dimBackground: 0x000000,
      woodDark: 0x3d2817,
      woodDarker: 0x2a1810,
      frameBorder: 0x8B6914,
      frameHighlight: 0xDAA520,
      selectionGold: 0xFFD700,
      textPrimary: 0xFFFFFF,
      textSecondary: 0xCCCCCC,
      lockedGrey: 0x555555,
      disabledGrey: 0x666666
    };
  }
  
  async initialize() {
    try {
      console.log('🎭 Initializing character selection screen...');
      
      // Create dim overlay
      this.createDimOverlay();
      
      // Create popup frame
      this.createPopupFrame();
      
      // Load character portraits and create cards
      await this.createCharacterCards();
      
      // Load button texture
      this.buttonTexture = await PIXI.Assets.load('./src/assets/Button_2.png');
      this.buttonTexture.source.scaleMode = 'nearest';
      
      // Create start button
      this.createStartButton();
      
      console.log('✅ Character selection screen initialized');
    } catch (error) {
      console.error('❌ Error initializing character selection:', error);
      throw error;
    }
  }
  
  createDimOverlay() {
    // Black transparent overlay (40% opacity)
    this.dimOverlay = new PIXI.Graphics();
    this.dimOverlay.rect(0, 0, this.VIRTUAL_W, this.VIRTUAL_H);
    this.dimOverlay.fill({ color: this.colors.dimBackground, alpha: 0.4 });
    this.container.addChild(this.dimOverlay);
  }
  
  createPopupFrame() {
    // Popup dimensions
    const popupWidth = 700;
    const popupHeight = 550;
    const popupX = (this.VIRTUAL_W - popupWidth) / 2;
    const popupY = (this.VIRTUAL_H - popupHeight) / 2;
    
    this.popupFrame = new PIXI.Container();
    this.popupFrame.position.set(popupX, popupY);
    
    // Create medieval wooden frame
    const frame = new PIXI.Graphics();
    
    // Shadow/depth effect (offset darker layer)
    frame.rect(4, 4, popupWidth, popupHeight);
    frame.fill({ color: 0x000000, alpha: 0.3 });
    
    // Main background (dark wood)
    frame.rect(0, 0, popupWidth, popupHeight);
    frame.fill({ color: this.colors.woodDark, alpha: 0.85 });
    
    // Border/trim (golden-brown)
    frame.rect(0, 0, popupWidth, popupHeight);
    frame.stroke({ color: this.colors.frameBorder, width: 4 });
    
    // Inner highlight border
    frame.rect(8, 8, popupWidth - 16, popupHeight - 16);
    frame.stroke({ color: this.colors.frameHighlight, width: 2 });
    
    // Corner decorations (simple rectangles for pixel-art style)
    const cornerSize = 12;
    const corners = [
      [0, 0], [popupWidth - cornerSize, 0],
      [0, popupHeight - cornerSize], [popupWidth - cornerSize, popupHeight - cornerSize]
    ];
    
    corners.forEach(([x, y]) => {
      frame.rect(x, y, cornerSize, cornerSize);
      frame.fill({ color: this.colors.frameHighlight });
    });
    
    this.popupFrame.addChild(frame);
    
    // Add title
    const title = new PIXI.Text('Choose Your Hero', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: 24,
      fill: this.colors.textPrimary,
      stroke: { color: 0x000000, width: 4 }
    });
    title.anchor.set(0.5, 0);
    title.position.set(popupWidth / 2, 20);
    this.popupFrame.addChild(title);
    
    this.container.addChild(this.popupFrame);
  }
  
  async createCharacterCards() {
    const cardWidth = 620;
    const cardHeight = 110;
    const cardSpacing = 15;
    const startY = 80;
    const startX = 40;
    
    // Load portraits
    const portraits = {};
    for (const char of CHARACTERS) {
      if (char.unlocked && char.portrait) {
        const texture = await PIXI.Assets.load(`./src/assets/${char.portrait}`);
        texture.source.scaleMode = 'nearest';
        portraits[char.id] = texture;
      }
    }
    
    // Create cards
    for (let i = 0; i < CHARACTERS.length; i++) {
      const char = CHARACTERS[i];
      const cardY = startY + (i * (cardHeight + cardSpacing));
      
      const card = await this.createCharacterCard(char, i, startX, cardY, cardWidth, cardHeight, portraits[char.id]);
      this.characterCards.push(card);
      this.popupFrame.addChild(card.container);
    }
  }
  
  async createCharacterCard(charData, index, x, y, width, height, portraitTexture) {
    const card = {
      container: new PIXI.Container(),
      background: null,
      highlight: null,
      charData: charData,
      index: index
    };
    
    card.container.position.set(x, y);
    
    // Card background
    card.background = new PIXI.Graphics();
    card.background.rect(0, 0, width, height);
    card.background.fill({ 
      color: charData.unlocked ? this.colors.woodDarker : this.colors.lockedGrey, 
      alpha: charData.unlocked ? 0.8 : 0.4 
    });
    card.background.stroke({ color: this.colors.frameBorder, width: 2 });
    card.container.addChild(card.background);
    
    // Selection highlight (initially hidden)
    card.highlight = new PIXI.Graphics();
    card.highlight.rect(-4, -4, width + 8, height + 8);
    card.highlight.stroke({ color: this.colors.selectionGold, width: 4 });
    card.highlight.visible = false;
    card.container.addChildAt(card.highlight, 0); // Add behind background
    
    if (charData.unlocked) {
      // Portrait with silver border
      if (portraitTexture) {
        // Portrait container for border effect
        const portraitContainer = new PIXI.Container();
        portraitContainer.position.set(50, height / 2);
        
        // Portrait sprite (20% smaller vertically)
        const portrait = new PIXI.Sprite(portraitTexture);
        portrait.anchor.set(0.5);
        portrait.scale.set(0.075, 0.06); // X: 0.075, Y: 20% smaller
        portraitContainer.addChild(portrait);
        
        // Calculate exact border dimensions to fit the scaled portrait
        const borderWidth = portraitTexture.width * 0.075;
        const borderHeight = portraitTexture.height * 0.06;
        
        // Thin silver border frame on top - matches portrait dimensions exactly
        const border = new PIXI.Graphics();
        border.rect(-borderWidth / 2, -borderHeight / 2, borderWidth, borderHeight);
        border.stroke({ color: 0xC0C0C0, width: 2 }); // Thin silver border (2px)
        portraitContainer.addChild(border); // Added after portrait to layer on top
        
        card.container.addChild(portraitContainer);
      }
      
      // Character name
      const nameText = new PIXI.Text(charData.name, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 18,
        fill: this.colors.textPrimary,
        stroke: { color: 0x000000, width: 3 }
      });
      nameText.position.set(110, 10);
      card.container.addChild(nameText);
      
      // Weapon
      const weaponText = new PIXI.Text(`Starting Weapon: ${charData.weapon}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 11,
        fill: this.colors.textSecondary
      });
      weaponText.position.set(110, 35);
      card.container.addChild(weaponText);
      
      // Passive
      const passiveText = new PIXI.Text(`Passive: ${charData.passive}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 9,
        fill: this.colors.textSecondary,
        wordWrap: true,
        wordWrapWidth: 490
      });
      passiveText.position.set(110, 52);
      card.container.addChild(passiveText);
      
      // Description
      const descText = new PIXI.Text(charData.description, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 8,
        fill: this.colors.textSecondary,
        wordWrap: true,
        wordWrapWidth: 490
      });
      descText.position.set(110, 78);
      card.container.addChild(descText);
      
      // Make interactive
      card.container.eventMode = 'static';
      card.container.cursor = 'pointer';
      
      card.container.on('pointerover', () => {
        if (this.selectedCharacterIndex !== index) {
          card.background.tint = 0xCCCCCC;
        }
      });
      
      card.container.on('pointerout', () => {
        if (this.selectedCharacterIndex !== index) {
          card.background.tint = 0xFFFFFF;
        }
      });
      
      card.container.on('pointerdown', () => {
        this.selectCharacter(index);
      });
      
    } else {
      // Locked character
      const lockedText = new PIXI.Text(charData.name, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 24,
        fill: this.colors.lockedGrey
      });
      lockedText.anchor.set(0, 0.5);
      lockedText.position.set(110, height / 2 - 10);
      card.container.addChild(lockedText);
      
      const descText = new PIXI.Text(charData.description, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 9,
        fill: this.colors.lockedGrey,
        wordWrap: true,
        wordWrapWidth: 490
      });
      descText.position.set(110, height / 2 + 10);
      card.container.addChild(descText);
      
      // Locked icon/silhouette
      const lockedIcon = new PIXI.Graphics();
      lockedIcon.rect(20, 20, 60, 70);
      lockedIcon.fill({ color: this.colors.lockedGrey, alpha: 0.3 });
      card.container.addChild(lockedIcon);
    }
    
    return card;
  }
  
  selectCharacter(index) {
    // Deselect previous
    if (this.selectedCharacterIndex >= 0) {
      this.characterCards[this.selectedCharacterIndex].highlight.visible = false;
    }
    
    // Select new
    this.selectedCharacterIndex = index;
    this.characterCards[index].highlight.visible = true;
    
    // Enable start button
    this.updateStartButton();
    
    console.log('✅ Character selected:', CHARACTERS[index].name);
  }
  
  createStartButton() {
    const buttonX = 350; // Centered in popup (700/2)
    const buttonY = 480; // Near bottom
    
    // Button sprite using Button_2.png
    this.startButton = new PIXI.Sprite(this.buttonTexture);
    this.startButton.anchor.set(0.5);
    this.startButton.scale.set(0.12); // Adjusted scale for Button_2
    this.startButton.position.set(buttonX, buttonY);
    this.startButton.eventMode = 'none'; // Disabled initially
    this.startButton.cursor = 'pointer';
    this.startButton.tint = 0x666666; // Greyed out initially
    this.popupFrame.addChild(this.startButton);
    
    // Button text
    this.startButtonText = new PIXI.Text('Start\nAdventure', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: 10,
      fill: this.colors.lockedGrey,
      align: 'center',
      stroke: { color: 0x000000, width: 3 }
    });
    this.startButtonText.anchor.set(0.5);
    this.startButtonText.position.set(buttonX, buttonY);
    this.popupFrame.addChild(this.startButtonText);
    
    // Hover effects (will be set up when enabled)
    this.startButton.on('pointerover', () => {
      if (this.selectedCharacterIndex >= 0) {
        this.startButton.scale.set(0.13);
        this.startButton.tint = 0xDDDDDD;
      }
    });
    
    this.startButton.on('pointerout', () => {
      if (this.selectedCharacterIndex >= 0) {
        this.startButton.scale.set(0.12);
        this.startButton.tint = 0xFFFFFF;
      }
    });
    
    // Click handler - THIS is what starts the game
    this.startButton.on('pointerdown', () => {
      if (this.selectedCharacterIndex >= 0) {
        this.startAdventure();
      }
    });
  }
  
  updateStartButton() {
    if (this.selectedCharacterIndex >= 0) {
      // Enable button
      this.startButton.tint = 0xFFFFFF;
      this.startButton.eventMode = 'static';
      this.startButtonText.style.fill = this.colors.textPrimary;
    } else {
      // Disable button
      this.startButton.tint = 0x666666;
      this.startButton.eventMode = 'none';
      this.startButtonText.style.fill = this.colors.lockedGrey;
    }
  }
  
  async startAdventure() {
    console.log('🎮 Starting adventure with:', CHARACTERS[this.selectedCharacterIndex].name);
    
    // Hide the popup
    await this.hide();
    
    // Call the game start callback with selected character data
    if (this.onStartGame) {
      this.onStartGame(CHARACTERS[this.selectedCharacterIndex]);
    }
  }
  
  async show() {
    this.isVisible = true;
    this.container.visible = true;
    
    // Fade in animation
    this.container.alpha = 0;
    
    return new Promise(resolve => {
      const duration = 0.3; // 300ms
      const startTime = Date.now();
      
      const fadeIn = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const progress = Math.min(elapsed / duration, 1);
        
        this.container.alpha = progress;
        
        if (progress >= 1) {
          resolve();
        } else {
          requestAnimationFrame(fadeIn);
        }
      };
      
      fadeIn();
    });
  }
  
  async hide() {
    return new Promise(resolve => {
      const duration = 0.3; // 300ms
      const startTime = Date.now();
      
      const fadeOut = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const progress = Math.min(elapsed / duration, 1);
        
        this.container.alpha = 1 - progress;
        
        if (progress >= 1) {
          this.container.visible = false;
          this.isVisible = false;
          resolve();
        } else {
          requestAnimationFrame(fadeOut);
        }
      };
      
      fadeOut();
    });
  }
  
  destroy() {
    this.container.destroy({ children: true });
    console.log('🗑️ Character selection screen destroyed');
  }
}

