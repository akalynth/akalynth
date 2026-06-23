# AKALYNTH Sprite Pipeline

This is the sprite generation & normalization toolkit extracted from the phone (Termux + Codex "game-studio" plugin).

It was used to produce consistent 2D animation assets for AKALYNTH.

## Origin
- Originally part of the Codex `game-studio` skill set on-device.
- Captured from `~/.codex/.tmp/plugins/plugins/game-studio/` (and its cache) while exploring the Termux home.
- Scripts + process have been cleaned up and brought into this workspace.

## Philosophy (from the original pipeline doc)

- Start from **one approved in-game seed frame**.
- Generate the animation as **one horizontal strip** (not individual frames).
- Normalize the whole strip with **one shared scale**.
- Use **one shared anchor** (typically bottom-center).
- Always **preview** before approving.
- Optionally lock frame 01 back to the exact shipped sprite for idle/action continuity.

This approach minimizes drift between frames and keeps the character feeling consistent in size and proportions.

## Scripts

| Script                        | Purpose |
|-------------------------------|---------|
| `build_sprite_edit_canvas.py` | Creates a large transparent canvas with the seed frame placed in the leftmost slot (ready for AI/image editing). |
| `normalize_sprite_strip.py`   | Takes a raw generated strip, splits it, crops to content, applies shared scale + bottom alignment, outputs individual frames. Supports `--lock-frame1`. |
| `render_sprite_preview_sheet.py` | Builds a checkerboard contact sheet from a directory of normalized frames for quick visual review. |

All scripts require **Pillow** (`pip install pillow`).

## Basic Usage

### 1. Build an edit canvas from a seed

```bash
python3 tools/sprite-pipeline/build_sprite_edit_canvas.py \
  --seed bundles/akalynth_emblem_sprite_bundle/assets/sprites/akalynth_emblem_32x32.png \
  --out output/sprites/hurt-edit-canvas.png \
  --frames 4 \
  --slot-size 32 \
  --canvas-size 256
```

### 2. Normalize a generated strip

```bash
python3 tools/sprite-pipeline/normalize_sprite_strip.py \
  --input output/sprites/hurt-raw.png \
  --out-dir output/sprites/hurt \
  --frames 4 \
  --frame-size 32 \
  --anchor bundles/akalynth_emblem_sprite_bundle/assets/sprites/akalynth_emblem_32x32.png \
  --lock-frame1
```

### 3. Make a preview sheet

```bash
python3 tools/sprite-pipeline/render_sprite_preview_sheet.py \
  --frames-dir output/sprites/hurt \
  --out output/sprites/hurt-preview.png \
  --columns 4
```

## Quality Gates (recommended)

- Proportions stable across frames
- No size drift
- Action reads at game scale
- Transparency preserved
- Frame 01 matches the shipped version when locking
- Preview looks good before updating any asset registry

## Related Files

- `README-pipeline.md` — original workflow notes + prompt template
- `SKILL.md` — original Codex skill definition
- `agents.yaml` — interface definition used by the on-device Codex agent

## Integration Notes

These tools are intentionally small, dependency-light (just Pillow), and designed around the same "approved seed + strip + normalize + preview" loop that the AKALYNTH sprite work already uses.

They can be used:
- Manually for asset prep
- In scripts / CI for batch normalization
- As reference when working with AI image tools (the prompt rules are very effective)

## Requirements
```bash
python3 -m pip install pillow
```

