# Sim Life Viewer v1

Status: source contract and dashboard implementation.

## Purpose

The sim lane should feel like a living miniature world without pretending that
simulated agents are real players. `Sim Life Viewer v1` makes deterministic sim
agents visible on `sim.akalynth.com` and exposes their server-owned state through
`GET /v1/sim/snapshot`.

This is a public sim/dashboard surface, not a production player claim, Android
release claim, or beta/staging authority change.

## Endpoint

```text
GET /v1/sim/snapshot
```

The endpoint returns:

- sim agents with `agent_id`, role, map, position, intent, gold, inventory count,
  status, and last receipt link;
- timeline frames for the first five minutes;
- first-five-minute gameplan rows;
- speed controls supported by the dashboard: pause, `1x`, `10x`, `100x`;
- hash-linked simulated receipt records for every visible frame.

The endpoint is read-only. It accepts no client positions, no client inventory,
no client gold, and no client receipt claims.

## First 5min Gameplan

| Minute | Visible beat | Receipt actions |
| --- | --- | --- |
| 0 | A worker appears in Rookguard and becomes visible. | `presence_entered` |
| 1 | The worker completes a temple sweep and receives gold. | `work_contract_completed`, `wallet_credit` |
| 2 | Loot enters inventory and changes the visible item count. | `item_minted`, `item_added_to_inventory` |
| 3 | Property and auction economy become visible in Azura. | `wallet_debit`, `property_bid`, `property_auction_settled` |
| 4 | Combat/death risk, item drop, and world-event contribution close the loop. | `combat_resolved`, `death`, `item_dropped_to_world`, `world_event_contribution` |

## Authority Boundary

- Server owns the snapshot and timeline.
- Browser playback may pause or timelapse returned frames.
- Browser animation must not invent durable state.
- Sim receipts are marked by the endpoint authority block as simulated receipts,
  not public-world receipts.
- The dashboard should show the sim boundary clearly.

## Playtest Path

1. Open `https://sim.akalynth.com/`.
2. Confirm both Rookguard and Azura map panels render.
3. Select `1x`, `10x`, and `100x`.
4. Confirm agents move only between receipt-backed frames.
5. Confirm each agent card shows intent, gold, inventory count, and receipt hash.
6. Confirm `https://sim-api.akalynth.com/v1/sim/snapshot` returns HTTP `200`.
