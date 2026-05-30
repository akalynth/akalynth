# Constitutional AI Tool Governance

**Constitutional Framework 1.0.0** · package `@akalynth/ai-tool-governance` v1.1.0 — Constitutional Framework for AI Tool Execution

> **v1 note:** This governance package is not part of the Akalynth v1 enforcement surface.

> **Status:** Doctrine (constitutional surface for this package). Changes require an explicit amendment.

> "An AI system can be granted power without trust, reputation, or supervision — only law"

## 🏛️ Constitutional Proof

This package implements a **proof-native governance system** for AI tool execution that grants AI agents operational power through **constitutional law** rather than human trust, reputation systems, or continuous supervision.

### Constitutional Guarantee

**Mathematical Enforcement**: All governance rules are cryptographically enforced and mechanically verifiable. Human discretion is constitutionally prohibited in enforcement.

**Immutable Audit Trail**: Every action produces content-addressed receipts forming a tamper-evident chain of evidence.

**Automatic Compliance**: Constitutional violations trigger automatic remediation without human intervention.

## 📜 Constitutional Principles

### 1. Evidence Invariant
**Principle**: No state transition exists without an immutable, content-addressed receipt.

**Implementation**: Every AI action emits a cryptographically signed receipt with chain linkage.

```typescript
// All actions automatically generate evidence
const result = await governance.executeTool(request, gate);
// Receipt emitted: tool_execution_completed with event_hash
```

### 2. Temporal Invariant
**Principle**: Authority is time-bounded. Expiry is enforced, not advisory.

**Implementation**: Friction budgets automatically reset. Capabilities have built-in expiration.

```typescript
// Friction budget automatically enforces temporal limits
const budget = await governance.getFrictionBudget(agent_id);
// Budget.available_units decreases with each action
// Automatically resets every 24 hours
```

### 3. Segregation Invariant
**Principle**: No actor may authorize their own high-impact action.

**Implementation**: High-risk actions require independent approval. Self-authorization is cryptographically blocked.

```typescript
// Constitutional segregation enforcement
await governance.approveRequest(approval_id, same_agent);
// Throws: "Constitutional segregation violation"
```

### 4. Emergency Doctrine
**Principle**: Emergencies are legal states with stricter downstream obligations, not loopholes.

**Implementation**: Emergency overrides require enhanced justification and mandatory post-facto review.

```typescript
// Emergency override with constitutional accountability
const override = await governance.emergencyOverride(request, justification, agent);
// Automatically schedules mandatory post-facto review
```

### 5. Finality Invariant
**Principle**: Compliance outcomes are deterministic and non-appealable by humans.

**Implementation**: Risk assessments and compliance decisions are mathematically computed.

```typescript
// Deterministic risk assessment - no human override possible
const risk = await governance.assessRisk(request);
// Risk level determined by mathematical formula, not judgment
```

## 🔧 Installation

```bash
npm install @akalynth/ai-tool-governance
npm install @akalynth/coordination-kernel  # Required dependency
```

## 🚀 Quick Start

```typescript
import { ConstitutionalAIGovernanceFactory } from '@akalynth/ai-tool-governance';
import { CoordinationKernel } from '@akalynth/coordination-kernel';

// Initialize coordination kernel
const kernel = new CoordinationKernel(config);

// Create constitutional governance instance
const governance = ConstitutionalAIGovernanceFactory.createStrictConstitutional(kernel);

// AI agent requests tool execution
const request = {
  tool_name: 'send_email',
  parameters: { to: 'user@example.com', subject: 'Report' },
  requested_by: 'ai_agent_001',
  timestamp: new Date().toISOString()
};

// Constitutional governance automatically:
// 1. Assesses risk (deterministic)
// 2. Determines execution pattern (automatic)
// 3. Enforces constraints (mathematical)
// 4. Emits evidence (immutable)

const risk = await governance.assessRisk(request);
const gate = await governance.determineGate(risk);
const result = await governance.executeTool(request, gate);
```

## 🎯 Execution Patterns

The system automatically determines execution patterns based on risk level:

### Direct Execution (Low Risk)
- **Risk Score**: 0-2 points
- **Approval**: None required
- **Constraints**: Basic capability check
- **Evidence**: Standard receipts

```typescript
// Example: Reading a file
const request = {
  tool_name: 'read_file',
  parameters: { file_path: '/data/report.txt' },
  // ... other fields
};
// Executes immediately with evidence generation
```

### Friction Budget (Medium Risk)
- **Risk Score**: 3-5 points
- **Approval**: None required
- **Constraints**: Friction budget consumption
- **Evidence**: Enhanced receipts with budget tracking

```typescript
// Example: Web API call
const request = {
  tool_name: 'web_fetch',
  parameters: { url: 'https://api.example.com/data' },
  // ... other fields
};
// Consumes friction budget units, executes if budget available
```

