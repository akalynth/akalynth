# Account Auth & Security Model

Decision: **email + password, email-verified.** This document is the security
contract that E1/E2/E3 implementations MUST satisfy. No code here.

## Credentials & hashing

- Identifier: **email** (normalized: trim + lowercase; store original-case display copy if needed).
- Secret: **password**, hashed with **Argon2id** (OWASP-recommended modern KDF).
  - Per-account random salt; parameters tuned to OWASP minimum work factors and
    re-tuned over time; support transparent re-hash on login when parameters change.
  - **Never** store, log, or receipt the plaintext password or the raw hash input.
- Password policy: enforce a sane minimum length and reject known-breached/common
  passwords; do not impose counterproductive composition rules.

## Email verification

- New accounts start **unverified**. A verification email contains a **single-use,
  expiring** link/token.
- Verification tokens are **hashed at rest** (store only the hash); the plaintext
  token exists only in the email.
- Resend is **rate-limited** and tokens **expire**; consuming/expiring invalidates prior tokens.
- Gate sensitive actions (e.g. character creation, economy) behind `email_verified`.

## Password reset / recovery

- "Request reset" always returns a **uniform response** regardless of whether the
  email exists (**no account enumeration**).
- Reset tokens: single-use, short expiry, **hashed at rest**, invalidated on use or
  on a new request.
- Completing a reset **revokes existing sessions** for that account.

## No account enumeration

- Register, login, reset-request, and resend-verification responses must **not reveal
  whether an email exists** (uniform messages, uniform timing where feasible,
  consistent status codes).
- **Nickname (handle) exception (AKALYNTH_ACCOUNT_NICKNAME_V1):** nickname
  availability *is* disclosed — registration returns `handle_taken` (409) when a
  nickname is in use, because a nickname sign-up must tell the user it is taken (same
  posture as the principal/identity API). Email stays no-enumeration: an email is only
  attached when free, and an email-only signup with an existing email still returns the
  uniform success. Login stays uniform (`invalid_credentials`) for nickname and email
  alike. Email verification is a later, non-blocking lane; nickname-only accounts have
  no email-based password recovery (disclosed to the user at signup).

## Sessions

- On successful login, issue a **session** (decision to be fixed in E2:
  HTTP-only secure cookie for the website vs. bearer token; Android uses bearer).
  Document the exact mechanism in the E2 API lane.
- Sessions: server-side record, expiry, refresh/rotation policy, explicit logout,
  and **revoke-all** (used by password reset and by user action).
- Session tokens are **hashed at rest**; never logged or receipted.

## Rate limiting / throttling / abuse

- Throttle login attempts per account and per source; apply backoff/lockout windows.
- Rate-limit register, verification resend, and reset-request endpoints.
- CAPTCHA/abuse mitigation is a hardening-epic concern (E9), but the endpoints must be
  designed to accept such a gate.

## PII & secret boundary

- PII (email) and security material (password hash, token hashes, session records)
  live **only** in the account database — never in chronicle receipts.
- See [RECEIPT_PRIVACY_BOUNDARY.md](./RECEIPT_PRIVACY_BOUNDARY.md) for what receipts may carry.

## Transport & storage

- All account endpoints are HTTPS-only (the prod server already enforces TLS).
- Account DB at rest follows the same custody as `/var/lib/akalynth` runtime data;
  backup/restore and access controls are an E9 concern.

## Account lifecycle states

`registered_unverified → email_verified → active` ; plus `locked` (abuse),
`disabled`, and a future `deletion_requested` (account deletion/export is an E9 decision).

## Out of scope here

- 2FA / TOTP (future enhancement).
- OAuth/social login (explicitly not chosen in V1).
- Real-money payment credentials (no Stripe in V1).
