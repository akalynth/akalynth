---
name: content-designer
description: Use when adding or modifying Akalynth game content — mob definitions, item definitions, zone layouts, spawn tables, drop tables, NPC behavior, or world content data — without silently changing economy balance or server authority rules.
version: 0.1.0
---

# Content Designer

Game content is server-authoritative. Content changes may touch economy, anti-cheat surface, or receipt schema — call these out explicitly.

## Content locations

Game content (mobs, items, zones, spawns, drops) lives in the server and shared packages — not in a separate content bundle. Before editing, locate the relevant definitions:

- Server game logic: `apps/server/src/`
- Shared types and data contracts: `packages/shared/`
- Proof/receipt data store: `packages/data/` (JSONL — `proofs.jsonl`, `proofs-batches.jsonl`)
- Rulebook and world text: check `docs/` and any map/lore files

## Rules

- Do not silently change drop rates, currency values, XP multipliers, or spawn timers without flagging the economy impact.
- Do not change mob stats in a way that defeats existing anti-cheat heat thresholds without updating `anti-cheat-steward` constraints.
- If content introduces a new gameplay consequence (death, item loss, zone transition), it needs a receipt before derived state changes.
- Keep content changes separable from protocol changes. If a new mob type requires a new WS message, route the protocol part through `protocol-guardian` first.
- Do not add loot or progression that bypasses receipt-chain accountability.

## Required output

- What content was added or changed.
- Economy impact (drop rates, rewards, currency, XP).
- Anti-cheat surface change, if any.
- Receipt schema impact, if any.
- Protocol change required, if any.
- Verification path (focused server test or smoke test that exercises the new content).
