#!/usr/bin/env node
// Verify Dialogue Contract v1 durable variation counter.
// Proves: the npc_talked receipt feeds a durable counter that (a) advances per
// talk, (b) survives a process restart (reopen), (c) is reconstructed
// identically by a rebuild-from-receipts replay ("receipts are canon"), and
// (d) deterministically seeds buildNpcDialogue so the same nonce → same line.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createReceiptLogger } from '@akalynth/coordination-kernel';
import { createPersistenceLayer } from '../src/persist/index.js';
import { getNpcDef, buildNpcDialogue } from '../src/world/npcs.js';

function fail(msg: string): never {
  console.error(`\n[verify-npc-dialogue-counter] FAIL: ${msg}`);
  process.exit(1);
}

function ok(msg: string): void {
  console.log(`[verify-npc-dialogue-counter] OK: ${msg}`);
}

const PLAYER = 'p_kael';
const NPC = 'azura_herald';

function main(): void {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akalynth-npc-counter-'));
  const receiptDir = path.join(tmpDir, 'receipts');
  const receiptsPath = path.join(receiptDir, 'receipts.jsonl');
  const dbPath = path.join(tmpDir, 'akalynth.db');
  const markerPath = path.join(tmpDir, 'replay_marker.json');
  const keyPath = path.join(tmpDir, 'chronicle.key');

  fs.mkdirSync(receiptDir, { recursive: true });
  fs.writeFileSync(keyPath, randomBytes(32), { mode: 0o600 });

  const persistLive = createPersistenceLayer({ dbPath, markerPath, receiptsPath, replayMode: 'strict' });
  const logger = createReceiptLogger({
    receiptDir,
    keyPath,
    onWrite: (receipt) => persistLive.materialize(receipt as never),
  });

  // Simulate the server's talk handler: nonce is read BEFORE the write, the
  // talk is recorded, and the next read sees the advanced count.
  const seenLines: string[] = [];
  const npc = getNpcDef(NPC)!;
  for (let i = 0; i < 5; i++) {
    const nonce = persistLive.getNpcTalkCount(PLAYER, NPC, 'stranger');
    if (nonce !== i) fail(`nonce should advance: expected ${i}, got ${nonce}`);
    seenLines.push(buildNpcDialogue(npc, 'stranger', { playerId: PLAYER, nonce }));
    logger.appendReceiptSync(PLAYER, 'npc_talked', { npc_id: NPC, tier: 'stranger' }, 'ok');
  }
  // A different tier counts independently.
  logger.appendReceiptSync(PLAYER, 'npc_talked', { npc_id: NPC, tier: 'seen' }, 'ok');

  if (persistLive.getNpcTalkCount(PLAYER, NPC, 'stranger') !== 5) fail('stranger count should be 5');
  if (persistLive.getNpcTalkCount(PLAYER, NPC, 'seen') !== 1) fail('seen count should be 1');
  if (persistLive.getNpcTalkCount(PLAYER, NPC, 'recognized') !== 0) fail('recognized count should be 0');
  logger.close();
  persistLive.close();
  ok('counter advances per talk and is tier-scoped');

  // (b) Cross-session reload: reopen the same DB, counts persist.
  const reopened = createPersistenceLayer({ dbPath, markerPath, receiptsPath, replayMode: 'strict' });
  if (reopened.getNpcTalkCount(PLAYER, NPC, 'stranger') !== 5) fail('count lost across reopen');
  reopened.close();
  ok('counter survives reconnect/restart (durable)');

  // (c) Rebuild from receipts: drop the DB + marker, replay the chain.
  fs.rmSync(dbPath, { force: true });
  fs.rmSync(markerPath, { force: true });
  const rebuilt = createPersistenceLayer({ dbPath, markerPath, receiptsPath, replayMode: 'strict' });
  rebuilt.startup();
  if (rebuilt.getNpcTalkCount(PLAYER, NPC, 'stranger') !== 5) fail('replay did not reconstruct stranger count');
  if (rebuilt.getNpcTalkCount(PLAYER, NPC, 'seen') !== 1) fail('replay did not reconstruct seen count');

  // (d) Determinism: lines recomputed from the rebuilt nonces match exactly.
  for (let nonce = 0; nonce < 5; nonce++) {
    const line = buildNpcDialogue(npc, 'stranger', { playerId: PLAYER, nonce });
    if (line !== seenLines[nonce]) fail(`line for nonce ${nonce} not reproducible after replay`);
  }
  // Idempotent: running replay again must not double-count (UNIQUE receipt_hash).
  rebuilt.startup();
  if (rebuilt.getNpcTalkCount(PLAYER, NPC, 'stranger') !== 5) fail('second replay double-counted');
  rebuilt.close();
  ok('counter is reconstructed by replay and idempotent (receipts are canon)');

  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log('\n[verify-npc-dialogue-counter] All checks passed.');
}

main();
