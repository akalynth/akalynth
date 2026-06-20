# Chill-Zone Gather — Step 1 Server Task Spec

Task spec for **Build-Order Step 1** of [[chill-zone-gather]]. Server-only slice: node
registry + gather/deliver state machine + `delivery.recorded` receipt. **No client UI, no
economy, no full-inventory dependency.** Verified by Tier-1 unit tests and a scripted
WebSocket client.

Status: **proposal** · Owners: game-server-steward (build) · protocol-guardian (additive wire
messages) · receipt-chain-steward (receipt registration). Reward/economy explicitly **out**
(step 4).

---

## 0. Objective

Make the loop **move → gather(node) → deliver(station) → receipt** real and honest on the
server alone. A scripted WS client must be able to drive it and observe a verifiable
`delivery.recorded` in the chronicle. A lying client must gain nothing.

**In scope:** node registry, node + gather state machines, server-authoritative validation,
ephemeral held-item slot, `delivery.recorded` emission, minimal observability fields.
**Out of scope:** debug-client/Android UI (step 2), Tem heat wiring (step 3 — stub the hook
only), reward grant / economy (step 4), full inventory system, persistence across restart.

---

## 1. Contracts to bind first (`BIND` seams)

This spec is behaviorally complete but contract-pending. Resolve these against the real
game-server before coding; replace each `BIND:` with the actual symbol/path:

| Seam | What to confirm | `BIND:` |
|---|---|---|
| Tick loop | Server tick rate (ticks/sec) and where per-zone update runs | `BIND:tickRate`, `BIND:zoneTick` |
| Intent dispatch | How inbound client messages are routed to handlers | `BIND:commandDispatch` |
| Player position | Server-authoritative position accessor (source of truth) | `BIND:player.pos` |
| Zone snapshot | Serializer that emits entity/object state to clients | `BIND:snapshot` |
| Receipt emit | Call + schema registration for a new receipt type | `BIND:emitReceipt`, `BIND:receiptSchemaRegistry` |
| Tem heat | Signal interface for cadence/heat (hook only, no-op here) | `BIND:temHeat` |

All new wire messages and snapshot fields below are **additive and feature-flagged**; they
must not alter existing `move`/chat behavior. Protocol-guardian signs off even on additive
shapes.

---

## 2. Configuration

Zone-scoped config with MVP defaults (express durations in seconds; convert to ticks via
`BIND:tickRate`). Reward is recorded-only in step 1.

| Key | Default | Notes |
|---|---|---|
| `gatherDurationSec` | `3` | Server-owned gather time `T` |
| `respawnCooldownSec` | `30` | DEPLETED → AVAILABLE delay |
| `interactionRangeUnits` | `2.0` | Reuse existing interact constant if one exists (`BIND`) |
| `nodesPerZone` | `4` | Static placements per chill zone |
| `gatherItemId` | `"ley-mote"` | Placeholder (content-designer owns final id) |
| `stationIds` | `["curation-stand-1"]` | Static station placements |
| `rewardId` | `null` | **No reward credited in step 1** (step 4 sets this) |
| `featureFlag` | `CHILL_ZONE_GATHER_ENABLED` | Default **off** |

---

## 3. Data model

```text
NodeState = AVAILABLE | DEPLETING | DEPLETED

GatherNode {
  id            : string          // unique within zone
  pos           : Vec             // server-authoritative placement
  itemId        : string          // = config.gatherItemId
  state         : NodeState       // starts AVAILABLE
  claimantId    : PlayerId | null // set while DEPLETING
  completeTick  : int    | null   // gather completion tick, while DEPLETING
  respawnTick   : int    | null   // AVAILABLE-again tick, while DEPLETED
}

Station { id: string, pos: Vec }

PlayerGather {                    // per-player, ephemeral (in-session)
  state     : IDLE | GATHERING
  nodeId    : string | null       // while GATHERING
  startTick : int    | null
  completeTick : int | null
}

HeldSlot = null | { itemId: string, sourceNodeId: string }   // capacity 1
```

