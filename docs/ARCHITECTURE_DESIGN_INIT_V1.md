# Akalynth Core Architecture Design Document

**Title:** Akalynth Runtime, Authority Model, World Time, Scheduling, Receipts, and Client-Server Boundary  
**Author:** Systems Architect (placeholder)  
**Date:** 2026-07-12  
**Status:** Draft  
**Version:** 1.0 (initial formalization)  
**Scope:** Canonical capture of observed architecture plus target refinements for runtime, authority, anti-cheat, receipts, and related concerns. Grounded in source as of 2026-07-12.

---

## Overview

Akalynth is a server-authoritative social MMO prototype. All world state transitions originate from client *intents* (never client state assertions), are validated and resolved exclusively in the server runtime, and are durably recorded as append-only, hash-chained, signed receipts. The receipts form the sole canonical history; in-memory world state, SQLite projections, and Chronicle are derived projections that must be fully reconstructible via replay.

The design enforces a strict client-server boundary: `apps/debug-client` (React/TS) and `apps/android` (Kotlin) are presentation and transport participants only. The authoritative implementation lives in `apps/server/src/` (TypeScript), with shared contracts in `packages/shared/` (protocol, types, maps, constants) and core receipt/identity primitives in `packages/coordination-kernel/`.

Core mechanisms include:
- Fixed 100 ms tick loop (`TICK_MS` in `packages/shared/constants.ts`) with per-session intent queues that are drain-bounded (≤25 messages processed per invocation of `processSessionQueue`).
- Receipt logger (`packages/coordination-kernel/src/receipt/logger.ts`) producing BLAKE3-hashed, Ed25519-signed chain entries with `prev_hash` linkage and `fsync` before projection callbacks.
- Anti-cheat pipeline (detector + heat + Tem challenges + witness quorum) that is itself receipt-backed for persistence across reconnects.
- Partial world-time and scheduling primitives (injected `now` in select paths; ad-hoc `setInterval` + due-time checks elsewhere).
- Public receipts surface (`/v1/receipts/public`) that is deliberately delayed, redacted, and bucketed.

This document structures the existing observed system (per `docs/ARCHITECTURE.md`, `docs/RUNTIME_ARCHITECTURE_V1.md`, `docs/AKALYNTH_DECISION_RECORD_V1.md`, `apps/server/docs/CIVIL_GUARANTEES.md`, and live source) into a canonical design with explicit Key Decisions and a staged PR Plan.

---

## Background & Motivation

The current implementation has proven the core authority and audit invariants through play, verification harnesses (`scripts/verify*`, `apps/server/tools/verify-*.ts`), and receipt-driven features (fishing → caravan autonomous actor, gather, property auctions, heat persistence, etc.).

**Pain points observed in code and docs:**
- Multiple direct uses of `Date.now()` and `setInterval`/`setTimeout` (e.g., the main `setInterval(TICK_MS)` game loop in `apps/server/src/index.ts` plus secondary intervals for decay, mob respawn, auction/caravan 1s scans via `last*ScanMs` checks) create inconsistent time sources and restart semantics. `RUNTIME_ARCHITECTURE_V1.md` explicitly calls this out as an architectural gap.
- Scheduling (auction close in `world/auction-loop.ts`, caravan in `world/autonomousCaravan.ts`, gather ticks in `world/gather.ts`, death respawn, heat decay) is duplicated and not expressed through a single scheduler contract with declared restart/catch-up policy.
- World state (`apps/server/src/world/state.ts`) and many enforcement states (heat, anti-cheat runtime, witness requests, echoes, caps, sovereign) are purely in-memory; only a subset survive restart via receipt replay + materializers (`persist/replay.ts`, `persist/materializers.ts`).
- Client-server contract (`packages/shared/protocol.ts: PROTOCOL_VERSION = '2.1.0'`) mixes legacy guest tokens with signed tokens; Android parity must be maintained mechanically (`verify-android-client-update.test.ts`).
- Anti-cheat (detector.ts, tem.ts, world/heat.ts, witness.ts) mixes in-memory signals with durable heat/penalty receipts; witness quorum is intentionally in-memory (acceptable given TTLs) but requires explicit documentation.
- Public receipt redaction and delay logic (`audit/public_receipts.ts`, `audit/reader.ts`) is production-facing and must remain stable.
- Governance requires explicit provenance: `AKALYNTH_DECISION_RECORD_V1.md` + Civil Guarantees G1–G15 (`apps/server/docs/CIVIL_GUARANTEES.md`) + `GOVERNANCE_INVARIANTS.md`. Implementation existence does not equal approval.

Motivation for formalization: provide a single reviewable artifact that (a) records what is already true, (b) surfaces the target architecture from `RUNTIME_ARCHITECTURE_V1.md`, and (c) decomposes remaining work into independently reviewable PRs.

---

## Goals & Non-Goals

### Goals
- Capture the observed runtime (tick, authority, receipt chain, anti-cheat) as the current baseline with file-level precision.
- Define target contracts for World Time, Scheduler, and Autonomous Actor (per `RUNTIME_ARCHITECTURE_V1.md` sections 4–6) without changing existing gameplay outcomes.
- Establish clear client-server boundary rules and protocol stability requirements.
- Produce a concrete, ordered PR Plan that yields reviewable increments.
- Document security, observability, rollout, and risks explicitly.

### Non-Goals
- Introduce new gameplay mechanics, economy rebalances, or map content.
- Change receipt schema or hash/signing algorithm (BLAKE3 + Ed25519).
- Claim persistent-world epoch semantics or offline time advancement (open decisions in RUNTIME_ARCHITECTURE_V1).
- Replace the custom WS loop with Colyseus or similar (post-MVP only).
- Alter Civil Guarantees G1–G15 or governance authority model.
- Provide implementation code or change current behavior in this document.

