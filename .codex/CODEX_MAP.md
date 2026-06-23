# Akalynth Codex Full Set Map

Regenerated 2026-06-14 for the **dev box** `Ubuntu-jammy-latest-amd64-base`
from the current workspace and the user-level Codex home at
`/home/g0admin/.codex/`.

> A separate **production** box uses `/root/.codex/config.toml` and the live
> tree `/opt/akalynth`. The previous version of this map described that prod
> layout; this version describes the machine you actually work on. Treat prod
> paths as documentation of the other host, not this one.

## Host And Authority

- Host: `Ubuntu-jammy-latest-amd64-base`
- Active workspace: `/opt/goal0/sources/akalynth`
- User Codex config: `/home/g0admin/.codex/config.toml` (active authority)
- Model: `gpt-5.5`, reasoning effort `xhigh`, plan-mode effort `xhigh`
- Approval reviewer: `user`
- Trusted projects (from config): `/home/g0admin`, `/opt/goal0`,
  `/opt/goal0/sources/akalynth`
- Enabled plugins: `akalynth-studio@akalynth-private`, `github@openai-curated`,
  `game-studio@openai-curated`, `superpowers@openai-curated`
- Disabled plugins: none observed in the active config

This is the active local authority source. Treat it as higher priority than
repo examples unless the user explicitly says to apply the repo example posture.

## Skill Stores (COLLAPSED TO ONE SOURCE — 2026-06-06)

There is now a **single authored source** for the Akalynth skill set:
`.claude/skills/` (22 skills). Every other store is a symlink into it, so the
old "skills/plugins keep getting installed and drifting" problem is gone — a
re-install can only ever resolve back to the one source.

| Store | Count | Tracked? | Role after collapse |
|---|---|---|---|
| `.claude/skills/` | 22 | yes | **Canonical source.** Edit skills only here. |
| `plugins/akalynth-studio/skills/` | 10 | yes | Curated Codex plugin pack — 10 relative symlinks (`../../../.claude/skills/<name>`) into canonical. |
| `.agents/skills` | symlink | no (gitignored) | `→ ../.claude/skills`. Agent-runtime store; sees all 22. |
| `/home/g0admin/.codex/skills/` | 22 symlinks | n/a (global) | Each akalynth skill `→ /opt/goal0/sources/akalynth/.claude/skills/<name>` (absolute). `.system/` left as real dirs. |
| `.codex/skills/akalynth-system-audit/` | 1 | yes | **Intentional exception:** a Codex project-skill in `skill.md`+`README.md` form with audit-specific content; not part of the duplicated set. Left as-is. |

The 5 formerly-orphan skills (`economy-steward`, `game-server-steward`,
`observability-steward`, `package-steward`, `release-steward`) were absorbed
into `.claude/skills/` from the global store, so nothing was lost. The 3 plugin
skills that had drifted (`delegation-steward`, `deploy-steward`, `test-runner`)
now resolve to the newer canonical versions.

Editing rule: change a skill **only** in `.claude/skills/`. All other stores
follow automatically. To publish the self-contained Codex plugin elsewhere,
dereference the symlinks at pack time, e.g. `cp -RL plugins/akalynth-studio
<dest>` or `tar -h -czf akalynth-studio.tgz plugins/akalynth-studio`.

## Inventory

- Project plugin count: 1 (`akalynth-studio`)
- Project-scoped Codex skill count (`.codex/skills/`): 1
- Akalynth Studio plugin skill count: 10
- Claude Code skill count (`.claude/skills/`): 22 (canonical source)
- User-level Codex skill count (`/home/g0admin/.codex/skills/`): 22
- User system skill dir (`/home/g0admin/.codex/skills/.system/`): present
- Enabled cached user plugin count: 4 (`akalynth-studio`, `github`,
  `game-studio`, `superpowers`)
