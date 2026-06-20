# Akalynth Beta Account Play Portal Hardening v1

Status: `support_pages_and_live_smoke_source_added`

This lane hardens the beta account-to-play portal as a repeatable verification
target. It does not deploy, restart services, change Caddy, mutate runtime
state, or promote new gameplay authority.

## Contract

- `https://beta.akalynth.com/account.html` serves the beta account portal.
- The account portal signs in with email/password through
  `https://beta-api.akalynth.com`.
- The source beta webroot includes `register.html` and `forgot.html` support
  pages for the account links exposed by `account.html`.
- Verification links sent as `account.html?verify=...` are consumed by the
  account portal. Reset links sent as `account.html?reset=...` redirect to
  `forgot.html?reset=...`.
- Unverified accounts are blocked behind the email-verification view and can
  request resend through `/v1/accounts/verify/resend`.
- Verified accounts can list account characters, select a character through
  `/v1/characters/select`, create a character through `/v1/characters`, and
  receive a play token.
- The selected/created play token is stored in browser localStorage under
  `akalynth.identity.v1`, then the browser redirects to `/play/`.
- The debug client loaded at `/play/` reads the same `akalynth.identity.v1`
  key and uses the stored token before falling back to guest play.
- Android beta `PORTAL_ACCOUNT_URL` targets
  `https://beta.akalynth.com/account.html`, not an API host.

## Verifier

Run from the repository root:

```bash
npm run verify:beta-account-play-portal
```

The verifier records a JSON report at:

- `validation/beta_account_play_portal_report.json`

Use `-- --skip-live` only when public HTTPS checks are intentionally unavailable.

## Live Smoke

Run from the repository root after beta has been published from this source:

```bash
npm run smoke:beta-account-play
```

The smoke script creates a disposable beta account and character, selects the
character, verifies token login over WebSocket, and uses Playwright to prove
that `/play/` reads `akalynth.identity.v1` from localStorage, sends a token
login rather than guest login, and reaches `world_state`. Receipts are redacted
and written under `.tmp/beta-account-play-smoke/` unless `--report` is supplied.

## Boundary

This verifier is credential-free. It proves static source contracts and public
HTTP 200 availability for `account.html` and `/play/`, but it does not perform a
real login or mutate account, character, receipt, or runtime state.

The support pages, resend endpoint, and reusable smoke script are source-custody
changes. This lane did not sync source into `/opt/akalynth-beta`, restart
services, change Caddy, or publish the new static pages to live beta.
