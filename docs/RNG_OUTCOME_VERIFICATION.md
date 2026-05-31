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

## Receipt-contained RNG proof v1

Receipt-contained RNG proof v1 lets an offline verifier recompute the recorded RNG
output and final outcome from the receipt artifact alone. It does not prove that
the server committed to the reveal seed before the outcome. Precommit anchoring
remains future work tracked in #101.

### What is persisted

The final `combat_resolved` receipt now carries `inputs.rng_proof`:

```
inputs.rng_proof = {
  version: 1,
  scheme: "receipt_hash_seeded_replay",
  outcome_type: "loot_drop",
  receipt_body_hash: <drop_seed_hash>,   // = computeReceiptHash(combatResolvedBase)
  rng_commit: <commit>,                  // v0: rngCommit(reveal_seed)
  reveal_seed: <drop_seed_hash>,         // seed fed to the PRF
  rng_out: [<u32>, ...],                 // raw draws, in selection order
  derivation: {
    algorithm: "rngDrawU32Legacy/selectItemsToDrop@v0",
    domain: "pvp_loot_drop",
    inputs: {
      items: [ { item_id, item_type, meta?{ legendary, legendary_tier, heat } } ],
      reputation, map, protected_item_id
    }
  }
}
```

`derivation.inputs` is **exactly** what `computeDeathDrops` consumed. Legendary
weighting depends on per-item heat (server in-memory state), so each legendary
item's heat at selection time is folded into `meta.heat`. The verifier rebuilds a
heat lookup from those values and feeds the shared `packages/shared/dropPolicy.ts`
selector, so the recompute never touches live server state or SQLite.

### Supported outcome: `loot_drop`

For a `loot_drop` proof the verifier (`packages/shared/verifyOutcome.ts`) checks,
offline, from the receipt alone:

- **receipt_body_hash** — recompute `computeReceiptHash(combatResolvedBase)` from
  the receipt's named subset and require it to equal both `rng_proof.receipt_body_hash`
  and `inputs.drop_seed_hash` (else `RECEIPT_BODY_HASH_MISMATCH`).
- **rng_commit_reveal** — `rngCommit(reveal_seed) === rng_commit` when a commit is
  present (else `COMMIT_MISMATCH` + `LEGACY_PRECOMMIT_UNBOUND`), and
  `rng_out[i] === rngDrawU32Legacy(reveal_seed, i)` for every draw (else
  `RNG_OUTPUT_MISMATCH`).
- **outcome_derivation** — recompute `computeDeathDrops(items, map, reputation,
  reveal_seed, [], heatLookup)` and compare to `inputs.dropped_item_ids` (else
  `OUTCOME_MISMATCH`).
- **precommit_anchoring** — always `fail` / `PRECOMMIT_NOT_PROVEN` (see below).

When all checked steps pass, `final_status` is **`rng_consistent`**. Any checked
failure yields `failed`. A proof with an `outcome_type` other than `loot_drop`
yields `unsupported` / `UNSUPPORTED_OUTCOME_TYPE`.

### Why this moves `replay_consistent` → `rng_consistent`

Before v1, a persisted receipt carried only the drop fields, so the verifier could
recompute the *seed binding* (deterministic replay) but had no RNG triple and no
inventory snapshot — best attainable was `replay_consistent`. The persisted
`rng_proof` now supplies the commit/reveal/output triple **and** the exact drop
inputs, so the verifier can re-derive both the RNG output and the dropped set
offline. That is strictly more than replay: it is `rng_consistent`.

### Why it still is not precommit fairness (#101)

The seed is `computeReceiptHash(combatResolvedBase)` — derived from the outcome's
own fields, not from a hidden secret the server bound to *before* the outcome was
known. The persisted `rng_commit` (v0) is `rngCommit(reveal_seed)`, which binds the
revealed seed but not a *prior* commitment. So `precommit_anchoring` stays `fail`,
the verifier never returns `verified`, and the ceiling is `rng_consistent`.
Precommit anchoring is tracked in #101.

### Commit scheme: `death_drop:v0` vs `death_drop:v1`

The proof records `rng_commit_scheme`, because the server emits two commit kinds:

- **`death_drop:v0`** — `rng_commit === rngCommit(reveal_seed)`. Reproducible
  offline, so a mismatch is genuine tampering → `COMMIT_MISMATCH`, `final_status:
  failed`. A valid v0 receipt reaches `rng_consistent`.
