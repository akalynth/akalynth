# Akalynth Engineering Loop: Witness Council DAO v1

Status: `closed`

Third repeatable engineering-loop packet. Ops governance shell over proposals,
votes, and read-only lane-check execution permits.

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

## Packet

| Field | Value |
| --- | --- |
| Object ID | `AKALYNTH_COUNCIL_DAO_V1` |
| Path | `docs/codex-work-packets/council-dao-v1/CouncilDao.v1.md` |
| Codex authority | `repos/akalynth-codex/design/council-dao-v1.md` |
| Proof target | `council_lane_check_permit_v1` |
| Recommended branch | `codex/council-dao-v1` |
| Label family | `packet:council-dao` |

## Boundary

- No runtime deploy or `/opt` / `/var/lib` / `/etc` mutation from council path.
- v1 action classes: `lane:*:check` only.
- Ops adapter lives in `akalynth-ops`; schemas in `akalynth-codex`.

## Receipt

- Path: `docs/engineering-loop/AKALYNTH_ENGINEERING_LOOP_COUNCIL_DAO_V1/receipt.json`
- Status: see `receipt.json`.

## Prior Loops

- Chill-zone showcase: `docs/engineering-loop/AKALYNTH_ENGINEERING_LOOP_CHILL_ZONE_SHOWCASE_V1/`
- Forgehold packet v1: `docs/engineering-loop/AKALYNTH_ENGINEERING_LOOP_GITEA_CODEX_V1/`