# Reporting And Moderation Decision

Lane: AKALYNTH_CHAT_ENCRYPTION_THREAT_MODEL_AND_AUTHORITY_DECISION_V1

Status: decision-only. No implementation.

## Decision

World/global chat remains server-readable and moderation-compatible. Current pre-alpha plaintext relay is acceptable only when described plainly as server-readable.

Encrypted private-message moderation, if later added, must use participant-supplied evidence. The server must not claim omniscient access to encrypted message bodies.

## Current World Chat

- Server reads message bodies.
- Server may use chat for Tem, tutorial, debug commands, rate limiting, broadcast, receipts, and chronicle hash/length evidence.
- Moderation can rely on server-visible body evidence where receipts/logs are retained.
- This is an accountability surface, not a confidentiality surface.

## Future Encrypted Whispers

Encrypted whisper reports must include a disclosure bundle that can be evaluated without pretending the server saw plaintext at send time.

Required report elements:

- report_case_id
- reporter_player_id
- target_player_id
- sender_device_id
- recipient_device_id
- conversation_id
- key_epoch
- message nonce or counter
- ciphertext_hash
- disclosed_plaintext_hash
- delivery receipt hash
- reporter disclosure statement

## Moderation Boundary

- Metadata can support rate limits and case triage.
- Body-level moderation for encrypted whispers depends on participant disclosure.
- Reported plaintext becomes evidence only after disclosure, not before.
- Tampered disclosure, wrong sender/device, wrong key epoch, or missing delivery receipt must fail validation in a future implementation.

## V1 Exclusion

No E2EE moderation workflow is implemented or claimed in V1.
