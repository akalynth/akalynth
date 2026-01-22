/**
 * Spine Report Formatting
 *
 * Converts SpineReport to human-readable text or machine-readable JSON.
 */

import { SpineReport, VerifyResult, PHASE_NAMES } from './types.js';

/**
 * Format report as human-readable text
 */
export function formatTextReport(report: SpineReport): string {
  const lines: string[] = [];

  // Header
  lines.push('╔══════════════════════════════════════════════════════════════╗');
  lines.push('║           AKALYNTH VERIFICATION SPINE v1                     ║');
  lines.push('╚══════════════════════════════════════════════════════════════╝');
  lines.push('');

  // Group results by phase
  const byPhase = new Map<number, VerifyResult[]>();
  for (const result of report.results) {
    // Find phase from verifier metadata (need to pass this through)
    // For now, just show all results in order
    const phase = 0; // TODO: pass phase through result
    if (!byPhase.has(phase)) {
      byPhase.set(phase, []);
    }
    byPhase.get(phase)!.push(result);
  }

  // Show results grouped by phase
  for (const result of report.results) {
    const status = result.ok ? '✅ PASS' : '❌ FAIL';
    const duration = computeDuration(result);
    lines.push(`  ${status}  ${result.verifierId.padEnd(30)}  (${duration})`);

    // Show findings for failures
    if (!result.ok && result.findings.length > 0) {
      for (const finding of result.findings) {
        lines.push(`      └─ ${finding.message}`);
        if (finding.hint) {
          lines.push(`      └─ Fix: ${finding.hint}`);
        }
      }
    }
  }

  lines.push('');
  lines.push('════════════════════════════════════════════════════════════════');

  // Final result
  const resultIcon = report.ok ? '✅ PASSED' : '❌ FAILED';
  const summary = `${report.summary.passed}/${report.summary.total} verifiers passed`;
  lines.push(`RESULT: ${resultIcon} (${summary})`);
  lines.push('════════════════════════════════════════════════════════════════');

  // Next steps if failed
  if (!report.ok) {
    lines.push('');
    lines.push('Next steps:');
    lines.push('  1. Review failures above');
    lines.push('  2. Fix issues');
    lines.push('  3. Re-run: npm run verify');
  }

  return lines.join('\n');
}

/**
 * Format report as JSON
 */
export function formatJsonReport(report: SpineReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Compute duration string from result
 */
function computeDuration(result: VerifyResult): string {
  const start = new Date(result.startedAt).getTime();
  const end = new Date(result.finishedAt).getTime();
  const durationMs = end - start;

  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  const durationS = (durationMs / 1000).toFixed(1);
  return `${durationS}s`;
}
