# Protocol

All messages are JSON over WebSocket.

## Message Format

```typescript
interface Message {
  type: string;
  [key: string]: any;
}
```

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

Login successful.

```json
{
  "type": "login_ack",
  "player_id": "p_abc123",
  "guest_token": "gt_xyz789",
  "name": "Guest_1234"
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
    "name": "Guest_1234"
  },
  "nearby_players": [
    {"id": "p_def456", "x": 30, "y": 32, "name": "Guest_5678"}
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
    "name": "Guest_5678"
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
