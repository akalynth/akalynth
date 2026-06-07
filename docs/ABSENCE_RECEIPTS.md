# Absence Receipts (`absence_receipt.v1`) — Schema Draft / RFC

Status: **RFC (Phase 1, doc-only).** No behaviour code lands until this is approved.

Most systems issue receipts for what **happened**. An **Absence Receipt** issues a signed,
checkable artifact for what **did not happen inside a bounded authority surface**:

> Within boundary **B**, over committed log interval **T = [from_seq..to_seq]**, under
> authority context **A**, **no event matching predicate P** was observed in the committed
> evidence log **L**.

It does **not** prove global nonexistence. It proves **bounded non-observation under a named
capture mechanism**. That distinction — carried explicitly in `trust_boundary.non_claims` —
is the product. The buyer-legible answer is never "no approval happened"; it is "no event
matching predicate P is present in committed seq range X..Y under authority snapshot H."

Design target:

- Absence is **claimable only against a committed boundary**. No boundary, no absence claim.
- The receipt is **re-verifiable offline** against the same primitives that wrote the log.
- The receipt **degrades honestly**: when something can't be proven (a log gap, an authority
  transition, an uncaptured source), it says `absence_unprovable`, not `absent`.

See also: `docs/MONETIZATION_RECEIPTS.md` (receipt-doc convention this mirrors) and
`docs/account-portal/.../RECEIPT_PRIVACY_BOUNDARY.md` (public/private receipt boundary).

---

## How it maps to existing infra (no parallel crypto)

This is **not** a new receipt format. An absence receipt **is** a
`CoordinationReceipt` (`packages/coordination-kernel/src/types.ts`):

- There is no `receipt_type` field — **`action` is the type discriminator**. Absence uses
  `action: "absence_receipt"`, with an explicit `schema_version: "absence_receipt.v1"` inside
  `inputs`.
- Content addressing is **BLAKE3** (`blake3:` prefix) over `fast-json-stable-stringify`
  canonical JSON; the chain signature is **Ed25519 over `${prev_hash}|${event_hash}`**
  (`packages/coordination-kernel/src/receipt/hasher.ts`).
- Emission is `appendReceipt(actor_id, action, inputs, result)` — the absence receipt is
  therefore itself an ordered, chain-linked, tamper-evident entry in the same receipt chain.

**Evidence log L (v1):** the coordination-kernel **receipt chain**
(`apps/server/audit/receipts.jsonl`). It is a single, monotonic, gap-free, genesis-rooted
chain whose entries carry `actor_id` / `action` / `inputs` / `result` — i.e. exactly the
authority, approval, delegation, override, and blocker events that absence questions are
about. (Ranging absence over the chronicle world-event log is future, generic-adapter work.)

**Construction (v1): bounded re-execution.** No Merkle tree exists yet, so the only sound
construction today is to re-execute a verified slice. The chain verifier
(`apps/server/tools/verify-receipts-chain.ts`) requires genesis-start; so v1 re-executes the
chain genesis → `to_seq` (reusing `verifyReceiptHashes` / `verifyChainLink` /
`verifyGenesisReceipt`) to establish every `event_hash`, then evaluates P over
`[from_seq..to_seq]` and asserts zero matches. **No new checkpoint primitive is required for
soundness**; a signed lower-bound checkpoint is purely a future compaction (see Deferred).

---

## Receipt Actions

- `absence_receipt` — a bounded non-observation proof (this document).
- `absence_predicate_registered` — pins a predicate's canonical form + hash + author + seq
  **before** it is used, so a predicate cannot be gerrymandered after the interval it covers
  (see Design Invariant 3).

Like monetization receipts, these are **private-only by default** (never public rumors): an
absence receipt reveals *what was being looked for* (the predicate), which is itself
sensitive. Publication is a separate, deliberate act.

---

## Canonical Fields (All Receipts)

Every absence receipt carries the standard chain fields (`sequence`, `timestamp`,
`prev_hash`, `event_hash`, `signature`, `inputs_hash`, `outputs_hash`) plus:

- `actor_id` — the issuer of the absence claim (typically the server / receipt authority).
- `action` — `"absence_receipt"`.
- `inputs` — the `AbsenceReceiptInputs` schema below.
- `result` — one of `"absent"` | `"absence_unprovable"` | `"absence_invalid"`.

---

## `inputs` schema — `AbsenceReceiptInputs` (`absence_receipt.v1`)

To be defined as a TS interface in `packages/coordination-kernel/src/absence/types.ts`
(Phase 2). Carried verbatim in `CoordinationReceipt.inputs`:

