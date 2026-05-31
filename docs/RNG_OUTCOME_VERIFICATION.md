# RNG Outcome Verification (Offline)

This document describes the offline RNG outcome verifier shipped in
`tools/verify-outcome/` and `packages/shared/verifyOutcome.ts`.

> This verifier checks whether a recorded RNG-backed outcome can be recomputed
> from its receipt fields. It does not, by itself, prove that the server
> committed to the seed before the outcome unless the receipt or chronicle
> provides a prior commitment anchor.

The verifier is **pure and deterministic**: it performs no network calls, opens
no SQLite database, and reads no server state. It takes a single receipt object
and returns a structured result.

## What it checks

For a `combat_resolved` receipt:

1. **Receipt shape** — the receipt is an object with `action === "combat_resolved"`
   and `inputs` carrying `target_player_id`, `map`, `position`, `outcome`,
   `dropped_item_ids`, and `drop_seed_hash`.
2. **Seed binding (deterministic replay)** — the verifier reconstructs the base
   object the server hashed to produce the drop seed:

   ```json
   {
     "actor_id": "<actor>",
     "action": "combat_resolved",
     "inputs": {
       "target_player_id": "<...>",
       "map": "<...>",
       "position": { "x": 0, "y": 0 },
       "outcome": "<...>"
     },
     "result": "ok"
   }
   ```

   It hashes that base with the same canonical hashing the server uses
   (`computeReceiptHash` in `apps/server/src/persist/hash.ts`: BLAKE3 over
   canonical JSON with recursively sorted keys, excluding `event_hash` and
   `signature`) and compares the result to `inputs.drop_seed_hash`. A match means
   the recorded seed is consistent with the recorded outcome fields.
3. **RNG commit/reveal triple** — *only if* the receipt also carries
   `rng_commit`, `rng_reveal`, and `rng_out`. The verifier checks
   `rngCommit(reveal) === commit` and `rng_out[i] === rngDrawU32Legacy(reveal, i)`
   for every draw. (See the F1 caveat below — persisted receipts normally do
   **not** carry this triple.)

## What it does NOT check

- **Receipt authenticity / signature** — not checked offline. There is no public
  key available to the verifier, so signature validity is reported as
  `not_checked` (`RECEIPT_SIGNATURE_NOT_CHECKED`).
- **Chronicle inclusion** — not checked. Whether this receipt is actually part of
  the canonical, hash-linked chronicle is out of scope for this offline tool
  (`CHRONICLE_INCLUSION_NOT_CHECKED`).
- **Full drop-SET derivation** — the verifier does **not** recompute the exact set
  of dropped items via `computeDeathDrops`. That requires the defender's full
  inventory snapshot and reputation at the moment of death, neither of which is
  carried by the receipt. This is reported as `outcome_derivation: "unsupported"`
  (`MISSING_INPUTS`). We deliberately do not fake this.
- **Pre-commitment / provable fairness** — see the trust boundary and precommit
  caveat below. `precommit_anchoring` is always `fail` (`PRECOMMIT_NOT_PROVEN`)
  for `combat_resolved`.

## Required receipt fields

| Field | Required | Used for |
| --- | --- | --- |
| `action` | yes | dispatch (`"combat_resolved"`) |
| `actor_id` | yes | seed-binding base |
| `inputs.target_player_id` | yes | shape + seed-binding base |
| `inputs.map` | yes | shape + seed-binding base |
| `inputs.position` | yes | shape + seed-binding base |
| `inputs.outcome` | yes | shape + seed-binding base |
| `inputs.dropped_item_ids` | yes | shape |
| `inputs.drop_seed_hash` | yes | seed-binding comparison |
| `result` | (assumed `"ok"`) | seed-binding base |
| `rng_commit` / `rng_reveal` / `rng_out` | optional | RNG commit/reveal triple (broadcast-only; see F1) |

## Supported outcome types

Only **`combat_resolved`** (death-drop) is supported. Any other `action` returns
`final_status: "unsupported"` with reason code `UNSUPPORTED_OUTCOME_TYPE`.

## CLI usage

```sh
# from repo root
npx tsx tools/verify-outcome/src/index.ts path/to/receipt.json
# or via npm script
npm run verify:outcome -- path/to/receipt.json
```

