# AGENTS.md — Akalynth

Cross-tool entry point for AI coding agents (Codex, Claude Code, Cursor, Copilot,
…). This file orients any agent; the authoritative, detailed map is
[`.codex/CODEX_MAP.md`](.codex/CODEX_MAP.md).

## What Akalynth is

A social-first, low-grind MMO prototype — a TypeScript monorepo (`apps/`,
`packages/`) plus the Android client in `apps/android/`.

## Skills (single source of truth)

- **Canonical source: `.claude/skills/`** (steward skills + meta/handoff skills).
  Edit skills **only** here.
- **Architect:** `akalynth-architect` — cross-cutting claim-boundary decisions,
  multi-steward routing, and leverage triage. Load
  `.claude/skills/akalynth-architect/references/CURRENT_BRIEF.md` on
  "AKALYNTH ARCHITECT" or when work spans protocol, runtime, clients, and
  deploy. Pointer: `docs/AKALYNTH_ARCHITECT.md`.
- **Session handoff:** `akalynth-continue` — read
  `.claude/skills/akalynth-continue/references/CONTINUATION_STATE.md` before
  resuming beta Android, gather, or Goal0 UI inspect work. Mirror to Claude Code
  with `./scripts/sync-claude-continue-skill.sh`.
- Every other store is a symlink into it: the Codex plugin
  `plugins/akalynth-studio/skills/` (10 curated), the gitignored runtime
  `.agents/skills`, and `~/.codex/skills/`. CI enforces this via
  `npm run verify:skills` (`scripts/verify_skills.sh`).
- Routing (which skill for which task) lives in the Routing Matrix of
  `.codex/CODEX_MAP.md`. Quick pointers: server runtime → `game-server-steward`;
  protocol / WS / HTTP → `protocol-guardian`; deploy / systemd / Caddy →
  `deploy-steward`; receipts / chronicle → `receipt-chain-steward`; whole-system
  evidence audit → `akalynth-system-audit`; verification commands → `test-runner`;
  commit / push custody → `git-push-steward`; cross-cutting architecture →
  `akalynth-architect`.

## Operating posture

- Recommended Codex config: copy `.codex/config.toml.example` into
  `~/.codex/config.toml` (read-only review by default; explicit deploy profile).
- **Production is a separate host** (`/opt/akalynth`, `/var/lib/akalynth`,
  `/etc/akalynth`); this checkout is the dev box. Distinguish review vs deploy
  authority before mutating any host/runtime state.
- Never commit secrets, private keys, tokens, or production credential material;
  never print secret material from server config or runtime data trees.
- **Shared working tree:** a concurrent Codex session may edit this repo — scope
  `git add` to your own files; never broad-add or commit unrelated staged work.

## Verify / release

- Skills: `npm run verify:skills`. Broader: `npm run verify` / `npm run verify:audit`.
- Releasing the skill pack: follow the `release-steward` skill and update
  `CHANGELOG.md` (pack version lives in
  `plugins/akalynth-studio/.codex-plugin/plugin.json`).
