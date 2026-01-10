# Akalynth — Execution Rules (MVP)

## Platform policy (non-negotiable)
- Linux server + Android client only.
- Windows is intentionally unsupported (block installs; do not write Windows instructions).

## Framework decision (locked)
- MVP uses a custom WebSocket server.
- No Colyseus until post-MVP review.

## MVP scope (locked)
- Authoritative grid movement
- Chat
- Tem anti-bot challenge
- JSONL audit receipts
- Two zones: Rookguard (32x32 training) -> Azura (64x64 city)

Not in MVP: combat, inventory, housing logic (placeholders only), NPC AI.

## Source-of-truth files
- Protocol: docs/PROTOCOL.md + shared/protocol.ts
- Architecture: docs/ARCHITECTURE.md
- Anti-cheat: docs/ANTICHEAT.md
- Worlds: docs/WORLD_ROOKGUARD.md, docs/WORLD_AZURA.md

## Engineering rules
- Server is authoritative. Client sends intent only (never coordinates/truth claims).
- One main server tick loop (simple, explicit, auditable).
- Every player action emits a JSONL receipt (audit trail).
- Keep dependencies minimal. Avoid new frameworks unless required.

## Commit discipline (atomic)
- One responsibility per commit.
- Use messages: <area>: <what>
  Examples:
  - docs: add rookguard world spec
  - shared: add tutorial tile codes
  - server: add tutorial gating receipts

## Verification checklist (must pass for each PR)
1) sudo ./scripts/bootstrap_linux.sh
2) cd server && npm install && npm run dev
3) wscat -c ws://localhost:3000
4) login -> enter_world -> move_intent works
5) JSONL receipts written
6) Tem challenge triggers on suspicious movement
