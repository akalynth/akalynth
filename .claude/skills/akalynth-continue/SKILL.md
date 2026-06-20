---
name: akalynth-continue
version: 1.0.0
description: >
  Session handoff for continuing Akalynth work after beta v9 Android polish, chill-zone gather, and Goal0 UI inspect pipeline.
  Load references/CONTINUATION_STATE.md first. Triggers on "continue Akalynth", "pick up where we left off", "beta v9", "azura_gather", "goal0 ui inspect", "akalynth handoff", or when the agent needs repo/host/script context without re-discovery.
---

# Akalynth Continue

Use this skill when resuming Akalynth work without re-deriving context from scratch.

## First action

1. Read [references/CONTINUATION_STATE.md](references/CONTINUATION_STATE.md) — authoritative handoff from the last full loop (2026-06-20).
2. Read [AGENTS.md](../../../AGENTS.md) for skills routing and operating posture.
3. Route subtasks via `.codex/CODEX_MAP.md` Routing Matrix (or the quick pointers in AGENTS.md).

## Workspaces (do not confuse)

| Path | Role |
|------|------|
| `/home/sovereign/akalynth-ops/repos/akalynth` | **Canonical Git source** — edit here, push to `akalynth/akalynth` |
| `/home/sovereign/akalynth-ops` | Ops custody — `bin/akalynth-lane-deploy.sh`, evidence, receipts |
| `/opt/akalynth-beta` on ops-dev-01 | **Deployed beta runtime tree** (not Git; rsync from source) |

## Default posture

- **Evidence before mutation** — re-probe health, `git status`, service state.
- **No secrets** in files, commits, or chat output.
- **Prod vs beta vs dev** — `api.akalynth.com` is prod; `beta-api.akalynth.com` is ops-dev-01.
- **Skills** — edit only in `.claude/skills/`; run `npm run verify:skills` after skill changes.

## Sub-skills (common continuations)

| Task | Skill |
|------|-------|
| Android client / gather UI | `android-client` |
| Protocol / WS messages | `protocol-guardian` |
| Beta deploy / systemd | `deploy-steward` + `references/CONTINUATION_STATE.md` § Beta lane |
| CI failures | `ci-steward` |
| Goal0 VM UI screenshots | `references/CONTINUATION_STATE.md` § UI inspect |
| Gather server loop | `game-server-steward`, `content-designer` |
| Full system audit | `akalynth-system-audit` |

## After reading handoff

Update `references/CONTINUATION_STATE.md` when you complete a major milestone (new version publish, CI fix, stable automation) so the next agent inherits accurate state.