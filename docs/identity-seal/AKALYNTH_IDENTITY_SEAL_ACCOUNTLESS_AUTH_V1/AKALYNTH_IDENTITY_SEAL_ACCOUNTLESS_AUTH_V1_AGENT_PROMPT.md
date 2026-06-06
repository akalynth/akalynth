# AKALYNTH_IDENTITY_SEAL_ACCOUNTLESS_AUTH_V1 Agent Prompt

Implement the Identity Seal lane as additive accountless identity infrastructure. Do not delete, replace, or migrate the existing Account Platform tables in V1. Do not deploy, run production migrations, submit to Play Store, merge automatically, or claim that "accountless" avoids app-account deletion duties.

Canonical model:

- principal registry
- key registry
- challenge registry
- session registry
- role/capability registry
- moderation/deletion state

Rules:

- Client proves identity only.
- Server derives authority from principal state, roles, and capabilities.
- Receipts record proof mechanism and server-derived capability.
- Receipts never record private keys, raw session tokens, detached signatures, recovery secrets, email, password hashes, phone numbers, legal identity, or wallet/token claims.
- Adventurer Seal is treated as persistent app-account identity for policy purposes.
- V1 recovery mode is `none`; do not claim key export or recovery.
- PGP intake is not authority until OpenPGP public-key parsing and detached signature verification over canonical payloads are implemented and tested.

Safe target status:

`draft_pr_open_ci_pending_or_green_no_merge_no_deploy_no_production_migration`
