# Akalynth Chat Encryption Research V1

Status: closed_chat_encryption_research_current_chat_surface_plaintext_relay_no_encryption_implementation_no_runtime_mutation

This document is research and classification only. It does not implement encryption, change protocol files, change receipts, add dependencies, run builds, restart services, or inspect live data.

## Summary

V1 posture: keep chat server-readable over existing TLS-protected transport. TLS protects transport; it is not application-level chat encryption and it is not chat E2EE.

Reason: the only canonical chat surface today is gameplay-local plaintext `chat` -> `chat_broadcast`. The server currently uses chat content for Tem challenge answers, tutorial completion, debug commands, receipts, and map broadcast. The receipt chain stores accepted and throttled chat bodies in `inputs.message`, while chronicle chat events store only `message_len` and a SHA-256 body hash. Moderation currently stores report metadata, not message excerpts or encrypted payload disclosure. Android and debug-client both send/receive plaintext chat frames.

E2EE is a future candidate only for a new 1:1 whisper surface, not by changing existing world/local chat. That candidate is blocked pending key, report, protocol, replay/proof, metadata-retention, lost-key, and Android parity design before any implementation.

## Observed Facts

Observed means found in repo files during this read-only inspection.

- Current chat protocol is `chat` with a plaintext `message`: `packages/shared/protocol.ts:45`.
- Current chat broadcast is `chat_broadcast` with `player_id`, `name`, and plaintext `message`: `packages/shared/protocol.ts:373`.
- Protocol docs say chat can satisfy a Tem challenge: `docs/PROTOCOL.md:64`.
- Server chat handler processes plaintext for Tem response, tutorial completion, debug commands, audit receipts, map broadcast, and chronicle hashing: `apps/server/src/index.ts:3259`.
- Accepted chat receipt currently writes plaintext: `apps/server/src/index.ts:3408`.
- Chronicle chat event stores `message_len` and `message_hash`, not plaintext: `apps/server/src/index.ts:3411`.
- Anti-cheat chat spam detector uses message timing/count, not body semantics: `apps/server/src/anticheat/detector.ts:170`.
- Tem challenge explicitly asks the player to type `AZURA` in chat: `apps/server/src/anticheat/tem.ts:30`.
- Persistence matrix says chat is mostly runtime/receipt-dependent and local-only as a release claim: `docs/PERSISTENCE_MATRIX.md:42`.
- Moderation report queue stores reporter, target, time, and receipt hash, not message body: `apps/server/src/persist/schema.ts:152`.
- Player report skill records reporter, target, target name, case ID, and timestamp: `apps/server/src/skills/handlers.ts:105`.
- Android sends plaintext `chat` frames: `apps/android/app/src/main/java/com/akalynth/client/network/AkalynthClient.kt:156`.
- Android stores chat messages in local UI state with a small rolling list: `apps/android/app/src/main/java/com/akalynth/client/game/GameStore.kt:442`.
- Debug client sends plaintext chat capped at 240 characters: `apps/debug-client/src/hooks/useGameClient.ts:594`.
- Architecture already defaults to TLS-required transport: `docs/ARCHITECTURE.md:11`.
- Server TLS gate rejects plaintext unless disabled or loopback dev escape hatch applies: `apps/server/src/index.ts:382`.

## Chat Surface Classification

Implemented:

- Local/map world chat through WebSocket `chat`.
- Server broadcast to players on the same map through `chat_broadcast`.
- Chat as tutorial progression signal in Rookguard.
- Chat as Tem challenge response path.
- Chat spam detection and per-IP chat rate limiting.
- Debug-only command parsing through chat text for `/legendary` and `/heat`.
- Accepted and throttled chat receipts.
- Chronicle event with body length and SHA-256 hash for accepted chat.

Not implemented as canonical server/shared protocol:

- Private whispers.
- Party chat.
- Guild chat.
- E2EE chat.
- Conversation or channel IDs.
- Device public keys.
- Message delivery receipts.
- Message content reports.
- Message history query.

Android has a local action intent model with `ChatChannel` values including non-local channels, but that is not part of the shared protocol or server handler. Treat it as client-side/planned surface, not implemented server behavior.

