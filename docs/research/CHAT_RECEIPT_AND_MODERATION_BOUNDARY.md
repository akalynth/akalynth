# Chat Receipt And Moderation Boundary

Lane: AKALYNTH_CHAT_ACCOUNTABLE_WORLD_CHAT_BASELINE_V1

Status: baseline only. No encryption and no runtime mutation.

## Current Receipt Boundary

Accepted normal world chat is receipt-bearing:

- `action: 'chat'`
- `inputs: { message: msg.message }`
- `result: 'ok'`

Throttled chat can also write a `chat` receipt with:

- `inputs: { message: msg.message }`
- `result: 'rate_limited'`

This means current accountable world chat is server-readable and receipt-compatible. It is not confidential from the server.

## Chronicle Boundary

Accepted normal chat emits a chronicle event with:

- actor DID
- player ID
- map
- message length
- SHA-256 message hash

The chronicle payload records hash/length evidence, not plaintext body text.

## Moderation Boundary

Current world chat remains compatible with future moderation because the server can read message bodies and the private audit receipt can contain plaintext chat inputs where receipts are retained.

The current moderation/reporting system does not implement encrypted-message reports. If private encrypted whispers are later added, reports must be participant-supplied evidence with plaintext/ciphertext binding; they must not rely on server omniscience.

## Durability Boundary

The inspected persistence schema has no dedicated durable chat-history table. Current player-facing chat history should be treated as runtime/client rolling state plus receipt/chronicle side effects where emitted, not as a durable chat-history product.

## V1 Exclusions

- No E2EE for world chat.
- No encrypted whisper implementation.
- No protocol redesign.
- No schema migration.
- No runtime data migration.
- No new encryption library.
