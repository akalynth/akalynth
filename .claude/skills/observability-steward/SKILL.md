---
name: observability-steward
description: Use when modifying Akalynth structured logging, health endpoints, runtime metrics, log retention policy, or alerting configuration.
version: 0.1.1
---

# Observability Steward

Structured log fields and health endpoints are public contracts. Changes here affect `test-runner` health commands, `deploy-steward` deploy evidence, and any external monitoring that reads the API.

## Scope

- Logging middleware and structured log field definitions in `apps/server/src/`
- Health endpoint routes (`/v1/health`, `/v1/transparency`)
- Log rotation and retention config (systemd journal policy, Caddy log rotation)
- Runtime metrics emission or sampling, if present
- `docs/CLIENT_CONTRACT_V0_1.md` and the health route in `apps/server/src/api/http.ts` — the authoritative health/endpoint contract

## Cross-cuts

- **`deploy-steward`** — deploy evidence includes host-local Caddy/TLS health and public health; health endpoint changes break deploy evidence commands.
- **`test-runner`** — health check commands in `test-runner` must match the actual health endpoint behavior.
- **`coordination-kernel-steward`** — `/v1/transparency` exposes `auth_public_key_hex` and key derivation; changes to transparency output are a security contract.

## Rules

- Structured log field names are a public contract. Removing or renaming a field requires explicit documentation and a coordinated update to any consumers.
- Health endpoints must not expose secret values, private key material, player PII, or receipt chain contents.
- Do not add log statements that print token values, signing keys, raw receipt bytes, or `/etc/akalynth` material.
- `/v1/transparency` output changes must be reviewed against `docs/IDENTITY_VERIFICATION.md`.
- Any change to health endpoint response shape or status codes must update `docs/CLIENT_CONTRACT_V0_1.md` and the `test-runner` skill.
- Direct app listener health returning `403 {"error":"tls_required"}` is the expected TLS/proxy contract when Caddy/TLS health and public health both return `200` — do not change this behavior without an explicit contract update.

## Verification

- Host-local Caddy/TLS health: `curl --resolve api.akalynth.com:443:127.0.0.1 -sf https://api.akalynth.com/v1/health`
- Public health: `curl -4 -sf https://api.akalynth.com/v1/health`
- Transparency: `curl -s https://api.akalynth.com/v1/transparency | jq .`
- Confirm no secrets in output: scan response for key material patterns.
- For log field changes: grep structured log output for expected field names.

## Output must include

- Endpoint or log field changed.
- Contract impact (additive / compatible / breaking).
- Whether `docs/CLIENT_CONTRACT_V0_1.md` was updated.
- Whether `test-runner` health commands still match actual behavior.
- Verification commands and outputs.
