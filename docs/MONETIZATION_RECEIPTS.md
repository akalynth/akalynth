# Monetization Receipts (Schema Draft)

This document specifies audit receipts for monetization so enforcement is mechanical, replay-safe, and reversible.

Design target:

- Purchases are reconstructable from receipts alone.
- Every purchase references the policy basis that permits it.
- Every purchase carries an explicit “not power” proof handle.
- Refunds/revocations are linked, not implicit.

See:

- `docs/MONETIZATION_CONSTITUTION.md`
- `docs/MONETIZATION_JUSTIFICATIONS.md`

---

## Receipt Actions (Monetization)

These receipt actions are **private-only** by default (never public rumors).

- `support_credit_granted` — credits minted into a non-transferable support wallet
- `support_credit_spent` — credits spent on a non-competitive SKU
- `support_entitlement_granted` — entitlement granted (cosmetic/memory/service)
- `support_entitlement_revoked` — entitlement revoked (refund/correction)
- `support_refund_issued` — refund recorded (credits and/or external provider)

---

## Canonical Fields (All Receipts)

All receipts share the standard chain fields (`sequence`, `timestamp`, `prev_hash`, `event_hash`, `signature`, `inputs_hash`, `outputs_hash`) plus:

- `actor_id` — the account/player initiating the action (server is also allowed)
- `action` — one of the monetization actions above
- `inputs` — schema by action
- `result` — `ok`/`denied`/`error` style outcome string

Note: canonical `receipt_hash` is computed (BLAKE3 over canonical JSON) and may be stored/materialized separately.

---

## Required Policy References

Any receipt that **spends** support credit or **grants** entitlements must include:

- `category` — one of: `cosmetic` | `memory` | `convenience` | `world_support` | `service`
- `policy_ref` — a stable reference to the permitting rule in the constitution
- `not_power_justification_id` — an id that points to a “why this is not power” justification entry

Recommended shape:

```json
{
  "category": "cosmetic",
  "policy_ref": {
    "doc": "MONETIZATION_CONSTITUTION",
    "article": "IV.1"
  },
  "not_power_justification_id": "np_sku:ui_theme:rookguard_stone:v1"
}
```

---

## Action Schemas (Inputs)

### `support_credit_granted`

Use for any value entering the support system (real money, crypto, promos, corrections).

```json
{
  "amount": 100,
  "reason": "purchase",
  "external_payment_ref": {
    "provider": "stripe",
    "payment_id": "pi_***"
  },
  "cap_period": "month",
  "cap_key": "support_credit:month"
}
```

### `support_credit_spent`

```json
{
  "amount": 25,
  "sku": "ui_theme:rookguard_stone",
  "category": "cosmetic",
  "policy_ref": { "doc": "MONETIZATION_CONSTITUTION", "article": "IV.1" },
  "not_power_justification_id": "np_sku:ui_theme:rookguard_stone:v1",
  "entitlement_key": "entitlement:ui_theme:rookguard_stone"
}
```

### `support_entitlement_granted`

```json
{
  "sku": "ui_theme:rookguard_stone",
  "entitlement_key": "entitlement:ui_theme:rookguard_stone",
  "category": "cosmetic",
  "policy_ref": { "doc": "MONETIZATION_CONSTITUTION", "article": "IV.1" },
  "not_power_justification_id": "np_sku:ui_theme:rookguard_stone:v1",
  "source_receipt_hash": "blake3:***"
}
```

### `support_entitlement_revoked`

```json
{
  "entitlement_key": "entitlement:ui_theme:rookguard_stone",
  "reason": "refund",
  "source_receipt_hash": "blake3:***"
}
```

### `support_refund_issued`

```json
{
  "amount": 25,
  "kind": "credit",
  "source_receipt_hash": "blake3:***"
}
```

---

## Invariants (Mechanical)

Monetization receipts MUST NOT:

- Modify combat mechanics, stats, win probability, drop rates, or progression rate.
- Bypass penalties/cooldowns/timers/challenges.
- Influence contested systems or leaderboards.
- Grant immunity/leniency in moderation or anti-cheat.

If a SKU cannot be justified as non-power, it is forbidden by policy.