- Cached-on-disk plugin manifests observed: `akalynth-studio`, `github`,
  `game-studio`, `superpowers`, plus remote connector caches under
  `openai-curated-remote`

## Akalynth Repo Posture

Source: `.codex/config.toml.example`

- A template to copy into `~/.codex/config.toml`, not active config.
- Recommends read-only review by default (`sandbox_mode = "read-only"`).
- Defines an `akalynth-review` (read-only) and `akalynth-deploy`
  (workspace-write) profile; workspace-write network disabled.
- Warns against committing API keys, SSH private keys, Cloudflare tokens, or
  production secrets.
- Note: the example's trusted project (`/home/codex-akalynth/work/...`) and the
  prod tree `/opt/akalynth` are not paths on this dev box.

## Project Codex Files

- `.codex/config.toml.example`: Akalynth recommended Codex posture.
- `.codex/CODEX_MAP.md`: this map.
- `.codex/skills/akalynth-system-audit/README.md`: invocation pointer.
- `.codex/skills/akalynth-system-audit/skill.md`: project audit skill.

## Project Skill

### `akalynth-system-audit`

- Path: `.codex/skills/akalynth-system-audit/skill.md`
- Scope: `akalynth`, Mode: `audit`
- Purpose: evidence-backed audit of server identity, receipts, transparency,
  WebSocket protocol, Android parity, infra exposure, deploy reliability, repo
  hygiene, and verification status.
- Non-negotiables: no claims without evidence; separate verified facts from
  assumptions; mark docs/code disagreement as critical; record
  identity-affecting randomness in receipts; keep guest login functional unless
  a new contract deprecates it.

## Project Plugin

### `akalynth-studio`

- Manifest: `plugins/akalynth-studio/.codex-plugin/plugin.json`
- Skills root: `plugins/akalynth-studio/skills/`
- Version `0.2.0`, Author `VaultSovereign`, License `UNLICENSED`
- Repository: `https://github.com/VaultSovereign/akalynth`
- Skills (10): `anti-cheat-steward`, `delegation-steward`, `deploy-steward`,
  `gameplay-loop-designer`, `map-and-lore-builder`, `protocol-guardian`,
  `receipt-chain-steward`, `server-cartographer`, `test-runner`,
  `git-push-steward`.

## User-Level Skills

`/home/g0admin/.codex/skills/` (22): `akalynth-system-audit`,
`android-client`, `anti-cheat-steward`, `ci-steward`,
`classic-32-art-pipeline`, `content-designer`, `coordination-kernel-steward`,
`debug-client`, `delegation-steward`, `deploy-steward`, `economy-steward`,
`git-push-steward`,
`game-server-steward`, `gameplay-loop-designer`, `map-and-lore-builder`,
`observability-steward`, `package-steward`, `protocol-guardian`,
`receipt-chain-steward`, `release-steward`, `server-cartographer`,
`test-runner`.

## User System Skills

`/home/g0admin/.codex/skills/.system/`: `imagegen`, `openai-docs`,
`plugin-creator`, `skill-creator`, `skill-installer`.

## Cached User Plugins

`/home/g0admin/.codex/plugins/cache/`

- `akalynth-studio` (enabled from `akalynth-private`): local Akalynth skill pack.
- `github` (enabled from `openai-curated`): repository, PR/issue triage, CI debugging, publish flow.
  Skills: `github`, `gh-address-comments`, `gh-fix-ci`, `yeet`.
- `game-studio` (enabled from `openai-curated`): browser game workflows.
- `superpowers` (enabled from `openai-curated`): planning, TDD, debugging, and delivery workflows.

## Routing Matrix

