# Chill-Zone Showcase Closure v1

Status: `codex:ready`

Authority object: `AKALYNTH_CHILL_ZONE_SHOWCASE_CLOSURE_V1`

Local forge issue authority: Gitea issue to be created from this packet.

## Goal

Close the next Akalynth engineering-loop proof gap: a **reproducible local showcase**
for the chill-zone gameplay loop already on `main`, without promoting beta deploy,
default-on runtime flags, or economy claims.

This packet is task authority for Codex agents, not a content-alpha or launch claim.

## Why This Packet Now

- `origin/main` includes chill-zone gather → refine → deliver through refine step 4
  (PR #332 and prior gather/refine steps).
- `docs/KNOWN_GAPS.md` names the next closure target as a reproducible local proof run
  with runbook, transcript, and receipt output.
- `docs/SHOWCASE_RUNBOOK.md` still treats gather as optional and does not document the
  full gather → refine → deliver path with both runtime flags on.
- `scripts/showcase_local.sh` runs debug-client gather wire authority but not the server
  WebSocket gather/refine loop verifier.

## Source Inputs

- `docs/SHOWCASE_RUNBOOK.md`
- `docs/KNOWN_GAPS.md` (Next Closure Target)
- `docs/PROTOCOL.md` (gather/refine intents and default-off gates)
- `apps/server/tools/verify-gather-loop.test.ts` (`AKALYNTH_CHILL_ZONE_GATHER_WS_E2E_V1`)
- `apps/server/tools/verify-gather.test.ts`
- `apps/debug-client/scripts/verify-gather-wire-authority.mjs`
- `scripts/showcase_local.sh`
- Optional display-only sub-step (if present on branch):
  - `apps/debug-client/src/components/WorldShowcase.tsx`
  - `apps/debug-client/?mode=world` world visual lane using `data/assets-src/sprites/`

## Packet Work

1. Extend `docs/SHOWCASE_RUNBOOK.md` with a first-class **Chill-Zone full loop**
   section documenting both flags:
   - `CHILL_ZONE_GATHER_ENABLED=1`
   - `CHILL_ZONE_REFINE_ENABLED=1`
   - Expected server messages: `gather_*`, `refine_*`, `deliver_result`
   - Expected receipt: `delivery_recorded` with refined-item keystone ack path
   - Explicit default-off boundary in production-shaped configs

2. Extend showcase preflight so closure is one command surface, not tribal knowledge:
   - Update `scripts/showcase_local.sh` and/or add
     `scripts/verify-chill-zone-showcase.sh` that runs:
     - `npm -w apps/server run test:gather`
     - `CHILL_ZONE_GATHER_ENABLED=1 CHILL_ZONE_REFINE_ENABLED=1 npm -w apps/server run test:gather-loop`
     - `npm -w apps/debug-client run verify:gather-client`
   - Wire into `npm run verify:showcase` only if the added step is fast and
     deterministic on a fresh clone (no running server required for WS E2E test).

3. Land optional **world visual showcase** as display-only proof (same branch OK):
   - Commit `?mode=world` debug-client lane if not already on branch
   - Add one runbook bullet for `?mode=world&zone=high-city` and `zone=atlas`
   - Record in receipt that visuals are from `data/assets-src/sprites/` and do not
     change walkability, spawns, or economy authority

4. Write engineering-loop receipt under
   `docs/engineering-loop/AKALYNTH_ENGINEERING_LOOP_CHILL_ZONE_SHOWCASE_V1/receipt.json`
   with command transcript, commit SHA, and non-claims.

5. Open local Gitea issue + PR, then GitHub upstream PR for canonical review.

## Recommended Proof Target

**`chill_zone_gather_refine_deliver_v1`**

On Azura with both flags enabled, a debug-client session (or WS E2E harness) proves:

1. `gather_intent` at an available node → `gather_completed` with held raw item
2. `refine_intent` at refinery station → `refine_completed` with held refined item
3. `deliver_intent` at curation stand → `delivery_recorded` receipt + keystone ack

Proof must also show reject paths remain authoritative when flags are off or player is
out of range / already gathering / already refining.

## Branch Contract

- Branch prefix: `codex/chill-zone-`
- Recommended branch: `codex/chill-zone-showcase-closure-v1`
- Local Gitea labels:
  - `codex:ready`
  - `codex:running`
  - `codex:needs-review`
  - `codex:accepted`
  - `codex:blocked`
  - `packet:chill-zone`
- Local PR target: `main`
- GitHub remains the canonical public/source remote.
- Gitea is the local agent workbench and review queue.

## Validation Gate

Minimum focused validation for this packet:

```bash
git diff --check
npm -w apps/server run verify:quick
npm -w apps/server run test:gather
CHILL_ZONE_GATHER_ENABLED=1 CHILL_ZONE_REFINE_ENABLED=1 npm -w apps/server run test:gather-loop
npm -w apps/debug-client run verify:gather-client
npm run verify:showcase
```

Android protocol parity or focused unit coverage only if gather/refine wire shapes
change (unlikely for this packet).

Optional human-observed demo (not a merge blocker if verifiers pass):

```bash
# Terminal A
cd apps/server
CHILL_ZONE_GATHER_ENABLED=1 CHILL_ZONE_REFINE_ENABLED=1 ALLOW_INSECURE_LOCAL=1 npm run dev

# Terminal B
cd apps/debug-client
npm run dev
# Open Azura, run gather → refine → deliver in Chill-Zone Gather panel
```

## Non-Claims

This packet does not:

- deploy, restart, or mutate beta/staging/production runtime trees;
- enable gather/refine by default in production-shaped systemd/Caddy configs;
- grant gold, tradeable items, shop inventory, or economy promotion;
- claim content-alpha, Android release readiness, or public launch readiness;
- change server walkability, spawn tables, or map collision from client visuals;
- replace GitHub as canonical public/source remote.

## Acceptance Evidence

The packet is accepted only after:

1. A local Gitea issue exists from this packet.
2. One Codex agent claims the issue by moving it from `codex:ready` to
   `codex:running`.
3. The agent works on a branch with this packet as authority.
4. A local Gitea PR exists for that branch.
5. Focused validation evidence is attached to the PR or recorded in
   `docs/engineering-loop/AKALYNTH_ENGINEERING_LOOP_CHILL_ZONE_SHOWCASE_V1/receipt.json`.
6. The accepted branch is pushed to GitHub for canonical upstream review.

## Follow-On Loop (not this packet)

- `AKALYNTH_FORGEHOLD_ASHGLASS_EVIDENCE_V1` — Forgehold Act II evidence ordering
- `AKALYNTH_CLASSIC32_ATLAS_PACK_V1` — `tools/atlas` packer and `data/assets-built/`
- `AKALYNTH_ROOKGUARD_FIRST30_PRESENTATION_V1` — beta web-first driver transcript