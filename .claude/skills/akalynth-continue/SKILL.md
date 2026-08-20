---
name: akalynth-continue
version: 1.0.1
description: >
  Session handoff for Akalynth after archival (2026-08-20 origin point).
  Load references/CONTINUATION_STATE.md first. Triggers on "continue Akalynth",
  "Start", "origin point", "pick up where we left off", "akalynth handoff",
  or when the agent needs repo context without re-discovery. Historical
  triggers (beta v9, azura_gather, goal0 ui inspect) still load this file
  so agents see that those lanes are closed.
---

# Akalynth Continue

Use this skill when resuming Akalynth work without re-deriving context from scratch.

Akalynth is an **archived portfolio repository**. There is no live beta or
prod lane and no open product roadmap. "Start" or "continue" means read the
origin-point handoff, re-probe, and do only explicitly authorized owner-side
or docs-hygiene work.

## First action

1. Read [references/CONTINUATION_STATE.md](references/CONTINUATION_STATE.md) — origin point 2026-08-20; older sections are historical only.
2. Read [AGENTS.md](../../../AGENTS.md) for skills routing and operating posture.
3. Read the architect brief at [../akalynth-architect/references/CURRENT_BRIEF.md](../akalynth-architect/references/CURRENT_BRIEF.md).
4. Route any remaining subtask via `.codex/CODEX_MAP.md`. Do not open A2, deploy, or F-Droid work from this skill.

## Workspaces (historical — do not treat as live)

| Path | Role |
|------|------|
| This checkout / `github.com/akalynth/akalynth` | **Canonical Git source** (public archive) |
| `/home/sovereign/akalynth-ops/repos/akalynth` | Historical ops Git path — not this Cloud workspace |
| `/home/sovereign/akalynth-ops` | Historical ops custody |
| `/opt/akalynth-beta` on ops-dev-01 | Historical beta runtime; host retired 2026-08-20 |

## Default posture

- **Archived** — no new product development, roadmap, or live-host mutation.
- **Evidence before mutation** — re-probe `git status`, HEAD, and GitHub visibility.
- **No secrets** in files, commits, or chat output.
- **Hosts are retired** — `api.akalynth.com` and `beta-api.akalynth.com` are not live lanes.
- **Skills** — edit only in `.claude/skills/`; run `npm run verify:skills` after skill changes.

## Sub-skills (common continuations)

| Task | Skill |
|------|-------|
| Cross-cutting claim / origin briefing | `akalynth-architect` |
| Android client source (no publish) | `android-client` |
| Protocol / WS messages | `protocol-guardian` |
| Historical beta deploy notes | `deploy-steward` — read only; do not deploy |
| CI failures | `ci-steward` |
| Local verification commands | `test-runner` |
| Full system audit (source only) | `akalynth-system-audit` |

## After reading handoff

Update `references/CONTINUATION_STATE.md` when you complete a major milestone so the next agent inherits accurate state. Do not restore closed beta or A2 items as current work.