---

## Proposed Design

### High-Level Authority Flow

```mermaid
flowchart TD
    subgraph Client["Client (debug-client / Android)"]
        C1[Send typed intent<br/>e.g. move_intent, use_skill, chat]
    end
    subgraph Server["Authoritative Server<br/>apps/server/src/index.ts"]
        S1[WS Accept + Session Queue<br/>drain-bounded (≤25 msgs/tick via processSessionQueue);<br/>queue itself currently unbounded]
        S2[Per-tick processing<br/>processSessionQueue + tick handlers]
        S3[Validation<br/>movement.ts, anticheat/, caps, heat, witness]
        S4[Resolution + State Mutation<br/>world/* + skills/]
        S5[Audit Write<br/>audit.write → coordination-kernel receipt logger]
    end
    subgraph Projections["Derived Projections (never truth)"]
        P1[In-memory (WorldState, HeatState, AntiCheatRuntime, etc.)]
        P2[SQLite materialization<br/>persist/materializers.ts + schema.ts]
        P3[Chronicle (sharedWorldObservation)]
    end
    subgraph Audit["Append-Only Receipt Chain"]
        R1[receipts.jsonl<br/>prev_hash | event_hash (blake3) | Ed25519 sig<br/>fsync before onWrite]
    end

    C1 --> S1
    S1 --> S2
    S2 --> S3
    S3 --> S4
    S4 --> S5
    S5 --> R1
    R1 --> P1
    R1 --> P2
    R1 --> P3
    S2 -.->|broadcast deltas / snapshots| C1
```

### Tick Loop (Current Observed)

The main game loop uses `setInterval(..., TICK_MS)` with `processSessionQueue` for intent draining (max 25 per call). Per-session queues have no length cap today.

```mermaid
sequenceDiagram
    participant Tick as setInterval(..., TICK_MS)<br/>main game loop in index.ts (after AUCTION_SCAN_*)<br/>(calls processSessionQueue)
    participant Queue as per-Session queue (drain-bounded ≤25/tick; currently unbounded length)
    participant Proc as processSessionQueue
    participant Val as Validation + AntiCheat
    participant Apply as Resolution
    participant Audit as audit.write (receipt)
    participant Proj as onWrite projections + broadcasts

    loop Every 100ms
        Tick->>Queue: drain ≤25 messages (while loop in processSessionQueue)
        Queue->>Proc: msg + now (injected WorldTime in target)
        Proc->>Val: onMoveIntent / chat / skill / etc. (may use inner Date.now() for wall-time paths like login token verify)
        Val->>Apply: tryMove / handleUseSkill / applyDeath / ...
        Apply->>Audit: {actor_id, action, inputs, result}
        Audit->>Audit: appendReceiptSync (chain, hash, sign, fsync)
        Audit->>Proj: onWrite callbacks (identity, treasury, heat, property, ...)
        Proj->>Tick: broadcastToMap / sendWorldStateRefresh
    end
```

Key sites (function/variable names are the stable references; line numbers approximate and may drift with edits):
- Main game loop: the `setInterval(..., TICK_MS)` at the base of the main tick handler in `apps/server/src/index.ts` (immediately after `AUCTION_SCAN_INTERVAL_MS` / `AUTONOMOUS_WORLD_SCAN_INTERVAL_MS` definitions; invokes `processSessionQueue` for each session).
- Queue processing: `processSessionQueue` (drains messages, handles dead state + Tem timeouts + per-message dispatch using an inner `msgNow = Date.now()` for select paths like token verification).
- Now injection sites (partial): `settleDueAuctions(nowMs, ...)`, `advanceForgeholdCaravanActor(rows, nowMs, ...)`, `tickGather(..., nowMs)`.
- Secondary timers (outside or throttled within main loop): auction/autonomous 1s scans via `last*ScanMs`, `DECAY_TICK_MS`, legendary heat decay, mob respawn/aggro intervals, guest prune.
- Constants: `TICK_MS`, `MIN_MOVE_INTERVAL_MS` in `packages/shared/constants.ts`.
Note: All citations reflect source as of the 2026-07-12 workspace state. Prefer names over numbers for longevity.

### Receipt Chain & Persistence

Receipts (`AuditReceipt` in `packages/shared/types.ts:340`, `CoordinationReceipt` in `packages/coordination-kernel/src/types.ts`) are the only durable truth.

```ts
// Simplified from coordination-kernel/src/receipt/logger.ts:100
const receiptBody = { sequence, timestamp, prev_hash, actor_id, action, inputs, result, inputs_hash, outputs_hash };
const event_hash = computeEventHash(receiptBody);  // blake3(canonicalJson)
const signature = signEvent(prev_hash, event_hash, key);
... fs.writeSync + fs.fsyncSync ...
config.onWrite?.(fullReceipt, offset);  // triggers applyReceiptTo* + materialize
```

- Replay: `persist/replay.ts` (strict mode, marker + _meta, clears projections then rebuilds).
- Materializers: `persist/materializers.ts` (idempotent, item_id derivation via `generateItemId`, chronicle dedup indexes).
- Guarantees: G1–G4 (canonical, deterministic BLAKE3, fsync-before-project, idempotent replay). Enforced by `apps/server/tools/verify-guarantees.ts`.

Public feed (`audit/public_receipts.ts`): bucketed coords (`PUBLIC_RECEIPTS_BUCKET_SIZE=8`), actor redaction (`anon` or `daily_hash`), delay + jitter, action allow-list via `PUBLIC_RECEIPTS_ALLOW`.

### World Time, Scheduling, and Actors (Target + Observed)

