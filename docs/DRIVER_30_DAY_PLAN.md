# Akalynth 30-Day Driver Plan

## Purpose

This plan gives a potential technical driver a bounded execution path.

The goal is not to launch the game in 30 days. The goal is to make the proof-native MMO kernel runnable, inspectable, and directionally useful.

## Week 1: Stabilize Showability

### Objectives

- Fresh-clone runbook passes.
- `npm run verify:showcase` passes.
- CI artifacts are available for inspection.
- Current-stage docs reconcile implemented systems with release claims.
- Known gaps are explicit.

### Exit Artifacts

- Passing local showcase preflight.
- One local command transcript.
- One CI run URL or documented CI blocker.
- Updated `docs/CURRENT_STAGE.md` if any claim boundary changes.

## Week 2: Persistence Boundary

### Objectives

- Use `docs/PERSISTENCE_MATRIX.md` as the state durability baseline.
- Decide which state must persist for v0.2.
- Identify which persistence claims need verifier coverage.
- Avoid broad database rewrites before classification.
- Preserve explicit restart-reset behavior where durability is not needed.

### Exit Artifacts

- Updated `docs/PERSISTENCE_MATRIX.md` if source inspection changes any row.
- At least one verifier or smoke test covering one selected persistence boundary.
- Clear deferral list for non-persisted runtime state.
- No durable-state claim unless backed by command output and artifact.

## Week 3: Client Show Path

### Objectives

- Choose one primary demo client path: debug web or Android.
- Remove confusing first-five-minute paths from the showcase.
- Make login, movement, chat, and one consequence path reliable.
- Document expected screens and observed outputs.

### Exit Artifacts

- Deterministic demo path.
- Screenshot or screen-recording checklist.
- Known UI gaps list.

## Week 4: Gameplay Loop Slice

### Objectives

- Define one repeatable player loop.
- Include one risk/reward mechanic.
- Include one receipt-backed consequence.
- Include one chronicle/evidence explanation.

### Exit Artifacts

- 10-minute playable proof loop.
- One proof-run artifact generated from that loop.
- Updated `docs/CURRENT_STAGE.md` with any newly supported claims.

## Non-Goals For This 30-Day Window

- Production launch.
- Monetization implementation.
- Large lore expansion.
- Marketplace/economy expansion.
- Public release marketing.
- Broad refactor without proof-run preservation.

## Driver Operating Rule

Every week should reduce ambiguity for the next operator.

A useful contribution leaves behind one or more of:

- command,
- verifier,
- fixture,
- artifact,
- runbook,
- matrix,
- receipt,
- bounded claim update.
