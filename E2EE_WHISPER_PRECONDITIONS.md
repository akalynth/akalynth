# E2EE Whisper Preconditions

Lane: AKALYNTH_CHAT_ENCRYPTION_THREAT_MODEL_AND_AUTHORITY_DECISION_V1

Status: decision-only. No implementation.

## Decision

E2EE 1:1 whispers remain a future candidate only. No encryption implementation should start until the preconditions below are designed and accepted.

## Required Preconditions

| Area | Required decision |
|---|---|
| Protocol | Additive encrypted-whisper messages; no overloading of current `chat` |
| Identity binding | Device keys must bind to `player_id` and auth identity |
| Key exchange | Key registration, lookup, rotation, revocation, and stale-key handling |
| Trust model | TOFU, verification code, receipt-bound trust, or another explicit model |
| Android storage | Android Keystore or explicit protected storage design |
| Web/debug-client parity | Support or explicit non-support decision |
| Report flow | Participant disclosure bundle with plaintext/ciphertext binding |
| Metadata policy | Conversation IDs, sender/recipient IDs, key epoch, ciphertext length, timing |
| Receipt boundary | Delivery metadata receipts, not plaintext meaning |
| Replay boundary | Deterministic replay proves ciphertext metadata ordering |
| Lost-key policy | Unrecoverable history, backup, or recovery model stated explicitly |
| Abuse handling | Rate limits and block/report semantics for encrypted metadata |

## Minimum Candidate Envelope

- conversation_id
- sender_player_id
- sender_device_id
- recipient_player_id
- recipient_device_id
- key_epoch
- nonce or message counter
- ciphertext
- ciphertext_hash
- associated_data
- sent_at_ms

## Stop Conditions For Future Implementation

- No device key custody design.
- No report/disclosure design.
- No receipt and replay semantics.
- No Android parity plan.
- Any attempt to change existing world/local `chat` into encrypted payloads.
