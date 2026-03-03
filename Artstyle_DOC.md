# Medieval Survivors
## Art Style & Design Direction Guide
*(Top-Down Medieval Pixel Art Roguelike / Survivor-Like)*

---

# 1. Technical & Resolution Standards

## Base Resolution
- Target internal resolution: **320×180** or **426×240** (16:9 low-res canvas)
- All assets created at native 1x resolution
- In-engine scaling: **3x or 4x integer scaling only**
- Never use fractional scaling

## Pixel Rendering Rules
- Nearest-neighbor scaling only
- No anti-aliasing
- No texture filtering
- No subpixel positioning
- Strict integer positioning
- No rotation unless pre-drawn

## Core Sprite Dimensions

### Player Character (Knight Archetype)
- Height: **24–28 px**
- Width: 16–20 px
- Head: 6–8 px tall
- Total silhouette including weapon: max 32 px

### Standard Enemies (Skeletons etc.)
- Height: 20–26 px
- Similar scale to player or slightly smaller
- Elites: 28–32 px

### Bosses (e.g. Skeleton Warlord)
- Height: 40–64 px
- 1.5x–2.5x player size
- Strong exaggerated silhouette

### Projectiles
- Small (arrows, bolts): 4–8 px
- Heavy: 8–12 px

### Tiles
- Grid size: **16×16 px**
- Large props: multiples of 16 (32×32, 48×48)

---

# 2. Visual Style

## Outline Rules
- 1px outline
- Dark brown or near-black (not pure black unless needed)
- Stronger outlines on characters
- Softer or selective outlines on environment

## Color Palette Philosophy
- 5–8 shades per material maximum
- No smooth gradients
- High contrast between characters and ground
- Environment lower contrast than gameplay elements

### Dominant Color Themes

Player (Knight):
- **Steel:** Dark desaturated blue-gray or charcoal plate armor (battle-worn feel allowed)
- **Trim:** Muted bronze-gold on helmet, pauldrons, breastplate, gauntlets, greaves (edges and ridges only)
- **Leather:** Warm medium brown for straps, belt, scabbard; belt can have simple metal buckle and rivets
- **Under-armor:** Dark chainmail or gambeson (muted medieval tones) where visible
- **Cloth (optional):** Deep red or royal blue only if visible; not required

Skeletons:
- Warm off-white bone
- Dark eye sockets
- Rusted metal
- Muted cloth scraps

Environment:
- Earthy greens
- Desaturated grass
- Brown soil
- Cold stone gray

Special colors (rare usage only):
- Purple / green for necromancy
- Bright gold for rare drops
- High-saturation glow for pickups

## Shading Style
- Basic cel-shaded pixel shading
- 2–3 shades per surface typical
- Minimal dithering (large surfaces only)
- Light source: **Top-left**
- Shadows: bottom-right
- Optional small 1–2 px drop shadow under characters

## Detail Level
- Simplified facial features (2–4 pixels)
- Suggestion of armor plates, not hyper-detail
- Weapons slightly exaggerated for clarity
- Background must not visually compete with characters

---

# 3. Character Design

## Knight (player) – canonical design

Use this as the reference so the knight’s look stays consistent:

- **Helmet:** Closed full helm with **T-shaped visor** (eyes + breathing); **raised central ridge**; **muted bronze-gold trim** on visor and ridge.
- **Shoulders:** **Layered pauldrons** (multi-layer plate), bronze-gold edges; substantial but not oversized.
- **Torso:** Solid **breastplate** with central ridge and bronze-gold accents; no cape required.
- **Arms:** Segmented plate (rerebraces, vambraces) with **warm brown leather straps**; dark padding/chainmail at elbows; **plate gauntlets**, hands at sides (fists or neutral).
- **Waist:** **Dark brown leather belt** with simple square/rectangular buckle and rivets; **diagonal scabbard strap** (e.g. right shoulder to left hip); sword hilt on hip is fine.
- **Legs:** **Segmented tassets** (upper thighs) with dark chainmail or gambeson visible beneath; **greaves** and **sabatons** with bronze-gold trim and straps.
- **Lighting:** Single light **top-left**; shadows **bottom-right**; **subtle warm rim-light** on armor edges.
- **Pixel art:** Crisp edges, **1px dark outline**, no anti-aliasing; cel-shaded 2–3 tones per material.

