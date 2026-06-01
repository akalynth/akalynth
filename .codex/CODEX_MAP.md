# Akalynth Codex Full Set Map

Generated from the Akalynth workspace and the current user-level Codex home.

## Inventory

- Active workspace: `/opt/akalynth`
- User sovereign config: `/root/.codex/config.toml`
- Project Codex directory: `.codex/`
- Project plugin count: 1
- Project-scoped skill count: 1
- Akalynth Studio skill count: 9
- User system skill count: 5
- Enabled cached user plugin count: 4
- Cached plugin skill count: 16

## User Sovereign Authority

Source: `/root/.codex/config.toml`

- Model: `gpt-5.5`
- Reasoning effort: `medium`
- Approval reviewer: `user`
- Trusted project: `/opt/akalynth`
- Enabled plugins:
  - `canva@openai-curated`
  - `github@openai-curated`
  - `hubspot@openai-curated`
  - `openai-developers@openai-curated`

This is the active local authority source. Treat it as higher priority than repo examples unless the user explicitly says to apply the repo example posture.

## Akalynth Repo Posture

Source: `.codex/config.toml.example`

- Intended as a template to copy into `~/.codex/config.toml`.
- Warns that `/opt/akalynth` is the live server tree.
- Recommends read-only review by default (`sandbox_mode = "read-only"`).
- Defines an `akalynth-review` profile (read-only) and an explicit
  `akalynth-deploy` profile for workspace-write sessions.
- Keeps workspace-write network disabled in the example.
- Marks `/home/codex-akalynth/work/akalynth-candidate` as the trusted project in
  the example (a candidate checkout, distinct from the live `/opt/akalynth`).
- Warns against committing API keys, SSH private keys, Cloudflare tokens, or production secrets.

## Project Codex Files

- `.codex/config.toml.example`: Akalynth recommended Codex posture.
- `.codex/CODEX_MAP.md`: this map.
- `.codex/skills/akalynth-system-audit/README.md`: invocation pointer.
- `.codex/skills/akalynth-system-audit/skill.md`: project audit skill.

## Project Skill

### `akalynth-system-audit`

- Path: `.codex/skills/akalynth-system-audit/skill.md`
- Version: `0.1.0`
- Scope: `akalynth`
- Mode: `audit`
- Inputs: `repo_root`, `environment`
- Outputs: verified facts, findings by severity, next 5 shipments, regression tests.
- Purpose: evidence-backed audit of server identity, receipts, transparency, WebSocket protocol, Android parity, infra exposure, deploy reliability, repo hygiene, and verification status.
- Non-negotiables:
  - No claims without evidence.
  - Separate verified facts from assumptions.
  - Mark docs/code disagreement as critical.
  - Record identity-affecting randomness in receipts.
  - Keep guest login functional unless a new contract deprecates it.
- Green criteria:
  - Token signing spec matches implementation.
  - `/v1/transparency` exposes `auth_public_key_hex` and derivation string.
  - WebSocket token login works and wins over guest when both are present.
  - Receipts bind identity deterministically.
  - Android canonical WebSocket path supports token login and token rotation persistence.

## Project Plugin

### `akalynth-studio`

- Manifest: `plugins/akalynth-studio/.codex-plugin/plugin.json`
- Skills root: `plugins/akalynth-studio/skills/`
- Version: `0.1.0`
- Author: `VaultSovereign`
- License: `UNLICENSED`
- Repository: `https://github.com/VaultSovereign/akalynth`
- Category: Developer Tools
- Capabilities: `Read`, `Write`, `Interactive`
- Purpose: private Akalynth MMO server design, deploy, audit, protocol stewardship, receipt-chain custody, anti-cheat, map/lore, and verification skills.

## Akalynth Studio Skills

### `anti-cheat-steward`

- Path: `plugins/akalynth-studio/skills/anti-cheat-steward/SKILL.md`
- Use for: anti-cheat detection, heat, Tem challenges, enforcement, penalties, evidence, and player-facing anti-bot feedback.
- Core rule: enforcement must be deterministic, evidenced, explainable, and never based on client-reported truth.

### `delegation-steward`

- Path: `plugins/akalynth-studio/skills/delegation-steward/SKILL.md`
- Use for: creating, triaging, splitting, assigning, or closing Akalynth GitHub Issues used as delegated TODOs.
- Core rule: delegated tasks need scope, allowed files, forbidden actions, acceptance criteria, verification, branch naming, PR linkage, and closure evidence.

### `deploy-steward`

