#!/usr/bin/env node
// Verify World Events v0.
//
// Guards the first prototype event boundary:
// - clients send only skill intent IDs;
// - the server starts/advances/resolves the Bloom;
// - every accepted state transition emits a receipt;
// - Chronicle rows are derived from those receipts;
// - the SQLite world_events projection hydrates runtime state after restart;
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
  EMBER_ROAD_TEASER_ID,
  WITNESS_MOTH_BLOOM_EVIDENCE,
  WITNESS_MOTH_BLOOM_EVIDENCE_PREFIX,
  WITNESS_MOTH_BLOOM_EVENT_ID,
  WITNESS_MOTH_BLOOM_SKILL_PREFIX,
  createWitnessMothBloomRuntime,
  handleWitnessMothBloomSkillIntent,
  hydrateWitnessMothBloomRuntime,
  parseWitnessMothBloomEvidenceSkillId,
  parseWitnessMothBloomSkillId,
  recoverWitnessMothBloomEvidence,
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
    parseWitnessMothBloomEvidenceSkillId(`${WITNESS_MOTH_BLOOM_EVIDENCE_PREFIX}testimony_shard`) === 'testimony_shard',
    'valid Bloom evidence skill id should parse to an evidence id'
  );
  assert(
    parseWitnessMothBloomSkillId(`${WITNESS_MOTH_BLOOM_EVIDENCE_PREFIX}testimony_shard`) === null,
    'evidence skill id should not parse as a contribution'
  );
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

  const inactiveEvidence = recoverWitnessMothBloomEvidence(
    runtime,
    { player_id: 'p_kael', map: 'Azura', evidence_id: 'testimony_shard', now_ms: 1 },
    writer.write
  );
  assert(!inactiveEvidence.ok && inactiveEvidence.payload.error === 'event_inactive', 'evidence before signal should be rejected');
  assert(writer.receipts.length === 0, 'inactive evidence must not emit a receipt');

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

  const blockedContribution = recordWitnessMothBloomContribution(
    runtime,
    { player_id: 'p_kael', map: 'Azura', contribution_id: 'verify_testimony', now_ms: 4 },
    writer.write
  );
  assert(!blockedContribution.ok && blockedContribution.payload.error === 'evidence_required', 'contribution before evidence should be rejected');
  assert(writer.receipts.length === 1, 'evidence-gated contribution must not emit a receipt');

  const wrongMapEvidence = recoverWitnessMothBloomEvidence(
    runtime,
    { player_id: 'p_kael', map: 'Rookguard', evidence_id: 'testimony_shard', now_ms: 4 },
    writer.write
  );
  assert(!wrongMapEvidence.ok && wrongMapEvidence.reason === 'invalid_target', 'wrong-map evidence should be rejected');
  assert(writer.receipts.length === 1, 'wrong-map evidence must not emit a receipt');

  const evidenceIds = WITNESS_MOTH_BLOOM_EVIDENCE.map((entry) => entry.evidence_id);
  for (let i = 0; i < evidenceIds.length; i += 1) {
    const evidence = recoverWitnessMothBloomEvidence(
      runtime,
      { player_id: 'p_kael', map: 'Azura', evidence_id: evidenceIds[i], now_ms: 5 + i },
      writer.write
    );
    assert(evidence.ok && evidence.recovered, `evidence ${evidenceIds[i]} should be recovered`);
  }

  const duplicateEvidence = recoverWitnessMothBloomEvidence(
    runtime,
    { player_id: 'p_kael', map: 'Azura', evidence_id: 'testimony_shard', now_ms: 9 },
    writer.write
  );
  assert(duplicateEvidence.ok && !duplicateEvidence.recovered, 'duplicate evidence should be acknowledged but not re-recorded');
  assert(writer.receipts.length === 4, 'duplicate evidence must not emit a receipt');

  const verify = recordWitnessMothBloomContribution(
    runtime,
    { player_id: 'p_kael', map: 'Azura', contribution_id: 'verify_testimony', now_ms: 10 },
    writer.write
  );
  assert(verify.ok && verify.recorded && !verify.resolved, 'first contribution should be recorded');
  assert(runtime.phase === 'investigation', 'first contribution should advance to investigation');

  const duplicate = recordWitnessMothBloomContribution(
    runtime,
    { player_id: 'p_kael', map: 'Azura', contribution_id: 'verify_testimony', now_ms: 11 },
    writer.write
  );
  assert(duplicate.ok && !duplicate.recorded, 'duplicate contribution should be acknowledged but not re-recorded');
  assert(writer.receipts.length === 5, 'duplicate contribution must not emit a receipt');

  const craft = recordWitnessMothBloomContribution(
    runtime,
    { player_id: 'p_kael', map: 'Azura', contribution_id: 'craft_lantern_frame', now_ms: 12 },
    writer.write
  );
  assert(craft.ok && craft.recorded && !craft.resolved, 'second contribution should be recorded');

  const defend = recordWitnessMothBloomContribution(
    runtime,
    { player_id: 'p_kael', map: 'Azura', contribution_id: 'defend_scribes', now_ms: 13 },
    writer.write
  );
  assert(defend.ok && defend.recorded && defend.resolved, 'third contribution should resolve the event');
  assert(runtime.phase === 'resolved', 'event should end in resolved phase');
  assert(runtime.teaser?.id === EMBER_ROAD_TEASER_ID, 'resolution should unlock the Ember Road teaser');

  const actions = writer.receipts.map((receipt) => receipt.action);
  assert(actions[0] === RECEIPT_ACTIONS.WORLD_EVENT_STARTED, 'start must precede contributions');
  assert(actions.slice(1, 4).every((action) => action === RECEIPT_ACTIONS.WORLD_EVENT_EVIDENCE_RECOVERED), 'accepted evidence must be receipted');
  assert(actions.slice(4, 7).every((action) => action === RECEIPT_ACTIONS.WORLD_EVENT_CONTRIBUTION), 'accepted contributions must be receipted');
  assert(actions[7] === RECEIPT_ACTIONS.WORLD_EVENT_RESOLVED, 'resolution must be receipted after contributions');
  assert(actions[8] === RECEIPT_ACTIONS.WORLD_EVENT_TEASER_UNLOCKED, 'teaser unlock must be receipted after resolution');
  ok('reducer emits ordered receipts for start, evidence, contribution, resolution, and teaser unlock');

  return writer.receipts;
}

