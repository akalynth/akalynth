# Implementation Sequence (epics → lanes)

Ordered, dependency-aware. Each lane is its own branch/PR (decision-complete, screenshot/
verify per Akalynth policy). **E0 is this decision record — no implementation.**

| Epic | Lane id | Goal | Depends on |
|---|---|---|---|
| **E0** | `AKALYNTH_ACCOUNT_PORTAL_PRODUCT_DECISION_V1` | Record architecture & boundaries (this doc set). **No implementation.** | — |
| **E1** | `AKALYNTH_ACCOUNT_AUTH_SCHEMA_V1` | Account tables + types only (accounts, email_verifications, sessions, password_resets, account_events). Privacy-bounded receipt event definitions. No web/Android. | E0 |
| **E2** | `AKALYNTH_ACCOUNT_AUTH_API_V1` | `register`, `login`, `logout`, `me`, `password-reset/request`, `password-reset/confirm`. Argon2id, verified-email flag, uniform (no-enumeration) responses, sessions, rate limits, hashed-at-rest tokens, redacted receipts. | E1 |
| **E3** | `AKALYNTH_ACCOUNT_EMAIL_VERIFICATION_V1` | Email delivery as its own lane (operational blast radius). Dev mode logs links; prod sends real email; resend limits + expiry; receipt without token. **Needs an email-provider decision + SPF/DKIM/DMARC (later).** | E2 |
| **E4** | `AKALYNTH_ACCOUNT_CHARACTER_V2_V1` | Character bound to account: `world_id`, `sex`, `outfit_id`. `GET /v1/worlds`, `GET /v1/outfits`, `GET/POST /v1/characters`, `POST /v1/characters/select`. Character lifecycle receipts. | E2 |
| **E5** | `AKALYNTH_SITE_ACCOUNT_PORTAL_API_V1` | Source-level website pages call the real API for account/session, account-character, shop, work, wallet, and property actions; browser storage is non-authoritative UI state only. Production release proof remains separate. | E2, E4 |
| **E6** | `AKALYNTH_ANDROID_ACCOUNT_CHARACTER_PARITY_V1` | Source-level Android account-character entry exists for portal launch, sign-in/session checks, create/select character, world, sex/outfit, and enter-game play token handoff. Production release proof remains separate. | E2, E4 |
| **E7** | `AKALYNTH_CHARACTER_APPEARANCE_SPRITES_V1` | **Discrete full sprites first**: male/female base + finished outfit sprites; wire into sprite system + MapCanvas. (Blocks visible outfit choice.) | E4 + asset pipeline |
| **E8a** | `AKALYNTH_SITE_HOUSE_PORTAL_SERVER_BACKED_V1` | Houses portal → server property API. Fixed-price/resale first; **auctions blocked** until the server auction verifier lanes pass. | E5 |
| **E8b** | `AKALYNTH_SITE_SHOP_IN_GAME_CURRENCY_V1` | Shop portal on **in-game currency**. No Stripe / premium real-money. | E5 |
| **E9** | `AKALYNTH_ACCOUNT_PRODUCTION_HARDENING_V1` | Abuse/rate-limit tests, session expiry, reset security, email deliverability, monitoring, backup/restore, privacy review, account deletion/export decision, runbook. | E1–E8 |

## Critical path to "create account → play"

`E1 → E2 → E3 (verify) → E4 (character/world/sex/outfit) → E7 (outfit sprites) → E5 (web)`
defines the full website journey into the game. Source-level E5/E6 surfaces now
exist; production release still requires named proof artifacts and release
claims.
E8/E9 deepen the economy portal and harden for production.

## Hard "do not do yet"

- No Stripe / real-money now.
- No real-money-purchasable coins.
- Do not move shop/houses into Android before the account + character session model is stable.
- Do not let website `localStorage` remain authority once real-account work starts.
- Do not receipt secrets, tokens, plaintext emails, or password material.

## Open setup decisions to settle at lane start

- **E3:** email provider (transactional) + sending domain + SPF/DKIM/DMARC.
- **E2:** exact session mechanism (HTTP-only cookie for web vs bearer) + CORS/CSRF posture.
- **E7:** outfit catalog size for V1 (how many outfits per sex) + sprite spec/dimensions.