- Path: `plugins/akalynth-studio/skills/deploy-steward/SKILL.md`
- Use for: deploying, repairing, auditing, or rolling back Linux server state, systemd, Caddy, firewall, runtime paths, or production bootstrap.
- Core rule: re-probe host state before mutation and preserve `/var/lib/akalynth` plus `/etc/akalynth` secrets.

### `gameplay-loop-designer`

- Path: `plugins/akalynth-studio/skills/gameplay-loop-designer/SKILL.md`
- Use for: gameplay loops, progression, map flow, chill-zone activities, player rituals, and MVP game feel.
- Core rule: do not silently change server authority or economy rules.

### `map-and-lore-builder`

- Path: `plugins/akalynth-studio/skills/map-and-lore-builder/SKILL.md`
- Use for: maps, place names, lore, signs, chill-zone flavor, world descriptions, and player-facing narrative.
- Core rule: lore is flavor unless an explicit rule, receipt, or protocol change is requested.

### `protocol-guardian`

- Path: `plugins/akalynth-studio/skills/protocol-guardian/SKILL.md`
- Use for: WebSocket messages, HTTP APIs, shared protocol/types, Android/debug-client contracts, and compatibility docs.
- Core rule: protect compatibility across server, shared packages, debug client, and Android; clients send intent, not truth.

### `receipt-chain-steward`

- Path: `plugins/akalynth-studio/skills/receipt-chain-steward/SKILL.md`
- Use for: receipts, chronicle logs, replay, audit JSONL, SQLite materialization, receipt schemas, chain verification, and production runtime data custody.
- Core rule: receipts and chronicle data are canonical; SQLite is derived.

### `server-cartographer`

- Path: `plugins/akalynth-studio/skills/server-cartographer/SKILL.md`
- Use for: server layout, runtime paths, services, ports, process ownership, deploy topology, and Linux host state before game-server changes.
- Expected layout:
  - Repo: `/opt/akalynth`
  - Runtime data: `/var/lib/akalynth`
  - Audit log: `/var/lib/akalynth/audit`
  - Config/secrets: `/etc/akalynth`
  - Service: `akalynth`
  - Reverse proxy: Caddy
  - Public API: `https://api.akalynth.com/v1/health`

### `test-runner`

- Path: `plugins/akalynth-studio/skills/test-runner/SKILL.md`
- Use for: choosing, running, or interpreting verification commands, builds, smoke tests, health checks, WebSocket checks, and focused regression tests.
- Core rule: pick the narrowest command that proves the claim.

## User System Skills

### `imagegen`

- Path: `/root/.codex/skills/.system/imagegen/SKILL.md`
- Use for: AI-created or AI-edited raster images such as photos, illustrations, textures, sprites, mockups, or transparent-background cutouts.
- Default path: built-in `image_gen` tool.

### `openai-docs`

- Path: `/root/.codex/skills/.system/openai-docs/SKILL.md`
- Use for: current official OpenAI product/API docs, citations, model choice, model upgrades, and prompt upgrade guidance.
- Source rule: prefer official OpenAI documentation.

### `plugin-creator`

- Path: `/root/.codex/skills/.system/plugin-creator/SKILL.md`
- Use for: creating and scaffolding Codex plugin directories, manifests, optional plugin structure, marketplace entries, and reinstall/cachebuster flow.

### `skill-creator`

- Path: `/root/.codex/skills/.system/skill-creator/SKILL.md`
- Use for: creating or updating Codex skills with specialized workflows, knowledge, or tool integrations.

### `skill-installer`

- Path: `/root/.codex/skills/.system/skill-installer/SKILL.md`
- Use for: listing installable skills or installing skills from curated lists or GitHub repo paths.

## Cached User Plugins

### `canva`

- Manifest: `/root/.codex/plugins/cache/openai-curated/canva/fef63ecf/.codex-plugin/plugin.json`
- Version: `1.0.0`
- Category: Productivity
- Skills root: `/root/.codex/plugins/cache/openai-curated/canva/fef63ecf/skills/`
- Purpose: search, create, and edit Canva designs.
- Skills:
  - `canva-branded-presentation`: create branded presentations from a brief, outline, existing Canva doc, or design link.
  - `canva-resize-for-all-social-media`: resize one Canva design into standard social media formats.
  - `canva-translate-design`: translate text in a Canva design while preserving layout and the original file.

### `github`

- Manifest: `/root/.codex/plugins/cache/openai-curated/github/fef63ecf/.codex-plugin/plugin.json`
- Version: `0.1.0`
- Category: Developer Tools
- Skills root: `/root/.codex/plugins/cache/openai-curated/github/fef63ecf/skills/`
- Purpose: inspect repositories, triage pull requests/issues, debug CI, and publish changes through a hybrid connector and CLI workflow.
- Skills:
  - `github`: general GitHub repository, pull request, and issue triage through the connected GitHub app.
  - `gh-address-comments`: inspect unresolved PR feedback and implement selected fixes.
  - `gh-fix-ci`: debug or fix failing GitHub Actions checks on a PR.
  - `yeet`: publish local changes by confirming scope, committing, pushing, and opening a draft PR.

