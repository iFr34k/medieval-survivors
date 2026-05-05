# PixelLab Mage (8-direction)

Mage character used for the player when **Mage** is selected. Same trifecta as Knight: **idle** (breathing-idle), **run** (running-8-frames), **walk** (walking-8-frames, used when dazed).

## Design (Artstyle_DOC-aligned)

**Darker, more threatening vibe:** Deep black or near-black hood, face in total shadow. Heavy robe in very dark purple or charcoal; dull dark metal trim only (no bright gold). Imposing or slightly hunched posture. 1px dark outline, top-left light, shadows bottom-right, cel-shaded 2–3 tones, muted palette. Necromancer / dark caster feel.

## 1. Create the mage character

From `pixi-game`:

```bash
set PIXELLAB_API_TOKEN=your_token
npm run create-mage
```

The script creates the mage via PixelLab v2 (8 directions, 124×124) and prints the **character_id** when ready.

## 2. Set the character ID in the game

In `src/main.js`, find:

```js
const PIXELLAB_MAGE_CHARACTER_ID = ''; // e.g. 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
```

Replace the empty string with the character ID from step 1 so the game can load mage rotations and animations from the CDN.

## 3. Queue the three animations (idle, run, walk)

Use the same queue script with the mage character ID. **Queuing always starts at south** when `PIXELLAB_CHARACTER_ID` is set (no need to set `PIXELLAB_START_AT`). Run **three times** (once per template):

```bash
set PIXELLAB_CHARACTER_ID=<your_mage_character_id>

set PIXELLAB_ANIMATION_TEMPLATE=breathing-idle
npm run pixellab-queue-animation

set PIXELLAB_ANIMATION_TEMPLATE=running-8-frames
npm run pixellab-queue-animation

set PIXELLAB_ANIMATION_TEMPLATE=walking-8-frames
npm run pixellab-queue-animation
```

Each run queues all 8 directions (skipping any already finished). Wait for PixelLab to finish generating between runs if needed.

## 4. Download and extract assets

After animations are ready:

```bash
set PIXELLAB_MAGE_CHARACTER_ID=<your_mage_character_id>
set CHARACTER_OUTPUT=Mage
npm run download-character
```

This writes to `src/assets/Mage/mage_idle/`, `mage_run/`, and `mage_walk/` (all 8 directions). The game loads these when the Mage is selected and uses the same logic as the Knight (idle when still, run when moving, walk when dazed and moving).

## Art style

Use the same art-style guidelines as the Knight (see `Knight/PIXELLAB_KNIGHT.md` and `Artstyle_DOC.md`): top-down medieval dark fantasy, 1px outline, muted palette, 124×124 canvas.

## Character ID

- **Character ID:** `783cd985-9878-4391-9f21-e40ff3cf1b40` (named "Mage" in PixelLab)
