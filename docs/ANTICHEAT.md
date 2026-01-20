# Anti-Cheat System

## Core Principle

**Authoritative server always wins.**

- Client sends *intent* (e.g., "move north")
- Server validates and applies
- Server sends result
- Client renders only

The client NEVER tells the server "I am at position X,Y". This alone prevents 80% of cheats.

## Detection Signals

### 1. Speed Hacks / Impossible Movement

- **Signal**: Move intents arriving faster than allowed tick rate
- **Check**: Timestamp between moves < minimum allowed interval
- **Example**: 10 moves in 500ms when minimum is 100ms/move

### 2. Pathing Anomalies

- **Signal**: Movement that skips tiles or teleports
- **Check**: Distance between old position and requested new position > 1 tile
- **Example**: Player at (10,10) requests move to (15,10) in one step

### 3. Action Cadence Patterns

- **Signal**: Perfectly regular timing between actions (bot signature)
- **Check**: Variance in action intervals is suspiciously low
- **Example**: Exactly 100ms between every action for 100+ actions

### 4. Repeated Identical Timing

- **Signal**: Same exact millisecond intervals repeated
- **Check**: Hash of interval patterns matches known bot signatures
- **Example**: [100, 100, 100, 100, ...] vs human [97, 103, 98, 105, ...]

### 5. Chat Spam

- **Signal**: Rapid repeated messages
- **Check**: Message rate exceeds threshold
- **Example**: 10 messages in 5 seconds

## Enforcement Ladder

Escalation happens when signals persist or are severe.

| Level | Action | Trigger |
|-------|--------|---------|
| 1 | **Warn** | First suspicious signal detected |
| 2 | **Tem Challenge** | Repeated signals or failed to improve after warn |
| 3 | **Throttle** | Failed Tem challenge or continued violations |
| 4 | **Kick** | Multiple throttle periods or severe violation |
| 5 | **Temp Ban** | Repeated kicks or confirmed bot activity |

### Throttle Effects

- Movement speed reduced by 50%
- Chat rate limited to 1 message per 10 seconds
- Duration: 5 minutes

### Kick

- Immediate disconnect
- Can reconnect immediately (unless banned)
- Logged for review

### Temp Ban

- Cannot connect for 1 hour (increases with repeat offenses)
- Logged for review

## Tem Challenge

Tem is an anti-bot guardian that issues simple challenges.

### How It Works

1. Server detects suspicious behavior
2. Server sends `tem_challenge` message
3. Player must type the correct response in chat within timeout
4. Server validates response

### Challenge Format

```json
{
  "type": "tem_challenge",
  "challenge_id": "tc_123",
  "message": "Hi! Type AZURA in chat within 15 seconds.",
  "timeout_seconds": 15
}
```

### Outcomes

| Result | Action |
|--------|--------|
| Correct response in time | Challenge passed, restrictions lifted |
| Wrong response | Challenge failed, escalate to throttle |
| No response (timeout) | Challenge failed, escalate to throttle |

### Design Goals

- **Low friction for humans**: Simple word typing, 15 seconds is plenty
- **Blocks bots**: Requires reading and responding contextually
- **Logged for appeals**: All challenges and responses are recorded

## Audit Receipts

Every anti-cheat action emits a JSONL receipt.

### Format

```json
{
  "sequence": 1,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "prev_hash": "genesis",
  "event_hash": "blake3:abc123...",
  "signature": "ed25519:...",
  "actor_id": "p_abc123",
  "action": "tem_challenge_issued",
  "inputs": {
    "trigger": "speed_violation",
    "signal_count": 5,
    "signal_window_ms": 2000
  },
  "result": "challenge_sent",
  "inputs_hash": "blake3:def456...",
  "outputs_hash": "blake3:789abc..."
}
```

### Logged Events

- `signal_detected` - Suspicious signal found
- `warn_issued` - Warning sent to player
- `tem_challenge_issued` - Tem challenge sent
- `tem_challenge_passed` - Player passed challenge
- `tem_challenge_failed` - Player failed challenge
- `throttle_applied` - Throttle restrictions activated
- `throttle_lifted` - Throttle restrictions removed
- `kick_executed` - Player kicked
- `temp_ban_applied` - Temporary ban activated

## Implementation Notes

### State Per Player

```typescript
interface AntiCheatState {
  signals: Signal[];           // Recent signals (rolling window)
  warnCount: number;           // Warnings issued
  temChallengeActive: boolean; // Currently challenged
  temChallengeId: string | null;
  temChallengeExpires: number | null;
  throttleUntil: number | null;
  kickCount: number;           // Kicks this session
}
```

### Signal Decay

- Signals older than 60 seconds are discarded
- This prevents old behavior from haunting reformed players

### Appeal Process

- All receipts are stored
- Player can request review
- Moderator can view full signal history and evidence

## DEBUG-Gated Features

Certain features require `DEBUG=1` environment variable:

| Feature | Env Var | Purpose |
|---------|---------|---------|
| Test death trigger | `DEBUG=1` + `ALLOW_TEST_DEATH=1` | `kill_self` command for testing |
| Runestone casting | `DEBUG=1` | Access to runestone tables |
| Forced runestone face | `DEBUG=1` + `RUNESTONE_TEST_FORCE_FACE=<element>` | Deterministic rolls for testing |
| Public receipts raw | `DEBUG=1` | `/v1/receipts/public_raw` endpoint |

In production, Tem will gate runestone access via capability tokens (not yet implemented).
