#!/usr/bin/env node

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createReceiptLogger } from '@akalynth/coordination-kernel';
import { createPersistenceLayer } from '../src/persist/index.js';
import { createAntiCheatRuntime, hydrateAntiCheatRuntime } from '../src/anticheat/detector.js';
import { handleTemResponse, issueTemChallenge } from '../src/anticheat/tem.js';
import { hydrateHeatState } from '../src/world/heat.js';
import { TEM_CHALLENGE_RESPONSE, THROTTLE_DURATION_MS } from '../../../packages/shared/types.js';

interface ReceiptLine {
  action: string;
  timestamp: string;
  actor_id: string;
  inputs: Record<string, unknown>;
}

function fail(msg: string): never {
  console.error(`\n[verify-anticheat-persistence] FAIL: ${msg}`);
  process.exit(1);
}

function ok(msg: string): void {
  console.log(`[verify-anticheat-persistence] OK: ${msg}`);
}

function main(): void {
  assertTemChallengeContract();

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akalynth-anticheat-'));
  const receiptDir = path.join(tmpDir, 'receipts');
  const receiptsPath = path.join(receiptDir, 'receipts.jsonl');
  const dbPath = path.join(tmpDir, 'akalynth.db');
  const markerPath = path.join(tmpDir, 'replay_marker.json');
  const keyPath = path.join(tmpDir, 'chronicle.key');

  fs.mkdirSync(receiptDir, { recursive: true });
  fs.writeFileSync(keyPath, randomBytes(32), { mode: 0o600 });

  const persistLive = createPersistenceLayer({
    dbPath,
    markerPath,
    receiptsPath,
    replayMode: 'strict',
  });

  const logger = createReceiptLogger({
    receiptDir,
    keyPath,
    onWrite: (receipt) => {
      persistLive.materialize(receipt as never);
    },
  });

  logger.appendReceiptSync('p_demo', 'heat_changed', {
    prev_score: 0,
    new_score: 42,
    delta: 42,
    reason: 'perfect_cadence',
    decay_applied: 0,
  }, 'ok');
  logger.appendReceiptSync('p_demo', 'heat_tem_escalation', {
    score: 42,
    reason: 'perfect_cadence',
    cooldown_ms: 60000,
  }, 'requested');
  logger.appendReceiptSync('p_demo', 'heat_penalty_applied', {
    score: 42,
    penalty_type: 'move_throttle',
    duration_ms: 120000,
  }, 'applied');
  logger.appendReceiptSync('p_demo', 'tem_challenge_failed', {
    reason: 'wrong_response',
  }, 'throttled');
  logger.appendReceiptSync('p_demo', 'kick', {
    trigger: 'chat_spam',
    reason: 'chat_spam_while_throttled',
  }, 'kicked');
  logger.close();
  persistLive.close();

  const receipts = readReceipts(receiptsPath);
  const penaltyReceipt = receipts.find((receipt) => receipt.action === 'heat_penalty_applied');
  const temFailReceipt = receipts.find((receipt) => receipt.action === 'tem_challenge_failed');
  const escalationReceipt = receipts.find((receipt) => receipt.action === 'heat_tem_escalation');
  if (!penaltyReceipt || !temFailReceipt || !escalationReceipt) {
    fail('missing expected anti-cheat receipts');
  }

  const expectedPenaltyUntil = Date.parse(penaltyReceipt.timestamp) + Number(penaltyReceipt.inputs.duration_ms);
  const expectedThrottleUntil = Date.parse(temFailReceipt.timestamp) + THROTTLE_DURATION_MS;
  const expectedLastTemMs = Date.parse(escalationReceipt.timestamp);

  assertProjection(dbPath, markerPath, receiptsPath, expectedPenaltyUntil, expectedThrottleUntil, expectedLastTemMs);

  fs.rmSync(dbPath, { force: true });
  fs.rmSync(markerPath, { force: true });

  const persistReplay = createPersistenceLayer({
    dbPath,
    markerPath,
    receiptsPath,
    replayMode: 'strict',
  });
  persistReplay.startup();
  persistReplay.close();

  assertProjection(dbPath, markerPath, receiptsPath, expectedPenaltyUntil, expectedThrottleUntil, expectedLastTemMs);

  ok('receipt-backed anti-cheat state survives replay and restore');
}