### `hubspot`

- Manifest: `/root/.codex/plugins/cache/openai-curated/hubspot/fef63ecf/.codex-plugin/plugin.json`
- Version: `2.0.0`
- Category: Productivity
- Skills root: `/root/.codex/plugins/cache/openai-curated/hubspot/fef63ecf/skills/`
- Purpose: work with HubSpot CRM records, reports, pipeline health, customer preparation, and data hygiene.
- Skills:
  - `hubspot`: search, summarize, create, update, associate, or analyze HubSpot CRM records.
  - `hubspot-crm-data-hygiene`: audit missing fields, stale records, duplicates, associations, owners, and cleanup tasks.
  - `hubspot-customer-prep`: prepare customer briefs for meetings, renewals, QBRs, sales calls, escalations, handoffs, or follow-ups.
  - `hubspot-pipeline-health`: review pipeline health, forecasts, stale deals, slipping close dates, and open deal risks.

### `openai-developers`

- Manifest: `/root/.codex/plugins/cache/openai-curated/openai-developers/fef63ecf/.codex-plugin/plugin.json`
- Version: `1.1.0`
- Category: Engineering
- Skills root: `/root/.codex/plugins/cache/openai-curated/openai-developers/fef63ecf/skills/`
- Purpose: build with OpenAI APIs, Agents SDK, ChatGPT Apps, and create/save OpenAI API keys from Codex.
- Skills:
  - `agents-sdk`: build, run, deploy, and evaluate OpenAI Agents SDK apps from Codex.
  - `build-chatgpt-app`: build, scaffold, refactor, and troubleshoot ChatGPT Apps SDK applications combining MCP servers and widget UI.
  - `chatgpt-app-submission`: inspect a ChatGPT Apps MCP server and generate `chatgpt-app-submission.json`.
  - `openai-api-troubleshooting`: classify OpenAI API runtime failures and route to the right remediation.
  - `openai-platform-api-key`: credential gate for work that builds, runs, tests, debugs, or configures OpenAI API-backed artifacts.

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
- Delegated GitHub issue TODOs: `delegation-steward`
- External PR/issue/CI/publish workflows: cached `github` plugin skills
- Canva design generation/adaptation: cached `canva` plugin skills
- HubSpot CRM work: cached `hubspot` plugin skills
- OpenAI API/app/agent/key workflows: cached `openai-developers` plugin skills plus system `openai-docs`
- Raster image generation/editing: system `imagegen`
- Creating local Codex plugins or skills: system `plugin-creator`, `skill-creator`, `skill-installer`

## Sovereign Operating Rules For Akalynth

- Treat `/root/.codex/config.toml` as the active user sovereign source.
- Treat `.codex/config.toml.example` as Akalynth's recommended posture template, not active config.
- Prefer Akalynth Studio skills for Akalynth domain work.
- Prefer cached user plugins for external systems: GitHub, Canva, HubSpot, OpenAI Platform.
- Do not place secrets, private keys, tokens, or production credential values in repo docs or config.
- Do not print secret material from `/etc/akalynth`, `/var/lib/akalynth`, env files, or OpenAI key storage.
- Preserve `/var/lib/akalynth` and `/etc/akalynth` unless the user explicitly approves destructive work.
- For live `/opt/akalynth` work, distinguish review, implementation, and deploy authority before mutating host or runtime state.
- For API/protocol work, keep client messages intent-only and document compatibility impact.
- For receipt work, treat JSONL/chronicle data as canonical and SQLite as rebuildable derived state.

## Source Paths

- Project map: `.codex/CODEX_MAP.md`
- Project config example: `.codex/config.toml.example`
- Project audit skill: `.codex/skills/akalynth-system-audit/skill.md`
- Akalynth plugin manifest: `plugins/akalynth-studio/.codex-plugin/plugin.json`
- Akalynth plugin skills: `plugins/akalynth-studio/skills/*/SKILL.md`
- User sovereign config: `/root/.codex/config.toml`
- User system skills: `/root/.codex/skills/.system/*/SKILL.md`
- Cached plugin manifests: `/root/.codex/plugins/cache/openai-curated/*/fef63ecf/.codex-plugin/plugin.json`
- Cached plugin skills: `/root/.codex/plugins/cache/openai-curated/*/fef63ecf/skills/*/SKILL.md`
