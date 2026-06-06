# Akalynth Campaign Act I Source Intake v1

Status: reviewed source intake; no runtime promotion.

This document indexes `drop/AKALYNTH_CAMPAIGN_ACT_I_V1/` as design source for the
Act I campaign spine, "The Four Proofs." It does not make raw drop data
authoritative, and it does not publish the campaign through `infra/web`. Runtime
truth remains with reviewed code, receipts, verifiers, and docs under `apps/`,
`packages/`, and `docs/`.

This package is connective design. It does not add a fifth slice. It states how
the four existing slices read together as one Act, reusing their existing
vocabulary. It does not fork or restate the internal design of any slice.

## Source Read

Docs:

- `README.md`
- `docs/AKALYNTH_CAMPAIGN_ACT_I_V1.md`
- `docs/AKALYNTH_THE_FOUR_PROOFS_CAMPAIGN_SPINE_V1.md`
- `docs/AKALYNTH_ACT_I_CHAPTER_FLOW_V1.md`
- `docs/AKALYNTH_ACT_I_ORIGIN_PATHS_V1.md`
- `docs/AKALYNTH_ACT_I_MAJOR_CHOICES_V1.md`
- `docs/AKALYNTH_ACT_I_FINAL_CONVERGENCE_WARNING_V1.md`
- `docs/AKALYNTH_ACT_I_CHRONICLE_RECORDS_V1.md`
- `docs/AKALYNTH_ACT_I_RELEASE_GATES_V1.md`

Data and registries:

- `data/campaign_summary.json`
- `data/proof_types.json`
- `data/origin_paths.json`
- `data/chapters.json`
- `data/major_choices.json`
- `data/finale_choices.json`
- `data/chronicle_entries.json`
- `data/release_gates.json`
- `registry/akalynthCampaignActIRegistry.ts`

Prompts and manifests:

- `prompts/AKALYNTH_CAMPAIGN_ACT_I_POSTER_V1.prompt.md`
- `prompts/CLAUDE_CODE_AKALYNTH_CAMPAIGN_ACT_I_WEBSITE_UPDATE.prompt.md`
- `prompts/CLAUDE_CODE_AKALYNTH_CAMPAIGN_ACT_I_PROTOTYPE_DATA.prompt.md`
- `MANIFEST.md`
- `MANIFEST.csv`
- `CHECKSUMS_SHA256.txt`

## Campaign Coverage

The source package describes the Act I campaign spine with:

- four prerequisite slices: `AKALYNTH_FIRST_PLAYABLE_SLICE_V1`,
  `AKALYNTH_FORGEHOLD_ROUTE_SLICE_V1`, `AKALYNTH_MOONSPIRE_DREAM_GATE_SLICE_V1`,
  and `AKALYNTH_CINDERWATCH_FRONTIER_SLICE_V1`
- four proof types mapped to the four slice themes: Archive (truth), Material
  (power), Dream (possibility), and Field (survival)
- six origin paths reusing the gameplay-lane origin vocabulary, all converging on
  one shared campaign pressure
- a structure of Prologue, four chapters, and a finale
- per-chapter major choices referenced by id from each owning slice
  (Preserve/Suppress/Release, Lantern/Shield/Blade, Integrate/Banish/Bind,
  Fortify Camp/Keep Route Open/Track Storm Source)
- the finale "Convergence Warning" with three responses: Public Disclosure,
  Quiet Investigation, and Emergency Mobilization
- an Act I "Four Proofs" Chronicle entry as narrative template text
- campaign-level release gates

These are indexed for future work only. They do not create a live campaign,
quest state, chapter gating, finale council, choice persistence, or Chronicle
record in this pass.

## Current Handling

| Source element | Current handling |
| --- | --- |
| Campaign spine and chapter flow | Source-only. Needs a quest/campaign state authority, server-side progression, and receipts before any runtime chapter sequencing. |
| Proof types and proof collection | Source-only design model. Needs server state and receipt coverage before "proofs" become tracked player progress. |
| Origin paths | Source-only. Reuses gameplay-lane origin vocabulary; needs origin selection, starting-zone, and faction-trust authority before runtime. |
| Per-chapter major choices | Source-only references. Authoritative consequences remain with each owning slice; this package adds no new consequence and no choice persistence. |
| Finale Convergence Warning and final choice | Source-only consequence model. Any faction, world, reputation, or Chronicle effect needs a receipt before derived state changes. |
| Chronicle records | Source-only narrative template. NOT the runtime `ChronicleEntry`/`AuditReceipt` schema in `packages/shared/chronicleChain.ts`. No receipt, hash, signature, or chain semantics implied. |
| Release gates | Source-only campaign design checklist. They measure design completeness, not runtime readiness. |

## Economy And Rewards Boundary

The source package references choice outcomes such as Memory Lantern frame,
defender's shield, and blade. These names are design vocabulary owned by the
prerequisite slices. This intake adds no item definitions, drop tables, currency
values, XP, crafting outputs, market behavior, or repeatable reward loop.

## Review Flags

Any future implementation from this package needs explicit review lanes:

- `game-server-steward` for any campaign/quest state machine, chapter sequencing,
  progression authority, or finale council logic.
- `protocol-guardian` if clients need new campaign, chapter, proof, choice, or UI
  state.
- `receipt-chain-steward` for proof collection, chapter completion, choice
  persistence, finale consequences, or any Chronicle record.
- `economy-steward` for any reward, item, currency, XP, or repeatable source/sink
  derived from chapters or the finale.
- `anti-cheat-steward` for any farmable progress, repeatable proof collection, or
  choice-gated reward.
- `content-designer` for any later mob, NPC, dungeon, route, or boss
  implementation that the campaign sequences.

## Promotion Checklist

Before promoting any Act I campaign element:

1. Choose one minimum path, such as a single chapter transition or the finale
   choice record.
2. Name the authoritative server state and receipt emitted before derived state
   changes.
3. Reconcile High City player-facing language with the current Rookguard
   onboarding and legacy `Azura` runtime id boundary.
4. Keep per-chapter choice consequences owned by the prerequisite slices; do not
   fork them into the campaign layer.
5. Keep Android and debug-client inputs intent-only.
6. Keep Chronicle records on the real `ChronicleEntry` schema and signing path,
   not the template text in this package.
7. Add a focused verifier or smoke test before marking any chapter or the finale
   playable.

## Non-Claims

This intake adds no runtime campaign, no quest state, no chapter gating, no
proof-tracking state, no finale council system, no choice persistence, no
protocol surface, no receipt schema, no Chronicle record, no mob stats, no
dungeon, no boss, no drop rate, no economy reward, no faction reputation, no
anti-cheat threshold, no APK or website publication, and no server/client import
from `drop/`.

## Verification Boundary

Expected checks after edits that reference this intake:

- `git diff --check`
- no runtime imports from `drop/` under `apps/` or `packages/`
- focused runtime verifier only after a future implementation promotes one
  concrete chapter transition, proof record, finale choice, or Chronicle record
