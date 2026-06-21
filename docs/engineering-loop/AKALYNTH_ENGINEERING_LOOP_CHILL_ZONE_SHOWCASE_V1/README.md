# Akalynth Engineering Loop: Chill-Zone Showcase Closure v1

Status: `packet_seeded`

Second repeatable engineering-loop packet after Forgehold Act I.

## Loop (unchanged authority split)

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

## Packet

| Field | Value |
| --- | --- |
| Object ID | `AKALYNTH_CHILL_ZONE_SHOWCASE_CLOSURE_V1` |
| Path | `docs/codex-work-packets/chill-zone-showcase-closure-v1/ChillZone.showcase_closure.md` |
| Proof target | `chill_zone_gather_refine_deliver_v1` |
| Recommended branch | `codex/chill-zone-showcase-closure-v1` |
| Label family | `packet:chill-zone` |

## Closure Target

Aligns with `docs/KNOWN_GAPS.md` **Next Closure Target**: reproducible local proof run
with named commit, runbook, verifier outputs, transcript, and receipt — for the
chill-zone gather → refine → deliver loop already implemented on `main`.

## Boundary

- No runtime deploy or `/opt` / `/var/lib` / `/etc` mutation.
- No default-on gather/refine in production-shaped configs.
- Optional `?mode=world` visuals are display-only; server map authority unchanged.

## Receipt

- Path: `docs/engineering-loop/AKALYNTH_ENGINEERING_LOOP_CHILL_ZONE_SHOWCASE_V1/receipt.json`
- Status: `created` until an agent records validation evidence.

## Prior Loop

- Forgehold packet v1: `docs/engineering-loop/AKALYNTH_ENGINEERING_LOOP_GITEA_CODEX_V1/`
- Packet: `docs/codex-work-packets/forgehold-next-packet-v1/Forgehold.next_packet.md`
- Merged upstream: GitHub PR #312, #313