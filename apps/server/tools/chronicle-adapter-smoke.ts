#!/usr/bin/env tsx
/**
 * Chronicle Adapter Smoke Test
 *
 * Verifies the adapter can:
 * 1. Call chronicle_append when enabled
 * 2. Return null when disabled
 * 3. Return valid receipt structure
 *
 * Usage:
 *   cd apps/server
 *   npm run chronicle:adapter:smoke
 */

import { chronicleAppend, isChronicleEnabled, chronicleVerify } from '../src/witness/chronicleAdapter.js';
import { existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

const LOG_PATH = resolve(process.cwd(), 'adapter_smoke_test.log');
const KEY_PATH = resolve(process.cwd(), 'adapter_smoke_test.key');

function cleanup() {
  if (existsSync(LOG_PATH)) unlinkSync(LOG_PATH);
  if (existsSync(KEY_PATH)) unlinkSync(KEY_PATH);
}

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    console.error(`✗ ${name}`);
    console.error(`  ${e}`);
    process.exit(1);
  }
}

function main() {
  console.log('\n=== Chronicle Adapter Smoke Test ===\n');

  cleanup();

  // Test 1: Disabled by default
  test('returns null when ENABLE_CHRONICLE is not set', () => {
    delete process.env.ENABLE_CHRONICLE;
    const result = chronicleAppend({ test: true }, { logPath: LOG_PATH, keyPath: KEY_PATH });
    if (result !== null) {
      throw new Error(`Expected null, got ${JSON.stringify(result)}`);
    }
  });

  // Test 2: isChronicleEnabled reflects env
  test('isChronicleEnabled() returns false by default', () => {
    delete process.env.ENABLE_CHRONICLE;
    if (isChronicleEnabled()) {
      throw new Error('Expected false');
    }
  });

  test('isChronicleEnabled() returns true when ENABLE_CHRONICLE=1', () => {
    process.env.ENABLE_CHRONICLE = '1';
    if (!isChronicleEnabled()) {
      throw new Error('Expected true');
    }
  });

  // Test 3: Append works when enabled
  test('chronicleAppend returns receipt when enabled', () => {
    process.env.ENABLE_CHRONICLE = '1';

    const event = {
      v: 1,
      world_id: 'akalynth-adapter-smoke',
      rulebook_root: 'blake3:genesisdeadbeef',
      tick: Date.now(),
      event_type: 'spawn',
      actor: 'did:akalynth:smoke_test',
      caps_hash: 'blake3:stub',
      payload: { test: true },
      rng: null,
    };

    const receipt = chronicleAppend(event, { logPath: LOG_PATH, keyPath: KEY_PATH });

    if (!receipt) {
      throw new Error('Expected receipt, got null');
    }
    if (receipt.prev_hash !== 'genesis') {
      throw new Error(`Expected prev_hash='genesis', got '${receipt.prev_hash}'`);
    }
    if (receipt.sequence !== 1) {
      throw new Error(`Expected sequence=1, got ${receipt.sequence}`);
    }
    if (!receipt.event_hash || receipt.event_hash.length !== 64) {
      throw new Error(`Invalid event_hash: ${receipt.event_hash}`);
    }
    if (!receipt.signature || receipt.signature.length !== 128) {
      throw new Error(`Invalid signature length: ${receipt.signature?.length}`);
    }
  });

  // Test 4: Chain linkage
  test('second append chains from first', () => {
    process.env.ENABLE_CHRONICLE = '1';

    const event1 = { tick: 1, event_type: 'test1' };
    const event2 = { tick: 2, event_type: 'test2' };

    // First event already appended above, append two more
    const r1 = chronicleAppend(event1, { logPath: LOG_PATH, keyPath: KEY_PATH })!;
    const r2 = chronicleAppend(event2, { logPath: LOG_PATH, keyPath: KEY_PATH })!;

    if (r2.prev_hash !== r1.event_hash) {
      throw new Error(`Chain broken: r2.prev_hash (${r2.prev_hash}) !== r1.event_hash (${r1.event_hash})`);
    }
    if (r2.sequence !== r1.sequence + 1) {
      throw new Error(`Sequence not incremented: ${r2.sequence} !== ${r1.sequence + 1}`);
    }
  });

  // Test 5: Verify works
  test('chronicleVerify returns valid result', () => {
    process.env.ENABLE_CHRONICLE = '1';

    const result = chronicleVerify({ logPath: LOG_PATH, keyPath: KEY_PATH });
    if (!result) {
      throw new Error('Expected verification result');
    }

    const parsed = JSON.parse(result);
    if (!parsed.valid) {
      throw new Error(`Verification failed: ${result}`);
    }
    if (parsed.entries !== 3) {
      throw new Error(`Expected 3 entries, got ${parsed.entries}`);
    }
  });

  // Cleanup
  cleanup();

  console.log('\n=== All Tests Passed ===\n');
}

main();
