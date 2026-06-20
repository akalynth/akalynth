# Chill-Zone Gather — Design Page

Codex object: chill-zone-gather · Status: **MVP loop proposal** (authored in-session; no source drop)

> *"Before a player defends a city, they should be able to spend five quiet minutes being useful."*
> — Akalynth Design Notes (loop seed)

---

## Purpose

The smallest end-to-end Akalynth loop that is real gameplay, not a menu. A **no-combat
micro-loop** — move, gather a node, deliver to a station, receive a light acknowledgment —
designed to be **verified with existing movement and receipt tooling before any new system
is added**. It is the lowest-risk instance of the **Recover** verb from the
[[game-loop-bible]], and it deliberately excludes combat, party mechanics, and any
tradeable economy so the [[systems-bible]] pillars stay untouched.

It exists to answer one onboarding question: *what does a player do in their first quiet
minute in a chill zone, and how does the server prove they did it?*

**Design rule it enforces:** the client sends intent, never truth. Every outcome — what was
gathered, what is held, what reward is owed — is computed server-side. A client that lies is
simply wrong, not rewarded.

**Scope guard:** this page proposes an MVP loop. It invents no shipped mechanics; the
intent, snapshot, and receipt shapes below are **placeholders that must be reconciled with
the real game-server contracts** before implementation (see *Contract Verification Still
Required*).

---

## Player Action Loop

```text
Enter chill zone
  → see gather nodes (server-placed, shared, visible in zone snapshot)
  → move into interaction range of a node          [intent: move — exists]
  → send gather intent on that node                [intent: gather — NEW]
  → server runs a timed gather (T seconds, server-owned clock)
  → node yields one item into server-side inventory
  → move to a curation / drop station
  → send deliver intent at the station             [intent: deliver — NEW]
  → server consumes the item, grants a light reward, emits a receipt
  → node respawns after a cooldown; repeat
```

The client sends exactly **three intents** — `move`, `gather(nodeId)`, `deliver(stationId)`.
It never asserts "I gathered," "I am holding X," or "give me reward." A `gather` intent only
*starts* a gather; the server completes it on its own clock. A "done" message from the client
is ignored.

**Placeholder flavor** (final naming owned by [[map-and-lore-builder]] / content-designer):
zone = a quiet corner of the **High City Outskirts** first-playable area; node = a **Ley Mote
shimmer**; item = **Ley Mote**; station = **Curation Stand**; reward = a non-tradeable
**Tending Token** acknowledgment.

---

## Server State Touched

| State | Owner | Persistence | Notes |
|---|---|---|---|
| Node registry (`id, pos, type, state ∈ available/depleting/depleted, respawnAt`) | Zone (in-memory) | **Ephemeral** — resets on zone restart for MVP; no DB | Shared across all players in the zone |
| Per-player gather lock (`nodeId, startTick, completeTick`) | Player session | Ephemeral | Prevents parallel / instant gathers |
| Player inventory (`+1` gather item) | Player | **Reuses existing inventory** | Atomic add on complete, atomic consume on deliver |
| Reward grant | Player | Per economy rules | **Non-currency for MVP** — see *Anti-Cheat & Abuse* |

**No new persistence store is required** if (a) nodes may reset on zone restart and (b)
player inventory is already server-authoritative and persisted. If inventory is **not** yet
server-side, that is the real prerequisite — not this loop. → flag: persistence.

---

## Receipts Emitted

One receipt per completed cycle. Gather provenance is folded into the delivery receipt so the
chain stays lean — **one receipt per loop, not two**:

```jsonc
// delivery.recorded
{
  "player":  "<id>",
  "item":    "<gatherItemId>",
  "station": "<stationId>",
  "zone":    "<zoneId>",
  "source":  "<nodeId>",     // provenance: which node the item came from
  "reward":  "<rewardId>",
  "tick":    <serverTick>
}
```

A separate `gather.completed` receipt is **optional**, justified only if anti-cheat later
wants per-gather audit granularity; it is not needed for the MVP loop.

→ **Receipt-chain change:** new event type `delivery.recorded` — needs schema registration
and chain-verify coverage ([[receipt-chain-steward]]). Payload is flat and **ID-only**; no
free text originates from the client.

---

## Anti-Cheat & Abuse Risks

| Risk | Mitigation | Owner |
|---|---|---|
| **Teleport / speed to nodes** | Range check uses the server's position, not the client's. This loop is only as honest as server-authoritative movement — if movement is not yet validated, that is a hard prerequisite, not part of this loop. | movement / Rookguard |
| **Instant / replayed gather** | Server owns the timer. `gather` only starts a gather; the server auto-completes at `completeTick`. Client completion claims are ignored. | game-server |
| **Bot farming (core risk)** | The gather→deliver cycle is exactly what a bot does. Cadence regularity feeds **Tem heat**; after N cycles or on too-regular timing, Tem issues a challenge before the next reward grants. | anti-cheat / Tem |
| **Item dupe / double-deliver** | Inventory consumed atomically; deliver fails closed if the item is already spent. | game-server |
| **Reward inflation faucet** | **Reward is not currency in MVP** — a non-tradeable acknowledgment token. Natural rate limit = node respawn cooldown + per-player gather lock + optional per-cycle cap. | [[economy-steward]] |
| **Node contention / grief** | Shared node + per-player lock: the first valid gather claims it; others see `depleting`. Respawn cooldown prevents monopolizing. | game-server |
| **Receipt-chain spam** | Each delivery writes a receipt; a bot inflates the chain. Respawn cooldown bounds throughput; add a per-player deliver rate-limit if needed. | [[receipt-chain-steward]] |

