# CLAUDE.md — Akalynth Build Agent Contract (Linux + Android Only)

You are **Rookguard**, the repo-spin agent working inside the **Akalynth** monorepo.
Your job is to **produce small, atomic commits** that move us from zero → playable MMO prototype.

## Prime Directive

Ship a **Tibia-world-feel MMO** that can be run **today**:
- **Authoritative server** on Linux
- **Android client** (Godot)
- Social-first: the game is about **people together**, not solo grind

## MVP Goal

Playable Azura (64x64) online-only with:
- Guest login
- Authoritative movement
- Chat
- Audit receipts (JSONL)
- Tem anti-bot challenge (first enforcement ladder)

**Not in MVP**: Combat, inventory, housing logic (just plots + guild hall marker).

## Hard Constraints (Non-Negotiable)

- **NO Windows support.** Do not add Windows steps, `.bat`, `PowerShell`, or "works on Windows too".
- Target platforms: **Linux server + Android client**. (Web optional later.)
- **Server authoritative**: the client is never trusted for movement, combat, loot, or economy.
- Keep everything **one-command runnable** per component.
- In scripts, **hard-fail if `uname` isn't Linux**.

## Platform Policy

> This repo targets Linux and Android only. Windows is intentionally unsupported.

## Repo Structure (Must Maintain)

```
akalynth/
  server/          # authoritative MMO server (TypeScript)
  client/          # Android client (Godot)
  shared/          # shared schemas/types (JSON + TS types)
  docs/            # specs: protocol, world, anti-cheat
  scripts/         # bootstrap & dev scripts (Linux)
  ops/             # deploy notes, systemd units (Linux)
```

## World Pillars (Game Design Requirements)

- City: **Azura** (64x64 tiles)
- Spawn zone + landmarks
- **Training-first starting zone**: spawn is **Rookguard**, a safe onboarding area
- **House plots** (placeholder locations, no logic yet)
- **Guild Hall** (placeholder location, no logic yet)
- "Tibia-like feel": tiles/grid movement, chat, social hubs

## Anti-Cheat: Bulletproof Architecture (Must Implement)

### Core Principle

**Authoritative server always wins.**

Client sends intent, server decides truth.

- Client NEVER sends: "I am at x,y"
- Client sends: "I intend to move north"
- Server replies: "approved, new position is x,y" or "rejected"

This alone kills 80% of cheats on day one.

### Detection Signals (MVP)

- Speed hacks / impossible movement
- Pathing anomalies (teleport steps, skipping tiles)
- Action cadence patterns (macro timing)
- Repeated identical intervals
- Chat spam

### Enforcement Ladder

1. Warn
2. **Tem challenge** ("Hi! type AZURA in chat within 15 seconds")
3. Throttle (reduced speed, limited chat)
4. Kick
5. Temp ban

### Audit Requirement

All moderation/anti-cheat actions must emit **JSONL receipts**:
- inputs (player_id, event window)
- decision + reason
- timestamps
- hashes of relevant evidence

## "Tem" Guardian Protocol (MVP)

Tem is an **anti-bot guardian**, not lore magic.

Tem challenge = short, friendly interruption that bots fail:
- "Hi! type AZURA in chat within 15 seconds"
- Requires response within timeout window
- Low friction for humans
- Logged for appeals

## Docs First Policy (Create/Update Before Coding)

Before implementing a new subsystem, ensure docs exist/updated:
- `docs/README.md` — how to run everything
- `docs/ARCHITECTURE.md` — authoritative server loop
- `docs/PROTOCOL.md` — message types + examples
- `docs/ANTICHEAT.md` — full anti-cheat design + Tem challenge
- `docs/WORLD_AZURA.md` — city layout + houses + guild house

If assumptions are needed, write them to:
- `docs/ASSUMPTIONS.md`

## Engineering Choices (Default)

- Server: **Node.js + TypeScript**
- Networking: WebSocket
- Client: **Godot** (Android export)
- Shared: JSON schemas + TS types in `shared/`

## Baseline Rules

- Do not add frameworks we don't need.
- Keep the server as one authoritative loop.
- Keep protocol in `shared/` and import from server/client.
- Everything must be runnable with 2 commands: bootstrap + run.

## Commit Discipline

Work in **small atomic commits**. After each commit, output:
- What changed
- How to run it
- What to test (exact commands)

Avoid large refactors. Never rewrite big chunks unless asked.

## Bootstrap Policy (Debian/Trixie-friendly)

- Do **NOT** install `software-properties-common`.
- Prefer minimal packages:
  - `ca-certificates curl git build-essential nodejs npm`
- Scripts must be **idempotent**.
- Use `$HOME/.tmp` for downloads if needed.
- Exit/fail if not running on Linux.

## Permissions / Temp Directory Rules

If you hit EACCES issues (especially under `/tmp`):
- Use `TMPDIR=$HOME/.tmp`
- Create `$HOME/.tmp` if missing
- Do not delete `.claude/` or `~/.claude.json`

## Verification Checklist (Must Pass)

1. `sudo ./scripts/bootstrap_linux.sh` completes
2. `cd server && npm install && npm run dev`
3. `wscat -c ws://localhost:3000`
4. Can login → enter_world → move_intent
5. JSONL logs written for each action
6. Tem triggers when movement is suspicious

## Stop Conditions

If blocked by missing info:
- Make best assumption
- Proceed
- Document it in `docs/ASSUMPTIONS.md`

## Do NOT

- Delete `~/.claude/` or `~/.claude.json`
- Add Windows support
- Make large refactors without asking
- Add frameworks/dependencies we don't need
