# Runtime Architecture v1 — Living World Foundation

Status: **proposed engineering architecture**

Date: **2026-07-12**

Scope: server runtime, Android/server boundary, world time, scheduled
consequences, autonomous actors, receipt replay, and derived projections.

This document is an architecture contract and review surface. It does not add
gameplay mechanics, establish world canon, promote implementation to approval,
or change the v0.1 release claim boundary. The existing runtime remains the
implementation under review; the target portions below are proposals until
implemented and verified.

The reusable-template adoption question is tracked separately in the proposed
[`AKALYNTH_RUNTIME_ARCHITECTURE_TEMPLATE_V1`](./decisions/AKALYNTH_RUNTIME_ARCHITECTURE_TEMPLATE_V1/ADOPTION_PROPOSAL.md)
decision record. “Freeze” means preserve the boundary for future work; it does
not mean the implementation is complete or approved.

## 1. Architectural decision

Akalynth keeps one server-authoritative world-state path:

```text
Android / debug client
        │  intent only
        ▼
Protocol boundary
        │
        ▼
Authoritative server runtime
  ┌───────────────────────────────────────────────┐
  │ world clock → tick → validation → resolution  │
  │                         │                     │
  │             player or autonomous actor intent │
  └─────────────────────────┼─────────────────────┘
                            ▼
                   append-only receipt
                            │
             ┌──────────────┼──────────────┐
             ▼              ▼              ▼
       live projections   SQLite       Chronicle
             │                             │
             └──────────────┬──────────────┘
                            ▼
              player, Android, and Codex views
```

The rule is simple:

> Every world consequence enters through the same authoritative resolution and
> receipt path, regardless of whether its cause is a player intent, a scheduled
> consequence, or an autonomous actor.

The client may request and display. The server decides. A projection may
explain the world, but it does not become the source of truth merely because it
is convenient to read.

## 2. Authority and evidence labels

The design-provenance rules in
[`AKALYNTH_DECISION_RECORD_V1.md`](./AKALYNTH_DECISION_RECORD_V1.md) apply.
This document uses the following labels deliberately:

- **Observed:** behavior or structure present in the current repository.
- **Target:** the architecture this document proposes for future integration.
- **Open:** unresolved design questions; no implementation should silently
  answer them.
- **Evidence:** a verifier, source path, or fixture that demonstrates a named
  property. Evidence is not approval.

## 3. Current observed topology

The current runtime already proves important parts of the target path:

| Boundary | Current observed implementation | Assessment |
|---|---|---|
| Client → server | Shared protocol messages are handled by the server; the server validates intents and emits results. | **Observed / retained** |
| Intent → receipt | [`apps/server/src/skills/index.ts`](../apps/server/src/skills/index.ts) emits intent, rejection, and resolution receipts around skill handling. | **Observed / retained** |
| Runtime tick | [`apps/server/src/index.ts`](../apps/server/src/index.ts) drains bounded session queues and advances runtime systems on intervals. | **Observed / partial** |
| Receipt → projection | [`apps/server/src/persist/replay.ts`](../apps/server/src/persist/replay.ts) rebuilds in-memory projections and materializes SQLite state from JSONL receipts. | **Observed / retained** |
| Receipt → Chronicle | [`apps/server/src/persist/materializers.ts`](../apps/server/src/persist/materializers.ts) derives Chronicle rows from receipts. | **Observed / retained** |
| Causal shared-world view | [`apps/server/src/chronicle/sharedWorldObservation.ts`](../apps/server/src/chronicle/sharedWorldObservation.ts) reduces persisted causal rows into an observer view. | **Observed / retained** |
| Causal identity | [`packages/shared/causalParity.ts`](../packages/shared/causalParity.ts) distinguishes logical event identity, receipt identity, and parent/downstream links. | **Observed / retained** |
| Autonomous actor slice | [`apps/server/src/world/autonomousCaravan.ts`](../apps/server/src/world/autonomousCaravan.ts) reads persisted causal state and emits an idempotent Merchant Lora arrival receipt. | **Observed / partial** |
| Android boundary | Android sends protocol intents and consumes server projections; it is not an authority for world consequences. | **Observed / retained** |

