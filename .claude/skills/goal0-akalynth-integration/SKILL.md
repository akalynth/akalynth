---
name: goal0-akalynth-integration
version: 0.1.0
description: >
  Combine high-standards and akalynth-studio skills for Goal0 mesh integration with Akalynth (the MMO game server host akalynth-prod-01, api.akalynth.com).
  Use for auditing Akalynth infra in mesh (using server-cartographer, akalynth-system-audit), portable receipts inside wops-carry/quadlet (adapting receipt-chain-steward, deploy-steward), extending ops-control-console and verifier with Akalynth data/endpoints (game-server-steward, protocol-guardian), safe deploy/mutation patterns for Akalynth components in mesh (follow AGENTS.md posture: evidence, no secrets, re-probe).
  Triggers on "Akalynth integration", "mesh akalynth-prod-01", "portable Akalynth audit/receipt", "extend console with Akalynth", "Akalynth in Goal0 verifier".
  Part of portable carry ops on ops-laptop-02 desktop. Follow Akalynth AGENTS.md and Goal0 high-standards.
---

# Goal0 Akalynth Integration

Use this skill for ambitious, evidence-driven integration of Akalynth (social MMO prototype with TS monorepo, Android client, game server) into the Goal0 mesh portable operator setup.

**Core Principles (from Akalynth AGENTS.md + high-standards + FOR_GROK.md):**
- Canonical skills: .claude/skills/ (or local mirror in Desktop/.grok/skills/akalynth-skills/skills/). Edit only there if upstream.
- No secrets, private keys, tokens in any files, outputs, or commits.
- Prod vs dev: Akalynth prod is separate host (/opt/akalynth etc on akalynth-prod-01); this is dev/source. Distinguish before any mutation.
- Evidence first: Always re-probe (SSH via goal0-edge-01 or direct aliases), collect receipts (adapt receipt-chain-steward), use git status, systemctl, health curls (https://api.akalynth.com/v1/health), journals, ufw/ss before changes.
- Verify: Use test-runner, akalynth-system-audit. For mesh: cross to Goal0 verifier, console server, portable-inside-mesh-test.sh, wops-carry.
- Routing: server runtime → game-server-steward; deploy → deploy-steward; receipts → receipt-chain-steward; cartography → server-cartographer; etc. See .codex/CODEX_MAP.md in Akalynth for full (copy if needed).
- Portable on desktop (NOT home): Keep work, artifacts, skills under /home/sovereign/Desktop/ (e.g. .grok/skills/, 03_Research_Build/akalynth/, 04_Reports_Audits/ for receipts). Use inside wops-carry quadlet (Network Work for net/SSH) + /high-standards.
- Shared tree: Multiple agents may edit; scope changes.

**Sub-skills to use (from akalynth-studio pack + mirrors):**
- server-cartographer / akalynth-system-audit: Map Akalynth layout in mesh context (hosts from inventory/verifier: akalynth-prod-01 194.147.221.85, ops-dev-01 for beta; /opt/akalynth, services, ports, health, topology via SSH to goal0-edge-01 then prod).
- deploy-steward / release-steward: For any Akalynth deploy/repair in mesh (e.g. integrating with Goal0 console/runner). Require pre-mutation evidence: git, build, service active, health curls (local + external), ufw, ss. Preserve /var/lib/akalynth, /etc/akalynth.
- receipt-chain-steward: Generate mesh receipts for Akalynth ops (dated in 04_Reports_Audits/, adapt to Goal0 schema, cross to key-rotation-workflow etc.).
- gameplay-loop-designer / map-and-lore-builder / content-designer: For designing Akalynth features tied to mesh (e.g. portable Termux client for Akalynth game?).
- protocol-guardian: For Akalynth API/WS protocol in console or verifier (e.g. add /api/ops-akalynth to 5184 server).
- test-runner / observability-steward: Run/observe tests for Akalynth-mesh integration (inside quadlet, SSH probes).
- Others as needed: android-client (tie to Plane C Termux), ci-steward, etc.

**Workflow for Goal0 Akalynth tasks:**
1. Activate with this skill + high-standards. Read AGENTS.md (local in references/ or remote), CLAUDE.md, plugin.json, relevant SKILL.md from akalynth-skills/skills/.
2. Gather evidence: SSH BatchMode to goal0-edge-01 (or akalynth-prod-01 alias if configured), cd /opt/goal0/sources/akalynth, ls, git status, probe services. Use Goal0 tools: node verifier (update for akalynth-prod-01 if needed), console-backend-runner or ops-control-console-server for data, portable test inside wops-carry.
3. For audit/integration: Use server-cartographer to document Akalynth in mesh (update SYSTEM_INVENTORY_INDEX.md, goal0-mesh-index.html, mesh-services-active.html, detail-akalynth.html in mesh-map/). Create receipt.
4. For deploy/mutation (post-gate only): Follow deploy-steward (re-probe, evidence list: commit, service, health curls for api.akalynth.com and local, ufw/ss, journals). Adapt to portable quadlet context (no full prod changes inside RO quadlet; use for laptop-side or notes).
5. Extend tools: Update ops-control-console-server.mjs with /api/ops-akalynth (SSH fetch status from Akalynth tools, similar to /api/ops-plane-c). Update mvp.html. Add to verifier targets if missing.
6. Portable receipts: Inside wops-carry (Network Work), run probes, generate dated JSON/MD in 04_ (use receipt-chain patterns). Tie to laptop-maxout, previous Plane C/ console work.
7. Verify: Run Goal0 make targets, rg for hygiene (no secrets), cross refs to Akalynth AGENTS (skills canonical in .claude/, verify:skills), update plan.md or next-phase if relevant. No breakage to quadlet, SSH, prior receipts.
8. Report with exact paths, lines, commands (scp, SSH, mkdir, etc.) for auditability.

**Usage:**
- Slash: /goal0-akalynth-integration (once loaded).
- Auto: When query mentions Akalynth + mesh (e.g. "Akalynth in Goal0", "audit akalynth-prod-01 portable").
- Combine: Always with high-standards for rigor.
- Local files: /home/sovereign/Desktop/.grok/skills/akalynth-studio/ (with references/AGENTS.md, CLAUDE.md), /home/sovereign/Desktop/.grok/skills/akalynth-skills/skills/ (full 21), /home/sovereign/Desktop/03_Research_Build/akalynth/ (copied AGENTS/CLAUDE).
- Remote: SSH goal0-edge-01 'cd /opt/goal0/sources/akalynth ; ...' (use its scripts, npm run verify:skills if applicable).

**Cross:**
- Akalynth: remote /opt/goal0/sources/akalynth (AGENTS.md, plugins/akalynth-studio, .claude/skills/*), mesh-map/detail-akalynth.html, inventory (akalynth-prod-01).
- Goal0: AGENTS.md (Desktop), high-standards skill, verifier.mjs, ops-control-console-server.mjs, mvp.html, portable-inside-mesh-test.sh, wops-carry.container, 04_Reports_Audits/*, SYSTEM_INVENTORY_INDEX.md, goal0-mesh-index.html.
- FOR_GROK.md: Note showing path, "install on desktop not home".
- Prior: Plane C Termux edge, console backend 5184, key rotation gates.

This skill enables using Akalynth's own studio patterns (receipts, stewards, evidence) for Goal0 mesh work on the carry desktop laptop, always portable, auditable, high-standards.

Activate by context or /goal0-akalynth-integration. Skills auto-reload.
