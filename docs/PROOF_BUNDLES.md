# Proof Bundles

A **Proof Bundle** is a portable, immutable, self-contained packet that proves what happened and why. It can be exported, shared, stored, and verified independently of the system that created it.

## Core Properties

### Immutable
Once created, a bundle is never modified. Any change produces a different content hash.

### Self-Contained
All evidence is inline. No external lookups required to verify the bundle.

### Verifiable
The `contentHash` covers all bundle data. Tampering is detectable.

### Versioned
Schema version enables forward compatibility. Parsers can handle older formats.

### Exportable
Multiple formats: canonical JSON (machine), pretty JSON (debug), text (human), Markdown (share).

## Bundle Structure

```kotlin
data class ProofBundle(
    val metadata: BundleMetadata,      // Who, when, why
    val identifiers: BundleIdentifiers, // All IDs for correlation
    val event: ChronicleEvent,          // What happened
    val receipt: Receipt?,              // Authority (if confirmed)
    val explanation: Explanation,       // Why it happened
    val snapshotEvidence: SnapshotEvidence?, // State before/after
    val snapshotDiff: SnapshotDiff?,    // What changed
    val integrity: BundleIntegrity      // Hash, algorithm, chain
)
```

## Components

### BundleMetadata

```kotlin
data class BundleMetadata(
    val version: Int,           // Schema version (currently 1)
    val createdAtMs: Long,      // Creation timestamp
    val createdBy: String,      // Who created this bundle
    val bundleType: BundleType, // Classification
    val label: String?          // Optional human label
)
```

**Bundle Types:**
- `DEATH_PROOF` — Death with killer, items lost
- `DROP_PROOF` — Item drop with reason chain
- `PICKUP_PROOF` — Item acquisition with ownership
- `COMBAT_PROOF` — Combat kill with damage chain
- `ZONE_TRANSITION_PROOF` — Zone entry/exit
- `EVENT_PROOF` — Generic event

### BundleIdentifiers

```kotlin
data class BundleIdentifiers(
    val bundleId: String,       // Unique bundle ID
    val eventId: String,        // Chronicle event being proven
    val actionId: String?,      // Correlated action (if any)
    val receiptId: String?,     // Server receipt (if confirmed)
    val playerId: String,       // Player this relates to
    val sessionId: String?,     // Session ID (if available)
    val sequence: Long?         // Snapshot sequence (if available)
)
```

### BundleIntegrity

```kotlin
data class BundleIntegrity(
    val contentHash: String,     // SHA-256 of canonical content
    val algorithm: String,       // "SHA-256"
    val receiptChainHash: String?, // Chain hash at creation time
    val signature: String?,      // External signature (optional)
    val merkleRoot: String?      // Merkle root (if part of tree)
)
```

## Creating Bundles

### From Components

```kotlin
val bundle = ProofBundleBuilder.build(
    event = chronicleEvent,
    explanation = explanation,
    receipt = serverReceipt,
    snapshotEvidence = evidence,
    snapshotDiff = diff,
    playerId = "player_123",
    sessionId = "session_456",
    label = "My death in Azura",
    receiptChainHash = currentChainHash
)
```

### From TimelineEntry

```kotlin
val bundle = ProofBundleBuilder.fromTimelineEntry(
    entry = timelineEntry,
    playerId = "player_123",
    label = "Optional label"
)
```

## Exporting Bundles

### Canonical JSON (Machine-Verifiable)

```kotlin
val json = bundle.toCanonicalJson()
// Sorted keys, no whitespace, deterministic
// This is what the content hash covers
```

### Pretty JSON (Human-Readable)

```kotlin
val json = bundle.toPrettyJson()
// Indented, readable
```

### Plain Text

```kotlin
val text = bundle.toText()
```

Output:
```
═══════════════════════════════════════════════════════════════
  PROOF BUNDLE: DEATH_PROOF
═══════════════════════════════════════════════════════════════

Bundle ID:    bundle_rcpt_789_1700000000000
Event ID:     evt_123
Player:       player_1
Created:      2023-11-14T22:13:20.000Z
Version:      1

─── EVENT ───────────────────────────────────────────────────────
Kind:         ☠ DEATH
Status:       CONFIRMED
Timestamp:    2023-11-14T22:13:20.000Z
Zone:         Azura
Position:     (32, 32)

─── RECEIPT ─────────────────────────────────────────────────────
Receipt ID:   rcpt_789
Type:         death
Timestamp:    2023-11-14T22:13:20.000Z

─── EXPLANATION ─────────────────────────────────────────────────
Decision:     CONFIRMED
Reason:       Death by Goblin caused equipment drop
Rules:        DEATH_DROP_POLICY, PROTECTED_SLOT_POLICY

─── STATE EVIDENCE ──────────────────────────────────────────────
Transition:   99 → 100
Items lost:   sword_1, shield_1

─── INTEGRITY ───────────────────────────────────────────────────
Hash:         a1b2c3d4e5f6...
Algorithm:    SHA-256

═══════════════════════════════════════════════════════════════
```

### Markdown

```kotlin
val md = bundle.toMarkdown()
// Formatted with headers, tables, collapsible JSON
```

## Verification

### Content Hash

The content hash is computed from a canonical representation:
1. All fields are sorted alphabetically
2. Null values are explicit
3. No extra whitespace
4. Deterministic output

To verify:
```kotlin
val recomputed = BundleIntegrity.computeHash(canonicalContent)
assert(recomputed == bundle.integrity.contentHash)
```

### Chain Binding

If `receiptChainHash` is present, it binds this bundle to the receipt chain at creation time. External systems can verify the chain hasn't been rewritten.

### Signature (Optional)

If `signature` is present, it provides external attestation (e.g., from VaultMesh). The signature covers the content hash.

## Use Cases

### Dispute Resolution

Player: "I shouldn't have lost my sword!"

System: Exports proof bundle showing:
- Death event (confirmed by receipt)
- Explanation citing DEATH_DROP_POLICY
- Snapshot evidence showing sword removal
- Diff showing exactly what changed

### Audit Compliance

Regulator: "Show me this decision was legitimate."

System: Exports proof bundle with:
- The event in question
- All rules that applied
- Evidence references
- Cryptographic integrity

### Sharing/Storage

Player wants to save proof of an epic moment:
```kotlin
val bundle = ProofBundleBuilder.fromTimelineEntry(entry, playerId)
val json = bundle.toCanonicalJson()
// Save to file, share with friends, post online
```

### External Verification

Third party receives a bundle and verifies:
1. Parse JSON
2. Recompute content hash
3. Verify it matches `integrity.contentHash`
4. Optionally verify signature against known key

## Best Practices

### Always Include Receipt

If the event is confirmed, include the receipt. This provides authoritative backing.

### Compute Diffs

Include `snapshotDiff` when available. It makes bundles human-readable without parsing snapshot data.

### Use Labels

Labels help users find bundles later. "My first PvP kill" is more useful than "bundle_12345".

### Preserve Chain Hash

When creating bundles, include the current receipt chain hash. This enables later verification that the chain wasn't modified.

## Integration with VaultMesh

Proof bundles are designed to integrate with VaultMesh:

- `receiptChainHash` maps to VaultMesh chain commitments
- `signature` can hold VaultMesh attestations
- `merkleRoot` enables inclusion proofs
- Canonical JSON format is compatible with VaultMesh parsing

## Summary

Proof bundles are the portable form of truth. They:
- Prove what happened (event + receipt)
- Explain why (rules + reasoning)
- Show what changed (diffs)
- Enable verification (hash + signature)
- Stand alone (self-contained)

When a proof bundle leaves the system, the truth goes with it.