- **`death_drop:v1`** — a deferred, domain/actor-separated precommit (registered
  before the kill) that **cannot be reproduced from the receipt alone**. A
  legitimate v1 receipt is **not** a failure: `rng_commit_reveal` is `unsupported`
  (`LEGACY_PRECOMMIT_UNBOUND`), the RNG output and dropped set still verify, and
  `final_status` is **`replay_consistent`**. The verifier must never report a
  legitimate v1 receipt as `failed`. Actually verifying the v1 precommit — proving
  it was recorded *before* the outcome and bound to derivation — is #101.

This distinction matters in practice: the live server emits v1 commits whenever a
session has a precommit registered, so most real loot receipts verify as
`replay_consistent` today. `rng_consistent` applies to the v0 commit path. Either
way, RNG-output recomputation and outcome derivation are checked, and a tampered
`rng_out` / outcome / body hash fails under **both** schemes.

### Hash-preimage boundary (no circularity)

`rng_proof` is added to the FINAL persisted receipt **inside `inputs`**, alongside
`dropped_item_ids` / `drop_seed_hash`. It is **never** part of `combatResolvedBase`,
the named subset hashed to produce the seed. The verifier reconstructs
`combatResolvedBase` from only `{actor_id, action, inputs.{target_player_id, map,
position, outcome}, result}`, ignoring `rng_proof` and the drop fields. This keeps
the seed and the loot selection unchanged when the proof is added, and prevents the
proof from feeding back into the seed it claims to prove. The seed-invariant test
(`tools/verify-outcome/test.ts`) asserts `computeReceiptHash(combatResolvedBase)` is
byte-identical with and without the envelope.

## Known limitations (findings)

### F1 — RESOLVED (#100): the RNG proof is now persisted to the receipt

Historically the `rng_commit` / `rng_reveal` / `rng_out` triple was emitted only on
the live client broadcast, so a persisted receipt verified offline could reach at
best `replay_consistent`. As of #100 the receipt carries `inputs.rng_proof` (see
"Receipt-contained RNG proof v1" above), and an offline verifier reaches
`rng_consistent`. The original broadcast-only behavior is described below for
historical context.

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

## Precommit-anchored RNG proof v2 (#101)

F2 (above) is addressed by an **opt-in** v2 scheme that binds the loot-drop seed to
a chronicle-ordered precommit.

### Feature flag (default OFF)

`AKALYNTH_RNG_V2` (`parseBoolEnv`, default **false**). When unset/false, combat RNG
output **and** the persisted receipt proof are **byte-identical** to the #100 v1
path — proven by `cd apps/server && npm run verify:heat` (flag unset) and the
unchanged #99/#100 fixtures in `tools/verify-outcome/test.ts`. v2 activates only
when the flag is ON **and** the session carries a `death_drop:v1` reveal + commit +
chronicle ref; otherwise it transparently falls back to v1.

### Derivation

```
derivedSeed = rngDeriveSeedV2(reveal, worldId, eventDomain, eventPreimageHash)
            = blake3("akalynth:rng:v2:derive\0" || reveal || worldId
                       || eventDomain || eventPreimageHash)         -> blake3:<hex>
```

- `reveal` — the 32-byte secret the server committed to **on spawn** (`rng_commit`
  chronicle event, `commit = rngCommitV1('death_drop:v1', actorDid, reveal)`).
- `eventPreimageHash` — `computeReceiptHash(combatResolvedBase)`, the **same** seed
  preimage as v1. The seed *preimage boundary* is unchanged; only the seed *value*
  fed to `rngDrawU32Legacy` / `selectItemsToDrop` differs. A v2 seed-invariant test
  asserts `combatResolvedBase`'s hash is byte-identical with and without the v2
  envelope.

`derivedSeed` is domain-separated and versioned so it can never collide with the
v0/v1 receipt-hash seed.

### Ordering IS chain-proven (#104) — `verified` is reachable

For the proof to mean "the server committed *before* the outcome," the commit must
be provably ordered before the `combat_resolved` outcome, with the reveal after it:

- `rng_commit` (spawn) — must precede the outcome.
- `combat_resolved` (the loot outcome) — carries `inputs.rng_proof` v2 with
  `precommit_ref:{ chronicle_seq, chronicle_hash, commit }`, `event_preimage_hash`,
  `event_domain`, `world_id`, `rng_out`, and `derivation`. **It does NOT carry the
  reveal secret** — publishing it early would break hiding for later kills in the
  same session.
- `rng_reveal` (disconnect) — must follow the outcome; the verifier reads the reveal
  from this chronicle event, not from the receipt.

