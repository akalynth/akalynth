# Repo Branch Hygiene Completion (2026-07-11)

## Scope

Performed cleanup in `/home/sovereign/akalynth-ops/repos/akalynth` after the contract/release hardening pass, with a preference to preserve non-merged WIP and archive safe candidates instead of destructive deletion.

## Deleted branch set (stale remote tracking + merge-equivalent)

- `codex/assets-combined-20260623`  
  archived as `refs/cleanup/20260711-codex_assets-combined-20260623`
- `codex/azura-loop-alive-v1`  
  archived as `refs/cleanup/20260711-codex_azura-loop-alive-v1`
- `preserve/ops-dev-wip-20260620`  
  archived as `refs/cleanup/20260711-preserve_ops-dev-wip-20260620`
- `client-play-blank-screen-repair`  
  archived as `refs/cleanup/20260711-client-play-blank-screen-repair`
- `feat/high-city-phase-1-2-play-shell`  
  archived as `refs/cleanup/20260711-feat_high-city-phase-1-2-play-shell`
- `agent/beta-ui-presentation-clean`  
  archived as `refs/cleanup/20260711-agent_beta-ui-presentation-clean`

These were removed because their remotes were `:gone`, their commits were represented in current merged ancestry checks, and they were not actively checked out in active worktrees.

## Retained branches

- `agent/modern-ui-customizable-hud`  
  active branch with remote still present
- `feat/pr-030-icon-sprite-id-protocol`  
  kept: `origin/main` divergence (`ahead 1`, `behind 6`)
- `main`  
  canonical base branch
- `refs/cleanup/20260711-*`  
  retained as immutable pointers to pre-cleanup branch tips for traceability

## Notes

- `origin` was pruned (`origin/agent/beta-ui-presentation-clean` removed; no remaining active worktrees for that branch after cleanup).
- No branch deletions were performed in a destructive manner; archived branch refs preserve historical recoverability.

## Merge cleanup decision (deity pass, 2026-07-11)

- Decision: all remaining local stale branch candidates are now decommissioned.
- Final keep set:
  - `main` (canonical base)
  - `agent/modern-ui-customizable-hud` (remote present; active branch context)
  - `feat/pr-030-icon-sprite-id-protocol` (`origin/main`: ahead 1, behind 6; intentionally preserved for later integration/review)
  - `refs/cleanup/20260711-*` (immutably preserved historical branch tips)
- Final delete set this cycle:
  - `client-play-blank-screen-repair` (archived as `refs/cleanup/20260711-client-play-blank-screen-repair`)
  - `feat/high-city-phase-1-2-play-shell` (archived as `refs/cleanup/20260711-feat_high-city-phase-1-2-play-shell`)
  - `agent/beta-ui-presentation-clean` (archived as `refs/cleanup/20260711-agent_beta-ui-presentation-clean`)
- `akalynth-codex` repo check: no remote-tracking stale (`:gone`) branches and no additional merge candidates under this sweep.

## End-to-end closeout (2026-07-11T18:18Z)

- Contract and private payload gate: PASS; 8 root-area contracts and 3 private payload contracts validated.
- Release workflow contract check: PASS; generated contract JSON is in sync with workflow source.
- Combined release gates: PASS; evidence recorded in `akalynth-codex/evidence/codex-release-gates/20260711T181625Z-full-loop/`.
- Beta publish: PASS for commit `250aa878695ca925c149e97015a8cf2a2b2705c9`.
- Live checks: rollout, API health, APK URL, site title, and `/play/` returned successfully.
- Durable publish receipt: `docs/evidence/publish-beta/20260711T181828Z.json`.
- The hygiene branch HEAD was correctly rejected when paired with the older static artifact; the successful publish used an isolated clone pinned to the artifact's exact commit. No source branch or build metadata was rewritten.
- Existing unrelated dirty WIP remains preserved for separate ownership and review.
