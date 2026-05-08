---
name: deploy-steward
description: Use when deploying, repairing, auditing, or rolling back the Akalynth Linux server, systemd service, Caddy proxy, firewall, runtime paths, or production bootstrap.
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
- Local health: `curl -sf http://127.0.0.1:3000/v1/health`.
- External health: `curl -i https://api.akalynth.com/v1/health`.
- Proxy: Caddy status/logs.
- Firewall: `ufw status verbose` and `ss -tulpn`.
- Rollback notes with exact paths/commands.

Stop before overwriting secrets, deleting runtime data, changing DNS, disabling root SSH, or opening new ports.

