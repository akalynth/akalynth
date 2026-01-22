/**
 * Verification Spine Types
 *
 * Plugin contract for all verifiers in the Akalynth system.
 * Based on the pattern provided by user feedback.
 */

export type VerifyMode = 'dev' | 'ci' | 'audit';

export type VerifySeverity = 'info' | 'warn' | 'error';

export type VerificationPhase = 0 | 1 | 2 | 3;

export const PHASE_NAMES: Record<VerificationPhase, string> = {
  0: 'Prerequisites',
  1: 'Core Guarantees',
  2: 'Domain Checks',
  3: 'Integration Tests',
};

/**
 * A single finding from a verifier
 */
export interface VerifyFinding {
  /** Stable finding ID (e.g. "RECEIPT_CHAIN_BROKEN") */
  code: string;

  /** Severity level */
  severity: VerifySeverity;

  /** Human-readable message */
  message: string;

  /** Optional hint (how to fix / next command) */
  hint?: string;

  /** Optional structured data */
  data?: Record<string, unknown>;
}

/**
 * Artifact produced by a verifier (report, JSON, etc.)
 */
export interface VerifyArtifact {
  kind: 'json' | 'text' | 'file';
  name: string;
  content?: string;  // for json/text
  path?: string;     // for file artifacts
}

/**
 * Result from running a single verifier
 */
export interface VerifyResult {
  /** Did the verifier pass? */
  ok: boolean;

  /** Verifier ID */
  verifierId: string;

  /** ISO timestamp when started */
  startedAt: string;

  /** ISO timestamp when finished */
  finishedAt: string;

  /** All findings (errors, warnings, info) */
  findings: VerifyFinding[];

  /** Optional artifacts produced */
  artifacts?: VerifyArtifact[];

  /** Optional metrics (e.g. receipt count, duration) */
  metrics?: Record<string, number>;
}

/**
 * Context passed to each verifier
 */
export interface VerifyContext {
  /** Execution mode (dev/ci/audit) */
  mode: VerifyMode;

  /** Current working directory */
  cwd: string;

  /** Repository root (where .git lives) */
  repoRoot: string;

  /** Environment variables */
  env: NodeJS.ProcessEnv;

  /** Output directory for reports/artifacts */
  outDir: string;

  /** Logging function */
  log: (line: string) => void;

  /** Skip build step (for speed) */
  skipBuild: boolean;

  /** Verbose output */
  verbose: boolean;
}

/**
 * Verifier specification (plugin contract)
 */
export interface VerifierSpec {
  /** Unique ID (kebab-case, e.g. "receipt-chain") */
  id: string;

  /** Human-readable title */
  title: string;

  /** Optional description */
  description?: string;

  /** Execution phase (0-3, determines order) */
  phase: VerificationPhase;

  /** IDs of verifiers that must run first */
  dependsOn?: string[];

  /** Is this verifier safe to run in audit mode? (read-only, no mutation) */
  auditSafe?: boolean;

  /** Run the verifier */
  run: (ctx: VerifyContext) => Promise<VerifyResult>;
}

/**
 * Full spine run report
 */
export interface SpineReport {
  /** Did all verifiers pass? */
  ok: boolean;

  /** Mode that was run */
  mode: VerifyMode;

  /** ISO timestamp when started */
  startedAt: string;

  /** ISO timestamp when finished */
  finishedAt: string;

  /** Total duration in milliseconds */
  durationMs: number;

  /** Results from each verifier (in execution order) */
  results: VerifyResult[];

  /** Summary stats */
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
}

/**
 * CLI options
 */
export interface SpineOptions {
  /** Mode (dev/ci/audit) */
  mode: VerifyMode;

  /** Skip build step */
  skipBuild: boolean;

  /** Verbose output */
  verbose: boolean;

  /** Run only specific verifiers (by ID) */
  only?: string[];

  /** Run up to specific phase */
  phase?: VerificationPhase;

  /** Fail fast (stop on first failure) */
  failFast: boolean;

  /** Output format (text/json) */
  format: 'text' | 'json';

  /** Output directory for artifacts */
  outDir: string;

  /** Dry run (show what would run, don't execute) */
  dryRun: boolean;
}
