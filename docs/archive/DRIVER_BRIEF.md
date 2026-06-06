# Akalynth Technical Driver Brief

> **Purpose:** Orient a prospective technical driver on what Akalynth is, what is genuinely valuable in the repo today, and what to evaluate first. Pair this with `docs/SHOWCASE_RUNBOOK.md` (how to run it), `docs/CURRENT_STAGE.md` (claim boundary), and `docs/KNOWN_GAPS.md`.

## One-Line Description

Akalynth is a server-authoritative MMO prototype built around audit receipts, verifier gates, and proof-native game operations.

## Why This Exists

Most MMO prototypes start with content and later bolt on anti-cheat, auditability, moderation, economy controls, and operational discipline.

Akalynth starts from a different premise:

- server authority is the trust root,
- the client sends intent, not truth,
- consequential game actions emit evidence,
- verifier gates define which claims can be made,
- public presentation must not outrun proof artifacts.

## What Is Valuable

A technical driver should evaluate the repository as an authority/evidence substrate first and a content-complete MMO second.

Useful assets already present:

- server-authoritative WebSocket loop,
- shared protocol package,
- audit receipt chain,
- chronicle/evidence surfaces,
- verification spine,
- CI verification workflow,
- Android client foundation,
- debug web client foundation,
- anti-bot/Tem/heat/witness design direction,
- explicit Linux + Android platform boundary.

## What A Driver Should Evaluate First

1. Can the local runbook be executed from a fresh clone?
2. Does the server build and run?
3. Does the debug client build and connect?
4. Are receipts emitted on a local run?
5. Do protocol and MVP verification scripts pass?
6. Are unsupported claims clearly fenced?
7. Is the next 30-day path obvious?

## What This Needs Next

The next driver should not begin by adding lore, monetization, or more speculative systems.

Priority order:

1. Produce one clean local proof run.
2. Produce one green CI proof surface with downloadable artifacts.
3. Reconcile documentation with implemented systems.
4. Classify persistence boundaries.
5. Pick one primary demo client path.
6. Build one repeatable ten-minute gameplay loop.

## Driver Success Bar

A driver is useful if they can make the repository easier for another operator to run, inspect, and challenge.

A driver is not useful if they only add more mechanics while the stage boundary, runbook, verification outputs, and known gaps remain unclear.

## Safe External Framing

> Akalynth is a pre-alpha proof-native MMO kernel. It is useful because it starts from server authority, receipts, and verification. It is not a launched game, a content alpha, or production MMO infrastructure yet.
