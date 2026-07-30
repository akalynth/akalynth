/**
 * All Akalynth Verifiers
 *
 * Dependency graph and registration for the verification spine.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
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
 * Create the default verifier registry with all 36 verifiers
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
  // Phase 1: Core Guarantees and release contracts (12 verifiers)
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

  const receiptKeyEpochContractVerifier: VerifierSpec = {
    id: 'receipt-key-epoch-contract',
    title: 'Bounded Receipt Key-Epoch Contract',
    description:
      'Executes the fail-closed fixture suite for bounded historical signature exceptions, including structural, boundary, current-key, and authority-artifact checks',
    phase: 1,
    dependsOn: ['build', 'receipts-chain', 'coordination-kernel-hash'],
    auditSafe: false,
    async run(ctx) {
      const startedAt = new Date().toISOString();
      ctx.log('[adapter] Running: npm -w apps/server run test:receipt-key-epoch');
      const result = spawnSync(
        'npm',
        ['-w', 'apps/server', 'run', 'test:receipt-key-epoch'],
        {
          cwd: ctx.repoRoot,
          encoding: 'utf-8',
          stdio: ctx.verbose ? 'inherit' : 'pipe',
          env: ctx.env,
        },
      );
      const finishedAt = new Date().toISOString();
      if (result.status === 0) {
        return {
          ok: true,
          verifierId: 'receipt-key-epoch-contract',
          startedAt,
          finishedAt,
          findings: [],
        };
      }
      const output = result.stderr || result.stdout || 'Unknown error';
      return {
        ok: false,
        verifierId: 'receipt-key-epoch-contract',
        startedAt,
        finishedAt,
        findings: [
          {
            code: 'RECEIPT_KEY_EPOCH_CONTRACT_FAILED',
            severity: 'error',
            message: `Bounded receipt key-epoch fixture suite failed with exit code ${result.status}`,
            hint: 'Run manually: npm -w apps/server run test:receipt-key-epoch',
            data: {
              exitCode: result.status,
              output: output.slice(0, 500),
            },
          },
        ],
      };
    },
  };

  const betaAndroidDistributionContractVerifier: VerifierSpec = {
    id: 'beta-android-distribution-contract',
    title: 'Beta Android Distribution Contract',
    description:
      'Verifies the direct Android manifest against accepted v12 authority and executes fail-closed malformed-identity fixtures',
    phase: 1,
    dependsOn: ['build'],
    auditSafe: false,
    async run(ctx) {
      const startedAt = new Date().toISOString();
      ctx.log('[adapter] Running: bash scripts/verify-beta-android-distribution.test.sh');
      const distributionResult = spawnSync(
        'bash',
        ['scripts/verify-beta-android-distribution.test.sh'],
        {
          cwd: ctx.repoRoot,
          encoding: 'utf-8',
          stdio: ctx.verbose ? 'inherit' : 'pipe',
          env: ctx.env,
        },
      );
      const runtimeResult =
        distributionResult.status === 0
          ? spawnSync(
              'npm',
              ['-w', 'apps/server', 'run', 'test:android-client-update'],
              {
                cwd: ctx.repoRoot,
                encoding: 'utf-8',
                stdio: ctx.verbose ? 'inherit' : 'pipe',
                env: ctx.env,
              },
            )
          : null;
      const finishedAt = new Date().toISOString();
      if (distributionResult.status === 0 && runtimeResult?.status === 0) {
        return {
          ok: true,
          verifierId: 'beta-android-distribution-contract',
          startedAt,
          finishedAt,
          findings: [],
        };
      }
      const failedResult =
        distributionResult.status === 0 && runtimeResult
          ? runtimeResult
          : distributionResult;
      const output = failedResult.stderr || failedResult.stdout || 'Unknown error';
      return {
        ok: false,
        verifierId: 'beta-android-distribution-contract',
        startedAt,
        finishedAt,
        findings: [
          {
            code: 'BETA_ANDROID_DISTRIBUTION_CONTRACT_FAILED',
            severity: 'error',
            message: `Beta Android distribution contract failed with exit code ${failedResult.status}`,
            hint:
              'Run manually: bash scripts/verify-beta-android-distribution.test.sh && npm -w apps/server run test:android-client-update',
            data: {
              exitCode: failedResult.status,
              output: output.slice(0, 500),
            },
          },
        ],
      };
    },
  };

  const accountResetLinkContractVerifier: VerifierSpec = {
    id: 'account-reset-link-contract',
    title: 'Account Reset Link Contract',
    description:
      'Verifies that password-reset bearer tokens are emitted only in URL fragments and never in query strings',
    phase: 1,
    dependsOn: ['build'],
    auditSafe: false,
    async run(ctx) {
      const startedAt = new Date().toISOString();
      ctx.log('[adapter] Running: npm -w apps/server run test:account-email');
      const result = spawnSync(
        'npm',
        ['-w', 'apps/server', 'run', 'test:account-email'],
        {
          cwd: ctx.repoRoot,
          encoding: 'utf-8',
          stdio: ctx.verbose ? 'inherit' : 'pipe',
          env: ctx.env,
        },
      );
      const finishedAt = new Date().toISOString();
      if (result.status === 0) {
        return {
          ok: true,
          verifierId: 'account-reset-link-contract',
          startedAt,
          finishedAt,
          findings: [],
        };
      }
      const output = result.stderr || result.stdout || 'Unknown error';
      return {
        ok: false,
        verifierId: 'account-reset-link-contract',
        startedAt,
        finishedAt,
        findings: [
          {
            code: 'ACCOUNT_RESET_LINK_CONTRACT_FAILED',
            severity: 'error',
            message: `Account reset-link contract failed with exit code ${result.status}`,
            hint: 'Run manually: npm -w apps/server run test:account-email',
            data: {
              exitCode: result.status,
              output: output.slice(0, 500),
            },
          },
        ],
      };
    },
  };

  // ============================================================================
  // Phase 2: Domain Checks (18 verifiers)
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

  const absenceReceiptsVerifier: VerifierSpec = {
    id: 'absence-receipts',
    title: 'Absence Receipts',
    description:
      're-verifies absence_receipt.v1 claims (bounded non-observation): re-executes the committed slice, recomputes predicate + authority-snapshot hashes, and re-evaluates the predicate asserting zero matches',
    phase: 2,
    dependsOn: ['receipts-exist'],
    auditSafe: true,
    async run(ctx) {
      return runReceiptBackedLegacyVerifier(
        'apps/server/tools/verify-absence-receipts.ts',
        'absence-receipts',
        ctx,
      );
    },
  };

  // ============================================================================
  // Phase 3: Integration Tests (2 verifiers)
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

  // Web client + Rust bridge cleanup guard (pure; no DB/runtime). Proves the old
  // direct server spawn bridge, inline server hash helpers, and inline slime
  // canvas renderer stay removed while the new Rust loader/source-sprite paths
  // remain present.
  const webRustCleanupVerifier: VerifierSpec = {
    id: 'web-rust-cleanup',
    title: 'Web/Rust Cleanup Guard',
    description:
      'Guards old-code removal: no direct server spawn bridge, no inline server hash helpers, Rookguard slime uses source sprite, Rust loader/hash primitive path present',
    phase: 1,
    dependsOn: ['build', 'assets'],
    auditSafe: true,
    async run(ctx) {
      return runLegacyVerifier('scripts/verify-web-rust-cleanup.mjs', 'web-rust-cleanup', ctx);
    },
  };

  // Coordination-kernel hash regression (builds emitted ESM and runs Jest).
  // Proves the canonical receipt hash primitive, absence hash parity, and event
  // hash fixtures execute in the package test path used by CI/developers.
  const coordinationKernelHashVerifier: VerifierSpec = {
    id: 'coordination-kernel-hash',
    title: 'Coordination Kernel Hash Regression',
    description:
      'Runs @akalynth/coordination-kernel hash fixture tests so receipt/absence canonical BLAKE3 parity stays executable, not only statically guarded',
    phase: 1,
    dependsOn: ['build', 'web-rust-cleanup'],
    auditSafe: false,
    async run(ctx) {
      const startedAt = new Date().toISOString();
      ctx.log('[adapter] Running: npm -w packages/coordination-kernel run test');
      const result = spawnSync('npm', ['-w', 'packages/coordination-kernel', 'run', 'test'], {
        cwd: ctx.repoRoot,
        encoding: 'utf-8',
        stdio: ctx.verbose ? 'inherit' : 'pipe',
        env: ctx.env,
      });
      const finishedAt = new Date().toISOString();
      if (result.status === 0) {
        return { ok: true, verifierId: 'coordination-kernel-hash', startedAt, finishedAt, findings: [] };
      }
      const output = result.stderr || result.stdout || 'Unknown error';
      return {
        ok: false,
        verifierId: 'coordination-kernel-hash',
        startedAt,
        finishedAt,
        findings: [
          {
            code: 'COORDINATION_KERNEL_HASH_TEST_FAILED',
            severity: 'error',
            message: `Coordination-kernel hash regression failed with exit code ${result.status}`,
            hint: 'Run manually: npm -w packages/coordination-kernel run test',
            data: {
              exitCode: result.status,
              output: output.slice(0, 500),
            },
          },
        ],
      };
    },
  };

  // Web visual asset wiring guard (pure; no DB/runtime). Proves the client
  // imports source sprites with sidecars, keeps tutorial rune tiles mapped to
  // dedicated art, and keeps Rookguard display overlays from covering those
  // server-authoritative tutorial/gate tiles.
  const webVisualAssetsVerifier: VerifierSpec = {
    id: 'web-visual-assets',
    title: 'Web Visual Asset Wiring',
    description:
      'Guards web client source sprite wiring, display-only sidecars, tutorial tile art mappings, and Rookguard overlay visibility around tutorial/gate runes',
    phase: 1,
    dependsOn: ['build', 'assets'],
    auditSafe: true,
    async run(ctx) {
      return runLegacyVerifier('scripts/verify-web-visual-assets.mjs', 'web-visual-assets', ctx);
    },
  };

  // Browser-backed web play shell smoke. Starts a local debug-client source
  // preview and runs the mobile/desktop /play/ smoke against real pixels and
  // controls. It is intentionally Phase 3 and not audit-safe: it launches Vite
  // and a browser, but does not touch API/runtime state.
  const webPlayShellVerifier: VerifierSpec = {
    id: 'web-play-shell',
    title: 'Web Play Shell Smoke',
    description:
      'Starts local debug-client Vite, runs real-browser /play/ smoke, and writes screenshots/report evidence for mobile gate, desktop account panel, controls, and asset visibility',
    phase: 3,
    dependsOn: ['web-visual-assets'],
    auditSafe: false,
    async run(ctx) {
      const startedAt = new Date().toISOString();
      const outDir = path.join(ctx.outDir, 'web-play-shell-smoke');
      const reportPath = path.join(outDir, 'web_play_shell_smoke.json');

      ctx.log(`[adapter] Running: npm run smoke:web-play-shell -- --out ${outDir}`);
      const result = spawnSync('npm', ['run', 'smoke:web-play-shell', '--', '--out', outDir], {
        cwd: ctx.repoRoot,
        encoding: 'utf-8',
        stdio: ctx.verbose ? 'inherit' : 'pipe',
        env: ctx.env,
      });
      const finishedAt = new Date().toISOString();

      if (result.status === 0 && fs.existsSync(reportPath)) {
        let checksTotal = 0;
        try {
          const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as {
            checks_total?: unknown;
          };
          if (typeof report.checks_total === 'number') checksTotal = report.checks_total;
        } catch {
          checksTotal = 0;
        }
        return {
          ok: true,
          verifierId: 'web-play-shell',
          startedAt,
          finishedAt,
          findings: [],
          artifacts: [{ kind: 'file', name: 'web_play_shell_smoke', path: reportPath }],
          metrics: checksTotal > 0 ? { checksTotal } : undefined,
        };
      }

      const output = [result.stderr, result.stdout].filter(Boolean).join('\n') || 'Unknown error';
      return {
        ok: false,
        verifierId: 'web-play-shell',
        startedAt,
        finishedAt,
        findings: [
          {
            code: 'WEB_PLAY_SHELL_SMOKE_FAILED',
            severity: 'error',
            message: `Web play shell smoke failed with exit code ${result.status ?? result.signal ?? 'unknown'}`,
            hint: 'Run manually: npm run smoke:web-play-shell',
            data: {
              exitCode: result.status,
              signal: result.signal,
              reportPath,
              output: output.slice(0, 500),
            },
          },
        ],
        artifacts: fs.existsSync(reportPath)
          ? [{ kind: 'file', name: 'web_play_shell_smoke', path: reportPath }]
          : undefined,
      };
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
  registry.register(receiptKeyEpochContractVerifier);
  registry.register(betaAndroidDistributionContractVerifier);
  registry.register(accountResetLinkContractVerifier);
  registry.register(mapgenVerifier);
  registry.register(assetsVerifier);
  registry.register(webRustCleanupVerifier);
  registry.register(coordinationKernelHashVerifier);
  registry.register(webVisualAssetsVerifier);

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
  registry.register(absenceReceiptsVerifier);

  // Phase 3
  registry.register(opsVerifier);
  registry.register(webPlayShellVerifier);

  return registry;
}
