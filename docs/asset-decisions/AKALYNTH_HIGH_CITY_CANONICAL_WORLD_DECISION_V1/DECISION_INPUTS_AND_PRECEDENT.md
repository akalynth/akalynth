# Decision Inputs And Precedent

## Purpose

Show that "High City is the canonical first city of Akalynth" is consistent with
existing work, and record exactly what fed this decision.

## Inputs

### 1. Akalynth Lore Bible (canon source of truth)

- `source-material/cosmic-root/AKALYNTH_LORE_BIBLE.md`
- Establishes: Akalynth = the World-Mind / "Guardian of Temporal Insight"; the
  Chronicle = verifiable hash-chain world memory; Tem = anti-bot guardian;
  Rookguard = onboarding gate that keeps its name.
- Notes the realm was formerly called **Azura**, now **VaultCore Prime** in lore.

### 2. VaultCore world-bible extraction lane

- `docs/asset-decisions/AKALYNTH_VAULTCORE_WORLD_BIBLE_EXTRACTION_V1/`
- Already states: "High City is the first city of Akalynth"; VaultCore Prime is the
  old/source name; Dreamforged/Flamebound/Codexborn are lore orders.
- Source: `github.com/akalynth/COSMIC_ROOT @ 7c096353218ff9e2114d1e0b2226eee3f75a5d9e`.

### 3. Azura identifier migration plan lane

- `docs/asset-decisions/AKALYNTH_AZURA_IDENTIFIER_MIGRATION_PLAN_V1/`
- Carries the same canon and specifies runtime naming targets:
  - display name: `High City`; canonical id: `high_city`; wire name: `HighCity`;
    map file: `high_city.json`; gate tile: `GateToHighCity`; legacy aliases keep
    `Azura`/`azura`/`GateToAzura`; protocol bump recommended at `1.2.0`.

### 4. Existing High City map / authority lanes

- `AKALYNTH_HIGH_CITY_MAP_AUTHORITY_BUNDLE_V1`
- `AKALYNTH_HIGH_CITY_BLOCK_LAYOUT_REFINEMENT_V1`
- `AKALYNTH_HIGH_CITY_RUNTIME_MAP_PROJECTION_CANDIDATE_V1`
- `AKALYNTH_EXPERIMENTAL_HIGH_CITY_BLOCK_PREVIEW_V1`
- These already treat High City as the in-progress first-city map target.

## Owner Canon Input (this lane)

The canonical world/city structure was set by the owner:

> Akalynth is the world. High City is a city inside Akalynth, with districts:
> Sky Spires, Dream Sanctums, Trinity Nexus, Market District, Archive Vaults,
> Undercity, Ley Core.

This tree is recorded in `CANONICAL_WORLD_DECISION.md` as authoritative.

## Consistency Check

| Claim | Lore Bible | World-bible lane | Azura plan | This decision |
| --- | --- | --- | --- | --- |
| Akalynth = world, not city | yes | yes | yes | yes |
| High City = first city | implied | yes | yes | **ratified** |
| VaultCore Prime = old name | yes | yes | — | yes |
| Azura = legacy runtime id, rename deferred | — | yes | yes | yes |
| Rookguard keeps name | yes | yes | yes | yes |

No contradictions found. This lane formalizes the shared assumption.
