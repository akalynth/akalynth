# Akalynth Current Stage

> **Purpose:** The repo-local boundary on what may be claimed/shown about Akalynth's maturity. If code and this doc disagree, treat the more conservative statement as binding until a verifier or proof run says otherwise.
>
> **Repo version:** `0.1.0` (see `package.json`). Last reviewed against `main` on 2026-05-30.

## Stage Label

Akalynth v0.1 is a **pre-alpha, proof-native MMO vertical slice**.

It is not a production MMO, not content-alpha, and not a public launch candidate.

This document is the repo-local boundary for what may be shown to a potential technical driver without implying more maturity than the repository currently proves.

## Mechanically Enforced Today

These claims are supported only to the extent that the named source, script, verifier, or CI job passes for a specific commit.

- Server-authoritative WebSocket intent handling
- Guest login / session flow
- Grid movement validation
- Chat
- Audit receipt chain
- Protocol sync checks
- MVP verification scripts
- Chronicle / receipt hygiene checks
- Selected constitutional and domain verifiers
- Local/debug client build path

## Implemented But Not Release-Claimed

The repository contains code for the systems below. Their existence in code is not a production or release claim.

A system is release-claimed only when it is:

1. listed in this document as release-claimed,
2. covered by a named verifier or smoke test,
3. included in a passing local or CI proof run for a named commit,
4. and included in the run artifact for that claim.

Implemented-but-not-release-claimed systems include:

- Combat
- Death / respawn
- Item drop / pickup
- Protected slots
- Chronicle evidence
- Treasury / gold
- Work contracts
- NPC recognition
- Android observe/play client
- Load-test harness
- Public/private receipt and rumor surfaces
- Account-character entry v2 — account/session + CSRF-gated `GET/POST /v1/characters`,
  world/sex/outfit catalogs, site/debug-client/Android create/select paths, and
  client-side missing-session/CSRF helpers. Covered by `npm run
  verify:account-character`, including server wallet/shop/work/property gameplay route proof.
  The public account portal and four Codex surfaces are covered in the separate
  `akalynth-site` repo by `./scripts/verify-account-character-site.sh`.
  This is a source-level parity claim, not a production release claim.
- Property ownership v0 (house buy / list / resale) — receipt-sourced, durable (SQLite schema v13), covered by `apps/server` `npm run verify:property`. Source-level site/debug-client/Android views now exist for account-character property actions and projections, but a production proof run and release claim are still not claimed.
- Property auctions (resale): open / bid / cancel handlers, world-loop close→settle (wall-clock only triggers emission; settlement truth is the receipt), and a **durable auction projection** (SQLite schema v14, `property_auctions` table, materializer + boot hydration). Proven by `verify:property-auction*` (reducer, gold conservation, handlers, close→settle, and **persistence: projection==DB, idempotent re-materialize, DB-hydration==replay**). Receipts remain the source of truth; the DB is a materialized mirror. Not yet claimed: a production restart proof run, primary/system auction opening, anti-snipe, and the site auction UI.
- Witness Moth Bloom world-event prototype: server-authoritative High City-facing event signal on the legacy `Azura` runtime map id, plus three `use_skill` contribution intents, with `world_event_started`, `world_event_contribution`, and `world_event_resolved` receipts, derived `world_event` Chronicle rows, and a durable SQLite schema v17 `world_events` projection for startup hydration. Covered by `apps/server` `npm run verify:world-events`. No new WebSocket protocol shape, no full `high_city` runtime-id switch, no economy reward, and no production proof run claim.

## Debug-Only Or Environment-Gated

These surfaces must not be presented as production behavior unless a later release document names the gate, verifier, and proof artifact.

- Runestone debug behavior
- Sovereign debug grants
- Test death triggers
- Dev minting
- Local insecure transport
- Debug-only raw/public inspection routes
- Local/staging-only load testing

## In-Memory / Restart-Reset Areas

The following state classes are known to include runtime or process-local behavior and must not be described as durable without a separate persistence proof path.

- Heat runtime state
- Witness pending requests and cooldowns
- Some session/world state
- Sovereign session / echo
- Capability runtime state
- Selected combat/session timers

For the durable-state classification, use [Persistence Matrix](./PERSISTENCE_MATRIX.md). That matrix is documentation only; it does not implement persistence, migrations, replay, or restore guarantees.

## Not Claimed

Akalynth v0.1 does **not** claim:

- Production deployment readiness
- Commercial MMO readiness
- Content-alpha gameplay depth
- Public player launch readiness
- Appeals/moderation operations readiness
- Long-lived persistent-world guarantees
- Android release readiness
- External auditor acceptance
- Cryptographic receipt envelope completeness unless covered by a named verifier output

## Evidence Path

A statement about the repo is evidence-backed only when it names at least one of:

- source file
- protocol contract
- receipt fixture
- verifier output
- CI run artifact
- reproducible local command
- commit SHA

Narrative descriptions are explanatory only. They are not proof artifacts.

## Show Boundary

Safe summary for a potential technical driver:

> Akalynth is a proof-native MMO kernel with a working pre-alpha vertical slice. The repo starts from server authority, receipts, and verification rather than content-first gameplay. It is useful as a base for a technical driver, but it is not production-ready or content-alpha.
