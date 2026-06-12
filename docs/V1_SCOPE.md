# V1 Scope Fence

> **Purpose:** Define exactly what v1 covers, what it does not, and which guarantees are mechanically enforced today — so claims stay aligned with code and CI.

## Intent

Define what v1 covers and what it explicitly does not. This prevents scope drift and ensures v1 claims match code and CI behavior.

## In Scope (v1)

- Signed, append-only receipt chain (runtime writes + persisted file)
- Deterministic replay + bootstrap rules (fatal on missing receipts unless explicit bootstrap; lenient forbidden in production)
- CI gates (invariant guard, docs audit, protocol sync, build, MVP verify, chain discipline)
- Constitutional verifiers in CI (defined in `apps/server/package.json`; run from `apps/server/`, or via the workspace, e.g. `npm -w apps/server run verify:monetization`):
  - `verify:lifecycle` (fixture receipts) — also exposed at repo root as `npm run verify:lifecycle`
  - `verify:monetization` (fixture receipts)
  - `verify:work-contracts` (unit)
  - `verify:treasury` (unit)
  - `verify:property` (unit) — house ownership/transfers, gold conservation, replay + DB determinism
- Property ownership v0 (server + proof): house registry seeded from map plots, primary sale (gold sink) + listing + resale (player→player, conserved), durable in SQLite (schema v13), receipt-sourced. **In-game gold only — no real money** (the monetization constitution governs value entry; gameplay gold purchases are not monetization). Buyable by any player (no capability gate on standard plots).
- Property auctions, resale (server + proof): owner-opened resale auctions with open/bid/cancel handlers, world-loop close→settle (wall-clock only triggers emission; settlement truth is the receipt; reducer/replay are clock-free), and a **durable auction projection** (SQLite schema v14, `property_auctions`, materializer + boot hydration). Gold model proven to conserve (primary sink / resale net-zero) and persistence proven (projection==DB, idempotent re-materialize, DB-hydration==replay) via `verify:property-auction*`. **In-game gold only.** Not in V1: primary/system auction opening, anti-snipe, a production restart proof run, and the site auction UI.
- Public transparency surfaces exist: `/v1/receipts/public` (and `/v1/transparency`, `/v1/receipts`), served by `apps/server/src/api/http.ts`; docs describe what they are today. Property market/ledger are exposed (anonymized) at `/v1/property/market` and `/v1/property/ledger`.
- Account-character entry v2 is source-level in scope for client parity:
  account/session + CSRF-gated `/v1/characters`, canonical world/sex/outfit
  catalogs, site/debug-client/Android create/select paths, and missing-session
  or missing-CSRF helpers. It is covered by `npm run verify:account-character`,
  including server shop/work/property gameplay route proof. This is not a production
  release claim without named proof artifacts.
  The public account portal and four Codex surfaces are verified in the separate
  `akalynth-site` repo by `./scripts/verify-account-character-site.sh`.

## Out of Scope (v1)

- Moderation system (Phase 7), appeals, bans, enforcement tooling
- Witness UI (Phase 6) beyond docs/spec
- Mail MMO system (doc only)
- Property ownership beyond v0: taxation/upkeep, house customization, furniture, premium plot tiers (`house:estate`/`house:guild` capability gates), production proof for client/site/Android property views, and auction UI. Source-level fixed-price/resale property views may exist, but they are not a production release claim without named proof artifacts.
- Production proof for account-character site/debug-client/Android surfaces.
  Source-level parity may exist, but public/release claims require named proof
  artifacts.
- Any “constitutional freeze” guarantees not enforced by CI/verifiers
- Cryptographic envelope verification for receipts (`verify:receipt-chain`) until PR2 lands

## Binding Guarantees (v1)

Only guarantees that are mechanically enforced today:

- Missing receipts fails fast (exit 2) unless bootstrap
- Bootstrap refused if state exists but receipts are missing
- Replay determinism (hashes match on identical inputs)
- Payout ordering enforced by tick receipts (chain-local scan)

## Non-binding / Future Specs

These documents are informative or future-facing and are **not** v1 law:

- `docs/archive/MONETIZATION_BLUEPRINT.md`
- `docs/WORLD_EVOLUTION.md`
- `apps/server/docs/PHASE6_WITNESS_INTERFACE.md`
- `apps/server/docs/EVIDENCE_UI_SPEC.md`
- `apps/server/docs/PHASE7_MODERATION.md`
- `docs/archive/speculative/AKALYNTH_MAIL_MMO.v1.md`
- `packages/coordination-kernel/CONSTITUTIONAL_API_FREEZE.md`
- `packages/coordination-kernel/examples/README.md`
- `packages/coordination-kernel/examples/REGULATOR_VERIFICATION.md`
- `packages/ai-tool-governance/docs/constitutional-principles.md`
- `packages/ai-tool-governance/docs/compliance-verification.md`

## Release Preconditions (before tag)

- GitHub Actions green on `main` twice in a row
- Fixture generation deterministic (fixed timestamp verified)
- No tracked forbidden artifacts (dist/build/keys/receipts)
- `./scripts/verify_mvp.sh` passes locally
- `./scripts/verify_protocol_sync.sh` passes locally
- `bash scripts/test-chain-discipline.sh` passes locally
