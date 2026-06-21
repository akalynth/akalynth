# Chill-Zone Refine — Design Page

Codex object: chill-zone-refine · Status: **loop-extension proposal** (authored in-session) ·
Extends the **shipped** [[chill-zone-gather]] loop from `gather → deliver` to
`gather → refine → deliver`.

> *"Let the quiet minute have a middle. Pick something up, make it a little better, then hand it over."*

---

## Purpose

The chill-zone gather loop is live behind `CHILL_ZONE_GATHER_ENABLED`: a player walks to a
ley-mote node, gathers (server-owned 3 s clock), carries one item in an ephemeral held slot,
and delivers it at the curation stand for a non-tradeable `tending_token` and a
`delivery_recorded` receipt. This page adds **one honest middle step** — *refine* — turning a
raw `ley_mote` into a `refined_ley_mote` at a **refinery station** before delivery, for a
better acknowledgment.

It is deliberately the **smallest possible economic loop**: it adds a second server-owned
timed action and a second station kind, and reuses the held slot, the range check, the reject
machinery, the receipt, and the Tem-heat seam **exactly as they already exist**. No inventory
expansion, no gold, no tradeable economy.

**Design rule preserved:** the client sends intent, never truth. A refined item exists *only*
as the result of a server-completed refine of a server-gathered raw item. A lying client gains
nothing.

**Soft gate, not a wall:** delivering a *raw* mote still works and still pays `tending_token`
(the shipped loop is untouched and its tests stay green). Refining is an *optional* detour that
pays a better acknowledgment — a meaningful choice ("hand it in now" vs. "spend 5 s for more"),
not a forced extra chore.

---

## Player Action Loop

```text
Enter Azura chill zone
  → move to a ley-mote node            [gather_intent — exists]
  → server gather (3 s, server clock)  → held slot = { ley_mote }
  → move to the refinery stand         [move — exists]
  → refine_intent { station_id }       [refine_intent — NEW]
  → server refine (5 s, server clock)  → held slot = { refined_ley_mote }  (upgraded in place)
  → move to the curation stand
  → deliver_intent { station_id }      [deliver_intent — exists]
  → server consumes slot, grants the REFINED acknowledgment, emits one receipt
  → repeat
```

The client sends exactly **three intents** across the loop — `gather_intent`, `refine_intent`,
`deliver_intent` — plus `move`. `refine_intent` only *starts* a refine; the server completes it
on its own clock in `tickGather`. A client "done" claim is ignored, identical to gather.

**Held-slot capacity stays 1.** Refine *transforms* the held item in place
(`item_type: ley_mote → refined_ley_mote`); it never adds a second slot, so there is no dupe
surface.

**Placeholder lore** (final naming → [[map-and-lore-builder]] / content-designer): refinery =
**Attunement Stand**; refined item = **Attuned Mote**; refined reward = **Keystone Token**.

---

## Server State Touched

All in `apps/server/src/world/gather.ts` (+ its wiring in `index.ts`). Every change is additive
and reuses an existing structure.

| State | Change | Persistence |
|---|---|---|
| `StationDef` / `GatherZone.stations` | add `kind: 'curation' \| 'refinery'`; place one refinery station on Azura | Static placement, ephemeral (as today) |
| `PlayerGather` union | add `\| { state: 'refining'; station_id; zone; started_at_ms; complete_at_ms }` | Ephemeral, in-session (as today) |
| `HeldItem` | **no shape change** — refine mutates `item_type` in place; optionally add `refined_at_station_id` for receipt provenance | Ephemeral held slot (capacity 1) |
| `GatherConfig` | add `refineDurationMs` (propose **5 000**) | Config |
| Reward credit | `deliver` reward becomes a pure function of the delivered `item_type`: `ley_mote → tending_token` (unchanged), `refined_ley_mote → keystone_token` | Recorded-only; **no gold, non-tradeable** |

**No new persistence store.** The only durable artifact remains the delivery receipt. A refine
in progress is lost on disconnect (held slot drops, as today) — re-gather is cheap.

