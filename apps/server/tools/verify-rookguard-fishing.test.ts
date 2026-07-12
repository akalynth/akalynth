#!/usr/bin/env tsx

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import {
  loadVerifyingKey,
  verifyChainLink,
  verifyEventSignature,
  verifyGenesisReceipt,
  verifyReceiptHashes,
  type CoordinationReceipt,
} from '@akalynth/coordination-kernel';
import type { AuditReceipt } from '../../../packages/shared/types.js';
import { ROOKGUARD_CANAL_FISHED_ACTION } from '../../../packages/shared/skills.js';
import {
  parseClientMessage,
  type UseSkillMessage,
} from '../../../packages/shared/protocol.js';
import { createAuditLogger } from '../src/audit/logger.js';
import { createPersistenceLayer, computeReceiptHash, generateItemId } from '../src/persist/index.js';
import { handleUseSkill, type SkillContext } from '../src/skills/index.js';
import {
  ROOKGUARD_FISHING_MERCHANT_REACTED_ACTION,
  ROOKGUARD_FISHING_RECOVERY_MS,
  ROOKGUARD_FISHING_SKILL_ID,
  applyReceiptToRookguardFishing,
  clearRookguardFishingProjection,
  getRookguardFishingState,
  rookguardFishingPublicState,
} from '../src/world/rookguardFishing.js';

const PLAYER_ID = 'p:fish-proof';
const PLAYER_NAME = 'Arin';
const BASE_NOW_MS = 1_760_000_000_000;
const ANDROID_FISH_FRAME = '{"type":"use_skill","skill_id":"activity:fishing:rookguard"}';

function androidFishMessage(): UseSkillMessage {
  const parsed = parseClientMessage(JSON.parse(ANDROID_FISH_FRAME));
  assert.ok(parsed && parsed.type === 'use_skill', 'shared parser accepts the Android Fish frame');
  return parsed;
}

function readReceipts(receiptsPath: string): AuditReceipt[] {
  return fs.readFileSync(receiptsPath, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as AuditReceipt);
}

function verifySignedChain(receipts: AuditReceipt[], keyPath: string): void {
  const verifyKey = loadVerifyingKey(keyPath);
  receipts.forEach((receipt, index) => {
    const current = receipt as unknown as CoordinationReceipt;
    assert.equal(verifyReceiptHashes(current).ok, true, `receipt ${receipt.sequence} hashes`);
    if (index === 0) {
      assert.equal(verifyGenesisReceipt(current), true, 'first receipt is genesis');
    } else {
      assert.equal(
        verifyChainLink(receipts[index - 1] as unknown as CoordinationReceipt, current),
        true,
        `receipt ${receipt.sequence} links to its predecessor`,
      );
    }
    assert.equal(
      verifyEventSignature(receipt.prev_hash, receipt.event_hash, receipt.signature, verifyKey),
      true,
      `receipt ${receipt.sequence} signature`,
    );
  });
}

function makeSkillContext(input: {
  nowMs: number;
  write: (receipt: Parameters<SkillContext['audit']>[0]) => AuditReceipt;
  sent: unknown[];
  cooldowns?: Map<string, number>;
  onResolved?: (skillId: string) => void;
  map?: 'Rookguard' | 'Azura';
  withInventoryMint?: boolean;
}): SkillContext {
  const mintItemToInventory = input.withInventoryMint
    ? (itemType: string, meta: Record<string, unknown>, reason: string, source: string) => {
      const minted = input.write({
        player_id: PLAYER_ID,
        action: 'item_minted',
        inputs: { item_type: itemType, meta, reason },
        result: 'ok',
      });
      const itemId = generateItemId(computeReceiptHash(minted));
      input.write({
        player_id: PLAYER_ID,
        action: 'item_added_to_inventory',
        inputs: { item_id: itemId, slot: null, source },
        result: 'ok',
      });
      return { item_id: itemId, item_type: itemType };
    }
    : undefined;

  return {
    playerId: PLAYER_ID,
    playerName: PLAYER_NAME,
    ws: {} as SkillContext['ws'],
    antiState: {} as SkillContext['antiState'],
    skillCooldowns: input.cooldowns ?? new Map(),
    currentMap: input.map ?? 'Rookguard',
    inWorld: true,
    nowMs: () => input.nowMs,
    audit: (receipt) => { input.write(receipt); },
    findPlayerOnline: () => null,
    issueTem: () => ({ outcome: 'none' }),
    getChronicle: () => [],
    send: (message) => input.sent.push(message),
    mintItemToInventory,
    syncInventory: input.withInventoryMint ? () => {} : undefined,
    onSkillResolved: input.onResolved as SkillContext['onSkillResolved'],
  };
}

