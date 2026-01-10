# World: Rookguard (Training Zone)

Rookguard is the **mandatory 32×32 onboarding map** every guest must complete before entering Azura. It exists to prove that a human is at the keyboard and to warm players up on core systems (movement intent, chat, Tem challenge).

## Map Specifications

- **Size**: 32×32 tiles  
- **Spawn**: `(2, 2)`  
- **Boundary**: Exterior ring of non-walkable walls  
- **Path**: Straight tutorial corridor across row `y = 2` ending at the gate to Azura

## Tile Codes

| Code | Tile | Purpose |
|------|------|---------|
| `0` | Grass | Walkable filler |
| `2` | Wall | Boundary (non-walkable) |
| `5` | `TutorialMove` | Step here to mark the movement lesson complete |
| `6` | `TutorialChat` | Stand nearby then send any chat message |
| `7` | `TutorialTem` | Triggers a Tem demo challenge; pass it to continue |
| `8` | `GateToAzura` | Available only after all tutorial flags are true |

All tutorial tiles are walkable so the authoritative server can detect them as part of the standard movement pipeline.

## Tutorial Checklist (server authoritative)

1. **Movement** – reach the `TutorialMove` tile.  
2. **Chat** – after touching `TutorialChat`, send a non-empty chat message.  
3. **Tem Demo** – stepping on `TutorialTem` issues the friendly Tem challenge (“Hi! 👋 type AZURA…”). Passing it marks the Tem step.  
4. **Gate Unlock** – once the previous steps are true, stepping on `GateToAzura` flips `tutorial_complete = true`, emits receipts, and the server transfers the player to Azura’s spawn.

Every event is logged to `server/audit/receipts.jsonl` (`tutorial_step_complete`, `tem_challenge_issued`, `tutorial_completed`, `gate_unlock`, etc.).

## Layout (not to scale)

```
Walls █

Row y=2:
 [Spawn] → 5 (move) → 6 (chat) → 7 (Tem) → 8 (Gate►Azura)

Single-tile corridor surrounded by walls to keep focus on onboarding.
```

## Map Data

`shared/maps/rookguard.json` holds the complete 32×32 tile array plus landmarks for each tutorial marker and the gate. This file is loaded by the authoritative server just like `azura.json`.

