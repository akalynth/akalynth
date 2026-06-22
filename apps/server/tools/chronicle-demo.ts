#!/usr/bin/env tsx
/**
 * Chronicle End-to-End Demo
 *
 * Demonstrates the Rust witness kernel integration:
 * 1. Emit canonical JSON (sorted keys, no whitespace)
 * 2. Append through the long-lived Rust loader handle
 * 3. Print JSON receipt
 * 4. Verify chain integrity
 *
 * Usage:
 *   cd apps/server
 *   npm run chronicle:demo
 *
 * Prerequisites:
 *   The N-API addon is preferred. The CLI auditor fallback is opt-in:
 *     CHRONICLE_ALLOW_CLI_FALLBACK=1 cd crates/chronicle && cargo build --release
 */

import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { canonicalJson } from '../../../packages/shared/hashPrimitive.js';

const require = createRequire(import.meta.url);

interface Receipt {
  prev_hash: string;
  event_hash: string;
  signature: string;
  root: string;
  sequence: number;
}

interface VerifyResult {
  valid: boolean;
  entries: number;
  root: string | null;
  pubkey: string;
}

interface ChronicleHandle {
  mode?: 'native' | 'cli-fallback';
  append(event: object): Receipt;
  verify(): VerifyResult;
}

function repoRoot(): string {
  // apps/server/tools -> repo root
  return resolve(import.meta.dirname, '../../..');
}

function chronicleBin(): string | undefined {
  const bin = resolve(repoRoot(), 'crates/chronicle/target/release/chronicle_append');
  return existsSync(bin) ? bin : undefined;
}

function demoDir(): string {
  const configured = process.env.AKALYNTH_CHRONICLE_DEMO_DIR;
  if (configured) {
    const dir = resolve(configured);
    mkdirSync(dir, { recursive: true });
    return dir;
  }
  return mkdtempSync(join(tmpdir(), 'akalynth-chronicle-demo-'));
}

function openDemoChronicle(logPath: string, keyPath: string): ChronicleHandle {
  const loaderPath = resolve(repoRoot(), 'crates/chronicle/napi/loader.cjs');
  const { openChronicle } = require(loaderPath) as {
    openChronicle: (opts: {
      logPath: string;
      keyPath: string;
      binPath?: string;
      preferNative?: boolean;
      allowCliFallback?: boolean;
    }) => ChronicleHandle;
  };

  try {
    return openChronicle({
      logPath,
      keyPath,
      binPath: chronicleBin(),
      allowCliFallback: process.env.CHRONICLE_ALLOW_CLI_FALLBACK === '1',
    });
  } catch (err) {
    throw new Error(
      `chronicle backend unavailable: ${(err as Error).message}\n` +
        `Build the native addon before running this demo, or explicitly allow the CLI auditor fallback:\n` +
        `  CHRONICLE_ALLOW_CLI_FALLBACK=1 cd crates/chronicle && cargo build --release`
    );
  }
}

function main() {
  const dir = demoDir();
  const logPath = resolve(dir, 'demo_chronicle.log');
  const keyPath = resolve(dir, 'chronicle_demo.key');
  const chronicle = openDemoChronicle(logPath, keyPath);

  console.log('\n=== Chronicle End-to-End Demo ===\n');
  console.log(`[demo] backend = ${chronicle.mode ?? 'unknown'}`);
  console.log(`[demo] directory = ${dir}`);

  // Event 1: Spawn
  const spawnEvent = {
    v: 1,
    world_id: 'akalynth-demo',
    rulebook_root: 'blake3:genesisdeadbeef',
    tick: 1,
    event_type: 'spawn',
    actor: 'did:akalynth:agent_001',
    caps_hash: 'blake3:capscafebabe',
    payload: { ent_id: 1, pos: [5, 10], kind: 'neural_agent' },
    rng: null,
  };

  console.log('[1] Appending spawn event...');
  console.log('    Input (canonical):', canonicalJson(spawnEvent));
  const receipt1 = chronicle.append(spawnEvent);
  console.log('    Receipt:', JSON.stringify(receipt1, null, 2));
  console.log(`    ✓ prev_hash = "${receipt1.prev_hash}" (genesis)`);
  console.log(`    ✓ sequence = ${receipt1.sequence}`);

  // Event 2: Move
  const moveEvent = {
    v: 1,
    world_id: 'akalynth-demo',
    rulebook_root: 'blake3:genesisdeadbeef',
    tick: 2,
    event_type: 'move',
    actor: 'did:akalynth:agent_001',
    caps_hash: 'blake3:capscafebabe',
    payload: { ent_id: 1, dir: 'E', from: [5, 10], to: [6, 10] },
    rng: null,
  };

  console.log('\n[2] Appending move event...');
  console.log('    Input (canonical):', canonicalJson(moveEvent));
  const receipt2 = chronicle.append(moveEvent);
  console.log('    Receipt:', JSON.stringify(receipt2, null, 2));
  console.log(`    ✓ prev_hash = "${receipt2.prev_hash.slice(0, 16)}..." (chains from event 1)`);
  console.log(`    ✓ sequence = ${receipt2.sequence}`);

  // Verify chain linkage
  if (receipt2.prev_hash !== receipt1.event_hash) {
    throw new Error('Chain broken! receipt2.prev_hash !== receipt1.event_hash');
  }
  console.log('    ✓ Chain linkage verified');

  // Verify integrity
  console.log('\n[3] Verifying chronicle integrity...');
  const verifyResult = chronicle.verify();
  console.log('    Result:', JSON.stringify(verifyResult, null, 2));

  if (!verifyResult.valid) {
    throw new Error('Verification failed!');
  }
  console.log(`    ✓ valid = true`);
  console.log(`    ✓ entries = ${verifyResult.entries}`);
  console.log(`    ✓ root = "${verifyResult.root?.slice(0, 16)}..."`);

  // Summary
  console.log('\n=== Demo Complete ===');
  console.log(`Log file: ${logPath}`);
  console.log(`Key file: ${keyPath}`);
  console.log('\nInvariants demonstrated:');
  console.log('  C1: Append-only (sequential writes)');
  console.log('  C2: Hash chain (prev_hash links)');
  console.log('  C3: Signatures (Ed25519)');
  console.log('  C4: Canonical JSON (sorted keys)');
  console.log('  C5: Tamper detection (verify mode)');
  console.log('\nTo inspect the raw log:');
  console.log(`  cat ${logPath}`);
}

main();
