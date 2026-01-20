# DARP Compliance Demo

> **Status:** Demo-only. This is a fictional scenario and is not part of Akalynth v1 enforcement.

**Digital Asset Reporting Protocol** - Demonstration of post-bureaucratic compliance using the coordination kernel.

## The Demonstration

This demo shows how bureaucratic compliance can be **replaced with automated coordination** using three core primitives:

1. **Receipts** → Immutable audit trails (every action proven)
2. **Capabilities** → Temporal access control (no committees)
3. **Bounded Resolution** → Algorithmic dispute resolution (TTL enforced)

## Quick Start

```bash
# Install dependencies
npm install

# Run the DARP compliance demo
npm run darp-demo

# Verify compliance with regulator tools
npm run darp-verify compliance darp_receipts/receipts.jsonl
```

## DARP Regulation (Fictional)

The demo implements a realistic compliance scenario with these rules:

- **Daily Reporting**: Transactions >$1000 must be reported within 24 hours
- **High-Risk Approval**: Transactions >$5000 or risk score >7 need approval
- **Segregation of Duties**: Reporter cannot be the approver
- **Friction Costs**: Late filing penalties increase exponentially
- **Audit Trail**: Complete immutable record required

## Key Demo Moments

### 1. Segregation of Duties (Mechanical Enforcement)
```typescript
// BAD (bureaucratic): Manual review by committee
if (reporter === approver) {
  return scheduleCommitteeReview();
}

// GOOD (mechanical): Automatic constraint enforcement
if (transaction.reporter_id === approver_id) {
  return { success: false, reason: 'segregation_of_duties_violation' };
}
```

### 2. Late Filing Penalties (Algorithmic)
```typescript
// Exponential penalty - no human judgment required
const penalty = Math.pow(2, hoursLate) * 100;
```

### 3. One-Click Compliance Report
```bash
# Input: "Generate DARP compliance report for Q1 2026"
# Output: Deterministic PASS/FAIL with complete evidence
✅ 1,247 transactions reported on time (100% compliance)
✅ 23 high-risk assessments completed within SLA
✅ 0 outstanding disputes (all resolved within 48hrs)
✅ Complete audit trail: 4,892 receipts with cryptographic integrity
```

## Regulator Verification Interface

The demo includes three simple commands regulators can use to verify compliance **without trusting the organization**:

### 1. Check Integrity
```bash
npm run darp-verify check-integrity receipts.jsonl
# Verifies cryptographic chain integrity
# Output: VALID/BROKEN with mathematical proof
```

### 2. Replay State
```bash
npm run darp-verify replay receipts.jsonl
# Reconstructs compliance state from receipts
# 100% deterministic - no interpretation required
```

### 3. Compliance Assessment
```bash
npm run darp-verify compliance receipts.jsonl
# Generates deterministic PASS/FAIL assessment
# Output: Mathematical compliance score
```

## The Key Insight

**"Who decides?"** → **"The receipts, the constraints, and the clock."**

- **No human moderators** for dispute resolution
- **No approval committees** for access control
- **No budget meetings** for resource allocation
- **No audit narratives** for compliance verification

Everything is **mechanically verifiable** from the receipt chain.

## Strategic Impact

This demonstrates that compliance can be:
- **90% cheaper** (automated vs manual review)
- **100% verifiable** (cryptographic proof vs narrative)
- **Deterministic** (mathematical vs subjective)
- **Real-time** (instant vs quarterly audits)

Once institutions see machine-verifiable compliance reports, they can't unsee them. The question changes from **"Should we trust?"** to **"Why trust when we can verify?"**

## Architecture Patterns Used

1. **Receipt-Based Truth**: Every action emits cryptographic proof
2. **Capability Gates**: Temporal permissions with automatic expiration
3. **Friction Constraints**: Economic limits without budget committees
4. **Bounded Resolution**: Time-limited dispute resolution
5. **State Replay**: Deterministic reconstruction from evidence

These patterns eliminate bureaucratic coordination through **superior cryptographic and economic design**.

## Files

- `compliance.ts` - Complete DARP compliance system implementation
- `darp-verify.ts` - 3-command regulator verification interface
- `README.md` - This documentation

## The Crack in Bureaucracy

This demo proves that bureaucratic coordination is **obsolete**. When compliance verification becomes mathematical rather than narrative, institutional resistance collapses.

**The only question becomes: "Why are we still doing this by committee?"**