The CLI prints the `OutcomeVerificationResult` as machine-readable JSON. It exits
`1` when `final_status` is `failed`, `2` on usage/IO/JSON errors, and `0`
otherwise (`replay_consistent`, `rng_consistent`, `unsupported`).

Fixture tests:

```sh
npm run verify:outcome:test
# or
npx tsx tools/verify-outcome/test.ts
```

## Result fields and `final_status` meanings

The result type:

```ts
type OutcomeVerificationResult = {
  receipt_shape_valid: boolean;
  receipt_authenticity: "pass"|"fail"|"not_checked"|"unsupported";
  chronicle_inclusion: "pass"|"fail"|"not_checked"|"unsupported";
  rng_commit_reveal: "pass"|"fail"|"not_checked"|"unsupported";
  outcome_derivation: "pass"|"fail"|"not_checked"|"unsupported";
  precommit_anchoring: "pass"|"fail"|"not_checked"|"unsupported";
  final_status: "verified"|"rng_consistent"|"replay_consistent"|"failed"|"unsupported";
  reason_codes: string[];
};
```

`final_status` values:

- **`replay_consistent`** — shape and seed binding pass; no RNG triple was present
  to check. The recorded outcome can be deterministically reproduced from the
  receipt's own fields. This is the **maximum** status for a persisted
  `combat_resolved` receipt today.
- **`rng_consistent`** — shape and seed binding pass **and** an RNG commit/reveal
  triple was present and its math checks out. Stronger than `replay_consistent`,
  but still **not** `verified` (precommit anchoring is unproven).
- **`failed`** — a checked step failed (e.g. seed binding mismatch, commit
  mismatch, RNG output mismatch, or a shape violation).
- **`unsupported`** — the outcome type is not supported, or seed binding could not
  be run.
- **`verified`** — would require receipt authenticity **and** RNG commit/reveal
  **and** outcome derivation **and** precommit anchoring to all pass. With the
  current receipt shape and offline trust model this **cannot** be reached for
  `combat_resolved`. The verifier never emits it for this outcome.

## Trust boundary

The Akalynth server is the **execution authority**: it generates randomness,
applies combat, and writes receipts. This offline verifier is a **consistency
checker**, not an authority. It can confirm that a receipt's recorded outcome is
internally self-consistent (deterministic replay of the seed binding, and — when
present — the RNG draw math). It cannot, on its own, establish that the server
behaved honestly, that the receipt is authentic/signed, or that it is included in
the canonical chronicle. Those require the signing public key and the chronicle
chain, which are outside this tool's offline scope.

## Precommit caveat

For the death-drop outcome, the seed used to draw loot is
`computeReceiptHash(combatResolvedBase)` — the BLAKE3 hash of the receipt's own
content (`apps/server/src/world/combat.ts`). This is **deterministic replay**, not
precommitment fairness: the "seed" is derived from the outcome's own fields rather
than from a hidden secret the server bound to *before* the outcome was known.
There is no pre-committed hidden secret anchoring the death-drop outcome.
Accordingly, `precommit_anchoring` is always `fail` with reason
`PRECOMMIT_NOT_PROVEN`, and we avoid any fairness-guarantee framing.

## Known limitations (findings)

### F1 — The RNG proof triple is broadcast-only, not persisted to receipts

The `rng_commit` / `rng_reveal` / `rng_out` triple is emitted on the **live client
broadcast** (`apps/server/src/index.ts`, chronicle `death` event), but the
persisted `combat_resolved` **receipt** carries only
`inputs.{target_player_id, map, position, outcome, dropped_item_ids,
drop_seed_hash, protected_item_id}`. As a result, when verifying a persisted
receipt the `rng_commit_reveal` check is `unsupported` (`MISSING_RNG_COMMIT`), and
the best attainable status is `replay_consistent`. To reach `rng_consistent`
offline you must feed the verifier a broadcast-like object that still carries the
triple.

### F2 — v1 precommit exists but is not bound to outcome derivation

A domain-separated v1 commitment scheme exists (`rngCommitV1`, `death_drop:v1`,
revealed on disconnect), but it is **not bound to the death-drop outcome
derivation**: the drop seed is still the receipt-content hash described above, not
the v1 reveal. Until a prior commitment anchor is bound to the outcome and carried
in the receipt or chronicle, `precommit_anchoring` cannot move off `fail`, and the
verifier cannot reach `verified`.
