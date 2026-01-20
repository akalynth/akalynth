# Protocol

All messages are JSON over WebSocket.

## Message Format

```typescript
interface Message {
  type: string;
  [key: string]: any;
}
```

## Client → Server Messages

| Type | Description |
|------|-------------|
| `connect` | Establish connection |
| `login` | Authenticate with guest token |
| `enter_world` | Enter game world |
| `move_intent` | Request movement |
| `chat` | Send chat message |
| `tem_response` | Respond to Tem challenge |
| `kill_self` | Test-only death trigger |
| `runestone_cast` | Cast at runestone table |
| `tem_witness_response` | Respond to witness request |
| `drop_item` | Drop item from inventory |
| `pickup_item` | Pick up world item |
| `attack_intent` | Attack another player |
| `mint_legendary` | Dev-only: mint legendary item |
| `set_protected_slot` | Protect an item from death drops |
| `get_chronicle` | Request chronicle events |
| `get_evidence` | Request evidence for chronicle event |
| `declare_vocation` | Declare player vocation |
| `pay_tithe` | Pay gold tithe |
| `inspect_wallet` | Request wallet snapshot |
| `inspect_player` | Request player info |
| `get_pressure_metrics` | Request pressure metrics |
| `start_work_contract` | Start a work contract |
| `work_tick` | Record a work contract tick |
| `talk_to_npc` | Interact with NPC |
| `use_skill` | Use a skill (utility/admin) |
| `temple_sweep` | Temple sweep action |
| `grant_gold` | Dev-only: grant gold |
| `grant_sovereign_prefix` | Dev-only: grant sovereign prefix |
| `get_mod_reports` | List moderation reports (DEBUG only) |
| `mod_resolve` | Resolve moderation report (DEBUG only) |

## Server → Client Messages

| Type | Description |
|------|-------------|
| `welcome` | Connection accepted |
| `login_ack` | Login result |
| `world_state` | Initial world snapshot |
| `move_result` | Movement result |
| `player_moved` | Another player moved |
| `player_joined` | Player entered world |
| `player_left` | Player left world |
| `chat_broadcast` | Chat from player |
| `tem_challenge` | Anti-bot challenge |
| `error` | Error message |
| `death_notice` | Death/respawn info |
| `runestone_result` | Runestone cast result (broadcast) |
| `runestone_denied` | Runestone cast rejected |
| `tem_witness_request` | Request to witness heat penalty |
| `drop_item_result` | Drop item result |
| `pickup_item_result` | Pickup item result |
| `inventory_snapshot` | Full inventory state |
| `world_item_added` | Item spawned in world |
| `world_item_removed` | Item removed from world |
| `combat_resolved` | Combat outcome (broadcast) |
| `combat_rejected` | Combat rejected |
| `protected_slot_set` | Protected slot changed |
| `chronicle_snapshot` | Chronicle events response |
| `evidence_snapshot` | Evidence response |
| `tithe_result` | Tithe payment result |
| `wallet_snapshot` | Wallet state snapshot |
| `player_inspect` | Player info response |
| `pressure_metrics_snapshot` | Pressure metrics response |
| `work_contract_started` | Work contract started |
| `work_progress` | Work contract progress |
| `work_contract_result` | Work contract completed |
| `npc_dialogue` | NPC dialogue response |
| `npc_dialogue_error` | NPC dialogue error |
| `skill_result` | Skill result (utility/admin) |
| `mod_reports_snapshot` | Moderation reports snapshot (DEBUG only) |
| `mod_resolve_result` | Moderation resolution result (DEBUG only) |

---

## Message Types

### Connection

#### `connect` (client → server)

Request to establish connection.

```json
{"type": "connect"}
```

#### `welcome` (server → client)

Connection accepted.

```json
{
  "type": "welcome",
  "version": "0.1.0"
}
```

---

### Authentication

#### `login` (client → server)

Login with guest token (auto-generated if not provided).
Guest tokens are single-use and expire after a short TTL (default 10 minutes,
configurable via `GUEST_SESSION_TTL_MS`). Expired tokens return
`error: "not_authenticated"`.

```json
{
  "type": "login",
  "guest_token": null
}
```

#### `login_ack` (server → client)

Login result.

```json
{
  "type": "login_ack",
  "ok": true,
  "player_id": "p_abc123",
  "guest_token": "gt_xyz789",
  "name": "Guest_1234"
}
```

Failed login:
```json
{
  "type": "login_ack",
  "ok": false,
  "player_id": "",
  "guest_token": "",
  "name": "",
  "reason": "invalid_token"
}
```