**One activity at a time.** A player is `idle` XOR `gathering` XOR `refining`. `tickGather`
already iterates `gatherByPlayer` and completes due gathers; it gains a sibling branch to
complete due refines (upgrade the held item, set player `idle`). Same deterministic tick, same
loop — no new scheduler.

---

## Protocol Changes (Call-Outs)

→ **[[protocol-guardian]] signs off.** All additive; no change to existing `move` / chat /
gather / deliver behavior. Mirrors the existing Step-2 gather wire 1:1.

**Client → server**
- `refine_intent { station_id }` (+ optional `cancel_refine {}`, mirroring the implicit
  gather-cancel on move/disconnect).

**Server → client**
- `GatherStationPublic` gains `kind: 'curation' | 'refinery'` (so clients render the right
  marker and show the right action button).
- `refine_result { ok, station_id?, item_type?, reason? }` — mirror of `gather_result`.
- `refine_progress { station_id, progress_pct }` — mirror of `gather_progress`; this is what
  proves the refine timer is server-owned. (`gatherProgressPct` generalizes to the active
  timed activity.)
- `refine_completed { item_type }` — mirror of `gather_completed`.
- `deliver_result` gains `refined?: boolean` (so the client can show "refined → keystone_token").
- `GatherRejectReason` gains `not_refinable` and `already_refining`. (`already_gathering`
  already covers "busy with the other activity" if we prefer to fold; keeping a distinct
  `already_refining` is clearer for tests.)

→ flag: protocol.

---

## Refine Guard (server-authoritative)

`refine_intent { station_id }` — reject (no state change) on first failing check:

| Order | Check | Reject code |
|---|---|---|
| 1 | refinery-kind station with that id exists in player's zone | `STATION_NOT_FOUND` |
| 2 | `manhattan(player.pos, station.pos) ≤ interactRadius` (server pos) | `OUT_OF_RANGE` |
| 3 | player activity == idle (busy-before-slot, mirrors `startGather`) | `ALREADY_GATHERING` / `ALREADY_REFINING` |
| 4 | held slot non-empty | `HELD_SLOT_EMPTY` |
| 5 | held item is a refinable raw type (`ley_mote`), not already refined | `NOT_REFINABLE` |

Idle is checked before the slot so a busy player gets `ALREADY_*` rather than a misleading
`HELD_SLOT_EMPTY` (a gathering player holds nothing).

On pass → player `idle → refining`, `complete_at_ms = now + refineDurationMs`. On tick
completion → held `item_type = refined_ley_mote` (+ `refined_at_station_id`), player → `idle`,
emit `refine_completed`.

Station-id namespaces are distinct (`azura_refinery_stand` vs. `azura_curation_stand`), so a
refine aimed at the curation stand is genuinely "no refinery by that id" → `STATION_NOT_FOUND`;
no `STATION_WRONG_KIND` code is required (optional nicety only).

---

## Receipts Emitted

**One receipt per loop, unchanged** — refine provenance folds into the existing
`delivery_recorded`, matching the original "one receipt per loop, not two" principle. The
delivery receipt's `inputs` gains two fields:

```jsonc
// delivery_recorded (action constant DELIVERY_RECORDED_ACTION) — inputs gains:
{
  "item_type":         "refined_ley_mote",     // refined vs raw is visible here
  "station_id":        "azura_curation_stand",
  "source_node_id":    "azura_ley_mote_e",
  "refined":           true,                    // NEW
  "refined_at_station":"azura_refinery_stand",  // NEW (null when delivered raw)
  "zone":              "Azura",
  "reward":            "keystone_token"          // graded by item_type
}
```

A separate `refine_recorded` receipt is **optional**, justified only if anti-cheat later wants
per-refine audit granularity (e.g. to time-correlate gather→refine→deliver). Not needed for the
loop. → flag: receipt (additive `inputs` fields + new reward id; chain-verify must cover both
reward ids).

---

## Anti-Cheat & Abuse Risks

