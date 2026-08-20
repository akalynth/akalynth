# Akalynth

A server-authoritative MMO prototype where every gameplay consequence is provable: signed audit receipts, replayable state, and a verification-first engineering culture.

## Overview

Akalynth explored a question most game servers never answer: can an online world *prove* what happened in it? Instead of trusting server logs, every meaningful action — movement, chat, combat, item custody, purchases, tutorial progress — emits a signed, hash-chained receipt. SQLite projections are rebuildable mirrors; the receipt chain is the source of truth. If the database is lost, the world state is reconstructed by replay.

The second design pillar is anti-bot-first enforcement. Clients send *intent* only; the server owns position, timers, inventory, and outcomes. A behavioral "heat" system scores suspicious cadence, escalates to in-world Tem challenges, and records every enforcement decision as a private receipt — with the enforcement state itself surviving restarts through receipt-backed persistence.

The third pillar is mandatory verification. A "verification spine" (76 focused verifier tools across the server workspace, wrapped by a registry package) gates every merge: protocol sync, receipt-chain integrity, gold conservation, persistence restore proofs, anti-cheat determinism, and constitutional player guarantees (G1–G15). CI ran on self-hosted Linux runners, including an Android-emulator job for client protocol parity.

The prototype reached a playable pre-alpha vertical slice: account registration → character creation → a six-step tutorial ("The Gate Remembers") → a gather → refine → deliver loop in the first city — completable in a browser or the native Android client, with a disconnect/reconnect proof that restores all server-owned progress from receipts.

## What I Built

- **Game server** (TypeScript/Node): 100 ms tick loop, intent validation, WebSocket protocol with 120+ typed message shapes shared between server and clients (`packages/shared/protocol.ts`, `docs/PROTOCOL.md`)
- **Signed receipt chain**: hash-chained JSONL audit log with Ed25519 chronicle signing, replay verification, and 27 versioned SQLite schema migrations with fail-closed schema gates (`apps/server/src/persist/`)
- **Anti-cheat pipeline**: heat scoring, Tem anti-bot challenges, witness quorum mechanics, receipt-backed penalty persistence (`apps/server/src/anticheat/`, `docs/ANTICHEAT.md`)
- **Two clients**: a React/Vite web play client and a native Kotlin Android client, kept honest by an automated protocol-parity test suite and a frozen client contract (`docs/CLIENT_CONTRACT_V0_1.md`)
- **Verification spine**: 70+ registered verifiers, mandatory pre-merge, run by CI on self-hosted runners (`packages/verification-spine/`, `docs/VERIFICATION_SPINE_API.md`)
- **End-to-end proof harness**: a credentialed smoke that plays the entire journey (account → tutorial → gather/refine/deliver → reconnect) against a disposable server and verifies the signed receipt chain afterwards (`scripts/smoke-beta-first-playable-proof.mjs`)
- **Deployment engineering**: Docker container builds pinned to Node 24, Caddy TLS termination, systemd units, staged preflight with schema-regression gates, rollback runbooks, and receipt-logged publishes (`infra/`, `docs/runbooks/`)

## Architecture

```text
Client (web / Android)          Server (authoritative)
  intent only  ──────────▶   validate → apply → broadcast
                                    │
                                    ▼
                       signed receipt chain (JSONL, hash-linked)
                                    │
                        ┌───────────┴───────────┐
                        ▼                       ▼
              SQLite projections        replay / audit verifiers
              (rebuildable mirror)      (chain, conservation, restore)
```

Full description: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · protocol surface: [`docs/PROTOCOL.md`](docs/PROTOCOL.md) · claim boundary: [`docs/CURRENT_STAGE.md`](docs/CURRENT_STAGE.md)

## Technology

TypeScript, Node.js, WebSocket (`ws`), SQLite (`better-sqlite3`), React + Vite, Kotlin (Android, Jetpack Compose), Rust (chronicle napi bridge, `crates/chronicle/`), Docker, Caddy, systemd, GitHub Actions on self-hosted Linux runners.

## Project Status

**Akalynth is a completed/archived project preserved as a technical portfolio and reference implementation. It is not under active development.**

The repository intentionally preserves its full engineering history — 1,000+ commits (January–August 2026), decision records, runbooks, postmortems, and receipt-logged deploy evidence — as it was when active development ended.

## Running It

The local development loop still works on Linux with Node 24.15.0:

```bash
npm run install:all
npm run build:packages
cd apps/server && npm run rulebook:genesis && cd ../..
npm run dev:server:fresh        # terminal A — server on :3000 (local-only dev key)
npm run dev:client              # terminal B — web client on :5173/play/
```

Focused verification (no server needed): `npm run verify:quick` · full journey proof: `npm run verify:beta-first-playable-proof`

Hosted environments (beta/production servers, Android distribution channels) are decommissioned or frozen and are not part of this archive's claims.

## Screenshots / Demo

- World and character rendering: `docs/asset-decisions/AKALYNTH_CHARACTER_VISUAL_PLACEMENT_REVIEW_V1/screenshots/`
- NPC and creature scale passes: `docs/asset-decisions/AKALYNTH_DEBUG_CLIENT_VISUAL_SCALE_TUNING_V1/screenshots/`
- Playable journey evidence: `docs/evidence/` (receipt-logged publish and proof records)

## Lessons / Engineering Decisions

- **Receipts before features.** Making the audit chain the source of truth (and SQLite a rebuildable mirror) turned "what happened?" from archaeology into replay — and made restart/restore guarantees testable (`docs/PERSISTENCE_MATRIX.md`).
- **Claim discipline scales better than optimism.** The repo separates what is *mechanically enforced* from what is merely *implemented* (`docs/CURRENT_STAGE.md`, `docs/KNOWN_GAPS.md`); every material claim needs a named verifier and commit.
- **Schema gates earn their keep.** A production-shaped deploy was once blocked by a fail-closed check (target schema 24 vs live DB 25), rolled back cleanly, and documented in a postmortem instead of corrupting state (`docs/postmortems/`).
- **Two clients keep a protocol honest.** The Android parity test suite caught contract drift that a single-client project would have shipped.

## License

Proprietary view-only license — see [`LICENSE`](LICENSE). The code may be read for evaluation; reuse requires written permission.
