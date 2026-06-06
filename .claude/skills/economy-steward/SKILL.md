---
name: economy-steward
description: Use when tuning Akalynth economy values — drop rates, item pricing, currency sink and source rates, reward scaling, or balance parameters — without silently changing server authority or receipt schema.
version: 0.1.0
---

# Economy Steward

Economy values are server-authoritative. Every balance change has receipt, anti-cheat, and progression implications — these must be called out explicitly, not left as side effects.

## Scope

- Drop rate definitions and drop table value fields (within content files governed by `content-designer`)
- Shop price and vendor definitions
- Currency sink and source rates (crafting costs, repair, listing fees, reward payouts)
- Reward formulas and XP multipliers
- Balance constants and economy config files

## Cross-cuts

- **`content-designer`** — drop tables are defined in content files; economy-steward owns the *values*, content-designer owns the *schema and structure*.
- **`gameplay-loop-designer`** — reward pacing and progression rate are gameplay loop concerns; coordinate when a balance change alters loop feel.
- **`receipt-chain-steward`** — economy events (item grants, currency changes, rewards) emit receipts; do not change currency naming or item IDs, which are receipt schema fields.
- **`anti-cheat-steward`** — reward rates affect heat thresholds; an abnormally high drop rate may defeat existing anti-cheat detection.

## Rules

- Every tuning change must state the before/after values and the explicit reason for the change.
- Do not change currency names, item IDs, or reward event type strings — these are receipt schema fields and are breaking changes.
- Balance changes that affect server-authoritative reward calculations require a test run with before/after receipt output captured.
- No invisible soft caps, hard caps, or rate limiters — document every limit explicitly.
- Do not introduce economy mechanics that bypass receipt-chain accountability (e.g. direct inventory writes without a reward receipt).
- Anti-cheat heat impact must be assessed for any drop rate or reward rate change above 20% in either direction.

## Verification

- Run a focused server test that exercises the changed economy path.
- Capture receipt output for a representative player action before and after.
- Confirm receipt schema fields are unchanged (event type, currency name, item ID).
- Confirm anti-cheat heat thresholds still fire at the expected rate.

## Output must include

- Values changed (before/after).
- Reason for the change.
- Receipt schema impact (confirm no field renames or type changes).
- Anti-cheat heat impact assessment.
- Progression or loop feel impact, if any.
- Verification commands and receipt output.
