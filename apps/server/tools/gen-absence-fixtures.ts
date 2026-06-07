#!/usr/bin/env tsx
/**
 * gen-absence-fixtures.ts — (Re)generate fixtures for verify-absence-receipts.
 *
 * Builds small REAL signed chains (kernel primitives) that each contain an
 * absence_receipt exercising one verdict path. Signed with the deterministic
 * test seed (32 x 0x42), matching test-absence-receipts.ts. The key seed is NOT
 * committed (repo policy: no tracked *.key).
 *
 * Fixtures live in apps/server/fixtures/absence/ and are committed. Re-run only
 * when the absence schema or receipt hashing format changes:
 *   tsx tools/gen-absence-fixtures.ts
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
  evaluateAbsence,
  predicateHash,
  type CoordinationReceipt,
  type AbsenceReceiptInputs,
  type AbsenceBoundary,
  type Predicate,
} from '@akalynth/coordination-kernel';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.resolve(__dirname, '../fixtures/absence');

const TEST_SEED = Buffer.alloc(32, 0x42);
const signingKey = createPrivateKeyFromSeed(new Uint8Array(TEST_SEED));

interface Action {
  actor_id: string;
  action: string;
  inputs: Record<string, unknown>;
  result: string;
}

function appendAction(chain: CoordinationReceipt[], a: Action): CoordinationReceipt {
  const sequence = chain.length + 1;
  const prev_hash = chain.length ? chain[chain.length - 1].event_hash : GENESIS_MARKER;
  const timestamp = new Date(Date.UTC(2026, 0, 1, 0, 0, sequence)).toISOString();
  const body: Omit<CoordinationReceipt, 'event_hash' | 'signature'> = {
    sequence,
    timestamp,
    prev_hash,
    actor_id: a.actor_id,
    action: a.action,
    inputs: a.inputs,
    result: a.result,
    inputs_hash: computeInputsHash(a.inputs),
    outputs_hash: computeOutputsHash(a.result),
  };
  const event_hash = computeEventHash(body);
  const signature = signEvent(prev_hash, event_hash, signingKey);
  const receipt: CoordinationReceipt = { ...body, event_hash, signature };
  chain.push(receipt);
  return receipt;
}

const BASE: Action[] = [
  { actor_id: 'server', action: 'server_boot', inputs: { pid: 1 }, result: 'ok' },
  { actor_id: 'server', action: 'capability_granted', inputs: { capability: 'issue_absence_receipt' }, result: 'ok' },
  { actor_id: 'player:alice', action: 'move', inputs: { dx: 1 }, result: 'ok' },
  { actor_id: 'player:alice', action: 'chat', inputs: { text: 'hi' }, result: 'ok' },
  { actor_id: 'player:bob', action: 'pickup', inputs: { item: 'torch' }, result: 'ok' },
  { actor_id: 'player:bob', action: 'chat', inputs: { text: 'yo' }, result: 'ok' },
];

const BOUNDARY: AbsenceBoundary = {
  boundary_id: 'fixtures.surface.v1',
  capture_contract: 'fixtures_capture.v1',
  source_set_hash: 'blake3:' + '00'.repeat(32),
  capture_completeness_ref: null,
};
const NO_APPROVAL: Predicate = { op: 'eq', field: 'action', value: 'prod_release_approved' };

function baseChain(): CoordinationReceipt[] {
  const c: CoordinationReceipt[] = [];
  for (const a of BASE) appendAction(c, a);
  return c;
}
function appendAbsence(
  chain: CoordinationReceipt[],
  inputs: AbsenceReceiptInputs,
  result: string,
): void {
  appendAction(chain, {
    actor_id: 'server',
    action: 'absence_receipt',
    inputs: inputs as unknown as Record<string, unknown>,
    result,
  });
}
function serialize(c: CoordinationReceipt[]): string {
  return c.map((r) => JSON.stringify(r)).join('\n') + '\n';
}
function write(name: string, content: string): void {
  fs.writeFileSync(path.join(FIXTURE_DIR, name), content);
  console.log(`wrote ${path.relative(process.cwd(), path.join(FIXTURE_DIR, name))}`);
}

function main(): void {
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });

  // 1) absent — honest "absent" claim over a stable interval [3..6] (PASS).
  {
    const c = baseChain();
    const { inputs, result } = evaluateAbsence(c, {
      log_id: 'fixtures', boundary: BOUNDARY,
      predicate_id: 'no_release_approval.v1', predicate: NO_APPROVAL, from_seq: 3, to_seq: 6,
    });
    appendAbsence(c, inputs, result);
    write('absent.jsonl', serialize(c));
  }

  // 2) unprovable-honest — interval [1..6] spans an authority transition; the
  //    receipt HONESTLY records "absence_unprovable" (PASS).
  {
    const c = baseChain();
    const { inputs, result } = evaluateAbsence(c, {
      log_id: 'fixtures', boundary: BOUNDARY,
      predicate_id: 'no_release_approval.v1', predicate: NO_APPROVAL, from_seq: 1, to_seq: 6,
    });
    appendAbsence(c, inputs, result);
    write('unprovable-honest.jsonl', serialize(c));
  }

  // 3) forged-match — claims "absent" but the predicate actually matches (FAIL).
  {
    const c = baseChain();
    const { inputs } = evaluateAbsence(c, {
      log_id: 'fixtures', boundary: BOUNDARY,
      predicate_id: 'no_release_approval.v1', predicate: NO_APPROVAL, from_seq: 3, to_seq: 6,
    });
    const forged = JSON.parse(JSON.stringify(inputs)) as AbsenceReceiptInputs;
    forged.predicate.definition = { op: 'eq', field: 'action', value: 'chat' };
    forged.predicate.canonical_form_hash = predicateHash(forged.predicate.definition);
    appendAbsence(c, forged, 'absent');
    write('forged-match.jsonl', serialize(c));
  }

  // 4) overclaim-authority — claims "absent" over an interval with a transition (FAIL).
  {
    const c = baseChain();
    const { inputs } = evaluateAbsence(c, {
      log_id: 'fixtures', boundary: BOUNDARY,
      predicate_id: 'no_release_approval.v1', predicate: NO_APPROVAL, from_seq: 1, to_seq: 6,
    });
    appendAbsence(c, inputs, 'absent');
    write('overclaim-authority.jsonl', serialize(c));
  }

  // 5) tampered — valid "absent" claim, but a slice receipt's event_hash is corrupted (FAIL).
  {
    const c = baseChain();
    const { inputs, result } = evaluateAbsence(c, {
      log_id: 'fixtures', boundary: BOUNDARY,
      predicate_id: 'no_release_approval.v1', predicate: NO_APPROVAL, from_seq: 3, to_seq: 6,
    });
    appendAbsence(c, inputs, result);
    c[3].event_hash = 'blake3:' + '00'.repeat(32); // corrupt seq 4 (inside the slice)
    write('tampered.jsonl', serialize(c));
  }

  console.log('done.');
}

main();