The held slot is **ephemeral**: cleared on disconnect. This is intentional for step 1 — it
removes the dependency on inventory persistence. (Loss on disconnect mid-loop is acceptable;
re-gather is cheap.)

---

## 4. State machines

### 4.1 Node lifecycle

| From | Trigger | Guard | To | Effect |
|---|---|---|---|---|
| AVAILABLE | valid `gather` claim | §5.1 passes | DEPLETING | set `claimantId`, `completeTick = now + T` |
| DEPLETING | tick reaches `completeTick` | — | DEPLETED | yield item to claimant held slot; set `respawnTick = now + cooldown`; clear claim |
| DEPLETING | claimant disconnect / cancel / leaves range | — | AVAILABLE | release; **no yield** |
| DEPLETED | tick reaches `respawnTick` | — | AVAILABLE | clear `respawnTick` |

### 4.2 Player gather

| From | Trigger | Guard | To | Effect |
|---|---|---|---|---|
| IDLE | valid `gather` | §5.1 passes | GATHERING | set `nodeId`, `startTick`, `completeTick` |
| GATHERING | node completes (§4.1) | — | IDLE | held slot ← `{itemId, sourceNodeId}` |
| GATHERING | disconnect / cancel / out of range | — | IDLE | release node (§4.1); no held item |

### 4.3 Per-tick processing order (deterministic)

```
for each enabled chill zone, each server tick:
  1. drain queued intents  → validate + apply (§5)
  2. complete due gathers  → DEPLETING nodes with now >= completeTick (§4.1)
  3. respawn due nodes     → DEPLETED nodes with now >= respawnTick (§4.1)
  4. emit snapshot fields  (§6)
```

All mutation happens inside the authoritative tick loop — no concurrent state access, so the
"atomic" requirements below are structural, not lock-based.

---

## 5. Intent handlers (server-authoritative)

Two additive inbound messages. Every field is validated; the client is never trusted.

### 5.1 `gather { nodeId }`

Reject (no state change) with the first failing reason:

| Order | Check | Reject code |
|---|---|---|
| 1 | node exists in player's zone | `NODE_NOT_FOUND` |
| 2 | `node.state == AVAILABLE` | `NODE_NOT_AVAILABLE` |
| 3 | `dist(BIND:player.pos, node.pos) <= interactionRange` | `OUT_OF_RANGE` |
| 4 | player gather `state == IDLE` | `ALREADY_GATHERING` |
| 5 | held slot empty | `HELD_SLOT_FULL` |

On pass → node `AVAILABLE→DEPLETING`, player `IDLE→GATHERING` (§4).

### 5.2 `deliver { stationId }`

| Order | Check | Reject code |
|---|---|---|
| 1 | station exists in player's zone | `STATION_NOT_FOUND` |
| 2 | `dist(BIND:player.pos, station.pos) <= interactionRange` | `OUT_OF_RANGE` |
| 3 | held slot non-empty | `HELD_SLOT_EMPTY` |

On pass → consume held slot (set `null`) and emit exactly one receipt (§7). **No reward
credit.**

### 5.3 `cancelGather {}` (optional)

If player `GATHERING` → release node to AVAILABLE, player → IDLE, no yield. Always safe.

---

## 6. Observability (minimal, additive)

So the scripted WS client (and later real clients) can assert server truth. All additive,
behind the feature flag, via `BIND:snapshot`:

- **Node registry** in the zone snapshot: `[{ id, pos, state, respawnEta }]`.
- **`gatherProgress`** on the gathering player's entity:
  `clamp((now - startTick) / (completeTick - startTick), 0, 1)`. Computed server-side every
  tick — this is what proves the timer is server-owned.
- **Reject responses** carry the §5 reason code (so tests can assert *why* an intent failed).

---

## 7. Receipt: `delivery.recorded`

