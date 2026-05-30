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
- Server health: `curl -sf http://127.0.0.1:3000/v1/health`
- Server focused checks: run relevant `apps/server` npm verifier.

Rules:

- Do not say a test passed unless command output proves it.
- If a native dependency fails due to environment, classify it separately from code failure.
- For server deploy checks, include systemd, logs, local health, external health, firewall, and ports.
