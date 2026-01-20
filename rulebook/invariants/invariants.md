# Akalynth Invariants

These invariants MUST hold at all times. Violation of any invariant is a critical bug.

## Server Authority

1. **No client-claimed position**: The server never accepts coordinates from clients.
   Clients send direction intents; server computes resulting position.

2. **Receipt completeness**: Every state mutation emits a signed receipt.
   No state change exists without a corresponding audit trail entry.

3. **Tick atomicity**: Each tick processes intents atomically.
   Partial application of a tick's intents is forbidden.

## Anti-Cheat

4. **Speed limit enforcement**: No player can move faster than `max_move_speed` tiles per second.

5. **Walkable tile validation**: Movement onto non-walkable tiles is rejected.

6. **Heat accumulation**: Suspicious behavior accumulates heat; excessive heat triggers Tem challenge.

## Identity

7. **Session binding**: Each WebSocket connection is bound to exactly one player session.

8. **Founder immutability**: Once a founder flag is set, it cannot be removed.

## Chronicle

9. **Hash chain integrity** (planned): Each chronicle entry references the previous entry's hash.
   Chain integrity verification is a future enforcement gate.

10. **Signature validity** (planned): Signed receipts are intended to be verifiable against the operator's public key.