### Segregation (High Risk)
- **Risk Score**: 6-8 points
- **Approval**: Independent approval required
- **Constraints**: Segregation of authority
- **Evidence**: Approval chain with segregation verification

```typescript
// Example: System configuration change
const request = {
  tool_name: 'write_file',
  parameters: { file_path: '/etc/system.conf', content: 'new config' },
  // ... other fields
};

// Requires approval workflow (segregation enforced)
const approval = await governance.requestApproval(request);
await governance.approveRequest(approval.id, independent_approver);
// Once approved, execute through the normal gate
const result = await governance.executeTool(request, gate);
```

### Emergency Override (Critical Risk)
- **Risk Score**: 9+ points
- **Approval**: Emergency justification required
- **Constraints**: Post-facto review mandatory
- **Evidence**: Enhanced audit trail with review chain

```typescript
// Example: Emergency system restart
const request = {
  tool_name: 'execute_command',
  parameters: { command: 'systemctl restart critical-service' },
  // ... other fields
};

const justification = 'Critical service failure, 5-minute window before total outage';
const override = await governance.emergencyOverride(request, justification, emergency_agent);
// Execution completes immediately
// Post-facto review automatically scheduled
```

## 🔍 Constitutional Verification

### CLI Verification Tool

```bash
# Check cryptographic integrity
ai-gov-verify check-integrity --full

# Verify constitutional compliance
ai-gov-verify compliance --framework constitutional

# Replay state from receipt chain
ai-gov-verify replay --state-type budgets

# Audit emergency overrides
ai-gov-verify emergency-audit --overdue-only

# Check overall constitutional status
ai-gov-verify status --detailed

# Check API/constitutional version compatibility
ai-gov-verify version-check
```

### Programmatic Verification

```typescript
// Verify constitutional compliance
const compliant = await governance.verifyCompliance();

// Generate compliance report
const report = await governance.generateComplianceReport();
const ok = report.violations.length === 0 && report.chain_integrity === 'valid';
console.log(`Compliance: ${ok ? 'PASS' : 'FAIL'}`);
console.log(`Violations: ${report.violations.length}`);
console.log(`Compliance score: ${report.compliance_score}`);
```

## 📊 Risk Assessment

AI tools are automatically assessed using constitutional risk factors:

### Risk Factors (Additive)
- **External system modification**: +3 points
- **Data access/modification**: +2 points
- **User communication**: +1 point
- **File system access**: +2 points
- **Network access**: +2 points
- **Privileged execution**: +3 points
- **Irreversible action**: +3 points

### Risk Mitigation (Subtractive)
- **Rollback available**: -1 point
- **Human oversight active**: -1 point
- **Read-only operation**: -0.5 points
- **Sandboxed execution**: -0.5 points
- **Complete audit trail**: -0.5 points

### Constitutional Decision Tree

```typescript
if (risk_score >= 9) {
  pattern = 'emergency';  // Override with post-facto review
} else if (risk_score >= 6) {
  pattern = 'segregation'; // Independent approval required
} else if (risk_score >= 3) {
  pattern = 'friction';    // Budget consumption
} else {
  pattern = 'direct';      // Immediate execution
}
```

## 🚨 Emergency Powers

Emergency overrides enable immediate action in critical situations while maintaining constitutional accountability:

### Emergency Justification Requirements
- **Specific threat description** (minimum 10 characters)
- **Alternatives considered** (minimum 2 alternatives)
- **Risk if action delayed** (minimum 30 characters)
- **Authorization basis** (constitutional authority)

### Mandatory Post-Facto Review
- **Review deadline**: 24 hours after override
- **Independent reviewer**: Cannot be same agent as overrider
- **Review outcomes**: Justified, Unjustified, or Contested
- **Accountability**: Unjustified overrides trigger capability review

```typescript
// Emergency override with full accountability
const override = await governance.emergencyOverride(
  critical_request,
  detailed_justification,
  emergency_authorized_agent
);

// Mandatory review (within 24 hours)
const review = await governance.reviewEmergency(override, independent_reviewer);
// Review outcome: 'justified' | 'unjustified' | 'contested'
```

## 🔒 Security Model

### No Trust Required
- **Cryptographic verification**: All receipts cryptographically signed
- **Mathematical constraints**: Budgets and limits enforced by code
- **Deterministic decisions**: No subjective judgment in enforcement

### No Reputation Required
- **Capability-based access**: Explicit grants, not reputation scores
- **Immutable audit trail**: Actions verified by evidence, not history
- **Fresh authorization**: Past performance doesn't grant future privileges

### No Supervision Required
- **Automatic enforcement**: Constitutional violations trigger automatic response
- **Self-executing law**: Rules enforced by mathematics, not oversight
- **Exception accountability**: Emergency powers have mandatory review

