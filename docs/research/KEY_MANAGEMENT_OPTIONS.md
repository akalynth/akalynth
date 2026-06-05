# Key Management Options

Status: research only. No implementation.

## Current Key Model

Current keys are signing keys, not chat encryption keys.

- Receipt signing uses an Ed25519 seed loaded from a key file.
- Identity/auth signing derives an Ed25519 auth seed from the chronicle seed with BLAKE3 domain separation.
- `/v1/transparency` exposes public verification keys.
- Android stores auth tokens, not encryption keys.

Evidence:

- Receipt key loading: `packages/coordination-kernel/src/receipt/key.ts:20`.
- Auth key derivation: `packages/coordination-kernel/src/identity/key.ts:14`.
- Token signing: `packages/coordination-kernel/src/identity/token.ts:75`.
- Android identity storage: `apps/android/app/src/main/java/com/akalynth/client/network/IdentityStore.kt:5`.

## Key Options

### Option 1: No app-layer chat keys

Use TLS-protected transport only. TLS is not application-level chat encryption and is not chat E2EE.

Feasible V1 transport posture.

Properties:

- No new keys.
- No lost-key problem.
- No protocol changes.
- Server remains authoritative and moderation-capable.

### Option 2: Server-held chat-at-rest key

Server encrypts message bodies before storage.

Not recommended for V1.

Risks:

- Key custody becomes operationally sensitive.
- Receipts are harder to inspect and verify.
- Server can still decrypt, so this is not E2EE.
- Backup/restore and key rotation need strong runbooks.

### Option 3: Per-device E2EE identity keys

Each client device generates encryption identity keys.

Future candidate for 1:1 whispers only.

Required design:

- Device key generation.
- Android Keystore storage.
- Public key registration bound to `player_id`.
- Device key registration receipt.
- Trust model for first contact or verification.
- Rotation and revocation.
- Multiple devices per player or explicit one-device-only rule.
- Lost-device behavior.

### Option 4: Account-level recovery key

Player has a recoverable account key that wraps device keys.

Not V1.

Risks:

- No implemented account model exists.
- Recovery weakens E2EE if server can help recover plaintext.
- Backup UX and custody policy become product/security commitments.

### Option 5: Sender signs message envelopes

Sender signs encrypted message metadata and ciphertext hash with a device signing key.

Useful for future reports, but not sufficient alone.

Needed for:

- Participant-supplied reports.
- Sender-device attribution.
- Tamper detection.
- Cross-device replay constraints.

## Lost-Key Consequences

For true E2EE:

- Lost device key means old message bodies are unrecoverable unless the user has a backup.
- Server cannot restore plaintext without violating E2EE.
- Reports for old messages may become impossible if local plaintext/ciphertext is gone.
- Multi-device sync requires explicit key distribution and membership receipts.

V1 policy should avoid promising recoverable encrypted chat until recovery is intentionally designed.

## V1 Key Recommendation

Do not introduce chat encryption keys in V1. Keep auth signing keys separate from any future chat encryption design. Never reuse chronicle/auth signing keys for chat encryption.
