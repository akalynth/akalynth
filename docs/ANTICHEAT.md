# Anti-Cheat System

This document describes the anti-cheat behavior currently backed by source code. It is not a production hardening claim and it does not prove live restart behavior outside the local verifier named below.

## Contents

- [Source Authority](#source-authority)
- [Runtime Model](#runtime-model)
- [Runtime Detection and Enforcement](#runtime-detection-and-enforcement)
- [Tem Challenge Behavior](#tem-challenge-behavior)
- [Heat Behavior](#heat-behavior)
- [Persistence and Restore](#persistence-and-restore)
- [Prior-State Lookup](#prior-state-lookup)
- [Local Verification](#local-verification)
- [Receipts and Player Feedback](#receipts-and-player-feedback)
- [Non-Claims](#non-claims)

## Source Authority

Current source authority for this document:

- `apps/server/src/anticheat/`
- `apps/server/src/world/heat.ts`
- `apps/server/src/persist/`
- `apps/server/src/index.ts`
- `apps/server/tools/verify-anticheat-persistence.ts`

Shared constants and receipt action names live in `packages/shared/constants.ts` and `packages/shared/types.ts`.

## Runtime Model

The server is authoritative. Clients send intent, such as movement, chat, and Tem responses. The server validates the intent, mutates server-owned session state, writes receipts for relevant actions, and sends the result back to the client.

The client does not get to report its own authoritative position or clear its own anti-cheat state. Detection and enforcement state is held server-side in each active session.

## Runtime Detection and Enforcement

`apps/server/src/anticheat/detector.ts` maintains per-session anti-cheat runtime state:

- recent signals
- active Tem challenge state
- throttle window
- warning and kick counters
- recent movement and cadence intervals
- recent chat timestamps

The detector currently covers these code paths:

| Area | Source-backed behavior |
| --- | --- |
| Move intent speed | `onMoveIntent` records a `speed_violation` when move intents arrive faster than `MIN_MOVE_INTERVAL_MS`. The server requests a Tem challenge if one is not already active. |
| Applied movement cadence | `onMoveApplied` tracks movement cadence, looks for near-perfect tick timing using the cadence constants, records `perfect_cadence`, and requests a Tem challenge when the cooldown allows it. |
| Chat spam | `onChat` records `chat_spam` when at least 8 chat attempts occur in 5 seconds. It applies a throttle when not already throttled and kicks for chat spam while the session is already throttled. |
| Signal decay | Detector signals decay after `SIGNAL_DECAY_MS`. Movement and cadence interval windows are kept bounded. |

`apps/server/src/index.ts` wires those detector actions into runtime behavior:

- active Tem challenges block movement until answered or timed out
- speed and cadence detections issue `tem_challenge_issued` receipts
- perfect cadence adds player heat
- chat spam adds player heat and can apply throttle
- chat while throttled is rate-limited
- chat spam while already throttled can kick the session
- failed Tem responses and Tem timeouts apply throttle and write `tem_challenge_failed`

The code also has per-IP rate checks for connection, movement, and chat abuse. Those checks are separate from the per-player detector state described above.

## Tem Challenge Behavior

`apps/server/src/anticheat/tem.ts` owns Tem challenge state transitions.

Current behavior:

- challenge IDs are generated as `tc_${randomUUID()}`
- challenge text asks the player to type `AKALYNTH`
- timeout length comes from `TEM_TIMEOUT_SECONDS`
- `tem_response` messages and chat messages can satisfy an active challenge
- wrong responses and timeouts fail the challenge
- failed challenges clear challenge state and apply a throttle window through `applyThrottle`
- successful responses clear challenge state and write `tem_challenge_passed`

The server may issue Tem challenges from:

- speed violation detection
- perfect cadence detection
- heat escalation
- the tutorial Tem tile

## Heat Behavior

`apps/server/src/world/heat.ts` stores player heat as server state with:

- `score`
- last update and decay timestamps
- last Tem trigger timestamp
- active penalty window
- per-reason counters

Heat is clamped from 0 to 100. It decays over time using `HEAT_DECAY_PER_MIN`. `apps/server/src/index.ts` adds heat for current anti-cheat and gameplay triggers, writes `heat_changed`, and then evaluates escalation:

- at `HEAT_TEM_THRESHOLD`, the server can issue a Tem challenge and write `heat_tem_escalation`
- at `HEAT_PENALTY_THRESHOLD`, the server can start a move-throttle penalty window and write `heat_penalty_applied`

Heat penalties are source-backed runtime behavior. This document does not claim a live production restart proof for those penalties.

## Persistence and Restore

`apps/server/src/persist/` materializes receipt-backed anti-cheat state into SQLite projections.

Current projected tables:

- `player_heat`
- `player_anticheat_enforcement`

Current materialized receipt actions include:

- `heat_changed`
- `heat_penalty_applied`
- `heat_tem_escalation`
- `tem_challenge_failed`
- `throttle`
- `kick`
- `warn_issued`

On session restore, `apps/server/src/index.ts` reads persisted heat and enforcement state and hydrates:

- heat through `hydrateHeatState`
- enforcement memory through `hydrateAntiCheatRuntime`

Hydration preserves active, unexpired penalty and throttle windows and drops expired windows.

## Prior-State Lookup

`apps/server/src/anticheat/priors.ts` provides a read-only prior lookup store when configured with `AKALYNTH_ANTICHEAT_PRIORS_PATH`. The store reads JSONL prior records and returns a prior by player ID through the HTTP/API context.

This is a lookup path. It does not itself punish, throttle, kick, or mutate runtime anti-cheat state.

## Local Verification

The current local verification command is:

```bash
npm -w apps/server run verify:anticheat-persistence
```

`apps/server/tools/verify-anticheat-persistence.ts` creates temporary receipt and database paths, writes anti-cheat receipts, checks live materialization, replays from receipts into a fresh database, and checks restored state. It verifies:

- `player_heat` projection is present
- heat score, penalty window, and last Tem timestamp survive materialization and replay
- `player_anticheat_enforcement` projection is present
- Tem failure, throttle, and kick counters are restored
- active throttle and penalty windows hydrate while unexpired
- expired throttle and penalty windows are cleared during hydration

The lane that patches this document also runs:

```bash
npm -w apps/server run build
npm -w apps/server run verify:anticheat-persistence
```

Passing those commands proves local build and receipt-backed persistence behavior for this source tree. It does not prove a live production restart unless a separate runtime lane records that evidence.

## Receipts and Player Feedback

Anti-cheat-relevant runtime actions write receipts for challenge, heat, throttle, kick, and related outcomes. Player-facing feedback is intentionally narrower than internal evidence: the server can tell a player they are rate-limited, challenged, throttled, or kicked without exposing the full detector details.

## Non-Claims

This document does not claim:

- cheating cannot occur
- the system is complete
- live production restart behavior has been proven
- generated or runtime state was rewritten by this documentation lane
- `docs/PROTOCOL.md` or archive/demotion documents were changed by this lane
