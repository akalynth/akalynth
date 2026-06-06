# AKALYNTH_IDENTITY_SEAL_ACCOUNTLESS_AUTH_V1 Schema Plan

Schema version: `19`.

Additive tables:

- `principals`: opaque principal id, handle, display name, status, roles JSON, recovery mode, created/updated/deletion timestamps.
- `principal_keys`: device SPKI public keys and pending PGP public keys, with public fingerprints and status.
- `principal_challenges`: single-use challenge id, nonce hash, purpose, domain, canonical payload, expiry, consumed timestamp.
- `principal_sessions`: hashed principal session tokens, identity level, expiry, revocation.
- `principal_terms_acceptances`: terms version, client, timestamp.
- `principal_blocks`: blocker principal, blocked principal, optional reason.
- `principal_reports`: reporter, target, optional content ref, reason/detail, moderation status/resolution.

HTTP surface:

- `POST /v1/principals/register`
- `POST /v1/principals/challenge`
- `POST /v1/principals/verify`
- `GET /v1/principals/me`
- `POST /v1/principals/terms`
- `POST /v1/principals/block`
- `POST /v1/principals/report`
- `GET /v1/principals/moderation/reports`
- `POST /v1/principals/moderation/resolve`
- `POST /v1/principals/retire`
- `POST /v1/principals/delete-request`
- `POST /v1/principals/pgp-bind`
- `GET /v1/principals/policy`

Canonical challenge payload:

```json
{
  "type": "akalynth.challenge.v1",
  "domain": "akalynth.com",
  "purpose": "principal_login",
  "principal_id": "principal_...",
  "challenge_id": "challenge_...",
  "nonce": "...",
  "issued_at": "...",
  "expires_at": "...",
  "client": "android",
  "protocol_version": "1"
}
```

Signing bytes are deterministic JSON: UTF-8, sorted keys, no insignificant whitespace, exact schema version, domain-bound, purpose-bound, expiry-bound, nonce-bound, principal-bound.
