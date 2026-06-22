#!/usr/bin/env tsx
/**
 * Chronicle Adapter Smoke Test
 *
 * Verifies the adapter can:
 * 1. Call the Rust N-API chronicle backend when enabled
 * 2. Return null when disabled
 * 3. Return valid receipt structure
 *
 * Usage:
 *   cd apps/server
 *   npm run chronicle:adapter:smoke
 */

import {
  chronicleAppend,
  chronicleVerify,
  initChronicleBackend,
  isChronicleEnabled,
} from '../src/witness/chronicleAdapter.js';
import { computeReceiptHash, receiptHashBackendMode } from '../src/persist/hash.js';
import { generateItemId } from '../src/persist/materializers.js';
import { blake3HexBytes, blake3HexUtf8, canonicalJson } from '../../../packages/shared/hashPrimitive.js';
import { existsSync, unlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const LOG_PATH = resolve(process.cwd(), 'adapter_smoke_test.log');
const KEY_PATH = resolve(process.cwd(), 'adapter_smoke_test.key');
const NATIVE_ADDON_PATH = resolve(process.cwd(), '../../crates/chronicle/napi/chronicle-native.node');
const NATIVE_LOADER_PATH = resolve(process.cwd(), '../../crates/chronicle/napi/loader.cjs');
const require = createRequire(import.meta.url);

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

  test('initChronicleBackend() prefers native when addon is present', () => {
    process.env.ENABLE_CHRONICLE = '1';
    delete process.env.CHRONICLE_NATIVE;
    delete process.env.CHRONICLE_ALLOW_CLI_FALLBACK;
    const mode = initChronicleBackend({ logPath: LOG_PATH, keyPath: KEY_PATH });
    const expected = existsSync(NATIVE_ADDON_PATH) ? 'native' : 'unavailable';
    if (mode !== expected) {
      throw new Error(`Expected ${expected}, got ${mode}`);
    }
  });

  test('CHRONICLE_NATIVE=0 fails closed with no server CLI fallback', () => {
    process.env.ENABLE_CHRONICLE = '1';
    process.env.CHRONICLE_NATIVE = '0';
    delete process.env.CHRONICLE_ALLOW_CLI_FALLBACK;
    const mode = initChronicleBackend({ logPath: LOG_PATH, keyPath: KEY_PATH });
    if (mode !== 'unavailable') {
      throw new Error(`Expected unavailable with native disabled, got ${mode}`);
    }
    delete process.env.CHRONICLE_NATIVE;
  });

  test('CHRONICLE_ALLOW_CLI_FALLBACK=1 is ignored by server runtime', () => {
    process.env.ENABLE_CHRONICLE = '1';
    process.env.CHRONICLE_NATIVE = '0';
    process.env.CHRONICLE_ALLOW_CLI_FALLBACK = '1';
    const mode = initChronicleBackend({ logPath: LOG_PATH, keyPath: KEY_PATH });
    if (mode !== 'unavailable') {
      throw new Error(`Expected unavailable because server runtime has no CLI fallback, got ${mode}`);
    }
    delete process.env.CHRONICLE_NATIVE;
    delete process.env.CHRONICLE_ALLOW_CLI_FALLBACK;
  });

  test('native Rust hash primitive matches shared TS primitive when addon is present', () => {
    if (!existsSync(NATIVE_ADDON_PATH)) {
      console.log('  skipped: native addon not built');
      return;
    }
    const { openHashPrimitive } = require(NATIVE_LOADER_PATH) as {
      openHashPrimitive: () => null | {
        mode: 'native';
        canonicalJson: (value: unknown) => string;
        blake3HexUtf8: (value: string) => string;
        blake3HexBytes: (value: Buffer | Uint8Array | number[]) => string;
      };
    };
    const hash = openHashPrimitive();
    if (!hash) throw new Error('Expected native hash primitive');

    const samples: unknown[] = [
      { z: 2, a: 1 },
      { nested: { beta: true, alpha: null }, list: [3, 2, 1] },
      ['caps:move', 'caps:chat'],
    ];
    for (const sample of samples) {
      const tsCanonical = canonicalJson(sample);
      const rustCanonical = hash.canonicalJson(sample);
      if (rustCanonical !== tsCanonical) {
        throw new Error(`Canonical JSON mismatch: ${rustCanonical} !== ${tsCanonical}`);
      }
      const tsHash = blake3HexUtf8(tsCanonical);
      const rustHash = hash.blake3HexUtf8(rustCanonical);
      if (rustHash !== tsHash) {
        throw new Error(`BLAKE3 mismatch: ${rustHash} !== ${tsHash}`);
      }
    }

    const byteSamples: Array<Buffer | Uint8Array | number[]> = [
      Buffer.from([0, 1, 2, 255]),
      new Uint8Array([97, 98, 99]),
      [16, 32, 64, 128],
    ];
    for (const sample of byteSamples) {
      const bytes = Buffer.isBuffer(sample) ? sample : Buffer.from(sample);
      const tsHash = blake3HexBytes(bytes);
      const rustHash = hash.blake3HexBytes(sample);
      if (rustHash !== tsHash) {
        throw new Error(`BLAKE3 byte mismatch: ${rustHash} !== ${tsHash}`);
      }
    }
  });

  test('receipt hashing prefers native Rust and CHRONICLE_NATIVE=0 preserves TS fallback parity', () => {
    const receipt = {
      actor_id: 'did:akalynth:smoke_test',
      action: 'receipt_hash_parity',
      timestamp: '2026-06-22T07:22:00.000Z',
      inputs: { z: 2, a: 1 },
      result: { ok: true },
      event_hash: 'derived',
      signature: 'derived',
    };

    delete process.env.CHRONICLE_NATIVE;
    const preferredMode = receiptHashBackendMode();
    const preferredHash = computeReceiptHash(receipt);
    if (existsSync(NATIVE_ADDON_PATH) && preferredMode !== 'native') {
      throw new Error(`Expected native receipt hash backend, got ${preferredMode}`);
    }

    process.env.CHRONICLE_NATIVE = '0';
    const fallbackMode = receiptHashBackendMode();
    const fallbackHash = computeReceiptHash(receipt);
    delete process.env.CHRONICLE_NATIVE;

    if (fallbackMode !== 'ts') {
      throw new Error(`Expected TS receipt hash fallback, got ${fallbackMode}`);
    }
    if (preferredHash !== fallbackHash) {
      throw new Error(`Receipt hash mismatch across native/fallback: ${preferredHash} !== ${fallbackHash}`);
    }
  });

  test('materialized item IDs prefer native Rust and CHRONICLE_NATIVE=0 preserves TS fallback parity', () => {
    const receiptHash = 'blake3:ccdc5775945f54a7878a8fe347bc88bb3a841561594e8a5248edae8ef5153957';

    delete process.env.CHRONICLE_NATIVE;
    const preferredMode = receiptHashBackendMode();
    const preferredItemId = generateItemId(receiptHash);
    if (existsSync(NATIVE_ADDON_PATH) && preferredMode !== 'native') {
      throw new Error(`Expected native item ID hash backend, got ${preferredMode}`);
    }

    process.env.CHRONICLE_NATIVE = '0';
    const fallbackMode = receiptHashBackendMode();
    const fallbackItemId = generateItemId(receiptHash);
    delete process.env.CHRONICLE_NATIVE;

    if (fallbackMode !== 'ts') {
      throw new Error(`Expected TS item ID hash fallback, got ${fallbackMode}`);
    }
    if (preferredItemId !== fallbackItemId) {
      throw new Error(`Item ID mismatch across native/fallback: ${preferredItemId} !== ${fallbackItemId}`);
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