Observed: clock injection is partial and path-specific.
- `settleDueAuctions(nowMs, write)` in `world/auction-loop.ts` — never calls `Date.now()` internally (injected by caller in main tick).
- `advanceForgeholdCaravanActor(rows, nowMs, write)` in `world/autonomousCaravan.ts` — reads causal rows, uses injected now; idempotent via emitted receipt as marker.
- Gather (`tickGather` in `world/gather.ts`), death, heat decay, witness TTL use `Date.now()` inside tick or dedicated intervals.

Target (from `RUNTIME_ARCHITECTURE_V1.md`; refined here for implementability):

```ts
// packages/shared/world-clock.ts (new in PR-01)
export interface WorldTime {
  epoch: string;      // e.g. process start or durable future epoch
  now_ms: number;     // injected snapshot for the tick
  tick: number;       // monotonic tick counter (stable within epoch)
}

export function createWorldClock(initialEpoch?: string): WorldTimeProvider { ... }

// packages/shared/scheduler.ts (new in PR-02)
export interface ScheduledConsequence {
  schedule_id: string;
  owner_event_instance_id: string;  // links to originating receipt/event
  consequence_type: string;
  due_at_ms: number;
  payload_version: number;
  status: 'pending' | 'cancelled' | 'emitted';
}

export interface Scheduler {
  register(consequence: ScheduledConsequence): void;
  cancel(schedule_id: string): void;
  // processDue is called once per main tick with the *same* WorldTime snapshot
  // used by gather/death/etc. Must be idempotent; emits via normal authority path only.
  processDue(wt: WorldTime, emit: (c: ScheduledConsequence) => void): ScheduledConsequence[];
  // Idempotency: caller derives stable key from (owner_event_instance_id + consequence_type)
}
```

**Example integration wiring (inside main `setInterval(TICK_MS)` callback in index.ts, to be introduced by PRs 01-05):**

```ts
setInterval(() => {
  const now = Date.now();  // temporary, replaced by wt
  const wt = worldClock.now();  // PR-01: single source for tick
  // ... existing witness cleanup, processSessionQueue(s, wt.now_ms) ...

  if (gatherSystem) {
    const effects = tickGather(gatherSystem, wt.now_ms);  // pass injected time
    ...
  }

  // PR-02/03/04: replace ad-hoc last*ScanMs + direct calls
  if (wt.now_ms - lastAuctionScanMs >= AUCTION_SCAN_INTERVAL_MS) {
    lastAuctionScanMs = wt.now_ms;
    const settlements = scheduler.processDue(wt, (c) => {
      // or direct for legacy during migration
      const st = settleDueAuctionsForConsequence(c, (r) => audit.write(r));
      ...
    });
  }

  if (...) {
    advanceForgeholdCaravanActor(..., wt.now_ms, (r) => audit.write(r));
  }
}, TICK_MS);
```

**Critical rules for all PRs:**
- Scheduler evaluation and all `processDue` / due checks MUST remain inside the main 100ms tick using one WorldTime snapshot per tick (same as gather, presence, etc.).
- Scheduler (and any actor wake) MUST NEVER be called from `persist/replay.ts`, startup paths, or materializers. Replay consumes prior receipts only.
- Update *all* Date.now() callers inside the tick scope (e.g. inside `processSessionQueue` for `msgNow` in login path, `tickGather`, death timers, heat decay logic, witness TTL checks) to use the injected `wt.now_ms`; wall-time uses (rate limit windows, transport TTLs, guest session expiry, SMTP) remain explicitly documented as wall time.
- Preserve existing ~1s granularity and relative ordering for migrated systems so that emitted receipts (incl. scheduled_close_ms, event_instance_id, causal links) remain byte-identical.

Autonomous actor contract (observed slice in caravan; target generic registry):
- Hydrate from canonical projection.
- Inspect WorldTime.
- Emit command through normal validation + receipt path (never direct mutation).
- Idempotent by `event_instance_id` (receipt is the marker).
- Replay never executes actor logic.

### Restart Policies (Current Observed vs Target)

Per `RUNTIME_ARCHITECTURE_V1.md` §4.3, every scheduled or time-dependent system must document its restart behavior as one of: `resume` (honor due timestamps after restart), `catch_up` (process overdue immediately or at bounded rate), `reset` (clear timers/state on restart), or `not_applicable`. This must be explicit before/after each migration. Current ad-hoc timers + `last*ScanMs` + in-mem deadlines make this per-system.