**Net new system pressure:** this loop *uses* Tem and movement validation; it does not
require new anti-cheat machinery — it only needs to **emit heat signals** on the
gather/deliver cadence. → flag: anti-cheat.

---

## Protocol Changes (Call-Outs)

→ **protocol-guardian must sign off** — these touch the shared contract plus the Android and
debug-client consumers. All additive; no breaking changes to existing `move` / chat messages.

- **Client → server:** `gather { nodeId }`, `deliver { stationId }` (optionally `cancelGather`).
- **Server → client:** node array in the zone snapshot (`id, pos, type, state, respawnEta`),
  a `gatherProgress` field on the player entity, and the `delivery.recorded` push.

→ flag: protocol.

---

## Test / Playtest Path

**Tier 1 — server unit (no client):**
- Gather state machine: `start → timer → complete`; reject out-of-range; reject depleted node;
  reject a second concurrent gather.
- Deliver: consume-once; reject deliver with empty inventory; reward grant capped.

**Tier 2 — WebSocket integration (existing tooling, [[test-runner]]):**
1. Connect; confirm nodes appear in the zone snapshot.
2. Send `move` to a node, then `gather` → observe `gatherProgress` advance across snapshot
   diffs (proves the server-owned timer).
3. Attempt an early "done" / out-of-range gather → expect rejection.
4. `deliver` at the station → assert `delivery.recorded` appears in the chronicle and
   **chain-verify passes** ([[receipt-chain-steward]]).

**Tier 3 — playtest:**
- Two players, one node → confirm contention + respawn behave.
- Run the loop fast and regularly on purpose → confirm Tem heat rises and a challenge fires
  before reward.

---

## Recommended Build Order

Smallest verifiable step first; each step is independently shippable and reversible.

1. **Server-only:** node registry + gather/deliver state machine + `delivery.recorded`.
   Verify with Tier 1 + a scripted WS client. *No UI yet.*
2. **Protocol + debug-client:** expose nodes/progress in the snapshot, wire the two intents.
   Verify Tier 2.
3. **Tem heat hook** on cadence. Verify Tier 3.
4. **Reward definition** with [[economy-steward]] (token first; currency only if ever justified).

---

## Integration

- Up-references the [[game-loop-bible]]: this is the **pre-Hour-1** onboarding instance of the
  primary loop's *Recover → Return* beat, stripped to its smallest honest form. It does not
  grant reputation, profession progress, or access — those belong to the heavier loops.
- Up-references the [[systems-bible]]: by keeping the reward **non-economic** and **combat-free**,
  it touches none of the six System Pillars' balance surfaces; it is a presence/onboarding loop,
  not a progression loop.
- Sibling loops considered and deferred (heavier, more systems): an **Azura contract run**
  (adds NPC + reputation), a **Rookguard defend** loop (adds combat + group), and a **Tem
  challenge ritual** (adds anti-cheat UX). Chill-Zone Gather was chosen first because it is
  verifiable with existing movement + receipt tools before any of those systems land.

---

## Contract Verification Still Required

Before implementation, replace the placeholder shapes above with real game-server contract
names by confirming, in the game-server repo:

1. The existing **movement intent** message and whether server-side position is authoritative.
2. The **inventory** model — is it server-authoritative and persisted today?
3. The **receipt schema** registry — exact shape and registration path for a new
   `delivery.recorded` event.
4. The **Tem heat** signal interface — how a subsystem reports cadence/heat.
5. The **zone snapshot** structure — how entities/objects are serialized to clients.

Until these are confirmed, this page is a design proposal, not a build spec. It does not
deploy, does not mutate accepted state, and makes no external calls.

---

## Source & Provenance

- **Status:** authored in-session as an MVP gameplay-loop proposal via the
  `gameplay-loop-designer` skill. **No source drop** — this is net-new design, not a synthesis
  of an `AKALYNTH_*_V1` drop.
- **Grounded in:** [[game-loop-bible]] (Recover verb, primary loop, reward philosophy) and
  [[systems-bible]] (no-economy / no-combat scope guard, server-authority rule).
- **Runtime systems referenced (contracts unverified here):** movement, Rookguard, Tem,
  receipt chain, zone snapshot — see *Contract Verification Still Required*.

---

**Surface:** Served on the codex builder/operator surface (codex.akalynth.com + gated beta /operator); supersedes the removed akalynth-site public Codex page.
