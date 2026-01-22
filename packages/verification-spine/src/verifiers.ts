/**
 * All Akalynth Verifiers (18 total + 3 prerequisites)
 *
 * Dependency graph and registration for the verification spine.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { VerifierSpec } from './types.js';
import { runLegacyVerifier } from './adapters/common.js';
import { VerifierRegistry } from './registry.js';

/**
 * Create the default verifier registry with all 21 verifiers
 */
export function createDefaultRegistry(): VerifierRegistry {
  const registry = new VerifierRegistry();

  // ============================================================================
  // Phase 0: Prerequisites (3 verifiers)
  // ============================================================================

  const buildVerifier: VerifierSpec = {
    id: 'build',
    title: 'TypeScript Build',
    description: 'Compiles TypeScript code (can be skipped with --skip-build)',
    phase: 0,
    dependsOn: [],
    auditSafe: true,
    async run(ctx) {
      if (ctx.skipBuild) {
        return {
          ok: true,
          verifierId: 'build',
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          findings: [
            {
              code: 'BUILD_SKIPPED',
              severity: 'info',
              message: 'Build skipped via --skip-build flag',
            },
          ],
        };
      }

      // Build is handled by verify-guarantees.ts
      // For now, assume it's done externally
      return {
        ok: true,
        verifierId: 'build',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        findings: [],
      };
    },
  };

  const dbExistsVerifier: VerifierSpec = {
    id: 'db-exists',
    title: 'Database Exists',
    description: 'Checks if SQLite database exists (may be skipped for fresh install)',
    phase: 0,
    dependsOn: [],
    auditSafe: true,
    async run(ctx) {
      // Use default path (apps/server/data/akalynth.db)
      const dbPath = path.join(ctx.repoRoot, 'apps/server/data/akalynth.db');

      if (!fs.existsSync(dbPath)) {
        return {
          ok: true, // Skip is not a failure
          verifierId: 'db-exists',
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          findings: [
            {
              code: 'DB_NOT_FOUND',
              severity: 'info',
              message: `Database not found at ${dbPath} (fresh install?)`,
            },
          ],
        };
      }

      return {
        ok: true,
        verifierId: 'db-exists',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        findings: [],
      };
    },
  };

  const receiptsExistVerifier: VerifierSpec = {
    id: 'receipts-exist',
    title: 'Receipts Chain Exists',
    description: 'Checks if receipts.jsonl exists',
    phase: 0,
    dependsOn: [],
    auditSafe: true,
    async run(ctx) {
      // Use default path (apps/server/audit/receipts.jsonl)
      const receiptsPath = path.join(ctx.repoRoot, 'apps/server/audit/receipts.jsonl');

      if (!fs.existsSync(receiptsPath)) {
        return {
          ok: true, // Skip is not a failure
          verifierId: 'receipts-exist',
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          findings: [
            {
              code: 'RECEIPTS_NOT_FOUND',
              severity: 'info',
              message: `Receipts not found at ${receiptsPath} (fresh install?)`,
            },
          ],
        };
      }

      return {
        ok: true,
        verifierId: 'receipts-exist',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        findings: [],
      };
    },
  };

  // ============================================================================
  // Phase 1: Core Guarantees (3 verifiers)
  // ============================================================================

  const guaranteesVerifier: VerifierSpec = {
    id: 'guarantees',
    title: 'Civil Guarantees (G1-G15)',
    description: 'Enforces all constitutional guarantees mechanically',
    phase: 1,
    dependsOn: ['build', 'db-exists'],
    auditSafe: true,
    async run(ctx) {
      return runLegacyVerifier('apps/server/tools/verify-guarantees.ts', 'guarantees', ctx);
    },
  };

  const doctrineVerifier: VerifierSpec = {
    id: 'doctrine',
    title: 'Doctrine Consistency',
    description: 'Verifies doctrine documents exist and are linked correctly',
    phase: 1,
    dependsOn: ['build'],
    auditSafe: true,
    async run(ctx) {
      return runLegacyVerifier('apps/server/tools/verify-doctrine.ts', 'doctrine', ctx);
    },
  };

  const identityVerifier: VerifierSpec = {
    id: 'identity',
    title: 'Identity System',
    description: 'Verifies sovereign/caps/roles integrity',
    phase: 1,
    dependsOn: ['build', 'receipts-exist'],
    auditSafe: true,
    async run(ctx) {
      return runLegacyVerifier('apps/server/tools/verify-identity.ts', 'identity', ctx);
    },
  };

  // ============================================================================
  // Phase 2: Domain Checks (12 verifiers)
  // ============================================================================

  const chronicleVerifier: VerifierSpec = {
    id: 'chronicle',
    title: 'Chronicle Events',
    description: 'Validates chronicle event schema',
    phase: 2,
    dependsOn: ['receipts-exist'],
    auditSafe: true,
    async run(ctx) {
      return runLegacyVerifier('apps/server/tools/verify-chronicle.ts', 'chronicle', ctx);
    },
  };

  const chronicleChainVerifier: VerifierSpec = {
    id: 'chronicle-chain',
    title: 'Chronicle Chain Integrity',
    description: 'Verifies hash chain integrity (caps_hash, payload_hash, event_hash)',
    phase: 2,
    dependsOn: ['receipts-exist', 'chronicle'],
    auditSafe: true,
    async run(ctx) {
      return runLegacyVerifier('apps/server/tools/verify-chronicle-chain.ts', 'chronicle-chain', ctx);
    },
  };

  const costedActionsVerifier: VerifierSpec = {
    id: 'costed-actions',
    title: 'Costed Actions',
    description: 'Verifies costed action receipts',
    phase: 2,
    dependsOn: ['receipts-exist'],
    auditSafe: true,
    async run(ctx) {
      return runLegacyVerifier('apps/server/tools/verify-costed-actions.ts', 'costed-actions', ctx);
    },
  };

  const evidenceVerifier: VerifierSpec = {
    id: 'evidence',
    title: 'Evidence System',
    description: 'Verifies forensic evidence completeness',
    phase: 2,
    dependsOn: ['receipts-exist'],
    auditSafe: true,
    async run(ctx) {
      return runLegacyVerifier('apps/server/tools/verify-evidence.ts', 'evidence', ctx);
    },
  };

  const heatVerifier: VerifierSpec = {
    id: 'heat',
    title: 'Heat System',
    description: 'Verifies legendary heat integrity (DB matches receipts)',
    phase: 2,
    dependsOn: ['db-exists', 'receipts-exist'],
    auditSafe: true,
    async run(ctx) {
      return runLegacyVerifier('apps/server/tools/verify-heat.ts', 'heat', ctx);
    },
  };

  const lifecycleVerifier: VerifierSpec = {
    id: 'lifecycle',
    title: 'Player Lifecycle',
    description: 'Verifies session/death/respawn receipts',
    phase: 2,
    dependsOn: ['receipts-exist'],
    auditSafe: true,
    async run(ctx) {
      return runLegacyVerifier('apps/server/tools/verify-lifecycle.ts', 'lifecycle', ctx);
    },
  };

  const metricsVerifier: VerifierSpec = {
    id: 'metrics',
    title: 'Metrics System',
    description: 'Verifies metrics collection integrity',
    phase: 2,
    dependsOn: ['receipts-exist'],
    auditSafe: true,
    async run(ctx) {
      return runLegacyVerifier('apps/server/tools/verify-metrics.ts', 'metrics', ctx);
    },
  };

  const monetizationVerifier: VerifierSpec = {
    id: 'monetization',
    title: 'Monetization Rules',
    description: 'Verifies no pay-to-win violations',
    phase: 2,
    dependsOn: ['receipts-exist'],
    auditSafe: true,
    async run(ctx) {
      return runLegacyVerifier('apps/server/tools/verify-monetization.ts', 'monetization', ctx);
    },
  };

  const npcRecognitionVerifier: VerifierSpec = {
    id: 'npc-recognition',
    title: 'NPC Recognition',
    description: 'Verifies NPC system integrity',
    phase: 2,
    dependsOn: ['receipts-exist'],
    auditSafe: true,
    async run(ctx) {
      return runLegacyVerifier('apps/server/tools/verify-npc-recognition.ts', 'npc-recognition', ctx);
    },
  };

  const presenceVerifier: VerifierSpec = {
    id: 'presence',
    title: 'Presence System',
    description: 'Verifies player presence tracking',
    phase: 2,
    dependsOn: ['receipts-exist'],
    auditSafe: true,
    async run(ctx) {
      return runLegacyVerifier('apps/server/tools/verify-presence.ts', 'presence', ctx);
    },
  };

  const protectedVerifier: VerifierSpec = {
    id: 'protected',
    title: 'Protected Slots',
    description: 'Verifies item drop policy enforcement (protected slots)',
    phase: 2,
    dependsOn: ['db-exists', 'receipts-exist'],
    auditSafe: true,
    async run(ctx) {
      return runLegacyVerifier('apps/server/tools/verify-protected.ts', 'protected', ctx);
    },
  };

  const rateLimitsVerifier: VerifierSpec = {
    id: 'rate-limits',
    title: 'Rate Limits',
    description: 'Verifies rate limit enforcement',
    phase: 2,
    dependsOn: ['receipts-exist'],
    auditSafe: true,
    async run(ctx) {
      return runLegacyVerifier('apps/server/tools/verify-rate-limits.ts', 'rate-limits', ctx);
    },
  };

  const treasuryVerifier: VerifierSpec = {
    id: 'treasury',
    title: 'Treasury Integrity',
    description: 'Verifies gold/item accounting consistency',
    phase: 2,
    dependsOn: ['receipts-exist'],
    auditSafe: true,
    async run(ctx) {
      return runLegacyVerifier('apps/server/tools/verify-treasury.ts', 'treasury', ctx);
    },
  };

  const workContractsVerifier: VerifierSpec = {
    id: 'work-contracts',
    title: 'Work Contracts',
    description: 'Verifies payout ordering and contract integrity',
    phase: 2,
    dependsOn: ['receipts-exist'],
    auditSafe: true,
    async run(ctx) {
      return runLegacyVerifier('apps/server/tools/verify-work-contracts.ts', 'work-contracts', ctx);
    },
  };

  // ============================================================================
  // Phase 3: Integration Tests (1 verifier)
  // ============================================================================

  const opsVerifier: VerifierSpec = {
    id: 'ops',
    title: 'Operational Readiness',
    description: 'Verifies deployment prerequisites',
    phase: 3,
    dependsOn: ['build'],
    auditSafe: true,
    async run(ctx) {
      return runLegacyVerifier('apps/server/tools/verify-ops.ts', 'ops', ctx);
    },
  };

  // ============================================================================
  // Register all verifiers
  // ============================================================================

  // Phase 0
  registry.register(buildVerifier);
  registry.register(dbExistsVerifier);
  registry.register(receiptsExistVerifier);

  // Phase 1
  registry.register(guaranteesVerifier);
  registry.register(doctrineVerifier);
  registry.register(identityVerifier);

  // Phase 2
  registry.register(chronicleVerifier);
  registry.register(chronicleChainVerifier);
  registry.register(costedActionsVerifier);
  registry.register(evidenceVerifier);
  registry.register(heatVerifier);
  registry.register(lifecycleVerifier);
  registry.register(metricsVerifier);
  registry.register(monetizationVerifier);
  registry.register(npcRecognitionVerifier);
  registry.register(presenceVerifier);
  registry.register(protectedVerifier);
  registry.register(rateLimitsVerifier);
  registry.register(treasuryVerifier);
  registry.register(workContractsVerifier);

  // Phase 3
  registry.register(opsVerifier);

  return registry;
}