## Inferred Design Consequences

Inferred means likely design consequence from the observed repo facts.

The current persistent identity unit is `player_id`, not a multi-device account.

- Character creation issues a signed stateless token.
- Token signing keys are derived from the chronicle key with domain separation.
- Tokens prove player identity to the server, but they are not encryption keys.
- There is no device identity registry.
- No chat key registration, rotation, revocation, or recovery model was found.
- Android token storage uses `SharedPreferences`, not a chat key vault.

Implication: current identity is enough for server authentication, but not enough to claim E2EE. E2EE needs device-level keys and trust semantics in addition to player tokens.

## Current Receipt, Chronicle, And Proof Boundary

Receipts are canonical and hash-linked. SQLite is derived.

Current chat proof shape:

- Receipt: `action='chat'`, `inputs.message` contains plaintext.
- Chronicle: `event_type='chat'`, payload has message length and SHA-256 message hash.
- Broadcast: plaintext is delivered to nearby players.

If message bodies become ciphertext, old receipt meaning changes. A verifier could prove a ciphertext was sent, but not what human-readable text meant, unless a participant later discloses plaintext with a verifiable binding to the ciphertext.

## Current Moderation Boundary

Moderation is not release-ready as a full abuse operations system.

Current report flow:

- `skill_report` can report an online target.
- The report receipt includes reporter, target, target name, case ID, and timestamp.
- The moderation table stores report metadata and receipt hash.
- Admin report listing/resolution is DEBUG-gated.
- Report flow does not include message excerpt, message receipt hash, ciphertext, plaintext disclosure, or reporter signature over disclosed content.

Implication: E2EE would make moderation weaker unless the report flow is redesigned around participant-supplied evidence.

## Recommendations

Recommendation means future planning advice, not implemented behavior.

1. V1: TLS-protected transport with server-readable world/local chat.
2. Future lane: evaluate E2EE 1:1 whispers as a candidate new surface after key and report preconditions are met.

World/local chat should remain server-readable in V1 because it is part of the game loop, tutorial, anti-abuse, receipts, moderation, and server-authoritative world behavior.

## What Should Remain Server-Readable

- World/local chat.
- Tutorial chat signals.
- Tem challenge answers.
- System messages.
- Debug/admin commands, while they exist.
- Moderation reports and report metadata.
- Receipt metadata and receipt hashes.
- Abuse/rate-limit signals.
- Any chat that affects gameplay, economy, access, progression, or enforcement.

## What Could Become E2EE Later

Only a new 1:1 whisper surface is a plausible first E2EE candidate.

Conditions:

- Whispers must not drive gameplay mechanics.
- Whispers must not satisfy Tem.
- Whispers must not serve as commands.
- Whispers must not be required for moderation without participant-supplied disclosure.
- Receipts must prove encrypted delivery metadata, not plaintext meaning.

## What Should Not Be Encrypted In V1

- Current `chat` and `chat_broadcast`.
- Tem challenge response path.
- Tutorial chat signal.
- Server system messages.
- Moderation report metadata.
- Receipt chain structure.
- Chronicle event metadata.
- Player identity, names, and session metadata.
- Map/world/gameplay state.
- Anti-abuse rate-limit metadata.

## Required Preconditions Before Any E2EE Candidate Implementation

- Device key model: generation, storage, rotation, revocation, and loss.
- Identity binding: how device keys bind to `player_id` and signed auth tokens.
- Trust model: TOFU, verification code, receipt-bound key registration, or other explicit model.
- Report flow: participant-supplied plaintext plus ciphertext plus sender/device proof.
- Replay/proof flow: what receipts prove when server cannot read bodies.
- Protocol version bump and compatibility story.
- Android Keystore design and cold-start migration plan.
- Web/debug-client parity or explicit non-support.
- Abuse model for encrypted spam, harassment, and evasion.
- Recovery policy for lost keys.
- Tests proving old chat behavior remains intact.

## Conclusion

Application-level encrypted chat belongs in Akalynth only as a carefully scoped future candidate, not as a retrofit over the current world chat. The V1 posture is to keep current world/local chat server-readable under TLS-protected transport and to create a separate planning lane for E2EE 1:1 whispers.
