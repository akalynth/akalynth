# Akalynth Game Loop Source Intake v1

Status: reviewed source intake; no runtime promotion.

This document indexes `drop/AKALYNTH_GAME_LOOP_BIBLE_V1/` as design source for
future Akalynth loop work. It does not make raw drop data authoritative and it
does not claim prototype readiness. Runtime authority remains with reviewed
code, receipts, verifiers, and docs under `apps/`, `packages/`, and `docs/`.

## Source Read

Docs:

- `README.md`
- `docs/AKALYNTH_GAME_LOOP_BIBLE_V1.md`
- `docs/AKALYNTH_PLAYER_TIME_HORIZONS_V1.md`
- `docs/AKALYNTH_CORE_LOOPS_V1.md`
- `docs/AKALYNTH_SYSTEMS_MATRIX_V1.md`
- `docs/AKALYNTH_ACTIVITY_CATALOG_V1.md`
- `docs/AKALYNTH_RETENTION_DESIGN_V1.md`
- `docs/AKALYNTH_GAME_LOOP_RELEASE_GATES_V1.md`

Data and registries:

- `data/game_loops.json`
- `data/player_journey.json`
- `data/activity_catalog.json`
- `data/reward_matrix.json`
- `data/world_events.json`
- `data/faction_reputation_matrix.json`
- `registry/akalynthGameLoopRegistry.ts`

Prompts and manifests:

- `prompts/AKALYNTH_GAME_LOOP_BIBLE_POSTER_V1.prompt.md`
- `prompts/CLAUDE_CODE_AKALYNTH_GAME_LOOP_WEBSITE_UPDATE.prompt.md`
- `MANIFEST.md`
- `MANIFEST.csv`
- `CHECKSUMS_SHA256.txt`

## Loop Mapping

| Source loop | Current handling |
| --- | --- |
| Exploration Recovery | Future contract/content loop. Needs map authority, encounter rules, receipts, and anti-cheat review before runtime. |
| Verification | Future evidence/Chronicle loop. Must preserve server-authoritative evidence and receipt-backed contradiction resolution. |
| Profession Economy | Future economy/crafting loop. Requires explicit economy review for resources, mastery, recipes, rewards, and sinks. |
| Dungeon Progression | Future dungeon/content loop. Needs access gates, map/collision authority, boss rules, and receipt-backed unlocks. |
| World Event | Existing runtime seed is Witness Moth Bloom only. Other listed events remain source-only. |
| Social Institution | Future guild/organization loop. Requires protocol, persistence, moderation, and receipt-chain design before promotion. |

## Activity Catalog Mapping

- Field contracts, archive cases, profession orders, dungeon delves, world
  events, and organization contracts are useful naming/source pools.
- The only currently promoted activity from this package family is the Witness
  Moth Bloom world-event pattern already covered by the first-playable intake.
- Rewards listed in the source package are design vocabulary only. Memory
  Fragments, Ley Materials, event currency, reputation, city influence, and
  unique unlocks are not live rewards in this pass.

## Review Flags

Any future implementation from this package needs explicit review lanes:

- `protocol-guardian` if clients need new messages, actions, UI state, or API
  surfaces.
- `receipt-chain-steward` if a loop changes world state, access, reputation,
  rewards, evidence, Chronicle entries, or derived SQLite state.
- `content-designer` for mobs, dungeons, contracts, NPCs, resources, or map
  content.
- `economy-steward` for rewards, materials, crafting outputs, mastery, market
  effects, or currency.
- `anti-cheat-steward` for repeatable farming, contribution spam, travel
  checks, combat pressure, or automated contract abuse.

## Promotion Checklist

Before promoting any loop:

1. Choose one loop and one minimum player action path.
2. Name server state touched and the receipt emitted before derived state
   changes.
3. Keep client input as intent-only; do not accept client truth claims.
4. Define rewards only after economy review.
5. Add a focused verifier or smoke test before marking the loop playable.

## Non-Claims

This intake adds no protocol surface, no event schedule, no social institution,
no economy reward, no faction reputation, no profession system, no dungeon, no
map authority, and no raw `drop/` import.
