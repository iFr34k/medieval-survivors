// --- System Imports ---
import { LevelSystem } from './levelSystem.js';
import { UpgradeSystem, UpgradeCard } from './upgradeSystem.js';
import { DifficultySystem } from './difficultySystem.js';
import { SpawnController } from './spawnController.js';
import { ModifierSystem } from './modifierSystem.js';
import { CharacterSystem } from './characterSystem.js';
import { WeaponSystem, Weapon } from './weaponSystem.js';
import { ItemSystem } from './itemSystem.js';
import { MainMenuScene } from './mainMenuScene.js';

// Ensure PIXI namespace is available (from CDN or dynamic import)
let PIXI = window.PIXI;
if (!PIXI) {
  const pixiModule = await import('https://unpkg.com/pixi.js@8/dist/pixi.mjs');
  PIXI = { ...pixiModule };
  window.PIXI = PIXI;
}

// --- Basiskonstanten ---
const VIRTUAL_W = 1200;
const VIRTUAL_H = 800;

// --- Slot Limits ---
const MAX_WEAPON_SLOTS = 3;
const MAX_ITEM_SLOTS = 3;

// --- Range Conversion ---
const RANGE_BASE = 300; // 300 pixels per 1.0 range stat

  // --- Keyboard Input ---
  const keys = {};
  const baseMoveSpeed = 200; // Base pixel per second (will be modified by modifiers)

// --- Combat State Variables (Global) ---
let combatMode = 'auto'; // 'auto' or 'manual'

// --- Game State Variables ---
let gamePaused = false;
let levelUpPopupActive = false;
let gameOver = false;
let gameStarted = false; // Flag to delay timer start after fade-in
let globalXPMultiplier = 1.0; // Doubles after each boss defeat
let pendingLevelUps = []; // Queue of pending level-up popups

// --- Global Reset Function Reference ---
let resetGameFunction = null;
let triggerDashFunction = null;
let spaceKeyProcessed = false;

