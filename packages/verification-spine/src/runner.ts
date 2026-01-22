/**
 * Verification Spine Runner
 *
 * Orchestrates verifier execution in dependency order with fail-closed semantics.
 */

import { VerifyContext, VerifyResult, SpineReport, SpineOptions, VerifyFinding } from './types.js';
import { VerifierRegistry } from './registry.js';

/**
 * Run the verification spine
 *
 * @param registry - Verifier registry
 * @param ctx - Execution context
 * @param opts - Run options
 * @returns Spine report with all results
 */
export async function runSpine(
  registry: VerifierRegistry,
  ctx: VerifyContext,
  opts: SpineOptions
): Promise<SpineReport> {
  const startedAt = new Date().toISOString();

  // Resolve execution order (includes dependency resolution)
  let ordered;
  try {
    ordered = registry.resolveOrder(opts.only);
  } catch (err) {
    // Dependency cycle or unknown verifier
    return {
      ok: false,
      mode: opts.mode,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: 0,
      results: [],
      summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
    };
  }

  // Filter by phase if requested
  if (opts.phase !== undefined) {
    ordered = ordered.filter((spec) => spec.phase <= opts.phase!);
  }

  const results: VerifyResult[] = [];
  let globalOk = true;

  for (const spec of ordered) {
    // Check if verifier is audit-safe
    if (opts.mode === 'audit' && spec.auditSafe === false) {
      const result: VerifyResult = {
        ok: false,
        verifierId: spec.id,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        findings: [
          {
            code: 'AUDIT_UNSAFE_VERIFIER',
            severity: 'error',
            message: `Verifier "${spec.id}" is not audit-safe and cannot run in audit mode.`,
            hint: `Run without audit mode or mark verifier auditSafe=true after ensuring it is read-only.`,
          },
        ],
      };
      results.push(result);
      globalOk = false;

      if (opts.failFast) break;
      continue;
    }

    // Dry run: just show what would execute
    if (opts.dryRun) {
      ctx.log(`[dry-run] Would execute: ${spec.id} (${spec.title})`);
      continue;
    }

    // Execute verifier
    ctx.log(`[spine] Running verifier: ${spec.id} (${spec.title})`);

    let result: VerifyResult;
    try {
      result = await spec.run(ctx);
    } catch (err: any) {
      // Unexpected error (not caught by verifier)
      result = {
        ok: false,
        verifierId: spec.id,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        findings: [
          {
            code: 'VERIFIER_CRASH',
            severity: 'error',
            message: `Verifier crashed: ${err.message}`,
            data: { stack: err.stack },
          },
        ],
      };
    }

    results.push(result);

    if (!result.ok) {
      globalOk = false;

      // Fail-fast mode: stop on first failure
      if (opts.failFast) {
        ctx.log(`[spine] Verifier ${spec.id} failed. Stopping (fail-fast mode).`);
        break;
      }
    }
  }

  const finishedAt = new Date().toISOString();
  const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();

  // Compute summary
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  const skipped = 0; // TODO: handle skipped verifiers

  return {
    ok: globalOk,
    mode: opts.mode,
    startedAt,
    finishedAt,
    durationMs,
    results,
    summary: {
      total: results.length,
      passed,
      failed,
      skipped,
    },
  };
}

/**
 * Create a skipped result (for verifiers that can't run due to missing deps)
 */
export function createSkippedResult(
  verifierId: string,
  reason: string
): VerifyResult {
  return {
    ok: true, // Skipped is not a failure
    verifierId,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    findings: [
      {
        code: 'VERIFIER_SKIPPED',
        severity: 'info',
        message: reason,
      },
    ],
  };
}
