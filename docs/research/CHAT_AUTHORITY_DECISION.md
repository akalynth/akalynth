# Chat Authority Decision

Lane: AKALYNTH_CHAT_ENCRYPTION_THREAT_MODEL_AND_AUTHORITY_DECISION_V1

Status: decision-only. No implementation.

## Decision

World, local, global, system, tutorial, Tem, and gameplay-affecting chat are accountable surfaces. They remain server-readable, moderated, receipt-compatible, and replay-compatible.

Private 1:1 whispers may later become a confidentiality surface, but only as a new protocol surface. They are a future candidate, blocked pending key exchange, identity binding, report flow, metadata policy, replay boundary, and Android parity design.

## Authority Table

| Surface | Authority | Confidentiality posture | Accountability posture | V1 decision |
|---|---|---|---|---|
| Local/map world chat | Server | Server-readable plaintext over TLS-protected transport | Audit receipt plus chronicle hash/length | Keep accountable and server-readable |
| Future world/global chat | Server | Server-readable plaintext over TLS-protected transport | Required moderation and receipts | Keep accountable and server-readable if added |
| System chat | Server | Server-origin plaintext | Bound to triggering actions where applicable | Keep server-readable |
| Tutorial chat signal | Server | Server-readable plaintext | Tutorial/receipt compatible | Keep server-readable |
| Tem chat answers | Server | Server-readable plaintext | Challenge pass/fail receipts | Keep server-readable |
| Debug chat commands | Server | Server-readable plaintext | Debug-only command consequences | Keep server-readable while present |
| Private 1:1 whisper | Participant devices plus server metadata broker, if added | Candidate for E2EE later | Participant-supplied reports and metadata receipts | Blocked pending design |
| Party/guild/group chat | Not implemented | E2EE not recommended for V1 | Group accountability unresolved | Do not implement E2EE in V1 |

## Boundaries

- TLS protects transport only; it is not application-level chat encryption and it is not chat E2EE.
- Current plaintext relay is acceptable for pre-alpha if docs do not claim private or encrypted chat.
- Existing `chat` and `chat_broadcast` must not be overloaded into encrypted message envelopes.
- Any encrypted whisper work must be additive and backward-compatible.

## Contract Note

Contract touched: decision docs only.

Compatibility impact: none. No protocol, shared type, server handler, Android, or debug-client behavior changed.

Client action required: none.

Verification: documentation and receipt only; no build or runtime command required.
