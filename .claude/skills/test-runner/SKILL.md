---
name: test-runner
description: Use when choosing, running, or interpreting Akalynth verification commands, builds, smoke tests, health checks, WebSocket checks, or focused regression tests.
---

# Test Runner

Pick the narrowest command that proves the claim.

Common commands:

- Server build: `npm -w apps/server run build`
- Packages build: `npm run build:packages`
- Protocol sync: `./scripts/verify_protocol_sync.sh`
- MVP verification: `./scripts/verify_mvp.sh`
- Local dev/server health: `curl -sf http://127.0.0.1:3000/v1/health`
- Prod host-local Caddy/TLS health: `curl --resolve api.akalynth.com:443:127.0.0.1 -sf https://api.akalynth.com/v1/health`
- Prod public health: `curl -4 -sf https://api.akalynth.com/v1/health`; add `curl -6 -sf https://api.akalynth.com/v1/health` when DNS has an AAAA record.
- Server focused checks: run relevant `apps/server` npm verifier.

Rules:

- Do not say a test passed unless command output proves it.
- If a native dependency fails due to environment, classify it separately from code failure.
- For prod deploy checks, include systemd, logs, host-local Caddy/TLS health, direct app listener behavior, public health, firewall, and ports.
- If direct app listener health returns `403 {"error":"tls_required"}` while Caddy/TLS and public health return `200`, classify it as the TLS/proxy contract, not as an app outage.
