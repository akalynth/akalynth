# Akalynth Persistence Matrix

## Purpose

This matrix classifies Akalynth state by durability, authority, evidence, and next hardening action.

It prevents a common prototype failure mode: presenting a local pre-alpha world as durable merely because some receipts or database tables exist.

## Status

This is a documentation boundary, not a persistence implementation.

No runtime behavior, schema, verifier, protocol, Android behavior, deployment behavior, or data migration is changed by this document.

## Reading Rules

- **Authority** means the component allowed to decide the state value.
- **Durability today** means what survives a normal process restart today, based on current repo documentation and source inspection.
- **Evidence today** means the artifact or mechanism that records the state or action today.
- **Release claim allowed** means whether v0.1 may claim durable support for that state.
- **Next hardening action** is the smallest useful next step before stronger claims.

## Durability Classes

| Class | Meaning | Claim Boundary |
|---|---|---|
| `D0_in_memory` | Runtime/process-local state. Restart may reset it. | Do not claim durable. |
| `D1_file_receipted` | State/action is recorded to append-only file evidence, but live reconstruction may be partial or unproved. | Claim evidence exists, not full persistence. |
| `D2_sqlite_local` | State has a local SQLite representation or persistence layer support. | Claim local persistence only if verifier/run artifact covers it. |
| `D3_ci_fixture_proved` | State/evidence is exercised by deterministic CI fixtures/verifiers. | Claim fixture-backed verification for named commit only. |
| `D4_release_proved` | State is covered by release proof run, verifier output, and artifact bundle. | Not currently claimed for v0.1. |

## Matrix