All other player characters (e.g. Ranger, Mage) should still follow the same technical rules (outline, lighting, palette) but can have their own costume and silhouette.

## Proportions
Style: Semi-chibi heroic
- Slightly enlarged head
- Compact torso
- Short but readable legs
- Slightly exaggerated hands/weapons

Player:
- Clean silhouette
- Heroic posture

Enemies:
- Slight hunch or asymmetry allowed

Bosses:
- Wide shoulders
- Large weapon silhouettes
- Dramatic stance

## Perspective
- Top-down with slight tilt (~10–15°)
- Head and shoulders visible
- Feet simplified
- Not full side-view

## Silhouette & Readability
- Recognizable within 1 second
- Clear separation from ground
- Distinct outer shapes
- No blending with environment palette

Recurring Identity:
- Medieval fantasy only
- No modern elements
- Weapons slightly oversized for clarity

---

# 4. Animation Standards

## Frame Counts

Player:
- Idle: 2–4 frames
- Walk: 4–6 frames
- Attack: 4–6 frames
- Hit: 2–3 frames
- Death: 6–8 frames

Basic Enemies:
- Idle: 2 frames
- Walk: 4 frames
- Attack: 3–5 frames
- Death: 4–6 frames

Boss:
- Idle: 4 frames
- Walk: 6 frames
- Major attack: 6–8 frames
- Telegraph: 2–4 frames
- Death: 8–12 frames

## Motion Style
- Snappy and readable
- Clear anticipation frame
- Strong impact frame
- 1–2 frame hold on impact
- No floaty tween-like animation

## Direction Count
- Movement: 4-direction minimum
- 8-direction ideal for player
- Attacks: 4-direction sufficient

Gameplay Rule:
- Attacks must read in under 0.3 seconds
- Impact frames slightly exaggerated

---

# 5. Environment & UI

## Tiles & Ground
- 16×16 grid
- Seamless tiling
- Lower contrast than characters

## Props & Obstacles
Examples:
- Campfires
- Crates
- Tombstones
- Barrels

Size:
- 16×16 or 32×32
- Never larger than player unless intended

Lighting:
- Same top-left light source
- Slightly softer contrast than characters

## Pickups
- Size: 8–16 px
- Slight glow effect
- High saturation for visibility
- Clear color coding

## UI Style
- Pixel font only
- No smoothing
- Icon size: 16×16 or 24×24
- Medieval metal/wood frames
- 1px outline borders
- Clean layout
- No excessive ornamentation

---

# 6. Consistency Checklist

Any new asset must:

- Match 16×16 tile grid
- Match player scale (24–28 px height reference)
- Use 1px dark outline
- Follow top-left light source
- Avoid anti-aliasing
- Use integer scaling only
- Maintain strong silhouette
- Keep environment lower contrast than gameplay elements
- Keep animations snappy and readable

---

# Core Identity Summary

Medieval Survivors uses:
- Low-resolution crisp pixel art
- Strong readable silhouettes
- Semi-chibi heroic proportions
- Dark medieval fantasy tone
- Controlled palette (blue-gray steel, bronze-gold trim, brown leather)
- Snappy impact-focused animations
- Gameplay clarity over realism

**Knight (player):** The established knight design is the canonical reference (T-visor helm, bronze-gold trim, layered pauldrons, breastplate with ridge, leather straps and belt, tassets and greaves). New knight art should match this look; see **§3 Knight (player) – canonical design**.

Primary Rule:
**Clarity in chaos.**

All assets must prioritize gameplay readability over detail.
