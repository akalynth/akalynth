# Receipt Privacy Boundary

Decision: **privacy-bounded receipts.** Account/character/economy lifecycle *events*
are receipt-backed (Akalynth's proof-native, server-authoritative ethos), but receipts
**never carry PII or secrets**.

## NEVER put in a receipt

- Plaintext **email** addresses.
- **Passwords** or password hashes.
- **Email-verification tokens**, **password-reset tokens**, **session tokens**
  (plaintext or hash).
- Any secret/credential material.

## ALLOWED in a receipt

- **Event type** (e.g. `account_created`, `email_verified`).
- **Stable opaque IDs**: `account_id`, `character_id`, `world_id`, `outfit_id`
  (never the email or any PII).
- **Timestamps / sequence** (chain ordering).
- **Hashes / redacted metadata** where linkage is needed without exposure
  (e.g. a salted/derived non-reversible reference, never an email or token).
- **Actor / account / character linkage** (by opaque ID).
- For economy: amounts, item/property IDs, result.

## Where PII / security material lives

- The **account database** only (email, Argon2id password hash, hashed verification/
  reset/session tokens). Same custody as runtime data; not in the chronicle.

## Receipted lifecycle events (privacy-bounded)

Account: `account_created`, `account_email_verification_requested`,
`account_email_verified`, `account_login_succeeded`, `account_login_failed`,
`account_password_reset_requested`, `account_password_reset_completed`,
`account_session_issued`, `account_session_revoked`.

Character: `character_created`, `character_selected`, `character_world_assigned`,
`character_outfit_selected`.

Economy: `currency_granted`, `currency_spent`, `house_purchased`, `house_listed`,
`house_transferred`, `shop_item_purchased` (in-game currency).

> Each event carries only event type + opaque IDs + timestamp/sequence + redacted
> metadata. `account_login_failed` records the **attempt/outcome and account linkage
> where known**, never the submitted email/password.

## Rationale

This keeps the audit chain useful (every meaningful state change is provable and
attributable by opaque ID) while ensuring the public/auditable receipt stream can
**never leak** a player's email, password, or any auth token — even under full chain
disclosure.
