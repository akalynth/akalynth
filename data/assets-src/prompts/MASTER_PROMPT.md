# Akalynth master prompt

Reuse this spine for every single-asset prompt, then append the specific object.
It encodes the Visual Contract v1 and the boundaries. Per-asset prompt files live
under `prompts/<class>/<asset_id>.txt`.

```text
Create a single original game asset for Akalynth.
Nostalgic top-down fantasy MMO readability; original Akalynth world asset, not
copied from any existing game. Hand-pixelled, authored at the Classic 32 base
(32x32; use 32x64 / 64x64 only for tall sprites or composites) and readable when
integer-scaled up to 64/96/128. Top-down slightly isometric view. Transparent
background. Centered object only. No scene, no ground, no UI, no logo, no text.
Crisp 1px dark edge; readable silhouette first, texture second. Consistent soft
lighting from the upper-left with a small natural contact shadow. Dark fantasy
medieval palette (stone, moss green, deep water blue, aged gold) with saturated
color reserved for magic/fire/water/light (arcane cyan, ember orange, bone white,
corrupted violet). Akalynth motifs where fitting: blue-gold crystal magic, mossy
stonework, rune-carved thresholds, brass/amber lanterns, broken monoliths,
crescent ornaments. Usable as an object/tile/sprite in a tile-based online RPG.
```

## Rules

- **Legal:** never reference any existing commercial game, its named places/map
  layouts, or copied item / creature / outfit / UI designs. Describe constraints +
  the Akalynth identity. (The full boundary is in the direction doc.)
- **Lockstep:** prompts describe *appearance only*. Walkability/collision/zone are
  server metadata, never implied by the art.
- **Tiles** add: "seamless; must tile cleanly in all directions; no objects,
  characters, text, or edge shadows."
