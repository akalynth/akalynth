# UI Chrome Art-First Lane

**Branch:** `agent/ui-chrome-art-perf-lane`  
**Scope:** `akalynth` runtime only (isolated worktree). Does not touch `akalynth-codex` agent branches.

## Decision

| Choice | Locked |
|---|---|
| UI system | **Classic pixel MMO chrome** (nine-slice PNG pack) |
| Not chosen | CSS-only modern glass replacing chrome |
| Not chosen | Hybrid: glass over 16% opacity muddy frames |

**Rationale:** Beta ugliness came from undersized low-contrast frames stretched into docks, not from “missing glass.” Art-first means readable metal/stone/brass chrome that survives nine-slice stretch. Modern tokens may sit *under* chrome later; they must not hide it.

## Deliverables

1. **Art:** `tools/asset-gen/build_ui_textures.py` → v2 pack (`pack_revision: ui_gameplay_v2_art_first`)
2. **Wire:** `npm run build:assets:ui` + `npm run build:assets` (registry + client mirrors)
3. **Perf:** `MapCanvas` static tile layer cache; dynamic layer only on `nowMs` / actor ticks

## Verify

```sh
python3 tools/asset-gen/build_ui_textures.py   # or npm run build:assets:ui
npm run build:assets
# contact sheet optional; visual QA on /play after client build
```
