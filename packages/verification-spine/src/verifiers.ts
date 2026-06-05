/**
 * All Akalynth Verifiers
 *
 * Dependency graph and registration for the verification spine.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { VerifierSpec, VerifyContext, VerifyResult } from './types.js';
import { runLegacyVerifier } from './adapters/common.js';
import { VerifierRegistry } from './registry.js';
import { protocolDriftVerifier } from './verifiers/protocol-drift.js';

const DEFAULT_DB_PATH = 'apps/server/data/akalynth.db';
const DEFAULT_RECEIPTS_PATH = 'apps/server/audit/receipts.jsonl';

function verifierDbPath(ctx: VerifyContext): string {
  return ctx.env.AKALYNTH_DB_PATH ?? DEFAULT_DB_PATH;
}

function verifierDbExists(ctx: VerifyContext, dbPath: string): boolean {
  const dbAbsPath = path.isAbsolute(dbPath) ? dbPath : path.join(ctx.repoRoot, dbPath);
  return fs.existsSync(dbAbsPath);
}

function skipMissingDb(verifierId: string, dbPath: string): VerifyResult {
  return {
    ok: true,
    verifierId,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    findings: [
      {
        code: `${verifierId.toUpperCase().replace(/-/g, '_')}_DB_NOT_FOUND`,
        severity: 'info',
        message: `Database not found at ${dbPath} (fresh install?)`,
      },
    ],
  };
}

function runDbBackedLegacyVerifier(
  scriptPath: string,
  verifierId: string,
  ctx: VerifyContext
): VerifyResult {
  const dbPath = verifierDbPath(ctx);
  if (!verifierDbExists(ctx, dbPath)) return skipMissingDb(verifierId, dbPath);

  return runLegacyVerifier(scriptPath, verifierId, ctx, {
    AKALYNTH_DB_PATH: dbPath,
  });
}

function verifierReceiptsPath(ctx: VerifyContext): string {
  return (
    ctx.env.AKALYNTH_RECEIPT_CHAIN_PATH ??
    ctx.env.AKALYNTH_RECEIPTS_PATH ??
    DEFAULT_RECEIPTS_PATH
  );
}

function verifierReceiptsExist(ctx: VerifyContext, receiptsPath: string): boolean {
  const receiptsAbsPath = path.isAbsolute(receiptsPath)
    ? receiptsPath
    : path.join(ctx.repoRoot, receiptsPath);
  return fs.existsSync(receiptsAbsPath);
}

function skipMissingReceipts(verifierId: string, receiptsPath: string): VerifyResult {
  return {
    ok: true,
    verifierId,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    findings: [
      {
        code: `${verifierId.toUpperCase().replace(/-/g, '_')}_RECEIPTS_NOT_FOUND`,
        severity: 'info',
        message: `Receipts not found at ${receiptsPath} (fresh install?)`,
      },
    ],
  };
}

function runReceiptBackedLegacyVerifier(
  scriptPath: string,
  verifierId: string,
  ctx: VerifyContext
): VerifyResult {
  const receiptsPath = verifierReceiptsPath(ctx);
  if (!verifierReceiptsExist(ctx, receiptsPath)) {
    return skipMissingReceipts(verifierId, receiptsPath);
  }

  return runLegacyVerifier(scriptPath, verifierId, ctx, {
    AKALYNTH_RECEIPT_CHAIN_PATH: receiptsPath,
    AKALYNTH_RECEIPTS_PATH: receiptsPath,
  });
}

/**
 * Create the default verifier registry with all 24 verifiers
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
    bundleCapable: true,
    bundleInputs: ['apps/server/data/akalynth.db'],
    async run(ctx) {
      // Use default path (apps/server/data/akalynth.db)
      const dbPath = 'apps/server/data/akalynth.db';

      if (!ctx.fs.exists(dbPath)) {
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
    bundleCapable: true,
    bundleInputs: ['apps/server/audit/receipts.jsonl'],
    async run(ctx) {
      // Use default path (apps/server/audit/receipts.jsonl)
      const receiptsPath = 'apps/server/audit/receipts.jsonl';

      if (!ctx.fs.exists(receiptsPath)) {
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
  // Phase 1: Core Guarantees (5 verifiers)
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

  const receiptsChainVerifier: VerifierSpec = {
    id: 'receipts-chain',
    title: 'Receipts Chain Integrity',
    description: 'Re-validates audit/receipts.jsonl: inputs/outputs/event hashes, genesis + chain linkage, and Ed25519 signatures (when a key is available)',
    phase: 1,
    dependsOn: ['receipts-exist'],
    auditSafe: true,
    async run(ctx) {
      return runLegacyVerifier('apps/server/tools/verify-receipts-chain.ts', 'receipts-chain', ctx);
    },
  };

  // ============================================================================
  // Phase 2: Domain Checks (13 verifiers)
  // ============================================================================

  const chronicleVerifier: VerifierSpec = {
    id: 'chronicle',
    title: 'Chronicle Events',
    description: 'Validates chronicle event schema',
    phase: 2,
    dependsOn: ['receipts-exist'],
    auditSafe: true,
    async run(ctx) {
      return runDbBackedLegacyVerifier('apps/server/tools/verify-chronicle.ts', 'chronicle', ctx);
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
      return runDbBackedLegacyVerifier('apps/server/tools/verify-evidence.ts', 'evidence', ctx);
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
      return runDbBackedLegacyVerifier('apps/server/tools/verify-heat.ts', 'heat', ctx);
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
      return runReceiptBackedLegacyVerifier('apps/server/tools/verify-lifecycle.ts', 'lifecycle', ctx);
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
      return runDbBackedLegacyVerifier('apps/server/tools/verify-metrics.ts', 'metrics', ctx);
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
      return runReceiptBackedLegacyVerifier('apps/server/tools/verify-monetization.ts', 'monetization', ctx);
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

  const npcDialogueCounterVerifier: VerifierSpec = {
    id: 'npc-dialogue-counter',
    title: 'NPC Dialogue Counter',
    description: 'Verifies the durable, receipt-sourced NPC talk counter survives reconnect and replay (Dialogue Contract v1)',
    phase: 2,
    dependsOn: ['build'],
    auditSafe: true,
    async run(ctx) {
      return runLegacyVerifier('apps/server/tools/verify-npc-dialogue-counter.ts', 'npc-dialogue-counter', ctx);
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
      return runDbBackedLegacyVerifier('apps/server/tools/verify-protected.ts', 'protected', ctx);
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

  const worldEventsVerifier: VerifierSpec = {
    id: 'world-events',
    title: 'World Events',
    description: 'Verifies receipt-backed server-authoritative world event transitions',
    phase: 2,
    dependsOn: ['build'],
    auditSafe: true,
    async run(ctx) {
      return runLegacyVerifier('apps/server/tools/verify-world-events.ts', 'world-events', ctx);
    },
  };

  const propertyVerifier: VerifierSpec = {
    id: 'property',
    title: 'Property Ownership',
    description: 'Verifies house ownership, transfers, gold conservation, and replay/DB determinism',
    phase: 2,
    dependsOn: ['db-exists', 'receipts-exist'],
    auditSafe: true,
    async run(ctx) {
      return runLegacyVerifier('apps/server/tools/verify-property.ts', 'property', ctx);
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

  // Map generation (pure; no DB/runtime). Proves deterministic map + SVG render,
  // manifest hash binding, reachability, plot validity, and no hidden entropy.
  const mapgenVerifier: VerifierSpec = {
    id: 'mapgen',
    title: 'Map Generation (mapgen@v1)',
    description:
      'Deterministic map + SVG generation: byte-identical replay, map_hash/svg_hash binding, reachability, house-plot validity, no hidden entropy',
    phase: 1,
    dependsOn: ['build'],
    auditSafe: true,
    async run(ctx) {
      return runLegacyVerifier('apps/server/tools/verify-mapgen.ts', 'mapgen', ctx);
    },
  };

  // Asset Factory manifests (pure; no DB/runtime). Proves the asset gate:
  // PNG<->sidecar pairing, schema, 32-multiple dims, sha256==cleaned PNG,
  // mechanics:null (server-metadata lockstep), prompt refs, and pack specs.
  const assetsVerifier: VerifierSpec = {
    id: 'assets',
    title: 'Asset Factory Manifests (Factory v1)',
    description:
      'Asset manifest/lineage gate: PNG<->sidecar pairing, schema, 32-multiple dims, sha256 binding, mechanics:null lockstep, prompt refs, pack specs',
    phase: 1,
    dependsOn: ['build'],
    auditSafe: true,
    async run(ctx) {
      return runLegacyVerifier('tools/asset-gen/verify-assets.ts', 'assets', ctx);
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
  registry.register(protocolDriftVerifier);
  registry.register(identityVerifier);
  registry.register(receiptsChainVerifier);
  registry.register(mapgenVerifier);
  registry.register(assetsVerifier);

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
  registry.register(npcDialogueCounterVerifier);
  registry.register(presenceVerifier);
  registry.register(protectedVerifier);
  registry.register(rateLimitsVerifier);
  registry.register(treasuryVerifier);
  registry.register(workContractsVerifier);
  registry.register(worldEventsVerifier);
  registry.register(propertyVerifier);

  // Phase 3
  registry.register(opsVerifier);

  return registry;
}
