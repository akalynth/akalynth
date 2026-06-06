---
name: release-steward
description: Use when cutting an Akalynth agent-skills release — semantic versioning, changelog authoring, git tagging, plugin manifest version, or publishing a new package version to akalynth/akalynth-agent-skills.
version: 0.1.1
---

# Release Steward

A release makes the skill pack available to other agents and workflows. Every release must pass health checks, be free of secrets, and have version fields consistent across all manifests.

## Scope

- `package.json` `version` field
- `.codex-plugin/plugin.json` version field
- `docs/skill-parity-manifest.json` and `docs/codex-parity-manifest.json` (planned — not yet present)
- Git tags
- `CHANGELOG.md` (if present, or introduced at first release)

## Cross-cuts

- **`ci-steward`** — the publish gate in CI must pass before a release tag is created; do not tag on a failing branch.
- **`package-steward`** — workspace version coordination; all package versions should be consistent or explicitly divergent with justification.
- **`delegation-steward`** — release milestones may be tracked as GitHub Issues; use `Closes #<issue>` when the release resolves a milestone.

## Versioning rules (semver)

- **Patch** — skill text fixes, typo corrections, command updates, doc additions that do not change trigger scope.
- **Minor** — new skills added, existing skill triggers expanded, new verification commands added.
- **Major** — skills removed, skill names or trigger descriptions changed in a way that breaks existing agent configurations.

## Release checklist

1. Verification suite passes: `npm run verify:audit` (or `npm run verify:full`) — capture output.
2. Skills valid and the single-source/symlink invariant holds: `npm run verify:skills`.
3. Public boundary clean (no secrets, no blocked paths): `bash scripts/check-public-boundary.sh`.
4. Plugin scaffold valid: `npm run validate:codex-plugin`.
5. Per-skill `version` fields and `CHANGELOG.md` updated for the changed skills.
6. `.codex-plugin/plugin.json` version matches the pack version and the top `CHANGELOG.md` entry.
7. Git tag matches the version string: `v<major>.<minor>.<patch>`.
8. No production runtime data, secrets, private keys, or `/etc/akalynth` material in the release commit.
9. (Planned) Parity/inventory automation — `skill-parity`, `codex-parity`, `readme-inventory` — once the manifests in Scope exist.

## Rules

- Do not tag if any health check fails — resolve the failure first.
- Do not tag a commit that has not been pushed and verified on the remote.
- Tag message should summarize what changed (new skills, fixes, or breaking removals).
- Do not push a release to `akalynth/akalynth-agent-skills` without explicit publish approval.

## Output must include

- Version string (old → new).
- Semver classification and justification.
- Health check results (all commands and outputs).
- Git tag created.
- Whether publish to remote was authorized and completed.