---

### World

#### `enter_world` (client → server)

Request to enter the game world.

```json
{"type": "enter_world"}
```

#### `world_state` (server → client)

Initial world snapshot.

```json
{
  "type": "world_state",
  "player": {
    "id": "p_abc123",
    "x": 32,
    "y": 32,
    "name": "Guest_1234",
    "status": "alive"
  },
  "nearby_players": [
    {"id": "p_def456", "x": 30, "y": 32, "name": "Guest_5678", "status": "alive"}
  ]
}
```

---

### Movement

#### `move_intent` (client → server)

Request to move in a direction.

```json
{
  "type": "move_intent",
  "direction": "north"
}
```

Valid directions: `"north"`, `"south"`, `"east"`, `"west"`

#### `move_result` (server → client)

Movement result.

```json
{
  "type": "move_result",
  "ok": true,
  "x": 32,
  "y": 31,
  "reason": null
}
```

Rejection example:
```json
{
  "type": "move_result",
  "ok": false,
  "x": 32,
  "y": 32,
  "reason": "tile_blocked"
}
```

#### `player_moved` (server → client, broadcast)

Another player moved.

```json
{
  "type": "player_moved",
  "player_id": "p_def456",
  "x": 31,
  "y": 32
}
```

#### `player_joined` (server → client, broadcast)

Another player entered the world.

```json
{
  "type": "player_joined",
  "player": {
    "id": "p_def456",
    "x": 32,
    "y": 32,
    "name": "Guest_5678",
    "status": "alive"
  }
}
```

#### `player_left` (server → client, broadcast)

A player left the world.

```json
{
  "type": "player_left",
  "player_id": "p_def456"
}
```

---

### Chat

#### `chat` (client → server)

Send a chat message.

```json
{
  "type": "chat",
  "message": "Hello everyone!"
}
```

#### `chat_broadcast` (server → client)

Chat message from a player.

```json
{
  "type": "chat_broadcast",
  "player_id": "p_abc123",
  "name": "Guest_1234",
  "message": "Hello everyone!"
}
```

---

### Anti-Cheat

#### `tem_challenge` (server → client)

Tem anti-bot challenge.

```json
{
  "type": "tem_challenge",
  "challenge_id": "tc_123",
  "message": "Hi! Type AZURA in chat within 15 seconds.",
  "timeout_seconds": 15
}
```

#### `tem_response` (client → server)

Response to Tem challenge.

```json
{
  "type": "tem_response",
  "response": "AZURA"
}
```

---

### Witness System

#### `tem_witness_request` (server → client)

Request nearby players to witness a heat penalty.

```json
{
  "type": "tem_witness_request",
  "request_id": "wr_abc123",
  "timestamp": "2025-01-10T12:00:00.000Z",
  "map": "Azura",
  "target_actor": "p_def456",
  "prompt": "Did you see suspicious behavior from this player?",
  "kind": "heat_penalty"
}
```

#### `tem_witness_response` (client → server)

Respond to a witness request.

```json
{
  "type": "tem_witness_response",
  "request_id": "wr_abc123",
  "response": "confirm"
}
```

Valid responses: `"confirm"`, `"deny"`, `"uncertain"`

---

### Runestone

#### `runestone_cast` (client → server)

Cast at a runestone table. The `guess` is optional (for prediction games).

```json
{
  "type": "runestone_cast",
  "table_id": "rt_plaza_1",
  "guess": null
}
```

With prediction:
```json
{
  "type": "runestone_cast",
  "table_id": "rt_plaza_1",
  "guess": "fire"
}
```

Valid elements: `"fire"`, `"water"`, `"earth"`, `"air"`, `"light"`, `"shadow"`

#### `runestone_result` (server → client, broadcast)

Result of a runestone cast (broadcast to all nearby players).

```json
{
  "type": "runestone_result",
  "table_id": "rt_plaza_1",
  "caster": {"id": "p_abc123", "name": "Guest_1234"},
  "face": "fire",
  "whisper": "The flames speak of hidden power..."
}
```

#### `runestone_denied` (server → client)

Runestone cast was rejected.

```json
{
  "type": "runestone_denied",
  "reason": "cooldown"
}
```

Denial reasons:
- `cooldown` - Player on cooldown
- `not_near_table` - Not adjacent to a runestone table
- `not_authorized` - Lacks capability
- `rate_limited` - Too many casts

---

### Death

#### `kill_self` (client → server)

