#!/usr/bin/env node
// Verify World Events v0.
//
// Guards the first prototype event boundary:
// - clients send only skill intent IDs;
// - the server starts/advances/resolves the Bloom;
// - every accepted state transition emits a receipt;
// - Chronicle rows are derived from those receipts;
// - runtime code does not import raw drop/ source packages.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import type { AuditReceipt } from '../../../packages/shared/types.js';
import { computeReceiptHash } from '../src/persist/index.js';
import { initSchema } from '../src/persist/schema.js';
import { materialize } from '../src/persist/materializers.js';
import { RECEIPT_ACTIONS } from '../src/persist/types.js';
import {
  WITNESS_MOTH_BLOOM_EVENT_ID,
  WITNESS_MOTH_BLOOM_SKILL_PREFIX,
  createWitnessMothBloomRuntime,
  parseWitnessMothBloomSkillId,
  recordWitnessMothBloomContribution,
  startWitnessMothBloom,
} from '../src/world/world-events.js';

type ReceiptInput = {
  player_id: string;
  action: string;
  inputs: Record<string, unknown>;
  result: string;
};

function fail(msg: string): never {
  console.error(`\n[verify-world-events] FAIL: ${msg}`);
  process.exit(1);
}

function ok(msg: string): void {
  console.log(`[verify-world-events] OK: ${msg}`);
}

function assert(condition: unknown, msg: string): asserts condition {
  if (!condition) fail(msg);
}

function makeChainWriter(seedMs = 1_750_000_000_000) {
  let sequence = 0;
  let prevHash = 'genesis';
  const receipts: AuditReceipt[] = [];

  const write = (input: ReceiptInput): AuditReceipt => {
    sequence += 1;
    const receipt: AuditReceipt = {
      sequence,
      timestamp: new Date(seedMs + sequence * 1000).toISOString(),
      prev_hash: prevHash,
      event_hash: '',
      signature: '',
      actor_id: input.player_id,
      action: input.action,
      inputs: input.inputs,
      result: input.result,
      inputs_hash: 'test-inputs-hash',
      outputs_hash: 'test-outputs-hash',
    };
    receipt.event_hash = computeReceiptHash(receipt);
    prevHash = receipt.event_hash;
    receipts.push(receipt);
    return receipt;
  };

  return { write, receipts };
}

