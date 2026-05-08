---
name: akalynth-system-audit
description: Evidence-backed full-stack audit for Akalynth covering infra, server, receipts, identity, WS protocol, and Android client parity. Use when asked to audit Akalynth or validate identity/receipt/transparency/WS/client/infra health with verified facts and severity-ranked findings.
---

# System Audit (Akalynth)

This repo may not support external skill installers. Use this document as the canonical audit procedure and output format.
Runbook version follows tag v1.0.5-identity-law+.

## Goal
Produce an evidence-backed audit of:
- server identity, receipts, and transparency
- WS protocol correctness and backward compatibility
- Android client identity parity
- infra exposure (ports, firewall) and systemd hardening
- deploy reliability and repo state hygiene
- verification suites status (including chronicle policy)

## Non-negotiables
- Make no claim without evidence (file:line, command output, or runtime response).
- Separate verified vs assumed.
- If docs and code disagree, mark CRITICAL.
- Capture determinism: any randomness affecting identity must be recorded in receipts.
- Keep guest login functional unless deprecated via a new contract.

## Evidence Anchors
- Evidence format: path:line OR command -> snippet.
- No evidence, no claim.

## Commands (Ops)
- AKALYNTH_AUDIT_BASE_URL="${AKALYNTH_AUDIT_BASE_URL:-https://api.akalynth.com}"
- AKALYNTH_AUDIT_WS_URL="${AKALYNTH_AUDIT_WS_URL:-wss://api.akalynth.com}"
- `sudo ss -ltnp | rg ":(80|443|3000)\\b"`
- `sudo ufw status verbose`
- `curl -s "$AKALYNTH_AUDIT_BASE_URL/v1/health"`
- `curl -s "$AKALYNTH_AUDIT_BASE_URL/v1/transparency" | jq .`
- `timeout 5 wscat -c "$AKALYNTH_AUDIT_WS_URL"`
- `systemd-analyze security akalynth --no-pager`
- Active default target is `https://api.akalynth.com`; set AKALYNTH_AUDIT_BASE_URL or AKALYNTH_AUDIT_WS_URL explicitly to `https://beta-api.akalynth.com` for beta-path audits only. This does not change the frozen `docs/CLIENT_CONTRACT_V0_1.md` client contract.

## Commands (Repo)
- `npm run build:server`
- `npm run verify:lifecycle`
- `npm run verify:receipt-hygiene`
- `rg "character_create|auth_token_issue" receipts.jsonl | tail -50`

## Local Full Audit (chronicle enabled)
From repo root, generate fixtures and run the audit gate:
```bash
mkdir -p .secrets
node --input-type=module -e "import fs from node:fs; import crypto from node:crypto; const seed = crypto.createHash(sha256).update(akalynth-ci-fixture-key-v1).digest(); fs.writeFileSync(.secrets/chronicle.key, seed.subarray(0, 32)); fs.chmodSync(.secrets/chronicle.key, 0o600);"
CHRONICLE_KEY_PATH=$PWD/.secrets/chronicle.key AKALYNTH_RECEIPT_CHAIN_PATH=$PWD/apps/server/fixtures/ci-receipts/receipts.jsonl npm -w apps/server run fixture:generate
node apps/server/tools/generate-chronicle-log.js apps/server/fixtures/ci-chronicle/chronicle.log
ENABLE_CHRONICLE=1 CHRONICLE_LOG_PATH=$PWD/apps/server/fixtures/ci-chronicle/chronicle.log AKALYNTH_RECEIPT_CHAIN_PATH=$PWD/apps/server/fixtures/ci-receipts/receipts.jsonl npm run verify:receipt-hygiene
```
Optional: `npm run build:server` and `npm run verify:quick` for a broader local check.

Audit note: CI chronicle verification is wired in `.github/workflows/ci.yml` as "Receipt + chronicle hygiene (audit)" with `ENABLE_CHRONICLE=1` and `CHRONICLE_LOG_PATH` set. Mirror that env for manual audits.

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
A) Verified Facts (with evidence)
B) Findings by Severity (CRITICAL/HIGH/MED/LOW)
   - symptom
   - evidence
   - risk
   - fix
C) Next 5 Shipments (ranked, 1 to 2 day chunks)
D) Regression Tests to Add

## Exit Criteria for Green
- Token signing spec matches implementation.
- `/v1/transparency` exposes `auth_public_key_hex` and key derivation string.
- WS token login works and is preferred over guest when both present.
- Receipts bind identity deterministically (success plus failure plus token_id/nonce).
- Android canonical WS client path supports token login and token rotation persistence.