| State / Surface | Authority | Durability Today | Evidence Today | Release Claim Allowed Today | Next Hardening Action |
|---|---|---:|---|---|---|
| Guest session identity | Server | `D0_in_memory` / token-dependent | login/session receipts where emitted; protocol messages | Local/session behavior only | Define token/session persistence invariant and add smoke test. |
| Player connection state | Server | `D0_in_memory` | WebSocket events, receipts where emitted | No durable claim | Add disconnect/reconnect fixture with expected state boundary. |
| Player position | Server world state | `D0_in_memory` for live state | movement receipts / chronicle where emitted | Movement validation only, not durable world position | Decide whether position must persist in v0.2; add restore fixture if yes. |
| Map definitions | Repo source | Source-controlled | JSON map files | Source-defined map layout | Add map schema validator if not already covered by existing checks. |
| Movement validation | Server | Code-defined | protocol sync, MVP verification, movement receipts | Server-authoritative local movement | Keep under showcase preflight and CI. |
| Chat messages | Server | Mostly runtime / receipt-dependent | chat receipts and client logs where emitted | Local chat behavior only | Decide whether chat history persists or remains ephemeral. |
| Audit receipts | Server audit logger | `D1_file_receipted` | JSONL receipt chain | Evidence chain exists when generated and verified | Expand release proof bundle around receipt path and verifier output. |
| Public receipt feed | Server presentation layer | Derived from private receipts | redacted/delayed feed | Public presentation only; not canonical truth | Add feed fixture proving delay/redaction boundaries. |
| Chronicle events | Server chronicle adapter | `D1_file_receipted` / fixture-backed in CI | chronicle log, chronicle-chain verifier | Fixture-backed where CI passes | Define rebuild guarantees from chronicle log. |
| Heat score | Server runtime | `D0_in_memory` | private heat receipts where emitted | No durable heat claim | Decide whether restart reset is intentional; document or persist. |
| Tem challenge state | Server anti-bot runtime | `D0_in_memory` | Tem challenge/response receipts where emitted | Local enforcement behavior only | Add restart/timeout boundary test. |
| Witness requests/cooldowns | Server witness runtime | `D0_in_memory` | witness_requested / witness_response receipts where emitted | No durable witness state claim | Add explicit request lifecycle fixture and restart boundary. |
| Witness quorum outcome | Server witness runtime | Receipt-backed outcome | witness_quorum_resolved receipt where emitted | Outcome evidence only | Add verifier for exactly-one resolution per request. |
| Sovereign presence/session | Server runtime | `D0_in_memory` | private sovereign receipts where emitted | Cosmetic/debug-gated behavior only | Keep non-release unless production gate and verifier are added. |
| Sovereign echo | Server runtime | `D0_in_memory` | private echo receipts where emitted | No durable echo claim | Treat as cosmetic and restart-reset unless intentionally persisted. |
| Capabilities | Server-derived gates | `D0_in_memory` unless backed by future persisted grant source | capability receipts where emitted | No durable capability claim | Define persisted grant source before production use. |
| Inventory live ownership | Server / persistence layer | Mixed `D0_in_memory` + `D2_sqlite_local` support | item receipts, SQLite rows where used | Not release-claimed durable inventory | Add inventory restore fixture and verifier coverage before claim. |
| World item drops | Server / persistence layer | Mixed runtime + persisted item rows | item_dropped_to_world receipts | Item drop evidence only | Add world-item restore and decay fixture. |
| Protected slots | Server policy | Mixed runtime + verifier-covered policy behavior | protected-slot receipts/verifier | Verifier-scoped claim only | Tie protected-slot persistence to inventory restore proof. |
| Combat state/cooldowns | Server runtime | `D0_in_memory` | attack/combat/death receipts | Combat exists but not release-claimed durable | Add combat smoke fixture if intended for showcase loop. |
| Death / respawn timer | Server runtime | `D0_in_memory` with receipt evidence | death, death_penalty_applied, respawn receipts | Local death flow only | Define restart behavior: reset, resume, or persist. |
| RNG commit/reveal | Server | Receipt/evidence dependent | rng commit/reveal receipts where emitted | Evidence only for named run | Add verifier for commit/reveal completeness by domain. |
| Legendary heat | Server runtime / drop policy | `D0_in_memory` with receipt evidence | legendary_heat_changed receipts | No durable heat claim | Decide whether heat is lore-only, anti-cheat, or economy-affecting. |
| Treasury / gold | Server treasury module | Potential `D2_sqlite_local` / receipt-backed | wallet/tithe/grant receipts and treasury verifier | Verifier-scoped only | Add restore/replay proof for balances before durable economy claim. |
| Work contracts | Server contract module | Mixed runtime / receipt-backed | contract start/tick/complete/fail receipts and verifier | Verifier-scoped payout ordering only | Add active-contract restart behavior decision. |
| NPC recognition | Server NPC module | Receipt/runtime dependent | NPC recognition receipts where emitted | Not durable unless verified | Decide whether recognition is account-bound, session-bound, or lore-only. |
| Moderation reports | Server moderation module | Not release-claimed | report/resolution receipts where emitted | No moderation ops readiness claim | Add case lifecycle schema and admin authority boundary. |
| Android local identity/token store | Android client | Device-local | app prefs / identity store | Client convenience only | Add Android build/run proof before release claim. |
| Debug web client UI state | Browser runtime | `D0_in_memory` | local UI behavior | Debug convenience only | Keep outside release claims. |
| Load-test runs | Harness output | Run artifact directory | RUN/RESULTS/METRICS/AUDIT_HASHES/ROOT when generated | Local/staging harness only | Add one committed example or CI artifact inspection path. |

## Release Claim Rules

A state class can move from `D0`/`D1` to a stronger claim only when all are true:

1. authoritative source is named,
2. restart behavior is specified,
3. evidence artifact is named,
4. verifier or smoke test exists,
5. proof-run output is captured for a named commit,
6. failure mode is documented.

## v0.2 Candidate Persistence Set

The smallest useful v0.2 persistence target is not “persist everything.”

Recommended candidate set:

1. player identity/session continuity,
2. player position or explicit reset-on-login policy,
3. inventory ownership,
4. world item drops and decay,
5. treasury balances,
6. receipt/chronicle replay heads.

Everything else can remain explicitly runtime-local until a gameplay or governance reason requires durability.

## Stop Conditions

Do not implement persistence changes if any of these are true:

- current showcase preflight is failing,
- no restore behavior is specified,
- no verifier/smoke test is planned,
- state authority is ambiguous,
- migration behavior is unspecified,
- release language would become stronger than evidence.

## Safe Summary

> Akalynth has evidence and persistence scaffolding, but v0.1 should only claim durable state where a named verifier, receipt artifact, and proof run support that specific state class.
