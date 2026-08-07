# Risk & Consequence Spine v0.3.1

Status: **accepted design contract**

Decision record:
[`DECISION.md`](./DECISION.md)

Authority boundary: this contract is a gameplay-design decision. It does not
amend Civil Guarantees G1–G15, expand V1, establish world canon, or authorize
implementation.

## 1. Design goals

| Goal | Required behavior |
| --- | --- |
| Server-owned exposure | Risk is standing state the server binds. |
| Legible risk before acceptance | The aggregate consequence ceiling is disclosed and pinned. |
| Exactly-once resolution | One exposure identity produces one authoritative resolution root. |
| Durable commit before effect | No consequence mutation occurs before the resolution-root receipt is durably appended. |
| Durable consequence | History and downstream effect endure; recovery never erases the loss. |
| Earned recovery | Recovery restores minimum agency, never previous power for free. |
| Contestable power | Pure time cannot create permanent winner immunity. |
| No unrecoverable defeat spiral | At least one recovery floor is non-monopolizable. |
| Server truth only | Clients submit intent; the server accepts, resolves, and receipts outcomes. |

## 2. Governing loop

```text
Risk declaration
  → Exposure acceptance (server-owned standing state)
    → Policy version pin + protection commitment (0|1) + aggregate ceiling
      → Server resolution computation
        → Durable append of resolution-root receipt  ← commit boundary
          → Derived state / Chronicle materialization / client delivery / analytics
            → Durable consequence
              → Earned recovery (compensating event only)
                → Permanent history (never rewritten)
```

Chronicle is downstream of canonical receipts.

## 3. Exposure acceptance

Acceptance may be sourced from:

- contested-zone entry;
- carrying exposed power;
- joining a war;
- initiating a consequence-capable action; or
- an explicit risk declaration.

The server binds at acceptance:

```text
risk declaration
  → exposure acceptance
    → policy version
      → protection commitment
        → aggregate consequence ceiling
```

| Rule | Requirement |
| --- | --- |
| Stale declaration | A material context change before acceptance rejects the declaration. |
| Aggregate ceiling | Orthogonal consequence classes cannot stack beyond the disclosed ceiling. |
| Ownership | After acceptance, the server owns the event and pinned policy. |
| Before durable acceptance | No exposure exists. |

Standing exposure and per-episode commitment identity are refined by the
co-normative commitment contract.

## 4. Consequence classes

| Class | What endures | What may recover | Irreversible residue |
| --- | --- | --- | --- |
| **Body** | Character continuity; ordinary PvP/PvE does not delete the character. | Location, combat readiness, minimum agency. | Death count and episode link. |
| **Item** | Inventory and equipment truth. | Costed recovery or economy; same-item recovery requires custody transfer. | A lost identity is never recreated; the original may return only through canonical custody transfer. |
| **Reputation** | Standing with factions, organizations, and places. | Partial recovery through service, time, restitution, or another approved route. | Severe betrayal marks and politically material public facts. |
| **Place** | Territorial claim, contested state, and sanctuary eligibility. | Reclaim through contest or cooldown. | Permanent ownership history. |
| **Faction / Organization** | Rank, privileges, and war contribution. | Rank recovery and privilege re-earning. | Treason and desertion flags. |
| **World** | Event outcomes and node states. | Regenerative by default. | Permanent history always; permanent mechanical change only through a predeclared archetype. |

### 4.1 Heat-domain separation

These domains never collapse:

- anti-cheat player heat;
- legendary-item heat; and
- gameplay notoriety.

Legitimate risky play never contaminates anti-cheat enforcement.

## 5. G13 protection semantics

| Rule | Requirement |
| --- | --- |
| Count | Zero or one; protection is not automatic. |
| Selection | A client may request protection; the server validates and receipt-commits it before exposure. |
| Binding | The exposure references the server-owned commitment. |
| Location | The protected item remains in exactly one canonical location and never drops through the loss event. |
| Forbidden | Duplication and reminting. |
| Recommitment | A protection change is server-resolved only through a committed rest-state action outside contested exposure. |

A recommitment:

- never alters an accepted or pending exposure;
- produces a canonical receipt;
- has nonzero friction, with the concrete cooldown, cost, or ritual deferred;
- rejects during exposure; and
- affects future exposures only.

## 6. Power-contestability invariant

Every gameplay-power-bearing state retains a credible challenge surface through
exposure, counterplay, contest, upkeep, decay, limited projection, or another
approved pressure mechanism. Pure time investment cannot remove every
challenge surface.

G13 protects an item's identity and custody from dropping. It does not
automatically freeze effectiveness, usage exposure, upkeep, legendary pressure,
or counterplay.

Combat, progression, territory, organization, and economy systems inherit this
invariant.

## 7. Sanctuary

Once sanctuary entry is server-committed:

| Existing or allowed | Prohibited |
| --- | --- |
| Already-resolved loss, reputation, debt, and world history remain. | New Body harm. |
| Recovery and civil processes may proceed. | Involuntary Item harm. |
| Planning, trade, and social activity may proceed. | Hostile contested-state action against or from the actor. |

Entry remains pending until unresolved hostile exposure reaches its
deterministic boundary. Sanctuary never rewrites consequence.

## 8. Recovery floor

Ordinary PvP/PvE death does not delete the character. Moderation, voluntary
retirement, and account custody remain outside that guarantee.

At least one recovery route must:

1. restore minimum agency, not previous power;
2. be reachable without the lost asset;
3. require no other player's cooperation; and
4. be non-monopolizable by a guild, market, or territory owner.

| Recovery type | Rule |
| --- | --- |
| Same-item recovery | Requires actual canonical custody transfer. |
| Replacement | Creates a new item identity. |

Recovery appends a compensating event. It never edits the loss.

Permitted route postures include:

- self-recovery at a drop locus or recovery-custody surface;
- ally rescue, with soft social debt by default;
- bargained retrieval;
- institutional restitution; and
- narrow, capped time-limited decay.

## 9. Receipts, Chronicle, and commit boundary

| Layer | Role |
| --- | --- |
| Canonical receipts | Sole mechanical history. |
| Chronicle entries | Receipt-traceable civil records. |
| Public Chronicle views | Delayed, redacted, and allowlisted under applicable evidence policy. |

Every consequence episode has:

- one stable exposure identity;
- one governing policy version;
- one authoritative resolution root; and
- explicit child-effect references.

Causality is never inferred from timestamps.

A resolution becomes authoritative only when its resolution-root receipt is
durably appended. Derived state, Chronicle materialization, client delivery,
and analytics occur afterward. Failure after append replays the existing
receipt and never resolves the consequence again.

## 10. Deterministic lifecycle

| State | Rule |
| --- | --- |
| Before durable acceptance | No exposure exists. |
| Accepted and pending | The server owns the event and pinned policy. |
| Exposure-type behavior | Each type declares continuation or a receipted suspension boundary. |
| Restart | Resumes or settles the same event exactly once. |
| Duplicate delivery | Returns the existing outcome. |
| Disconnect | Transport loss, not a gameplay action. |
| Voluntary logout | Succeeds only at a server-resolved safe boundary. |

## 11. Forward-only operational levers

Every activation is durably receipted before effect and identifies:

- authority;
- reason;
- scope;
- effective chain boundary;
- expiry or review condition; and
- old and new policy hashes where applicable.

| Lever family | Effect |
| --- | --- |
| Consequence-family suspension | Prospective only; never suppresses required receipts. |
| Exposure admission cap | Limits initiation; never makes an actor untargetable. |
| Recovery relief | Restores minimum-agency access; never restores contested assets or erases residue. |
| Policy supersession / reactivation | Forward-only under these rules. |

Settled outcomes are never recomputed. Accepted exposures normally use their
pinned policy. Emergency neutralization of an unresolved exposure requires an
explicit compensating decision and receipt. Admission caps cannot be self-filled
to create untargetability.

## 12. Behavior map

Healthy play includes:

- scouting and preparation;
- intelligence gathering;
- rescue and escort;
- bargaining;
- alliance leverage;
- calculated retreat; and
- political use of reputation and place.

Receipt-visible abuse surfaces include:

- kill trading;
- alt laundering;
- repeat-victim farming;
- collusive recovery;
- sanctuary abuse;
- suicide transport; and
- disconnect-as-evasion.

## 13. Health metrics

| Metric | Evidence posture |
| --- | --- |
| Risk disclosure coverage | Receipt-derived. |
| Risk acknowledgment binding | Receipt-derived. |
| Post-loss re-exposure rate | Central failure mode. |
| Recovery completion rate | Central failure mode. |
| Time to minimum agency | Central failure mode. |
| Repeat-victim concentration | Receipt-derived eligibility signal. |
| Power concentration and contestability | Invariant health. |
| Relief eligibility, utilization, and suspected laundering | Lever health. |
| Exploit signals | Detected patterns. |
| Validated exploit incidence | Reviewed classification. |
| Loss comprehension | Playtest and research evidence only; never claimed from receipts alone. |

Metrics are computed from consequence episodes, not Chronicle row counts.
Thresholds and observation windows remain deferred.

## 14. Closed design decisions

| Topic | Decision |
| --- | --- |
| Recovery custody window | Exposure-tier or zone-policy scaled; never attacker-controlled. Use “drop locus” or “recovery custody” until a corpse entity is designed. |
| Reputation visibility | Partial delayed public view plus full authorized audit. |
| Repeat-victim relief | Deterministic concentration creates eligibility; contextual signals may flag abuse but cannot alone grant relief or punishment. |
| Ally rescue debt | Soft social default; formal obligation requires an explicit mutual contract. |
| World consequences | Regenerative by default; permanent mechanical change requires a separately approved, predeclared archetype. |

## 15. Deferred

The following remain outside this decision:

- progression curves;
- combat formulas;
- drop rates and tables;
- timers;
- reputation amounts;
- economy costs;
- anti-cheat thresholds;
- concrete protection-recommitment cooldown, cost, or ritual;
- drop-locus and corpse schema; and
- implementation verification of reconnect continuity, loss variance,
  protection-swap friction, and receipt-field alignment.

## 16. Conformance gate

Before any release claim, conformance must cover:

- protection-swap races;
- disconnect after acceptance;
- restart during resolution;
- sanctuary entry during hostile exposure;
- multi-class ceiling aggregation;
- non-monopolizable recovery;
- policy supersession mid-event;
- replay without duplicate effects;
- crash before root append, producing no committed consequence;
- crash after append but before projection or delivery, producing one outcome;
  and
- duplicate client delivery returning the existing outcome.

The co-normative commitment contract adds the envelope, reservation,
multi-subject, remediation, and bundle-integrity cases required to make these
tests executable.
