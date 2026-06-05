# Receipt And Proof Impact

Status: research only. No implementation.

## Current Proof Shape

Receipts are canonical, signed, hash-linked JSONL evidence. SQLite is derived. The audit logger writes receipts and then materializes them into projections.

Evidence:

- Audit logger writes through coordination-kernel receipt logger: `apps/server/src/audit/logger.ts:1`.
- Receipt logger computes sequence, timestamp, previous hash, input hash, output hash, event hash, and signature: `packages/coordination-kernel/src/receipt/logger.ts:76`.
- Receipt hashes canonicalize receipt inputs: `packages/coordination-kernel/src/receipt/hasher.ts:27`.
- Server materializes every receipt and attempts chronicle materialization: `apps/server/src/persist/materializers.ts:103`.

## Current Chat Receipt Behavior

Accepted chat:

- Receipt action: `chat`.
- Actor: player.
- Inputs: `{ message: msg.message }`.
- Result: `ok`.

Rate-limited chat while throttled:

- Receipt action: `chat`.
- Inputs: `{ message: msg.message }`.
- Result: `rate_limited`.

Chronicle chat:

- Event type: `chat`.
- Payload includes player ID, map, `message_len`, and `message_hash`.
- Plaintext is not stored in chronicle payload.

## What Encryption Would Break

If current `chat` message bodies become ciphertext:

- Existing receipt semantics change from "player said this plaintext" to "player sent this ciphertext".
- Tem challenge via chat breaks unless plaintext remains server-readable.
- Tutorial chat content/blank checks need redesign.
- Debug command parsing breaks.
- Moderation loses receipt-backed plaintext evidence.
- Chronicle `message_hash` would hash ciphertext unless a plaintext disclosure protocol exists.
- Replay can still prove ciphertext ordering but not human-readable meaning.

## Receipt Options For Future E2EE

### Option A: Metadata-only delivery receipt

Receipt inputs:

- conversation_id
- sender_player_id
- sender_device_id
- recipient_player_id or recipient_device_id
- key_epoch
- ciphertext_hash
- ciphertext_len
- nonce/counter

Pros: server does not store plaintext.

Cons: no body moderation or semantic proof without participant disclosure.

### Option B: Participant disclosure receipt

When reporting, participant submits plaintext plus ciphertext binding.

Receipt inputs:

- report_case_id
- message_delivery_receipt_hash
- disclosed_plaintext_hash
- ciphertext_hash
- reporter_id
- target_id
- disclosure_reason

Pros: preserves an audit trail for reported content.

Cons: privacy changes after report; requires client-side proof correctness.

### Option C: Server-readable encrypted-at-rest receipt

Server encrypts message bodies before writing receipts, while retaining decryption capability.

Pros: protects files at rest if keys are isolated.

Cons: weak privacy against server/operators; key custody and replay tooling become complex; receipt verification may require decryption rights.

## Proof Artifacts Required Before Implementation

- Fixture proving normal world chat still works unchanged if world chat remains plaintext.
- Fixture proving encrypted delivery receipts verify without plaintext.
- Fixture proving report disclosure binds plaintext to ciphertext and delivery receipt.
- Fixture proving tampered ciphertext/report disclosure fails verification.
- Android parity test for key registration and encrypted message envelope.
- Replay test showing encrypted metadata receipts are deterministic.
- Migration test for old plaintext chat receipts.
- Protocol sync/golden update for any new message type.

## V1 Recommendation

Do not alter current `chat` receipt schema in V1. Keep plaintext chat receipts for existing server-readable world/local chat. Plan future encrypted whispers as a new receipt action rather than changing `chat`.
