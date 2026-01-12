#!/usr/bin/env tsx
/**
 * Chronicle End-to-End Demo
 *
 * Demonstrates the Rust witness kernel integration:
 * 1. Emit canonical JSON (sorted keys, no whitespace)
 * 2. Pipe to chronicle_append via stdin
 * 3. Print JSON receipt
 * 4. Verify chain integrity
 *
 * Usage:
 *   cd apps/server
 *   npm run chronicle:demo
 *
 * Prerequisites:
 *   cargo build --release -p chronicle
 */

import { spawnSync } from 'node:child_process';
import { existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import stringify from 'fast-json-stable-stringify';

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

function repoRoot(): string {
  // apps/server/tools -> repo root
  return resolve(import.meta.dirname, '../../..');
}

function chronicleBin(): string {
  return resolve(repoRoot(), 'crates/chronicle/target/release/chronicle_append');
}

function chronicleKey(): string {
  return resolve(repoRoot(), 'crates/chronicle/target/release/chronicle_demo.key');
}

function runAppend(event: object, logPath: string, keyPath: string): Receipt {
  const bin = chronicleBin();
  if (!existsSync(bin)) {
    throw new Error(
      `chronicle_append not found at ${bin}\n` +
        `Build it first:\n  cd crates/chronicle && cargo build --release`
    );
  }

  const canonical = stringify(event); // stable key ordering, no whitespace
  const p = spawnSync(bin, ['--log', logPath, '--key', keyPath], {
    input: canonical,
    encoding: 'utf8',
  });

  if (p.status !== 0) {
    throw new Error(`chronicle_append failed:\n${p.stderr || '(no stderr)'}`);
  }

  return JSON.parse(p.stdout.trim()) as Receipt;
}

function runVerify(logPath: string, keyPath: string): VerifyResult {
  const bin = chronicleBin();
  const p = spawnSync(bin, ['--verify', '--log', logPath, '--key', keyPath], {
    encoding: 'utf8',
  });

  if (p.status !== 0) {
    throw new Error(`chronicle verify failed:\n${p.stderr || '(no stderr)'}`);
  }

  return JSON.parse(p.stdout.trim()) as VerifyResult;
}

function main() {
  const logPath = resolve(process.cwd(), 'demo_chronicle.log');
  const keyPath = chronicleKey();

  // Clean up any previous demo run
  if (existsSync(logPath)) {
    unlinkSync(logPath);
    console.log(`[demo] Removed previous ${logPath}`);
  }

  console.log('\n=== Chronicle End-to-End Demo ===\n');

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
  console.log('    Input (canonical):', stringify(spawnEvent));
  const receipt1 = runAppend(spawnEvent, logPath, keyPath);
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
  const receipt2 = runAppend(moveEvent, logPath, keyPath);
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
  const verifyResult = runVerify(logPath, keyPath);
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