```jsonc
{
  "schema_version": "absence_receipt.v1",

  "boundary": {
    "boundary_id": "release_authority_surface.prod.v3",
    "capture_contract": "authority_event_capture.v2",
    "source_set_hash": "blake3:...",            // enumerated authorized event sources
    "capture_completeness_ref": null            // optional receipt_hash of a completeness attestation
  },

  "interval": {
    "from_seq": 184020,                          // inclusive; BINDING axis
    "to_seq": 184991,                            // inclusive
    "from_time": "2026-05-02T09:00:00Z",        // ADVISORY only (see Invariant 1)
    "to_time": "2026-05-02T11:00:00Z"
  },

  "predicate": {
    "predicate_id": "prod_release_approval_by_required_authority.v1",
    "canonical_form_hash": "blake3:...",         // blake3(canonicalize(predicate))
    "description": "valid approval event for production release under active authority"
  },

  "committed_log": {
    "log_id": "authority-events-prod",
    "head_event_hash": "blake3:..."              // event_hash at to_seq
  },

  "authority_context": {
    "authority_snapshot_hash": "blake3:...",     // blake3 of canonical actor->capabilities map @ to_seq
    "computed_at_seq": 184991
  },

  "proof": {
    "proof_type": "bounded_reexecution.v1",
    "matched_count": 0,                          // MUST be 0 for result "absent"
    "slice_first_prev_hash": "blake3:...",       // prev_hash of receipt at from_seq (lower binding)
    "slice_last_event_hash": "blake3:..."        // event_hash at to_seq (upper binding)
  },

  "trust_boundary": {
    "claims": [
      "No event matching predicate P exists in committed log interval from_seq..to_seq.",
      "The predicate was evaluated against the named authority snapshot.",
      "The interval is a contiguous, signature-verified slice of the committed chain."
    ],
    "non_claims": [
      "Does not prove the event never occurred outside this boundary.",
      "Does not prove capture infrastructure was complete unless capture_completeness_ref is present.",
      "Does not prove the authority snapshot was correct, only that this snapshot was used.",
      "Absence is bound to seq, not time: late capture may add a true event (early timestamp, later seq)."
    ]
  }
}
```

---

## Predicate format (declarative, pure, restricted)

No predicate engine exists, and arbitrary code cannot be canonicalized or proven pure. v1
uses a small **declarative JSON match expression** over a fixed set of receipt fields
(`action`, `actor_id`, `result`, and dotted paths under `inputs.*`), with a closed operator
set:

```jsonc
{
  "op": "and",
  "clauses": [
    { "op": "eq",     "field": "action",            "value": "prod_release_approved" },
    { "op": "eq",     "field": "result",            "value": "ok" },
    { "op": "in",     "field": "inputs.release_id", "value": ["rel_2026_05_02"] },
    { "op": "exists", "field": "inputs.approver_capability" }
  ]
}
```

- Operators (v1): `eq`, `in`, `exists`, `and`, `or`, `not`. No regex, no arithmetic, no
  external lookups.
- A predicate is a **pure function of `(receipt, authority_snapshot)`** only.
- Canonical form = `canonicalize(predicate)`; `canonical_form_hash = blake3(canonical_form)`.
- The verifier **recomputes** this hash and rejects on mismatch (`ABSENCE_PREDICATE_MISMATCH`).

---

## Authority context

There is no standalone "authority graph" object; authority is reconstructed by replaying
`capability_granted` / `capability_revoked` receipts (`applyRegistryReceipt`,
`packages/coordination-kernel/src/capability/registry.ts`). v1 computes an
**authority snapshot** at `to_seq` — the canonical `Actor.id → capabilities[]` map produced
by replaying the chain to `to_seq` — and records `authority_snapshot_hash = blake3(canonical
map)`. This realizes "under authority context A" as a computed, checkable value rather than
an assumed one.

---

## Offline verification steps

Given an absence receipt + the committed chain slice (shipped in a verification bundle), a
verifier MUST, in order:

1. **Receipt integrity** — recompute `inputs_hash` / `outputs_hash` / `event_hash`
   (`verifyReceiptHashes`) and the Ed25519 signature over `${prev_hash}|${event_hash}`.
2. **Chain binding** — re-verify the chain genesis → `to_seq` (`verifyGenesisReceipt` +
   `verifyChainLink` per entry); confirm `slice_first_prev_hash` / `slice_last_event_hash`
   match the receipts at `from_seq` / `to_seq`. Any sequence discontinuity → `ABSENCE_LOG_GAP`.
