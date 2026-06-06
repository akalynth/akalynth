# Akalynth Moonspire Dream Gate Source Intake v1

Status: reviewed source intake; no runtime promotion.

This document indexes `drop/AKALYNTH_MOONSPIRE_DREAM_GATE_SLICE_V1/` as design
source for a future dream-gate slice. It does not make raw drop data
authoritative, and it does not publish the slice through `infra/web`. Runtime
truth remains with reviewed code, receipts, verifiers, and docs under `apps/`,
`packages/`, and `docs/`.

## Source Read

Docs:

- `README.md`
- `docs/AKALYNTH_MOONSPIRE_DREAM_GATE_SLICE_V1.md`
- `docs/AKALYNTH_DREAMWALKER_GAMEPLAY_V1.md`
- `docs/AKALYNTH_DREAM_GATE_SYSTEM_V1.md`
- `docs/AKALYNTH_SYMBOLIC_PUZZLES_V1.md`
- `docs/AKALYNTH_MOONSPIRE_DREAM_GATE_LOCATIONS_V1.md`
- `docs/AKALYNTH_DREAM_FRAGMENTS_V1.md`
- `docs/AKALYNTH_LIMINAL_WEB_OUTER_STRAND_DUNGEON_V1.md`
- `docs/AKALYNTH_UNCHOSEN_SELF_BOSS_V1.md`
- `docs/AKALYNTH_DREAM_HANDLING_CHOICES_V1.md`
- `docs/AKALYNTH_MOONSPIRE_DREAM_GATE_CHRONICLE_ENTRY_V1.md`
- `docs/AKALYNTH_DREAM_CONVERGENCE_EVENT_SEED_V1.md`
- `docs/AKALYNTH_MOONSPIRE_DREAM_GATE_UI_AND_SYSTEMS_V1.md`
- `docs/AKALYNTH_MOONSPIRE_DREAM_GATE_PRODUCTION_CHECKLIST_V1.md`
- `docs/AKALYNTH_MOONSPIRE_DREAM_GATE_RELEASE_GATES_V1.md`
- `docs/AKALYNTH_MOONSPIRE_DREAM_GATE_IMPLEMENTATION_NOTES_V1.md`

Data and registries:

- `data/moonspire_dream_gate_summary.json`
- `data/locations.json`
- `data/origin_roles.json`
- `data/factions.json`
- `data/acts.json`
- `data/dream_fragments.json`
- `data/symbol_categories.json`
- `data/dream_gate_states.json`
- `data/sponsor_effects.json`
- `data/dungeon_rooms.json`
- `data/boss.json`
- `data/final_choices.json`
- `data/gate_unlocks.json`
- `data/ui_additions.json`
- `data/systems_added.json`
- `data/production_checklist.json`
- `data/release_gates.json`
- `data/success_criteria.json`
- `registry/akalynthMoonspireDreamGateSliceRegistry.ts`

Prompts and manifests:

- `prompts/AKALYNTH_MOONSPIRE_DREAM_GATE_SLICE_POSTER_V1.prompt.md`
- `prompts/CLAUDE_CODE_AKALYNTH_MOONSPIRE_DREAM_GATE_SLICE_WEBSITE_UPDATE.prompt.md`
- `prompts/CLAUDE_CODE_AKALYNTH_MOONSPIRE_DREAM_GATE_PROTOTYPE_DATA.prompt.md`
- `MANIFEST.md`
- `MANIFEST.csv`
- `CHECKSUMS_SHA256.txt`

## Slice Coverage

The source package describes a 1-3 hour dream-gate slice with:

- shared-dream rumors pointing toward Moonspire
- Moonspire Outer Sanctum as the region frame
- Dreamwalker identity, Dream Gates, symbolic puzzles, and Liminal Web
  traversal as primary gameplay sources
- locations including Moonspire Pilgrim Road, Reflection Pools, Dream Sanctum
  Antechamber, Silent Observatory Terrace, Memory Garden Gate, Dream Gate Hall,
  Liminal Web Threshold, and Webbed Mirror Chamber