- Whole-system evidence audit: `akalynth-system-audit`
- Host or topology discovery before changes: `server-cartographer`
- Deploy, rollback, systemd, Caddy, firewall, runtime paths: `deploy-steward`
- Protocol, HTTP API, WebSocket, shared types, Android compatibility: `protocol-guardian`
- Receipts, chronicle, replay, audit JSONL, SQLite materialization: `receipt-chain-steward`
- Anti-cheat, heat, Tem, enforcement, bot feedback: `anti-cheat-steward`
- Gameplay loops, rituals, progression, game feel: `gameplay-loop-designer`
- Maps, signs, lore, place names, world text: `map-and-lore-builder`
- Verification command selection and test interpretation: `test-runner`
- Git custody, commit staging, push readiness: `git-push-steward`
- Delegated GitHub issue TODOs: `delegation-steward`
- External PR/issue/CI/publish workflows: cached `github` plugin skills
- Raster image generation/editing: system `imagegen`
- Creating local Codex plugins or skills: system `plugin-creator`, `skill-creator`, `skill-installer`

## Git Custody / Push Boundary

Use `git-push-steward` before committing or pushing any Codex-generated change.

Primary responsibility:
- worktree hygiene
- branch discipline
- staged diff review
- commit message evidence
- push readiness

Supporting skills:
- `test-runner` for verification command selection
- `ci-steward` for CI-impacting changes
- relevant domain skill for the implementation domain

Required sequence:
1. Route implementation through the relevant domain skill.
2. Run focused verification through `test-runner`.
3. Route commit/push through `git-push-steward`.
4. Push only after the push gate passes.

## Sovereign Operating Rules For Akalynth

- Treat `/home/g0admin/.codex/config.toml` as the active user sovereign source
  on this dev box.
- Treat `.codex/config.toml.example` as Akalynth's recommended posture template,
  not active config.
- Prefer `.claude/skills/` as the canonical skill source; avoid hand-editing the
  installed copies (`.agents/skills/`, `/home/g0admin/.codex/skills/`).
- Prefer cached user plugins for external systems (currently GitHub).
- Do not place secrets, private keys, tokens, or production credential values in
  repo docs or config.
- Do not print secret material from server config or runtime data trees.
- Production work targets a different host (`/opt/akalynth`, `/var/lib/akalynth`,
  `/etc/akalynth`) over SSH; distinguish review, implementation, and deploy
  authority before mutating host or runtime state there.
- For API/protocol work, keep client messages intent-only and document
  compatibility impact.
- For receipt work, treat JSONL/chronicle data as canonical and SQLite as
  rebuildable derived state.

## Maintenance Notes

- 2026-06-14: installed the local `akalynth-private` marketplace from
  `/opt/goal0/sources/akalynth` and enabled `akalynth-studio@akalynth-private`.
- 2026-06-14: installed `github@openai-curated`; `game-studio@openai-curated`
  and `superpowers@openai-curated` were already enabled and left as-is.
- 2026-06-06: collapsed the five skill stores to a single source
  (`.claude/skills/`, now 22). `plugins/akalynth-studio/skills/` (10),
  `.agents/skills`, and the akalynth entries in `/home/g0admin/.codex/skills/`
  are now symlinks into it; `.codex/skills/akalynth-system-audit/` kept as an
  intentional Codex-format exception. See Skill Stores above.
- Tightened `.gitignore` (`.agents/skills/` → `.agents/skills`) so the new
  runtime symlink stays untracked.

## Source Paths

- Project map: `.codex/CODEX_MAP.md`
- Project config example: `.codex/config.toml.example`
- Project audit skill: `.codex/skills/akalynth-system-audit/skill.md`
- Akalynth plugin manifest: `plugins/akalynth-studio/.codex-plugin/plugin.json`
- Akalynth plugin skills: `plugins/akalynth-studio/skills/*/SKILL.md`
- Claude Code skills (canonical source): `.claude/skills/*/SKILL.md`
- User sovereign config: `/home/g0admin/.codex/config.toml`
- User system skills: `/home/g0admin/.codex/skills/.system/*/SKILL.md`
- Cached plugin manifests: `/home/g0admin/.codex/plugins/cache/*/*/*/.codex-plugin/plugin.json`
