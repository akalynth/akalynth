# AKALYNTH_ACCOUNT_PORTAL_PRODUCT_DECISION_V1 — Master Decision Record

Status: **decided / no implementation**
Date: 2026-06-05
Lane: E0 (decision record before implementation)

## Core architecture sentence

> Akalynth accounts are **server-authoritative, email-verified identities**. The
> **website is the first account portal**. **Android reaches feature parity** for
> sign-up, sign-in, character creation, world choice, and play entry. Game economy
> stays **in-game currency first**; real-money payment is deferred.

## Product target

A player can, end to end:

1. Arrive at a **title screen**.
2. Create a **real email account**.
3. **Verify** their email.
4. **Sign in** on the website and on Android.
5. **Create a character**.
6. **Choose a world/server**.
7. Choose **sex** (male / female).
8. Choose an **outfit**.
9. See a **character dashboard** on the website.
10. Use the website for **houses / shop** (in-game currency).
11. **Enter the game** from the client with the selected character/session.

## Decisions (authoritative)

| Area | Decision |
|---|---|
| Auth | **Email + password, email-verified.** Argon2id hashing. Email verification, password reset, login throttling/rate limits, session issuance, **no account enumeration**. |
| Economy | **In-game currency first.** No Stripe / real-money payments in this phase. Shop/houses use the server-authoritative game economy only. |
| Appearance | **Discrete full sprites first.** Male/female base + finished outfit sprites. Layered clothing is a later phase. |
| Proof model | **Privacy-bounded receipts.** Receipt account/character/economy lifecycle *events*; **never** receipt plaintext email, passwords, reset tokens, session tokens, or secrets. |
| Website role | **Account portal** (create account, sign in, verify, create character, choose world, sex/outfit, dashboard, houses, shop). Static frontend, **no secrets/authority** — calls `api.akalynth.com`. |
| Android role | **Parity required** for the core account flow (title, account create, sign in, verify status, character create/select, world, sex/outfit, enter game). |
| Default entry | **Title screen first** → sign in / create account → verify email if needed → choose/create character → choose world → first-sign-in sex + outfit → enter game. |

## Scope of THIS lane (E0)

In: record the production architecture and boundaries as decision docs.
Out: **any implementation.** No schema, endpoints, UI, art, email, or payments are
built in E0.

## Non-goals (explicitly deferred)

- Stripe / real-money purchases (premium currency is a later gated epic).
- Real-money-purchasable Azura coins.
- Layered/composited clothing rendering (start with discrete full sprites).
- Moving shop/houses into Android before the account + character session model is stable.
- Auctions on the house portal until the server auction verifier lanes fully pass.
- Treating website `localStorage` as authority once real-account work begins.

## Document set

- [ACCOUNT_AUTH_SECURITY_MODEL.md](./ACCOUNT_AUTH_SECURITY_MODEL.md)
- [ACCOUNT_CHARACTER_WORLD_MODEL.md](./ACCOUNT_CHARACTER_WORLD_MODEL.md)
- [WEBSITE_PORTAL_ROLE.md](./WEBSITE_PORTAL_ROLE.md)
- [ANDROID_PARITY_REQUIREMENTS.md](./ANDROID_PARITY_REQUIREMENTS.md)
- [ECONOMY_AND_PAYMENT_BOUNDARY.md](./ECONOMY_AND_PAYMENT_BOUNDARY.md)
- [RECEIPT_PRIVACY_BOUNDARY.md](./RECEIPT_PRIVACY_BOUNDARY.md)
- [IMPLEMENTATION_SEQUENCE.md](./IMPLEMENTATION_SEQUENCE.md)
- [receipt.txt](./receipt.txt)

## Current-state grounding (why this is net-new)

- **No account system exists.** Server identity today is guest sessions + signed
  character tokens (Ed25519, from `POST /v1/characters/create`). No email/password/account.
- **akalynth-site is a localStorage-only preview** (`account.html`, `shop.html`,
  `houses.html`, `app.js`). Nothing is server-backed yet.
- **Gender/outfit sprites do not exist** — only `base_human_male_01` + themed NPC sprites.
- The server already has property/house, gold, shop, treasury logic bound to character
  play; this lane connects it to **accounts** and the **website**.

## Closure

`closed_account_portal_product_decision_recorded_no_implementation`
