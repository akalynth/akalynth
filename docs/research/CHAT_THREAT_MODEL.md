# Chat Threat Model

Lane: AKALYNTH_CHAT_ENCRYPTION_THREAT_MODEL_AND_AUTHORITY_DECISION_V1

Status: decision-only. No implementation.

## Assets

- Player-visible chat bodies.
- Sender and recipient identities.
- Map/channel context.
- Message timing and delivery metadata.
- Audit receipts and chronicle events.
- Moderation reports and disclosure artifacts.
- Future device keys, if encrypted whispers are added.

## Current Trust Boundary

Current chat is a plaintext application message over WebSocket transport. TLS/WSS may protect network transport, but the server reads chat bodies and uses them for gameplay, anti-abuse, receipts, and broadcast.

Current chat is not E2EE.

## Threats For Accountable Chat

| Threat | Current mitigation | Decision |
|---|---|---|
| Network observer reads chat | TLS/WSS transport where configured | Keep TLS-required posture; do not describe it as E2EE |
| Player spams chat | Per-IP and anti-cheat rate paths | Keep server-readable metadata and enforcement |
| Player uses chat to satisfy Tem | Server reads body | Keep server-readable |
| Player disputes a chat consequence | Receipt and chronicle evidence | Keep receipt-compatible |
| Player sends abusive content | Server/receipt visibility enables future moderation tooling | Keep world/global chat accountable |
| Operator overclaims privacy | No app-level encryption found | Document plaintext relay clearly |

## Threats For Future Encrypted Whispers

| Threat | Required design before implementation |
|---|---|
| False report with invented plaintext | Participant disclosure must bind plaintext to ciphertext and delivery receipt |
| Device key impersonation | Device public keys must bind to `player_id` with receipts |
| Lost device key | Lost-key policy must state unrecoverable history or backup model |
| Metadata abuse | Server must rate-limit by sender, recipient, conversation, and ciphertext metadata |
| Moderation blind spot | Reports must be participant-supplied evidence, not server omniscience |
| Replay ambiguity | Receipts must prove metadata ordering and ciphertext hashes |
| Android divergence | Android protocol parity and key storage must be designed first |

## Non-Goals

- No encryption implementation in this lane.
- No protocol changes.
- No schema changes.
- No claim that any encryption model is complete or release-ready.
