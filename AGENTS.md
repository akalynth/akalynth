# AGENTS.md — Akalynth

Cross-tool entry point for AI coding agents (Codex, Claude Code, Cursor, Copilot,
…). This file orients any agent; the authoritative, detailed map is
[`.codex/CODEX_MAP.md`](.codex/CODEX_MAP.md).

## What Akalynth is

A social-first, low-grind MMO prototype — a TypeScript monorepo (`apps/`,
`packages/`) plus the Android client in `apps/android/`.

## Skills (single source of truth)

- **Canonical source: `.claude/skills/`** (27 steward and meta/handoff skills).
  Edit skills **only** here.
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
  commit / push custody → `git-push-steward`; world coherence, canon conflicts,
  design provenance, and conformance → `world-architect`.

## World Architect

Use `world-architect` for world-facing design, canon reconciliation,
cross-domain conflicts, and design-conformance review. Before substantial work:

1. Read `docs/AKALYNTH_DECISION_RECORD_V1.md`.
2. Identify the applicable authority domain and approval state.
3. Inspect existing canon, decisions, implementation, and evidence.
4. Label observations, canon, inferences, assumptions, proposals, conflicts,
   open questions, and decisions explicitly.
5. Route implementation and verification through the relevant specialist skills.

The World Architect may classify, reconcile, propose, and assess conformance. It
may not establish canon, approve its own proposals, modify Civil Guarantees
G1–G15, promote assets, commit, push, or deploy without separate authority.
Implementation and observed behavior do not become approval or canon by
existence. Cross-domain discrepancies enter the design-provenance conflict
procedure; no source wins automatically by format or implementation status.

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
