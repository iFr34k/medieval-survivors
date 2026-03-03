# PixelLab Knight (8-direction)

Knight character used for the player when **Knight** is selected. Generated via PixelLab MCP using the art-style prompt below.

## Art-style prompt (for future PixelLab generations)

Use this when creating characters so they match the game:

- **Tone:** Top-down medieval dark fantasy pixel art. Low-resolution, crisp, gameplay-first readability. Survivor-like roguelike, many enemies on screen. Dark medieval atmosphere, grounded and gritty, not cartoonish. Muted palette: warm bronze accents, deep blue-gray steel. Torch-lit feel with warm orange-brown lighting.
- **Resolution:** True pixel art, crisp edges, no anti-aliasing, nearest-neighbor. Strong 1px dark outline on characters. Environment slightly softer and lower contrast than characters.
- **Lighting:** Single light source top-left; shadows bottom-right; subtle warm rim-light on armor; high contrast character vs ground.
- **Colors:** Steel = dark desaturated blue-gray. Trim = muted bronze-gold. Leather = warm medium brown. Cloth = deep red, royal blue, or muted medieval. Magic = saturated purple/green glow. Environment = desaturated greens, browns, stone gray.
- **Shading:** Cel-shaded, 2–3 tones per material, no smooth gradients, minimal dithering.
- **Proportions:** Semi-chibi heroic; slightly larger head, compact torso, readable silhouette.
- **Perspective:** Top-down with 10–15° tilt; head and shoulders visible, feet simplified.
- **Animation feel:** Snappy, clear anticipation and impact, strong silhouettes.
- **Rule:** Clarity in chaos. Characters and projectiles must stand out from the environment. Stoic warriors, heavy armor, grounded realism; no modern elements, no bright cartoon tones.

## Character (current — reference concept art)

- **Character ID:** `60a256f7-b45d-44c2-a0f5-4fd52a9a3f9f`
- **Canvas:** 124×124px (character ~74px tall, ~55px wide). **Detail:** high detail.
- **Reference:** Concept art knight — closed T-visor helm with central ridge, bronze-gold trim; layered pauldrons; breastplate with ridge; blue-gray plate, brown leather straps and belt, tassets, greaves; top-left light, pixel art 1px outline.
- **Rotations:** 8 directions — loaded from PixelLab CDN at runtime. In-game scale 0.56.
- **Download ZIP:** `https://api.pixellab.ai/mcp/characters/60a256f7-b45d-44c2-a0f5-4fd52a9a3f9f/download` (when ready; use with your API token if needed).

## Previous characters

- `65ad611a-7fc5-4814-9188-c64773a7929b` — Artstyle_DOC, high detail.
- `717c73bc-7ccf-447b-8908-a2326307574b` — 124×124, art-style prompt.
- `7676717b-29d2-4efd-8969-5bf62369cbd6` — 48×48, art-style prompt.
- `ef2b9ca6-33c0-4ecb-b3a8-a589025ed354` — concept art v2, worn bronze-gold trim.
- `c8128514-1d56-4922-9f3d-5f230918c5af` — dark plate, gold-bronze trim, broadsword.
- `64e221df-a682-4fc5-9153-bed7f42904af` — red/blue cloth, earlier style.

## Current integration

- **main.js** loads the 8 rotation PNGs from the PixelLab CDN when `startingCharacterKey === 'Knight'`.
- Player facing is updated each frame from movement direction: texture is switched to the closest of the 8 directions (no scale flip).

## Downloading knight idle frames (breathing-idle south)

PixelLab doesn’t serve animation frame URLs on the CDN; they’re only in the character ZIP. To get the 4 breathing-idle south frames into the project:

1. Get your API token from https://api.pixellab.ai/mcp
2. Run once (from `pixi-game` folder):
   ```bash
   set PIXELLAB_API_TOKEN=your_token_here
   npm run download-knight-idle
   ```
   (On macOS/Linux use `export PIXELLAB_API_TOKEN=your_token_here`.)
3. The script downloads the character ZIP and extracts `breathing-idle/south/*.png` into `src/assets/knight_idle_south/0.png` … `3.png`. The game loads these when you play as Knight, so the idle animation will play when standing still facing south.

## Adding walk / idle animations later

Walk and idle were not queued (PixelLab job slots full). When you have free slots:

1. **Queue animations** (e.g. in an MCP-capable chat):
   - `animate_character(character_id="60a256f7-b45d-44c2-a0f5-4fd52a9a3f9f", template_animation_id="walking")`
   - `animate_character(character_id="60a256f7-b45d-44c2-a0f5-4fd52a9a3f9f", template_animation_id="idle")`
2. **Check status:** `get_character(character_id="60a256f7-b45d-44c2-a0f5-4fd52a9a3f9f")` until animations are complete.
3. **Download** the updated ZIP or use the animation frame URLs from `get_character`.
4. **Integrate** in-game: switch from single-texture-per-direction to `PIXI.AnimatedSprite` using the walk (and optionally idle) frames per direction, per `Artstyle_DOC.md` (e.g. walk 4–6 frames, idle 2–4 frames).
