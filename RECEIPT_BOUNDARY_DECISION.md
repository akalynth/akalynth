# Receipt Boundary Decision

Lane: AKALYNTH_CHAT_ENCRYPTION_THREAT_MODEL_AND_AUTHORITY_DECISION_V1

Status: decision-only. No implementation.

## Decision

Do not change current `chat` receipt semantics in V1.

Current world/local chat remains server-readable and receipt-compatible. Future encrypted whispers, if added, must use new receipt actions and metadata semantics rather than changing the meaning of existing `chat` receipts.

## Current Boundary

| Evidence | Current behavior | Decision |
|---|---|---|
| Audit receipt for accepted chat | `action='chat'`, plaintext `inputs.message`, result `ok` | Keep unchanged in V1 |
| Audit receipt for throttled chat | `action='chat'`, plaintext `inputs.message`, result `rate_limited` | Keep unchanged in V1 |
| Chronicle chat event | actor/map plus `message_len` and `message_hash` | Keep hash/length evidence boundary |
| SQLite chat history | Dedicated chat table not found | Do not claim durable chat history |

## Future Encrypted Whisper Receipt Shape

Future encrypted whispers should use a new receipt action such as encrypted delivery metadata, not `chat`.

Candidate metadata:

- conversation_id
- sender_player_id
- sender_device_id
- recipient_player_id
- recipient_device_id
- key_epoch
- ciphertext_hash
- ciphertext_len
- nonce or counter
- delivery status

## Replay Boundary

Replay can prove:

- metadata order
- sender/recipient identifiers
- delivery status
- ciphertext hash/length
- key epoch references

Replay cannot prove:

- human-readable plaintext meaning
- harassment content
- consent/context

Those require participant disclosure evidence.

## Verification Boundary

No receipt-chain command was run in this lane because no receipt schema or runtime receipt data changed. Future implementation must add fixtures before any encrypted whisper claim.