The current gaps are architectural rather than a request for more mechanics:

1. `Date.now()`, `setInterval`, and `setTimeout` are used in several runtime
   paths instead of one named world-clock/scheduler contract.
2. Scheduled state is represented by system-specific fields such as
   `merchant_travel_due_at_ms` and `scheduled_close_ms`, plus process-local
   timers. There is no shared schedule identity and lifecycle contract.
3. The Forgehold caravan is the first autonomous actor, but there is no generic
   actor registry, hydration contract, or common actor wake-up interface.
4. Replay is intentionally non-executing, but live tick paths and replay paths
   are not yet expressed through one explicit type-level boundary.

## 4. World time

### 4.1 Target ownership

World time lives in the authoritative server runtime, not in Android, the
browser, Chronicle, or Codex.

Each live server tick should have one injected value conceptually equivalent to:

```ts
interface WorldTime {
  epoch: string;
  now_ms: number;
  tick: number;
}
```

The exact type and epoch policy remain an implementation decision. The
architectural requirements are fixed:

- one owner provides time to a tick;
- reducers and projections receive time as an argument rather than reading the
  process clock themselves;
- the same time value is used for all work in one tick;
- time-dependent state is represented by canonical due/recovery values;
- a live scheduler may emit a consequence, but replay never runs a scheduler;
- client clocks are presentation hints only and cannot authorize a consequence.

### 4.2 Clock categories

The runtime must distinguish these categories:

| Category | Allowed use | Authority |
|---|---|---|
| World time | Movement cadence, recovery, actor wake-up, scheduled consequences, deterministic projections. | Server `WorldClock` |
| Receipt time | Audit chronology and signing metadata. | Receipt writer / server |
| Wall time | Transport TTLs, process health, operational metrics, and expiry policies explicitly defined as wall-clock behavior. | Server process |
| Client time | Countdown presentation and latency estimation. | Never authoritative |

Wall time is not automatically world time. A system must state which category it
uses. A reducer that silently compares a receipt timestamp with the process
clock is an architectural defect.

### 4.3 Restart and pause boundary

The current v0.1 implementation contains both process-local timers and
receipt-backed due timestamps. It must not claim a single persistent-world time
model until the following questions are decided:

- Does world time advance while the server is offline?
- Is the epoch durable, or is each process a new simulation epoch?
- Are overdue consequences caught up immediately, at a bounded rate, or not at
  all after restart?
- Is there one world-clock owner if more than one runtime process exists?

Until those decisions are recorded, a runtime feature must document its restart
behavior as `resume`, `catch_up`, `reset`, or `not_applicable`.

## 5. Minimum scheduler contract

The scheduler is an execution mechanism, not a second source of truth.

### 5.1 Schedule record

Every scheduled consequence needs a stable identity and an owning event:

```ts
interface ScheduledConsequence {
  schedule_id: string;
  owner_event_instance_id: string;
  consequence_type: string;
  due_at_ms: number;
  payload_version: number;
  status: 'pending' | 'cancelled' | 'emitted';
}
```

This is a minimum contract, not a mandate for these exact field names. A valid
implementation must also preserve:

- deterministic ordering for equal due times;
- an idempotency key derived from `schedule_id`;
- cancellation or supersession semantics;
- a declared restart policy;
- a receipt-visible link from the schedule owner to the emitted consequence.

### 5.2 Live execution

The live path is:

```text
receipt-backed schedule state
        ↓
WorldClock.now_ms reaches due_at_ms
        ↓
Scheduler selects due records in stable order
        ↓
Actor/system emits an authoritative command
        ↓
normal validation and resolution path
        ↓
one consequence receipt with event_instance_id
        ↓
projection + Chronicle + client/Codex views
```

The scheduler must not mutate a projection directly. It may only submit a
server-owned command to the same resolution path used by player actions.

### 5.3 Replay behavior

Replay consumes the receipts already emitted by the live scheduler. It does not
re-run due checks, timers, actor behavior, broadcasts, or random decisions.