function verifyIntentDrivenPlayablePath(): void {
  const runtime = createWitnessMothBloomRuntime();
  const writer = makeChainWriter();

  const start = startWitnessMothBloom(runtime, { player_id: 'p_kael', map: 'Azura', now_ms: 10 }, writer.write);
  assert(start.ok && start.started, 'Azura herald should start the playable Bloom path');

  const invalid = handleWitnessMothBloomSkillIntent(
    runtime,
    { player_id: 'p_kael', map: 'Azura', skill_id: `${WITNESS_MOTH_BLOOM_SKILL_PREFIX}client_truth_claim`, now_ms: 11 },
    writer.write
  );
  assert(!invalid.ok && invalid.reason === 'invalid_skill', 'unknown event skill must be rejected as invalid_skill');
  assert(writer.receipts.length === 1, 'invalid event skill must not emit a receipt');

  const offMap = handleWitnessMothBloomSkillIntent(
    runtime,
    { player_id: 'p_kael', map: 'Rookguard', skill_id: `${WITNESS_MOTH_BLOOM_EVIDENCE_PREFIX}testimony_shard`, now_ms: 12 },
    writer.write
  );
  assert(!offMap.ok && offMap.reason === 'invalid_target', 'off-map event skill must be rejected as invalid_target');
  assert(writer.receipts.length === 1, 'off-map event skill must not emit a receipt');

  const steps = [
    `${WITNESS_MOTH_BLOOM_EVIDENCE_PREFIX}testimony_shard`,
    `${WITNESS_MOTH_BLOOM_EVIDENCE_PREFIX}damaged_ledger`,
    `${WITNESS_MOTH_BLOOM_EVIDENCE_PREFIX}moth_residue`,
    `${WITNESS_MOTH_BLOOM_SKILL_PREFIX}verify_testimony`,
    `${WITNESS_MOTH_BLOOM_SKILL_PREFIX}craft_lantern_frame`,
    `${WITNESS_MOTH_BLOOM_SKILL_PREFIX}defend_scribes`,
  ];
  for (let i = 0; i < steps.length; i += 1) {
    const result = handleWitnessMothBloomSkillIntent(
      runtime,
      { player_id: 'p_kael', map: 'Azura', skill_id: steps[i], now_ms: 20 + i },
      writer.write
    );
    if (steps[i].startsWith(WITNESS_MOTH_BLOOM_EVIDENCE_PREFIX)) {
      assert(result.ok && 'recovered' in result && result.recovered, `playable evidence ${steps[i]} should be recovered`);
    } else {
      assert(result.ok && 'recorded' in result && result.recorded, `playable contribution ${steps[i]} should be recorded`);
    }
  }

  assert(runtime.phase === 'resolved', 'playable path should resolve the Bloom');
  assert(writer.receipts.map((receipt) => receipt.action).join(',') === [
    RECEIPT_ACTIONS.WORLD_EVENT_STARTED,
    RECEIPT_ACTIONS.WORLD_EVENT_EVIDENCE_RECOVERED,
    RECEIPT_ACTIONS.WORLD_EVENT_EVIDENCE_RECOVERED,
    RECEIPT_ACTIONS.WORLD_EVENT_EVIDENCE_RECOVERED,
    RECEIPT_ACTIONS.WORLD_EVENT_CONTRIBUTION,
    RECEIPT_ACTIONS.WORLD_EVENT_CONTRIBUTION,
    RECEIPT_ACTIONS.WORLD_EVENT_CONTRIBUTION,
    RECEIPT_ACTIONS.WORLD_EVENT_RESOLVED,
    RECEIPT_ACTIONS.WORLD_EVENT_TEASER_UNLOCKED,
  ].join(','), 'playable path should emit the expected receipt sequence');
  ok('playable intent path rejects bad intents and resolves via use_skill ids');
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
  assert(rows.slice(1, 4).every((row) => row.source_action === RECEIPT_ACTIONS.WORLD_EVENT_EVIDENCE_RECOVERED), 'Chronicle should include evidence rows');
  assert(rows.slice(4, 7).every((row) => row.source_action === RECEIPT_ACTIONS.WORLD_EVENT_CONTRIBUTION), 'Chronicle should include contribution rows');
  assert(rows[7].source_action === RECEIPT_ACTIONS.WORLD_EVENT_RESOLVED, 'Chronicle should include resolution row');
  assert(rows[8].source_action === RECEIPT_ACTIONS.WORLD_EVENT_TEASER_UNLOCKED, 'Chronicle should include teaser unlock row');
  const resolvedDetails = JSON.parse(rows[7].details_json) as Record<string, unknown>;
  const teaserDetails = JSON.parse(rows[8].details_json) as Record<string, unknown>;
  assert(resolvedDetails.event_id === WITNESS_MOTH_BLOOM_EVENT_ID, 'Chronicle details should carry event_id');
  assert(resolvedDetails.outcome === 'controlled_release', 'Chronicle details should carry deterministic outcome');
  assert(teaserDetails.teaser_id === EMBER_ROAD_TEASER_ID, 'Chronicle details should carry teaser_id');
  db.close();
  ok('world event receipts materialize into Chronicle rows');
}

