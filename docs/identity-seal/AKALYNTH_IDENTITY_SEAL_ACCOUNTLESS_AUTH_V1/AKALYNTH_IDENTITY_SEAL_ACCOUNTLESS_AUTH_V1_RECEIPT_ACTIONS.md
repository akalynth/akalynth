# AKALYNTH_IDENTITY_SEAL_ACCOUNTLESS_AUTH_V1 Receipt Actions

Receipt actions added:

- `principal_created`
- `principal_terms_accepted`
- `principal_challenge_verified`
- `principal_challenge_rejected`
- `principal_session_issued`
- `principal_session_revoked`
- `principal_pgp_binding_pending`
- `principal_blocked`
- `principal_reported`
- `principal_moderation_action`
- `principal_seal_retired`
- `principal_deletion_requested`

Allowed receipt inputs:

- Opaque principal id as actor.
- Public key fingerprint.
- PGP fingerprint only while pending verification.
- Challenge id, purpose, proof mechanism.
- Report id, target principal id, content ref, reason.
- Server-derived capability used for the action.
- Retention policy marker for deletion/anonymization.

Forbidden receipt inputs:

- Private keys.
- Raw session tokens.
- Detached signatures.
- Recovery secrets.
- Email/password/phone/legal identity.
- Client-submitted role or capability claims.
- Wallet/token/NFT/blockchain identifiers.

Replay note:

SQLite principal tables are materialized operational state for the principal lane. Receipts remain the audit trail for lifecycle, proof, moderation, and deletion events.
