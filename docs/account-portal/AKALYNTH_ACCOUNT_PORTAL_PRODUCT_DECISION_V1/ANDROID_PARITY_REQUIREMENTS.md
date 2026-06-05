# Android Parity Requirements

Decision: the website may get richer portal features first, but **Android must not be
permanently second-class for the core account flow.**

## Android MUST reach parity for

1. **Title screen first** (entry).
2. **Create account** (email + password).
3. **Sign in**.
4. **Email verification status** (and resend) — Android surfaces verification state;
   the actual verification link is consumed via email/web, but Android reflects it.
5. **Create / select character.**
6. **Choose world.**
7. **Choose sex (male/female) + outfit.**
8. **Enter game** with the selected character/session.

## What Android does NOT need in V1

- The richer portal surfaces (houses management, shop) may land on the **website first**.
  Android gains them later, after the account + character **session model is stable**.
- No real-money payments (matches the economy boundary).

## Shared contract

- Android and the website consume the **same** `api.akalynth.com` account/character
  endpoints and the **same** server-owned world/outfit catalogs — no Android-only or
  web-only account semantics.
- Android stores the session/play token using its existing secure store (`IdentityStore`),
  extended for the account session; never logs tokens (consistent with the receipt/secret boundary).

## Sequencing

Android account parity is its own epic (E6 in the sequence) and depends on E1–E4
(server account + character model). It should not start before the account + character
session model is stable.