function freshDb(): Database.Database {
  const db = new Database(':memory:');
  initSchema(db);
  db.prepare(`
    INSERT INTO players (player_id, name, created_at, created_receipt, auth_method, name_lower)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('p_kael', 'Kael', new Date(1_750_000_000_000).toISOString(), `blake3:${'a'.repeat(64)}`, 'guest', 'kael');
  return db;
}

function verifyIntentSurface(): void {
  assert(
    parseWitnessMothBloomSkillId(`${WITNESS_MOTH_BLOOM_SKILL_PREFIX}verify_testimony`) === 'verify_testimony',
    'valid Bloom skill id should parse to a contribution id'
  );
  assert(parseWitnessMothBloomSkillId('shop:healing_herb') === null, 'non-event skill id should not parse');
  assert(
    parseWitnessMothBloomSkillId(`${WITNESS_MOTH_BLOOM_SKILL_PREFIX}client_claimed_resolution`) === null,
    'unknown event contribution must not parse'
  );
  ok('client surface is intent-only skill ids');
}

function verifyReducerAndReceipts(): AuditReceipt[] {
  const runtime = createWitnessMothBloomRuntime();
  const writer = makeChainWriter();

  const inactive = recordWitnessMothBloomContribution(
    runtime,
    { player_id: 'p_kael', map: 'Azura', contribution_id: 'verify_testimony', now_ms: 1 },
    writer.write
  );
  assert(!inactive.ok && inactive.payload.error === 'event_inactive', 'contribution before signal should be rejected');
  assert(writer.receipts.length === 0, 'inactive contribution must not emit a receipt');

  const wrongMap = startWitnessMothBloom(runtime, { player_id: 'p_kael', map: 'Rookguard', now_ms: 2 }, writer.write);
  assert(!wrongMap.ok && wrongMap.reason === 'invalid_target', 'Bloom can only start on Azura');
  assert(writer.receipts.length === 0, 'wrong-map start must not emit a receipt');

  const start = startWitnessMothBloom(runtime, { player_id: 'p_kael', map: 'Azura', now_ms: 3 }, writer.write);
  assert(start.ok && start.started && runtime.phase === 'signal', 'valid Azura herald start should enter signal phase');
  assert(writer.receipts.length === 1, 'start should emit exactly one receipt');
  assert(writer.receipts[0].action === RECEIPT_ACTIONS.WORLD_EVENT_STARTED, 'first receipt should start the event');

  const repeatStart = startWitnessMothBloom(runtime, { player_id: 'p_kael', map: 'Azura', now_ms: 4 }, writer.write);
  assert(repeatStart.ok && !repeatStart.started, 'repeat start should report current state');
  assert(writer.receipts.length === 1, 'repeat start must not emit a duplicate receipt');

  const verify = recordWitnessMothBloomContribution(
    runtime,
    { player_id: 'p_kael', map: 'Azura', contribution_id: 'verify_testimony', now_ms: 5 },
    writer.write
  );
  assert(verify.ok && verify.recorded && !verify.resolved, 'first contribution should be recorded');
  assert(runtime.phase === 'investigation', 'first contribution should advance to investigation');

  const duplicate = recordWitnessMothBloomContribution(
    runtime,
    { player_id: 'p_kael', map: 'Azura', contribution_id: 'verify_testimony', now_ms: 6 },
    writer.write
  );
  assert(duplicate.ok && !duplicate.recorded, 'duplicate contribution should be acknowledged but not re-recorded');
  assert(writer.receipts.length === 2, 'duplicate contribution must not emit a receipt');

  const craft = recordWitnessMothBloomContribution(
    runtime,
    { player_id: 'p_kael', map: 'Azura', contribution_id: 'craft_lantern_frame', now_ms: 7 },
    writer.write
  );
  assert(craft.ok && craft.recorded && !craft.resolved, 'second contribution should be recorded');

  const defend = recordWitnessMothBloomContribution(
    runtime,
    { player_id: 'p_kael', map: 'Azura', contribution_id: 'defend_scribes', now_ms: 8 },
    writer.write
  );
  assert(defend.ok && defend.recorded && defend.resolved, 'third contribution should resolve the event');
  assert(runtime.phase === 'resolved', 'event should end in resolved phase');

  const actions = writer.receipts.map((receipt) => receipt.action);
  assert(actions[0] === RECEIPT_ACTIONS.WORLD_EVENT_STARTED, 'start must precede contributions');
  assert(actions.slice(1, 4).every((action) => action === RECEIPT_ACTIONS.WORLD_EVENT_CONTRIBUTION), 'accepted contributions must be receipted');
  assert(actions[4] === RECEIPT_ACTIONS.WORLD_EVENT_RESOLVED, 'resolution must be receipted last');
  ok('reducer emits ordered receipts for start, contribution, and resolution');

  return writer.receipts;
}

function verifyChronicleMaterialization(receipts: AuditReceipt[]): void {
  const db = freshDb();
  for (const receipt of receipts) materialize(db, receipt);

  const rows = db.prepare(`
    SELECT kind, source_action, details_json
    FROM chronicle_events
    WHERE kind = 'world_event'
    ORDER BY id ASC
  `).all() as Array<{ kind: string; source_action: string; details_json: string }>;

  assert(rows.length === receipts.length, `expected ${receipts.length} world_event chronicle rows, got ${rows.length}`);
  assert(rows[0].source_action === RECEIPT_ACTIONS.WORLD_EVENT_STARTED, 'first Chronicle row should source from event start');
  assert(rows[rows.length - 1].source_action === RECEIPT_ACTIONS.WORLD_EVENT_RESOLVED, 'last Chronicle row should source from event resolution');
  const lastDetails = JSON.parse(rows[rows.length - 1].details_json) as Record<string, unknown>;
  assert(lastDetails.event_id === WITNESS_MOTH_BLOOM_EVENT_ID, 'Chronicle details should carry event_id');
  assert(lastDetails.outcome === 'controlled_release', 'Chronicle details should carry deterministic outcome');
  db.close();
  ok('world event receipts materialize into Chronicle rows');
}

function verifyNoRawDropRuntimeImport(): void {
  const modulePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/world/world-events.ts');
  const source = fs.readFileSync(modulePath, 'utf8');
  assert(!/from\s+['"][^'"]*drop\//.test(source), 'world-events runtime must not import from drop/');
  assert(!/drop\//.test(source), 'world-events runtime must not reference raw drop paths');
  ok('runtime world-event module does not import raw drop source');
}

function main(): void {
  verifyIntentSurface();
  const receipts = verifyReducerAndReceipts();
  verifyChronicleMaterialization(receipts);
  verifyNoRawDropRuntimeImport();
  console.log('\n[verify-world-events] All checks passed.');
}

main();
