#!/usr/bin/env npx tsx
/**
 * phase_gate.ts - Civil Guarantees PreToolUse Hook
 *
 * Enforces write discipline before Edit/Write operations land.
 * Runs as a Claude Code PreToolUse hook.
 *
 * Exit codes:
 *   0 - Allow operation
 *   2 - Block operation (message to stderr)
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ============================================================================
// Types
// ============================================================================

interface HookInput {
  session_id: string;
  cwd: string;
  tool_name: string;
  tool_input: {
    file_path?: string;
    path?: string;
    content?: string;
    old_string?: string;
    new_string?: string;
  };
}

type FileCategory = 'forbidden' | 'high_risk' | 'verify_tool' | 'normal';

interface Classification {
  category: FileCategory;
  reason: string;
}

// ============================================================================
// File Classification Patterns
// ============================================================================

// FORBIDDEN: Hard block - these paths should never be written by Claude
const FORBIDDEN_PATTERNS: RegExp[] = [
  /^server\/data\//,                    // SQLite DB files
  /^server\/audit\/receipts\.jsonl$/,   // Append-only audit log
  /\.env$/,                             // Environment files
  /\.env\./,                            // .env.local, .env.production, etc.
  /credentials/i,                       // Any credentials file
  /secrets/i,                           // Any secrets file
  /\.pem$/,                             // Private keys
  /\.key$/,                             // Private keys
];

// HIGH-RISK: Require verify:quick before allowing write
const HIGH_RISK_PATTERNS: Array<{ pattern: RegExp; guarantee: string }> = [
  { pattern: /^server\/src\/persist\//, guarantee: 'G4 Idempotence / G5 Rebuildable / G7 Exclusivity' },
  { pattern: /drop-policy\.ts$/, guarantee: 'G6 Drop Math / G8 Loot Priority' },
  { pattern: /combat\.ts$/, guarantee: 'G9 PvP Heat / G10 Combat Resolution' },
  { pattern: /death\.ts$/, guarantee: 'G11 Death Penalty' },
  { pattern: /heat\.ts$/, guarantee: 'G12 Legendary Heat' },
  { pattern: /witness\.ts$/, guarantee: 'G12 Legendary Heat (witness)' },
  { pattern: /^shared\/protocol\.ts$/, guarantee: 'Protocol API Surface' },
  { pattern: /^shared\/types\.ts$/, guarantee: 'Core Domain Types' },
];

// VERIFY_TOOL: Block destructive changes to verification infrastructure
const VERIFY_TOOL_PATTERN = /^server\/tools\/verify-.*\.ts$/;

// ============================================================================
// Verification Cache
// ============================================================================

// Cache verification results to avoid running verify on every edit in a burst
let lastVerifyResult: { timestamp: number; passed: boolean } | null = null;
const VERIFY_CACHE_TTL_MS = 30000; // 30 seconds

function shouldRunVerify(): boolean {
  if (!lastVerifyResult) return true;
  if (Date.now() - lastVerifyResult.timestamp > VERIFY_CACHE_TTL_MS) return true;
  return !lastVerifyResult.passed; // Re-run if previous failed
}

// ============================================================================
// Helper Functions
// ============================================================================

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

function normalizePath(filePath: string): string {
  // Remove leading ./ or absolute path prefix to get relative path
  let normalized = filePath
    .replace(/^\.\//, '')
    .replace(/^\/.*\/akalynth\//, '');

  // Handle absolute paths by extracting relative portion
  if (path.isAbsolute(normalized)) {
    const akalynthIndex = normalized.indexOf('/akalynth/');
    if (akalynthIndex !== -1) {
      normalized = normalized.substring(akalynthIndex + '/akalynth/'.length);
    }
  }

  return normalized;
}

function classifyFile(filePath: string): Classification {
  const normalized = normalizePath(filePath);

  // Check forbidden first (highest priority)
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(normalized)) {
      return { category: 'forbidden', reason: `Protected path: ${normalized}` };
    }
  }

  // Check verify tools
  if (VERIFY_TOOL_PATTERN.test(normalized)) {
    return { category: 'verify_tool', reason: 'Verification infrastructure' };
  }

  // Check high-risk
  for (const { pattern, guarantee } of HIGH_RISK_PATTERNS) {
    if (pattern.test(normalized)) {
      return { category: 'high_risk', reason: guarantee };
    }
  }

  return { category: 'normal', reason: '' };
}

function getFileSize(filePath: string, cwd: string): number {
  try {
    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(cwd, filePath);
    const stats = fs.statSync(fullPath);
    return stats.size;
  } catch {
    return 0; // File doesn't exist yet
  }
}

function runVerifyQuick(cwd: string): { passed: boolean; output: string } {
  const serverDir = path.join(cwd, 'server');

  const result = spawnSync('npm', ['run', 'verify:quick'], {
    cwd: serverDir,
    encoding: 'utf-8',
    timeout: 60000, // 60s timeout
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return {
    passed: result.status === 0,
    output: result.stderr || result.stdout || '',
  };
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  // Read JSON from stdin
  let rawInput: string;
  try {
    rawInput = await readStdin();
  } catch {
    // No input - allow (shouldn't happen)
    process.exit(0);
  }

  if (!rawInput.trim()) {
    process.exit(0);
  }

  let input: HookInput;
  try {
    input = JSON.parse(rawInput);
  } catch {
    // Invalid JSON - allow (let Claude handle the error)
    process.exit(0);
  }

  // Extract file path (Edit uses 'file_path', Write also uses 'file_path')
  const filePath = input.tool_input.file_path || input.tool_input.path;

  if (!filePath) {
    // No file path - allow
    process.exit(0);
  }

  // Classify the file
  const classification = classifyFile(filePath);
  const normalized = normalizePath(filePath);

  switch (classification.category) {
    case 'forbidden':
      // Hard block - never allow
      console.error(`[phase_gate] BLOCKED: ${classification.reason}`);
      console.error(`  This path is protected and cannot be modified.`);
      console.error(`  If you need to modify this file, do so manually.`);
      process.exit(2);
      break;

    case 'verify_tool':
      // Block deletion/truncation of verify tools
      if (input.tool_name === 'Write' && input.tool_input.content !== undefined) {
        const existingSize = getFileSize(filePath, input.cwd);
        const newSize = input.tool_input.content.length;

        if (existingSize > 0 && newSize < existingSize * 0.5) {
          console.error(`[phase_gate] BLOCKED: Destructive change to verification tool`);
          console.error(`  Path: ${normalized}`);
          console.error(`  Current size: ${existingSize}, New size: ${newSize}`);
          console.error(`  Verify tools are protected infrastructure.`);
          process.exit(2);
        }
      }
      // Allow non-destructive changes
      process.exit(0);
      break;

    case 'high_risk':
      // Run verify:quick before allowing
      console.error(`[phase_gate] HIGH-RISK: ${classification.reason}`);
      console.error(`  Path: ${normalized}`);

      if (shouldRunVerify()) {
        console.error(`  Running npm run verify:quick...`);
        const result = runVerifyQuick(input.cwd);

        lastVerifyResult = {
          timestamp: Date.now(),
          passed: result.passed,
        };

        if (!result.passed) {
          console.error(`[phase_gate] BLOCKED: Civil Guarantees verification failed`);
          console.error(`  Fix existing guarantee violations before modifying high-risk files.`);
          console.error(`  Run: cd apps/server && npm run verify:verbose`);
          process.exit(2);
        }

        console.error(`  Verification PASSED - allowing write`);
      } else {
        console.error(`  (Using cached verification result - passed)`);
      }

      process.exit(0);
      break;

    case 'normal':
    default:
      // Allow normal files without gate
      process.exit(0);
  }
}

// Run main and ensure proper exit
(async () => {
  try {
    await main();
  } catch (err) {
    console.error(`[phase_gate] ERROR: ${(err as Error).message}`);
    process.exit(1); // Non-blocking error (exit 1, not 2)
  }
})();
