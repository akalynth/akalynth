# AKALYNTH_ACCOUNT_PORTAL_PRODUCT_DECISION_V1

**E0 decision record — no implementation.** Records the production architecture for the
Akalynth account portal + character platform before any code is written.

> Akalynth accounts are server-authoritative, email-verified identities. The website is
> the first account portal. Android reaches feature parity for sign-up, sign-in,
> character creation, world choice, and play entry. Game economy stays in-game currency
> first; real-money payment is deferred.

## Contents

| Doc | Purpose |
|---|---|
| [ACCOUNT_PORTAL_DECISION.md](./ACCOUNT_PORTAL_DECISION.md) | Master decision record (all calls, scope, non-goals). |
| [ACCOUNT_AUTH_SECURITY_MODEL.md](./ACCOUNT_AUTH_SECURITY_MODEL.md) | Email+password, Argon2id, verification, reset, sessions, no-enumeration, rate limits. |
| [ACCOUNT_CHARACTER_WORLD_MODEL.md](./ACCOUNT_CHARACTER_WORLD_MODEL.md) | account→character→world→sex→outfit model + APIs. |
| [WEBSITE_PORTAL_ROLE.md](./WEBSITE_PORTAL_ROLE.md) | Website as portal; static frontend, no authority; calls api.akalynth.com. |
| [ANDROID_PARITY_REQUIREMENTS.md](./ANDROID_PARITY_REQUIREMENTS.md) | Android parity scope for the account flow. |
| [ECONOMY_AND_PAYMENT_BOUNDARY.md](./ECONOMY_AND_PAYMENT_BOUNDARY.md) | In-game currency first; no Stripe in V1. |
| [RECEIPT_PRIVACY_BOUNDARY.md](./RECEIPT_PRIVACY_BOUNDARY.md) | What receipts may/never carry. |
| [IMPLEMENTATION_SEQUENCE.md](./IMPLEMENTATION_SEQUENCE.md) | Epics E1–E9 → lanes, dependencies, critical path. |
| [receipt.txt](./receipt.txt) | Lane closure receipt. |

## Status

`closed_account_portal_product_decision_recorded_no_implementation`
