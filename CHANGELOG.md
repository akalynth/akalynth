# Changelog

All notable changes to the **Akalynth Studio skill pack** are documented here.
Canonical source: `.claude/skills/`; distributed via `plugins/akalynth-studio/`.
Format follows [Keep a Changelog](https://keepachangelog.com/); the pack version
lives in `plugins/akalynth-studio/.codex-plugin/plugin.json`. See the
`release-steward` skill for the release process.

## [Unreleased]

### Added
- `git-push-steward` skill for Git custody, scoped staging, verification
  evidence, and push-boundary checks.
- Codex delegation engineering-loop docs covering worktree preflight, domain
  routing, evidence capture, commit discipline, and push readiness.

## [0.2.0] - 2026-06-06

### Added
- `version` frontmatter on every skill in `.claude/skills/` — a single,
  guard-checked source of truth for the pack.
- Root `AGENTS.md` cross-tool entry point linking to `.codex/CODEX_MAP.md` and
  the canonical skill set.
- `scripts/verify_skills.sh` (`npm run verify:skills`) — CI guard validating
  skill frontmatter and the canonical-source / symlink invariant; wired into the
  `verify` and `repo-metadata` CI jobs.

### Changed
- `game-server-steward`: corrected the `apps/server/src` layout
  (`world/`, `skills/`, `character/`, `account/`, `anticheat/`) — the old
  `game/`, `commands/`, `state/` paths do not exist.
- `release-steward`: release checklist now references real npm scripts; the
  missing parity/inventory automation is explicitly marked planned.
- `observability-steward`: replaced the dead `docs/runtime-health-contract.md`
  reference with `docs/CLIENT_CONTRACT_V0_1.md` and the health route.
- `akalynth-system-audit`: runbook version now tracks the skill's `version`
  frontmatter instead of a hardcoded git tag.

## [0.1.0] - 2026-06-06

### Added
- Initial Akalynth Studio skill pack. Collapsed five duplicated skill stores
  into one canonical `.claude/skills/` (21 skills) with symlinked plugin and
  runtime stores; regenerated `.codex/CODEX_MAP.md`.
