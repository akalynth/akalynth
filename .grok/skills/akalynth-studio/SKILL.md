---
name: akalynth-studio
description: >
  Private Akalynth game-server studio skills for lightweight MMO design, deploy, and audit work.
  Install from Akalynth code at /opt/goal0/sources/akalynth/plugins/akalynth-studio (via remote goal0-edge-01).
  Use for Akalynth server cartography, gameplay loop design, protocol stewardship, receipt-chain custody, anti-cheat, map/lore building, deploy verification, test running.
  Triggers on Akalynth, MMO server, game server audit/deploy/design, or when working with akalynth-prod-01, api.akalynth.com, or related in mesh maps.
  Part of Goal0 mesh integration (akalynth-prod-01 target).
---

# Akalynth Studio

Use this skill pack for private Akalynth (lightweight MMO game server) work: design, deploy, audit, cartography, and stewardship.

**Plugin Info (from akalynth-studio plugin.json):**
- Version: 0.2.0
- Description: Private Akalynth game-server studio skills for lightweight MMO design, deploy, and audit work.
- Author: VaultSovereign
- Homepage/Repo: https://github.com/VaultSovereign/akalynth
- Keywords: akalynth, mmo, game-server, codex
- Skills location: ./skills/ (symlinked in source to .claude/skills equivalents)
- Capabilities: Read, Write, Interactive
- Brand: #2E7D5B
- Default prompts: "Audit the Akalynth server bootstrap.", "Design a small gameplay loop.", "Check protocol compatibility."

**Installed on desktop:** /home/sovereign/Desktop/.grok/skills/akalynth-studio/ (per FOR_GROK.md note and user instruction "on desktop" not home).
Source skills copied to /home/sovereign/Desktop/.grok/skills/akalynth-skills/skills/ (from remote /opt/goal0/sources/akalynth/.claude/skills/ on goal0-edge-01).

**Available sub-skills (from the pack):**
- server-cartographer: Map Akalynth server layout, paths, services, ports, deploy topology (inspect /opt/akalynth, systemd, Caddy, UFW, health endpoints, preserve /var/lib/akalynth and receipts).
- deploy-steward: Deploy, repair, audit, rollback the Akalynth Linux server, systemd, Caddy, firewall, bootstrap. Requires proof discipline, re-probe, commit/build/service/logs/health evidence before mutations. Preserve secrets and data.
- gameplay-loop-designer: Design small gameplay loops.
- map-and-lore-builder: Map and lore building.
- protocol-guardian: Protocol stewardship and compatibility.
- receipt-chain-steward: Receipt-chain custody.
- anti-cheat-steward: Anti-cheat work.
- test-runner: Test running.
- Others in pack: akalynth-system-audit, android-client, ci-steward, classic-32-art-pipeline, content-designer, coordination-kernel-steward, debug-client, delegation-steward, economy-steward, game-server-steward, observability-steward, package-steward, release-steward, etc.

**Workflow (adapt from sub-skills and plugin interface):**
1. Start with cartographer or system-audit to inspect current state (repo /opt/akalynth, services, endpoints like https://api.akalynth.com/v1/health).
2. Use deploy-steward or release for changes – always re-probe, confirm SSH, preserve state, collect evidence (git, systemctl, curl health, journals, ufw, ss).
3. For design: gameplay-loop-designer, map-and-lore-builder, content-designer.
4. Stewardship: protocol-guardian, receipt-chain-steward, anti-cheat-steward, delegation-steward.
5. Verification: test-runner, observability, ci-steward.
6. Report with receipts, chronicle data, SQLite. Do not destructive without approval.
7. Integrate with Goal0 mesh: cross to akalynth-prod-01 in verifier targets, ops-control-console, Plane C/Termux if relevant, portable carry tests.

**Usage in this session (high-standards context):**
- When user mentions Akalynth, MMO, game server, api.akalynth.com, akalynth-prod-01, or tasks like "audit Akalynth", "design gameplay for Akalynth", "deploy Akalynth server".
- Combine with existing high-standards for evidence-driven work on the mesh (read files first, SSH probes via goal0-edge-01, receipts in 04_Reports_Audits, update maps like mesh-services-active.html, detail-akalynth.html in mesh-map/).
- For remote code: use SSH BatchMode to goal0-edge-01 (or akalynth-prod-01 if alias), cd /opt/goal0/sources/akalynth , use the scripts, plugins, rulebook, infra/.
- Preserve "NOT home" – keep installed skills and work artifacts on Desktop/.grok/ or project Desktop/ (per FOR_GROK.md and user note).

**Cross references:**
- Akalynth code: remote /opt/goal0/sources/akalynth (plugins/akalynth-studio, .claude/skills/* , AGENTS.md, CLAUDE.md, apps, crates, infra, rulebook, etc.)
- Local mirror on desktop: /home/sovereign/Desktop/.grok/skills/akalynth-studio/ and /home/sovereign/Desktop/.grok/skills/akalynth-skills/skills/
- Mesh docs: /home/sovereign/mesh-map/detail-akalynth.html (infrastructure reference, public surface: akalynth.com, api.akalynth.com, beta*, hosts akalynth-prod-01 194.147.221.85 and ops-dev-01)
- Project AGENTS.md , goal0-mesh-index.html (mentions Akalynth), SYSTEM_INVENTORY_INDEX.md (akalynth-prod-01 target), verify-operator-capability.mjs (target)
- Related: RustDesk, VNC, Plane C for mobile, console backend for ops.

**Note from FOR_GROK.md:** The pasted session shows g0admin accessing /opt/goal0/sources/akalynth/plugins/akalynth-studio on the base. Install here on desktop for Grok use. Do not put main work in home if note specifies "NOT home".

Activate with phrases like "use akalynth studio", "Akalynth audit", or when context matches MMO/game server tasks in the Goal0 mesh.

This skill pack enables ambitious, precise work on the Akalynth part of the protected infrastructure, always with evidence, SSH, receipts, and portable considerations.