# Forgehold Next Packet v1

Status: `codex:ready`

Authority object: `AKALYNTH_FORGEHOLD_NEXT_PACKET_V1`

Local forge issue authority: Gitea issue created from this packet.

## Goal

Create the first repeatable Akalynth engineering-loop packet from the Forgehold
route source intake. This packet is a task-authority object for Codex agents,
not a gameplay promotion.

## Source Inputs

- `docs/asset-decisions/AKALYNTH_FORGEHOLD_ROUTE_SOURCE_INTAKE_V1/FORGEHOLD_ROUTE_SOURCE_INTAKE.md`
- `drop/AKALYNTH_FORGEHOLD_ROUTE_SLICE_V1/docs/AKALYNTH_FORGEHOLD_ROUTE_PRODUCTION_CHECKLIST_V1.md`
- `drop/AKALYNTH_FORGEHOLD_ROUTE_SLICE_V1/docs/AKALYNTH_FORGEHOLD_ROUTE_RELEASE_GATES_V1.md`
- Current Forgehold route skill surface in `apps/server/src/skills/`
- Current route survey verifier in `apps/server/tools/verify-route-surveys.ts`

## Packet Work

1. Choose one minimum Forgehold promotion path.
2. Define the server-owned state and receipt that would prove that path.
3. Keep Android and debug-client behavior intent-only.
4. Add or update focused verifier coverage before any playable claim.
5. Record validation evidence and a receipt for the local Gitea PR.

Recommended first path:

- `forgehold_missing_shipment_v1`
- Proof target: the player can understand the missing-shipment contradiction
  without unlocking travel, granting rewards, changing heat, or mutating
  economy state.

## Branch Contract

- Branch prefix: `codex/forgehold-`
- Local Gitea labels:
  - `codex:ready`
  - `codex:running`
  - `codex:needs-review`
  - `codex:accepted`
  - `codex:blocked`
  - `packet:forgehold`
- Local PR target: `main`
- GitHub remains the canonical public/source remote.
- Gitea is the local agent workbench and review queue.

## Validation Gate

Minimum focused validation for this packet:

- `git diff --check`
- `npm -w apps/server run verify:quick`
- `npm -w apps/server run verify:route-surveys`
- Android protocol parity or focused unit coverage when client-visible route
  payloads change.

## Non-Claims

This packet does not:

- promote Forgehold to canonical gameplay state;
- open a route, dungeon, boss, reward, item, or faction consequence;
- change runtime state under `/opt`, `/var/lib`, or `/etc`;
- deploy, restart, or mutate production/staging/beta services;
- replace GitHub as canonical public/source remote.

## Acceptance Evidence

The packet is accepted only after:

1. A local Gitea issue exists from this packet.
2. One Codex agent claims the issue by moving it from `codex:ready` to
   `codex:running`.
3. The agent works on a branch with this packet as authority.
4. A local Gitea PR exists for that branch.
5. Focused validation evidence is attached to the PR or recorded in a receipt.
6. The accepted branch is pushed to GitHub for canonical upstream review.
