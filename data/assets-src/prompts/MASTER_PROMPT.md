# Akalynth master prompt

Reuse this spine for every single-asset prompt, then append the specific object.
It encodes the Visual Contract v1 and the boundaries. Per-asset prompt files live
under `prompts/<class>/<asset_id>.txt`.

```text
Create a single original game asset for Akalynth.
Classic late-1990s/2000s top-down 2D MMORPG sprite look: small, chunky,
hand-pixelled, FLAT and highly readable; original Akalynth world asset, not copied
from any existing game. Authored at the Classic 32 base (32x32; use 32x64 / 64x64
only for tall sprites or composites) and readable when integer-scaled to
64/96/128. Bold solid 1px DARK outline around the whole object and around major
internal shapes. FLAT shading with a small limited palette — a base tone, one
darker shade and one lighter highlight per material; hard-edged shadow steps, NO
soft gradients, NO airbrushed lighting, NO glossy reflections. Light from the
upper-left as simple flat highlight blocks, with a small natural contact shadow.
Transparent background. Centered single object only. No scene, no ground, no UI,
no logo, no text. Slightly desaturated, earthy dark-fantasy palette (stone, moss
green, deep water blue, aged gold) with saturated color reserved for magic / fire
/ water / light (arcane cyan, ember orange, bone white, corrupted violet). Akalynth
motifs where fitting: blue-gold crystal magic, mossy stonework, rune-carved
thresholds, brass/amber lanterns, broken monoliths, crescent ornaments. Usable as
an object/tile/sprite in a tile-based online RPG.
```

## Perspective per asset class

The flat-shaded / bold-outline rendering above is universal. The camera differs:

- **Ground props (chests, crates, low objects):** strict OVERHEAD map-tile view —
  describe the *geometry seen from directly above* (e.g. "a rounded lid filling the
  tile, two bands running back-to-front"), not "a chest from above". Naming the
  object + an angle tends to snap back to a front view; describing the top-down
  shapes breaks that.
- **Tall standing props (lamp post, sign, well, market stall) & buildings:** the
  classic slightly-high front angle — the upright object reads top-to-bottom; for
  buildings you see the roof from above-front and the facade below.
- **Creatures / characters:** front-facing standing sprite, classic 2D MMO view.
- **Tiles:** flat straight-down, seamless (see Rules).

## Rules

- **Legal:** never reference any existing commercial game, its named places/map
  layouts, or copied item / creature / outfit / UI designs. Describe constraints +
  the Akalynth identity. (The full boundary is in the direction doc.)
- **Lockstep:** prompts describe *appearance only*. Walkability/collision/zone are
  server metadata, never implied by the art.
- **Tiles** add: "seamless; must tile cleanly in all directions; no objects,
  characters, text, or edge shadows."