| System | Current Observed | Target Policy | Notes / Idempotency | Key Files |
|--------|------------------|---------------|---------------------|-----------|
| Property auctions (settle) | Injected `nowMs` + `scheduled_close_ms` in projection + status flip in live tick only. Replay materializes projection but does not run settle. | `resume` (replay restores `scheduled_close_ms`; next live tick will settle if past due). | `settleDueAuctions` uses status != 'open' + due check; no duplicate receipts. | `world/auction-loop.ts`, `world/property.ts`, `persist/materializers.ts` |
| Autonomous caravan (Forgehold merchant) | Injected `nowMs` + due from causal row; emitted `caravan_merchant_arrived` receipt is the idempotency marker. | `resume` (replay hydrates causal state; actor skips if receipt present). | `advance...` checks for existing arrival receipt before emitting. | `world/autonomousCaravan.ts`, `chronicle/sharedWorldObservation.ts`, verify-fishing-caravan-events.test.ts |
| Chill-zone gather / refine progress + node respawn | `tickGather(sys, nowMs)`; all gather state (complete_at_ms, nodes) in-memory + ephemeral. Resets on restart. | `reset` (documented as ephemeral; no durable schedule yet). | Progress is presentation + completion receipt only. | `world/gather.ts:388` (tickGather), comment on EPHEMERAL state |
| Death / respawn timers | `dead_until_ms` on Player (set in applyDeath); checked in `processSessionQueue` and main tick using passed `now`. In-mem only; reconnect honors within process. | `reset` (current; timers lost on full restart) or future `resume` if position/death made durable. | `applyRespawnNow` uses deadline vs injected now. | `world/death.ts`, `index.ts` (processSessionQueue + applyRespawnNow) |
| Heat decay + penalty windows | `applyDecay(..., nowMs)` in heat.ts + dedicated 60s interval + legendary decay; state hydrated from `player_heat` receipts on connect. | `resume` (decay is time-delta based from last_receipt; penalties have absolute `penalty_until_ms`). | Receipts drive hydration + decay; active windows re-evaluated on reconnect. | `world/heat.ts` (hydrateHeatState, applyDecay), `persist/...` player_heat |
| Mob respawn + aggro | Dedicated setInterval(1s) for `tickMobRespawns()` + 2s aggro using `Date.now()`. Mobs in-mem. | `reset` (mobs respawn state is not durable across full restarts today). | Broadcasts on respawn; no receipted schedule yet. | `world/mobs.ts:150` (tickMobRespawns), index.ts mob intervals |
| Witness requests / quorum TTLs | In-mem requests with `requestTtlMs` / cooldowns; `getUnresolvedExpiredRequests(now)` + `tryResolveQuorum` in main tick. | `reset` (short TTLs 12s/60s outlive most restarts; outcome receipt `witness_quorum_resolved` is durable). | Requests/cooldowns intentionally not persisted. | `world/witness.ts`, main tick (cleanup + resolve) |
| Item decay (world objects) | Dedicated 10s `decayTick(new Date())`. | `reset` (ephemeral world objects). | | `index.ts` decayTick |
| Work contracts / other timers | Various `Date.now()` in handlers + tick ctx. | Per-system (mostly `resume` via receipt timestamps). | | `world/work_contracts.ts`, skills handlers |

**Requirement:** PR-05 and PR-08 must add/review these comments (or equivalent) in source for every affected path and update a verifier or test to assert the documented policy matches observed restart behavior.

### Client-Server Boundary

- Clients emit only `ClientMessage` (union in `packages/shared/protocol.ts`). No client ever supplies position, inventory, heat, or schedule state as authoritative.
- Server owns: validation (`movement.ts:tryMove`, detector), resolution, receipt emission, broadcasts (`ServerMessages`).
- Optimistic UI allowed on client for latency; must reconcile on server result or reconnect snapshot.
- HTTP control plane (`api/http.ts`): health, receipts (public + private), world state, property, economy, accounts, beta, sim snapshot. Never mutates runtime truth without going through receipt path.
- Protocol stability: `verify_protocol_sync.sh`, golden snapshot, `protocol.breaking.json`.

Android-specific: token login, receipt ingestion, snapshot diffs (see `android-client-update.ts` and verify test).

### Anti-Cheat & Enforcement

Pipeline (ARCHITECTURE.md + ANTICHEAT.md):
`Intent → onMoveIntent/onChat/onMoveApplied → addSignal / addHeat → DetectorAction → Tem / throttle / kick → receipt (heat_changed, tem_*, ledger_marked, witness_*)`

- Heat: `world/heat.ts` (decay, penalty windows), projected to `player_heat` via receipts (`verify-anticheat-persistence.ts`).
- Witness v0: `world/witness.ts` (in-mem requests with TTL, quorum `witness_quorum_resolved` receipt only; private).
- Sovereign/Echo/Caps v0: cosmetic + gated enforcement, private receipts, `CAPS_ENABLED`, in-mem for active session.
- IP rate limits (connection/move/chat) in `index.ts` (Plan B hardening).

All durable consequences are receipted; in-memory enforcement windows are acceptable within documented TTLs.

---

## API / Interface Changes

No breaking changes proposed in this document. The design formalizes existing surfaces.

**Key existing interfaces (to be stabilized or extracted):**

Before/after for clock injection (illustrative target):

```ts
// Current (mixed)
const now = Date.now();
settleDueAuctions(now, write);

// Target
const wt = worldClock.now();
const settlements = scheduler.processDue(wt, write);  // or direct actor call
```

WS protocol remains additive-only for v2.x. New messages require:
- Addition to `packages/shared/protocol.ts`
- Update to `ServerMessages`
- Golden regeneration + sync verification
- Parity test updates (debug-client + Android)
- Receipt action definition (if applicable)

Scheduler/WorldClock contracts are internal (server + shared TS for compile-time). Any future debug visibility for due schedules must reuse existing read-only patterns (e.g. GetPressureMetricsMessage or /v1/health extensions) and must never make schedule state authoritative for clients (display hint only; cross-ref client intent-only rule). PR-07 gates confirmation of no protocol impact for the extraction/migration work.

Public receipts response shape is frozen under `mode: "strict"`.

---

## Data Model Changes

**No schema changes** are required for this architecture document. Current model:

- **Canonical:** `receipts.jsonl` (append-only, hash chain).
- **Projections (replayable):**
  - SQLite tables (see `persist/schema.ts`): `players`, `items`, `inventory_items`, `player_heat`, `player_anticheat_enforcement`, `chronicle_events`, `properties`, `auctions`, `world_events`, `npc_talk_events`, etc.
  - In-memory: `WorldState.players`, per-session `AntiCheatRuntime`, `HeatState`, gather state, witness requests, active echoes, guild/house maps (process lifetime).
- **Marker:** `replay_marker.json` + `_meta` for incremental replay.
- **Item identity:** deterministic from mint receipt hash (`generateItemId`).
- **Causal parity:** `packages/shared/causalParity.ts` + `chronicle/sharedWorldObservation.ts`.

Migration strategy (future): any table change must be additive or accompanied by replay-safe migration + verifier update. Receipts always win.

