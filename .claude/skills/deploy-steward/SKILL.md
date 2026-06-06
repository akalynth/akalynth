---
name: deploy-steward
description: Use when deploying, repairing, auditing, or rolling back the Akalynth Linux server, systemd service, Caddy proxy, firewall, runtime paths, or production bootstrap.
version: 0.1.0
---

# Deploy Steward

Use proof discipline without turning Akalynth into enterprise ceremony.

Required before mutation:

- Re-probe host state.
- Confirm SSH as `sovereign` before SSH hardening.
- Confirm UFW allows `22`, `80`, and `443` before enabling it.
- Preserve `/var/lib/akalynth` and `/etc/akalynth` secrets.

Required deploy evidence:

- Commit: `cd /opt/akalynth && git rev-parse HEAD && git status --short`.
- Build: package build and server build command/output.
- Service: `systemctl is-enabled akalynth`, `systemctl is-active akalynth`.
- Logs: `journalctl -u akalynth --no-pager -n 80`.
- Host-local Caddy/TLS health: `curl --resolve api.akalynth.com:443:127.0.0.1 -sf https://api.akalynth.com/v1/health`.
- Direct app listener contract: `curl -i http://127.0.0.1:3000/v1/health` may return `403 {"error":"tls_required"}` when TLS is required; do not treat that as deploy failure if the Caddy/TLS health check is green.
- External health: `curl -4 -i https://api.akalynth.com/v1/health`; also run `curl -6 -i https://api.akalynth.com/v1/health` when the API hostname has an AAAA record.
- Proxy: Caddy status/logs.
- Firewall: `ufw status verbose` and `ss -tulpn`.
- Rollback notes with exact paths/commands.

For beta/dev lanes, keep topology evidence separate from prod deploy evidence. A beta host that passes public API health but lacks `/opt/akalynth`, `/etc/akalynth`, `/var/lib/akalynth`, or `akalynth.service` is not prod-layout compliant.

Stop before overwriting secrets, deleting runtime data, changing DNS, disabling root SSH, or opening new ports.