Test-only helper to trigger death/respawn. Requires environment variable
`ALLOW_TEST_DEATH=1`. Otherwise returns `error: "invalid_message"`.

```json
{"type": "kill_self"}
```

#### `death_notice` (server → client)

Sent immediately after death is handled. Provides respawn timing and spawn
location. Detailed truth lives in receipts.

```json
{
  "type": "death_notice",
  "ok": true,
  "respawn_in_ms": 15000,
  "map": "Rookguard",
  "spawn": {"x": 32, "y": 32},
  "reason": "test"
}
```

---

### Items (Phase 2)

#### `drop_item` (client → server)

Drop an item from inventory onto the world.

```json
{
  "type": "drop_item",
  "item_id": "item_abc123"
}
```

#### `drop_item_result` (server → client)

Result of drop attempt.

```json
{
  "type": "drop_item_result",
  "ok": true,
  "item_id": "item_abc123",
  "reason": null
}
```

#### `pickup_item` (client → server)

Pick up an item from the world.

```json
{
  "type": "pickup_item",
  "item_id": "item_abc123"
}
```

#### `pickup_item_result` (server → client)

Result of pickup attempt.

```json
{
  "type": "pickup_item_result",
  "ok": true,
  "item_id": "item_abc123",
  "reason": null
}
```

#### `inventory_snapshot` (server → client)

Full inventory state. Sent on enter_world and after inventory changes.

```json
{
  "type": "inventory_snapshot",
  "items": [
    {"item_id": "item_abc123", "item_type": "gold_coin", "slot": null},
    {"item_id": "item_def456", "item_type": "sword", "slot": "protected"}
  ]
}
```

#### `world_item_added` (server → client, broadcast)

An item was added to the world.

```json
{
  "type": "world_item_added",
  "item_id": "item_abc123",
  "item_type": "gold_coin",
  "x": 32,
  "y": 33
}
```

#### `world_item_removed` (server → client, broadcast)

An item was removed from the world.

```json
{
  "type": "world_item_removed",
  "item_id": "item_abc123"
}
```

---

### Combat (Phase 3)

#### `attack_intent` (client → server)

Attack another player. Must be adjacent.

```json
{
  "type": "attack_intent",
  "target_player_id": "p_def456"
}
```

#### `combat_resolved` (server → client, broadcast)

Combat outcome. Broadcast to all nearby players.

```json
{
  "type": "combat_resolved",
  "attacker_id": "p_abc123",
  "defender_id": "p_def456",
  "outcome": "kill",
  "map": "Azura",
  "x": 32,
  "y": 33
}
```

#### `combat_rejected` (server → client)

Combat was rejected.

```json
{
  "type": "combat_rejected",
  "reason": "not_adjacent"
}
```

Rejection reasons:
- `cooldown` - Attack on cooldown
- `not_adjacent` - Target not adjacent
- `pvp_disabled` - PvP not allowed in this zone
- `attacker_dead` - Attacker is dead
- `defender_dead` - Defender is dead
- `different_maps` - Not on same map
- `attacker_not_found` - Attacker not found
- `defender_not_found` - Defender not found

---

### Protected Slots (Phase 3.2)

#### `set_protected_slot` (client → server)

Protect an item from being dropped on death. Only one item can be protected.

```json
{
  "type": "set_protected_slot",
  "item_id": "item_abc123"
}
```

#### `protected_slot_set` (server → client)

Protected slot was changed.

```json
{
  "type": "protected_slot_set",
  "player_id": "p_abc123",
  "item_id": "item_def456",
  "prev_item_id": "item_abc123"
}
```

---

### Chronicle (Phase 4)

#### `get_chronicle` (client → server)

Request chronicle events. Can request own or another player's chronicle.

```json
{
  "type": "get_chronicle",
  "player_id": "p_def456",
  "limit": 50,
  "before": "2025-01-10T12:00:00.000Z"
}
```

All fields optional:
- `player_id` - Target player (omit for own chronicle)
- `limit` - Max events (default 50, max 200)
- `before` - Pagination cursor (ISO8601 timestamp)

#### `chronicle_snapshot` (server → client)

Chronicle events response.

```json
{
  "type": "chronicle_snapshot",
  "player_id": "p_abc123",
  "events": [
    {
      "kind": "death",
      "timestamp": "2025-01-10T12:00:00.000Z",
      "zone": "Azura",
      "x": 32,
      "y": 33,
      "details": {"cause": "player", "attacker_id": "p_def456"},
      "evidence_ref": {
        "chronicle_event_id": 42,
        "receipt_hash": "sha256:abc123..."
      }
    }
  ],
  "has_more": true
}
```