function skillResult(sent: unknown[]): Record<string, unknown> {
  const result = [...sent].reverse().find((message) => (
    message !== null
      && typeof message === 'object'
      && (message as { type?: string }).type === 'skill_result'
  ));
  assert.ok(result, 'skill_result was sent');
  return result as Record<string, unknown>;
}

async function main(): Promise<void> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akalynth-rookguard-fishing-'));
  const receiptDir = path.join(tmpDir, 'receipts');
  const receiptsPath = path.join(receiptDir, 'receipts.jsonl');
  const dbPath = path.join(tmpDir, 'akalynth.db');
  const markerPath = path.join(tmpDir, 'replay-marker.json');
  const keyPath = path.join(tmpDir, 'chronicle.key');

  fs.mkdirSync(receiptDir, { recursive: true });
  fs.writeFileSync(keyPath, randomBytes(32), { mode: 0o600 });
  clearRookguardFishingProjection();

  const live = createPersistenceLayer({ dbPath, markerPath, receiptsPath, replayMode: 'strict' });
  const logger = createAuditLogger({
    receiptPath: receiptsPath,
    keyPath,
    onWrite: (receipt, offsetAfterLine) => live.materialize(receipt, offsetAfterLine),
  });
  logger.write({
    player_id: PLAYER_ID,
    action: 'session_guest_minted',
    inputs: { source: 'causal-world-proof', name: PLAYER_NAME },
    result: 'ok',
  });

  const wrongMapSent: unknown[] = [];
  await handleUseSkill(
    makeSkillContext({
      nowMs: BASE_NOW_MS,
      write: (receipt) => logger.write(receipt),
      sent: wrongMapSent,
      cooldowns: new Map(),
      map: 'Azura',
    }),
    androidFishMessage(),
  );
  assert.equal(skillResult(wrongMapSent).success, false, 'server rejects Fish outside Rookguard');
  assert.equal(skillResult(wrongMapSent).reason, 'invalid_target');
  assert.equal(getRookguardFishingState().cast_count, 0, 'rejected intent has no world consequence');

  const sent: unknown[] = [];
  const resolvedIds: string[] = [];
  const mintedItemIds: string[] = [];
  await handleUseSkill(
    makeSkillContext({
      nowMs: BASE_NOW_MS,
      write: (receipt) => {
        const written = logger.write(receipt);
        if (receipt.action === 'item_added_to_inventory') {
          mintedItemIds.push((receipt.inputs.item_id as string));
        }
        return written;
      },
      sent,
      withInventoryMint: true,
      onResolved: (skillId) => resolvedIds.push(skillId),
    }),
    androidFishMessage(),
  );

  const firstResult = skillResult(sent);
  assert.equal(firstResult.success, true, 'server authoritatively resolves Fish');
  assert.deepEqual(resolvedIds, [ROOKGUARD_FISHING_SKILL_ID], 'post-resolution projection hook runs');

  const firstState = getRookguardFishingState();
  assert.equal(firstState.cast_count, 1);
  assert.equal(firstState.merchant_behavior, 'noticing_patience');
  assert.equal(firstState.merchant_respect, 1);
  assert.equal(firstState.last_actor, PLAYER_ID);
  assert.equal(firstState.recovers_at_ms, BASE_NOW_MS + ROOKGUARD_FISHING_RECOVERY_MS);
  assert.equal(mintedItemIds.length, 1, 'first Fish call mints one inventory item');
  const firstInventoryItems = live.getPlayerInventory(PLAYER_ID);
  assert.equal(firstInventoryItems.length, 1, 'first Fish action persists an inventory item');

  const firstRunReceipts = readReceipts(receiptsPath);
  clearRookguardFishingProjection();
  firstRunReceipts.forEach(applyReceiptToRookguardFishing);
  assert.deepEqual(getRookguardFishingState(), firstState, 'restart replay preserves an in-progress recovery');

  const reconnectView = rookguardFishingPublicState(BASE_NOW_MS + 1_000);
  assert.equal(reconnectView.phase, 'recovering');
  assert.equal(reconnectView.remaining_recovery_ms, ROOKGUARD_FISHING_RECOVERY_MS - 1_000);
  assert.match(reconnectView.merchant_memory ?? '', /Arin/);

  const beforeRecoverySent: unknown[] = [];
  await handleUseSkill(
    makeSkillContext({
      nowMs: BASE_NOW_MS + 1_000,
      write: (receipt) => logger.write(receipt),
      sent: beforeRecoverySent,
      cooldowns: new Map(),
    }),
    androidFishMessage(),
  );
  const beforeRecoveryResult = skillResult(beforeRecoverySent);
  assert.equal(beforeRecoveryResult.success, false, 'new session cannot bypass world recovery');
  assert.equal(beforeRecoveryResult.reason, 'cooldown');
  assert.equal(beforeRecoveryResult.cooldown_until_ms, BASE_NOW_MS + ROOKGUARD_FISHING_RECOVERY_MS);

  const secondNowMs = BASE_NOW_MS + ROOKGUARD_FISHING_RECOVERY_MS;
  const afterRecoverySent: unknown[] = [];
  await handleUseSkill(
    makeSkillContext({
      nowMs: secondNowMs,
      write: (receipt) => {
        const written = logger.write(receipt);
        if (receipt.action === 'item_added_to_inventory') {
          mintedItemIds.push((receipt.inputs.item_id as string));
        }
        return written;
      },
      sent: afterRecoverySent,
      cooldowns: new Map(),
      withInventoryMint: true,
    }),
    androidFishMessage(),
  );
  assert.equal(skillResult(afterRecoverySent).success, true, 'elapsed deadline restores Fish availability');
  assert.equal(getRookguardFishingState().cast_count, 2);
  assert.equal(getRookguardFishingState().merchant_respect, 2);
  assert.equal(mintedItemIds.length, 2, 'second Fish call mints another inventory item');
  assert.equal(
    new Set(mintedItemIds).size,
    mintedItemIds.length,
    'each Fish mint produces a distinct item',
  );
  assert.equal(
    live.getPlayerInventory(PLAYER_ID).length,
    2,
    'second Fish action persists an additional inventory item',
  );

  const liveCanonicalState = getRookguardFishingState();
  const liveChronicle = live.getChronicleForPlayer(PLAYER_ID, 50)
    .filter((row) => row.source_action === ROOKGUARD_CANAL_FISHED_ACTION
      || row.source_action === ROOKGUARD_FISHING_MERCHANT_REACTED_ACTION);
  assert.equal(liveChronicle.length, 4, 'two Fish resolutions and two merchant reactions reach Chronicle');
  const liveDetails = liveChronicle.map((row) => JSON.parse(row.details_json) as Record<string, unknown>);
  assert.equal(liveDetails.filter((details) => details.event_id === 'rookguard_canal_fishing').length, 2);
  assert.equal(liveDetails.filter((details) => details.event_id === 'rookguard_canal_merchant').length, 2);
  assert.ok(liveDetails.some((details) => details.outcome === 'noticing_patience'));

  logger.close();
  live.close();

  const receipts = readReceipts(receiptsPath);
  const mintedReceipts = receipts.filter((receipt) => receipt.action === 'item_minted');
  const inventoryReceipts = receipts.filter((receipt) => receipt.action === 'item_added_to_inventory');
  assert.equal(mintedReceipts.length, 2, 'fishing mints one item per accepted action');
  assert.equal(inventoryReceipts.length, 2, 'fishing adds one item per accepted action');
  verifySignedChain(receipts, keyPath);
  const intentReceipt = receipts.find((receipt) => receipt.action === 'skill_use_intent');
  assert.ok(intentReceipt, 'server records the existing Fish intent');
  assert.equal(intentReceipt.inputs.skill_id, ROOKGUARD_FISHING_SKILL_ID);
  for (const forbidden of ['player_id', 'map', 'x', 'y', 'catch_state', 'merchant_behavior']) {
    assert.equal(forbidden in intentReceipt.inputs, false, `intent receipt does not trust client ${forbidden}`);
  }
  const fishingReceipts = receipts.filter((receipt) => receipt.action === ROOKGUARD_CANAL_FISHED_ACTION);
  assert.equal(fishingReceipts.length, 2, 'only accepted Fish intents emit world-resolution receipts');
  assert.deepEqual(
    receipts.filter((receipt) => receipt.action === ROOKGUARD_FISHING_MERCHANT_REACTED_ACTION).length,
    2,
    'each accepted Fish resolution causes one merchant reaction',
  );
  for (const fishingReceipt of fishingReceipts) {
    const index = receipts.indexOf(fishingReceipt);
    const reaction = receipts[index + 1];
    assert.equal(reaction?.action, ROOKGUARD_FISHING_MERCHANT_REACTED_ACTION, 'merchant reaction follows Fish resolution');
    assert.equal(reaction?.inputs.parent_event_id, fishingReceipt.inputs.event_id, 'merchant reaction is causally linked');
  }
  assert.equal(
    (fishingReceipts[1].inputs.state_before as Record<string, unknown>).canal_state,
    'calm',
    'elapsed recovery is reflected in the next authoritative pre-state',
  );

  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${dbPath}${suffix}`, { force: true });
  fs.rmSync(markerPath, { force: true });

  const rebuilt = createPersistenceLayer({ dbPath, markerPath, receiptsPath, replayMode: 'strict' });
  rebuilt.startup();
  assert.deepEqual(getRookguardFishingState(), liveCanonicalState, 'full replay reconstructs identical canonical world state');

  const recoveredAfterRestart = rookguardFishingPublicState(
    secondNowMs + ROOKGUARD_FISHING_RECOVERY_MS + 1,
  );
  assert.equal(recoveredAfterRestart.phase, 'ready', 'restart view accounts for elapsed recovery time');
  assert.equal(recoveredAfterRestart.remaining_recovery_ms, 0);
  assert.equal(recoveredAfterRestart.merchant_behavior, 'noticing_patience');
  assert.equal(recoveredAfterRestart.merchant_respect, 2);

  const rebuiltChronicle = rebuilt.getChronicleForPlayer(PLAYER_ID, 50)
    .filter((row) => row.source_action === ROOKGUARD_CANAL_FISHED_ACTION
      || row.source_action === ROOKGUARD_FISHING_MERCHANT_REACTED_ACTION);
  assert.equal(rebuiltChronicle.length, 4, 'Chronicle projection rebuilds from canonical receipts');

  rebuilt.startup();
  assert.deepEqual(getRookguardFishingState(), liveCanonicalState, 'incremental replay remains deterministic');
  const idempotentChronicle = rebuilt.getChronicleForPlayer(PLAYER_ID, 50)
    .filter((row) => row.source_action === ROOKGUARD_CANAL_FISHED_ACTION
      || row.source_action === ROOKGUARD_FISHING_MERCHANT_REACTED_ACTION);
  assert.equal(idempotentChronicle.length, 4, 'replay does not duplicate Chronicle rows');
  rebuilt.close();

  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log('[verify-rookguard-fishing] Android intent contract -> authority -> receipts -> world state -> merchant -> Chronicle -> recovery -> reconnect -> replay: PASS');
}

main().catch((error) => {
  console.error('[verify-rookguard-fishing] FAIL', error);
  process.exit(1);
});
