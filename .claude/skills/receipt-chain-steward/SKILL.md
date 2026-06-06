---
name: receipt-chain-steward
description: Use when working with Akalynth receipts, chronicle logs, replay, audit JSONL, SQLite materialization, receipt schemas, chain verification, or production runtime data custody.
version: 0.1.0
---

# Receipt Chain Steward

Receipts and chronicle data are canonical. SQLite is derived.

Rules:

- Never delete or replace `/var/lib/akalynth/audit` or chronicle data without explicit approval.
- Preserve JSONL receipt order and chain integrity.
- Treat SQLite as rebuildable materialized state, not source of truth.
- Any new gameplay consequence needs a receipt before derived state changes.
- Production signing keys live outside the repo under `/etc/akalynth`.
- Do not print secret key material.

Verification:

- Name receipt paths.
- Name replay/chain commands.
- Report receipt count and chain status.
- Separate bootstrap-only artifacts from live runtime artifacts.
