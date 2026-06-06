# Akalynth Drop Source Index

Status: source material, not runtime authority.

`drop/` contains local source packages for future Akalynth lore, gameplay,
systems, visual briefs, and world expansion. The directory is ignored by Git so
bulk imported bundles do not enter source control by accident. These files must
not be treated as already-live gameplay or imported by the server/client
directly.

## Authority Boundary

- `drop/` is a local source corpus for future design and implementation lanes.
- Current runtime truth still lives in `apps/`, `packages/`, `data/`, and the
  receipt-backed docs under `docs/`.
- Promotion from `drop/` requires a reviewed doc, schema, verifier, receipt lane,
  or runtime implementation path.
- Lore-only promotion must say it is player-facing flavor unless it changes a
  rule, receipt, protocol, map, economy, anti-cheat, or persistence behavior.

## Source Packages

| Package | Role | Current handling |
| --- | --- | --- |
| `AKALYNTH_ASSET_LIBRARY_V1/` + `.zip` | Asset and lore codex source: cities, factions, creatures, artifacts, dungeons, heroes, villains, chronicle material. | Indexed by `docs/asset-decisions/AKALYNTH_ASSET_LIBRARY_SOURCE_INTAKE_V1/ASSET_LIBRARY_SOURCE_INTAKE.md`. Keep local as source material. Promote only curated canon/assets through reviewed docs or the asset pipeline. |
| `AKALYNTH_GAMEPLAY_LANE_V1/` + `.zip` | Gameplay lane source: origins, professions, equipment, world map, campaign, raid bosses, progression matrix. | Indexed by `docs/asset-decisions/AKALYNTH_GAMEPLAY_LANE_SOURCE_INTAKE_V1/GAMEPLAY_LANE_SOURCE_INTAKE.md`. Keep local. Treat origin starts, progression, equipment, regions, raid bosses, and High City travel/map material as future design until reconciled with Rookguard onboarding, runtime maps, receipts, economy review, anti-cheat review, and client protocol boundaries. |
| `AKALYNTH_GAME_LOOP_BIBLE_V1/` + `.zip` | Loop design source: session loops, activity catalog, retention design, player time horizons, release gates. | Indexed by `docs/asset-decisions/AKALYNTH_GAME_LOOP_SOURCE_INTAKE_V1/GAME_LOOP_SOURCE_INTAKE.md`. Keep local. Use as design input; do not claim prototype readiness from it alone. |
| `AKALYNTH_SYSTEMS_BIBLE_V1/` + `.zip` | Systems source: progression, combat, economy, crafting, reputation, world state, failure states, social orgs, first playable slice. | Keep local. Any implementation implies explicit protocol/persistence/economy/receipt/anti-cheat review. |
| `AKALYNTH_FIRST_PLAYABLE_SLICE_V1/` + `.zip` | First-playable source: 1-3 hour vertical-slice design, origins, High City Outskirts, Witness Moth Bloom, field evidence, dungeon, boss, final choice, and release gates. | Keep local. Fully indexed by `docs/asset-decisions/AKALYNTH_FIRST_PLAYABLE_SOURCE_INTAKE_V1/FIRST_PLAYABLE_SOURCE_INTAKE.md`; only the Witness Moth Bloom prototype is promoted. High City is player-facing first-city language while legacy `Azura` remains the current runtime id. |
| `AKALYNTH_FORGEHOLD_ROUTE_SLICE_V1/` + `.zip` | Route-expansion source: High City to Ember Road to Forgehold Outer Gate, missing shipment investigation, Soulsteel stabilization, Heartforge Trial, Oathless Forge boss, Lantern / Shield / Blade choice, and route unlocks. | Keep local. Indexed by `docs/asset-decisions/AKALYNTH_FORGEHOLD_ROUTE_SOURCE_INTAKE_V1/FORGEHOLD_ROUTE_SOURCE_INTAKE.md`. No runtime promotion, no raw import, and no live route, crafting, dungeon, boss, reward, or faction consequence. |
| `AKALYNTH_MOONSPIRE_DREAM_GATE_SLICE_V1/` | Dream-gate source: Moonspire Outer Sanctum, Dreamwalker gameplay, Dream Gates, symbolic puzzles, Liminal Web, Unchosen Self boss, Integrate / Banish / Bind choice, and Dream Convergence seed. | Keep local. Indexed by `docs/asset-decisions/AKALYNTH_MOONSPIRE_DREAM_GATE_SOURCE_INTAKE_V1/MOONSPIRE_DREAM_GATE_SOURCE_INTAKE.md`. No runtime promotion, no raw import, and no live dream state, puzzle, gate, dungeon, boss, reward, reputation, or world-event schedule. |
| `AKALYNTH_WORLD_EVENTS_ENGINE_V1/` + `.zip` | World-events source: event lifecycle, event types, canon cards, contribution scoring, rewards, failure/aftermath, prototype event, integration matrix, release gates. | Keep local. The reviewed runtime seed is the Witness Moth Bloom prototype only; no raw package imports and no client-authoritative event state. |

## Promotion Checklist

Before any `drop/` content becomes canonical or live:

1. Name whether the change is lore-only, gameplay design, source data, runtime
   behavior, protocol/API, persistence, economy, anti-cheat, receipt, or asset
   pipeline work.
2. Reconcile player starts, High City language, and future world regions with
   the current Rookguard -> High City player-facing path over the legacy
   `Azura` runtime id.
3. Add or update the relevant claim boundary in `docs/`.
4. Add a verifier, smoke test, proof receipt, or explicit non-binding label.
5. Keep server and client imports pointed at reviewed source, not raw `drop/`
   packages.
