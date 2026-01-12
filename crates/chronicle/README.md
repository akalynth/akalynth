# Chronicle — Append-Only Witness Kernel

Cryptographic witnessing of game events for Akalynth.

## Purpose

Chronicle provides an **append-only log** with cryptographic guarantees:

1. **Append-only**: Events can only be added, never modified or removed
2. **Hash-chained**: Each event includes the hash of the previous event
3. **Signed**: Each event is signed by the server's Ed25519 key
4. **Deterministic**: Same input always produces same canonical JSON

This enables players to verify that game events were recorded faithfully and haven't been tampered with after the fact.

## Invariants

These invariants are **non-negotiable**:

| ID | Invariant | Enforcement |
|----|-----------|-------------|
| C1 | Log is append-only | File opened with `O_APPEND`, no truncate/seek |
| C2 | Each entry chains to previous | `prev_hash` must equal prior entry's `event_hash` |
| C3 | Signature covers chain link | Signs `prev_hash\|event_hash`, not raw JSON |
| C4 | Canonical JSON is deterministic | Sorted keys, no whitespace, UTF-8 |
| C5 | Tamper = verification failure | Any modification breaks hash chain or signature |

## Log Format

Each line in the chronicle log:

```
<prev_hash>|<event_hash>|<signature>|<canonical_json>
```

Where:
- `prev_hash`: BLAKE3 hash of previous entry's `event_hash` (or `genesis` for first)
- `event_hash`: BLAKE3 hash of the canonical JSON
- `signature`: Ed25519 signature of `prev_hash|event_hash` (hex)
- `canonical_json`: Event data with sorted keys, no whitespace

Example:
```
genesis|a1b2c3d4...|e5f6a7b8...|{"actor":"player:abc","event_type":"spawn","tick":1}
a1b2c3d4...|f8e9d0c1...|b2a3c4d5...|{"actor":"player:abc","event_type":"move","tick":2}
```

## Usage

### CLI: chronicle_append

```bash
# Append an event (reads JSON from stdin)
echo '{"tick":1,"event_type":"spawn","actor":"player:abc"}' | \
  chronicle_append --log ./chronicle.log --key ./server.key

# Output:
# {"prev_hash":"genesis","event_hash":"...","signature":"...","root":"...","sequence":1}

# Verify integrity
chronicle_append --verify --log ./chronicle.log --key ./server.key

# Output:
# {"valid":true,"entries":42,"root":"...","pubkey":"..."}
```

### Library

```rust
use chronicle::Chronicle;
use serde::Serialize;

#[derive(Serialize)]
struct SpawnEvent {
    tick: u64,
    event_type: &'static str,
    actor: String,
}

let mut chronicle = Chronicle::new_with_generated_key("./chronicle.log")?;

let receipt = chronicle.append(&SpawnEvent {
    tick: 1,
    event_type: "spawn",
    actor: "player:abc".into(),
})?;

println!("Event hash: {}", receipt.event_hash);
println!("Sequence: {}", receipt.sequence);

// Verify integrity
let result = chronicle.verify()?;
assert!(result.valid);
```

## Building

```bash
cd crates/chronicle
cargo build --release

# Binary at: target/release/chronicle_append
```

## Testing

```bash
cargo test
```

## Security Considerations

- **Key storage**: The Ed25519 signing key (`chronicle.key`) must be protected. If compromised, an attacker could forge entries.
- **Clock trust**: Events include server-assigned ticks, not wall-clock time. The server is trusted for ordering.
- **Single writer**: Only the game server should write to the chronicle. Concurrent writers will corrupt the chain.

## Integration with Akalynth Server

The TypeScript server calls `chronicle_append` via `child_process.spawn`:

```typescript
const receipt = await chronicleAppend({
  tick: currentTick,
  event_type: 'spawn',
  actor: playerId,
  payload: { x, y, zone }
});
```

This is mediated by the `chronicleAdapter.ts` module (PR 3).

## Future: Merkle Trees

The current `root` field is simply the latest `event_hash`. In a future version, this will become a proper Merkle tree root, enabling:

- Efficient inclusion proofs
- Partial log verification
- Cross-server root comparison

## License

MIT