| Risk | Mitigation | Owner |
|---|---|---|
| **Inject a refined item** (skip the work) | A refined item exists only via a server-completed refine of a server-gathered raw item. `refine_intent` only starts the timer; completion is server-side in `tickGather`. Invariant I7. | game-server |
| **Double-refine to stack reward** | Held slot capacity 1; guard #4 `NOT_REFINABLE` rejects refining an already-refined item. Can't hold two. | game-server |
| **Refine without gather** | Guard #3 `HELD_SLOT_EMPTY` — nothing to refine. | game-server |
| **Teleport/speed to refinery** | Range check uses server position (`s.player.x/y`), never client-reported — same honesty the gather/deliver checks already rely on. | movement |
| **Bot farming (core risk)** | Loop is the same shape a bot runs; the refine timer *adds* wall-clock per cycle, **lowering** the max farm rate vs. the current 2-step loop. Heat stays on `deliver` (`applyHeatChange(..., 5, 'gather_cadence')`); a longer cycle accrues heat slower than it decays for honest play. Optionally emit a `refine_cadence` heat signal for per-step granularity (step-3 seam already exists). | anti-cheat / Tem |
| **Reward inflation faucet** | Refined reward stays a **non-tradeable acknowledgment** (`keystone_token`), not gold. Rate is bounded by node respawn cooldown + gather timer + refine timer + per-player single-activity lock. | [[economy-steward]] |
| **Refinery contention/grief** | Refine is **per-player** (own held slot + own timer); the refinery is not a claimable node, so many players can refine at one stand simultaneously with no contention. No new grief surface (unlike shared nodes). | game-server |

**Net new system pressure:** none. The loop *uses* the existing movement validation, Tem-heat
seam, and receipt chain; it adds no new anti-cheat machinery. → flag: anti-cheat (tuning only).

---

## Invariants (extend the gather set I1–I6)

- **I7** A `refined_ley_mote` exists only as the result of a server-completed refine of a held
  raw item. No client message can inject refined state.
- **I8** ≤ 1 active timed activity per player: `gathering` XOR `refining` (never both).
- **I9** Refine upgrades `item_type` in place; held-slot capacity stays 1 (no dupe).
- **I10** `deliver` reward is a pure function of the delivered `item_type`
  (`ley_mote → tending_token`, `refined_ley_mote → keystone_token`); both remain non-gold,
  non-tradeable, recorded-only.
- **I11** Delivering raw is still valid and still pays `tending_token` — the shipped 2-step loop
  and its receipts are unchanged.

---

## Test / Playtest Path

Extends `apps/server/tools/verify-gather-loop.test.ts` (the scripted WS harness) and the
gather unit tests.

**Tier 1 — server unit** (mirror the gather U-series):
- R1 refine: refinery in range, held raw, idle → player `refining`, `complete_at = now + 5 s`.
- R2 tick reaches completion → held `item_type == refined_ley_mote`; player `idle`.
- R3 refine out of range → `OUT_OF_RANGE`; no change.
- R4 refine with empty slot → `HELD_SLOT_EMPTY`.
- R5 refine an already-refined item → `NOT_REFINABLE`.
- R6 refine while gathering/refining → `ALREADY_GATHERING` / `ALREADY_REFINING`.
- R7 disconnect mid-refine → held slot dropped; player idle; no refined item leaks.
- R8 deliver refined → exactly one `delivery_recorded` with `refined:true`,
  `reward == keystone_token`; chain-verify passes.
- R9 deliver raw (regression) → still one receipt, `reward == tending_token`, `refined:false`.

**Tier 2 — scripted WS** (extend S-series, no UI):
1. connect → `gather_snapshot` includes the refinery station with `kind:"refinery"`.
2. gather → move to refinery → `refine_intent` → `refine_progress` advances 0→100 across ticks.
3. `refine_intent` early / out of range / on raw-less slot → rejected with the correct code.
4. after refine → move to curation stand → `deliver_intent` → `deliver_result.refined == true`,
   `reward == "keystone_token"`; `delivery_recorded` in the chronicle; chain-verify passes.