This prevents a restart from creating a duplicate consequence and keeps replay
deterministic. If a scheduled consequence is missing, the verifier must expose
the missing receipt; replay must not invent it silently.

## 6. Autonomous actor contract

Autonomous actors are server-owned intent producers. They are not privileged
reducers and they are not simulated clients.

### 6.1 Required actor shape

Each actor implementation should be expressible through a registry entry with
these responsibilities:

```text
register → hydrate from canonical state → inspect world time
        → decide next command → emit through authority path
        → observe resulting receipt → await next wake-up
```

The minimum registry metadata is:

- stable `actor_id`;
- actor kind and behavior version;
- owned world or location scope;
- wake/schedule source;
- projection hydration function;
- command/emission function;
- idempotency key derivation;
- restart policy;
- receipt and Chronicle linkage.

### 6.2 Actor invariants

1. An actor cannot write world state without an accepted receipt.
2. The actor's identity is distinct from the player who caused the upstream
   event.
3. A downstream event carries `parent_event_id` and a unique
   `event_instance_id`.
4. Repeating an actor scan with the same canonical state and time emits no
   duplicate consequence.
5. Actor behavior version is observable so a later behavior change cannot make
   historical receipts ambiguous.
6. Replay hydrates actor-relevant projections but does not execute actor code.

The current Forgehold caravan actor satisfies the important first slice of this
contract: it is clock-injected, reads persisted causal rows, and uses the
emitted arrival receipt as its idempotency marker. It is a slice proof, not yet
a generic actor framework.

## 7. Event, replay, and projection boundaries

### 7.1 Canonical event path

All causes use this conceptual path:

```text
player intent | actor command | scheduled command
        ↓
server validation and anti-cheat / authority checks
        ↓
resolution result
        ↓
append signed/hash-linked receipt
        ↓
receipt reducers and materializers
        ↓
live state, SQLite, Chronicle, and protocol views
```

Rejected intents may be recorded for evidence, but they must not create a world
consequence. Accepted consequences must not bypass the receipt writer.

### 7.2 Identity rules

- `event_id` is the stable logical event identity used for player-facing
  mapping and domain meaning.
- `event_instance_id` identifies one occurrence in a causal chain and is the
  idempotency boundary for downstream effects.
- `parent_event_id` explains causation; `downstream_event_ids` exposes known
  successors.
- Receipt hash and receipt sequence identify the canonical evidence record.
- Chronicle row IDs are projection-local and must not become event identity.

These rules preserve the causal-parity and Merchant Lora proof without coupling
world truth to a particular projection database.

### 7.3 Replay contract

Startup/rebuild must:

1. require the canonical receipt source, failing closed when history is absent
   or truncated;
2. validate and process receipts in canonical chain order;
3. clear or replace in-memory projections before a full rebuild;
4. materialize only the required database suffix during incremental replay;
5. rebuild all receipt-derived projections from the same source;
6. restore runtime indexes without emitting broadcasts or new receipts;
7. report the resulting receipt head and projection counts.

The replay result is a reconstruction. It is not a new simulation run.

### 7.4 Projection audiences

| Projection | Audience | Rule |
|---|---|---|
| Live world state | Server runtime and nearby clients | Derived from accepted server decisions. |
| SQLite materialization | Runtime restart and verifiers | Durable mirror; never a substitute for missing receipt history. |
| Chronicle | Evidence and historical explanation | Projection-local index linked to receipt hashes. |
| Shared-world observation | Other players and Codex-style observers | Causal, redacted, and derived; no authoring authority. |
| Android view | Player device | Presentation of server-owned state and causal feedback. |
| Codex view | Studio/operator/agent surfaces | Observe, explain, diagnose, then author through a separately gated path. |

Codex must not write runtime truth directly. A future authoring action must
become a reviewed server command or a separate draft/projection operation with
its own authority boundary.

## 8. Android and server boundary

The Android client is a transport and presentation participant:

- it sends typed intent messages;
- it may render local countdowns and optimistic UI, but must reconcile with the
  server response;
