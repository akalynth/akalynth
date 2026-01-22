/**
 * Protocol Drift Verifier
 *
 * Detects and blocks semantic drift in the protocol surface.
 * Enforces:
 * - No accidental breaking changes
 * - Breaking changes require major version bump + acknowledgement
 * - Non-breaking changes require minor version bump
 * - Golden snapshot must be updated on any drift
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { VerifierSpec, VerifyContext, VerifyResult, VerifyFinding } from '../types.js';
import { extractProtocolSurface, generateGoldenSnapshot, type GoldenSnapshot, type ProtocolSurface } from '../protocol/extractor.js';
import { diffProtocolSurface, getChangeKey, type Change } from '../protocol/differ.js';

const PROTOCOL_PATH = 'packages/shared/protocol.ts';
const GOLDEN_PATH = 'packages/shared/protocol.golden.json';
const ACK_PATH = 'packages/shared/protocol.breaking.json';

interface BreakingAck {
  version: string;
  changes: Array<{
    kind: string;
    message?: string;
    field?: string;
    [key: string]: unknown;
  }>;
  migrationNotes?: string;
}

/**
 * Protocol Drift Verifier Spec
 */
export const protocolDriftVerifier: VerifierSpec = {
  id: 'protocol-drift',
  title: 'Protocol Drift Detection',
  description: 'Detects semantic drift in protocol.ts and enforces versioning discipline',
  phase: 1,
  dependsOn: ['build'],
  auditSafe: true,

  async run(ctx: VerifyContext): Promise<VerifyResult> {
    const startedAt = new Date().toISOString();
    const findings: VerifyFinding[] = [];

    const protocolAbsPath = path.join(ctx.repoRoot, PROTOCOL_PATH);
    const goldenAbsPath = path.join(ctx.repoRoot, GOLDEN_PATH);
    const ackAbsPath = path.join(ctx.repoRoot, ACK_PATH);

    // Find tsconfig.json
    const tsconfigPath = findTsConfig(ctx.repoRoot);
    if (!tsconfigPath) {
      findings.push({
        code: 'PROTOCOL_TSCONFIG_NOT_FOUND',
        severity: 'error',
        message: 'tsconfig.json not found in repository',
        hint: 'Ensure tsconfig.json exists at repo root or packages/shared/',
      });
      return {
        ok: false,
        verifierId: 'protocol-drift',
        startedAt,
        finishedAt: new Date().toISOString(),
        findings,
      };
    }

    // Extract current protocol surface
    let currentSurface: ProtocolSurface;
    try {
      currentSurface = extractProtocolSurface(protocolAbsPath, tsconfigPath);
    } catch (err: any) {
      findings.push({
        code: 'PROTOCOL_PARSE_FAILED',
        severity: 'error',
        message: `Failed to extract protocol surface: ${err.message}`,
        hint: 'Check that protocol.ts is valid TypeScript',
        data: { error: err.stack },
      });
      return {
        ok: false,
        verifierId: 'protocol-drift',
        startedAt,
        finishedAt: new Date().toISOString(),
        findings,
      };
    }

    // Load golden snapshot
    if (!fs.existsSync(goldenAbsPath)) {
      findings.push({
        code: 'PROTOCOL_GOLDEN_MISSING',
        severity: 'error',
        message: 'Golden snapshot not found',
        hint: 'Generate initial golden: npm run protocol:golden',
      });
      return {
        ok: false,
        verifierId: 'protocol-drift',
        startedAt,
        finishedAt: new Date().toISOString(),
        findings,
      };
    }

    let golden: GoldenSnapshot;
    try {
      golden = JSON.parse(fs.readFileSync(goldenAbsPath, 'utf-8'));
    } catch (err: any) {
      findings.push({
        code: 'PROTOCOL_GOLDEN_INVALID',
        severity: 'error',
        message: 'Golden snapshot is invalid JSON',
        hint: 'Regenerate golden: npm run protocol:golden',
      });
      return {
        ok: false,
        verifierId: 'protocol-drift',
        startedAt,
        finishedAt: new Date().toISOString(),
        findings,
      };
    }

    // Compare surfaces
    const driftReport = diffProtocolSurface(golden.surface, currentSurface);

    if (driftReport.changes.length === 0) {
      // No drift - pass
      findings.push({
        code: 'PROTOCOL_NO_DRIFT',
        severity: 'info',
        message: 'Protocol surface unchanged',
      });
      return {
        ok: true,
        verifierId: 'protocol-drift',
        startedAt,
        finishedAt: new Date().toISOString(),
        findings,
      };
    }

    // Drift detected - enforce versioning policy
    const currentVersion = currentSurface.version;
    const goldenVersion = golden.version;

    if (driftReport.hasReadonlyOnly) {
      // Readonly-only drift: golden update required, no version bump
      findings.push({
        code: 'PROTOCOL_GOLDEN_OUTDATED',
        severity: 'error',
        message: 'Golden snapshot outdated (readonly-only changes)',
        hint: 'Regenerate golden: npm run protocol:golden',
        data: { changes: driftReport.changes.length },
      });
      return {
        ok: false,
        verifierId: 'protocol-drift',
        startedAt,
        finishedAt: new Date().toISOString(),
        findings,
      };
    }

    if (driftReport.hasBreaking) {
      // Breaking drift: major version bump + ack + golden update
      const versionBumpCorrect = isMajorBump(goldenVersion, currentVersion);

      if (!versionBumpCorrect) {
        findings.push({
          code: 'PROTOCOL_VERSION_BUMP_INCORRECT',
          severity: 'error',
          message: `Breaking drift requires major version bump (${goldenVersion} → ${currentVersion})`,
          hint: `Update PROTOCOL_VERSION to next major version (e.g., ${getNextMajor(goldenVersion)})`,
        });
      }

      // Check for acknowledgement
      if (!fs.existsSync(ackAbsPath)) {
        findings.push({
          code: 'PROTOCOL_ACK_FILE_MISSING',
          severity: 'error',
          message: 'Breaking changes require acknowledgement file',
          hint: `Create ${ACK_PATH} with version ${currentVersion} and list of changes`,
        });
      } else {
        // Validate acknowledgement
        let ack: BreakingAck;
        try {
          ack = JSON.parse(fs.readFileSync(ackAbsPath, 'utf-8'));
        } catch {
          findings.push({
            code: 'PROTOCOL_ACK_INVALID',
            severity: 'error',
            message: 'Acknowledgement file is invalid JSON',
          });
          return {
            ok: false,
            verifierId: 'protocol-drift',
            startedAt,
            finishedAt: new Date().toISOString(),
            findings,
          };
        }

        if (ack.version !== currentVersion) {
          findings.push({
            code: 'PROTOCOL_ACK_VERSION_MISMATCH',
            severity: 'error',
            message: `Acknowledgement version (${ack.version}) does not match PROTOCOL_VERSION (${currentVersion})`,
          });
        }

        // Check coverage
        const breakingChanges = driftReport.changes.filter(c => c.breaking);
        const breakingKeys = new Set(breakingChanges.map(getChangeKey));
        const ackKeys = new Set(ack.changes.map(c => `${c.kind}:${c.message || c.field || ''}`));

        const uncovered = breakingChanges.filter(c => !ackKeys.has(getChangeKey(c)));
        if (uncovered.length > 0) {
          findings.push({
            code: 'PROTOCOL_DRIFT_BREAKING_UNACKNOWLEDGED',
            severity: 'error',
            message: `${uncovered.length} breaking changes not acknowledged`,
            hint: 'Update protocol.breaking.json to cover all breaking changes',
            data: { uncovered: uncovered.map(c => getChangeKey(c)) },
          });
        }
      }

      // Check golden update
      if (golden.surface.version === currentVersion) {
        findings.push({
          code: 'PROTOCOL_GOLDEN_OUTDATED',
          severity: 'error',
          message: 'Golden snapshot must be updated',
          hint: 'Regenerate golden: npm run protocol:golden',
        });
      }

      return {
        ok: findings.filter(f => f.severity === 'error').length === 0,
        verifierId: 'protocol-drift',
        startedAt,
        finishedAt: new Date().toISOString(),
        findings,
      };
    }

    if (driftReport.hasNonBreaking) {
      // Non-breaking drift: minor version bump + golden update
      const versionBumpCorrect = isMinorOrMajorBump(goldenVersion, currentVersion);

      if (!versionBumpCorrect) {
        findings.push({
          code: 'PROTOCOL_VERSION_BUMP_INCORRECT',
          severity: 'error',
          message: `Non-breaking drift requires minor or major version bump (${goldenVersion} → ${currentVersion})`,
          hint: `Update PROTOCOL_VERSION to next minor version (e.g., ${getNextMinor(goldenVersion)})`,
        });
      }

      // Check golden update
      if (golden.surface.version === currentVersion) {
        findings.push({
          code: 'PROTOCOL_GOLDEN_OUTDATED',
          severity: 'error',
          message: 'Golden snapshot must be updated',
          hint: 'Regenerate golden: npm run protocol:golden',
        });
      }

      return {
        ok: findings.filter(f => f.severity === 'error').length === 0,
        verifierId: 'protocol-drift',
        startedAt,
        finishedAt: new Date().toISOString(),
        findings,
      };
    }

    // Should not reach here
    return {
      ok: true,
      verifierId: 'protocol-drift',
      startedAt,
      finishedAt: new Date().toISOString(),
      findings,
    };
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

function findTsConfig(repoRoot: string): string | null {
  const candidates = [
    path.join(repoRoot, 'tsconfig.json'),
    path.join(repoRoot, 'packages/shared/tsconfig.json'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function parseVersion(version: string): [number, number, number] | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

function isMajorBump(from: string, to: string): boolean {
  const f = parseVersion(from);
  const t = parseVersion(to);
  if (!f || !t) return false;
  return t[0] > f[0];
}

function isMinorOrMajorBump(from: string, to: string): boolean {
  const f = parseVersion(from);
  const t = parseVersion(to);
  if (!f || !t) return false;
  return t[0] > f[0] || t[1] > f[1];
}

function getNextMajor(version: string): string {
  const parsed = parseVersion(version);
  if (!parsed) return version;
  return `${parsed[0] + 1}.0.0`;
}

function getNextMinor(version: string): string {
  const parsed = parseVersion(version);
  if (!parsed) return version;
  return `${parsed[0]}.${parsed[1] + 1}.0`;
}
