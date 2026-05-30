# Akalynth Known Gaps

> Last reviewed against `main` on 2026-05-30.

## Purpose

This file prevents showcase language from outrunning the repository's current proof surface.

A gap is not a failure by itself. A hidden or overstated gap is a failure of presentation and governance.

## Release Blockers

- No documented two-green-main proof run is recorded in this repo packet.
- No production deployment proof is included.
- Android release path is not proved.
- Some runtime state resets on process restart.
- Scope docs require ongoing alignment with implemented systems.
- Some verifier coverage depends on fixture state rather than full live-world execution.

## Engineering Risks

- Large server entrypoint concentrates many concerns in one file.
- Multiple systems are debug-only or environment-gated.
- Verifier coverage is uneven across newer gameplay systems.
- Persistence boundaries are classified in `docs/PERSISTENCE_MATRIX.md`, but not yet implemented as restore guarantees.
- Content loop is not deep enough for content-alpha.
- CI artifact packaging should be made easier to inspect.

## Product Risks

- Player purpose is not yet obvious beyond proof-native systems.
- The first five minutes need one deterministic path.
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
- captured command transcript,
- receipt output,
- known-gaps register,
- persistence matrix,
- and one CI artifact bundle.