The chronicle log records this order via its **global hash chain**
(`prev_global_hash`/`global_event_hash`, Seal 2.3). **#104 verifies ordering against
that chain.** The caller supplies a `chronicle: ChronicleEntry[]` slice — an ordered
slice of parsed chronicle entries with their global-chain fields — and the verifier
itself **re-checks the global chain over that slice** (recomputing every
`payload_hash`/`event_hash`/`global_event_hash` and checking each `prev_global_hash`
link), using the **same computation** as
`apps/server/tools/verify-chronicle-chain.ts` (shared in
`packages/shared/chronicleChain.ts`, the single source of truth). A broken link →
`failed` (`CHRONICLE_CHAIN_BROKEN`). Caller-supplied ordinals are **never** trusted:
ordering rests only on the link-checked **position** within the verified slice.

The relevant events are matched as follows. The `death` outcome event is located by
`event_type === 'death'` AND `payload.drop_seed_hash === proof.event_preimage_hash`
(the combat seed) AND `actor === did:akalynth:<victim>` (the victim DID, derived from
`inputs.target_player_id`). The `rng_commit` and `rng_reveal` are the same victim
actor's `death_drop:v1` events. Ordering requires
`commit_pos < death_pos < reveal_pos` within the verified slice; a violation (e.g. a
commit recorded **after** the death) → `failed` (`PRECOMMIT_OUT_OF_ORDER`). This is
the mis-order case that the #101 downgrade could **not** catch.

### Verifier states (#104)

`verifyOutcomeFromReceipt(receipt, context?)` with
`context = { chronicle?: ChronicleEntry[], revealSeed?, authPublicKeyHex? }`:

| Situation | chronicle_inclusion | precommit_anchoring | final_status | reason code |
|---|---|---|---|---|
| verified slice (commit<death<reveal) + binding/derivation + **pubkey** | pass | pass | **verified** | `PRECOMMIT_ANCHORED` |
| verified slice + binding/derivation, **no pubkey** | pass | pass | **rng_consistent** | `PRECOMMIT_ANCHORED`, `RECEIPT_SIGNATURE_NOT_CHECKED` |
| commit recorded **after** the death in the chain | fail | fail | **failed** | `PRECOMMIT_OUT_OF_ORDER` |
| broken global-chain link in the slice | fail | fail | **failed** | `CHRONICLE_CHAIN_BROKEN` |
| death event missing / `drop_seed_hash` mismatch | fail | fail | **failed** | `OUTCOME_EVENT_NOT_FOUND` |
| commit<death present, reveal **not yet** in slice | not_checked | not_checked | **replay_consistent** | `REVEAL_NOT_PUBLISHED` |
| **no** chronicle slice supplied | not_checked | not_checked | **rng_consistent** | `ORDERING_NOT_CHAIN_PROVEN` |
| `rngCommitV1(...) != precommit_ref.commit` | (n/a) | fail | **failed** | `PRECOMMIT_COMMIT_MISMATCH` |
| `rng_out[i]` not derived from `derivedSeed` | (n/a) | fail | **failed** | `RNG_OUTPUT_MISMATCH` |
| recomputed drops != `dropped_item_ids` | (n/a) | fail | **failed** | `OUTCOME_MISMATCH` |
| `event_preimage_hash` != recomputed seed | (n/a) | fail | **failed** | `EVENT_PREIMAGE_HASH_MISMATCH` |

`receipt_authenticity` (Ed25519 over `prev_hash|event_hash`, supplied via
`authPublicKeyHex` / CLI `--pubkey`) gates `verified`: a bad signature → `failed`, a
missing pubkey caps a fully-anchored proof at `rng_consistent` (+ `PRECOMMIT_ANCHORED`).

### When "verified" is reachable

`verified` requires **all five** of `{precommit_anchoring, rng_commit_reveal,
outcome_derivation, receipt_authenticity, chronicle_inclusion}` to pass — i.e. a
chain-verified slice (ordered `commit < death < reveal`), a commit that binds the
reveal, a matching derivation/outcome, AND a supplied auth pubkey whose signature
verifies. It can **never** rest on caller-supplied ordinals — only on the verified
slice + supplied pubkey. **Receipt-only / no-slice callers still cap at
`rng_consistent`** (`ORDERING_NOT_CHAIN_PROVEN`), so existing callers are unaffected.
v1/legacy receipts are **unchanged**: never `verified`, `precommit_anchoring` stays
`fail`, replay/rng-consistent at best.

### What v2 proves — and does not (honest residual)

v2 proves: **the server committed to the seed before the outcome and derived the
outcome from it.** v2 does **not** prove the seed was unbiased, that the server
could not choose among multiple precommits, that no trust in the server is
required, or that any client entropy was mixed in. In particular, the
`death_drop:v1` precommit is **session-level**: a single reveal covers **all** kills
in a session. That is an honest precommit-before-outcome, but it is **not**
per-event unpredictability — knowing the reveal (after disconnect) lets anyone
recompute every drop in that session.
