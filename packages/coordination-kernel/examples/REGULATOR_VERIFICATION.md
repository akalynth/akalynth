# How a Regulator Verifies DARP Compliance

This document explains the mathematical verification process for DARP compliance reports. No trust or interpretation required.

## Verification Process

### Step 1: Verify Receipt Chain Integrity

```bash
npm run darp-verify check-integrity receipts.jsonl
```

**What this does:**
1. Loads all receipts from the JSONL file
2. Computes BLAKE3 event_hash for each receipt
3. Verifies each `event_hash`, `signature`, `inputs_hash`, and `outputs_hash`
4. Verifies `prev_hash` links form unbroken chain
5. Confirms genesis receipt has `prev_hash: "genesis"`

**Output interpretation:**
- `VALID`: Chain is cryptographically sound
- `BROKEN`: Tampering detected, cannot verify compliance

**Mathematical guarantee:** If integrity check passes, the receipt chain is tamper-evident and complete.

### Step 2: Replay State from Receipts

```bash
npm run darp-verify replay receipts.jsonl
```

**What this does:**
1. Takes receipts in chronological order
2. Applies each receipt to compliance state using deterministic reducer
3. Reconstructs complete compliance state without external data
4. Outputs final state metrics

**Output interpretation:**
- All numbers derived mathematically from receipts
- No human interpretation or estimation
- Reproducible: same receipts = same state

**Mathematical guarantee:** State reconstruction is 100% deterministic. Same input = same output.

### Step 3: Evaluate Compliance

```bash
npm run darp-verify compliance receipts.jsonl
```

**What this does:**
1. Replays state from receipts
2. Applies DARP regulatory rules to final state
3. Calculates compliance metrics
4. Outputs deterministic PASS/FAIL assessment

**DARP Rules Applied:**
- On-time filing rate: `on_time_reports / total_reports * 100`
- Segregation violations: Count of blocked dual-role actions
- High-risk approvals: Count of required approvals completed
- Overall status: `PASS` if 100% on-time AND zero violations

**Output interpretation:**
- `PASS`: All DARP requirements mathematically satisfied
- `FAIL`: Specific violations with counts and evidence

## Verification Properties

### 1. No Trust Required
- Verification relies only on cryptographic proofs
- No need to trust the organization's claims
- Mathematics guarantees correctness

### 2. Complete Evidence
- Every compliance action has a receipt
- Every receipt contains full context (inputs/outputs)
- Chain integrity proves completeness

### 3. Deterministic Outcome
- Same receipts always produce same compliance assessment
- No subjective interpretation possible
- Regulatory decision becomes mathematical

### 4. Audit Trail Properties
- **Immutable**: Cannot change past receipts without breaking chain
- **Tamper-evident**: Any modification detected by hash verification
- **Complete**: All compliance actions logged with evidence
- **Verifiable**: Full state reconstructable from receipts alone

## Common Verification Scenarios

### Scenario 1: Perfect Compliance
```
✅ Receipt integrity: VALID (1,247 receipts, chain unbroken)
✅ State replay: COMPLETE (100% deterministic)
✅ DARP compliance: PASS (100% on-time filing, 0 violations)
```
**Regulator action:** Accept compliance report.

### Scenario 2: Late Filing Detected
```
✅ Receipt integrity: VALID (1,247 receipts, chain unbroken)
✅ State replay: COMPLETE (100% deterministic)
❌ DARP compliance: FAIL (85% on-time filing rate)
   Late filing rate: 15%
```
**Regulator action:** Issue violation notice with specific evidence.

### Scenario 3: Chain Tampering
```
❌ Receipt integrity: BROKEN
   Hash failures: 3
   Chain breaks: 1
   First error: Hash failure at receipt 1,024
```
**Regulator action:** Reject report entirely, investigate tampering.

### Scenario 4: Segregation Violation
```
✅ Receipt integrity: VALID (1,247 receipts, chain unbroken)
✅ State replay: COMPLETE (100% deterministic)
❌ DARP compliance: FAIL
   Segregation violations: 2 (same actor filed and approved)
```
**Regulator action:** Issue procedural violation with specific receipts.

## Technical Implementation

### Receipt Format
Each receipt contains:
```json
{
  "sequence": 1,
  "timestamp": "2026-01-19T10:30:00.000Z",
  "prev_hash": "genesis",
  "event_hash": "blake3:def456...",
  "signature": "ed25519:...",
  "actor_id": "trader_alice",
  "action": "darp_transaction_reported",
  "inputs": {
    "transaction_id": "tx_001",
    "amount": 2500,
    "risk_score": 3,
    "friction_cost": 10
  },
  "result": "ok",
  "inputs_hash": "blake3:111aaa...",
  "outputs_hash": "blake3:222bbb..."
}
```

### Hash Verification Process
```typescript
// 1. Compute inputs/outputs hashes
const inputsHash = blake3(canonicalize(inputs));
const outputsHash = blake3(canonicalize(result));

// 2. Compute expected event hash (exclude event_hash/signature)
const body = { sequence, timestamp, prev_hash, actor_id, action, inputs, result, inputs_hash: inputsHash, outputs_hash: outputsHash };
const expectedHash = blake3(canonicalize(body));

// 3. Compare with stored hash
const valid = receipt.event_hash === expectedHash;
```

### Chain Verification Process
```typescript
// Verify each receipt links to previous
for (let i = 1; i < receipts.length; i++) {
  const linkValid = receipts[i].prev_hash === receipts[i-1].event_hash;
  if (!linkValid) throw new Error(`Chain break at receipt ${i}`);
}
```

## Regulatory Decision Matrix

| Chain Integrity | Compliance Status | Regulator Action |
|-----------------|-------------------|------------------|
| VALID | PASS | Accept Report |
| VALID | FAIL | Issue Violation |
| BROKEN | ANY | Reject + Investigate |

## Comparison: Traditional vs Mathematical Compliance

### Traditional Compliance Verification
- Regulator reviews narrative reports
- Auditor attestations required
- Sampling-based verification
- Subjective interpretation of rules
- Trust-based assessment

### Mathematical Compliance Verification
- Regulator verifies cryptographic proofs
- No attestations required
- Complete verification of all actions
- Deterministic rule application
- Zero-trust assessment

## Implementation Notes

The verification tools require:
- Node.js 18+
- Receipt file in JSONL format
- No external dependencies beyond cryptographic libraries
- No network access required

All verification runs locally with complete mathematical certainty.

## The Bottom Line

**Question:** "How do we know this compliance report is accurate?"

**Traditional Answer:** "Trust the auditor's professional opinion."

**Mathematical Answer:** "Verify the cryptographic proof."

When compliance becomes mathematical rather than narrative, regulatory confidence increases while verification costs decrease.
