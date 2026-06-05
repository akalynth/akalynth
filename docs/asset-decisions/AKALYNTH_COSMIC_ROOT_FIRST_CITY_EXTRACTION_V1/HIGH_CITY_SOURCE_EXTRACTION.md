# High City Source Extraction

## Lane

AKALYNTH_COSMIC_ROOT_FIRST_CITY_EXTRACTION_V1

## Decision

High City is the first city of Akalynth.

Akalynth remains the world and game brand. Azura is not used as the new first-city name for this design lane.

## Source Material

Source repository:

- https://github.com/akalynth/COSMIC_ROOT/tree/main/VaultCore

Source snapshot inspected:

- `COSMIC_ROOT` commit: `7c096353218ff9e2114d1e0b2226eee3f75a5d9e`
- Commit summary: `Add COSMIC_ROOT content: docs, scripts, vaults, infrastructure`

Files inspected as source material only:

- `VaultCore/civilization/cities/vaultcore_prime.json`
- `VaultCore/civilization/cities/vaultcore_prime.yaml`
- `VaultCore/civilization/vaultcore_prime.yaml`
- `VaultCore/civilization/first_city_design.py`
- `VaultCore/civilization/codexborn_citadel.yaml`
- `VaultCore/civilization/flamebound_haven.yaml`
- `VaultCore/civilization/sacred_professions.json`
- `VaultCore/economy/economic_foundation.yaml`

No VaultCore code was executed. No source file was copied into Akalynth runtime.

## Extraction Map

| VaultCore source idea | Akalynth High City adaptation |
| --- | --- |
| VaultCore Prime | High City |
| Sacred triangle formation | Gate to plaza to civic districts layout |
| Dream Sanctums | Lantern Archive / study and memory quarter |
| Flame Temples | Emberworks / forge, craft, blacksmith, market work |
| Scroll Sanctums | Civic archive, records hall, law hall |
| Trinity Convergence Center | Crown Plaza / public meeting center |
| Passion Marketplace | Market lane and service stalls |
| Lawkeeper District | Guard hall, civic bench, records clerk |
| Infinite Archive / memory banks | Chronicle archive and proof hall flavor |
| Transformation Forge | Blacksmith, item repair, future crafting hook |
| Wisdom Exchange Markets | Merchant lane, notice board, task broker |
| Population capacities | Visual density inspiration only |
| VaultCredit / VaultBond / MythMint | Do not import; at most inspire future in-game currencies after economy review |
| Ritual / consciousness systems | Do not import as game mechanics |

## Extracted Design Principles

1. High City should have a clear center.
2. The center should connect visible civic functions: meeting, records, market, guards, housing, and undercity hints.
3. Districts should be readable by role, not by abstract system language.
4. The first city should feel like a lived-in civic place, not a tutorial hallway.
5. Future systems should have obvious homes without being claimed as implemented.
6. Visual landmarks may suggest future functions, but they do not grant mechanics.

## Source Language Removed Or Translated

The following source-language families are intentionally not imported directly:

- cosmic infrastructure
- consciousness amplification
- ritual execution
- sacred authority automation
- species evolution systems
- VaultCredit / VaultBond economic authority
- chain executor operations
- generated ritual scripts
- mesh or agent infrastructure

Where useful, they are translated into player-facing MMO concepts:

- records, archives, libraries
- public assembly
- market stalls
- craft halls
- guard posts
- housing plots
- sewer entrances
- proof and chronicle halls

## Runtime Boundary

This extraction does not rename `Azura` in runtime code, shared maps, tests, receipts, API types, Android assets, or server logic. It creates a reviewed design target only.