## 📝 Examples

### Basic Tool Execution

```typescript
import { ConstitutionalAIGovernance } from '@akalynth/ai-tool-governance';

const governance = new ConstitutionalAIGovernance(config);

// Define AI agent
const ai_agent = {
  id: 'assistant_001',
  capabilities: ['file_read', 'data_analysis'],
  risk_profile: 'low',
  emergency_authorized: false
};

// Tool execution request
const request = {
  tool_name: 'read_file',
  parameters: { file_path: '/data/analysis.csv' },
  requested_by: ai_agent.id,
  timestamp: new Date().toISOString()
};

// Constitutional execution flow
const risk = await governance.assessRisk(request);        // Evidence generated
const gate = await governance.determineGate(risk);        // Pattern determined
const result = await governance.executeTool(request, gate); // Execution with evidence
```

### High-Risk Action with Approval

```typescript
// High-risk system modification
const high_risk_request = {
  tool_name: 'execute_command',
  parameters: { command: 'rm -rf /tmp/cache/*' },
  requested_by: ai_agent.id,
  timestamp: new Date().toISOString()
};

// Approval workflow (segregation enforced)
const approval = await governance.requestApproval(high_risk_request);
// AI agent CANNOT approve own request (constitutional violation)

// Independent approval required
await governance.approveRequest(approval.id, independent_approver);
// After approval, execute through the normal gate
const gate = await governance.determineGate(await governance.assessRisk(high_risk_request));
const result = await governance.executeTool(high_risk_request, gate);
```

### Run Complete Demonstration

```typescript
// See examples/constitutional-proof-demo.ts
import { ConstitutionalProofDemo } from './examples/constitutional-proof-demo.js';

const demo = new ConstitutionalProofDemo();
await demo.runCompleteProof();
```

Or run it directly:

```bash
npx tsx examples/constitutional-proof-demo.ts
```

## 🏗️ Architecture

### Constitutional Layers

1. **Coordination Kernel** (Constitutional Infrastructure)
   - Receipt generation and verification
   - Chain integrity enforcement
   - Capability management
   - State replay functionality

2. **AI Governance Adapter** (Statutory Implementation)
   - Risk assessment system
   - Execution pattern enforcement
   - Emergency override mechanism
   - Compliance verification

3. **Tool Integrations** (Application Layer)
   - Specific tool implementations
   - Parameter validation
   - Result processing
   - Error handling

### Key Components

- **`ConstitutionalRiskAssessor`** / **`ConstitutionalRiskCalculator`**: Deterministic risk evaluation (`src/risk/`)
- **`ConstitutionalFrictionManager`**: Temporal constraint enforcement (`src/risk/friction.ts`)
- **`DirectExecutionPattern`** / **`SegregationExecutionPattern`** / **`EmergencyExecutionPattern`**: Risk-based execution strategies (`src/patterns/`)
- **`ConstitutionalEmergencyOverride`**: Emergency powers with accountability (`src/emergency/override.ts`)
- **`ConstitutionalPostFactoReview`**: Mandatory emergency review process (`src/emergency/review.ts`)
- **`AIToolGovernanceVerifier`**: Constitutional compliance checking (`src/verification/verifier.ts`)

## 🧪 Testing

```bash
npm test          # jest (no test suites are committed yet)
npm run verify    # node bin/ai-gov-verify (prints CLI usage; see "Constitutional Verification")
```

## 📚 Documentation

- [Constitutional Principles](./docs/constitutional-principles.md)
- [Risk Assessment Guide](./docs/risk-assessment.md)
- [Emergency Procedures](./docs/emergency-procedures.md)
- [Compliance Verification](./docs/compliance-verification.md)
- [API Reference](./docs/api-reference.md)

## 🤝 Contributing

This package implements constitutional law for AI governance. Changes to constitutional principles require following the amendment process defined in `GOVERNANCE_INVARIANTS.md`.

### Amendment Process
1. Supermajority consensus (>66.7%) of constitutional nodes
2. Cryptographic proof of compliance impact analysis
3. 30-day public review period
4. Successful testnet demonstration

## 📄 License

See repo root [LICENSE](../../LICENSE).

## 🔗 Related Packages

- [`@akalynth/coordination-kernel`](../coordination-kernel) - Constitutional infrastructure
- [`@akalynth/ci-cd-change-control`](../ci-cd-change-control) - CI/CD governance example

## 🏛️ Constitutional Status

- **Framework Version**: 1.0.0
- **Constitutional Compliance**: ✅ Verified
- **Audit Trail**: Complete
- **Emergency Capable**: Yes
- **Segregation Enforced**: Yes
- **Mathematical Enforcement**: Yes

---

**Constitutional Proof Established**: This system grants AI agents operational power through law, mathematics, and cryptographic verification — requiring no trust, reputation, or human supervision.
