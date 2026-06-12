# Akalynth Known Gaps

> Last reviewed against `main` on 2026-05-30.

## Purpose

This file prevents showcase language from outrunning the repository's current proof surface.

A gap is not a failure by itself. A hidden or overstated gap is a failure of presentation and governance.

## Release Blockers

- No documented two-green-main proof run is recorded in this repo packet.
- No production deployment proof is included.
- Android release path is not proved.
- Some runtime state resets on process restart. Anti-cheat enforcement (heat score, penalty window, Tem cooldown, throttle/kick/warn counts) is the exception: it is receipt-backed, materialized to SQLite, restored on reconnect, and gated by `verify:anticheat-persistence` in CI. Remaining resets (witness pending requests/cooldowns) are intentionally ephemeral given their 12s/60s lifetimes; caps and sovereign session remain in-memory but are debug-gated, not release features.
- Scope docs require ongoing alignment with implemented systems.
- Some verifier coverage depends on fixture state rather than full live-world execution.

## Engineering Risks

- Large server entrypoint concentrates many concerns in one file.
- Multiple systems are debug-only or environment-gated.
- Verifier coverage is uneven across newer gameplay systems.
- Persistence boundaries are classified in `docs/PERSISTENCE_MATRIX.md`. Anti-cheat enforcement and property ownership have implemented, CI-verified restore guarantees; most other rows remain classification-only and are not yet release-claimed durable.
- Content loop is not deep enough for content-alpha.
- CI artifact packaging should be made easier to inspect.

## Product Risks

- Player purpose is not yet obvious beyond proof-native systems.
- The first 0-30 minute Rookguard path now has a source contract and sim-visible
  plan in `docs/ROOKGUARD_FIRST_30_MINUTES_V1.md`; the remaining gap is live
  beta/staging polish and end-to-end presentation proof.
- Rookguard city expansion now has a source contract and first wiring slice in
  `docs/ROOKGUARD_CITY_EXPANSION_V1.md`; Rookguard quest/profession projection
  is now server-owned, receipt-replay backed for tutorial/training/profession/gate
  progress, carries Heroes Codex profession profiles, and has a local WebSocket
  E2E verifier. Android now exposes guild-hall Codex vocation controls, and the
  training slime has prompt-stage asset lineage plus display-only client
  fallbacks. Remaining gaps are normalized/atlas-packed monster sprites and live
  beta/staging presentation proof.
- A potential driver may get lost in speculative docs unless the showcase packet is used first.
- Lore, monetization, and governance documents can distract from the core local proof run.

## Presentation Rules

Do not describe Akalynth as:

- production-ready,
- launched,
- content-alpha,
- anti-cheat complete,
- persistence complete,
- externally verified,
- Android-release ready.

Allowed bounded description:

> Akalynth is a pre-alpha proof-native MMO vertical slice with a useful server-authoritative and verification-oriented base.

## Next Closure Target

The next closure target is not a launch.

The next closure target is a reproducible local proof run with:

- named commit,
- documented runbook,
- passing showcase preflight,
- passing agent economy simulator proof,
- deterministic first 0-30 minute Rookguard path plus the existing five-minute
  worker, homesteader, and merchant simulator role mapping,
- captured command transcript,
- receipt output,
- known-gaps register,
- persistence matrix,
- and one CI artifact bundle.
