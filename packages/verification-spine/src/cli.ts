/**
 * Verification Spine CLI
 *
 * Entry point for `npm run verify` and `akalynth-verify` command.
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import { VerifyContext, VerifyMode, SpineOptions, BundleFS } from './types.js';
import { createDefaultRegistry } from './verifiers.js';
import { runSpine } from './runner.js';
import { formatTextReport, formatJsonReport } from './reporter.js';
import { isProfileName } from './profiles.js';
import { LocalFS, DirBundleFS } from './fs/index.js';

/**
 * Parse CLI arguments
 */
function parseArgs(args: string[]): SpineOptions {
  const opts: SpineOptions = {
    mode: 'dev',
    skipBuild: false,
    verbose: false,
    profile: undefined,
    only: undefined,
    phase: undefined,
    failFast: true, // Default to fail-fast
    format: 'text',
    outDir: './verify-out',
    dryRun: false,
    bundle: undefined,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--mode':
        opts.mode = args[++i] as VerifyMode;
        break;
      case '--skip-build':
        opts.skipBuild = true;
        break;
      case '--verbose':
        opts.verbose = true;
        break;
      case '--profile': {
        const val = args[++i];
        if (!val) {
          console.error('Error: --profile requires a value: quick | full | audit');
          process.exit(3);
        }
        if (!isProfileName(val)) {
          console.error(`Error: Unknown profile "${val}". Valid: quick, full, audit`);
          process.exit(3);
        }
        opts.profile = val;
        break;
      }
      case '--only':
        opts.only = args[++i].split(',');
        break;
      case '--phase':
        opts.phase = parseInt(args[++i], 10) as 0 | 1 | 2 | 3;
        break;
      case '--no-fail-fast':
        opts.failFast = false;
        break;
      case '--format':
        opts.format = args[++i] as 'text' | 'json';
        break;
      case '--out':
        opts.outDir = args[++i];
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--bundle':
        opts.bundle = args[++i];
        break;
      case '--help':
        printHelp();
        process.exit(0);
      default:
        console.error(`Unknown argument: ${arg}`);
        process.exit(3); // Invalid usage
    }
  }

  // Validate: --bundle requires --mode audit
  if (opts.bundle && opts.mode !== 'audit') {
    console.error('[spine] ERROR: --bundle requires --mode audit');
    console.error('[spine] Bundle verification is only permitted in audit mode for safety.');
    process.exit(3);
  }

  return opts;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
Akalynth Verification Spine v1

Usage:
  npm run verify [options]
  akalynth-verify [options]

Options:
  --mode <dev|ci|audit>   Execution mode (default: dev)
  --profile <quick|full|audit>  Named profile (default: full)
  --skip-build            Skip TypeScript build (faster)
  --verbose               Show verbose output
  --only <id,id>          Run only specific verifiers (overrides profile)
  --phase <0-3>           Run up to specific phase
  --no-fail-fast          Continue on failure (don't stop at first fail)
  --format <text|json>    Output format (default: text)
  --out <dir>             Output directory for artifacts (default: ./verify-out)
  --dry-run               Show what would run, don't execute
  --bundle <dir>          Verify from audit bundle (requires --mode audit)
  --help                  Show this help message

Profiles:
  quick   Fast check: Prerequisites + Core Guarantees (Phase 0-1)
  full    All verifiers (Phase 0-3) [default]
  audit   Read-only verifiers only (auditSafe=true)

Examples:
  npm run verify                          # Run all verifiers (full profile)
  npm run verify:quick                    # Run quick profile
  npm run verify -- --profile audit       # Run audit profile
  npm run verify -- --skip-build          # Skip build step
  npm run verify -- --only guarantees     # Run only guarantees verifier
  npm run verify -- --phase 1             # Run phases 0-1 only
  npm run verify -- --mode ci --format json  # CI mode with JSON output
  npm run verify -- --dry-run             # Show execution plan
  npm run verify -- --mode audit --bundle ./audit-bundle  # Verify from bundle

Verifier Phases:
  0: Prerequisites (build, db-exists, receipts-exist)
  1: Core Guarantees (guarantees, doctrine, identity)
  2: Domain Checks (heat, treasury, chronicle, etc.)
  3: Integration Tests (ops)

Exit Codes:
  0: All verifiers passed
  1: One or more verifiers failed
  2: Infrastructure error
  3: Invalid usage
  `);
}

/**
 * Main CLI entry point
 */
export async function main(argv: string[]): Promise<void> {
  const args = argv.slice(2); // Remove node and script path
  const opts = parseArgs(args);

  // Determine root and filesystem mode
  let repoRoot: string;
  let bundleFs: BundleFS;

  if (opts.bundle) {
    // Bundle mode: use provided bundle directory
    const bundlePath = path.resolve(process.cwd(), opts.bundle);
    if (!fs.existsSync(bundlePath)) {
      console.error(`[spine] ERROR: Bundle directory not found: ${bundlePath}`);
      process.exit(2);
    }
    repoRoot = bundlePath;
    bundleFs = new DirBundleFS(bundlePath);
  } else {
    // Repo mode: find .git directory
    repoRoot = process.cwd();
    while (!fs.existsSync(path.join(repoRoot, '.git'))) {
      const parent = path.dirname(repoRoot);
      if (parent === repoRoot) {
        console.error('[spine] ERROR: Could not find repository root (.git directory)');
        process.exit(2);
      }
      repoRoot = parent;
    }
    bundleFs = new LocalFS(repoRoot);
  }

  // Create output directory
  const outDir = path.resolve(repoRoot, opts.outDir);
  fs.mkdirSync(outDir, { recursive: true });

  // Create context
  const ctx: VerifyContext = {
    mode: opts.mode,
    cwd: process.cwd(),
    repoRoot,
    env: process.env,
    outDir,
    log: (line: string) => {
      if (opts.verbose || opts.dryRun) {
        console.log(line);
      }
    },
    skipBuild: opts.skipBuild,
    verbose: opts.verbose,
    fs: bundleFs,
  };

  // Create registry and run spine
  const registry = createDefaultRegistry();

  console.log('[spine] Akalynth Verification Spine v1');
  console.log(`[spine] Mode: ${opts.mode}`);
  if (opts.bundle) {
    console.log(`[spine] Bundle mode: ${opts.bundle}`);
  }
  console.log(`[spine] Root: ${repoRoot}`);
  console.log(`[spine] Output directory: ${outDir}`);
  console.log('');

  const report = await runSpine(registry, ctx, opts);

  // Write JSON report to outDir
  const jsonReportPath = path.join(outDir, 'verification-report.json');
  fs.writeFileSync(jsonReportPath, formatJsonReport(report), 'utf-8');

  // Output report
  if (opts.format === 'json') {
    console.log(formatJsonReport(report));
  } else {
    console.log(formatTextReport(report));
  }

  // Exit with appropriate code
  process.exit(report.ok ? 0 : 1);
}
