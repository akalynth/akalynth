---
name: akalynth-system-audit
description: Use for an evidence-backed audit of Akalynth server identity, receipts, transparency, WebSocket protocol, Android parity, infra exposure, deploy reliability, repo hygiene, and verification status.
---

# System Audit (Akalynth)

Runbook version follows tag v1.0.5-identity-law+.

## Goal

Produce an evidence-backed audit of:

- Server identity, receipts, and transparency.
- WS protocol correctness and backward compatibility.
- Android client identity parity.
- Infra exposure (ports, firewall) and systemd hardening.
- Deploy reliability and repo state hygiene.
- Verification suites status (including chronicle policy).

## Non-negotiables

- Make no claim without evidence (file:line, command output, or runtime response).
- Separate verified vs assumed.
- If docs and code disagree, mark CRITICAL.
- Capture determinism: any randomness affecting identity must be recorded in receipts.
- Keep guest login functional unless deprecated via a new contract.

## Evidence Anchors

- Evidence format: `path:line` OR `command -> snippet`.
- No evidence, no claim.

## Commands (Ops)

```
AKALYNTH_AUDIT_BASE_URL="${AKALYNTH_AUDIT_BASE_URL:-https://api.akalynth.com}"
AKALYNTH_AUDIT_WS_URL="${AKALYNTH_AUDIT_WS_URL:-wss://api.akalynth.com}"
sudo ss -ltnp | rg ":(80|443|3000)\b"
sudo ufw status verbose
curl -s "$AKALYNTH_AUDIT_BASE_URL/v1/health"
curl -s "$AKALYNTH_AUDIT_BASE_URL/v1/transparency" | jq .
curl --resolve api.akalynth.com:443:127.0.0.1 -sf https://api.akalynth.com/v1/health
curl -i http://127.0.0.1:3000/v1/health
timeout 5 wscat -c "$AKALYNTH_AUDIT_WS_URL"
systemd-analyze security akalynth --no-pager
```

Active default target is `https://api.akalynth.com`. Set `AKALYNTH_AUDIT_BASE_URL` or `AKALYNTH_AUDIT_WS_URL` to `https://beta-api.akalynth.com` for beta-path audits only.

For prod, direct loopback app health may return `403 {"error":"tls_required"}`. Treat this as expected TLS/proxy enforcement when host-local Caddy/TLS health and public API health both return `200`. If the API hostname has an AAAA record, collect both IPv4 and IPv6 public health/transparency evidence.

For beta/dev, separate service topology from API liveness. A beta host that passes `https://beta-api.akalynth.com/v1/health` but lacks `/opt/akalynth`, `/etc/akalynth`, `/var/lib/akalynth`, or `akalynth.service` is a topology drift finding, not proof of prod-layout readiness.

## Commands (Repo)

```
npm run build:server
npm run verify:lifecycle
npm run verify:receipt-hygiene
rg "character_create|auth_token_issue" receipts.jsonl | tail -50
```

## Must-check files

- `docs/CLIENT_CONTRACT_V0_1.md`
- `docs/IDENTITY_VERIFICATION.md`
- `packages/coordination-kernel/src/identity/token.ts`
- `apps/server/src/index.ts`
- `apps/server/src/api/http.ts`
- `apps/server/src/persist/materializers.ts`
- `infra/deploy_beta.sh`
- `apps/android/**` (CharacterCreateActivity, IdentityStore, AkalynthClient, MessageSerializer, protocol models)

## Required Output Format

**A) Verified Facts** (with evidence)

**B) Findings by Severity** (CRITICAL / HIGH / MED / LOW)
- Symptom
- Evidence
- Risk
- Fix

**C) Next 5 Shipments** (ranked, 1–2 day chunks)

**D) Regression Tests to Add**

## Exit Criteria for Green

- Token signing spec matches implementation.
- `/v1/transparency` exposes `auth_public_key_hex` and key derivation string.
- WS token login works and is preferred over guest when both present.
- Receipts bind identity deterministically (success + failure + token_id/nonce).
- Android canonical WS client path supports token login and token rotation persistence.
