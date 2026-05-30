# API Reference (AI Tool Governance)

> **Status:** Reference

Public exports are re-exported from:

- `packages/ai-tool-governance/src/index.ts`

(`index.ts` re-exports `types`, `risk/*`, `emergency/override`, `emergency/review`,
`patterns/direct`, `patterns/segregation`, `verification/verifier`, `ai-governance`,
and `witness/index`.)

## Module constants

- `AI_GOVERNANCE_VERSION` (`'1.1.0'`)
- `CONSTITUTIONAL_COMPLIANT` (`true`)
- `GOVERNANCE_TYPE` (`'ai_tool_execution'`)
- `AI_GOVERNANCE_STATUS` (`'constitutional_compliant'`)
- `AI_GOVERNANCE_CONSTANTS`, `AI_GOVERNANCE_LITMUS` (from `types`)

## Key types (`src/types.ts`)

- `AIAgent`, `ToolExecutionRequest`, `ToolExecutionResult`
- `RiskFactor`, `RiskAssessment`, `FrictionBudget`
- `ExecutionPattern` (`'direct' | 'friction' | 'segregation' | 'emergency'`), `ExecutionGate`
- `ApprovalRequest`, `EmergencyOverride`, `PostFactoReview`
- `AIToolGovernance` (the governance interface)
- `ComplianceViolation`, `ComplianceReport`
- `ToolDefinition`, `ToolRegistry`
- `AIGovernanceError` (error class)

## `AIToolGovernance` interface

Implemented by `ConstitutionalAIGovernance`:

```typescript
assessRisk(request: ToolExecutionRequest): Promise<RiskAssessment>;
determineGate(risk: RiskAssessment): Promise<ExecutionGate>;
executeTool(request: ToolExecutionRequest, gate: ExecutionGate): Promise<ToolExecutionResult>;
emergencyOverride(request: ToolExecutionRequest, justification: string, overriding_agent: AIAgent): Promise<EmergencyOverride>;
reviewEmergency(override: EmergencyOverride, reviewer: AIAgent): Promise<PostFactoReview>;
getFrictionBudget(agent_id: string): Promise<FrictionBudget>;
consumeFriction(agent_id: string, cost: number): Promise<void>;
requestApproval(request: ToolExecutionRequest): Promise<ApprovalRequest>;
approveRequest(approval_id: string, approver: AIAgent): Promise<void>;
verifyCompliance(): Promise<boolean>;
generateComplianceReport(): Promise<ComplianceReport>;
```

## Key classes

- `ConstitutionalAIGovernance` (`src/ai-governance.ts`) — implements `AIToolGovernance`.
- `ConstitutionalAIGovernanceFactory` (`src/ai-governance.ts`) — static factories:
  - `createStrictConstitutional(kernel)`
  - `createDevelopment(kernel)`
  - `createEmergencyCapable(kernel)`
- `ConstitutionalRiskAssessor`, `ConstitutionalRiskCalculator`, `ConstitutionalFrictionManager`,
  `DefaultToolRegistry` (`src/risk/*`)
- `ConstitutionalEmergencyOverride`, `ConstitutionalPostFactoReview` (`src/emergency/*`)
- `DirectExecutionPattern`, `SegregationExecutionPattern` (`src/patterns/*`)
- `AIToolGovernanceVerifier` (`src/verification/verifier.ts`)

> Note: `EmergencyExecutionPattern` (`src/patterns/emergency.ts`) is **not**
> re-exported from `index.ts`. Methods such as `executeWithApproval`
> (`SegregationExecutionPattern`) and `getEmergencyStatistics`
> (`EmergencyExecutionPattern`) live on the pattern classes, not on
> `ConstitutionalAIGovernance`.

## Witness adapter (`src/witness/index.ts`)

Re-exports the AI-governance witness surface, including `AI_GOVERNANCE_RULES`,
`createAIGovernanceRuleRegistry`, `buildGovernanceExplanation`, and the
`AIEventKind` type.

## CLI

The package ships the `ai-gov-verify` CLI (`bin/ai-gov-verify`). Commands:
`check-integrity`, `compliance`, `replay`, `emergency-audit`, `status`,
`version-check`. See [compliance-verification.md](./compliance-verification.md).
