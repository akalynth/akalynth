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