Emitted exactly once per successful `deliver` via `BIND:emitReceipt`. Register schema in
`BIND:receiptSchemaRegistry`.

```jsonc
{
  "type":    "delivery.recorded",
  "player":  "<id>",
  "item":    "<gatherItemId>",
  "station": "<stationId>",
  "zone":    "<zoneId>",
  "source":  "<sourceNodeId>",   // provenance from the consumed held item
  "reward":  null,               // step 1: no reward credited; step 4 populates
  "tick":    <serverTick>
}
```

ID-only, flat, no client-originated free text. Must pass chain-verify.

---

## 8. Invariants (must always hold)

- **I1** A held item exists only as the result of a server-completed gather. No client message
  can inject one.
- **I2** A node yields at most once per claim and is DEPLETED until `respawnTick`.
- **I3** ≤ 1 active gather per player; ≤ 1 claimant per node.
- **I4** `deliver` consumes exactly one held item and emits exactly one receipt; a repeat
  deliver on an empty slot emits none.
- **I5** All range checks use `BIND:player.pos` (server truth), never client-reported position.
- **I6** No economic credit in step 1 (`reward: null`); no balance/inventory mutation beyond
  the ephemeral held slot.

---

## 9. Anti-cheat hook (stub only)

Add a single call site at successful `deliver` and successful gather-complete:
`BIND:temHeat.signal(playerId, "chill_gather_cycle")`. **No-op / disabled in step 1** — the
seam exists so step 3 wires cadence/heat without re-touching the loop.

---

## 10. Acceptance criteria

### Tier 1 — server unit (no client)

| # | Scenario | Assert |
|---|---|---|
| U1 | gather: AVAILABLE node, in range, IDLE, empty slot | node DEPLETING; player GATHERING; `completeTick == now + T` |
| U2 | tick reaches `completeTick` | node DEPLETED; `respawnTick` set; player IDLE; held slot = node item |
| U3 | gather out of range | `OUT_OF_RANGE`; no state change |
| U4 | gather on DEPLETING/DEPLETED node | `NODE_NOT_AVAILABLE` |
| U5 | gather while already GATHERING | `ALREADY_GATHERING` |
| U6 | gather with full held slot | `HELD_SLOT_FULL` |
| U7 | tick reaches `respawnTick` | node DEPLETED → AVAILABLE |
| U8 | claimant disconnect mid-gather | node → AVAILABLE; no yield; player IDLE |
| U9 | deliver: held item, in station range | slot empty; **exactly one** `delivery.recorded`; `reward == null` |
| U10 | deliver with empty slot | `HELD_SLOT_EMPTY`; **no** receipt |
| U11 | deliver out of station range | `OUT_OF_RANGE`; no receipt |
| U12 | double-deliver (second after slot emptied) | `HELD_SLOT_EMPTY`; total receipts still 1 |
| U13 | receipt content | fields match §7; `reward == null`; passes chain-verify |

### Tier 2 — scripted WS client (real server, no UI)

| # | Steps | Assert |
|---|---|---|
| S1 | connect | node registry present in snapshot |
| S2 | move to node → `gather` | `gatherProgress` advances 0→1 across ticks |
| S3 | `gather` early / out of range | rejected with correct code |
| S4 | after complete → move to station → `deliver` | `delivery.recorded` in chronicle; chain-verify passes |

**Definition of done:** all U1–U13 + S1–S4 green; feature flag default-off; no change to
existing `move`/chat contracts; no balance/inventory writes; receipt schema registered and
chain-verifies.

---

## 11. Rollback

Single zone-scoped flag `CHILL_ZONE_GATHER_ENABLED` (default off). Disabling halts node spawns
and rejects the new intents; nothing persists, so removal is clean. The only durable artifact
is past `delivery.recorded` receipts, which remain valid history.

---

**Provenance:** Tightens Build-Order Step 1 of [[chill-zone-gather]] into a build packet.
In-session proposal; no source drop. Contracts in §1 unverified — confirm before coding.