- it does not choose world time, schedule consequences, resolve actor behavior,
  mint durable items, or append Chronicle truth;
- it consumes explicit server fields for recovery, causal explanation, and
  projection state;
- protocol changes require shared-type updates and parity verification.

The server remains authoritative for both the happy path and reconnect path.
An offline Android screen is not evidence that a world consequence occurred.

## 9. Invariants for future systems

Every new world system must answer these questions before implementation is
accepted:

1. What is the authoritative command or intent?
2. Which world-time category does it use?
3. What receipt records acceptance, rejection, and consequence?
4. What is the stable logical event identity?
5. What is the per-occurrence idempotency identity?
6. Which projection rebuilds it, and from which receipt fields?
7. What happens across disconnect and process restart?
8. Does replay produce the same projection without running live effects?
9. Which fields may cross the Android/public/Codex boundary?
10. Which verifier or proof artifact demonstrates the contract?

If any answer is unknown, the system is a proposal or an implementation gap,
not a completed persistent-world capability.

## 10. Verification plan

The first architecture pass is documentation plus focused verification; it
does not require gameplay changes.

### Existing evidence to retain

- Server TypeScript build and the repository verification spine.
- Causal parity and shared-world observation proof.
- Fishing → caravan → autonomous actor → Chronicle → replay proof.
- Strict receipt/Chronicle chain and lifecycle checks.
- Protocol synchronization checks when Android/shared messages change.

### Reference proof: Merchant Lora

The smallest concrete implementation of this architecture is already present
in [`verify-fishing-caravan-events.test.ts`](../apps/server/tools/verify-fishing-caravan-events.test.ts).
It is a reference proof, not a generic scheduler implementation. The proof
asserts that:

1. the caravan guard decision records a Merchant Lora due time from injected
        world time;
2. the actor does not arrive before the due time;
3. reaching the due time emits exactly one actor-owned arrival receipt;
4. the arrival consumes the pending consequence and restocks the route;
5. the arrival preserves `event_instance_id` and `parent_event_id` causal links;
6. Chronicle and the shared-world observation expose the same resulting state
        to a second observer;
7. clearing projections and replaying receipts restores the same state without
        emitting a duplicate arrival.

This closes the first living-world experiment without claiming that the whole
runtime has a generic scheduler or persistent-world time model.

### Architecture closure criteria

The runtime architecture can move from **proposed** to **implemented and
verified** only when the following are true:

- one injected world clock is used by all scheduled-consequence paths in scope;
- one scheduler contract covers at least the existing caravan and auction
  patterns without changing their gameplay outcomes;
- actors hydrate from canonical projections and emit through the normal authority
  path;
- repeated scans are idempotent by event instance identity;
- replay never emits new receipts, broadcasts, or actor consequences;
- a restart/catch-up policy is recorded for every scheduled system;
- Android protocol behavior remains compatible and parity checks pass;
- focused verifier output is captured for a named build or commit.

### Suggested order of implementation

1. Define the clock and scheduler interfaces without changing behavior.
2. Adapt the Forgehold caravan as the reference actor.
3. Adapt one existing scheduled system, preferably the property auction close
   path, and prove identical receipts/projections.
4. Add a verifier for live-vs-replay separation and duplicate suppression.
5. Migrate remaining timers only when their restart policy is explicitly known.

## 11. Open decisions

These are intentionally not resolved by this architecture document:

- persistent world epoch and offline advancement;
- multi-process ownership/lease for the world clock;
- scheduler catch-up limits and failure recovery;
- schedule cancellation and behavior-version migration;
- whether player position and combat timers persist in v0.2;
- whether an actor can span maps or must be partitioned by world scope;
- Codex authoring authority and review-gated mutation protocol.

No implementation should treat these open questions as settled canon or release
guarantees.

## Safe summary

The runtime foundation is already strong enough to prove the important causal
path. The next architectural task is not another mechanic. It is a single
entry contract for time, schedules, autonomous actors, receipts, replay, and
projections so future mechanics cannot bypass server authority or create a
second definition of world truth.