Event kinds include: `death`, `item_lost`, `legendary_lost`, `respawn`, `zone_enter`, etc.

---

### Evidence (Phase 4.4)

#### `get_evidence` (client → server)

Request evidence for a chronicle event. Requires at least one anchor.

```json
{
  "type": "get_evidence",
  "chronicle_event_id": 42,
  "kind": "death"
}
```

Or by receipt hash:
```json
{
  "type": "get_evidence",
  "receipt_hash": "sha256:abc123..."
}
```

#### `evidence_snapshot` (server → client)

Evidence response. Contains full forensic breakdown for death drops.

```json
{
  "type": "evidence_snapshot",
  "status": "ok",
  "player_id": "p_abc123",
  "chronicle_event_id": 42,
  "receipt_hash": "sha256:abc123...",
  "source_action": "death",
  "kind": "death",
  "evidence": {
    "receipt_hashes": {
      "anchor": "sha256:abc123...",
      "combat_resolved": "sha256:def456...",
      "death": "sha256:ghi789..."
    },
    "drop_explanation": {
      "policy": {
        "base_drop_ratio": 0.25,
        "min_drop": 1,
        "max_drop": null,
        "rep_bias": 0.1,
        "stack_bias": 0.05,
        "protected_slots": 1,
        "decay_minutes": 15
      },
      "ratio_breakdown": {
        "base_drop_ratio": 0.25,
        "reputation": 100,
        "neg_rep": 0,
        "inventory_size": 10,
        "stack_excess": 0,
        "rep_contribution": 0,
        "stack_contribution": 0,
        "final_ratio": 0.25,
        "K_raw": 2.5,
        "K_bounded": 3,
        "K_final": 2
      },
      "player_protected_ids": ["item_sword"],
      "policy_protected_ids": [],
      "candidates": [
        {
          "item_id": "item_abc",
          "item_type": "gold_coin",
          "base_weight": 1.0,
          "legendary": false,
          "legendary_tier": null,
          "heat": 0,
          "legendary_multiplier": null,
          "final_weight": 1.0,
          "deterministic_u": 0.42,
          "selection_key": 0.42,
          "rank": 1,
          "dropped": true,
          "exclusion_reason": "none"
        }
      ],
      "dropped_item_ids": ["item_abc"],
      "kept_item_ids": ["item_sword"],
      "seed_hash": "sha256:seed..."
    }
  }
}
```

Status values:
- `ok` - Evidence found and returned
- `not_found` - Chronicle event or receipt not found
- `not_applicable` - Event type doesn't have evidence
- `insufficient_data` - Missing required receipts

---

### Economy / Vocation

#### `declare_vocation` (client → server)

Declare player's vocation.

```json
{"type": "declare_vocation", "vocation": "merchant"}
```

#### `pay_tithe` (client → server)

Pay gold tithe.

```json
{"type": "pay_tithe", "amount": 100}
```

#### `tithe_result` (server → client)

Tithe payment result.

```json
{"type": "tithe_result", "ok": true, "amount": 100, "new_balance": 400, "receipt_hash": "blake3:..."}
```

---

### Wallet / Inspection

#### `inspect_wallet` (client → server)

Request wallet snapshot for a player.

```json
{"type": "inspect_wallet", "player_id": "p_abc123"}
```

#### `wallet_snapshot` (server → client)

Wallet state response.

```json
{"type": "wallet_snapshot", "player_id": "p_abc123", "gold": 500, "sovereign_prefix": false}
```

#### `inspect_player` (client → server)

Request player info.

```json
{"type": "inspect_player", "player_id": "p_abc123"}
```

#### `player_inspect` (server → client)

Player info response.

```json
{"type": "player_inspect", "player_id": "p_abc123", "name": "Alice", "status": "alive"}
```

---

### Pressure

#### `get_pressure_metrics` (client → server)

Request pressure metrics for a player.

```json
{"type": "get_pressure_metrics", "player_id": "p_abc123"}
```

#### `pressure_metrics_snapshot` (server → client)

Pressure metrics response.

```json
{"type": "pressure_metrics_snapshot", "player_id": "p_abc123", "metrics": {}}
```

---

### Work Contracts

#### `start_work_contract` (client → server)

Start a work contract.

```json
{"type": "start_work_contract", "contract_type": "temple_sweep"}
```

#### `work_tick` (client → server)

