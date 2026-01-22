/**
 * Common adapter utilities
 *
 * Wraps existing verify-*.ts scripts without refactoring them.
 */

import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { VerifyContext, VerifyResult } from '../types.js';

/**
 * Run an existing verify-*.ts script via subprocess
 *
 * @param scriptPath - Relative path from repo root (e.g. "apps/server/tools/verify-heat.ts")
 * @param verifierId - Verifier ID for result
 * @param ctx - Verification context
 * @returns Verifier result
 */
export function runLegacyVerifier(
  scriptPath: string,
  verifierId: string,
  ctx: VerifyContext
): VerifyResult {
  const startedAt = new Date().toISOString();

  const fullPath = path.join(ctx.repoRoot, scriptPath);
  const cwd = ctx.repoRoot;

  const args = ['npx', 'tsx', fullPath];

  // Add common flags
  if (ctx.skipBuild) {
    args.push('--skip-build');
  }
  if (ctx.verbose) {
    args.push('--verbose');
  }

  ctx.log(`[adapter] Running: ${args.join(' ')} (cwd: ${cwd})`);

  const result = spawnSync(args[0], args.slice(1), {
    cwd,
    encoding: 'utf-8',
    stdio: ctx.verbose ? 'inherit' : 'pipe',
    env: ctx.env,
  });

  const finishedAt = new Date().toISOString();

  if (result.status === 0) {
    return {
      ok: true,
      verifierId,
      startedAt,
      finishedAt,
      findings: [],
    };
  } else {
    // Capture failure
    const stderr = result.stderr || '';
    const stdout = result.stdout || '';
    const output = stderr || stdout || 'Unknown error';

    return {
      ok: false,
      verifierId,
      startedAt,
      finishedAt,
      findings: [
        {
          code: 'LEGACY_VERIFIER_FAILED',
          severity: 'error',
          message: `Verifier script failed with exit code ${result.status}`,
          hint: `Run manually: npx tsx ${scriptPath}`,
          data: {
            exitCode: result.status,
            output: output.slice(0, 500), // Truncate for JSON
          },
        },
      ],
    };
  }
}