- six acts from shared-dream introduction through Unchosen Self resolution
- symbolic fragments, symbol categories, dream-gate states, and sponsor effects
- The Liminal Web - Outer Strand as the dungeon candidate
- The Unchosen Self boss with alternate-memory, fear-door, web-pull,
  mirror-claim, and final-awakening beats
- Integrate / Banish / Bind final choice source outcomes
- unlock source entries for Moonspire Outer Sanctum, Reflection Pool repeat
  puzzles, Dream Gate Hall, Liminal Web repeat access, Dream Silk recipe,
  Dream Sanctum reputation, and Dream Convergence event seed

These are indexed for future work only. They do not create live dream state,
Dreamwalker identity, symbolic inventory, puzzle rules, Dream Gate access,
Liminal Web traversal, boss behavior, faction/reputation outcomes, rewards, or
world-event schedules in this pass.

## Current Handling

| Source element | Current handling |
| --- | --- |
| Dreamwalker identity and dream state | Source-only. Needs server-authoritative identity/state rules and receipt-backed transitions before runtime. |
| Symbolic inventory and puzzles | Source-only. Needs item/state schemas, puzzle verification, and client intent boundaries before playable use. |
| Dream Gate access and dream stability | Source-only. Needs protocol, persistence, and receipt review if clients see or affect gate/stability state. |
| Liminal Web room-state changes | Source-only dungeon candidate. Needs map/encounter authority and deterministic server validation before runtime. |
| Nightmare pressure and Unchosen Self boss | Source-only. Needs combat rules, anti-cheat review, failure receipts, and a focused verifier before runtime. |
| Integrate / Banish / Bind choice | Source-only consequence model. Any faction, reputation, item, event, or Chronicle effect needs a receipt before derived state changes. |
| Dream Silk, Dream Sanctum reputation, and Dream Convergence | Source-only. Needs economy, reputation, world-event, and receipt review before live systems or schedules. |

## Economy And Rewards Boundary

The source package names rewards such as `Unchosen Insight`, `Waking Seal`,
`Dream Vessel`, and a first `Dream Silk` crafting recipe. These names are design
vocabulary only. This intake adds no item definitions, drop tables, currency
values, XP, crafting outputs, reputation points, event rewards, or repeatable
reward loop.

## Review Flags

Any future implementation from this package needs explicit review lanes:

- `protocol-guardian` if clients need dream state, Dream Gate, puzzle, dungeon,
  choice, reputation, or event UI surfaces.
- `receipt-chain-steward` for Dream Gate opening, puzzle resolution, dungeon
  entry, failure, rewards, Chronicle records, or final-choice consequences.
- `economy-steward` for Dream Silk recipes, reward items, event rewards,
  currency, XP, reputation yields, or repeatable reward sources/sinks.
- `anti-cheat-steward` for puzzle automation, dream-state farming, combat
  pressure, dungeon repetition, or event-contribution abuse.
- `content-designer` for any later mob, NPC, dungeon, route, puzzle, fragment,
  evidence, or boss implementation.

## Promotion Checklist

Before promoting any Moonspire element:

1. Choose one minimum path, such as Reflection Pool puzzle resolution or Dream
   Gate opening.
2. Name the authoritative server state and receipt emitted before derived state
   changes.
3. Reconcile Moonspire travel with the current Rookguard to High City
   player-facing path and legacy `Azura` runtime id boundary.
4. Keep Android and debug-client inputs intent-only.
5. Define rewards and reputation only after economy review.
6. Add a focused verifier or smoke test before marking the path playable.

## Non-Claims

This intake adds no runtime region, no map authority, no protocol surface, no
receipt schema, no mob stats, no dungeon, no boss, no drop rate, no economy
reward, no reputation system, no world-event schedule, no anti-cheat threshold,
no APK or website publication, and no server/client import from `drop/`.

## Verification Boundary

Expected checks after edits that reference this intake:

- `git diff --check`
- no runtime imports from `drop/` under `apps/` or `packages/`
- focused runtime verifier only after a future implementation promotes one
  concrete dream-state, puzzle, gate, dungeon, boss, reward, reputation, event,
  or choice path