Record a work contract tick (presence proof).

```json
{"type": "work_tick", "contract_id": "wc_123"}
```

#### `work_contract_started` (server → client)

Work contract started confirmation.

```json
{
  "type": "work_contract_started",
  "contract_id": "wc_123",
  "contract_type": "temple_sweep",
  "payout_gold": 50,
  "cooldown_seconds": 120,
  "min_duration_ms": 30000
}
```

#### `work_progress` (server → client)

Work contract progress update.

```json
{
  "type": "work_progress",
  "contract_id": "wc_123",
  "ticks_observed": 4,
  "ticks_required": 10,
  "remaining_ms": 12000
}
```

#### `work_contract_result` (server → client)

Work contract completed.

```json
{"type": "work_contract_result", "contract_id": "wc_123", "success": true, "credited_gold": 50}
```

---

### NPC Dialogue

#### `talk_to_npc` (client → server)

Interact with an NPC.

```json
{"type": "talk_to_npc", "npc_id": "npc_merchant"}
```

#### `npc_dialogue` (server → client)

NPC dialogue response.

```json
{"type": "npc_dialogue", "npc_id": "npc_merchant", "place_id": "rookguard_square", "tier": "seen", "line": "Welcome traveler!"}
```

#### `npc_dialogue_error` (server → client)

NPC dialogue error.

```json
{"type": "npc_dialogue_error", "npc_id": "npc_merchant", "error": "not_found"}
```

---

### Skills v0 (Utility/Admin)

#### `use_skill` (client → server)

Use a skill. Requires authentication; some skills are DEBUG-only.

```json
{"type": "use_skill", "skill_id": "mod_scan", "target_id": "p_def456"}
```

#### `skill_result` (server → client)

Skill execution result.

```json
{"type": "skill_result", "skill_id": "mod_scan", "success": true, "payload": {"summary": "ok"}}
```

Failure example:
```json
{"type": "skill_result", "skill_id": "mod_scan", "success": false, "reason": "debug_only"}
```

---

### Moderation v1 (Admin-Only)

#### `get_mod_reports` (client → server)

List moderation reports (DEBUG only).

```json
{"type": "get_mod_reports", "status": "open", "limit": 50}
```

#### `mod_reports_snapshot` (server → client)

Snapshot of moderation reports.

```json
{
  "type": "mod_reports_snapshot",
  "reports": [
    {
      "case_id": "case_123",
      "receipt_hash": "blake3:...",
      "reporter_id": "p_reporter",
      "target_id": "p_target",
      "reported_at": "2026-01-20T00:00:00.000Z",
      "status": "open"
    }
  ],
  "has_more": false
}
```

#### `mod_resolve` (client → server)

Resolve a moderation report (DEBUG only). Prefer `receipt_hash` (canonical).

```json
{"type": "mod_resolve", "receipt_hash": "blake3:...", "resolution": "warning", "reason": "rule_violation"}
```

#### `mod_resolve_result` (server → client)

Resolution result.

```json
{"type": "mod_resolve_result", "case_id": "case_123", "success": true}
```

Failure example:
```json
{"type": "mod_resolve_result", "case_id": "case_123", "success": false, "error": "not_authorized"}
```

---

### Temple

#### `temple_sweep` (client → server)

Temple sweep action.

```json
{"type": "temple_sweep"}
```

---

### Dev-Only Messages

#### `mint_legendary` (client → server)

Dev-only: Mint a legendary item. Requires `DEBUG=1`.

```json
{
  "type": "mint_legendary",
  "item_type": "mark_token",
  "tier": 3
}
```

- `item_type` - Item type (default: "mark_token")
- `tier` - Legendary tier 1-5 (default: 1)

#### `grant_gold` (client → server)

Dev-only: Grant gold to a player. Requires `DEBUG=1`.

```json
{"type": "grant_gold", "player_id": "p_abc123", "amount": 1000}
```

#### `grant_sovereign_prefix` (client → server)

Dev-only: Grant sovereign prefix to a player. Requires `DEBUG=1`.

```json
{"type": "grant_sovereign_prefix", "player_id": "p_abc123", "enabled": true}
```

---

### Errors

#### `error` (server → client)

```json
{
  "type": "error",
  "code": "invalid_message",
  "message": "Unknown message type"
}
```

Error codes:
- `invalid_message` - Malformed or unknown message
- `not_authenticated` - Action requires login
- `not_in_world` - Action requires being in world
- `rate_limited` - Too many requests
- `kicked` - Player was kicked
