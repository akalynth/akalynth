# Repo Hygiene Architecture

Status: cleanup policy. This document defines where documentation and noisy
artifacts belong before any large archive or deletion pass.

## Goal

Keep the repo root quiet enough that a maintainer can see the product shape at a
glance:

- runtime source in `apps/`, `packages/`, `crates/`, `tools/`, `scripts/`, `infra/`
- source material in `drop/` when explicitly imported as design/lore/gameplay source
- canonical project docs in `docs/`
- runtime data outside the source repo on hosts
- imported source drops preserved explicitly, then promoted deliberately

## Root Allowlist

The repo root should contain only:

- project entry docs: `README.md`, `LICENSE`
- package/toolchain manifests: `package.json`, `package-lock.json`, `.node-version`, `.nvmrc`
- repo configuration: `.gitignore`, `.dockerignore`, `.coderabbit.yaml`, `.devcontainer/`, `.github/`, `.vscode/`
- source directory roots: `apps/`, `packages/`, `crates/`, `docs/`, `data/`, `drop/`, `infra/`, `scripts/`, `tests/`, `tools/`, `rulebook/`, `plugins/`

Root-level one-off reports, decisions, chat notes, and signal files are noise
unless a tool explicitly depends on their root path.

## Documentation Lanes

Use these lanes for Markdown:

| Lane | Path | Rule |
| --- | --- | --- |
| Canonical docs | `docs/*.md` | Current claim boundaries, protocol, architecture, verification, world docs. |
| Current decision packets | `docs/asset-decisions/<LANE>/` or a future `docs/decisions/<LANE>/` | Multi-file decision records that still guide implementation. |
| Archived reports and decision packets | `docs/archive/` or `docs/AUDITS/ARCHIVED/` | Historical snapshots that must remain readable but are not current law. |
| Speculative docs | `docs/speculative/` | Explicitly out of scope for v1. |
| Module docs | `apps/**/README.md`, `packages/**/README.md`, `tools/**/README.md` | Local package/tool usage only. |
| Agent/skill docs | `.claude/`, `.agents/`, `.codex/`, `plugins/**/skills/` | Agent configuration, not product documentation. |
| Source drops | `drop/` | Imported source material for future lore/gameplay/assets. Do not make runtime imports from here. |

## Current Noise Map

The first root cleanup removed the stale historical report pair, the
chat/security decision packet, its lane `receipt.txt`, and the legacy root
`test-server.js` helper from tracked source.

Future root Markdown should be treated as a regression unless it is `README.md`.

## Drop Source Rule

`drop/` is source material, not runtime authority. It may contain zips,
manifests, generated images, broad design bibles, and prompt briefs. Preserve it
during cleanup, but do not present its content as implemented or canonical until
it is promoted through a reviewed lane.

Promote only curated pieces:

- gameplay content data -> `data/` or `packages/shared/` after schema review
- canonical gameplay/design docs -> `docs/` with a claim boundary
- runtime art assets -> existing asset pipeline folders after size/licensing review
- prompts and raw source bundles -> keep local in ignored `drop/`; document the boundary in `docs/DROP_SOURCE_INDEX.md`

Never wire server or client imports directly to `drop/`.

## Generated And Dependency Noise

The following are local/build artifacts, not repo architecture:

- `**/node_modules/`
- `**/dist/`
- `**/build/`
- `apps/android/.gradle/`
- `verify-out/`
- `.tmp/`, `artifacts/`

They are ignored by `.gitignore` or local package ignores. Remove them only with
an explicit operator cleanup command, and never as part of a gameplay/content
change.

## Cleanup Sequence

1. Leave `README.md` as the only ordinary root Markdown.
2. Preserve local `drop/` source material, but keep the directory ignored unless selected material is promoted elsewhere.
3. For any future archive or deletion pass, update `docs/CLAIM_INDEX.md`,
   `docs/README.md`, `tools/doc_audit.js`, and direct links in the same patch.
4. Run doc audit and a relevant build after any large move.

## Guardrails

- Do not delete receipts, chronicle data, SQLite data, or host runtime state.
- Do not move `/var/lib/akalynth-*`, `/etc/akalynth-*`, or `/opt/akalynth-*` from repo cleanup work.
- Do not archive or delete a doc that is cited by a current claim without updating the claim index.
- A cleanup commit should contain hygiene changes only; no gameplay logic.
