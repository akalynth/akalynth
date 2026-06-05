# Chat Surface Policy

Lane: AKALYNTH_CHAT_ENCRYPTION_THREAT_MODEL_AND_AUTHORITY_DECISION_V1

Status: decision-only. No implementation.

## Policy

World chat is accountable. Private whispers may later become confidential. Reports for encrypted messages must be participant-supplied evidence, not server omniscience.

## Surface Classification

| Surface | Status | Accountability | Confidentiality | Policy |
|---|---|---|---|---|
| Current local/map chat | implemented | Required | Server-readable over TLS-protected transport | Keep unchanged for V1 |
| `chat_broadcast` | implemented | Required | Server-readable/server-origin plaintext | Keep unchanged for V1 |
| Debug client chat UI | implemented | Mirrors current protocol | No app-level encryption | Keep compatible |
| Android chat UI/protocol path | implemented | Mirrors current protocol | No app-level encryption | Keep compatible |
| Android ChatChannel action enum | partially implemented | Client-side only | No server/shared protocol effect | Do not treat as canonical chat routing |
| Dedicated chat history | not found | Not defined | Not defined | Do not claim durable chat history |
| Chat content filtering | planned/documented only | Intended future moderation | No encryption dependency | Plan separately |
| Private whisper | not found | Requires report path | Candidate for future E2EE | Block pending preconditions |
| Party/guild/group chat | not found | Group accountability unresolved | E2EE not recommended for V1 | Do not implement E2EE in V1 |
| App-level chat encryption | not found | Not defined | Not implemented | Do not claim |

## V1 Claims Allowed

- Current chat is a plaintext protocol/server relay.
- Transport can be TLS/WSS protected.
- Server can read current chat bodies.
- Current chat has receipt and chronicle side effects where emitted.
- Player-facing durable chat history is not implemented.

## V1 Claims Not Allowed

- Chat is encrypted end-to-end.
- TLS/WSS is application-level chat encryption.
- World chat is private from the server.
- Encrypted whispers exist.
- Durable chat history exists.
- Moderation for encrypted messages is implemented.
