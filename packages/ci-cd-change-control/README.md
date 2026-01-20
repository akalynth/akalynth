# CI/CD Change Control Replacement

**Proof-native governance system that eliminates Change Advisory Board (CAB) meetings through mathematical verification.**

## Overview

This system replaces traditional CAB meetings with automated policy evaluation, cryptographic audit trails, and mathematical compliance verification. It implements dual rule-sets for normal and emergency deployments while preserving complete accountability.

## Architecture

### 🏛️ Core Components

- **Policy Engine**: Automated risk scoring and friction calculation
- **Receipt Emitter**: Cryptographic audit trail generation
- **Compliance Verifier**: Mathematical governance rule evaluation
- **Emergency Governance**: Break-glass doctrine with post-facto requirements

### 🔄 Deployment Paths

#### Normal Path
```
deploy_requested → policy_eval → deploy_approved → deploy_completed
```

#### Emergency Path
```
emergency_deploy → policy_eval(override) → incident_linked → retro_review_completed
```

## Usage

### CLI Verification
```bash
# Install dependencies
npm install

# Build the system
npm run build

# Verify receipt chain integrity
./bin/ci-cd-verify check-integrity receipts.jsonl

# Reconstruct deployment state
./bin/ci-cd-verify replay receipts.jsonl

# Evaluate governance compliance
./bin/ci-cd-verify compliance receipts.jsonl
```

### Exit Codes
- `0` = PASS (compliance verified)
- `1` = FAIL (violations detected)
- `2` = ERROR (tool failure)

### Programmatic Usage
```typescript
import { CICDReceiptEmitter } from './dist/receipt-emitter.js';

const emitter = new CICDReceiptEmitter({ receiptDir: './receipts' });

// Normal deployment with automated policy evaluation
const result = await emitter.processDeploymentRequest({
  deployment_id: 'deploy_001',
  artifact_digest: 'sha256:abc123...',
  env: 'prod',
  commit_sha: 'abc123',
  pipeline_run_id: 'run_001',
  service: 'payment-service',
  team: 'payments',
  requested_by: 'alice',
  risk_factors: {
    rollback_available: true,
    automated_tests_passing: true,
  }
});

// Emergency deployment with break-glass doctrine
const emergency = await emitter.processEmergencyDeploy({
  deployment_id: 'emergency_001',
  requester_id: 'ops_lead',
  reason: 'Production outage',
  incident_id: 'inc_001',
});
```

## Key Features

### ✅ Proof-Native Governance
- Every action emits cryptographically verifiable receipts
- JSONL audit trails with SHA-256 integrity verification
- Mathematical compliance checking (no interpretation required)

### ⚡ Emergency Agility
- Break-glass deployments allowed with explicit doctrine
- Post-facto requirements automatically enforced
- Risk assessment preserved even during emergencies

### 🎯 Precise Conviction
- Rule-set switching: Normal vs Emergency governance
- Violations classified against correct doctrine
- "Missing post-facto requirements" not "bypassed process"

### 📊 Automated Policy
- Risk scoring (0-10 scale) based on deployment characteristics
- Friction costs for economic incentive alignment
- Segregation of duties enforcement
- Approval TTL based on risk level

## Governance Rules

### Normal Path Rules
- Production deployments require approval
- Policy evaluation mandatory
- Segregation of duties enforced
- High-risk changes require assessment

### Emergency Path Rules
- `emergency_deploy` receipt allows normal bypass
- Policy evaluation with `override_required=true`
- Incident linking required within 24h
- Retro review required within 72h

## Dependencies

- **coordination-kernel**: Domain-agnostic governance primitives
- **Node.js ≥18**: ESM module support
- **TypeScript**: Source language

## Integration

### GitHub Actions
```yaml
- name: Verify Change Control Compliance
  run: |
    ./bin/ci-cd-verify compliance deployments.jsonl
    echo "Exit code: $?"
```

### Container Integration
Use container image digests as `artifact_digest` for cross-build auditability:
```bash
DIGEST=$(docker inspect $IMAGE --format='{{.RepoDigests}}')
```

## Files Structure

```
ci-cd-change-control/
├── src/
│   ├── policy-engine.ts     # Risk scoring & friction calculation
│   ├── receipt-emitter.ts   # Audit trail generation
│   ├── compliance.ts        # Rule evaluation engine
│   ├── replay.ts           # State reconstruction
│   └── types.ts            # Domain type definitions
├── bin/
│   └── ci-cd-verify        # CLI verification tool
└── dist/                   # Compiled output
```

## Testing

```bash
# Generate test receipts
node simple-test.js

# Verify test scenarios
./bin/ci-cd-verify compliance test-receipts.jsonl
```

---

## Philosophy

**Governance is a property of state, constraints, and time — or it is theater.**

This system proves that superior engineering can render bureaucracy obsolete by encoding the governance principles that CAB meetings attempt to enforce:

- Risk assessment → Automated policy evaluation
- Segregation of duties → Cryptographic role verification
- Emergency procedures → Break-glass doctrine with accountability
- Audit trails → Immutable receipt chains

**CAB meetings become unnecessary when the governance rules are mathematically enforceable.**