---

## Alternatives Considered

### 1. Adopt Colyseus (or similar authoritative room framework) for sync

**Description:** Replace bespoke WS + tick with Colyseus rooms, state patches, and built-in timing.

**Trade-offs:**
- Pros: Built-in delta sync, room sharding, reconnection helpers; less custom plumbing.
- Cons: Loses explicit control over "intent queue → validate in tick → receipt before any broadcast" ordering that is central to anti-cheat, witness, and receipt-first invariants. Introduces third-party timing semantics. Current single-process 32×32/64×64 maps do not justify the abstraction tax. Post-MVP review trigger already documented in `ARCHITECTURE.md` ("Post-MVP Review (When to revisit Colyseus)").
- Decision: Retain bespoke loop for MVP. Revisit only when >1 city, >100 CCU, or multi-shard needs appear.

### 2. Client-side prediction + reconciliation with server rollback

**Description:** Allow clients to apply movement/combat locally and reconcile on server correction (common in fast-paced games).

**Trade-offs:**
- Pros: Lower perceived latency for movement.
- Cons: Violates "server is truth" core principle. Complicates anti-cheat (cadence detection becomes ambiguous), receipt ordering, and replay determinism. Makes public receipts and chronicle harder to explain. Android debug surface would need prediction layer that can be exploited.
- Decision: Never. Server applies only after validation; client may be optimistic in UI only.

### 3. Unified persistent WorldClock + durable scheduler from day one (vs incremental extraction)

**Description:** Immediately introduce a durable epoch + schedule table written to receipts/SQLite before any other work.

**Trade-offs:**
- Pros: Cleanest long-term model; no later migration debt.
- Cons: Large surface change with risk of altering existing receipt streams or restart semantics for caravan/auctions/gather/death. Current proof (fishing-caravan verifier) already works with injected clock. `RUNTIME_ARCHITECTURE_V1` recommends interface extraction first, then adaptation of existing systems.
- Current ad-hoc pattern (last*ScanMs + if-due checks inside the TICK_MS interval + separate setIntervals for decay/mobs/witness) has already demonstrated receipt-identity preservation via `verify-fishing-caravan-events.test.ts` and `verify-property-auction-*`; staged migration must preserve that property.
- Decision: Staged (see PR Plan): define interfaces + inject without behavior change, then migrate one system at a time with verifier proof that receipts/projections are identical.

---

## Security & Privacy Considerations

**Threat model:**
- Untrusted clients (speed hacks, teleport, spam, perfect-bot cadence, item duplication attempts).
- Network observers / proxy tampering.
- Compromised client binaries (Android side-load).
- Insider / operator attempting to alter history.

**Mitigations (grounded in code):**
- All state changes via validated intent + receipt path only (`index.ts` dispatch, `movement.ts`, skill handlers).
- TLS-by-default (`REQUIRE_TLS`, `TRUST_PROXY` logic + `tlsGate`/`isTrustedProxy` helpers in `index.ts`); reject plaintext except loopback dev.
- Receipt chain integrity (prev_hash + blake3 + Ed25519) verified by `verify-receipts-chain.ts`, lifecycle verifier.
- Anti-cheat: cadence detection, speed violation, chat spam, heat escalation to Tem + witness + throttle/kick. IP rate limits.
- Heat/penalty/witness receipts are private-only; public feed redacts actor and buckets coords.
- Witness requests never expose raw `player_id` or coordinates.
- No client-supplied authority (tokens verified server-side in coordination-kernel; no caps asserted by client).
- Replay is required on startup; absence of receipts is fatal (`replay.ts`).
- G1–G15 civil guarantees + `verify-guarantees.ts` block on invariant violation.

**Privacy:**
- PII (email) never receipted (account/email.ts).
- Public receipts use daily salt + anon mode by default.
- Chronicle shared-world view is causal and redacted.
- Sovereign/witness/heat receipts explicitly private.

**Risks (explicit):**
- **High:** Clock skew or restart policy mismatch could cause duplicate scheduled consequences (mitigation: idempotency via `event_instance_id` + receipt marker; current caravan proof in `autonomousCaravan.ts`).
- **High (operability):** Per-session `queue: Queued[]` (pushed in WS message handler; drained max 25 per `processSessionQueue` call) is currently unbounded with no max length, drop policy, or backpressure. Flooding can lead to memory pressure/OOM before anti-cheat or IP limits (`checkIpConnectionLimit`, `onMoveIntent` in detector) engage. (Cross-ref: `Session` type, queue push at WS receive, `processSessionQueue` drain loop.) Mitigation today: IP rate limits + anti-cheat cadence/spam signals; queue cap + explicit policy (drop-oldest, reject, or throttle) is deferred to a future security/operability PR.
- **Medium:** In-memory enforcement state (witness requests, active Tem, echoes) lost on crash (acceptable per TTLs; documented in ARCHITECTURE.md).
- **Medium:** Protocol drift between server, debug-client, Android (mitigation: golden + sync script + parity tests).
- **Low:** Ed25519 key compromise (production: `CHRONICLE_KEY_PATH` required; separate from runtime).

---

## Observability

**Current (observed):**
- Structured logs via console + receipt emission.
- `/v1/health` (includes build info).
- Pressure metrics: `computePressureMetrics` (`metrics/pressure.ts`).
- Heartbeat: `emitHeartbeat` every `HEARTBEAT_INTERVAL_MS` (default 5min) with receipts path fingerprint.
- Lifecycle verification on boot/shutdown (`verifyLifecycle`).
- Dedicated verifiers: `verify-anticheat-persistence.ts`, `verify-fishing-caravan-events.test.ts`, `verify-guarantees.ts`, chronicle chain, etc.

