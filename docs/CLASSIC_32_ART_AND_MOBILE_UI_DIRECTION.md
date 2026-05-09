# Akalynth Classic 32 Art And Mobile UI Direction

This document captures the current direction for Akalynth's old-school 2D world art and mobile UI. It is a design and production note, not a release claim.

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