**Tier 3 — playtest:**
- Two players refining at one stand → both succeed independently (no contention) — confirms I8/I9.
- Run the 3-step loop fast and regularly → confirm Tem heat still rises and a challenge fires;
  confirm the longer cycle accrues heat slower than the 2-step loop (sanity on the throttle).

---

## Build Order (smallest verifiable step first)

1. **Server core** (`gather.ts`) — ✅ **done** (`2171a3e`): `StationDef.kind`; `PlayerGather`
   `refining` variant; `startRefine` / `cancelRefine`; `tickGather` completes refines (in-place
   upgrade); `deliver` reward graded by `item_type`; `AZURA_REFINE_STATIONS` @ (33,33). Tier-1
   R1–R14 green (76 checks). *No UI, no wire change.*
2. **Protocol + WS** (`protocol.ts`, `index.ts`) — ✅ **done**: `refine_intent` (+ allowlist
   `parseClientMessage`), `refine_result` / `refine_progress` / `refine_completed`,
   `GatherStationPublic.kind`, `deliver_result.refined`, `already_refining`/`not_refinable`
   reject reasons; refinery placed behind `CHILL_ZONE_REFINE_ENABLED`; receipt folds
   `refined` + `refined_at_station`. WS harness extended with the S6 refine leg (Tier-2).
3. **Clients** — ✅ **done**: debug-client `GatherPanel` Refn action + amber `R` refinery marker
   (`gatherMapOverlays.ts`), `sendRefine`, refine handlers, keystone token count;
   `verify-gather-wire-authority.mjs` extended. Android `GatherHelpers.nearestRefineryStation`,
   `ActionButtons` Refn button, `GameStore` refine handlers, `ProtocolParityTest` (39 client /
   53 server). Web tsc + wire-authority verifier green; Android ParityTest runs in CI on push.
4. **Economy + Tem tuning** ([[economy-steward]], anti-cheat) — *next*: finalize `keystone_token`
   value (token-only; gold only if ever justified) and decide whether to emit `refine_cadence` heat.

---

## Rollback

Sub-flag **`CHILL_ZONE_REFINE_ENABLED`** (default off), independent of the already-live
`CHILL_ZONE_GATHER_ENABLED`. Off ⇒ no refinery station is placed and `refine_intent` rejects;
delivering raw motes still works (backward compatible). Nothing persists except past
`delivery_recorded` receipts, which remain valid history. Clean removal.

---

## Integration

- Up-references [[chill-zone-gather]]: this is the *Refine* beat inserted into the shipped
  *Recover → Return* micro-loop — still pre-Hour-1, still combat-free, still no tradeable
  economy. It graduates the loop from "pick up & hand in" to "pick up, improve, hand in" without
  touching any System Pillar balance surface (reward stays a non-economic acknowledgment).
- Sibling steps deferred: a **two-input refine** (combine two motes — needs held-slot >1, breaks
  the capacity-1 invariant) and a **quality roll** on refine (adds RNG + anti-cheat surface).
  Single-input, deterministic refine was chosen because it is verifiable with the existing
  movement + receipt + heat tooling and changes no shipped contract.

---

## Provenance

Authored in-session via the `gameplay-loop-designer` skill; **no source drop**. Grounded in the
**implemented** gather system — real symbols cited: `apps/server/src/world/gather.ts`
(`GatherSystem`, `HeldItem`, `startGather`, `deliver`, `tickGather`, `DEFAULT_GATHER_CONFIG`,
`AZURA_GATHER_NODES`, `AZURA_STATIONS`), `packages/shared/protocol.ts` (gather wire + reject
union), `apps/server/src/index.ts` (`gather_intent` / `deliver_intent` dispatch,
`DELIVERY_RECORDED_ACTION`, `TENDING_TOKEN_ID`, `applyHeatChange('gather_cadence')`),
`apps/server/tools/verify-gather-loop.test.ts` (WS harness). Refinery tile placement is the one
**unverified** seam — confirm a walkable Azura tile near the spawn cluster against
`packages/shared/maps/azura.json` ([[map-and-lore-builder]]) before coding.