**Target additions (recommended):**
- WorldClock tick counter, scheduler due count, and intent queue depth (to observe the unbounded queue risk) as metrics.
- Per-action receipt latency (from intent receiptAt to write).
- Replay duration and projection row counts on startup.
- Heat distribution, active Tem count, witness request rate (private).
- Alert on chain verification failure, replay marker divergence, or lifecycle verify exit(2) in prod.
(See PR-06 for gate requiring at least one new metric + verifier assertion.)

**Alerting surfaces:** production systemd logs, receipt tail, `/v1/health`, Chronicle.

---

## Rollout Plan

**Current state:** The architecture is already running in dev, beta lanes, and production-like deploys. This document does not change runtime behavior.

**Staged adoption of target runtime contracts (no feature flag needed for extraction phase):**
1. Interface extraction + clock injection behind pure refactors (no observable change).
2. Migrate one scheduled system (e.g. auctions or caravan) with before/after verifier proof that emitted receipts are byte-identical.
3. Expand to gather, death timers, etc.
4. Add scheduler metrics and explicit restart policy documentation per system (see "Restart Policies" table; each migrated system must have its resume/catch_up/reset documented in code + verified).

**Feature flags already in use (for new surfaces):** `CAPS_ENABLED`, `WITNESS_ENABLED`, `SOVEREIGN_ENABLED`, `HOUSES_ENABLED`, `GUILD_ENABLED`, `CHILL_ZONE_GATHER_ENABLED`, `AKALYNTH_RNG_V2`, `IP_RATE_LIMIT_ENABLED`, `DEBUG` gates for many dev surfaces.

**Rollback:** Git revert of the specific PR; receipts remain canonical so state is recoverable. For runtime contract changes, the verifier that proves identical receipts is the rollback gate.

**Verification gates before merge:**
- `npm run verify` (full suite)
- Targeted: `verify-anticheat-persistence`, `verify-fishing-caravan-events`, `verify-receipts-chain`, `verify-guarantees`, protocol sync, Android client update test.
- Manual smoke via debug-client + Android where protocol or projection changes.

---

## Open Questions

1. Persistent world epoch and offline time advancement (RUNTIME_ARCHITECTURE_V1 §4.3).
2. Multi-process clock ownership / lease.
3. Scheduler catch-up policy and limits after long downtime.
4. Schedule cancellation semantics and behavior version migration.
5. Whether player position / combat timers become durable in v0.2 (current: in-memory).
6. Codex authoring authority boundary (separate from runtime command path).
7. Sovereign single-session uniqueness across restarts (currently in-mem).
8. Exact public receipts delay/jitter tuning for production rumor surface.

These remain open per `RUNTIME_ARCHITECTURE_V1.md`; no implementation should treat them as settled.

---

## Key Decisions

1. **Server is the sole authority for all world consequences.** Clients transmit intents only. All validation, resolution, and state mutation occur in `apps/server/src/`. (Rationale: prevents all classes of client cheat; documented in `ARCHITECTURE.md` "Core Principle" and enforced in every handler path including `processSessionQueue` + validation.)

2. **Receipts are the single source of truth.** `AuditReceipt` / `CoordinationReceipt` chain in `receipts.jsonl` (via `coordination-kernel` logger) is canonical. SQLite, in-memory projections, and Chronicle are rebuildable derivatives. Replay is mandatory and idempotent. (G1–G4, `persist/replay.ts`, `coordination-kernel/src/receipt/logger.ts` (fsync before onWrite + appendReceiptSync).)

3. **100 ms fixed tick with drain-bounded per-session queues.** `TICK_MS=100`. In `processSessionQueue`, messages are processed with `while (s.queue.length && processed < 25)`. The per-session `queue: Queued[]` (populated on WS 'message') is currently unbounded (no max length, no drop/backpressure at push site). Drain bound provides deterministic cadence for anti-cheat; queue growth itself is a resource risk mitigated today only by IP rate limits + anti-cheat detectors (see Security). (`constants.ts:1`, `index.ts` main game loop + `processSessionQueue`, `Session` type, `Queued` type.) Queue cap + policy (e.g. drop-oldest on cap, or throttle) is deferred.

4. **Clock injection and scheduler contract are required future primitives, not yet universal.** Existing scheduled paths (`settleDueAuctions`, `advanceForgeholdCaravanActor`, `tickGather`) demonstrate partial discipline (injected nowMs, no internal Date.now()); many others still read `Date.now()` (including inside `processSessionQueue`). Target (refined): single `WorldTime` owner + `ScheduledConsequence` + `Scheduler.processDue(wt, emit)` + actor registry with replay separation. See wiring example and Restart Policies table. (RUNTIME_ARCHITECTURE_V1.md §§4–6.)

5. **Anti-cheat is multi-layer and receipt-backed for durable parts.** Detector signals + perfect cadence + heat + Tem + witness quorum + IP limits. Only heat/penalty/witness-quorum outcomes are durable via receipts; short-lived enforcement state is in-memory within TTLs. (`anticheat/detector.ts`, `world/heat.ts`, `world/witness.ts`, `verify-anticheat-persistence.ts`.)

6. **Public receipts are intentionally lossy and delayed.** Bucketed coordinates, anonymized actors, jitter, action-specific visibility, and time delay (`PUBLIC_RECEIPTS_DELAY_MS` default 15min) to create controlled information asymmetry. Canonical truth stays private. (`audit/public_receipts.ts`, `ARCHITECTURE.md` "Public Receipts Feed").)

7. **Protocol is the contract; golden + mechanical verification enforce parity.** `PROTOCOL_VERSION='2.1.0'`, `packages/shared/protocol.ts`, `protocol.golden.json`, `verify_protocol_sync.sh`, Android update verifier. Clients never extend authority surface.

