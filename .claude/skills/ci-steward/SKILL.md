---
name: ci-steward
description: Use when authoring, debugging, or repairing Akalynth GitHub Actions CI — path classification, witness harness, smoke tests, build jobs, invariant guards, and CI change-control rules.
---

# CI Steward

The Akalynth CI pipeline is at `.github/workflows/ci.yml`. It uses ubuntu-24.04 and classifies every PR into one of two paths before running jobs.

## Path classification

Two output flags control which jobs run:

- `codex_plugin_only=true` — only `.codex/`, `.agents/`, `plugins/akalynth-studio/`, `tools/validate-codex-plugin.mjs`, or `.github/ISSUE_TEMPLATE/` changed. Runs a lightweight plugin-validation job only.
- `full_ci_required=true` — any other file changed, or a push to `main`. Runs the full build, test, and witness harness.

`package.json` is special: it is codex-plugin-only safe only if the diff touches nothing outside the `validate:codex-plugin` script entry.

## Key CI files

- `.github/workflows/ci.yml` — the pipeline
- `scripts/ci_invariant_guard.sh` — invariant assertions run in CI
- `packages/ci-cd-change-control/` — change-control governance package
- `packages/verification-spine/` — verifier framework used in CI jobs

## Rules

- Re-read the full workflow before editing — job dependencies and the `changes` output matrix are load-bearing.
- Do not bypass the `changes` classifier to force-run jobs on codex-only PRs.
- The `ci_invariant_guard.sh` script must stay green on `main`. Do not weaken assertions without an explicit approval.
- Concurrency is `ci-${{ github.ref }}` with `cancel-in-progress: true`. Do not remove this.
- Preserve ubuntu-24.04 pinning on all jobs.
- Witness harness failures are not environment failures — treat them as code failures unless a specific runner dependency is missing.

## Debugging a failing CI job

1. Read the full job log from `gh run view --log`.
2. Reproduce locally with the exact script from the workflow step.
3. Classify: build failure / test failure / harness assertion / environment dependency.
4. Fix the narrowest thing. Do not widen job permissions, skip steps, or add `continue-on-error` without justification.

## Output should include

- Job or step that failed.
- Local reproduction command.
- Root cause classification.
- Fix applied.
- Verification that `main` invariants still pass.
