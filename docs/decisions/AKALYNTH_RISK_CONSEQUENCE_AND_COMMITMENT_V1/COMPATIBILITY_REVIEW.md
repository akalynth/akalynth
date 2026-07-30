# AKALYNTH_RISK_CONSEQUENCE_AND_COMMITMENT_V1 — Compatibility Review

Review date: **2026-07-29**

Review scope: **design compatibility only**

Runtime or build conformance reviewed: **none**

## Authority sources

- [`AKALYNTH_DECISION_RECORD_V1.md`](../../AKALYNTH_DECISION_RECORD_V1.md)
- [`GOVERNANCE_INVARIANTS.md`](../../GOVERNANCE_INVARIANTS.md)
- [`CIVIL_GUARANTEES.md`](../../../apps/server/docs/CIVIL_GUARANTEES.md)
- [`CURRENT_STAGE.md`](../../CURRENT_STAGE.md)
- [`KNOWN_GAPS.md`](../../KNOWN_GAPS.md)
- [`V1_SCOPE.md`](../../V1_SCOPE.md)

## Civil-guarantee compatibility

| Guarantee family | Design alignment |
| --- | --- |
| G1 — Canonical ledger | Envelope, root, child, seal, reservation, authority, and lever history is append-only. |
| G2 — Deterministic hashing | Logical content is immutable and content-addressed; the implementation must inherit canonical receipt hashing. |
| G3 — Durable ordering | Acceptance and root receipts are durable before dependent state; seals gate projection. |
| G4 — Idempotent replay | Stable server keys, one root per envelope, ordered children, and one seal prevent duplicate effects. |
| G5 — Rebuildable state | Envelope lifecycle, reservations, write claims, and outcomes fold from receipts; projections are never authority. |
| G6–G7 — Item identity/location | Same-item recovery requires custody; replacements use new identity; write claims prevent double location. |
| G8–G9 — Death/combat | Ordinary death remains on the single server-authoritative path; clients submit intent only. |
| G10–G11 — Drop determinism/explanation | Resolution basis retains pre-state, policy, seed commitment/opening, and effect evidence. |
| G12 — Legendary pressure | Legendary-item heat remains a separate receipt-backed domain. |
| G13 — Bounded protection | Protection remains zero-or-one, server-committed, non-dropping, and pinned through exposure. |
| G14 — Chronicle | Chronicle remains a dedup-safe, receipt-traceable projection. |
| G15 — External auditability | Policies, disclosures, basis evidence, payloads, authority, and randomness openings remain retrievable. |

Compatibility conclusion: **no G1–G15 amendment is required by the accepted
design text or this documentation record**.

Any later implementation that changes invariant scope, hashing, receipt
ordering, replay semantics, or verifier coverage must enter the applicable
constitutional review. This conclusion does not pre-authorize such a change.

## Design-provenance compatibility

The packet keeps distinct:

- accepted design decision;
- canon;
- repository adoption;
- implementation;
- observed behavior;
- conformance;
- commit and publication custody.

Authority and approval evidence are recorded without inventing a natural-person
identity. The exact normative attachments are content-hashed. Supersession
requires a new authorized record.

## Current-stage and V1 compatibility

- The current build remains a pre-alpha, proof-native MMO vertical slice.
- No current runtime behavior is reclassified.
- No release claim is created.
- No V1 in-scope implementation is added.
- Existing known persistence, maturity, client, and proof gaps remain.

## Gameplay-health compatibility

The design preserves:

- meaningful risk before commitment;
- durable and legible consequence;
- non-monopolizable minimum agency;
- contestable power;
- sanctuary without consequence erasure;
- bounded mastery before acceptance; and
- evidence-visible suppression of receipt, recovery, and exposure abuse.

Concrete values and playtest thresholds remain deferred.

## Review conclusion

```text
design_compatibility: COMPATIBLE_WITH_SCOPE_BOUNDARY
civil_guarantee_change: NONE
v1_scope_change: NONE
canon_change: NONE
runtime_change: NONE
implementation_authority: NONE
conformance_result: NOT_RUN
```

## Subsequent implementation custody note

The later-authorized
[`IMPLEMENTATION_SLICE_01.md`](./IMPLEMENTATION_SLICE_01.md) is server-private
and non-activating. It does not change this design-compatibility conclusion,
current runtime behavior, G1–G15, V1 scope, or canon.

Focused contract-kernel verification is implementation evidence, not full
package conformance. Runtime conformance and release readiness remain not run
and unclaimed.

## Subsequent Protocol Guardian compatibility note

Contract touched: the shared WebSocket protocol source, canonical golden
snapshot, protocol documentation, and Android version mirror and parity tests.

Compatibility impact: additive, non-breaking minor-version movement from
v2.1.0 to v2.2.0 under the existing major-version compatibility rule. The
already-present gather, refine, delivery, optional inventory/storage, and
builder-preview shapes are now recorded by the golden snapshot. This
publication lane adds no new wire-message or handler semantics.

Client action required: the Android mirror and parity tests now declare v2.2.0,
including backward and forward minor-skew coverage. The debug client requires
only a normal rebuild; existing v2.x clients continue to tolerate minor and
patch skew. A server emits v2.2.0 only from a build containing the shared
version change.

The same gate-closure pass reorders only the default rate-limit verifier
scenarios, corrects a stale visual-verifier expectation, replaces the draft
checksum's Node-only import with a browser-safe byte-equivalent implementation,
gives the smoke harness direct process custody, and gives the MVP verifier
direct custody of its server process with a no-`lsof` port-detection fallback.
These changes do not alter runtime rate limits, anti-cheat heat, Tem policy,
gameplay behavior, or checksum output.

Verification:

- `env -u NODE_ENV npm run verify -- --only protocol-drift --format json`:
  pass, 2/2;
- `bash scripts/verify_protocol_sync.sh`: pass;
- Android `ProtocolParityTest`: pass;
- shared typecheck/build and debug-client production build: pass;
- builder-draft checksum regression: pass, 2/2;
- focused rate-limit verifier: pass with runtime settings unchanged; and
- `env -u NODE_ENV npm run verify`: pass, 33/33, against an isolated local
  server and a temporary generated Codex projection.

## Subsequent public-Codex build-fallback note

PR #407 exposed that the clean GitHub Actions checkout did not contain the
separately generated `akalynth-codex/out/codex-public.graph.json` artifact.
The approved repair adds an empty, tracked build fallback and requires Vite to
select candidate roots by the presence of that exact artifact rather than by
directory existence alone. TypeScript follows the same real-first,
fallback-last order.

The empty graph contains no accepted object, lore, evidence, or private
projection. It does not change public-Codex authority, publish content, create
canon, or alter server/gameplay/protocol behavior. A valid external generated
public graph always takes precedence.
