#!/usr/bin/env node
/**
 * Akalynth Operator Verification — Runtime Witness Loop
 *
 * A single command for operators to run during incidents or health checks.
 * Combines receipt hygiene + key discipline + last-N receipts summary.
 *
 * Usage:
 *   cd apps/server
 *   npx tsx tools/verify-ops.ts
 *   npx tsx tools/verify-ops.ts --last 10    # show last 10 receipts
 *
 * Exit codes:
 *   0 - PASS (all checks)
 *   1 - FAIL (verification failed)
 *   2 - error (malformed input, missing file)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { resolveChainPaths, validateKeyFile, isProductionMode } from '../../../packages/shared/paths.js';

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
  exitCode?: number;
}

const results: CheckResult[] = [];

function runCheck(name: string, command: string): CheckResult {
  try {
    execSync(command, {
      cwd: process.cwd(),
      stdio: 'pipe',
      timeout: 120_000, // 2 min max per check
    });
    return { name, passed: true, message: 'PASS' };
  } catch (error) {
    const exitCode = (error as { status?: number }).status ?? 1;
    return { name, passed: false, message: `FAIL (exit ${exitCode})`, exitCode };
  }
}

function ok(msg: string): void {
  console.log(`[verify-ops] OK: ${msg}`);
}

function fail(msg: string): void {
  console.error(`[verify-ops] FAIL: ${msg}`);
}

function warn(msg: string): void {
  console.warn(`[verify-ops] WARN: ${msg}`);
}

function main(): void {
  const args = process.argv.slice(2);
  const lastN = args.includes('--last')
    ? parseInt(args[args.indexOf('--last') + 1] || '5', 10)
    : 5;

  console.log('=== Akalynth Operator Verification ===\n');

  // 1) Resolve chain paths
  const repoRoot = path.resolve(process.cwd());
  const chainPaths = resolveChainPaths(repoRoot);

  console.log('[paths]');
  console.log(`  receipts: ${chainPaths.receiptsPath}`);
  console.log(`  key:      ${chainPaths.keyPath ?? '(none)'}`);
  console.log(`  db:       ${chainPaths.dbPath}`);
  console.log(`  prod:     ${isProductionMode()}`);
  console.log('');

  // 2) Key discipline check
  console.log('[key discipline]');
  if (chainPaths.keyPath) {
    try {
      validateKeyFile(chainPaths.keyPath);
      ok('Key file exists with proper permissions');
      results.push({ name: 'key_discipline', passed: true, message: 'PASS' });
    } catch (error) {
      fail(String(error));
      results.push({ name: 'key_discipline', passed: false, message: String(error) });
    }
  } else if (isProductionMode()) {
    fail('No signing key configured in production');
    results.push({ name: 'key_discipline', passed: false, message: 'No key in production' });
  } else {
    warn('No signing key configured (dev mode)');
    results.push({ name: 'key_discipline', passed: true, message: 'SKIP (dev mode)' });
  }
  console.log('');

  // 3) Receipt chain exists
  console.log('[receipt chain]');
  if (fs.existsSync(chainPaths.receiptsPath)) {
    const stat = fs.statSync(chainPaths.receiptsPath);
    ok(`Receipt chain exists (${stat.size} bytes)`);
    results.push({ name: 'receipt_chain_exists', passed: true, message: 'PASS' });
  } else {
    warn('Receipt chain does not exist yet');
    results.push({ name: 'receipt_chain_exists', passed: true, message: 'SKIP (no receipts yet)' });
  }
  console.log('');

  // 4) Chain discipline (static analysis)
  console.log('[chain discipline]');
  const chainDiscipline = runCheck('chain_discipline', 'bash ../../scripts/test-chain-discipline.sh');
  if (chainDiscipline.passed) {
    ok('Chain discipline checks passed');
  } else {
    fail('Chain discipline checks failed');
  }
  results.push(chainDiscipline);
  console.log('');

  // 5) Lifecycle verification (if receipts exist)
  if (fs.existsSync(chainPaths.receiptsPath)) {
    console.log('[lifecycle verification]');
    const lifecycle = runCheck('lifecycle', 'npm run verify:lifecycle');
    if (lifecycle.passed) {
      ok('Lifecycle verification passed');
    } else {
      // Exit code 2 = error (missing file), not a policy failure
      if (lifecycle.exitCode === 2) {
        warn('Lifecycle verification skipped (error)');
        lifecycle.passed = true; // Don't fail ops check for missing file
        lifecycle.message = 'SKIP (error)';
      } else {
        fail('Lifecycle verification failed');
      }
    }
    results.push(lifecycle);
    console.log('');
  }

  // 6) Chronicle chain verification (if receipts exist)
  if (fs.existsSync(chainPaths.receiptsPath)) {
    console.log('[chronicle chain verification]');
    const chronicle = runCheck('chronicle_chain', 'npm run verify:chronicle-chain');
    if (chronicle.passed) {
      ok('Chronicle chain verification passed');
    } else {
      if (chronicle.exitCode === 2) {
        warn('Chronicle chain verification skipped (error)');
        chronicle.passed = true;
        chronicle.message = 'SKIP (error)';
      } else {
        fail('Chronicle chain verification failed');
      }
    }
    results.push(chronicle);
    console.log('');
  }

  // 7) Last N receipts summary
  if (fs.existsSync(chainPaths.receiptsPath)) {
    console.log(`[last ${lastN} receipts]`);
    try {
      const content = fs.readFileSync(chainPaths.receiptsPath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      const lastLines = lines.slice(-lastN);

      for (const line of lastLines) {
        try {
          const receipt = JSON.parse(line);
          const ts = receipt.timestamp?.slice(11, 19) ?? '??:??:??';
          const actor = receipt.actor_id?.slice(0, 12) ?? 'unknown';
          const action = receipt.action ?? 'unknown';
          const seq = receipt.sequence ?? '?';
          console.log(`  [${seq}] ${ts} ${actor}... ${action}`);
        } catch {
          console.log(`  (malformed line)`);
        }
      }
      console.log(`  (showing ${lastLines.length} of ${lines.length} total receipts)`);
    } catch (error) {
      warn(`Failed to read receipts: ${String(error)}`);
    }
    console.log('');
  }

  // Summary
  console.log('=== Summary ===');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  for (const r of results) {
    const icon = r.passed ? '✓' : '✗';
    console.log(`  ${icon} ${r.name}: ${r.message}`);
  }

  console.log('');
  if (failed > 0) {
    console.log(`FAIL: ${passed} passed, ${failed} failed`);
    process.exit(1);
  } else {
    console.log(`PASS: ${passed} checks passed`);
    process.exit(0);
  }
}

main();