8. **Autonomous actors are server-owned intent producers, not privileged reducers.** Current Forgehold caravan (`autonomousCaravan.ts`) is the reference proof: reads causal rows, emits via normal receipt path, uses emitted receipt as idempotency marker. Replay never re-executes.

9. **Restart semantics are explicitly "resume" or "reset" per system today.** Full persistent-world model (epoch, offline advance) is deferred. In-memory session state (echoes, active witness requests, caps) resets on process restart.

10. **Design provenance and civil guarantees govern authority.** No observation or implementation becomes canon without explicit decision record. `AKALYNTH_DECISION_RECORD_V1.md`, G1–G15, World Architect mandate.

---

## References

- `docs/ARCHITECTURE.md` — Core principle, tick diagram, anti-cheat, public receipts, networking choice.
- `docs/RUNTIME_ARCHITECTURE_V1.md` — World time categories, scheduler contract, autonomous actor shape, replay rules, Android boundary, invariants.
- `docs/AKALYNTH_DECISION_RECORD_V1.md` — Design provenance model, authority rules, conflict resolution.
- `apps/server/docs/CIVIL_GUARANTEES.md` — G1–G15 (receipts, projections, items, death, drops, chronicle, forensics).
- `packages/GOVERNANCE_INVARIANTS.md` (legacy) + `docs/GOVERNANCE_INVARIANTS.md`.
- `AGENTS.md` + `.claude/skills/` routing (world-architect, game-server-steward, receipt-chain-steward, anti-cheat-steward, protocol-guardian).
- `packages/shared/protocol.ts`, `types.ts`, `constants.ts`, `causalParity.ts`.
- `packages/coordination-kernel/src/receipt/{logger,hasher}.ts` and `src/types.ts`.
- `apps/server/src/{index.ts, audit/logger.ts, persist/{replay,materializers,schema}.ts, world/{state,movement,heat,autonomousCaravan,auction-loop,witness}.ts, anticheat/{detector,tem}.ts}`.
- Verification: `apps/server/tools/verify-*.ts`, `scripts/verify*`, `verify-fishing-caravan-events.test.ts`.
- `docs/ANTICHEAT.md`, `docs/PROTOCOL.md`.
- Prior art: Tibia-inspired runestone + social witness; classic server-authoritative MMO tick models.

---

## PR Plan

The following PRs are ordered for independent reviewability. Each should land with passing full verify + targeted proof that existing receipts/projections/behavior are unchanged (except where the PR explicitly migrates a system with before/after evidence).

**PR-01: Extract WorldClock interface and inject into main tick**  
Files: `packages/shared/world-clock.ts` (new; export WorldTime, createWorldClock + provider), `apps/server/src/index.ts` (main setInterval callback + processSessionQueue call sites), `apps/server/src/world/clock.ts` (impl, or inline minimal), update callers.  
Dependencies: none.  
Description: Define the concrete `WorldTime` + `createWorldClock()` (see Proposed Design section for exact shape). Wire a single snapshot per tick into the 100ms loop; replace direct `Date.now()` inside tick scope (main interval body, `processSessionQueue` internal `msgNow` for token paths, gather/death/heat call sites) with injected value. Pass `wt.now_ms` explicitly. Add unit test for monotonic tick counter within epoch.  
Sub-bullets:
- Update all tick-scope Date.now() (see wiring example); leave wall-time uses (rateLimit windows, transport TTLs, `GUEST_SESSION_TTL_MS` etc.) as-is and comment them.
- Confirm scheduler/replay never called (add assert or comment in replay.ts).
- No new Client/ServerMessage types.
- Output: WorldTime snapshot used uniformly; zero behavior change to receipts.

**PR-02: Introduce minimal ScheduledConsequence + Scheduler contract**  
Files: `packages/shared/scheduler.ts` (interfaces + types), `apps/server/src/world/scheduler.ts` (in-memory impl), wiring stubs in index.ts.  
Dependencies: PR-01.  
Description: Implement the concrete interfaces shown in Proposed Design (ScheduledConsequence with owner_event_instance_id, Scheduler with processDue(wt, emit)). Idempotency key derived from (owner_event_instance_id + consequence_type). Pure reducer-friendly (no side effects except emit callback). Scheduler must be a no-op / never invoked from replay paths.  
Sub-bullets:
- processDue must use stable ordering (sort by due_at_ms then schedule_id for determinism).
- Evaluation stays inside main 100ms tick using same wt snapshot as other work (preserve ~1s granularity/ordering vs prior lastScanMs for caravan/auctions).
- Add initial unit tests for register/processDue/idempotency.
- Confirm: no protocol surface changes; scheduler state never authoritative for clients (display hints only, like current scheduled_close_ms).

**PR-03: Adapt Forgehold caravan actor to scheduler contract + prove idempotency**  
Files: `apps/server/src/world/autonomousCaravan.ts` (adapt advance... to use scheduler), `apps/server/src/world/scheduler.ts` (register calls), `apps/server/src/index.ts` (tick integration point), update `verify-fishing-caravan-events.test.ts`.  
Dependencies: PR-02.  
Description: Register caravan wake-ups (or equivalent due) via scheduler.register using existing causal due. In live tick: `scheduler.processDue(wt, ...)` (or direct call during transition) leads to exactly one `FORGEHOLD_CARAVAN_MERCHANT_ARRIVED_ACTION` receipt. Replay must produce identical projection/state without re-executing actor or emitting. Update causal linkage docs.  
Sub-bullets:
- Preserve exact receipt fields and event_instance_id.
- Document restart policy ("resume") for this system in source + test.
- Scheduler evaluation inside 100ms tick; no change to 1s scan granularity semantics if intentional.
- No new WS messages.

