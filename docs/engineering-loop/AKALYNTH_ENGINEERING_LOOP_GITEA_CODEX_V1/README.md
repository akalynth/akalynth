# Akalynth Engineering Loop: Gitea + Codex v1

Status: `local_loop_seeded`

This record defines the first local Akalynth engineering loop:

```text
GitHub canonical source
  -> local Gitea mirror/workbench
  -> Codex packet
  -> Gitea issue
  -> Codex branch
  -> local validation
  -> local Gitea PR
  -> GitHub upstream review
```

## Authority Split

- GitHub remains the canonical public/source remote.
- Local Gitea is the private agent workbench, local issue queue, and local PR
  review surface.
- Codex packets are task authority for agent branches.
- CI and focused local validation are proof gates.
- Receipts explain what changed and why.

## First Packet

- Packet: `AKALYNTH_FORGEHOLD_NEXT_PACKET_V1`
- Path: `docs/codex-work-packets/forgehold-next-packet-v1/Forgehold.next_packet.md`
- Source: Forgehold route source intake and release gates.
- Boundary: no gameplay promotion and no runtime mutation.
- Upstream: merged via GitHub PR #312 and PR #313.

## Second Packet

- Packet: `AKALYNTH_CHILL_ZONE_SHOWCASE_CLOSURE_V1`
- Path: `docs/codex-work-packets/chill-zone-showcase-closure-v1/ChillZone.showcase_closure.md`
- Loop record: `docs/engineering-loop/AKALYNTH_ENGINEERING_LOOP_CHILL_ZONE_SHOWCASE_V1/`
- Source: showcase runbook + chill-zone gather/refine verifiers on `main`.
- Proof target: `chill_zone_gather_refine_deliver_v1`
- Boundary: reproducible local proof only; no deploy and no default-on runtime flags.
- Upstream: merged via GitHub PR #333 (seed), PR #334 (execution).

## Third Packet

- Packet: `AKALYNTH_COUNCIL_DAO_V1`
- Path: `docs/codex-work-packets/council-dao-v1/CouncilDao.v1.md`
- Loop record: `docs/engineering-loop/AKALYNTH_ENGINEERING_LOOP_COUNCIL_DAO_V1/`
- Codex seed: `repos/akalynth-codex` @ `a691d76`
- Proof target: `council_lane_check_permit_v1`
- Boundary: read-only lane check permits only; ops adapter in `akalynth-ops`.