3. **Predicate canonicalization** — recompute `predicate.canonical_form_hash`; mismatch →
   `ABSENCE_PREDICATE_MISMATCH`.
4. **Authority snapshot** — recompute `authority_snapshot_hash` at `to_seq`; mismatch →
   `ABSENCE_PREDICATE_MISMATCH` (authority component). If `capability_*` receipts that change
   the relevant snapshot fall inside `[from_seq..to_seq]` → `ABSENCE_AUTHORITY_TRANSITION`.
5. **Capture boundary** — confirm the event sources observed are within `boundary.source_set_hash`;
   uncovered source → `ABSENCE_CAPTURE_GAP`. If `capture_completeness_ref` is absent, the
   completeness claim is **downgraded** (info finding), not asserted.
6. **Re-execution (the exclusion proof)** — evaluate P over every receipt in
   `[from_seq..to_seq]`; require `matched_count === 0`. Any match → `ABSENCE_MATCH_FOUND`.
7. **Boundary inspection** — surface `trust_boundary.claims` and `non_claims` in the result.

The verifier output states the **bounded** claim only — never the unbounded "it never
happened."

---

## Result values + failure taxonomy

| `result`               | finding `code`                  | meaning |
|------------------------|---------------------------------|---------|
| `absent`               | (pass)                          | P has zero matches in the verified committed interval |
| `absence_unprovable`   | `ABSENCE_LOG_GAP`               | sequence discontinuity / missing entry in range |
| `absence_unprovable`   | `ABSENCE_AUTHORITY_TRANSITION`  | authority snapshot changed inside the interval |
| `absence_unprovable`   | `ABSENCE_CAPTURE_GAP`           | an event source is outside the capture contract |
| `absence_invalid`      | `ABSENCE_PREDICATE_MISMATCH`    | recomputed predicate/authority hash ≠ receipt |
| `absence_invalid`      | `ABSENCE_MATCH_FOUND`           | re-execution found a matching event (claim is false) |

Codes are `UPPERCASE_SNAKE`, matching `VerifyFinding.code`
(`packages/verification-spine/src/types.ts`). The absence verifier registers as a
`VerifierSpec` (`id: "absence-receipt"`, `bundleCapable: true`) for offline `--bundle` runs.

---

## Design invariants (normative)

1. **Bind to `sequence`, not time (MUST).** Absence is monotone in seq; `from_time`/`to_time`
   are advisory. Disclose that late capture can produce a true event (early `timestamp`, late
   `seq`) after a true seq-range absence.
2. **Predicate purity (MUST).** A predicate is a pure, deterministic function of
   `(receipt, authority_snapshot)`; no external state, no eval-time clock. Impure predicates
   are rejected at registration.
3. **Pre-registration (SHOULD, MUST for high-stakes).** A predicate authored after the
   interval it covers is distrusted. Predicates SHOULD be pinned via
   `absence_predicate_registered` before use; the verifier MAY require the registration seq to
   precede `from_seq`.
4. **Capture completeness is a non-claim unless attested (MUST).** Without
   `capture_completeness_ref`, the receipt answers "is it in our log," not "did it happen."
   The real attack is routing the event through an uncaptured channel; state this plainly.
5. **Authority stability (MUST).** If the relevant authority snapshot changes within the
   interval, v1 returns `absence_unprovable.authority_transition` rather than a false `absent`.

---

## Invariants (Mechanical) — what an absence receipt MUST NOT do

- MUST NOT assert global nonexistence ("never happened"), only bounded non-observation.
- MUST NOT claim capture completeness without a referenced attestation.
- MUST NOT be issued over an interval that is not a contiguous, signature-verified slice.
- MUST NOT use a predicate whose canonical hash the verifier cannot independently recompute.

---

## Deferred (post-MVP; tracked for sequencing)

- **Signed lower-bound checkpoint** `{log_id, seq, head_event_hash, timestamp, signature}` so
  verification pins `from_seq-1` instead of replaying from genesis (compaction only).
- **Authority-transition segmentation** — express a long-interval absence as an AND-chain of
  per-epoch sub-receipts, each under its own authority snapshot.
- **Capture-completeness attestation** receipt + source-set enumeration / per-source liveness.
- **Predicate pre-registration** wired as a hard precondition for high-stakes predicates.
- **Merkle-index compaction** once the receipt/chronicle log grows a real Merkle root, to
  replace O(range) re-execution with a compact non-membership proof.
