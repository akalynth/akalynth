# Android And Protocol Impact

Status: research only. No implementation.

## Current Protocol

Current canonical protocol has:

- `chat` with plaintext `message`.
- `chat_broadcast` with plaintext `message`.
- No conversation ID.
- No recipient ID.
- No channel field in shared protocol.
- No encrypted payload fields.
- No device key registration messages.
- No message delivery receipt message.

Evidence:

- `packages/shared/protocol.ts:45`
- `packages/shared/protocol.ts:373`
- `packages/shared/protocol.ts:1366`

## Current Android Behavior

Android sends plaintext chat:

- `AkalynthClient.chat()` sends `type=chat` and `message`.
- `GameStore.sendChat()` truncates to 240 chars before sending.
- `MessageSerializer` encodes `ChatMessage` as plaintext.
- Chat overlay stores messages in local UI state.

Evidence:

- `apps/android/app/src/main/java/com/akalynth/client/network/AkalynthClient.kt:156`
- `apps/android/app/src/main/java/com/akalynth/client/game/GameStore.kt:534`
- `apps/android/app/src/main/java/com/akalynth/client/protocol/MessageSerializer.kt:44`
- `apps/android/app/src/main/java/com/akalynth/client/ui/components/ChatOverlay.kt:28`

## Current Debug Client Behavior

Debug client sends plaintext `chat` capped at 240 chars and appends plaintext broadcasts into a local rolling chat list.

Evidence:

- `apps/debug-client/src/hooks/useGameClient.ts:594`
- `apps/debug-client/src/hooks/useGameClient.ts:823`

## Required Protocol Changes For Future E2EE Whispers

Do not overload current `chat`.

Additive future messages would likely need:

- Device key registration.
- Device key query or bundle fetch.
- Encrypted whisper send.
- Encrypted whisper delivery.
- Delivery acknowledgement.
- Report encrypted message/disclosure.

Candidate envelope fields:

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

Compatibility requirement:

- Existing `chat` and `chat_broadcast` must remain backward compatible.
- Android and debug-client must tolerate unknown encrypted message types before rollout.
- Protocol golden generation must include new types.

## Required Android Changes For Future E2EE

- Generate per-device encryption/signing keys.
- Store private keys in Android Keystore or another explicit protected storage mechanism.
- Persist public key registration state.
- Verify recipient device keys.
- Encrypt/decrypt message envelopes.
- Render undecryptable messages.
- Handle key rotation and revoked devices.
- Handle lost-key state.
- Support participant-supplied report disclosure.
- Add protocol parity tests for every new message.
- Add UI tests for report flow and undecryptable messages.

## V1 Android/Protocol Recommendation

No protocol changes for chat encryption in V1. Keep `chat` plaintext and server-readable under TLS-protected transport. TLS is not application-level chat encryption and is not chat E2EE. If planning E2EE, create a separate additive protocol proposal for 1:1 whispers as a candidate surface blocked pending key/report/protocol design.