function handleKeyDown(e) {
  keys[e.key.toLowerCase()] = true;
  
  // Dash trigger on Space key - prevent key repeat by checking if already processed
  if (e.key === ' ' && triggerDashFunction && !spaceKeyProcessed) {
    spaceKeyProcessed = true;
    triggerDashFunction();
  }
  
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
  
  // Reset Space key processed flag when released
  if (e.key === ' ') {
    spaceKeyProcessed = false;
  }
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

  // Main menu reference (global scope for restart)
  let currentMainMenu = null;
  
  // Show main menu first
  async function showMainMenu() {
    currentMainMenu = new MainMenuScene(app, VIRTUAL_W, VIRTUAL_H, (selectedCharacterData) => {
      const chosenName = selectedCharacterData?.name || 'The Knight';
      console.log(`🎮 Game started from menu as ${chosenName}`);
      initializeGame(selectedCharacterData);
    });
    
    await currentMainMenu.initialize();
    currentMainMenu.show();
  }
  
  await showMainMenu();
  
  // DO NOT call initializeGame() here - it will be called from the menu button callback
  
  // Wrap game initialization in a function
  async function initializeGame(selectedCharacterData) {
    const startingCharacterKey = selectedCharacterData?.characterKey || 'Knight';
    const startingCharacterName = selectedCharacterData?.name || 'The Knight';
  
  // Delay game start by 1 second to allow fade-in
  gameStarted = false;
  setTimeout(() => {
    gameStarted = true;
    console.log('⏱️ Timer started!');
  }, 1000);
  
  // --- Dash Configuration ---
  const dashConfig = {
    distance: 160,        // pixels
    duration: 0.12,       // seconds
    iFrameDuration: 0.10, // seconds (invulnerability during first part of dash)
    cooldown: 1.25        // seconds
  };
  
  // --- Dash Trigger Function ---
  function triggerDash() {
    // Check if dash is available (not on cooldown, not already dashing, not dazed, game not paused/over)
    if (player.dashActive || player.dashCooldownTimer > 0 || gameOver || gamePaused || player.dazeRemaining > 0) {
      return;
    }
    
    // Calculate dash direction: current WASD input > last movement > fallback to (1, 0)
    let dashDirX = 0;
    let dashDirY = 0;
    
    // Check current WASD input
    if (keys["w"] || keys["arrowup"]) dashDirY -= 1;
    if (keys["s"] || keys["arrowdown"]) dashDirY += 1;
    if (keys["a"] || keys["arrowleft"]) dashDirX -= 1;
    if (keys["d"] || keys["arrowright"]) dashDirX += 1;
    
    // Normalize current input direction
    const inputLength = Math.hypot(dashDirX, dashDirY);
    if (inputLength > 0) {
      dashDirX /= inputLength;
      dashDirY /= inputLength;
    } else {
      // No current input - use last movement direction
      const lastLength = Math.hypot(player.lastMovementX, player.lastMovementY);
      if (lastLength > 0) {
        dashDirX = player.lastMovementX;
        dashDirY = player.lastMovementY;
      } else {
        // Fallback to (1, 0) - right direction
        dashDirX = 1;
        dashDirY = 0;
      }
    }
    
    // Initialize dash state
    player.dashActive = true;
    player.dashTimer = dashConfig.duration;
    player.dashDirectionX = dashDirX;
    player.dashDirectionY = dashDirY;
    player.dashStartX = player.x;
    player.dashStartY = player.y;
  }
  
  // Make triggerDash globally accessible
  triggerDashFunction = triggerDash;
  
  // Top-down 2D game - single layer system (no parallax needed)
  // world: all game objects in same coordinate space (1:1 camera movement)
  // ui: HUD and menus
  const world = new PIXI.Container();
  const combatFX = new PIXI.Container();
  const ui = new PIXI.Container();
  app.stage.addChild(world, combatFX, ui);
  
  // Fade overlay for game over transition (on top of everything)
  const gameOverOverlay = new PIXI.Graphics();
  gameOverOverlay.rect(0, 0, VIRTUAL_W, VIRTUAL_H);
  gameOverOverlay.fill(0x000000);
  gameOverOverlay.alpha = 0;
  gameOverOverlay.visible = false;

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

  // --- Player Character ---
  const knightTexture = await PIXI.Assets.load('./src/assets/Knight_new.png');
  knightTexture.source.scaleMode = 'nearest';
  const rangerTexture = await PIXI.Assets.load('./src/assets/Ranger.png');
  rangerTexture.source.scaleMode = 'nearest';
  const mageTexture = await PIXI.Assets.load('./src/assets/Mage.png');
  mageTexture.source.scaleMode = 'nearest';

  const characterTextures = {
    Knight: knightTexture,
    Ranger: rangerTexture,
    Mage: mageTexture
  };

  // PixelLab knight: 8-direction, 124×124, reference concept (T-visor helm, bronze-gold trim). Order: south, east, north, west, south-east, north-east, north-west, south-west
  let knightDirectionTextures = null;
  let knightIdleSouthTextures = null;
  let knightIdleEastTextures = null;
  let knightIdleNorthTextures = null;
  let knightIdleWestTextures = null;
  let knightIdleSouthEastTextures = null;
  let knightIdleNorthEastTextures = null;
  let knightIdleNorthWestTextures = null;
  let knightIdleSouthWestTextures = null;
  const KNIGHT_RUN_DIRECTIONS = ['south', 'east', 'north', 'west', 'south-east', 'north-east', 'north-west', 'south-west'];
  const KNIGHT_RUN_ANIM_FOLDER = 'running-8-frames';
  const KNIGHT_WALK_ANIM_FOLDER = 'walking-8-frames';
  let knightRunTextures = [null, null, null, null, null, null, null, null];
  let knightWalkTextures = [null, null, null, null, null, null, null, null];
  if (startingCharacterKey === 'Knight') {
    const PIXELLAB_KNIGHT_BASE = 'https://backblaze.pixellab.ai/file/pixellab-characters/aaa68e97-b07b-4611-8954-34c295c894c9/60a256f7-b45d-44c2-a0f5-4fd52a9a3f9f';
    const directionNames = ['south', 'east', 'north', 'west', 'south-east', 'north-east', 'north-west', 'south-west'];
    try {
      knightDirectionTextures = await Promise.all(directionNames.map(name =>
        PIXI.Assets.load(`${PIXELLAB_KNIGHT_BASE}/rotations/${name}.png`)
      ));
      knightDirectionTextures.forEach(t => { t.source.scaleMode = 'nearest'; });
      console.log('🛡️ PixelLab knight 8-direction textures loaded');
      // Breathing-idle south (4 frames): try local (from download script) then CDN
      try {
        const localIdle = [0, 1, 2, 3].map(i => `./src/assets/Knight/knight_idle/knight_idle_south/${i}.png`);
        knightIdleSouthTextures = await Promise.all(localIdle.map(url => PIXI.Assets.load(url)));
        knightIdleSouthTextures.forEach(t => { t.source.scaleMode = 'nearest'; });
        console.log('🛡️ PixelLab knight breathing-idle (south) loaded from local assets');
      } catch (_) {
        try {
          const idleUrls = [0, 1, 2, 3].map(i => `${PIXELLAB_KNIGHT_BASE}/animations/breathing-idle/south/${i}.png`);
          knightIdleSouthTextures = await Promise.all(idleUrls.map(url => PIXI.Assets.load(url)));
          knightIdleSouthTextures.forEach(t => { t.source.scaleMode = 'nearest'; });
          console.log('🛡️ PixelLab knight breathing-idle (south) loaded from CDN');
        } catch (__) {
          // Fallback: use south rotation twice so idle path runs (static “breathing” until real frames added)
          knightIdleSouthTextures = [knightDirectionTextures[0], knightDirectionTextures[0]];
          console.warn('Knight idle: run "npm run download-knight-idle" (with PIXELLAB_API_TOKEN) to get real idle frames.');
        }
      }
      // Breathing-idle east (4 frames): same order – local, CDN, fallback
      try {
        const localEast = [0, 1, 2, 3].map(i => `./src/assets/Knight/knight_idle/knight_idle_east/${i}.png`);
        knightIdleEastTextures = await Promise.all(localEast.map(url => PIXI.Assets.load(url)));
        knightIdleEastTextures.forEach(t => { t.source.scaleMode = 'nearest'; });
        console.log('🛡️ PixelLab knight breathing-idle (east) loaded from local assets');
      } catch (_) {
        try {
          const eastUrls = [0, 1, 2, 3].map(i => `${PIXELLAB_KNIGHT_BASE}/animations/breathing-idle/east/${i}.png`);
          knightIdleEastTextures = await Promise.all(eastUrls.map(url => PIXI.Assets.load(url)));
          knightIdleEastTextures.forEach(t => { t.source.scaleMode = 'nearest'; });
          console.log('🛡️ PixelLab knight breathing-idle (east) loaded from CDN');
        } catch (__) {
          knightIdleEastTextures = knightDirectionTextures ? [knightDirectionTextures[1], knightDirectionTextures[1]] : null;
        }
      }
      // Breathing-idle north (4 frames)
      try {
        const localNorth = [0, 1, 2, 3].map(i => `./src/assets/Knight/knight_idle/knight_idle_north/${i}.png`);
        knightIdleNorthTextures = await Promise.all(localNorth.map(url => PIXI.Assets.load(url)));
        knightIdleNorthTextures.forEach(t => { t.source.scaleMode = 'nearest'; });
        console.log('🛡️ PixelLab knight breathing-idle (north) loaded from local assets');
      } catch (_) {
        try {
          const northUrls = [0, 1, 2, 3].map(i => `${PIXELLAB_KNIGHT_BASE}/animations/breathing-idle/north/${i}.png`);
          knightIdleNorthTextures = await Promise.all(northUrls.map(url => PIXI.Assets.load(url)));
          knightIdleNorthTextures.forEach(t => { t.source.scaleMode = 'nearest'; });
          console.log('🛡️ PixelLab knight breathing-idle (north) loaded from CDN');
        } catch (__) {
          knightIdleNorthTextures = knightDirectionTextures ? [knightDirectionTextures[2], knightDirectionTextures[2]] : null;
        }
      }
      // Breathing-idle west (4 frames)
      try {
        const localWest = [0, 1, 2, 3].map(i => `./src/assets/Knight/knight_idle/knight_idle_west/${i}.png`);
        knightIdleWestTextures = await Promise.all(localWest.map(url => PIXI.Assets.load(url)));
        knightIdleWestTextures.forEach(t => { t.source.scaleMode = 'nearest'; });
        console.log('🛡️ PixelLab knight breathing-idle (west) loaded from local assets');
      } catch (_) {
        try {
          const westUrls = [0, 1, 2, 3].map(i => `${PIXELLAB_KNIGHT_BASE}/animations/breathing-idle/west/${i}.png`);
          knightIdleWestTextures = await Promise.all(westUrls.map(url => PIXI.Assets.load(url)));
          knightIdleWestTextures.forEach(t => { t.source.scaleMode = 'nearest'; });
          console.log('🛡️ PixelLab knight breathing-idle (west) loaded from CDN');
        } catch (__) {
          knightIdleWestTextures = knightDirectionTextures ? [knightDirectionTextures[3], knightDirectionTextures[3]] : null;
        }
      }
      // Breathing-idle south-east (texIndex 4)
      try {
        const local = [0, 1, 2, 3].map(i => `./src/assets/Knight/knight_idle/knight_idle_south-east/${i}.png`);
        knightIdleSouthEastTextures = await Promise.all(local.map(url => PIXI.Assets.load(url)));
        knightIdleSouthEastTextures.forEach(t => { t.source.scaleMode = 'nearest'; });
        console.log('🛡️ PixelLab knight breathing-idle (south-east) loaded from local assets');
      } catch (_) {
        try {
          const urls = [0, 1, 2, 3].map(i => `${PIXELLAB_KNIGHT_BASE}/animations/breathing-idle/south-east/${i}.png`);
          knightIdleSouthEastTextures = await Promise.all(urls.map(url => PIXI.Assets.load(url)));
          knightIdleSouthEastTextures.forEach(t => { t.source.scaleMode = 'nearest'; });
          console.log('🛡️ PixelLab knight breathing-idle (south-east) loaded from CDN');
        } catch (__) {
          knightIdleSouthEastTextures = knightDirectionTextures ? [knightDirectionTextures[4], knightDirectionTextures[4]] : null;
        }
      }
      // Breathing-idle north-east (texIndex 5)
      try {
        const local = [0, 1, 2, 3].map(i => `./src/assets/Knight/knight_idle/knight_idle_north-east/${i}.png`);
        knightIdleNorthEastTextures = await Promise.all(local.map(url => PIXI.Assets.load(url)));
        knightIdleNorthEastTextures.forEach(t => { t.source.scaleMode = 'nearest'; });
        console.log('🛡️ PixelLab knight breathing-idle (north-east) loaded from local assets');
      } catch (_) {
        try {
          const urls = [0, 1, 2, 3].map(i => `${PIXELLAB_KNIGHT_BASE}/animations/breathing-idle/north-east/${i}.png`);
          knightIdleNorthEastTextures = await Promise.all(urls.map(url => PIXI.Assets.load(url)));
          knightIdleNorthEastTextures.forEach(t => { t.source.scaleMode = 'nearest'; });
          console.log('🛡️ PixelLab knight breathing-idle (north-east) loaded from CDN');
        } catch (__) {
          knightIdleNorthEastTextures = knightDirectionTextures ? [knightDirectionTextures[5], knightDirectionTextures[5]] : null;
        }
      }
      // Breathing-idle north-west (texIndex 6)
      try {
        const local = [0, 1, 2, 3].map(i => `./src/assets/Knight/knight_idle/knight_idle_north-west/${i}.png`);
        knightIdleNorthWestTextures = await Promise.all(local.map(url => PIXI.Assets.load(url)));
        knightIdleNorthWestTextures.forEach(t => { t.source.scaleMode = 'nearest'; });
        console.log('🛡️ PixelLab knight breathing-idle (north-west) loaded from local assets');
      } catch (_) {
        try {
          const urls = [0, 1, 2, 3].map(i => `${PIXELLAB_KNIGHT_BASE}/animations/breathing-idle/north-west/${i}.png`);
          knightIdleNorthWestTextures = await Promise.all(urls.map(url => PIXI.Assets.load(url)));
          knightIdleNorthWestTextures.forEach(t => { t.source.scaleMode = 'nearest'; });
          console.log('🛡️ PixelLab knight breathing-idle (north-west) loaded from CDN');
        } catch (__) {
          knightIdleNorthWestTextures = knightDirectionTextures ? [knightDirectionTextures[6], knightDirectionTextures[6]] : null;
        }
      }
      // Breathing-idle south-west (texIndex 7)
      try {
        const local = [0, 1, 2, 3].map(i => `./src/assets/Knight/knight_idle/knight_idle_south-west/${i}.png`);
        knightIdleSouthWestTextures = await Promise.all(local.map(url => PIXI.Assets.load(url)));
        knightIdleSouthWestTextures.forEach(t => { t.source.scaleMode = 'nearest'; });
        console.log('🛡️ PixelLab knight breathing-idle (south-west) loaded from local assets');
      } catch (_) {
        try {
          const urls = [0, 1, 2, 3].map(i => `${PIXELLAB_KNIGHT_BASE}/animations/breathing-idle/south-west/${i}.png`);
          knightIdleSouthWestTextures = await Promise.all(urls.map(url => PIXI.Assets.load(url)));
          knightIdleSouthWestTextures.forEach(t => { t.source.scaleMode = 'nearest'; });
          console.log('🛡️ PixelLab knight breathing-idle (south-west) loaded from CDN');
        } catch (__) {
          knightIdleSouthWestTextures = knightDirectionTextures ? [knightDirectionTextures[7], knightDirectionTextures[7]] : null;
        }
      }
      // Run: load frames 0..N until 404 for each of 8 directions
      const loadRunFrames = async (baseUrl) => {
        const out = [];
        for (let i = 0; i < 16; i++) {
          try {
            const t = await PIXI.Assets.load(`${baseUrl}${i}.png`);
            t.source.scaleMode = 'nearest';
            out.push(t);
          } catch (_) { break; }
        }
        return out.length ? out : null;
      };
      for (let d = 0; d < 8; d++) {
        const dir = KNIGHT_RUN_DIRECTIONS[d];
        try {
          knightRunTextures[d] = await loadRunFrames(`./src/assets/Knight/knight_run/knight_run_${dir}/`);
          if (knightRunTextures[d]) console.log(`🛡️ PixelLab knight run (${dir}) loaded from local`);
        } catch (_) {}
        if (!knightRunTextures[d]) {
          knightRunTextures[d] = await loadRunFrames(`${PIXELLAB_KNIGHT_BASE}/animations/${KNIGHT_RUN_ANIM_FOLDER}/${dir}/`);
          if (knightRunTextures[d]) console.log(`🛡️ PixelLab knight run (${dir}) from CDN`);
        }
        if (!knightRunTextures[d] && knightDirectionTextures) {
          knightRunTextures[d] = [knightDirectionTextures[d], knightDirectionTextures[d]];
        }
      }
      // Walk (all 8 directions) – used when dazed and moving
      for (let d = 0; d < 8; d++) {
        const dir = KNIGHT_RUN_DIRECTIONS[d];
        try {
          knightWalkTextures[d] = await loadRunFrames(`./src/assets/Knight/knight_walk/knight_walk_${dir}/`);
          if (knightWalkTextures[d]) console.log(`🛡️ PixelLab knight walk (${dir}) loaded from local`);
        } catch (_) {}
        if (!knightWalkTextures[d]) {
          for (const walkFolder of [KNIGHT_WALK_ANIM_FOLDER, 'walking-4-frames', 'walking']) {
            knightWalkTextures[d] = await loadRunFrames(`${PIXELLAB_KNIGHT_BASE}/animations/${walkFolder}/${dir}/`);
            if (knightWalkTextures[d]) {
              console.log(`🛡️ PixelLab knight walk (${dir}) from CDN (${walkFolder})`);
              break;
            }
          }
        }
        if (!knightWalkTextures[d] && knightDirectionTextures) {
          knightWalkTextures[d] = [knightDirectionTextures[d], knightDirectionTextures[d]];
        }
      }
    } catch (e) {
      console.warn('PixelLab knight directions failed (use fallback):', e.message);
    }
  } else if (startingCharacterKey === 'Mage') {
    // Mage: same trifecta (idle, run, walk) from PixelLab. Set this ID after running: npm run create-mage
    const PIXELLAB_MAGE_CHARACTER_ID = ''; // Set after: npm run create-mage (darker, threatening mage)
    if (PIXELLAB_MAGE_CHARACTER_ID) {
      const PIXELLAB_MAGE_BASE = `https://backblaze.pixellab.ai/file/pixellab-characters/aaa68e97-b07b-4611-8954-34c295c894c9/${PIXELLAB_MAGE_CHARACTER_ID}`;
      const directionNames = ['south', 'east', 'north', 'west', 'south-east', 'north-east', 'north-west', 'south-west'];
      const loadRunFrames = async (baseUrl) => {
        const out = [];
        for (let i = 0; i < 16; i++) {
          try {
            const t = await PIXI.Assets.load(`${baseUrl}${i}.png`);
            t.source.scaleMode = 'nearest';
            out.push(t);
          } catch (_) { break; }
        }
        return out.length ? out : null;
      };
      try {
        knightDirectionTextures = await Promise.all(directionNames.map(name =>
          PIXI.Assets.load(`${PIXELLAB_MAGE_BASE}/rotations/${name}.png`)
        ));
        knightDirectionTextures.forEach(t => { t.source.scaleMode = 'nearest'; });
        console.log('🔮 PixelLab mage 8-direction textures loaded');
        const idleTextures = [knightIdleSouthTextures, knightIdleEastTextures, knightIdleNorthTextures, knightIdleWestTextures, knightIdleSouthEastTextures, knightIdleNorthEastTextures, knightIdleNorthWestTextures, knightIdleSouthWestTextures];
        for (let d = 0; d < 8; d++) {
          const dir = directionNames[d];
          try {
            const local = [0, 1, 2, 3].map(i => `./src/assets/Mage/mage_idle/mage_idle_${dir}/${i}.png`);
            const tex = await Promise.all(local.map(url => PIXI.Assets.load(url)));
            tex.forEach(t => { t.source.scaleMode = 'nearest'; });
            idleTextures[d] = tex;
          } catch (_) {
            try {
              const urls = [0, 1, 2, 3].map(i => `${PIXELLAB_MAGE_BASE}/animations/breathing-idle/${dir}/${i}.png`);
              const tex = await Promise.all(urls.map(url => PIXI.Assets.load(url)));
              tex.forEach(t => { t.source.scaleMode = 'nearest'; });
              idleTextures[d] = tex;
            } catch (__) {
              idleTextures[d] = knightDirectionTextures ? [knightDirectionTextures[d], knightDirectionTextures[d]] : null;
            }
          }
        }
        knightIdleSouthTextures = idleTextures[0]; knightIdleEastTextures = idleTextures[1]; knightIdleNorthTextures = idleTextures[2]; knightIdleWestTextures = idleTextures[3];
        knightIdleSouthEastTextures = idleTextures[4]; knightIdleNorthEastTextures = idleTextures[5]; knightIdleNorthWestTextures = idleTextures[6]; knightIdleSouthWestTextures = idleTextures[7];
        for (let d = 0; d < 8; d++) {
          const dir = directionNames[d];
          knightRunTextures[d] = await loadRunFrames(`./src/assets/Mage/mage_run/mage_run_${dir}/`);
          if (!knightRunTextures[d]) knightRunTextures[d] = await loadRunFrames(`${PIXELLAB_MAGE_BASE}/animations/${KNIGHT_RUN_ANIM_FOLDER}/${dir}/`);
          if (!knightRunTextures[d] && knightDirectionTextures) knightRunTextures[d] = [knightDirectionTextures[d], knightDirectionTextures[d]];
        }
        for (let d = 0; d < 8; d++) {
          const dir = directionNames[d];
          knightWalkTextures[d] = await loadRunFrames(`./src/assets/Mage/mage_walk/mage_walk_${dir}/`);
          if (!knightWalkTextures[d]) knightWalkTextures[d] = await loadRunFrames(`${PIXELLAB_MAGE_BASE}/animations/${KNIGHT_WALK_ANIM_FOLDER}/${dir}/`);
          if (!knightWalkTextures[d] && knightDirectionTextures) knightWalkTextures[d] = [knightDirectionTextures[d], knightDirectionTextures[d]];
        }
      } catch (e) {
        console.warn('PixelLab mage directions failed (use static Mage.png):', e.message);
      }
    }
  }

  const selectedCharacterTexture = characterTextures[startingCharacterKey] || knightTexture;

  let player;
  const hasAnyIdle = knightIdleSouthTextures || knightIdleEastTextures || knightIdleNorthTextures || knightIdleWestTextures ||
    knightIdleSouthEastTextures || knightIdleNorthEastTextures || knightIdleNorthWestTextures || knightIdleSouthWestTextures;
  if (knightDirectionTextures && hasAnyIdle) {
    player = new PIXI.Container();
    const staticSprite = new PIXI.Sprite(knightDirectionTextures[0]);
    staticSprite.anchor.set(0.5);
    player.addChild(staticSprite);
    if (knightIdleSouthTextures) {
      const idleSouthSprite = new PIXI.AnimatedSprite(knightIdleSouthTextures, false);
      idleSouthSprite.anchor.set(0.5);
      idleSouthSprite.animationSpeed = 0.15;
      idleSouthSprite.loop = true;
      idleSouthSprite.visible = false;
      player.addChild(idleSouthSprite);
      player.knightIdleSouthSprite = idleSouthSprite;
    } else {
      player.knightIdleSouthSprite = null;
    }
    if (knightIdleEastTextures) {
      const idleEastSprite = new PIXI.Sprite(knightIdleEastTextures[0]);
      idleEastSprite.anchor.set(0.5);
      idleEastSprite.visible = false;
      player.addChild(idleEastSprite);
      player.knightIdleEastSprite = idleEastSprite;
      player.knightIdleEastTextures = knightIdleEastTextures;
    } else {
      player.knightIdleEastSprite = null;
      player.knightIdleEastTextures = null;
    }
    if (knightIdleNorthTextures) {
      const idleNorthSprite = new PIXI.Sprite(knightIdleNorthTextures[0]);
      idleNorthSprite.anchor.set(0.5);
      idleNorthSprite.visible = false;
      player.addChild(idleNorthSprite);
      player.knightIdleNorthSprite = idleNorthSprite;
      player.knightIdleNorthTextures = knightIdleNorthTextures;
    } else {
      player.knightIdleNorthSprite = null;
      player.knightIdleNorthTextures = null;
    }
    if (knightIdleWestTextures) {
      const idleWestSprite = new PIXI.Sprite(knightIdleWestTextures[0]);
      idleWestSprite.anchor.set(0.5);
      idleWestSprite.visible = false;
      player.addChild(idleWestSprite);
      player.knightIdleWestSprite = idleWestSprite;
      player.knightIdleWestTextures = knightIdleWestTextures;
    } else {
      player.knightIdleWestSprite = null;
      player.knightIdleWestTextures = null;
    }
    if (knightIdleSouthEastTextures) {
      const s = new PIXI.Sprite(knightIdleSouthEastTextures[0]);
      s.anchor.set(0.5);
      s.visible = false;
      player.addChild(s);
      player.knightIdleSouthEastSprite = s;
      player.knightIdleSouthEastTextures = knightIdleSouthEastTextures;
    } else {
      player.knightIdleSouthEastSprite = null;
      player.knightIdleSouthEastTextures = null;
    }
    if (knightIdleNorthEastTextures) {
      const s = new PIXI.Sprite(knightIdleNorthEastTextures[0]);
      s.anchor.set(0.5);
      s.visible = false;
      player.addChild(s);
      player.knightIdleNorthEastSprite = s;
      player.knightIdleNorthEastTextures = knightIdleNorthEastTextures;
    } else {
      player.knightIdleNorthEastSprite = null;
      player.knightIdleNorthEastTextures = null;
    }
    if (knightIdleNorthWestTextures) {
      const s = new PIXI.Sprite(knightIdleNorthWestTextures[0]);
      s.anchor.set(0.5);
      s.visible = false;
      player.addChild(s);
      player.knightIdleNorthWestSprite = s;
      player.knightIdleNorthWestTextures = knightIdleNorthWestTextures;
    } else {
      player.knightIdleNorthWestSprite = null;
      player.knightIdleNorthWestTextures = null;
    }
    if (knightIdleSouthWestTextures) {
      const s = new PIXI.Sprite(knightIdleSouthWestTextures[0]);
      s.anchor.set(0.5);
      s.visible = false;
      player.addChild(s);
      player.knightIdleSouthWestSprite = s;
      player.knightIdleSouthWestTextures = knightIdleSouthWestTextures;
    } else {
      player.knightIdleSouthWestSprite = null;
      player.knightIdleSouthWestTextures = null;
    }
    player.knightRunSprites = [];
    player.knightRunElapsed = [];
    for (let d = 0; d < 8; d++) {
      if (knightRunTextures[d]) {
        const runSprite = new PIXI.Sprite(knightRunTextures[d][0]);
        runSprite.anchor.set(0.5);
        runSprite.visible = false;
        player.addChild(runSprite);
        player.knightRunSprites[d] = runSprite;
        player.knightRunElapsed[d] = 0;
      } else {
        player.knightRunSprites[d] = null;
        player.knightRunElapsed[d] = 0;
      }
    }
    player.knightRunTextures = knightRunTextures;
    player.knightWalkSprites = [];
    player.knightWalkElapsed = [];
    for (let d = 0; d < 8; d++) {
      if (knightWalkTextures[d]) {
        const walkSprite = new PIXI.Sprite(knightWalkTextures[d][0]);
        walkSprite.anchor.set(0.5);
        walkSprite.visible = false;
        player.addChild(walkSprite);
        player.knightWalkSprites[d] = walkSprite;
        player.knightWalkElapsed[d] = 0;
      } else {
        player.knightWalkSprites[d] = null;
        player.knightWalkElapsed[d] = 0;
      }
    }
    player.knightWalkTextures = knightWalkTextures;
    player.knightStaticSprite = staticSprite;
    player.knightLastTexIndex = 0;
    player.knightIdleElapsed = 0;
    player.knightIdleEastElapsed = 0;
    player.knightIdleNorthElapsed = 0;
    player.knightIdleWestElapsed = 0;
    player.knightIdleSouthEastElapsed = 0;
    player.knightIdleNorthEastElapsed = 0;
    player.knightIdleNorthWestElapsed = 0;
    player.knightIdleSouthWestElapsed = 0;
  } else if (knightDirectionTextures) {
    player = new PIXI.Sprite(knightDirectionTextures[0]);
    player.knightStaticSprite = player;
    player.knightIdleSouthSprite = null;
    player.knightIdleEastSprite = null;
    player.knightIdleNorthSprite = null;
    player.knightIdleWestSprite = null;
    player.knightIdleSouthEastSprite = null;
    player.knightIdleNorthEastSprite = null;
    player.knightIdleNorthWestSprite = null;
    player.knightIdleSouthWestSprite = null;
    player.knightRunSprites = [];
    player.knightRunTextures = [];
    player.knightWalkSprites = [];
    player.knightWalkTextures = [];
    player.knightLastTexIndex = 0;
  } else {
    player = new PIXI.Sprite(selectedCharacterTexture);
    player.knightStaticSprite = null;
    player.knightIdleSouthSprite = null;
    player.knightIdleEastSprite = null;
    player.knightIdleNorthSprite = null;
    player.knightIdleWestSprite = null;
    player.knightIdleSouthEastSprite = null;
    player.knightIdleNorthEastSprite = null;
    player.knightIdleNorthWestSprite = null;
    player.knightIdleSouthWestSprite = null;
    player.knightRunSprites = [];
    player.knightRunTextures = [];
    player.knightWalkSprites = [];
    player.knightWalkTextures = [];
  }
  if (player.anchor && player.anchor.set) player.anchor.set(0.5);
  // PixelLab knight: 124×124 source; scale 0.75.
  if (knightDirectionTextures) {
    player.scale.set(0.75, 0.75);
  } else {
    player.scale.set(0.07, 0.07); // Scale adjusted for new sprites (200-250px tall sprite)
  }
  player.position.set(VIRTUAL_W / 2, VIRTUAL_H / 2);
  player.characterKey = startingCharacterKey;
  player.characterName = startingCharacterName;
  player.knightDirectionTextures = knightDirectionTextures;
  player.knightAngleToIndex = [3, 6, 2, 5, 1, 4, 0, 7];
  // Player will be added to sortedSpritesContainer after it's created for Y-sorting
  console.log(`🛡️ Character loaded: ${startingCharacterName}`);
  
  // 🧪 Player Hitbox Visualization (Testing Mode)
  player.hitboxGraphics = new PIXI.Graphics();
  world.addChild(player.hitboxGraphics);
  
  // Player hitbox update function
  player.updateHitboxVisuals = function() {
    this.hitboxGraphics.clear();
    
    if (window.upgradeSystemInstance && window.upgradeSystemInstance.testingMode) {
      // Draw player collision radius (adjusted for new knight sprite)
      // Hitbox covers the armored body (approximately 15px radius at 0.07 scale)
      this.hitboxGraphics.circle(0, 0, 15)
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
  player.dazeRemaining = 0;
  player.dazeMoveMultiplier = 1;
  
  // Dash state variables
  player.dashActive = false;
  player.dashTimer = 0;
  player.dashCooldownTimer = 0;
  player.dashDirectionX = 0;
  player.dashDirectionY = 0;
  player.lastMovementX = 0;
  player.lastMovementY = 0;
  player.dashStartX = 0;
  player.dashStartY = 0;
  
  console.log('⚔️ Knight loaded:', knightTexture.width, 'x', knightTexture.height);

  // --- Sword Slash Projectile Texture ---
  const swordSlashTexture = await PIXI.Assets.load('./src/assets/sword_slash.png');
  swordSlashTexture.source.scaleMode = 'nearest';
  
  console.log('⚔️ Sword slash loaded:', swordSlashTexture.width, 'x', swordSlashTexture.height);
  
  // --- New Weapon Textures ---
  // Longbow
  const bowTexture = await PIXI.Assets.load('./src/assets/Bow.png');
  bowTexture.source.scaleMode = 'nearest';
  const bowProjectileTexture = await PIXI.Assets.load('./src/assets/Bow_projectile.png');
  bowProjectileTexture.source.scaleMode = 'nearest';
  console.log('🏹 Longbow loaded:', bowTexture.width, 'x', bowTexture.height);
  
  // Magic Staff
  const staffTexture = await PIXI.Assets.load('./src/assets/Staff.png');
  staffTexture.source.scaleMode = 'nearest';
  const staffProjectileTexture = await PIXI.Assets.load('./src/assets/Staff_projectile.png');
  staffProjectileTexture.source.scaleMode = 'nearest';
  console.log('✨ Magic Staff loaded:', staffTexture.width, 'x', staffTexture.height);
  
  // Shield
  const shieldTexture = await PIXI.Assets.load('./src/assets/Shield.png');
  shieldTexture.source.scaleMode = 'nearest';
  console.log('🛡️ Shield loaded:', shieldTexture.width, 'x', shieldTexture.height);

  // --- Enemy Textures ---
  const skeletonTexture = await PIXI.Assets.load('./src/assets/Skeleton.png');
  skeletonTexture.source.scaleMode = 'nearest';
  
  const skeletonEliteTexture = await PIXI.Assets.load('./src/assets/Skeleton_elite.png');
  skeletonEliteTexture.source.scaleMode = 'nearest';
  
  const skeletonBossTexture = await PIXI.Assets.load('./src/assets/Skeleton_Boss.png');
  skeletonBossTexture.source.scaleMode = 'nearest';
  
  const skeletonArcherTexture = await PIXI.Assets.load('./src/assets/Skeleton_archer.png');
  skeletonArcherTexture.source.scaleMode = 'nearest';
  
  console.log('💀 Skeleton loaded:', skeletonTexture.width, 'x', skeletonTexture.height);
  console.log('👑 Elite Skeleton loaded:', skeletonEliteTexture.width, 'x', skeletonEliteTexture.height);
  console.log('🏛️ Boss Skeleton loaded:', skeletonBossTexture.width, 'x', skeletonBossTexture.height);
  console.log('🏹 Archer Skeleton loaded:', skeletonArcherTexture.width, 'x', skeletonArcherTexture.height);

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
    constructor(x, y, angle, speed, texture, size, rangeInPixels, piercing, weapon) {
      this.sprite = new PIXI.Sprite(texture);
      this.sprite.anchor.set(0.5);
      this.sprite.scale.set(size, size);
      this.sprite.position.set(x, y);
      this.sprite.rotation = angle;
      
      this.angle = angle;
      this.speed = speed;
      // Range is now in pixels, lifetime calculated from range / speed
      this.maxDistance = rangeInPixels; // Maximum distance in pixels
      this.lifetime = speed > 0 ? rangeInPixels / speed : 10; // Time = distance / speed
      this.age = 0;
      this.distanceTraveled = 0; // Track actual distance traveled
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
      const moveDistance = this.speed * deltaTime;
      this.sprite.x += Math.cos(this.angle) * moveDistance;
      this.sprite.y += Math.sin(this.angle) * moveDistance;
      this.distanceTraveled += moveDistance;
      
      // Update hitbox position
      this.hitboxGraphics.x = this.sprite.x;
      this.hitboxGraphics.y = this.sprite.y;
      
      // Despawn if exceeded max range
      return this.distanceTraveled >= this.maxDistance;
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

  // --- Enemy Projectile Class ---
  class EnemyProjectile {
    constructor(x, y, angle, speed, texture, size, rangeInPixels, damage) {
      this.sprite = new PIXI.Sprite(texture);
      this.sprite.anchor.set(0.5);
      this.sprite.scale.set(size, size);
      this.sprite.position.set(x, y);
      this.sprite.rotation = angle;
      this.sprite.tint = 0xFF0000; // Red tint for enemy projectiles
      
      this.angle = angle;
      this.speed = speed;
      this.damage = damage;
      // Range is now in pixels, lifetime calculated from range / speed
      this.maxDistance = rangeInPixels; // Maximum distance in pixels
      this.lifetime = speed > 0 ? rangeInPixels / speed : 10; // Time = distance / speed
      this.age = 0;
      this.distanceTraveled = 0; // Track actual distance traveled
      
      // Store base texture dimensions for hitbox calculation
      this.baseTextureWidth = texture.width;
      this.baseTextureHeight = texture.height;
      this.spriteScale = size;
      this.collisionMultiplier = 0.9; // 90% of sprite size for tighter collision
      
      // 🧪 Projectile Hitbox Visualization (Testing Mode)
      this.hitboxGraphics = new PIXI.Graphics();
      this.updateHitboxVisuals();
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
      const moveDistance = this.speed * deltaTime;
      this.sprite.x += Math.cos(this.angle) * moveDistance;
      this.sprite.y += Math.sin(this.angle) * moveDistance;
      this.distanceTraveled += moveDistance;
      
      // Update hitbox position
      this.hitboxGraphics.x = this.sprite.x;
      this.hitboxGraphics.y = this.sprite.y;
      
      // Despawn if exceeded max range
      return this.distanceTraveled >= this.maxDistance;
    }
    
    // 🧪 Update hitbox visualization based on testing mode
    updateHitboxVisuals() {
      this.hitboxGraphics.clear();
      
      if (window.upgradeSystemInstance && window.upgradeSystemInstance.testingMode) {
        // Draw projectile collision radius (dynamic size, red circle for enemy projectiles)
        const radius = this.getHitboxRadius();
        this.hitboxGraphics.circle(0, 0, radius)
          .stroke({ color: 0xFF0000, width: 2, alpha: 0.6 });
          
        this.hitboxGraphics.visible = true;
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
        case 'ranged':
          texture = skeletonArcherTexture;
          spriteScale = 0.05; // Same size as normal skeleton
          this.baseHp = 20; // Override base HP for ranged
          this.baseXPReward = 15; // Override base XP for ranged
          statsMultiplier = {
            health: 1.0,
            speed: 1.0,
            xpReward: 1.0
          };
          break;
          
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
      this.sprite.zIndex = y; // Set initial zIndex for Y-sorting
      
      // Position
      this.x = x;
      this.y = y;
      
      // Knockback animation
      this.knockbackVelocityX = 0;
      this.knockbackVelocityY = 0;
      this.knockbackDecay = 0.9; // How quickly knockback velocity decays (0.9 = 90% per frame)
      this.knockbackCooldowns = new Map(); // Per-weapon knockback cooldowns
      this.knockbackCooldownDuration = 0.5; // 0.5 seconds between knockback applications
      
      // Knockback resistance based on enemy type
      if (enemyType === 'boss') {
        this.knockbackResistance = 1.0; // 100% resistance = immune
      } else if (enemyType === 'elite') {
        this.knockbackResistance = 0.5; // 50% resistance
      } else {
        this.knockbackResistance = 0.0; // No resistance
      }
      
      // Apply difficulty scaling if provided
      let difficultyHealthMultiplier = 1.0;
      let difficultySpeedMultiplier = 1.0;
      let difficultyXPMultiplier = 1.0;
      let bossBaseHealthMultiplier = null;
      
      if (difficultySystem) {
        const baseHealthMultiplier = difficultySystem.getHealthMultiplier();
        difficultyHealthMultiplier = baseHealthMultiplier;
        difficultySpeedMultiplier = difficultySystem.getSpeedMultiplier();
        difficultyXPMultiplier = difficultySystem.getXPMultiplier();
        if (enemyType === 'boss' && typeof difficultySystem.getBossHealthMultiplier === 'function') {
          difficultyHealthMultiplier = difficultySystem.getBossHealthMultiplier();
        }
        bossBaseHealthMultiplier = baseHealthMultiplier;
      }
      
      // Elite/Boss-specific scaling multipliers on top of difficulty scaling
      // Health and XP scale with elite/boss multipliers, but speed scales like normal enemies
      const eliteHealthMultiplier = enemyType === 'elite' ? 2.0 : enemyType === 'boss' ? 3.0 : 1.0;
      const eliteSpeedMultiplier = 1.0; // Speed scales the same as normal enemies
      
      // Calculate final stats with type, difficulty, and elite/boss scaling
      const finalHealthMultiplier = statsMultiplier.health * difficultyHealthMultiplier * eliteHealthMultiplier;
      const finalSpeedMultiplier = statsMultiplier.speed * difficultySpeedMultiplier * eliteSpeedMultiplier;
      const finalXPMultiplier = statsMultiplier.xpReward * difficultyXPMultiplier * eliteHealthMultiplier;
      
      // Apply calculated stats
      this.maxHp = Math.ceil(this.baseHp * finalHealthMultiplier);
      this.hp = this.maxHp;
      this.speed = this.baseSpeed * finalSpeedMultiplier;
      this.xpReward = Math.ceil(this.baseXPReward * finalXPMultiplier);
      
      // Damage and visual effects
      this.damageFlashTimer = 0;
      this.damageFlashDuration = 0.15; // seconds (same as player)
      
      // Ranged-specific properties
      this.isRanged = enemyType === 'ranged';
      if (this.isRanged) {
        this.attackRange = 390; // pixels (1.3 * 300, where 300 is RANGE_BASE)
        this.baseAttackCooldown = 2.0; // seconds
        this.attackCooldown = this.baseAttackCooldown;
        this.attackTimer = 0;
        this.projectileDamage = 20;
        // Store projectile texture reference (will be set externally)
        this.projectileTexture = null;
      }
      
      // Store dimensions for dynamic hitbox calculation
      this.baseTextureWidth = texture.width;
      this.baseTextureHeight = texture.height;
      this.spriteScale = spriteScale;
      this.collisionMultiplier = 0.8; // Slightly smaller than visual for gameplay feel
      
      // 🧪 Testing Mode - Hitbox visualization
      this.hitboxGraphics = new PIXI.Graphics();
      this.collisionThisFrame = false; // Track collisions for debugging
      this.updateHitboxVisuals();
      
      // Skeleton Warlord boss: ability state machine (Slam -> delay -> Stomp -> delay -> repeat)
      if (enemyType === 'boss') {
        this.bossAbilityState = 'windup_slam';
        this.bossPhaseIndex = 0;
        this.bossSlamAngle = 0;
        this.bossWindUpTimer = 1.4;  // SLAM_WINDUP (longer telegraph)
        this.bossActiveTimer = 0;
        this.slamHitApplied = false;
        this.stompHitApplied = false;
      }
      
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
        case 'ranged': return '🏹';
        case 'elite': return '👑';
        case 'boss': return '🏛️';
        default: return '💀';
      }
    }
    
    // Calculate dynamic hitbox radius based on sprite size
    getHitboxRadius() {
      // Use the smaller dimension for enemy hitbox (more forgiving)
      const baseDimension = Math.min(this.baseTextureWidth, this.baseTextureHeight);
      const radius = (baseDimension * this.spriteScale * this.collisionMultiplier) / 2;
      // Boss needs a large enough collision hitbox to be hittable by projectiles
      if (this.enemyType === 'boss') {
        return Math.max(radius, 40);
      }
      return radius;
    }
    
    // Get attack radius (110% of hitbox radius)
    getAttackRadius() {
      return this.getHitboxRadius() * 1.1;
    }
    
    // Get collision hitbox radius for enemy-enemy collisions (75% of damage hitbox)
    getCollisionRadius() {
      return this.getHitboxRadius() * 0.75;
    }
    
    update(deltaTime, playerX, playerY) {
      // Update all per-weapon knockback cooldowns
      for (const [weaponName, cooldown] of this.knockbackCooldowns.entries()) {
        const newCooldown = cooldown - deltaTime;
        if (newCooldown <= 0) {
          this.knockbackCooldowns.delete(weaponName);
        } else {
          this.knockbackCooldowns.set(weaponName, newCooldown);
        }
      }
      
      // Apply knockback velocity (animated pushback)
      if (Math.abs(this.knockbackVelocityX) > 0.1 || Math.abs(this.knockbackVelocityY) > 0.1) {
        this.x += this.knockbackVelocityX * deltaTime * 60; // Scale by 60 for consistent speed
        this.y += this.knockbackVelocityY * deltaTime * 60;
        
        // Decay knockback velocity for smooth deceleration
        this.knockbackVelocityX *= this.knockbackDecay;
        this.knockbackVelocityY *= this.knockbackDecay;
      } else {
        // Reset velocity when very small
        this.knockbackVelocityX = 0;
        this.knockbackVelocityY = 0;
      }
      
      // Move toward player (homing behavior)
      const dx = playerX - this.x;
      const dy = playerY - this.y;
      const dist = Math.hypot(dx, dy);
      
      // Ranged enemy behavior: stop moving at attack range
      if (this.isRanged) {
        // Update attack cooldown timer
        if (this.attackTimer > 0) {
          this.attackTimer -= deltaTime;
        }
        
        // Only move if outside attack range
        if (dist > this.attackRange && dist > 0) {
          this.x += (dx / dist) * this.speed * deltaTime;
          this.y += (dy / dist) * this.speed * deltaTime;
        }
      } else {
        // Normal enemy behavior: always move toward player
        if (dist > 0) {
          this.x += (dx / dist) * this.speed * deltaTime;
          this.y += (dy / dist) * this.speed * deltaTime;
        }
      }
      
      this.sprite.x = this.x;
      this.sprite.y = this.y;
      
      // Update hitbox graphics position
      this.hitboxGraphics.x = this.x;
      this.hitboxGraphics.y = this.y;
      
      // Skeleton Warlord boss: ability state machine (Slam -> 1s delay -> Stomp -> 1s delay -> repeat, longer telegraphs)
      if (this.enemyType === 'boss') {
        const SLAM_WINDUP = 1.4, SLAM_ACTIVE = 0.15, STOMP_WINDUP = 1.0, STOMP_ACTIVE = 0.2, ABILITY_DELAY = 1.0;
        // Ensure state is initialized (e.g. if boss was created before state was set)
        if (!this.bossAbilityState) {
          this.bossAbilityState = 'windup_slam';
          this.bossWindUpTimer = SLAM_WINDUP;
          this.bossActiveTimer = 0;
          this.slamHitApplied = false;
          this.stompHitApplied = false;
        }
        if (this.bossAbilityState === 'windup_slam') {
          const targetAngle = Math.atan2(playerY - this.y, playerX - this.x);
          const diff = normalizeAngleDiff(targetAngle, this.bossSlamAngle);
          const step = Math.min(1, SLAM_TRACK_SPEED * deltaTime);
          this.bossSlamAngle += diff * step;
          this.bossWindUpTimer -= deltaTime;
          if (this.bossWindUpTimer <= 0) {
            this.bossAbilityState = 'slam_hit';
            this.bossActiveTimer = SLAM_ACTIVE;
            this.slamHitApplied = false;
          }
        } else if (this.bossAbilityState === 'slam_hit') {
          this.bossActiveTimer -= deltaTime;
          if (this.bossActiveTimer <= 0) {
            this.bossAbilityState = 'ability_delay';
            this.bossWindUpTimer = ABILITY_DELAY;
            this.bossDelayNext = 'windup_stomp';
          }
        } else if (this.bossAbilityState === 'ability_delay') {
          this.bossWindUpTimer -= deltaTime;
          if (this.bossWindUpTimer <= 0) {
            if (this.bossDelayNext === 'windup_stomp') {
              this.bossAbilityState = 'windup_stomp';
              this.bossWindUpTimer = STOMP_WINDUP;
              this.stompHitApplied = false;
            } else {
              this.bossAbilityState = 'windup_slam';
              this.bossSlamAngle = Math.atan2(playerY - this.y, playerX - this.x);
              this.bossWindUpTimer = SLAM_WINDUP;
              this.slamHitApplied = false;
            }
          }
        } else if (this.bossAbilityState === 'windup_stomp') {
          this.bossWindUpTimer -= deltaTime;
          if (this.bossWindUpTimer <= 0) {
            this.bossAbilityState = 'stomp_hit';
            this.bossActiveTimer = STOMP_ACTIVE;
            this.stompHitApplied = false;
          }
        } else if (this.bossAbilityState === 'stomp_hit') {
          this.bossActiveTimer -= deltaTime;
          if (this.bossActiveTimer <= 0) {
            this.bossAbilityState = 'ability_delay';
            this.bossWindUpTimer = ABILITY_DELAY;
            this.bossDelayNext = 'windup_slam';
          }
        }
      }
      
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
    
    /**
     * Fire a projectile at the player (for ranged enemies)
     * @param {number} playerX - Player X position
     * @param {number} playerY - Player Y position
     * @param {Array} enemyProjectiles - Array to store enemy projectiles
     * @param {PIXI.Container} projectilesContainer - Container for projectile sprites
     * @param {PIXI.Container} worldContainer - World container for hitbox graphics
     * @param {PIXI.Texture} projectileTexture - Texture for the projectile
     * @param {number} difficultySpeedMultiplier - Difficulty speed multiplier for cooldown scaling
     * @returns {boolean} True if projectile was fired, false if on cooldown
     */
    fireProjectile(playerX, playerY, enemyProjectiles, projectilesContainer, worldContainer, projectileTexture, difficultySpeedMultiplier = 1.0) {
      if (!this.isRanged || !projectileTexture) return false;
      
      // Calculate distance to player
      const dx = playerX - this.x;
      const dy = playerY - this.y;
      const dist = Math.hypot(dx, dy);
      
      // Only fire if within attack range and cooldown is ready
      if (dist <= this.attackRange && this.attackTimer <= 0) {
        // Calculate angle toward player
        const angle = Math.atan2(dy, dx);
        
        // Calculate effective cooldown with difficulty scaling (faster attacks as difficulty increases)
        const effectiveCooldown = this.baseAttackCooldown / difficultySpeedMultiplier;
        this.attackCooldown = effectiveCooldown;
        
        // Create projectile with slower speed (~400 px/s)
        const projectileSpeed = 400;
        const projectileSize = 0.03; // Same as player bow projectile
        const projectileRange = 2000; // High range since it targets player position
        
        const projectile = new EnemyProjectile(
          this.x,
          this.y,
          angle,
          projectileSpeed,
          projectileTexture,
          projectileSize,
          projectileRange,
          this.projectileDamage
        );
        
        // Add to containers
        projectilesContainer.addChild(projectile.sprite);
        worldContainer.addChild(projectile.hitboxGraphics);
        enemyProjectiles.push(projectile);
        
        // Reset attack timer
        this.attackTimer = this.attackCooldown;
        
        return true;
      }
      
      return false;
    }
    
    // 🧪 Update hitbox visualization based on testing mode
    updateHitboxVisuals() {
      this.hitboxGraphics.clear();
      
      if (window.upgradeSystemInstance && window.upgradeSystemInstance.testingMode) {
        const enemyRadius = this.getHitboxRadius();
        const attackRadius = this.getAttackRadius();
        const collisionRadius = this.getCollisionRadius();
        
        // Choose colors based on collision state
        const attackColor = this.collisionThisFrame ? 0xFFFF00 : 0xFF0000; // Yellow if colliding, red if not
        const hitboxColor = this.collisionThisFrame ? 0xFFFF44 : 0xFF4444; // Lighter if colliding
        const attackAlpha = this.collisionThisFrame ? 0.9 : 0.6; // More opaque if colliding
        
        // Draw attack radius (110% of enemy hitbox, outer circle)
        this.hitboxGraphics.circle(0, 0, attackRadius)
          .stroke({ color: attackColor, width: 2, alpha: attackAlpha });
        
        // Draw projectile collision radius (enemy radius, middle circle)
        this.hitboxGraphics.circle(0, 0, enemyRadius)
          .stroke({ color: hitboxColor, width: 1, alpha: 0.8 });
        
        // Draw enemy-enemy collision radius (75% of hitbox, inner circle - green)
        this.hitboxGraphics.circle(0, 0, collisionRadius)
          .stroke({ color: 0x00FF00, width: 1, alpha: 0.6 });
          
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
      const fontSize = isCrit ? 24 : 18;
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
      const fontSize = isCrit ? 24 : 18;
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
      this.collectionRadius = 15; // Radius at which XP is actually collected (very close to player)
      // pickupRadius is now passed dynamically in update() based on player.pickupRange
      this.isBeingPulled = false;
      this.pullSpeed = 400; // Speed at which orb moves toward player (px/s)
      this.rotationSpeed = 0; // For optional rotation effect
      this.baseScale = finalScale; // Store original scale for animation
    }
    
    update(deltaTime, playerX, playerY, playerPickupRange = 40) {
      // Check distance to player in world coordinates
      const dx = playerX - this.sprite.x;
      const dy = playerY - this.sprite.y;
      const dist = Math.hypot(dx, dy);
      
      // Use player's pickup range (dynamically updated by items)
      const effectivePickupRadius = playerPickupRange;
      
      // If within pickup radius but not collected yet, start magnetic pull
      if (dist < effectivePickupRadius && dist > this.collectionRadius) {
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
        const pullProgress = (effectivePickupRadius - dist) / (effectivePickupRadius - this.collectionRadius);
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
      if (this.isBeingPulled && dist >= effectivePickupRadius) {
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

  // --- XP Orb Merging System (Performance Optimization) ---
  function mergeXPOrbs() {
    const MAX_ORBS = 1000;
    const MERGE_DISTANCE = 30; // Distance to consider orbs as "nearby"
    
    if (xpOrbs.length <= MAX_ORBS) return;
    
    console.log(`⚡ Merging XP orbs: ${xpOrbs.length} → targeting ${MAX_ORBS}`);
    
    // Sort orbs by position for spatial locality
    xpOrbs.sort((a, b) => {
      const distA = a.sprite.x * a.sprite.x + a.sprite.y * a.sprite.y;
      const distB = b.sprite.x * b.sprite.x + b.sprite.y * b.sprite.y;
      return distA - distB;
    });
    
    const orbsToRemove = new Set();
    const mergedOrbs = [];
    
    // Group nearby orbs and merge them
    for (let i = 0; i < xpOrbs.length && xpOrbs.length - orbsToRemove.size > MAX_ORBS; i++) {
      if (orbsToRemove.has(xpOrbs[i])) continue;
      
      let mergedXP = xpOrbs[i].xpValue;
      let mergedX = xpOrbs[i].sprite.x;
      let mergedY = xpOrbs[i].sprite.y;
      let mergeCount = 1;
      
      // Find nearby orbs to merge
      for (let j = i + 1; j < xpOrbs.length && mergeCount < 10; j++) {
        if (orbsToRemove.has(xpOrbs[j])) continue;
        
        const dx = xpOrbs[i].sprite.x - xpOrbs[j].sprite.x;
        const dy = xpOrbs[i].sprite.y - xpOrbs[j].sprite.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < MERGE_DISTANCE) {
          mergedXP += xpOrbs[j].xpValue;
          orbsToRemove.add(xpOrbs[j]);
          mergeCount++;
        }
      }
      
      // If we merged multiple orbs, mark the original for removal and create a new merged orb
      if (mergeCount > 1) {
        orbsToRemove.add(xpOrbs[i]);
        mergedOrbs.push({ x: mergedX, y: mergedY, xpValue: mergedXP });
      }
    }
    
    // Remove merged orbs
    for (const orb of orbsToRemove) {
      orb.sprite.destroy();
      const idx = xpOrbs.indexOf(orb);
      if (idx !== -1) xpOrbs.splice(idx, 1);
    }
    
    // Add new merged orbs
    for (const merged of mergedOrbs) {
      const newOrb = new XPOrb(merged.x, merged.y, merged.xpValue);
      xpOrbsContainer.addChild(newOrb.sprite);
      xpOrbs.push(newOrb);
    }
    
    console.log(`⚡ Merge complete: ${xpOrbs.length} orbs remaining`);
  }

  // Weapon class is now imported from weaponSystem.js

  // --- MagicStaffProjectile Class (Arc Trajectory) ---
  class MagicStaffProjectile {
    constructor(startX, startY, targetX, targetY, speed, texture, size, rangeInPixels, piercing, weapon) {
      this.sprite = new PIXI.Sprite(texture);
      this.sprite.anchor.set(0.5);
      this.sprite.scale.set(size, size);
      this.sprite.position.set(startX, startY);
      
      // Store start and target positions
      this.startX = startX;
      this.startY = startY;
      this.targetX = targetX;
      this.targetY = targetY;
      
      // Calculate total distance and travel time
      const dx = targetX - startX;
      const dy = targetY - startY;
      this.totalDistance = Math.hypot(dx, dy);
      this.travelTime = this.totalDistance / speed; // Time to reach target
      
      // Arc properties
      this.arcHeight = 50; // Height of arc in pixels
      this.progress = 0; // 0 to 1
      this.maxDistance = rangeInPixels; // Maximum distance in pixels
      this.lifetime = speed > 0 ? rangeInPixels / speed : 10; // Time = distance / speed
      this.age = 0;
      
      this.piercing = piercing || 1;
      this.hitCount = 0;
      this.hitEnemies = new Set();
      this.weapon = weapon;
      
      // Store base texture dimensions for hitbox
      this.baseTextureWidth = texture.width;
      this.baseTextureHeight = texture.height;
      this.spriteScale = size;
      this.collisionMultiplier = 0.9;
      
      // Hitbox visualization
      this.hitboxGraphics = new PIXI.Graphics();
      this.updateHitboxVisuals();
      
      console.log(`✨ Magic projectile created targeting (${targetX.toFixed(0)}, ${targetY.toFixed(0)})`);
    }
    
    getHitboxRadius() {
      const baseDimension = Math.max(this.baseTextureWidth, this.baseTextureHeight);
      return (baseDimension * this.spriteScale * this.collisionMultiplier) / 2;
    }
    
    update(deltaTime) {
      this.age += deltaTime;
      this.progress += deltaTime / Math.max(this.travelTime, 0.1); // Avoid division by zero
      
      if (this.progress >= 1.0) {
        // Reached target or exceeded lifetime
        return true; // Mark for removal
      }
      
      // Bezier curve interpolation (quadratic arc)
      const t = this.progress;
      
      // Linear interpolation for X and Y
      const linearX = this.startX + (this.targetX - this.startX) * t;
      const linearY = this.startY + (this.targetY - this.startY) * t;
      
      // Arc offset (sine wave for smooth arc)
      const arcOffset = Math.sin(t * Math.PI) * this.arcHeight;
      
      // Calculate perpendicular direction for arc offset
      const dx = this.targetX - this.startX;
      const dy = this.targetY - this.startY;
      const perpX = -dy / Math.max(this.totalDistance, 1);
      const perpY = dx / Math.max(this.totalDistance, 1);
      
      // Apply arc to position
      this.sprite.x = linearX + perpX * arcOffset;
      this.sprite.y = linearY + perpY * arcOffset;
      
      // Light homing correction in last 30% of flight
      if (t > 0.7) {
        const homingStrength = (t - 0.7) / 0.3; // 0 to 1 in last 30%
        const currentDx = this.targetX - this.sprite.x;
        const currentDy = this.targetY - this.sprite.y;
        this.sprite.x += currentDx * homingStrength * deltaTime * 2;
        this.sprite.y += currentDy * homingStrength * deltaTime * 2;
      }
      
      // Update rotation to face direction of travel
      const velocityX = this.sprite.x - (this.hitboxGraphics.x || this.sprite.x);
      const velocityY = this.sprite.y - (this.hitboxGraphics.y || this.sprite.y);
      this.sprite.rotation = Math.atan2(velocityY, velocityX);
      
      // Update hitbox position
      this.hitboxGraphics.x = this.sprite.x;
      this.hitboxGraphics.y = this.sprite.y;
      
      return this.age >= this.lifetime;
    }
    
    updateHitboxVisuals() {
      this.hitboxGraphics.clear();
      
      if (window.upgradeSystemInstance && window.upgradeSystemInstance.testingMode) {
        const radius = this.getHitboxRadius();
        this.hitboxGraphics.circle(0, 0, radius)
          .stroke({ color: 0x00FFFF, width: 2, alpha: 0.6 }); // Cyan for magic
        this.hitboxGraphics.visible = true;
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
  const shieldProjectiles = []; // Orbiting shields
  let shieldOrbitAngle = 0; // Global orbit rotation
  const magicStaffProjectiles = []; // Magic staff projectiles with arc behavior

  // --- Enemy Projectiles ---
  const enemyProjectiles = [];
  const enemyProjectilesContainer = new PIXI.Container();
  world.addChild(enemyProjectilesContainer);

  // --- Projectile Container ---
  const projectilesContainer = new PIXI.Container();
  world.addChild(projectilesContainer);

  // --- XP Orbs Container ---
  // Added before enemies so orbs render behind enemy sprites
  const xpOrbsContainer = new PIXI.Container();
  world.addChild(xpOrbsContainer);

  // --- Boss telegraph: simple color trapezoid (slam) / circle (stomp), behind sprites
  const bossTelegraphGraphics = new PIXI.Graphics();
  world.addChild(bossTelegraphGraphics); // add before sortedSprites so telegraph draws behind boss/player

  // --- Depth-Sorted Sprites Container ---
  // Container for player and enemies that need Y-sorting for depth
  const sortedSpritesContainer = new PIXI.Container();
  sortedSpritesContainer.sortableChildren = true; // Enable automatic sorting
  world.addChild(sortedSpritesContainer);
  
  // Add player to sorted container for depth sorting
  sortedSpritesContainer.addChild(player);
  player.zIndex = player.y; // Initial zIndex based on Y position
  
  // Keep enemiesContainer reference for compatibility
  const enemiesContainer = sortedSpritesContainer;

  const enemies = [];
  
  // --- Difficulty & Spawn Systems ---
  const difficultySystem = new DifficultySystem();
  const spawnController = new SpawnController(difficultySystem);
  
  // Create enemy function for spawn controller
  function createEnemyWithScaling(x, y, enemyType = 'normal') {
    const enemy = new Enemy(x, y, enemyType, difficultySystem);
    
    // Set projectile texture for ranged enemies
    if (enemy.isRanged) {
      enemy.projectileTexture = bowProjectileTexture;
    }
    
    return enemy;
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
    overlay.rect(0, 0, VIRTUAL_W, 70);
    overlay.fill(0x000000, 0.8);
    overlay.position.set(0, VIRTUAL_H - 140);
    bossAnnouncementContainer.addChild(overlay);
    
    // Main announcement text
    const mainText = new PIXI.Text('⚔️ A BOSS APPROACHES! ⚔️', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: 16,
      fill: 0xFF0000,
      fontWeight: 'bold',
      align: 'center'
    });
    mainText.anchor.set(0.5);
    mainText.position.set(VIRTUAL_W / 2, VIRTUAL_H - 120); // Above XP bar
    bossAnnouncementContainer.addChild(mainText);
    
    // Warning subtitle
    const subtitleText = new PIXI.Text('Prepare for battle!', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: 12,
      fill: 0xFFD700,
      align: 'center'
    });
    subtitleText.anchor.set(0.5);
    subtitleText.position.set(VIRTUAL_W / 2, VIRTUAL_H - 95); // Just below main text
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
  // Boss Rush (testing): only bosses, 10x boss XP - easily removable
  if (selectedCharacterData?.bossRushMode === true) {
    spawnController.setBossRushMode(true);
  }

  // --- Core Systems Initialization (order matters) ---
  const modifierSystem = new ModifierSystem();
  const characterSystem = new CharacterSystem(modifierSystem);
  characterSystem.setCharacter(startingCharacterKey);
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
  player.dazeRemaining = 0;
  player.dazeMoveMultiplier = 1;
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
    fontSize: 36,
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
    fontSize: 30,
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
  
  // --- Longbow Weapon Configuration ---
  const longbowConfig = {
    name: 'Longbow',
    type: 'ranged_physical',
    level: 1,
    iconTexture: bowTexture,
    projectileTexture: bowProjectileTexture,
    damage: 12,
    attackSpeed: 1.2,
    range: 1.5,
    piercing: 2,
    projectileSpeed: 900,
    projectileSize: 0.03,
    critChance: 0.15,
    critDamage: 2.0,
    projectileCount: 1,
    spreadAngle: 0,
    aoeRadius: 0,
    aoeDamageMultiplier: 1.0,
    knockback: 2,
    elementType: 'physical',
    onHitEffect: null,
    statusDuration: 0,
    statusDamage: 0,
    cooldown: 0,
    ammo: null,
    energyCost: 0,
    reloadTime: 0,
    homingStrength: 0,
    chainTargets: 0,
    boomerang: false,
    beamDuration: 0
  };
  
  // --- Magic Staff Weapon Configuration ---
  const magicStaffConfig = {
    name: 'Magic Staff',
    type: 'magic_multi',
    level: 1,
    iconTexture: staffTexture,
    projectileTexture: staffProjectileTexture,
    damage: 8,
    attackSpeed: 1.5,
    range: 1.25,
    piercing: 1,
    projectileSpeed: 600,
    projectileSize: 0.04,
    critChance: 0,
    critDamage: 2.0,
    projectileCount: 3,
    spreadAngle: 0,
    aoeRadius: 0,
    aoeDamageMultiplier: 1.0,
    knockback: 1.25,
    elementType: 'magic',
    onHitEffect: null,
    statusDuration: 0,
    statusDamage: 0,
    cooldown: 0,
    ammo: null,
    energyCost: 0,
    reloadTime: 0,
    homingStrength: 0,
    chainTargets: 0,
    boomerang: false,
    beamDuration: 0,
    weaponBehavior: 'multi_target_sequential' // Custom behavior flag
  };
  
  // --- Shield Weapon Configuration ---
  const shieldConfig = {
    name: 'Shield',
    type: 'defensive_orbit',
    level: 1,
    iconTexture: shieldTexture,
    projectileTexture: shieldTexture, // Shield uses same sprite
    damage: 5,
    attackSpeed: 0, // Always active
    range: 0.33, // Orbit radius multiplier
    piercing: 999, // Infinite (contact weapon)
    projectileSpeed: 300, // Orbit speed
    projectileSize: 0.04, // Reduced from 0.08 for smaller shield
    critChance: 0,
    critDamage: 2.0,
    projectileCount: 1,
    spreadAngle: 0,
    aoeRadius: 0,
    aoeDamageMultiplier: 1.0,
    knockback: 8,
    elementType: 'physical',
    onHitEffect: null,
    statusDuration: 0,
    statusDamage: 0,
    cooldown: 0,
    ammo: null,
    energyCost: 0,
    reloadTime: 0,
    homingStrength: 0,
    chainTargets: 0,
    boomerang: false,
    beamDuration: 0,
    weaponBehavior: 'orbit' // Custom behavior flag
  };
  
  // --- Original Weapon Configuration ---
  const originalSwordConfig = {
    // Basic info
    name: 'Sword Slash',
    type: 'melee_projectile',
    level: 1,
    iconTexture: swordIconTexture,
    projectileTexture: swordSlashTexture,
    
    // Core combat
    damage: 20,
    attackSpeed: 0.5,
    range: 0.625,
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
    knockback: 3,
    
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
  
  const soulCatcherTexture = await PIXI.Assets.load('./src/assets/Soul_catcher.png');
  soulCatcherTexture.source.scaleMode = 'nearest';
  
  const rabitsFootTexture = await PIXI.Assets.load('./src/assets/Rabits_foot.png');
  rabitsFootTexture.source.scaleMode = 'nearest';
  
  const gamebesonTexture = await PIXI.Assets.load('./src/assets/Gambeson.png');
  gamebesonTexture.source.scaleMode = 'nearest';
  
  const bloodstoneAmuletTexture = await PIXI.Assets.load('./src/assets/Bloodstone_Amulet.png');
  bloodstoneAmuletTexture.source.scaleMode = 'nearest';
  
  // Set item icon textures
  itemSystem.itemConfigs['ScholarsTomb'].iconTexture = scholarsTombTexture;
  itemSystem.itemConfigs['SoulCatcher'].iconTexture = soulCatcherTexture;
  itemSystem.itemConfigs['RabbitsFoot'].iconTexture = rabitsFootTexture;
  itemSystem.itemConfigs['Gambeson'].iconTexture = gamebesonTexture;
  itemSystem.itemConfigs['BloodstoneAmulet'].iconTexture = bloodstoneAmuletTexture;
  
  // --- Starting Weapon via WeaponSystem ---
  const startingWeaponName = characterSystem.getStartingWeapon();
  let startingWeaponBaseConfig = originalSwordConfig;
  if (startingWeaponName === 'Longbow') {
    startingWeaponBaseConfig = longbowConfig;
  } else if (startingWeaponName === 'Magic Staff') {
    startingWeaponBaseConfig = magicStaffConfig;
  }
  const startingWeapon = weaponSystem.createWeapon(startingWeaponBaseConfig);
  
  player.weapons = [startingWeapon];
  player.currentWeapon = startingWeapon;
  
  function updateCharacterWeaponScaling(targetLevel = levelSystem.level) {
    const scalingMap = characterSystem.getWeaponScaling(targetLevel);
    if (!scalingMap) return;

    player.weapons.forEach(weapon => {
      weaponSystem.applyCharacterWeaponScaling(weapon, scalingMap);
    });
  }

  updateCharacterWeaponScaling(1);

  // --- HP UI Display ---
  const hpText = new PIXI.Text(`HP: ${Math.round(player.maxHp)}/${Math.round(player.maxHp)}`, {
    fontFamily: '"Press Start 2P", monospace',
    fontSize: 30,
    fill: 0xFF6B6B,
    align: 'left'
  });
  hpText.anchor.set(0);
  hpText.position.set(20, VIRTUAL_H - 50);
  ui.addChild(hpText);
  
  // --- Boss health bar (below timer, visible only when activeBoss exists) ---
  const bossHealthBarContainer = new PIXI.Container();
  const bossBarWidth = VIRTUAL_W * 0.65;
  const bossBarHeight = 16;
  const bossBarX = (VIRTUAL_W - bossBarWidth) / 2;
  const bossBarY = 56; // Below timer (timer center y=30, fontSize 36 ~extends to y~48)
  const bossHealthBarBg = new PIXI.Graphics();
  bossHealthBarBg.rect(0, 0, bossBarWidth, bossBarHeight);
  bossHealthBarBg.fill(0x222222, 0.9);
  bossHealthBarBg.stroke({ width: 2, color: 0x444444 });
  bossHealthBarBg.position.set(bossBarX, bossBarY);
  bossHealthBarContainer.addChild(bossHealthBarBg);
  const bossHealthBarFill = new PIXI.Graphics();
  bossHealthBarFill.position.set(bossBarX, bossBarY);
  bossHealthBarContainer.addChild(bossHealthBarFill);
  const bossHealthBarLabel = new PIXI.Text('SKELETON WARLORD', {
    fontFamily: '"Press Start 2P", monospace',
    fontSize: 10,
    fill: 0xFFFFFF,
    align: 'center'
  });
  bossHealthBarLabel.anchor.set(0.5, 1);
  bossHealthBarLabel.position.set(VIRTUAL_W / 2, bossBarY - 2);
  bossHealthBarContainer.addChild(bossHealthBarLabel);
  bossHealthBarContainer.visible = false;
  ui.addChild(bossHealthBarContainer);
  
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
  
  // Add game over overlay to stage (on top of UI)
  app.stage.addChild(gameOverOverlay);
  
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
  
  // --- Slot-Based UI Display (Top-Right) ---
  const weaponsUIContainer = new PIXI.Container();
  weaponsUIContainer.position.set(VIRTUAL_W - 180, 20); // Adjusted for 3 slots
  ui.addChild(weaponsUIContainer);
  
  const itemsUIContainer = new PIXI.Container();
  itemsUIContainer.position.set(VIRTUAL_W - 180, 80); // Below weapons
  ui.addChild(itemsUIContainer);
  
  function updateWeaponsUI() {
    weaponsUIContainer.removeChildren();
    
    // Create 3 weapon slots
    for (let i = 0; i < MAX_WEAPON_SLOTS; i++) {
      const weapon = player.weapons[i];
      const slotX = i * 60; // 50px box + 10px gap
      
      // Slot background
      const weaponBox = new PIXI.Graphics();
      if (weapon) {
        // Filled slot - solid background
        weaponBox.rect(0, 0, 50, 50);
        weaponBox.fill(0x2a2a2a);
        weaponBox.stroke({ color: 0x555555, width: 2 });
      } else {
        // Empty slot - faint outline (need to fill with transparent first for stroke to show)
        weaponBox.rect(0, 0, 50, 50);
        weaponBox.fill({ color: 0x000000, alpha: 0 }); // Transparent fill
        weaponBox.stroke({ color: 0x555555, width: 2, alpha: 0.25 });
      }
      weaponBox.position.set(slotX, 0);
      weaponsUIContainer.addChild(weaponBox);
      
      if (weapon) {
        // Weapon icon (reduced size to fit within 50px slot)
        const icon = new PIXI.Sprite(weapon.iconTexture);
        icon.anchor.set(0.5);
        icon.scale.set(0.06, 0.06); // Reduced from 0.08 to prevent overflow
        icon.position.set(slotX + 25, 25);
        weaponsUIContainer.addChild(icon);
        
        // Level text (bottom-right corner)
        const levelText = new PIXI.Text(`${weapon.level}`, {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: 10,
          fill: 0xFFFFFF
        });
        levelText.anchor.set(1, 1);
        levelText.position.set(slotX + 48, 48);
        weaponsUIContainer.addChild(levelText);
      }
    }
  }
  
  function updateItemsUI() {
    itemsUIContainer.removeChildren();
    
    const ownedItems = itemSystem.getOwnedItems();
    const itemNames = Object.keys(ownedItems);
    
    // Create 3 item slots
    for (let i = 0; i < MAX_ITEM_SLOTS; i++) {
      const slotX = i * 60; // 50px box + 10px gap
      const itemName = itemNames[i];
      const item = itemName ? ownedItems[itemName] : null;
      
      // Slot background
      const itemBox = new PIXI.Graphics();
      if (item) {
        // Filled slot - solid background
        itemBox.rect(0, 0, 50, 50);
        itemBox.fill(0x2a2a2a);
        itemBox.stroke({ color: 0x555555, width: 2 });
      } else {
        // Empty slot - faint outline (need transparent fill for stroke to show)
        itemBox.rect(0, 0, 50, 50);
        itemBox.fill({ color: 0x000000, alpha: 0 }); // Transparent fill
        itemBox.stroke({ color: 0x555555, width: 2, alpha: 0.25 });
      }
      itemBox.position.set(slotX, 0);
      itemsUIContainer.addChild(itemBox);
      
      if (item && item.config.iconTexture) {
        // Item icon (reduced size to fit within 50px slot)
        const icon = new PIXI.Sprite(item.config.iconTexture);
        icon.anchor.set(0.5);
        
        // Adjust scale for Scholar's Tomb (it's a larger sprite)
        if (itemName === 'ScholarsTomb') {
          icon.scale.set(0.04, 0.04); // Reduced from 0.05
        } else {
          icon.scale.set(0.06, 0.06); // Reduced from 0.08 to prevent overflow
        }
        
        icon.position.set(slotX + 25, 25);
        itemsUIContainer.addChild(icon);
        
        // Level text (bottom-right corner)
        const levelText = new PIXI.Text(`${item.level}`, {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: 10,
          fill: 0xFFFFFF
        });
        levelText.anchor.set(1, 1);
        levelText.position.set(slotX + 48, 48);
        itemsUIContainer.addChild(levelText);
      }
    }
  }
  
  updateWeaponsUI();
  updateItemsUI();

  // --- Fire Weapon Function ---
  function fireWeapon(angle) {
    player.currentWeapon.fire(
      player.x, player.y, angle,
      projectilesContainer, projectiles,
      world,
      Projectile, // Pass Projectile class to Weapon.fire()
      RANGE_BASE // Pass range conversion constant
    );
  }
  
  // --- Fire Magic Staff (Sequential Multi-Target) ---
  function fireMagicStaff(weapon) {
    if (!weapon.canFire()) return;
    
    // Calculate effective range in pixels
    // Arc projectiles travel ~33% further than straight line, so use 0.75x multiplier for targeting
    const rangeInPixels = weapon.range * RANGE_BASE;
    const effectiveTargetingRange = rangeInPixels * 0.75;
    
    // Find enemies sorted by distance (initial snapshot) - only within range
    const enemiesByDistance = enemies
      .map(enemy => ({
        enemy: enemy,
        distance: Math.hypot(enemy.x - player.x, enemy.y - player.y)
      }))
      .filter(data => data.distance <= effectiveTargetingRange) // Filter by range accounting for arc
      .sort((a, b) => a.distance - b.distance);
    
    if (enemiesByDistance.length === 0) return; // No targets available within range
    
    const projectileCount = Math.floor(weapon.projectileCount);
    
    // Fire projectiles sequentially with 0.1s delay each
    for (let i = 0; i < projectileCount; i++) {
      setTimeout(() => {
        // Check if game is still running
        if (gameOver || gamePaused) return;
        
        // Re-check for enemies each shot (in case they died during sequence) - filter by range
        const currentEnemies = enemies
          .map(enemy => ({
            enemy: enemy,
            distance: Math.hypot(enemy.x - player.x, enemy.y - player.y)
          }))
          .filter(data => data.distance <= effectiveTargetingRange) // Filter by range accounting for arc
          .sort((a, b) => a.distance - b.distance);
        
        if (currentEnemies.length === 0) return; // No enemies left within range
        
        // Select target: cycle through enemies, but if fewer enemies than projectiles, shoot at same targets
        const targetIndex = i % currentEnemies.length;
        const targetData = currentEnemies[targetIndex];
        const target = targetData.enemy;
        
        // Create arc projectile targeting this enemy
        const staffProj = new MagicStaffProjectile(
          player.x, player.y,
          target.x, target.y,
          weapon.projectileSpeed,
          weapon.projectileTexture,
          weapon.projectileSize,
          rangeInPixels,
          weapon.piercing,
          weapon
        );
        
        projectilesContainer.addChild(staffProj.sprite);
        world.addChild(staffProj.hitboxGraphics);
        magicStaffProjectiles.push(staffProj);
        
        console.log(`✨ Staff projectile ${i + 1}/${projectileCount} fired at enemy (${targetIndex + 1}/${currentEnemies.length} targets)`);
      }, i * 100); // 0.1s (100ms) delay between each
    }
    
    weapon.resetTimer();
    console.log(`✨ Magic Staff initiated ${projectileCount}-shot sequence`);
  }
  
  // --- Fire Longbow (Sequential Single-Target) ---
  function fireLongbow(weapon) {
    if (!weapon.canFire()) return;
    
    // Find nearest enemy
    let nearestEnemy = null;
    let nearestDistance = Infinity;
    
    for (const enemy of enemies) {
      const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      if (dist < nearestDistance) {
        nearestDistance = dist;
        nearestEnemy = enemy;
      }
    }
    
    if (!nearestEnemy) return; // No enemies
    
    const projectileCount = Math.floor(weapon.projectileCount);
    
    // Fire all projectiles at the SAME target (nearest enemy) with 0.1s delay each
    for (let i = 0; i < projectileCount; i++) {
      setTimeout(() => {
        // Check if game is still running
        if (gameOver || gamePaused) return;
        
        // Re-check nearest enemy each shot (target might have moved/died)
        let currentTarget = nearestEnemy;
        
        // If original target is dead, find new nearest
        if (!enemies.includes(currentTarget)) {
          currentTarget = null;
          let minDist = Infinity;
          for (const enemy of enemies) {
            const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
            if (dist < minDist) {
              minDist = dist;
              currentTarget = enemy;
            }
          }
        }
        
        if (!currentTarget) return; // No valid target
        
        // Calculate angle to target
        const angle = Math.atan2(currentTarget.y - player.y, currentTarget.x - player.x);
        
        // Convert range to pixels
        const rangeInPixels = weapon.range * RANGE_BASE;
        
        // Create standard projectile
        const proj = new Projectile(
          player.x, player.y,
          angle,
          weapon.projectileSpeed,
          weapon.projectileTexture,
          weapon.projectileSize,
          rangeInPixels,
          weapon.piercing,
          weapon
        );
        
        projectilesContainer.addChild(proj.sprite);
        world.addChild(proj.hitboxGraphics);
        projectiles.push(proj);
        
        console.log(`🏹 Longbow arrow ${i + 1}/${projectileCount} fired at nearest enemy`);
      }, i * 100); // 0.1s (100ms) delay between each
    }
    
    weapon.resetTimer();
    console.log(`🏹 Longbow initiated ${projectileCount}-shot sequence`);
  }
  
  // --- Player Take Damage Function ---
  function takeDamage(amount) {
    if (player.invulnerable === true) return; // Already invulnerable (use === so undefined/false allows damage)
    
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
  function showLevelUpPopup(levelToDisplay) {
    if (levelUpPopupActive) return; // Prevent multiple popups
    
    levelUpPopupActive = true;
    gamePaused = true;
    
    // Clear existing popup content
    levelUpContainer.removeChildren();
    
    // Apply character growth first (before showing upgrades)
    characterSystem.applyLevelGrowth(levelToDisplay);
    updateCharacterWeaponScaling(levelSystem.level);
    
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
    const weaponIcons = {
      longbow: bowTexture,
      staff: staffTexture,
      shield: shieldTexture,
      sword: swordIconTexture
    };
    
    const upgradeCards = upgradeSystem.generateUpgradeCards(
      player.weapons,
      ownedItems,
      currentLuck,
      levelSystem.level,
      MAX_WEAPON_SLOTS,
      MAX_ITEM_SLOTS,
      weaponIcons,
      modifierSystem.getGlobalCritChanceBonus()
    );
    
    // Card dimensions
    const cardWidth = 150;
    const cardHeight = 120;
    const cardSpacing = 20;
    
    // Calculate popup width based on card count
    const totalCardsWidth = (cardWidth * upgradeCards.length) + (cardSpacing * (upgradeCards.length - 1));
    const popupPadding = 40;
    const popupWidth = totalCardsWidth + popupPadding;
    const popupHeight = 300;
    const popupX = (VIRTUAL_W - popupWidth) / 2;
    const popupY = (VIRTUAL_H - popupHeight) / 2;
    
    // Semi-transparent background overlay
    const overlay = new PIXI.Graphics();
    overlay.rect(0, 0, VIRTUAL_W, VIRTUAL_H)
      .fill({ color: 0x000000, alpha: 0.7 });
    levelUpContainer.addChild(overlay);
    
    // Popup background
    const popup = new PIXI.Graphics();
    popup.rect(0, 0, popupWidth, popupHeight)
      .fill(0x1a1a1a)
      .stroke({ color: 0x555555, width: 3 });
    popup.position.set(popupX, popupY);
    levelUpContainer.addChild(popup);
    
    // Title (show specific level being processed)
    const titleText = new PIXI.Text(`LEVEL ${levelToDisplay}!`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: 28,
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
      fontSize: 18,
      fill: 0xFFFFFF,
      align: 'center'
    });
    subtitleText.anchor.set(0.5);
    subtitleText.position.set(popupWidth / 2, 80);
    popup.addChild(subtitleText);
    
    // Create upgrade cards
    const cardsStartX = 20; // Half of popupPadding
    
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
    
    // Handle weapon unlocks (create weapon and add to player)
    if (cardData.type === 'weapon_unlock') {
      let newWeapon = null;
      
      if (cardData.target === 'Longbow') {
        newWeapon = weaponSystem.createWeapon(longbowConfig);
      } else if (cardData.target === 'Magic Staff') {
        newWeapon = weaponSystem.createWeapon(magicStaffConfig);
      } else if (cardData.target === 'Shield') {
        newWeapon = weaponSystem.createWeapon(shieldConfig);
      } else if (cardData.target === 'Sword Slash') {
        newWeapon = weaponSystem.createWeapon(originalSwordConfig);
      }
      
      if (newWeapon && player.weapons.length < MAX_WEAPON_SLOTS) {
        player.weapons.push(newWeapon);
        console.log(`✅ Unlocked weapon: ${cardData.target}`);
        updateCharacterWeaponScaling(levelSystem.level);
      }
    } else {
      // Apply the upgrade via UpgradeSystem (routes to appropriate system)
      const result = upgradeSystem.applyUpgrade(cardData);
      
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
    
    // Recalculate player stats from modifier system (important for item effects)
    const baseStats = characterSystem.getBaseStats();
    
    // Update pickup range (Soul Catcher)
    player.pickupRange = modifierSystem.getFinalStat('pickupRange', baseStats.pickupRange || 40);
    
    // Update max HP (Bloodstone Amulet)
    const oldMaxHP = player.maxHp;
    const newMaxHP = modifierSystem.getFinalStat('maxHP', baseStats.maxHP || 100);
    if (newMaxHP !== oldMaxHP) {
      // Scale current HP proportionally
      const hpRatio = oldMaxHP > 0 ? player.hp / oldMaxHP : 1.0;
      player.maxHp = newMaxHP;
      player.hp = Math.round(player.maxHp * hpRatio);
      console.log(`💚 Max HP updated: ${oldMaxHP} → ${newMaxHP}`);
    }
    
    // Update armor (Gambeson) - stored for reference, but takeDamage reads from modifier system
    player.armor = modifierSystem.getFinalStat('armor', baseStats.armor || 0);
    
    // Update luck (Rabbit's Foot) - stored for reference
    player.luck = modifierSystem.getFinalStat('luck', baseStats.luck || 0);
    
    // Update move speed multiplier (affects baseMoveSpeed scaling)
    player.moveSpeed = modifierSystem.getFinalStat('moveSpeed', baseStats.moveSpeed || 1);
    
    console.log(`📊 Stats recalculated - Pickup: ${player.pickupRange.toFixed(1)}, Armor: ${player.armor.toFixed(1)}, Luck: ${player.luck.toFixed(1)}, MaxHP: ${player.maxHp}`);
    
    // Update weapons UI and items UI
    updateWeaponsUI();
    updateItemsUI();
    
    // Close popup
    hideLevelUpPopup();
  }
  
  function hideLevelUpPopup() {
    levelUpContainer.visible = false;
    levelUpContainer.removeChildren();
    levelUpPopupActive = false;
    
    // Check if there are more pending level-ups
    if (pendingLevelUps.length > 0) {
      const nextLevel = pendingLevelUps.shift();
      console.log(`📊 Processing next level-up: ${nextLevel} (${pendingLevelUps.length} remaining)`);
      showLevelUpPopup(nextLevel);
    } else {
      // All level-ups processed, resume game
      gamePaused = false;
      console.log('🎮 Game resumed after all upgrade selections');
    }
  }

  // --- Game Reset Function ---
  function resetGame() {
    console.log('🔄 Resetting game...');
    
    // Reset global XP multiplier
    globalXPMultiplier = 1.0;
    
    // Clear pending level-ups queue
    pendingLevelUps = [];
    
    // Hide boss health bar (no active boss after reset)
    bossHealthBarContainer.visible = false;
    
    // Reset player stats
    player.hp = player.maxHp;
    player.invulnerable = false;
    player.invulnerabilityTimer = 0;
    player.damageFlashTimer = 0;
    player.dazeRemaining = 0;
    player.dazeMoveMultiplier = 1;
    player.tint = 0xFFFFFF;
    
    // Reset dash state
    player.dashActive = false;
    player.dashTimer = 0;
    player.dashCooldownTimer = 0;
    player.dashDirectionX = 0;
    player.dashDirectionY = 0;
    player.lastMovementX = 0;
    player.lastMovementY = 0;
    player.alpha = 1.0;
    
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
    player.characterKey = startingCharacterKey;
    player.characterName = startingCharacterName;
    
    // Reset starting weapon to original configuration
    const resetStartingWeaponConfig = { ...startingWeaponBaseConfig };
    const refreshedWeapon = weaponSystem.createWeapon(resetStartingWeaponConfig);
    const primaryWeapon = player.weapons[0];
    Object.assign(primaryWeapon, refreshedWeapon);
    updateCharacterWeaponScaling(1);
    primaryWeapon.fireTimer = 0;
    primaryWeapon.iconTexture = resetStartingWeaponConfig.iconTexture;
    primaryWeapon.projectileTexture = resetStartingWeaponConfig.projectileTexture;
    player.currentWeapon = primaryWeapon;
    
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
    gameStarted = false;
    
    // Restart timer delay
    setTimeout(() => {
      gameStarted = true;
      console.log('⏱️ Timer restarted!');
    }, 1000);
    
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
  
  // Game loop control flag
  let gameLoopRunning = false;
  let gameLoopId = null;
  
  // --- Cleanup Function (Destroys all game objects) ---
  function cleanupGame() {
    console.log('🧹 Cleaning up game...');
    
    // Stop game loop
    gameLoopRunning = false;
    if (gameLoopId !== null) {
      cancelAnimationFrame(gameLoopId);
      gameLoopId = null;
    }
    
    // Clear all arrays
    enemies.length = 0;
    projectiles.length = 0;
    xpOrbs.length = 0;
    deathClouds.length = 0;
    damageNumbers.length = 0;
    damageNumberPool.length = 0;
    
    // Clear shield projectiles
    while (shieldProjectiles.length > 0) {
      const shield = shieldProjectiles.pop();
      shield.destroy();
    }
    
    // Clear magic staff projectiles
    while (magicStaffProjectiles.length > 0) {
      const staffProj = magicStaffProjectiles.pop();
      staffProj.destroy();
    }
    
    // Destroy all containers and their children
    world.destroy({ children: true });
    combatFX.destroy({ children: true });
    ui.destroy({ children: true });
    gameOverOverlay.destroy();
    
    // Remove all containers from stage
    if (world.parent) app.stage.removeChild(world);
    if (combatFX.parent) app.stage.removeChild(combatFX);
    if (ui.parent) app.stage.removeChild(ui);
    if (gameOverOverlay.parent) app.stage.removeChild(gameOverOverlay);
    
    console.log('✅ Game cleanup complete');
  }
  
  // --- Blur Effect on Death ---
  let blurFilter = null;
  
  function startDeathBlur() {
    console.log('🌀 Starting death blur...');
    
    // Create blur filter for game content
    blurFilter = new PIXI.BlurFilter();
    blurFilter.blur = 0; // Start with no blur
    
    // Apply blur to game containers (not the overlay or game over text)
    world.filters = [blurFilter];
    combatFX.filters = [blurFilter];
    
    // Gradually increase blur over 2 seconds
    const blurDuration = 2.0;
    const maxBlur = 20; // Maximum blur strength
    let elapsed = 0;
    const startTime = Date.now();
    
    const blurUpdate = () => {
      if (!gameOver) return; // Stop if game is no longer over
      
      elapsed = (Date.now() - startTime) / 1000;
      const progress = Math.min(elapsed / blurDuration, 1);
      
      // Gradually increase blur
      if (blurFilter) {
        blurFilter.blur = progress * maxBlur;
      }
      
      if (progress < 1) {
        requestAnimationFrame(blurUpdate);
      } else {
        console.log('🌀 Blur complete');
      }
    };
    
    blurUpdate();
  }
  
  // --- Return to Main Menu Function ---
  async function returnToMainMenu() {
    console.log('🏠 Returning to main menu...');
    
    // Show and fade in overlay
    gameOverOverlay.visible = true;
    gameOverOverlay.alpha = 0;
    
    // Fade to black over 1.5 seconds (independent of blur)
    const duration = 1.5;
    let elapsed = 0;
    const startTime = Date.now();
    
    await new Promise(resolve => {
      const fadeUpdate = () => {
        elapsed = (Date.now() - startTime) / 1000;
        const progress = Math.min(elapsed / duration, 1);
        
        // Fade overlay to black
        gameOverOverlay.alpha = progress;
        
        if (elapsed >= duration) {
          console.log('🌑 Fade to black complete');
          resolve();
        } else {
          requestAnimationFrame(fadeUpdate);
        }
      };
      fadeUpdate();
    });
    
    // Cleanup game (this will destroy the containers with blur filters)
    cleanupGame();
    
    // Reset game state variables
    gameOver = false;
    gamePaused = false;
    levelUpPopupActive = false;
    gameStarted = false;
    blurFilter = null; // Clear blur filter reference
    
    // Show main menu (no blur applied)
    await showMainMenu();
    
    console.log('✅ Returned to main menu');
  }

  // --- Old spawn function removed - now using SpawnController ---

  // --- Collision Detection Function ---
  function checkProjectileCollisions() {
    const globalCritBonus = modifierSystem.getGlobalCritChanceBonus();
    const globalDamageMultiplier = modifierSystem.getGlobalDamageMultiplier();
    
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
        const { damage, isCrit } = proj.weapon.calculateDamage(globalCritBonus, globalDamageMultiplier);
        
        // Apply damage with crit info
        enemy.takeDamage(damage, isCrit);
        
        // Apply knockback if weapon has knockback and not on cooldown for this weapon
        const weaponKnockbackCooldown = enemy.knockbackCooldowns.get(proj.weapon.name) || 0;
        if (proj.weapon.knockback > 0 && weaponKnockbackCooldown <= 0) {
          // Calculate direction from player to enemy (push enemy away from player)
          const knockbackDx = enemy.x - player.x;
          const knockbackDy = enemy.y - player.y;
          const knockbackDist = Math.hypot(knockbackDx, knockbackDy);
          
          // Only apply knockback if distance is valid (avoid division by zero)
          if (knockbackDist > 0) {
            const knockbackDirX = knockbackDx / knockbackDist; // Normalized direction (away from player)
            const knockbackDirY = knockbackDy / knockbackDist;
            
            // Apply knockback resistance (0 = no resistance, 0.5 = half, 1.0 = immune)
            const effectiveKnockback = proj.weapon.knockback * (1 - enemy.knockbackResistance);
            
            // Apply knockback as velocity for smooth animation instead of instant position change
            if (effectiveKnockback > 0) {
              enemy.knockbackVelocityX += knockbackDirX * effectiveKnockback;
              enemy.knockbackVelocityY += knockbackDirY * effectiveKnockback;
              
              // Set per-weapon cooldown to prevent stunlock
              enemy.knockbackCooldowns.set(proj.weapon.name, enemy.knockbackCooldownDuration);
            }
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
  
  // --- Shield Projectile Collision Detection ---
  function checkShieldCollisions() {
    const globalCritBonus = modifierSystem.getGlobalCritChanceBonus();
    const globalDamageMultiplier = modifierSystem.getGlobalDamageMultiplier();
    
    for (const shield of shieldProjectiles) {
      const projRadius = shield.getHitboxRadius();
      
      for (const enemy of enemies) {
        // Skip if already hit by this shield recently
        if (shield.hitEnemies && shield.hitEnemies.has(enemy)) {
          continue;
        }
        
        const dx = shield.sprite.x - enemy.x;
        const dy = shield.sprite.y - enemy.y;
        const dist = Math.hypot(dx, dy);
        
        const enemyRadius = enemy.getHitboxRadius();
        if (dist < (projRadius + enemyRadius)) {
          // Calculate damage
          const { damage, isCrit } = shield.weapon.calculateDamage(globalCritBonus, globalDamageMultiplier);
          
          // Apply damage
          enemy.takeDamage(damage, isCrit);
          
          // Apply knockback (Shield has no cooldown - always pushes)
          if (shield.weapon.knockback > 0) {
            const knockbackDx = enemy.x - player.x;
            const knockbackDy = enemy.y - player.y;
            const knockbackDist = Math.hypot(knockbackDx, knockbackDy);
            
            if (knockbackDist > 0) {
              const knockbackDirX = knockbackDx / knockbackDist;
              const knockbackDirY = knockbackDy / knockbackDist;
              const effectiveKnockback = shield.weapon.knockback * (1 - enemy.knockbackResistance);
              
              if (effectiveKnockback > 0) {
                enemy.knockbackVelocityX += knockbackDirX * effectiveKnockback;
                enemy.knockbackVelocityY += knockbackDirY * effectiveKnockback;
                // No cooldown for Shield - continuous pushing
              }
            }
          }
          
          // Spawn damage number
          const spawnOffsetY = isCrit ? -45 : -30;
          createDamageNumber(enemy.x, enemy.y + spawnOffsetY, damage, isCrit);
          
          // Track hit to prevent double-hitting same enemy
          if (!shield.hitEnemies) {
            shield.hitEnemies = new Set();
          }
          shield.hitEnemies.add(enemy);
          
          // Clear hit after short delay to allow re-hitting
          setTimeout(() => {
            if (shield.hitEnemies) {
              shield.hitEnemies.delete(enemy);
            }
          }, 300); // 0.3s cooldown per enemy
        }
      }
    }
  }
  
  // --- Magic Staff Projectile Collision Detection ---
  function checkMagicStaffCollisions() {
    const globalCritBonus = modifierSystem.getGlobalCritChanceBonus();
    const globalDamageMultiplier = modifierSystem.getGlobalDamageMultiplier();
    
    for (let i = magicStaffProjectiles.length - 1; i >= 0; i--) {
      const proj = magicStaffProjectiles[i];
      
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
        const { damage, isCrit } = proj.weapon.calculateDamage(globalCritBonus, globalDamageMultiplier);
        
        // Apply damage
        enemy.takeDamage(damage, isCrit);
        
        // Apply knockback (check per-weapon cooldown)
        const weaponKnockbackCooldown = enemy.knockbackCooldowns.get(proj.weapon.name) || 0;
        if (proj.weapon.knockback > 0 && weaponKnockbackCooldown <= 0) {
          const knockbackDx = enemy.x - player.x;
          const knockbackDy = enemy.y - player.y;
          const knockbackDist = Math.hypot(knockbackDx, knockbackDy);
          
          if (knockbackDist > 0) {
            const knockbackDirX = knockbackDx / knockbackDist;
            const knockbackDirY = knockbackDy / knockbackDist;
            const effectiveKnockback = proj.weapon.knockback * (1 - enemy.knockbackResistance);
            
            if (effectiveKnockback > 0) {
              enemy.knockbackVelocityX += knockbackDirX * effectiveKnockback;
              enemy.knockbackVelocityY += knockbackDirY * effectiveKnockback;
              
              // Set per-weapon cooldown
              enemy.knockbackCooldowns.set(proj.weapon.name, enemy.knockbackCooldownDuration);
            }
          }
        }
        
        // Spawn floating damage number
        const spawnOffsetY = isCrit ? -45 : -30;
        createDamageNumber(enemy.x, enemy.y + spawnOffsetY, damage, isCrit);
        
        if (isCrit) {
          console.log('💥 CRITICAL HIT! (Magic Staff)');
        }
        
        // Track this enemy as hit
        proj.hitEnemies.add(enemy);
        proj.hitCount++;
      }
      
      // Destroy projectile if it has hit maximum number of enemies
      if (proj.hitCount >= proj.piercing) {
        proj.destroy();
        magicStaffProjectiles.splice(i, 1);
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
          const combinedRadius = enemy1.getCollisionRadius() + enemy2.getCollisionRadius();
          
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
  
  // --- Boss Slam trapezoid hitbox (15° spread each side, front wider than rear) ---
  function pointInSlamTrapezoid(px, py, bossX, bossY, angle, length, halfAngleRad) {
    const dx = px - bossX;
    const dy = py - bossY;
    const cosA = Math.cos(-angle);
    const sinA = Math.sin(-angle);
    const localX = dx * cosA - dy * sinA;
    const localY = dx * sinA + dy * cosA;
    if (localX < 0 || localX > length) return false;
    const halfWidthAtX = localX * Math.tan(halfAngleRad);
    return Math.abs(localY) <= halfWidthAtX;
  }
  
  // --- Boss ability hits (Slam: trapezoid + knockback, Stomp: circle + Daze) ---
  const SLAM_LENGTH = 280;
  const SLAM_HALF_ANGLE_RAD = (15 * Math.PI) / 180;
  const SLAM_TRACK_SPEED = 2.2; // rad/s — slam indicator smoothly tracks player during windup
  function normalizeAngleDiff(toAngle, fromAngle) {
    let d = toAngle - fromAngle;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
  }
  const STOMP_RADIUS = 220;
  const SLAM_DAMAGE = 28;
  const SLAM_KNOCKBACK = 40;
  const STOMP_DAMAGE = 14;
  
  function checkBossAbilityHits() {
    const boss = spawnController.activeBoss;
    if (!boss || !boss.bossAbilityState || gameOver) return;
    if (boss.bossAbilityState === 'slam_hit' && !boss.slamHitApplied && boss.bossActiveTimer > 0) {
      if (pointInSlamTrapezoid(player.x, player.y, boss.x, boss.y, boss.bossSlamAngle, SLAM_LENGTH, SLAM_HALF_ANGLE_RAD) && !player.invulnerable) {
        takeDamage(SLAM_DAMAGE);
        const dx = player.x - boss.x;
        const dy = player.y - boss.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0) {
          player.x += (dx / dist) * SLAM_KNOCKBACK;
          player.y += (dy / dist) * SLAM_KNOCKBACK;
        }
        boss.slamHitApplied = true;
      }
    }
    if (boss.bossAbilityState === 'stomp_hit' && !boss.stompHitApplied && boss.bossActiveTimer > 0) {
      const dist = Math.hypot(player.x - boss.x, player.y - boss.y);
      if (dist <= STOMP_RADIUS && !player.invulnerable) {
        takeDamage(STOMP_DAMAGE);
        player.dazeRemaining = 3.0;
        player.dazeMoveMultiplier = 0.7;
        boss.stompHitApplied = true;
      }
    }
  }
  
  // --- Player-Enemy Collision Detection ---
  function checkPlayerEnemyCollisions() {
    for (const enemy of enemies) {
      // Boss damages only via Slam/Stomp in checkBossAbilityHits(); skip generic melee
      if (enemy.enemyType === 'boss') continue;
      
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const dist = Math.hypot(dx, dy);
      
      // Dynamic collision detection: 110% of enemy hitbox radius as attack range
      const attackRadius = enemy.getAttackRadius();
      
      if (dist < attackRadius && !player.invulnerable) {
        takeDamage(10);
        
        // Apply knockback - push player away from enemy (automatically skipped if player.invulnerable)
        const knockbackDistance = 20;
        if (dist > 0) {
          player.x += (dx / dist) * knockbackDistance;
          player.y += (dy / dist) * knockbackDistance;
        }
        
        break; // Only hit once per frame
      }
    }
  }
  
  // --- Enemy Projectile-Shield Collision Detection ---
  function checkEnemyProjectileShieldCollisions() {
    if (!enemyProjectiles || enemyProjectiles.length === 0) return;
    if (!shieldProjectiles || shieldProjectiles.length === 0) return;
    
    for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
      const enemyProj = enemyProjectiles[i];
      const enemyProjRadius = enemyProj.getHitboxRadius();
      
      // Distance from projectile to player (used to ensure we only block when shield is in the path)
      const toPlayerDx = player.x - enemyProj.sprite.x;
      const toPlayerDy = player.y - enemyProj.sprite.y;
      const distToPlayer = Math.hypot(toPlayerDx, toPlayerDy);
      
      // Check collision with each shield
      for (const shield of shieldProjectiles) {
        // Skip shields that are on cooldown
        if (shield.blockCooldown && shield.blockCooldown > 0) {
          continue;
        }
        
        const shieldRadius = shield.getHitboxRadius();
        
        const dx = shield.sprite.x - enemyProj.sprite.x;
        const dy = shield.sprite.y - enemyProj.sprite.y;
        const distToShield = Math.hypot(dx, dy);
        
        // Only block if: (1) projectile overlaps shield hitbox, AND (2) shield is between projectile and player
        // (i.e. projectile is closer to the shield than to the player - so arrow would hit shield first)
        const overlapsShield = distToShield < (enemyProjRadius + shieldRadius);
        const shieldInPath = distToShield < distToPlayer;
        
        if (overlapsShield && shieldInPath) {
          // Block the enemy projectile
          enemyProj.destroy();
          enemyProjectiles.splice(i, 1);
          
          // Set shield cooldown (3 seconds)
          shield.blockCooldown = 3.0;
          shield.blockCooldownMax = 3.0;
          
          // Apply moderate black tint to indicate cooldown
          shield.sprite.tint = 0x333333; // Moderate black tint (0x000000 is pure black, 0x333333 is moderate)
          
          break; // Exit shield loop, continue to next enemy projectile
        }
      }
    }
  }
  
  // --- Enemy Projectile-Player Collision Detection ---
  function checkEnemyProjectileCollisions() {
    if (!enemyProjectiles || enemyProjectiles.length === 0) return;
    
    const playerHitboxRadius = 15; // Player hitbox radius in pixels
    
    for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
      const projectile = enemyProjectiles[i];
      
      // Check collision with player
      const dx = player.x - projectile.sprite.x;
      const dy = player.y - projectile.sprite.y;
      const dist = Math.hypot(dx, dy);
      const hitboxRadius = projectile.getHitboxRadius();
      
      if (dist < (playerHitboxRadius + hitboxRadius) && !player.invulnerable) {
        // Hit player - deal damage
        takeDamage(projectile.damage);
        
        // Apply small knockback - push player away from projectile
        const knockbackDistance = 15;
        if (dist > 0) {
          player.x += (dx / dist) * knockbackDistance;
          player.y += (dy / dist) * knockbackDistance;
        }
        
        // Remove projectile after hitting
        projectile.destroy();
        enemyProjectiles.splice(i, 1);
        continue; // Skip range check for this projectile
      }
      
      // Check if projectile exceeded max range (despawn)
      if (projectile.distanceTraveled >= projectile.maxDistance) {
        projectile.destroy();
        enemyProjectiles.splice(i, 1);
      }
    }
  }

  // --- Game Loop (ohne Ticker) ---
  let lastTime = 0;
  function gameLoop(currentTime) {
    // Check if game loop should continue running
    if (!gameLoopRunning) {
      console.log('🛑 Game loop stopped');
      return;
    }
    
    const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
    lastTime = currentTime;
    
    // Check game over state
    if (player.hp <= 0 && !gameOver) {
      gameOver = true;
      console.log('💀 GAME OVER - Returning to main menu...');
      
      // Show game over text and start blur immediately
      gameOverText.visible = true;
      startDeathBlur();
      
      // Wait 2 seconds before starting fade to black and returning to menu
      setTimeout(async () => {
        await returnToMainMenu();
      }, 2000);
    }
    
    // Update invulnerability timer (always clear invulnerable when timer expired so new runs never stay stuck)
    if (player.invulnerabilityTimer > 0) {
      player.invulnerabilityTimer -= deltaTime;
      if (player.invulnerabilityTimer <= 0) {
        player.invulnerable = false;
      }
    } else {
      player.invulnerable = false;
    }
    if (player.dazeRemaining > 0) {
      player.dazeRemaining -= deltaTime;
      if (player.dazeRemaining <= 0) {
        player.dazeMoveMultiplier = 1;
      }
    }
    
    // Update damage flash timer
    if (player.damageFlashTimer > 0) {
      player.damageFlashTimer -= deltaTime;
      if (player.damageFlashTimer <= 0) {
        player.tint = 0xFFFFFF; // Reset to normal color
      }
    }
    
    // --- Dash Update Logic ---
    // Update dash cooldown timer
    if (player.dashCooldownTimer > 0) {
      player.dashCooldownTimer -= deltaTime;
      if (player.dashCooldownTimer < 0) {
        player.dashCooldownTimer = 0;
      }
    }
    
    // Update dash movement and state
    if (player.dashActive) {
      player.dashTimer -= deltaTime;
      
      if (player.dashTimer <= 0) {
        // Dash complete - reset state and start cooldown
        player.dashActive = false;
        player.dashTimer = 0;
        player.dashCooldownTimer = dashConfig.cooldown;
        
        // Reset visual effects
        player.alpha = 1.0;
        player.tint = 0xFFFFFF;
      } else {
        // Calculate dash progress (1.0 = start, 0.0 = end)
        const progress = 1.0 - (player.dashTimer / dashConfig.duration);
        
        // Move player linearly from start to end position
        player.x = player.dashStartX + player.dashDirectionX * dashConfig.distance * progress;
        player.y = player.dashStartY + player.dashDirectionY * dashConfig.distance * progress;
        
        // Update player hitbox position
        player.hitboxGraphics.x = player.x;
        player.hitboxGraphics.y = player.y;
        
        // Set invulnerability during iFrame period
        const iFrameEndTime = dashConfig.duration - dashConfig.iFrameDuration;
        if (player.dashTimer > iFrameEndTime) {
          player.invulnerable = true;
        }
        
        // Visual feedback: alpha blink effect
        const blinkRate = 12; // blinks per second
        const blinkPhase = (dashConfig.duration - player.dashTimer) * blinkRate * Math.PI * 2;
        player.alpha = 0.5 + 0.5 * Math.sin(blinkPhase);
      }
    }
    
    // Update HP UI
    hpText.text = `HP: ${Math.round(player.hp)}/${Math.round(player.maxHp)}`;
    
    // Update boss health bar (visible only when activeBoss exists)
    const currentBoss = spawnController.activeBoss;
    bossHealthBarContainer.visible = currentBoss !== null;
    if (currentBoss) {
      bossHealthBarFill.clear();
      const ratio = Math.max(0, Math.min(1, currentBoss.hp / currentBoss.maxHp));
      bossHealthBarFill.rect(0, 0, bossBarWidth * ratio, bossBarHeight);
      bossHealthBarFill.fill(0x8B0000, 0.95);
    }
    
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
        
        // Track last movement direction for dash fallback
        player.lastMovementX = dx;
        player.lastMovementY = dy;
      }

      // Skip normal movement if dashing
      if (!player.dashActive) {
        // Apply movement to player in world space (using modifier system)
      const baseMoveMultiplier = player.moveSpeed || 1;
      const finalMoveMultiplier = modifierSystem.getFinalStat('moveSpeed', baseMoveMultiplier);
      let finalMoveSpeed = baseMoveSpeed * finalMoveMultiplier;
      
      // Daze: 30% movement slow (applied by boss Stomp)
      finalMoveSpeed *= (player.dazeMoveMultiplier ?? 1);
      
      // Tiny diagonal speed boost (5%) to help with enemy evasion
      const isDiagonal = (dx !== 0 && dy !== 0);
      if (isDiagonal) {
        finalMoveSpeed *= 1.05;
      }
      
      player.x += dx * finalMoveSpeed * deltaTime;
      player.y += dy * finalMoveSpeed * deltaTime;
      
      // Update player hitbox position
      player.hitboxGraphics.x = player.x;
      player.hitboxGraphics.y = player.y;
      
      // Update facing direction: 8-way PixelLab knight when available, else mirror for left/right. When idle and south, show breathing-idle animation.
      const displaySprite = player.knightStaticSprite || player;
      if (player.knightDirectionTextures) {
        const angle = Math.atan2(dy, dx);
        const sector = Math.floor((angle + Math.PI) / (Math.PI / 4)) % 8;
        const texIndex = player.knightAngleToIndex[sector];
        if (dx !== 0 || dy !== 0) {
          player.knightLastTexIndex = texIndex;
          player.scale.x = Math.abs(player.scale.x);
          if (player.knightIdleSouthSprite) {
            player.knightStaticSprite.visible = true;
            player.knightIdleSouthSprite.visible = false;
            player.knightIdleSouthSprite.stop();
            player.knightIdleElapsed = 0;
          }
          if (player.knightIdleEastSprite) {
            player.knightIdleEastSprite.visible = false;
            player.knightIdleEastElapsed = 0;
          }
          if (player.knightIdleNorthSprite) {
            player.knightIdleNorthSprite.visible = false;
            player.knightIdleNorthElapsed = 0;
          }
          if (player.knightIdleWestSprite) {
            player.knightIdleWestSprite.visible = false;
            player.knightIdleWestElapsed = 0;
          }
          if (player.knightIdleSouthEastSprite) { player.knightIdleSouthEastSprite.visible = false; player.knightIdleSouthEastElapsed = 0; }
          if (player.knightIdleNorthEastSprite) { player.knightIdleNorthEastSprite.visible = false; player.knightIdleNorthEastElapsed = 0; }
          if (player.knightIdleNorthWestSprite) { player.knightIdleNorthWestSprite.visible = false; player.knightIdleNorthWestElapsed = 0; }
          if (player.knightIdleSouthWestSprite) { player.knightIdleSouthWestSprite.visible = false; player.knightIdleSouthWestElapsed = 0; }
          // When dazed and moving: show walk; otherwise show run (or static)
          const isDazed = player.dazeRemaining > 0;
          const walkSprite = player.knightWalkSprites && player.knightWalkSprites[texIndex];
          const walkFrames = player.knightWalkTextures && player.knightWalkTextures[texIndex];
          const runSprite = player.knightRunSprites && player.knightRunSprites[texIndex];
          const runFrames = player.knightRunTextures && player.knightRunTextures[texIndex];
          if (isDazed && walkSprite && walkFrames && walkFrames.length) {
            player.knightStaticSprite.visible = false;
            for (let i = 0; i < 8; i++) {
              if (player.knightRunSprites && player.knightRunSprites[i]) { player.knightRunSprites[i].visible = false; player.knightRunElapsed[i] = 0; }
              if (player.knightWalkSprites && player.knightWalkSprites[i]) player.knightWalkSprites[i].visible = (i === texIndex);
            }
            walkSprite.visible = true;
            player.knightWalkElapsed[texIndex] = (player.knightWalkElapsed[texIndex] || 0) + deltaTime;
            const walkFps = 6;
            const walkIdx = Math.floor(player.knightWalkElapsed[texIndex] * walkFps) % walkFrames.length;
            walkSprite.texture = walkFrames[walkIdx];
          } else if (runSprite && runFrames && runFrames.length) {
            player.knightStaticSprite.visible = false;
            for (let i = 0; i < 8; i++) {
              if (player.knightWalkSprites && player.knightWalkSprites[i]) { player.knightWalkSprites[i].visible = false; player.knightWalkElapsed[i] = 0; }
              if (player.knightRunSprites[i]) player.knightRunSprites[i].visible = (i === texIndex);
            }
            runSprite.visible = true;
            player.knightRunElapsed[texIndex] = (player.knightRunElapsed[texIndex] || 0) + deltaTime;
            const runFps = 8;
            const runIdx = Math.floor(player.knightRunElapsed[texIndex] * runFps) % runFrames.length;
            runSprite.texture = runFrames[runIdx];
          } else {
            for (let i = 0; i < 8; i++) {
              if (player.knightRunSprites && player.knightRunSprites[i]) {
                player.knightRunSprites[i].visible = false;
                player.knightRunElapsed[i] = 0;
              }
              if (player.knightWalkSprites && player.knightWalkSprites[i]) {
                player.knightWalkSprites[i].visible = false;
                player.knightWalkElapsed[i] = 0;
              }
            }
            displaySprite.texture = player.knightDirectionTextures[texIndex];
          }
        } else {
          // Idle: hide run and walk, show direction-specific idle or static
          for (let i = 0; i < 8; i++) {
            if (player.knightRunSprites && player.knightRunSprites[i]) {
              player.knightRunSprites[i].visible = false;
              player.knightRunElapsed[i] = 0;
            }
            if (player.knightWalkSprites && player.knightWalkSprites[i]) {
              player.knightWalkSprites[i].visible = false;
              player.knightWalkElapsed[i] = 0;
            }
          }
          const hideOtherIdles = () => {
            if (player.knightIdleSouthSprite) { player.knightIdleSouthSprite.visible = false; player.knightIdleSouthSprite.stop(); }
            if (player.knightIdleEastSprite) player.knightIdleEastSprite.visible = false;
            if (player.knightIdleNorthSprite) player.knightIdleNorthSprite.visible = false;
            if (player.knightIdleWestSprite) player.knightIdleWestSprite.visible = false;
            if (player.knightIdleSouthEastSprite) player.knightIdleSouthEastSprite.visible = false;
            if (player.knightIdleNorthEastSprite) player.knightIdleNorthEastSprite.visible = false;
            if (player.knightIdleNorthWestSprite) player.knightIdleNorthWestSprite.visible = false;
            if (player.knightIdleSouthWestSprite) player.knightIdleSouthWestSprite.visible = false;
          };
          if (player.knightIdleSouthSprite && player.knightLastTexIndex === 0) {
            player.knightStaticSprite.visible = false;
            hideOtherIdles();
            player.knightIdleSouthSprite.visible = true;
            player.knightIdleSouthSprite.play();
            player.knightIdleElapsed = (player.knightIdleElapsed || 0) + deltaTime;
            const frames = player.knightIdleSouthSprite.textures;
            const fps = 4;
            const idx = Math.floor(player.knightIdleElapsed * fps) % frames.length;
            player.knightIdleSouthSprite.texture = frames[idx];
          } else if (player.knightIdleEastSprite && player.knightLastTexIndex === 1) {
            player.knightStaticSprite.visible = false;
            hideOtherIdles();
            player.knightIdleEastSprite.visible = true;
            player.knightIdleEastElapsed = (player.knightIdleEastElapsed || 0) + deltaTime;
            const eastFrames = player.knightIdleEastTextures || [];
            const fps = 4;
            const idx = Math.floor(player.knightIdleEastElapsed * fps) % eastFrames.length;
            if (eastFrames.length) player.knightIdleEastSprite.texture = eastFrames[idx];
          } else if (player.knightIdleNorthSprite && player.knightLastTexIndex === 2) {
            player.knightStaticSprite.visible = false;
            hideOtherIdles();
            player.knightIdleNorthSprite.visible = true;
            player.knightIdleNorthElapsed = (player.knightIdleNorthElapsed || 0) + deltaTime;
            const northFrames = player.knightIdleNorthTextures || [];
            const fps = 4;
            const idx = Math.floor(player.knightIdleNorthElapsed * fps) % northFrames.length;
            if (northFrames.length) player.knightIdleNorthSprite.texture = northFrames[idx];
          } else if (player.knightIdleWestSprite && player.knightLastTexIndex === 3) {
            player.knightStaticSprite.visible = false;
            hideOtherIdles();
            player.knightIdleWestSprite.visible = true;
            player.knightIdleWestElapsed = (player.knightIdleWestElapsed || 0) + deltaTime;
            const westFrames = player.knightIdleWestTextures || [];
            const fps = 4;
            const idx = Math.floor(player.knightIdleWestElapsed * fps) % westFrames.length;
            if (westFrames.length) player.knightIdleWestSprite.texture = westFrames[idx];
          } else if (player.knightIdleSouthEastSprite && player.knightLastTexIndex === 4) {
            player.knightStaticSprite.visible = false;
            hideOtherIdles();
            player.knightIdleSouthEastSprite.visible = true;
            player.knightIdleSouthEastElapsed = (player.knightIdleSouthEastElapsed || 0) + deltaTime;
            const frames = player.knightIdleSouthEastTextures || [];
            const fps = 4;
            const idx = Math.floor(player.knightIdleSouthEastElapsed * fps) % frames.length;
            if (frames.length) player.knightIdleSouthEastSprite.texture = frames[idx];
          } else if (player.knightIdleNorthEastSprite && player.knightLastTexIndex === 5) {
            player.knightStaticSprite.visible = false;
            hideOtherIdles();
            player.knightIdleNorthEastSprite.visible = true;
            player.knightIdleNorthEastElapsed = (player.knightIdleNorthEastElapsed || 0) + deltaTime;
            const frames = player.knightIdleNorthEastTextures || [];
            const fps = 4;
            const idx = Math.floor(player.knightIdleNorthEastElapsed * fps) % frames.length;
            if (frames.length) player.knightIdleNorthEastSprite.texture = frames[idx];
          } else if (player.knightIdleNorthWestSprite && player.knightLastTexIndex === 6) {
            player.knightStaticSprite.visible = false;
            hideOtherIdles();
            player.knightIdleNorthWestSprite.visible = true;
            player.knightIdleNorthWestElapsed = (player.knightIdleNorthWestElapsed || 0) + deltaTime;
            const frames = player.knightIdleNorthWestTextures || [];
            const fps = 4;
            const idx = Math.floor(player.knightIdleNorthWestElapsed * fps) % frames.length;
            if (frames.length) player.knightIdleNorthWestSprite.texture = frames[idx];
          } else if (player.knightIdleSouthWestSprite && player.knightLastTexIndex === 7) {
            player.knightStaticSprite.visible = false;
            hideOtherIdles();
            player.knightIdleSouthWestSprite.visible = true;
            player.knightIdleSouthWestElapsed = (player.knightIdleSouthWestElapsed || 0) + deltaTime;
            const frames = player.knightIdleSouthWestTextures || [];
            const fps = 4;
            const idx = Math.floor(player.knightIdleSouthWestElapsed * fps) % frames.length;
            if (frames.length) player.knightIdleSouthWestSprite.texture = frames[idx];
          } else {
            player.knightStaticSprite.visible = true;
            hideOtherIdles();
            displaySprite.texture = player.knightDirectionTextures[player.knightLastTexIndex];
            player.knightIdleElapsed = 0;
            player.knightIdleEastElapsed = 0;
            player.knightIdleNorthElapsed = 0;
            player.knightIdleWestElapsed = 0;
            player.knightIdleSouthEastElapsed = 0;
            player.knightIdleNorthEastElapsed = 0;
            player.knightIdleNorthWestElapsed = 0;
            player.knightIdleSouthWestElapsed = 0;
          }
        }
      } else {
        if (dx !== 0 || dy !== 0) {
          if (dx > 0) {
            player.scale.x = Math.abs(player.scale.x);
          } else if (dx < 0) {
            player.scale.x = -Math.abs(player.scale.x);
          }
        }
      }
      }
    }
    
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
      
      // Update Magic Staff projectiles (arc behavior)
      for (let i = magicStaffProjectiles.length - 1; i >= 0; i--) {
        const staffProj = magicStaffProjectiles[i];
        if (staffProj.update(deltaTime)) {
          staffProj.destroy();
          magicStaffProjectiles.splice(i, 1);
        }
      }
      
      // Update Shield orbits
      const shieldWeapon = player.weapons.find(w => w.name === 'Shield');
      if (shieldWeapon) {
        const orbitRadius = shieldWeapon.range * RANGE_BASE; // Range in pixels
        const orbitSpeed = shieldWeapon.projectileSpeed / 100; // Convert px/s to radians/s
        const shieldCount = Math.floor(shieldWeapon.projectileCount);
        
        // Update global orbit angle
        shieldOrbitAngle += orbitSpeed * deltaTime;
        
        // Ensure we have the right number of shield projectiles
        while (shieldProjectiles.length < shieldCount) {
          const shield = new Projectile(
            player.x, player.y, 0,
            0, // No movement speed (position updated manually)
            shieldWeapon.projectileTexture,
            shieldWeapon.projectileSize,
            9999, // Infinite range
            9999, // Infinite piercing
            shieldWeapon
          );
          // Initialize shield cooldown properties
          shield.blockCooldown = 0;
          shield.blockCooldownMax = 0;
          shield.sprite.tint = 0xFFFFFF; // Normal color
          projectilesContainer.addChild(shield.sprite);
          world.addChild(shield.hitboxGraphics);
          shieldProjectiles.push(shield);
        }
        
        // Remove excess shields if count decreased
        while (shieldProjectiles.length > shieldCount) {
          const shield = shieldProjectiles.pop();
          shield.destroy();
        }
        
        // Update shield positions (orbit around player)
        shieldProjectiles.forEach((shield, index) => {
          const angleOffset = (index / shieldCount) * Math.PI * 2;
          const angle = shieldOrbitAngle + angleOffset;
          
          // Update position to orbit around player
          shield.sprite.x = player.x + Math.cos(angle) * orbitRadius;
          shield.sprite.y = player.y + Math.sin(angle) * orbitRadius;
          shield.hitboxGraphics.x = shield.sprite.x;
          shield.hitboxGraphics.y = shield.sprite.y;
          
          // Keep shield upright (no rotation) or add slight visual wobble
          shield.sprite.rotation = Math.sin(angle * 2) * 0.1; // Subtle wobble effect (optional)
          
          // Update shield block cooldown
          if (shield.blockCooldown && shield.blockCooldown > 0) {
            shield.blockCooldown -= deltaTime;
            
            // Restore normal color when cooldown expires
            if (shield.blockCooldown <= 0) {
              shield.blockCooldown = 0;
              shield.sprite.tint = 0xFFFFFF; // Normal white color
            }
          }
        });
      } else {
        // No shield weapon - clear all shield projectiles
        while (shieldProjectiles.length > 0) {
          const shield = shieldProjectiles.pop();
          shield.destroy();
        }
      }
    }

    // Update difficulty and spawn systems
    // Difficulty/time progression pauses during boss encounters and before game starts
    if (!gameOver && !gamePaused && gameStarted) {
      if (!spawnController.activeBoss) {
        difficultySystem.update(deltaTime);
      }
      spawnController.update(deltaTime, player, gamePaused, gameOver);
    }

    // Update enemies
    if (!gamePaused && gameStarted) {
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
          
          // Check if boss
          const isBossEnemy = spawnController.isBoss(enemy);
          // Boss Rush (testing): 10x XP from bosses only - easily removable
          const xpValue = (spawnController.bossRushMode && isBossEnemy) ? enemy.xpReward * 10 : enemy.xpReward;
          const xpOrb = new XPOrb(enemy.x, enemy.y, xpValue);
          xpOrbsContainer.addChild(xpOrb.sprite);
          xpOrbs.push(xpOrb);
          
          // Clean up enemy references from projectile hit tracking
          projectiles.forEach(proj => {
            if (proj.hitEnemies && proj.hitEnemies.has(enemy)) {
              proj.hitEnemies.delete(enemy);
            }
          });
          
          // Clean up for Magic Staff projectiles
          magicStaffProjectiles.forEach(proj => {
            if (proj.hitEnemies && proj.hitEnemies.has(enemy)) {
              proj.hitEnemies.delete(enemy);
            }
          });
          
          // Notify spawn controller if boss was defeated
          if (isBossEnemy) {
            spawnController.onBossDefeated(enemy);
            // Increase global XP multiplier by 1.5x after each boss defeat
            globalXPMultiplier *= 1.5;
            console.log(`👑 Boss defeated! Global XP multiplier increased to ${globalXPMultiplier.toFixed(2)}x`);
          }
          
          enemy.destroy();
          enemies.splice(i, 1);
        } else {
          // Enemy is still alive - check if ranged enemy should fire projectile
          if (enemy.isRanged && enemy.projectileTexture) {
            const difficultySpeedMultiplier = difficultySystem ? difficultySystem.getSpeedMultiplier() : 1.0;
            enemy.fireProjectile(
              player.x,
              player.y,
              enemyProjectiles,
              enemyProjectilesContainer,
              world,
              enemy.projectileTexture,
              difficultySpeedMultiplier
            );
          }
        }
      }
      
      // Update enemy projectiles
      for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
        const projectile = enemyProjectiles[i];
        if (projectile.update(deltaTime)) {
          // Projectile exceeded max range or lifetime
          projectile.destroy();
          enemyProjectiles.splice(i, 1);
        }
      }

      // Check collisions
      checkEnemyCollisions(); // Check enemy-enemy collisions first
      checkEnemyProjectileShieldCollisions(); // Check enemy projectile-shield collisions (block projectiles)
      checkEnemyProjectileCollisions(); // Check enemy projectile-player collisions
      
      // Update visual debugging after collision detection
      if (window.upgradeSystemInstance && window.upgradeSystemInstance.testingMode) {
        for (const enemy of enemies) {
          enemy.updateHitboxVisuals();
        }
      }
      
      checkProjectileCollisions();
      checkMagicStaffCollisions(); // Magic Staff projectiles with arc behavior
      checkShieldCollisions(); // Shield orbit projectiles
      
      // Check player-enemy collisions
      if (!gameOver) {
        checkPlayerEnemyCollisions();
        checkBossAbilityHits();
      }
      
      // Boss telegraph: simple color trapezoid (slam) / circle (stomp); layered behind sprites
      bossTelegraphGraphics.clear();
      const telegraphBoss = spawnController.activeBoss;
      if (telegraphBoss && (telegraphBoss.bossAbilityState === 'windup_slam' || telegraphBoss.bossAbilityState === 'windup_stomp')) {
        bossTelegraphGraphics.x = telegraphBoss.x;
        bossTelegraphGraphics.y = telegraphBoss.y;
        bossTelegraphGraphics.rotation = telegraphBoss.bossAbilityState === 'windup_slam' ? telegraphBoss.bossSlamAngle : 0;
        if (telegraphBoss.bossAbilityState === 'windup_slam') {
          const len = SLAM_LENGTH;
          const frontHalf = len * Math.tan(SLAM_HALF_ANGLE_RAD);
          const backHalf = 20;
          bossTelegraphGraphics
            .moveTo(0, -backHalf).lineTo(0, backHalf).lineTo(len, frontHalf).lineTo(len, -frontHalf).closePath()
            .fill({ color: 0xCC0000, alpha: 0.4 })
            .stroke({ color: 0xFF4444, width: 4, alpha: 0.9 });
        } else {
          bossTelegraphGraphics
            .circle(0, 0, STOMP_RADIUS)
            .fill({ color: 0xCC0000, alpha: 0.35 })
            .stroke({ color: 0xFF4444, width: 4, alpha: 0.9 });
        }
      } else {
        bossTelegraphGraphics.x = 0;
        bossTelegraphGraphics.y = 0;
        bossTelegraphGraphics.rotation = 0;
      }
      
      // Update Y-sorting for depth (sprites with higher Y appear in front)
      player.zIndex = player.y;
      for (const enemy of enemies) {
        enemy.sprite.zIndex = enemy.y;
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
        
        if (orb.update(deltaTime, player.x, player.y, player.pickupRange)) {
          const baseXpGain = characterSystem.getBaseStats().xpGain || 1.0;
          const finalXpGain = modifierSystem.getFinalStat('xpGain', baseXpGain);
          const xpGained = orb.destroy() * finalXpGain * globalXPMultiplier; // Apply XP gain multiplier and global boss multiplier
          const levelsGained = levelSystem.addXP(Math.round(xpGained));
          xpOrbs.splice(i, 1);
          
          // Trigger level up popup(s) if player leveled up
          if (levelsGained.length > 0) {
            // Add all levels to the queue
            pendingLevelUps.push(...levelsGained);
            console.log(`🎉 Gained ${levelsGained.length} level(s): ${levelsGained.join(', ')}`);
            
            // Show first level-up popup immediately
            const firstLevel = pendingLevelUps.shift();
            showLevelUpPopup(firstLevel);
          }
        }
      }
      
      // Merge XP orbs if there are too many (performance optimization)
      if (xpOrbs.length > 1000) {
        mergeXPOrbs();
      }
    }

    // Update Timer UI (MM:SS format)
    // Timer stops during boss encounters
    if (!gameOver && !gamePaused && difficultySystem && !spawnController.activeBoss) {
      const totalSeconds = Math.floor(difficultySystem.getCurrentGameTime());
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      timerText.text = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // Update XP UI
    xpText.text = levelSystem.getXPDisplayText();
    
    // Update boss announcement
    updateBossAnnouncement(deltaTime);

    // Update all weapon timers
    if (!gameOver && !gamePaused) {
      player.weapons.forEach(weapon => weapon.update(deltaTime));
    }

    // Auto-fire logic - fire all weapons
    if (!gameOver && !gamePaused && combatMode === 'auto') {
      player.weapons.forEach(weapon => {
        if (weapon.canFire()) {
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
            // Calculate effective weapon range in pixels
            const effectiveRange = weapon.range * RANGE_BASE;
            
            // Only fire if enemy is within range
            if (nearestDistance <= effectiveRange) {
              const angle = Math.atan2(nearestEnemy.y - player.y, nearestEnemy.x - player.x);
              
              // Handle different weapon behaviors
              if (weapon.weaponBehavior === 'orbit' || weapon.name === 'Shield') {
                // Shield is always active (updated in projectile update section)
                // Don't fire manually - shields orbit automatically
              } else if (weapon.weaponBehavior === 'multi_target_sequential' || weapon.name === 'Magic Staff') {
                // Magic Staff: sequential multi-target firing
                fireMagicStaff(weapon);
              } else if (weapon.name === 'Longbow' && Math.floor(weapon.projectileCount) > 1) {
                // Longbow: sequential single-target firing (only if multiple projectiles)
                fireLongbow(weapon);
              } else {
                // Standard firing (Sword, Longbow with 1 projectile)
                weapon.fire(player.x, player.y, angle, projectilesContainer, projectiles, world, Projectile, RANGE_BASE);
              }
            }
          }
        }
      });
    }

    // Manual fire logic - fire all weapons
    if (!gameOver && !gamePaused && combatMode === 'manual' && mousePressed) {
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
      
      // Fire all weapons
      player.weapons.forEach(weapon => {
        if (weapon.canFire()) {
          if (weapon.weaponBehavior === 'orbit' || weapon.name === 'Shield') {
            // Shield is always active - don't fire manually
          } else if (weapon.weaponBehavior === 'multi_target_sequential' || weapon.name === 'Magic Staff') {
            // Magic Staff: sequential multi-target firing
            fireMagicStaff(weapon);
          } else if (weapon.name === 'Longbow' && Math.floor(weapon.projectileCount) > 1) {
            // Longbow: sequential single-target firing (only if multiple projectiles)
            fireLongbow(weapon);
          } else {
            weapon.fire(player.x, player.y, angle, projectilesContainer, projectiles, world, Projectile, RANGE_BASE);
          }
        }
      });
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
    
    gameLoopId = requestAnimationFrame(gameLoop);
  }
  
  // Start game loop
  gameLoopRunning = true;
  lastTime = performance.now();
  gameLoopId = requestAnimationFrame(gameLoop);
  console.log('🎮 Game loop started');
  
  } // End of initializeGame function

})();