function assertTemChallengeContract(): void {
  if (TEM_CHALLENGE_RESPONSE !== 'AKALYNTH') {
    fail(`expected Tem challenge response AKALYNTH, got ${TEM_CHALLENGE_RESPONSE}`);
  }

  const runtime = createAntiCheatRuntime(0);
  const issued = issueTemChallenge(runtime.state, 1_000);
  if (issued.outcome !== 'issued') fail('Tem challenge did not issue');
  if (!issued.challenge.message.includes(TEM_CHALLENGE_RESPONSE)) {
    fail('Tem challenge prompt does not include the shared response phrase');
  }

  const legacyRuntime = createAntiCheatRuntime(0);
  issueTemChallenge(legacyRuntime.state, 1_000);
  const legacy = handleTemResponse(legacyRuntime.state, 'AZURA');
  if (legacy.outcome !== 'failed' || legacy.reason !== 'wrong_response') {
    fail('legacy AZURA response unexpectedly satisfies Tem challenge');
  }

  const passRuntime = createAntiCheatRuntime(0);
  issueTemChallenge(passRuntime.state, 1_000);
  const pass = handleTemResponse(passRuntime.state, ' akalynth ');
  if (pass.outcome !== 'passed') fail('AKALYNTH response did not satisfy Tem challenge');

  ok('Tem challenge response contract uses AKALYNTH');
}

function assertProjection(
  dbPath: string,
  markerPath: string,
  receiptsPath: string,
  expectedPenaltyUntil: number,
  expectedThrottleUntil: number,
  expectedLastTemMs: number
): void {
  const persist = createPersistenceLayer({
    dbPath,
    markerPath,
    receiptsPath,
    replayMode: 'strict',
  });

  const savedHeat = persist.getPlayerHeat('p_demo');
  if (!savedHeat) fail('player_heat projection missing');
  if (savedHeat.heat !== 42) fail(`expected heat 42, got ${savedHeat.heat}`);
  if (savedHeat.penalty_until_ms !== expectedPenaltyUntil) {
    fail(`expected penalty_until_ms ${expectedPenaltyUntil}, got ${savedHeat.penalty_until_ms}`);
  }
  if (savedHeat.last_tem_ms !== expectedLastTemMs) {
    fail(`expected last_tem_ms ${expectedLastTemMs}, got ${savedHeat.last_tem_ms}`);
  }

  const savedAnti = persist.getPlayerAntiCheatEnforcement('p_demo');
  if (!savedAnti) fail('player_anticheat_enforcement projection missing');
  if (savedAnti.tem_failed_count !== 1) fail(`expected tem_failed_count 1, got ${savedAnti.tem_failed_count}`);
  if (savedAnti.throttle_count !== 1) fail(`expected throttle_count 1, got ${savedAnti.throttle_count}`);
  if (savedAnti.kick_count !== 1) fail(`expected kick_count 1, got ${savedAnti.kick_count}`);
  if (savedAnti.throttle_until_ms !== expectedThrottleUntil) {
    fail(`expected throttle_until_ms ${expectedThrottleUntil}, got ${savedAnti.throttle_until_ms}`);
  }

  const nowBeforeExpiry = expectedPenaltyUntil - 1000;
  const hydratedHeat = hydrateHeatState(savedHeat, nowBeforeExpiry, 0);
  if (hydratedHeat.penalty_until_ms !== expectedPenaltyUntil) {
    fail('hydrated heat lost active penalty window');
  }

  const nowAfterExpiry = expectedPenaltyUntil + 1000;
  const hydratedHeatAfterExpiry = hydrateHeatState(savedHeat, nowAfterExpiry, 0);
  if (hydratedHeatAfterExpiry.penalty_until_ms !== null) {
    fail('hydrated heat kept expired penalty window');
  }

  const hydratedAnti = hydrateAntiCheatRuntime(savedAnti, expectedThrottleUntil - 1000);
  if (hydratedAnti.state.kickCount !== 1) fail('hydrated anti-cheat lost kick count');
  if (hydratedAnti.state.warnCount !== 0) fail('hydrated anti-cheat warn count mismatch');
  if (hydratedAnti.state.throttleUntil !== expectedThrottleUntil) {
    fail('hydrated anti-cheat lost active throttle window');
  }

  const hydratedAntiAfterExpiry = hydrateAntiCheatRuntime(savedAnti, expectedThrottleUntil + 1000);
  if (hydratedAntiAfterExpiry.state.throttleUntil !== null) {
    fail('hydrated anti-cheat kept expired throttle window');
  }

  persist.close();
}

function readReceipts(receiptsPath: string): ReceiptLine[] {
  const raw = fs.readFileSync(receiptsPath, 'utf8');
  return raw
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as ReceiptLine);
}

main();
