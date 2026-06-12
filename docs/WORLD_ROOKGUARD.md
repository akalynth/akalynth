# World: Rookguard (Training Zone)

> **Purpose:** Reference for the Rookguard onboarding map. Source of truth is `packages/shared/maps/rookguard.json`; this doc must stay consistent with it.

Rookguard is the **mandatory 32×32 onboarding map** every guest must complete
before entering High City. It exists to prove that a human is at the keyboard and
to warm players up on core systems (movement intent, chat, Tem challenge,
profession identity, and starter combat).

## Map Specifications

- **Size**: 32×32 tiles  
- **Spawn**: `(2, 2)`  
- **Boundary**: Exterior ring of non-walkable walls  
- **Path**: Tutorial corridor across row `y = 2`, with plaza/guild landmarks around it and the gate to High City at the corridor end

## Tile Codes

| Code | Tile | Purpose |
|------|------|---------|
| `0` | Grass | Walkable filler |
| `2` | Wall | Boundary (non-walkable) |
| `5` | `TutorialMove` | Step here to mark the movement lesson complete |
| `6` | `TutorialChat` | Marks the chat lesson area; any non-empty Rookguard chat completes the current server tutorial chat step |
| `7` | `TutorialTem` | Triggers a Tem demo challenge; pass it to continue |
| `8` | `GateToAzura` | Legacy tile identifier for the High City gate; available only after tutorial, training, and Codex vocation proof are true |

All tutorial tiles are walkable so the authoritative server can detect them as part of the standard movement pipeline.

## Tutorial Checklist (server authoritative)

1. **Movement** – reach the `TutorialMove` tile.  
2. **Chat** – send a non-empty chat message while still in Rookguard.
3. **Tem Demo** – stepping on `TutorialTem` issues the friendly Tem challenge. Passing it marks the Tem step.
4. **Training Slime** – defeat the Rookguard `training_slime`; the existing `mob_kill` and `item_minted` receipts prove starter combat.
5. **Codex Vocation** – stand in `rookguard:guild_hall` and declare `warden`, `cantor`, `hexer`, or `reaver`; the `vocation_declared` receipt records the Codex profession.
6. **Gate Unlock** – once tutorial, training, and Codex vocation proof are true, stepping on `GateToAzura` flips `tutorial_complete = true`, emits receipts, and the server transfers the player to the first-city spawn. The tile name remains a legacy runtime identifier until the compatibility migration is complete.

Every event is logged to `audit/receipts.jsonl` (`tutorial_step_complete`, `tem_challenge_issued`, `mob_kill`, `item_minted`, `vocation_declared`, `tutorial_completed`, `gate_unlock`, etc.).

## First 30 Minutes

The current source contract for the first 0-30 minute Rookguard experience is
`docs/ROOKGUARD_FIRST_30_MINUTES_V1.md`.

The city-expansion source contract is `docs/ROOKGUARD_CITY_EXPANSION_V1.md`.

At a high level, the intended path is:

1. 0-5 minutes: spawn, orient, and complete movement.
2. 5-10 minutes: send one accountable local chat signal.
3. 10-15 minutes: receive and pass the friendly Tem challenge.
4. 15-20 minutes: try one harmless runestone roll.
5. 20-25 minutes: inspect the legend stone refusal.
6. 25-30 minutes: choose a Codex vocation, return to the gate, and complete Rookguard.

This path does not add gold, XP, or stat progression. It organizes the existing
server-authoritative onboarding surfaces into one visible play path; training
slime loot remains the existing receipt-minted starter-combat drop path.

## Layout (not to scale)

```
Walls █

Row y=2:
 [Spawn] → 5 (move) → 6 (chat) → 7 (Tem) → 8 (Gate►High City)

Single-tile corridor surrounded by walls to keep focus on onboarding.
```

## Additional Landmarks

Beyond the tutorial corridor, `rookguard.json` defines non-tile landmarks at fixed coordinates:

| Landmark | Coordinates | Notes |
|----------|-------------|-------|
| `plaza` | `(1, 1)` to `(10, 6)` | Server presence place `rookguard:plaza`; guide/herald area. |
| `guild_hall` | `(11, 1)` to `(18, 6)` | Server presence place `rookguard:guild_hall`; steward/profession area. |
| `profession_hall` | `(12, 2)` to `(16, 4)` | Client-visible vocation choice marker inside the guild hall. |
| `quest_board` | `(9, 4)` | Starter quest direction marker; no reward by itself. |
| `training_yard` | `(12, 12)` to `(17, 17)` | Starter monster-practice area around the existing training slime. |
| `codex_arch` | `(17, 3)` to `(17, 4)` | Identity/receipt marker beside the profession hall. |
| `runestone_table` | `(4, 4)` | Anchor for the Rookguard runestone (see `apps/server/src/world/runestone.ts`). |
| `legend_stone` | `(6, 6)` | Legend/lore marker. |

These are landmark entries (not walkable-tile codes) and may be referenced by gameplay systems independently of the tutorial path. `plaza` and `guild_hall` are server presence places in the current runtime. The other landmarks are display/lore markers until a later lane promotes them to interactive systems.

## Profession Selection

Profession selection uses the existing `declare_vocation` protocol message and
`vocation_declared` receipt. The available choices are `warden`, `cantor`,
`hexer`, and `reaver`.

The choice is a Codex profession identity in this slice: it changes the visible
vocation badge, emits a `vocation_declared` receipt, updates the
receipt-derived identity projection, and exposes the server-owned Rookguard
Codex profile in loop state. It does not grant combat power, currency, items,
XP, or standalone access.

The Rookguard Codex arch exposes six shelves:

| Shelf | Role in Rookguard |
| --- | --- |
| Artifacts Codex | Future relic/equipment lane; no reward or power grant yet. |
| Chronicle of Ages | Proof-history lane for quest receipts and remembered events. |
| Dungeon Codex | Future First Archive/vault route lane; no dungeon access yet. |
| Emberwilds Atlas | Future world-map/frontier lane; no transition yet. |
| Factions Codex | Faction/social-role context; no rank or standing yet. |
| Heroes Codex | Active profession lore anchored by the First Archivist and `heroes-codex`. |

## Lore & Flavor (Player-Facing)

> Narrative framing only. Mechanics are documented in the tables and code references above; nothing in this section changes tile behavior, collision, drops, rewards, or progression.

Rookguard is the threshold every newcomer crosses before the world will admit
them. It is deliberately small and quiet — a stone antechamber where the keep
listens to confirm a living hand is at the keyboard before opening the gate to
High City.

### The Runestone Table — `(4, 4)`

Beside the corridor stands a low table of cut runestone. Step adjacent to it and the stone answers.

- **Player-facing text:** when the ritual resolves, the stone whispers — `The stone exhales: Fire.` (one of `Fire`, `Water`, `Earth`, `Air`, `Light`, `Shadow`).
- **What it is mechanically (already in code, not changed here):** a server-authoritative ritual in `apps/server/src/world/runestone.ts`. The face is rolled by the server's RNG over the six `Element` values (`packages/shared/types.ts`); current runtime access is DEBUG-gated, requires proximity to the table, has a short cooldown (`RUNESTONE_COOLDOWN_MS = 2000` ms), and broadcasts the result to nearby players (`RUNESTONE_BROADCAST_RADIUS = 8` tiles).
- **Trinity of Shadow:** rolling `Shadow` three times in a row triggers a one-time recognition per player (`checkTrinityOfShadow`). This is flavor woven over existing mechanics — no reward or power is granted by documenting it.

The runestone has no winning face. It does not gate progress and gives no advantage; it is the world's first lesson that outcomes here are rolled in the open and recorded.

### The Legend Stone — `(6, 6)`

A weathered marker stone near the table. It carries the names and deeds the keep chooses to remember — a foreshadowing of the **Origin Act**, the first meaningful consequence each player commits, which is witnessed and sealed permanently (see `apps/server/src/world/origin.ts`).

- **Status:** marker with server behavior. Touching the `legend_stone` landmark is recorded as a sighting/attempt, repeated probing adds heat, and the server refuses/displaces the player rather than granting an item or power. The stone remains narrative-first: it does not create rewards, drops, or progression.

## Map Data

`packages/shared/maps/rookguard.json` holds the complete 32×32 tile array plus
landmarks for each tutorial marker and the gate. This file is loaded by the
authoritative server just like the current first-city map file,
`packages/shared/maps/azura.json`.