**PR-04: Migrate auction close/settle to scheduler (identical receipts proof)**  
Files: `apps/server/src/world/auction-loop.ts` (settleDueAuctions), `apps/server/src/world/property.ts`, `apps/server/src/index.ts` (replace lastAuctionScanMs logic + integrate scheduler.processDue), extend `verify-property-auction-*.ts` or `verify-property-auction-settle.ts`.  
Dependencies: PR-02.  
Description: Replace the `if (now - lastAuctionScanMs >= ...)` + direct settle with scheduler registration + `processDue(wt, ...)` path (or adapter). Prove byte-identical `PROPERTY_AUCTION_SETTLED_ACTION` / `property_auction_settled` receipts + projection rows (auctions table status/fields) before vs after.  
Sub-bullets:
- Preserve scheduled_close_ms recording, winner logic, wallet credits, and settlement broadcast timing semantics.
- Document explicit restart policy ("resume" via replayed projection + live settle) in code + test.
- Scheduler due selection inside main tick using shared WorldTime; stable ordering by due + id.
- Confirm no client-visible change (auction state remains via existing property_snapshot / broadcasts).

**PR-05: Centralize remaining wall-clock usage behind WorldClock + document restart policies**  
Files: `apps/server/src/index.ts` (gather tick paths, death/respawn, heat decay, mob intervals, witness cleanup in main loop, processSessionQueue), `world/gather.ts`, `world/death.ts`, `world/heat.ts`, `world/witness.ts`, `world/mobs.ts`, `persist/replay.ts` (add no-scheduler-run guard), update Restart Policies table in this doc.  
Dependencies: PR-01, PR-04.  
Description: Replace all remaining tick-scope `Date.now()` (and interval-driven nows for the listed systems) with WorldTime.now_ms. For each system, add/review source comments + test assertions matching the Restart Policies table (resume/catch_up/reset). Ensure replay paths contain no scheduler or due-evaluation logic.  
Sub-bullets:
- Explicit gate: update source comments for *all* rows in the Restart Policies table; extend at least one verifier (e.g. caravan or auction) or add restart smoke to assert policy.
- Leave non-tick wall time (rate limits, TTLs outside tick) documented as wall time.
- Confirm: scheduler never invoked from replay.ts.

**PR-06: Add scheduler metrics, heartbeat fields, and startup replay observability**  
Files: `apps/server/src/metrics/pressure.ts` (extend), `apps/server/src/index.ts` (heartbeat + health), `persist/replay.ts` (augment result), update a health or verify path.  
Dependencies: PR-05.  
Description: Expose at minimum: world tick counter (from WorldTime), scheduler due count / queue depth (current drain + pending schedules), replay stats. Surface via `/v1/health`, heartbeat receipt, and/or pressure metrics.  
Sub-bullets (gate):
- Add at least one new scheduler/WorldClock metric (e.g. due schedules count or tick counter) and update a verifier or health check to assert its presence.
- Queue depth metric now also covers the (unbounded) intent queue as observability for the risk in Security.
- No authority or receipt changes.

**PR-07: Strengthen protocol guard + add client parity CI step for scheduler-related messages (if any)**  
Files: `packages/shared/protocol.ts`, `scripts/verify_protocol_sync.sh`, `apps/server/tools/verify-android-client-update.test.ts`, debug-client (useGameClient etc.), any new inspection if added.  
Dependencies: PR-01 (if debug inspection added later; likely none).  
Description: For any scheduler-related visibility (unlikely in these PRs): route through existing patterns (e.g. extend GetPressureMetricsMessage or similar read-only) or defer. Add explicit confirmation in each PR review that no ClientMessage/ServerMessage additions were introduced.  
Sub-bullets:
- Scheduler state (due schedules, like current auction scheduled_close_ms) is a display hint only; never authoritative (client must not act on it without server intent result + receipt).
- Run protocol golden sync + Android client update verifier as gate; document "no protocol impact" in PR description.
- If future debug surface added, it must not change authority model.

**PR-08: Documentation & verification closure for runtime architecture**  
Files: Update `docs/RUNTIME_ARCHITECTURE_V1.md` (mark sections implemented + reference this doc's wiring/restart table), `docs/ARCHITECTURE.md`, extend existing verifiers or add `verify-runtime-architecture.test.ts`, update Restart Policies table here if needed, `AKALYNTH_DECISION_RECORD_V1.md` (if new decisions), CI / verify scripts.  
Dependencies: PR-05, PR-06.  
Description: Produce conformance record (e.g. via extended test or manual + evidence) showing: WorldClock injected uniformly for migrated paths, scheduler contract in use with replay separation, actor contracts, restart policies documented+verified per system, identical receipts/projections, Android + protocol parity. Close the loop.  
Sub-bullets (gates):
- At least one new metric from PR-06 surfaced and asserted in health/verifier.
- All systems in Restart Policies table have source comments + test coverage for their policy.
- Full `npm run verify` + targeted (caravan, property auctions, guarantees, anticheat, protocol sync, android update).

Each PR must:
- Keep all existing receipts, projections, and client-visible behavior identical (except intentional migration proofs with before/after evidence).
- Add or update a verifier (or extend existing) demonstrating the contract + replay separation + restart policy.
- For PR-01/02/05/06/08: surface at least the new clock/scheduler observability and assert it.
- Confirm (and document) no new ClientMessage/ServerMessage types; scheduler state is display hint only.
- Update relevant design docs (including this one's citations, wiring examples, Restart Policies table) only for the scope of that PR.
- Be reviewable in <1 hour by a senior engineer familiar with the receipt path. Use function names (processSessionQueue, settleDueAuctions, advanceForgeholdCaravanActor, tickGather) for references.

---

*End of document. This is the initial canonical architecture design artifact for the Akalynth project under "architect init".*