function verifyProjectionAndHydration(receipts: AuditReceipt[]): void {
  const db = freshDb();
  for (const receipt of receipts) materialize(db, receipt);
  for (const receipt of receipts) materialize(db, receipt);

  const row = db.prepare(`
    SELECT event_id, map, phase, started_by, started_at, resolved_by, resolved_at,
           outcome, contributions_json, evidence_json, teaser_json, last_receipt
    FROM world_events
    WHERE event_id = ?
  `).get(WITNESS_MOTH_BLOOM_EVENT_ID) as
    | {
        event_id: string;
        map: string;
        phase: string;
        started_by: string | null;
        started_at: string | null;
        resolved_by: string | null;
	        resolved_at: string | null;
	        outcome: string | null;
	        contributions_json: string;
	        evidence_json: string;
	        teaser_json: string;
	        last_receipt: string;
	      }
    | undefined;

  assert(row, 'world_events projection row should exist');
  assert(row.phase === 'resolved', `world_events row should be resolved, got ${row.phase}`);
  assert(row.outcome === 'controlled_release', `world_events outcome should be controlled_release, got ${row.outcome}`);
  const contributions = JSON.parse(row.contributions_json) as Record<string, unknown>;
  const evidence = JSON.parse(row.evidence_json) as Record<string, unknown>;
  const teaser = JSON.parse(row.teaser_json) as Record<string, unknown>;
  assert(Object.keys(contributions).length === 3, 'world_events row should retain all three contributions');
  assert(Object.keys(evidence).length === 3, 'world_events row should retain all three evidence items');
  assert(teaser.id === EMBER_ROAD_TEASER_ID && teaser.unlocked === true, 'world_events row should retain teaser unlock');

  const hydrated = createWitnessMothBloomRuntime();
  assert(hydrateWitnessMothBloomRuntime(hydrated, row), 'world_events row should hydrate runtime');
  assert(hydrated.phase === 'resolved', 'hydrated runtime should be resolved');
  assert(hydrated.outcome === 'controlled_release', 'hydrated runtime should preserve outcome');
  assert(Object.keys(hydrated.evidence).length === 3, 'hydrated runtime should preserve evidence');
  assert(Object.keys(hydrated.contributions).length === 3, 'hydrated runtime should preserve contributions');
  assert(hydrated.teaser?.id === EMBER_ROAD_TEASER_ID, 'hydrated runtime should preserve teaser unlock');
  db.close();
  ok('world event projection is idempotent and hydrates runtime state');
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
  verifyIntentDrivenPlayablePath();
  verifyChronicleMaterialization(receipts);
  verifyProjectionAndHydration(receipts);
  verifyNoRawDropRuntimeImport();
  console.log('\n[verify-world-events] All checks passed.');
}

main();
