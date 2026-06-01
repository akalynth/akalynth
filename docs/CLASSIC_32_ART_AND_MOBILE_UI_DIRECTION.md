# Akalynth Classic 32 Art And Mobile UI Direction

This document captures the current direction for Akalynth's old-school 2D world art and mobile UI. It is a design and production note, not a release claim.

## Contents

- [Goal](#goal)
- [Research Summary](#research-summary)
- [Version Target](#version-target)
- [Visual Target Reference](#visual-target-reference)
- [Legal And Creative Boundary](#legal-and-creative-boundary)
- [OpenAI Asset Pipeline](#openai-asset-pipeline)
- [Prompt Pattern](#prompt-pattern)
- [Production Rules](#production-rules)
- [Tileset State System](#tileset-state-system)
- [First Asset Set](#first-asset-set)
- [Mobile UI Direction](#mobile-ui-direction)
- [Mobile Controls](#mobile-controls)
- [Action Ring](#action-ring)
- [Inventory And Chat](#inventory-and-chat)
- [Combat Targeting](#combat-targeting)
- [Visual UI Style](#visual-ui-style)
- [Mobile MVP UI Scope](#mobile-mvp-ui-scope)
- [Open Questions](#open-questions)
- [Sources](#sources)

## Goal

Build an original Akalynth visual language that preserves the readability and social feel of early 2000s top-down MMOs without copying Tibia assets, maps, item silhouettes, names, or proprietary client data.

Recommended internal style name:

```text
Akalynth Classic 32
```

Working description:

```text
Original 32x32 old-school top-down medieval MMO pixel art,
late-1990s/early-2000s browser RPG constraints,
square-grid movement, dark readable silhouettes,
low-grind social fantasy world.
```

## Visual Contract v1

The one-line direction: **nostalgic top-down MMO readability + original Akalynth
world assets.** Every generated/authored asset is reviewed against this contract.
Production discipline lives in `data/assets-src/FACTORY.md` (the Asset Factory).

Stable id (recorded in each asset manifest's `style_contract`):

```text
nostalgic_top_down_mmo_readability_original_akalynth_assets_v1
```

Rules (these refine, not replace, the sections below):

- **Camera:** top-down / slightly isometric MMO view.
- **Resolution:** authored at the **Classic 32** base — 32x32 tiles, 32x64 / 64x64
  for tall sprites and composites. "Readable at 64/96/128" means **integer /
  nearest-neighbor upscaling** of the 32px source, never a separate high-res
  master. There is one art resolution: 32px.
- **Lighting:** consistent soft light from the upper-left; a small natural contact
  shadow beneath free-standing objects/creatures. No cinematic side lighting except
  in promotional art (which is never wired into the tile renderer).
- **Tone:** dark fantasy, adventurous, medieval, magical, slightly dangerous.
- **Readability first:** dense-but-controlled pixel detail; silhouette before
  texture; 1px dark edge on objects/creatures/props; flat hand-pixelled look (no
  soft gradients / painterly rendering).
- **Palette:** earthy base (stone, moss green, deep water blue, aged gold) with
  saturated color reserved for magic, fire, water, light, and equipment —
  arcane cyan, ember orange, bone white, corrupted violet.

### Visual target (reference boards)

The intended feel (captured from internal reference boards, described as **original
constraints — never copy any existing game's art, sprites, layouts, or UI**):

- **Warm, dense town squares:** cobblestone streets with *varied, worn* stones and
  moss in the cracks; half-timber + steep red/brown clay-roof buildings; amber-lit
  windows and brass lanterns casting a warm glow; layered greenery (trees, hedges,
  flower boxes); market crates/barrels; a **blue-crystal fountain** centerpiece.
- **Harbors:** stone quays over deep blue water, a moored sailing ship + a rowboat,
  banners with abstract Akalynth sigils, lamp-lined streets.
- **Biome range:** town · green forest/jungle · dark stone dungeon (with arcane
  blue spell glow) · ember/lava depths (with a rune summoning circle). Same 32px
  language, shifted palette + materials per biome.
- **Material/lighting reference:** rich, warm, hand-pixelled materials (stone,
  timber, clay, brass) with soft upper-left light — denser and warmer than a flat
  tile, but still authored at the **Classic 32** base (32px; integer-upscaled for
  display). Higher-res painted reference boards inform *material + warmth*, not the
  authored resolution.
- **Modular building kit:** architecture is assembled from interchangeable 32px
  pieces, not bespoke whole buildings — wall variants (stone, half-timber), **two
  roof materials (thatch/straw and red clay)** with gable/edge/ridge pieces, arched
  and plank doors, windows, support beams, and an arch/gate. Build the kit before
  bespoke structures.
- **Town dressing + interiors:** wall-mounted lanterns (warm amber), banners with
  abstract Akalynth sigils, wells, carts, barrels, sacks, flower planters, and
  fences; simple interiors (bed, fireplace/hearth) for enterable buildings. These
  are the recurring props that make a square feel inhabited.

### Akalynth signature motifs

To stay original (nostalgia without cloning), reuse this recurring visual
language: blue-gold crystal magic; moss-covered stonework; rune-carved
thresholds; brass lanterns with amber windows; ancient broken monoliths; twisted
roots around ruins; crescent-shaped metal ornaments; weathered banners with
abstract sigils; arcane wells, portals, and sealed gates; layered medieval towns
built over older ruins.

### Master prompt (asset generation base)

Reuse this as the spine for every single-asset prompt (then append the specific
object). It encodes the contract and the boundaries; see "Prompt Pattern" below
and the per-asset files in `data/assets-src/prompts/`.

```text
Create a single original game asset for Akalynth.
Nostalgic top-down fantasy MMO readability; original Akalynth world asset, not
copied from any existing game. Hand-pixelled 32x32 base sprite (use 32x64 / 64x64
only for tall sprites/composites), top-down slightly isometric view. Transparent
background. Centered object only. No scene, no UI, no logo, no text. Crisp 1px dark
edge; readable silhouette first. Consistent lighting from upper-left with a small
contact shadow. Dark fantasy medieval palette with subtle Akalynth magical detail.
Usable as an object/tile/sprite in a tile-based online RPG.
```

### Boundaries (reaffirmed — non-negotiable)

- **Legal/creative boundary:** never prompt for or reproduce Tibia/CipSoft art,
  named map layouts, item silhouettes, creature designs, outfit shapes, or UI.
  Describe constraints and the Akalynth identity instead. (See "Legal And Creative
  Boundary".)
- **Server-metadata lockstep:** art is display-only. Collision, walkability,
  interactability, zone/heat/spawn/receipt behavior live in **server metadata
  only**, never inferred from an image. Asset manifests therefore carry
  `mechanics: null`; any mechanical effect is routed through server +
  verification work. (See "Server Metadata Lockstep".)

## Research Summary

Old Tibia-era art is defined more by production constraints than by nostalgia alone:

- 32x32 sprite atoms.
- Square-grid tile placement.
- Top-down or oblique sprites, not true isometric projection.
- Layered map rendering: ground, borders, objects, creatures, effects, UI.
- Dark edge pixels and clear silhouettes.
- Small readable objects with limited detail.
- Muted medieval earth palette with stronger accent colors for magic, water, fire, and equipment.
- Minimal animation, usually simple loops for water, fire, magic, and creature movement.
- Strong visual separation between walkable, blocked, interactive, and dangerous tiles.

The old `.spr` and `.dat` ecosystem matters conceptually. Historical OpenTibia documentation and extractor code describe sprites as compact 32x32 bitmap units, while metadata files describe object flags and types. For Akalynth, the lesson is not to reproduce those file formats blindly. The lesson is to keep visual tiles and server-authoritative map metadata in lockstep.

## Version Target

Do not target one exact Tibia version visually. The practical target is:

```text
Inspired by the constraints of Tibia 7.4-7.6,
with a small amount of 8.0-era polish,
but fully original.
```

Useful distinctions:

- 7.1: rougher, flatter, more primitive.
- 7.4-7.6: strongest old-school target, with richer decorations and improved graphics.
- 8.0: still old-school, but denser and more polished.

## Visual Target Reference

This section pins what the 7.4-7.6-era look actually *is* in production terms, so art can be reviewed against shared criteria. It describes the constraints that produce the look, not any specific source artwork.

Important: we replicate the **constraints and readability** of that era. We do not trace, seed image generation from, or reproduce CipSoft/Tibia screenshots, tiles, maps, item silhouettes, or creature designs. See [Legal And Creative Boundary](#legal-and-creative-boundary). When someone points at an old-school MMO screenshot and says "this style," it means "match these levers with original art" — never "copy that image."

The look is the sum of these levers:

- **Grid and camera.** 32x32 tile atoms on a square grid. Top-down or slight oblique, never true isometric.
- **Palette.** Muted earthy base (greens, browns, greys) at 32-64 working colors per biome. Saturated color is reserved as an accent for magic, fire, water, light, and equipment, never spread across the whole scene.
- **Shading.** Flat, hand-pixelled, nearest-neighbor. Hard color ramps, not soft gradients. Painterly rendering, blur, and ambient-occlusion gradients are out of style by definition.
- **Outline.** Usually a 1px dark edge pixel on objects, props, and creatures to hold silhouettes against the ground.
- **Borders.** Explicit transition tiles (grass to dirt, grass to stone, water edge, cave wall edge), not engine-blended seams.
- **Density.** Small, readable objects with limited internal detail. Legible at 1x before any zoom.

Acceptance check for a new tile or sprite: it reads correctly at 1x, sits cleanly on the square grid, uses the biome palette with restrained accents, holds a dark-edged silhouette, and shows no soft-gradient or painterly shading.

Anything beyond visual style — place names, factions, history, creature canon — is world content and belongs in a `WORLD_*.md` document, not here.

## Legal And Creative Boundary

Allowed:

- Study the constraints and readability patterns of old 32x32 top-down MMOs.
- Create original tiles, creatures, items, UI icons, and maps.
- Use terms like "old-school top-down MMO", "32x32 tile-based fantasy RPG", and "early 2000s browser RPG constraints".

Avoid:

- Copying CipSoft/Tibia sprites.
- Recreating Rookgaard, Thais, Venore, Svargrond, or other named layouts.
- Copying exact item silhouettes, creature designs, outfit shapes, or UI panels.
- Prompting image models to make "Tibia 7.6 sprites" or "exact Tibia-style assets".

## OpenAI Asset Pipeline

Use OpenAI image generation for source art, not final production data.

Recommended model direction:

- Use the current GPT Image model family for source image generation and edits, such as `gpt-image-1.5`, `gpt-image-1`, or the current recommended OpenAI image model at execution time.
- Use Codex/GPT reasoning models for prompt design, atlas tooling, metadata generation, import scripts, and consistency review.
- Use deterministic post-processing for final game assets.

Pipeline:

```text
1. Generate style board.
2. Pick one approved reference tile or sprite.
3. Generate a small coherent asset family.
4. Normalize to 32x32 or approved multi-tile dimensions.
5. Remove and clean background.
6. Quantize palette.
7. Slice and pack into atlas.
8. Add collision and gameplay metadata.
9. Preview in-game.
10. Iterate from screenshots.
```

Do not ask an image model for a final production spritesheet in one pass. Generate small families, approve them, then normalize.

## Prompt Pattern

Use prompts that describe constraints, not copyrighted style.

Example tile prompt:

```text
Create an original 32x32 pixel-art ground tile for a top-down old-school medieval MMO.
Subject: mossy grass with dirt wear.
Camera: top-down square-grid RPG tile, not isometric.
Style: hand-pixelled, dark edge pixels, limited earthy palette, readable at 1x.
Constraints: seamless edges, no text, no UI, no characters, no perspective background,
no soft gradients, no modern painterly rendering.
Output: single tile centered on a plain neutral background.
```

Example creature prompt:

```text
Create an original 32x32 pixel-art creature sprite for a top-down old-school MMO.
Subject: small cave rat.
Style: readable side/top silhouette, dark outline, limited palette.
Alignment: feet anchored to bottom center.
Constraints: idle frame only, no text, no existing game character, transparent-background intended.
```

## Production Rules

World assets:

```text
Base tile size: 32x32
Common large sprites: 32x64, 64x64, or multi-tile composites
Atlas padding: 2px minimum
Runtime scaling: integer only
Texture filtering: nearest-neighbor
Palette target: 32-64 working colors per biome
Outline: usually 1px dark edge pixels
Animation: 2-4 frames for simple effects, 4 frames for walk cycles
```

Metadata rules:

- Visual walkability must never be inferred from image alone.
- Collision, blocking, interactability, zone, heat, spawn, and receipt behavior must live in map/server metadata.
- Any visual tile that implies mechanics must have an explicit mechanical definition.
- Server authority remains non-negotiable: clients send intent, never truth.

## Tileset State System

Akalynth should treat classic 32px tiles as reusable base units with explicit visual states, not as one-off art pieces. The goal is to make repeated tiles feel authored while keeping art production small, readable, and compatible with server-authoritative map metadata.

### Principles

**Micro-variation.**
A tile may reuse the same base geometry while changing small visual layers such as cracks, moss, stains, dust, water marks, soot, or edge wear. These variants should imply age, use, climate, ownership, or recent damage without requiring a new full tile.

**Rhythm break.**
A familiar repeated tile should occasionally appear in a visibly altered state to signal that something happened there. Examples: a normal flagstone appears cracked near a shrine, a standard threshold appears scorched after an event, or a clean wall tile appears damp near an underground passage.

**Diegetic signage.**
Repeated props and tile overlays can communicate world state without UI labels. Banners, lanterns, door marks, shrine trims, floor inlays, warning paint, and wall scratches should be used as in-world signs that players can learn to read.

**Mechanical meaning.**
A tile variant may carry a light gameplay rule when the visual state is clear and consistent. Examples: slick stone affects movement, soft moss muffles footsteps, unstable planks can break, and glowing inlays mark interaction zones. Any mechanical tile variant must be mirrored by map metadata so the server remains authoritative.

### Naming Convention

Tile and prop variants should be named by function and state rather than by visual description alone.

Preferred pattern:

```text
<base>.<surface_or_part>.<state>
```

Examples:

- `flagstone.surface.cracked`
- `flagstone.surface.slick`
- `flagstone.edge.moss`
- `wall.stone.smoke_stained`
- `door.threshold.scorched`
- `lantern.glass.warning`
- `gate.keystone.inverted`
- `shrine.trim.active`
- `bridge.plank.unstable`

Avoid names that only describe art appearance without gameplay or placement meaning, such as:

- `pretty_blue_tile`
- `cool_wall_03`
- `dark_floor_alt`
- `random_crack`

A variant name should help both artists and implementers understand what the tile means in the world.

### Overlay Layers

Where practical, state changes should be authored as separate overlays or decals instead of fully duplicated tiles.

Common overlay classes:

- `moss`
- `crack`
- `soot`
- `dust`
- `waterline`
- `blood`
- `scratch_mark`
- `paint_mark`
- `glow_inlay`
- `faction_mark`
- `warning_mark`

This allows the same base tile to support multiple states while keeping the asset set small. It also lets map authors apply state changes locally without creating a new bespoke tile for every room.

### Server Metadata Lockstep

Any visual state that affects gameplay must have a matching server-readable map property.

Examples:

- `flagstone.surface.slick` → movement modifier
- `bridge.plank.unstable` → break or hazard rule
- `shrine.trim.active` → interaction or quest state
- `door.threshold.scorched` → event/history marker only unless given a rule
- `lantern.glass.warning` → navigation/signage only unless given a rule

Visual-only variants may remain art-side metadata, but mechanical variants must not rely on the client interpreting pixels. The server decides movement, collision, interaction, ownership, hazard, and state transitions.

### Production Rule

When adding a new tile variant, record three things:

1. **Base tile** — what reusable tile or prop it derives from.
2. **State meaning** — what the variant communicates to the player.
3. **Mechanical effect** — none, cosmetic only, or the exact server-side rule it maps to.

If the state introduces lore, faction identity, historical events, or new world canon, it belongs in a `WORLD_*.md` document first and should be referenced from this art-direction document rather than silently introduced here.

## First Asset Set

Build a small coherent set before expanding the world.

Ground:

- Grass.
- Dirt.
- Mud.
- Stone floor.
- Cave floor.
- Water.
- Shore transitions.

Borders:

- Grass to dirt.
- Grass to stone.
- Water edge.
- Cave wall edge.

Structures:

- Stone wall.
- Wooden wall.
- Roof.
- Door.
- Window.
- Stairs or ladder.

Props:

- Tree.
- Stump.
- Rock.
- Barrel.
- Crate.
- Sign.
- Torch.
- Bed.
- Table.
- Chair.

Creatures:

- Rat.
- Wolf.
- Spider.
- Skeleton.
- One original goblin/orc-like early enemy that is not a copied Tibia creature.

Effects:

- Hit spark.
- Poison puff.
- Fire puff.
- Heal sparkle.

## Mobile UI Direction

The world should preserve old-school readability. The UI should be mobile-native.

Do not compress a desktop MMO client onto a phone. Old desktop Tibia kept many panels visible at once: inventory, equipment, chat, battle list, minimap, skills, and containers. That is not viable on mobile.

Mobile layout budget:

```text
Top left: HP, MP, level, XP tick.
Top right: minimap button, connection state, menu.
Center: clear playfield.
Bottom left: movement pad or tap-to-move toggle.
Bottom right: action ring.
Bottom center: one-line chat or system feed.
Drawers: inventory, equipment, chat, map, quests, settings.
```

Default screen shape:

```text
+-----------------------------+
| HP/MP/Level        Mini Map |
|                             |
|                             |
|        Playfield            |
|                             |
|                             |
| Chat preview / system hint  |
| Move pad       Action ring  |
+-----------------------------+
```

## Mobile Controls

Use two control modes:

```text
Default mode: tap-to-move
Combat mode: thumbstick plus target lock
```

Gestures:

- Tap tile: walk or inspect.
- Long press: context menu.
- Double tap: quick interact or use.
- Pinch: limited zoom.
- Swipe left edge: chat drawer.
- Swipe right edge: inventory or equipment drawer.
- Swipe down from top: status or menu sheet.

Combat actions must be explicit. Accidental taps should not trigger irreversible actions.

## Action Ring

Bottom-right action ring:

```text
        Spell
Use   Attack   Interact
        Bag
```

Rules:

- Use icons, not text labels.
- Use large touch targets, ideally 52-64 CSS pixels.
- Use long-press or onboarding hints for unfamiliar icons.
- Keep lower-middle playfield mostly clear.

## Inventory And Chat

Inventory should be a drawer or bottom sheet, not a permanent panel.

Inventory structure:

```text
Equipment strip:
helmet / armor / weapon / shield / legs / boots / ring / amulet

Backpack grid:
4 columns on phone
5-6 columns on tablet

Footer:
gold / capacity / sort or filter / close
```

Avoid deep nested backpack UX for the first mobile MVP. Use old-school visuals with modern handling:

```text
Main | Loot | Tools | Runes | Quest
```

Chat states:

- Collapsed: one or two recent lines above controls.
- Expanded: bottom sheet covering roughly 40-55% of the screen.
- Tabs: Local, Party, Trade, System.

When the mobile keyboard is open, movement controls should fade or disable.

## Combat Targeting

Avoid always-on dense battle lists on phone.

Use:

- Tap creature to select.
- Show target ring on selected creature.
- Show compact target plate near top center.
- Long press creature for details or alternate actions.
- Optional combat drawer for nearby enemies.

Target plate:

```text
[ Rat ]  HP bar  status icons
```

## Visual UI Style

Use "Akalynth Classic 32" materials:

- Dark carved stone.
- Worn parchment.
- Muted brass.
- Moss green cloth.
- Red HP liquid.
- Blue mana liquid.

Typography:

- Readable mobile UI font for body and chat.
- Pixel or fantasy accent font only for labels, icons, or short headings.
- Do not use tiny bitmap text for core mobile controls.

Touch sizing:

```text
Minimum target: 44 CSS px
Preferred action target: 52-64 CSS px
UI icons: 32x32 source, displayed larger with nearest-neighbor scaling
```

## Mobile MVP UI Scope

Build only this first:

1. Playfield with tap-to-move.
2. HP, MP, and XP top-left.
3. Minimap and menu top-right.
4. Bottom-right action ring.
5. Optional bottom-left movement pad.
6. Collapsed chat feed.
7. Inventory bottom sheet.
8. Target plate for selected creature.

Defer:

- Full desktop-style panel layout.
- Always-on battle list.
- Deep nested backpack UI.
- Persistent quest journal.
- Multi-window trading UI.
- Decorative overlays that reduce playfield readability.

## Open Questions

- Should mobile portrait be first-class, or should combat strongly prefer landscape?
- Should tap-to-move or virtual movement be the default for new players?
- How much zoom range can the server/client allow before PvP or anti-cheat readability is affected?
- Which tile metadata format becomes canonical for collision and interaction truth?
- Should mobile inventory simulate nested containers later, or stay tab-based permanently?

## Sources

- Tibia update history and version context: https://www.tibia-wiki.net/wiki/Update
- Old sprite/version references: https://tibia.fandom.com/wiki/Old_Sprites
- Tibia 7.1 `.spr` extraction notes: https://github.com/Szune/Tibia71SprExtractor
- `.dat` and `.spr` structure discussion: https://otland.net/threads/tibia-dat-reader-dat-spr-structure-and-spr-reading-code-link.25117/
- OpenTibia-Unity sprite processing notes: https://slavi.gitbook.io/opentibiaunity/1.0b/getting-started/preparing-stylesheets
- OpenAI image generation guide: https://platform.openai.com/docs/guides/image-generation
- OpenAI image generation tool guide: https://platform.openai.com/docs/guides/tools-image-generation
- OpenAI model list: https://platform.openai.com/docs/models
