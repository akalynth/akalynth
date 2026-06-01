#!/usr/bin/env tsx
/**
 * gen-receipts-chain-fixtures.ts — (Re)generate fixtures for verify-receipts-chain.
 *
 * Builds a small, REAL signed receipt chain using the kernel primitives
 * (computeInputsHash/computeOutputsHash/computeEventHash/signEvent) so the
 * "valid" fixture passes the verifier, and emits tampered variants that each
 * break exactly one invariant.
 *
 * The fixtures are signed with a deterministic test seed (32 × 0x42). The raw
 * key seed is NOT committed (repo policy: no tracked *.key); the test harness
 * (test-receipts-chain.ts) re-derives the same seed at runtime to exercise the
 * signature path.
 *
 * Fixtures live in apps/server/fixtures/receipts-chain/ and are committed.
 * Re-run only when the receipt hashing/signing format changes:
 *   tsx tools/gen-receipts-chain-fixtures.ts
 */
/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeInputsHash,
  computeOutputsHash,
  computeEventHash,
  signEvent,
  createPrivateKeyFromSeed,
  GENESIS_MARKER,
} from '@akalynth/coordination-kernel';
import type { CoordinationReceipt } from '@akalynth/coordination-kernel';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.resolve(__dirname, '../fixtures/receipts-chain');

// Deterministic 32-byte test seed (NOT a production key; for fixtures only).
// Must match TEST_SEED in tools/test-receipts-chain.ts. Never committed as a file.
const TEST_SEED = Buffer.alloc(32, 0x42);
const signingKey = createPrivateKeyFromSeed(new Uint8Array(TEST_SEED));

interface Action {
  actor_id: string;
  action: string;
  inputs: Record<string, unknown>;
  result: string;
}

const ACTIONS: Action[] = [
  { actor_id: 'server', action: 'server_boot', inputs: { pid: 1234 }, result: 'ok' },
  { actor_id: 'player:alice', action: 'move', inputs: { dx: 1, dy: 0 }, result: 'ok' },
  { actor_id: 'player:alice', action: 'pickup', inputs: { item: 'torch' }, result: 'ok' },
];

/**
 * Build a valid signed chain from the action list.
 */
function buildChain(actions: Action[]): CoordinationReceipt[] {
  const receipts: CoordinationReceipt[] = [];
  let prev_hash = GENESIS_MARKER;
  let sequence = 0;
  for (const a of actions) {
    sequence += 1;
    const timestamp = new Date(Date.UTC(2026, 0, 1, 0, 0, sequence)).toISOString();
    const inputs_hash = computeInputsHash(a.inputs);
    const outputs_hash = computeOutputsHash(a.result);
    const body: Omit<CoordinationReceipt, 'event_hash' | 'signature'> = {
      sequence,
      timestamp,
      prev_hash,
      actor_id: a.actor_id,
      action: a.action,
      inputs: a.inputs,
      result: a.result,
      inputs_hash,
      outputs_hash,
    };
    const event_hash = computeEventHash(body);
    const signature = signEvent(prev_hash, event_hash, signingKey);
    receipts.push({ ...body, event_hash, signature });
    prev_hash = event_hash;
  }
  return receipts;
}

function serialize(receipts: CoordinationReceipt[]): string {
  // One canonical JSON object per line. (Field order is cosmetic; the verifier
  // recomputes canonical hashes regardless of on-disk key order.)
  return receipts.map((r) => JSON.stringify(r)).join('\n') + '\n';
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/**
 * Recompute event_hash + signature for a receipt after mutating its body.
 * Used to isolate a SINGLE invariant break (e.g. linkage) without also
 * tripping the event_hash check, which commits to prev_hash.
 */
function reseal(r: CoordinationReceipt): void {
  const { event_hash: _e, signature: _s, ...body } = r;
  r.event_hash = computeEventHash(body);
  r.signature = signEvent(r.prev_hash, r.event_hash, signingKey);
}

function write(name: string, content: string): void {
  const p = path.join(FIXTURE_DIR, name);
  fs.writeFileSync(p, content);
  console.log(`wrote ${path.relative(process.cwd(), p)}`);
}

function main(): void {
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });

  const valid = buildChain(ACTIONS);

  // 1. valid-chain: passes (signatures verify with the deterministic test seed,
  //    which test-receipts-chain.ts materializes to a temp key at runtime).
  write('valid-chain.jsonl', serialize(valid));

  // 2. tampered-prev-hash: break linkage on the 2nd receipt's prev_hash.
  //    Reseal so event_hash + signature are internally consistent and the
  //    ONLY broken invariant is the chain link to receipt #1.
  {
    const c = clone(valid);
    c[1].prev_hash = 'blake3:' + 'deadbeef'.repeat(8); // valid-looking but wrong
    reseal(c[1]);
    write('tampered-prev-hash.jsonl', serialize(c));
  }

  // 3. tampered-event-hash: corrupt the event_hash of the 2nd receipt.
  {
    const c = clone(valid);
    c[1].event_hash = 'blake3:' + '00'.repeat(32);
    write('tampered-event-hash.jsonl', serialize(c));
  }

  // 4. tampered-inputs: mutate inputs without recomputing inputs_hash.
  {
    const c = clone(valid);
    (c[1].inputs as Record<string, unknown>).dx = 999;
    write('tampered-inputs.jsonl', serialize(c));
  }

  // 5. non-genesis-first: first receipt's prev_hash != "genesis".
  //    Reseal receipt #0 (so its own hash is consistent) AND re-link receipt
  //    #1 onto it, so the ONLY broken invariant is the genesis check.
  {
    const c = clone(valid);
    c[0].prev_hash = 'blake3:' + 'ab'.repeat(32);
    reseal(c[0]);
    c[1].prev_hash = c[0].event_hash;
    reseal(c[1]);
    c[2].prev_hash = c[1].event_hash;
    reseal(c[2]);
    write('non-genesis-first.jsonl', serialize(c));
  }

  console.log('done.');
}

main();
