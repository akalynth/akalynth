---
name: server-cartographer
description: Use when mapping Akalynth's server layout, runtime paths, services, ports, process ownership, deploy topology, or Linux host state before changing the game server.
---

# Server Cartographer

Use this skill before host or deploy changes.

Workflow:

1. Inspect first: local repo status, `/opt/akalynth`, systemd unit, Caddyfile, UFW, ports, runtime directories, and health endpoints.
2. Identify the actual source of truth: git checkout, generated rulebook artifacts, `/etc/akalynth`, and `/var/lib/akalynth`.
3. Separate app state from infra state. Do not treat a Caddy/DNS failure as an app failure if localhost health passes.
4. Preserve receipts, chronicle data, and SQLite data unless the user explicitly approves a destructive reset.
5. Report observed commands and outputs before recommending host changes.

Expected layout:

- Repo: `/opt/akalynth`
- Runtime data: `/var/lib/akalynth`
- Audit log: `/var/lib/akalynth/audit`
- Config/secrets: `/etc/akalynth`
- Service: `akalynth`
- Reverse proxy: Caddy
- Public API: `https://api.akalynth.com/v1/health`

