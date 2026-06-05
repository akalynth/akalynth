# Chat Surface Classification

Status: research only. No implementation.

## Implemented Surfaces

| Surface | Implemented | Current body visibility | Server use | Receipt/proof behavior | V1 classification |
|---|---:|---|---|---|---|
| Local/map world chat | Yes | Server-readable plaintext | Broadcast, tutorial signal, Tem response, anti-spam, debug commands | Plaintext in audit receipt; hash/length in chronicle | Keep server-readable |
| System chat broadcast | Yes | Server-origin plaintext | Feedback and debug/system messages | Usually tied to triggering receipts, not a standalone encrypted surface | Keep server-readable |
| Tem response through chat | Yes | Server-readable plaintext | Challenge pass/fail | Writes Tem challenge receipts, not normal chat broadcast | Keep server-readable |
| Debug chat commands | Yes, DEBUG only | Server-readable plaintext | `/legendary`, `/heat` | Emits command-related receipts/state | Keep server-readable while present |

## Planned Or Partial Surfaces

| Surface | Evidence | Current status | Encryption classification |
|---|---|---|---|
| Android local/global/party/guild/whisper action model | `apps/android/app/src/main/java/com/akalynth/client/action/ActionIntent.kt` has `ChatChannel` values | Client-side model only; not canonical shared protocol/server behavior | Do not treat as implemented; if used later, classify per surface |
| Private whisper | No shared protocol/server handler | Not implemented | Candidate for future E2EE only after key/report/proof design |
| Party chat | No shared protocol/server handler | Not implemented | E2EE not recommended for V1; group key management not ready |
| Guild chat | No shared protocol/server handler | Not implemented | E2EE not recommended for V1; persistent group membership/key rotation not ready |
| World/global chat | No separate canonical global chat handler | Not implemented beyond local/map chat | Keep server-readable if added because moderation and abuse cost are high |

## Current Visibility

Visible to server:

- Sender `player_id`.
- Sender display name.
- Map.
- Plaintext message body.
- Message length.
- Message hash in chronicle payload.
- Timestamp via receipt and chronicle.
- IP-derived rate-limit metadata when rate-limited.

Visible to other players on same map:

- Sender ID/name.
- Plaintext message body.
- Approximate timing.

Visible in receipts:

- Plaintext message for accepted chat and throttled chat receipts.
- Result status.
- Actor ID and receipt timestamp.

Visible in chronicle:

- Message length.
- SHA-256 message hash.
- Actor DID and map.
- No plaintext body.

## V1 Recommendation By Surface

| Surface | V1 action |
|---|---|
| Current local/map chat | Keep server-readable over TLS-protected transport |
| Tem chat answers | Keep server-readable |
| System chat | Keep server-readable |
| Debug commands | Keep server-readable or move out of chat later |
| 1:1 whispers | Candidate for a future E2EE lane; blocked pending key/report/protocol design |
| Party/guild/group chat | E2EE not recommended for V1 |
| World/global chat | If added, keep server-readable |
