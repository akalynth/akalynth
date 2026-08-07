#!/usr/bin/env tsx

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  loadVerifyingKey,
  verifyChainLink,
  verifyEventSignature,
  verifyGenesisReceipt,
  verifyReceiptHashes,
  type CoordinationReceipt,
} from '@akalynth/coordination-kernel';
import type { AuditReceipt } from '../../../packages/shared/types.js';
import { causalPlayerViewForDetails, SHARED_WORLD_IDS, type CausalParityEvent } from '../../../packages/shared/causalParity.js';
import {
  FORGEHOLD_CARAVAN_EVENT_ID,
  FORGEHOLD_CARAVAN_EVIDENCE_RECOVERED_ACTION,
  FORGEHOLD_CARAVAN_GUARD_DECISION_ACTION,
  FORGEHOLD_CARAVAN_MERCHANT_ARRIVED_ACTION,
  FORGEHOLD_CARAVAN_MERCHANT_ID,
  FORGEHOLD_CARAVAN_MERCHANT_TRAVEL_MS,
  ROOKGUARD_CANAL_FISHED_ACTION,
} from '../../../packages/shared/skills.js';
import { ROOKGUARD_FISHING_RECOVERY_MS } from '../src/world/rookguardFishing.js';
import { parseClientMessage, type UseSkillMessage } from '../../../packages/shared/protocol.js';
import { createAuditLogger } from '../src/audit/logger.js';
import { createPersistenceLayer, computeReceiptHash, generateItemId } from '../src/persist/index.js';
import { handleUseSkill, type SkillContext } from '../src/skills/index.js';
import { sharedWorldObservationFromRows } from '../src/chronicle/sharedWorldObservation.js';
import { advanceForgeholdCaravanActor } from '../src/world/autonomousCaravan.js';
import {
  applyReceiptToOnwardRoutes,
  clearOnwardRouteProjection,
  getOnwardRouteReceiptProgress,
} from '../src/world/onwardRoutes.js';
import {
  applyReceiptToRookguardFishing,
  clearRookguardFishingProjection,
  getRookguardFishingState,
} from '../src/world/rookguardFishing.js';

const PLAYER_ID = 'p:fishing-caravan-proof';
const PLAYER_NAME = 'Arin';
const BASE_NOW_MS = 1_760_000_000_000;
const ANDROID_FISH_FRAME = '{"type":"use_skill","skill_id":"activity:fishing:rookguard"}';

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

function androidFishMessage(): UseSkillMessage {
  const parsed = parseClientMessage(JSON.parse(ANDROID_FISH_FRAME));
  assert.ok(parsed && parsed.type === 'use_skill', 'shared parser accepts the Android Fish frame');
  return parsed;
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

function makeSkillContext(input: {
  nowMs: number;
  write: (receipt: Parameters<SkillContext['audit']>[0]) => AuditReceipt;
  sent: unknown[];
  cooldowns: Map<string, number>;
  map?: 'Rookguard' | 'Azura';
  withInventoryMint?: boolean;
}): SkillContext {
  const write = (receipt: Parameters<SkillContext['audit']>[0]): AuditReceipt => {
    return input.write(receipt);
  };
  const mintItemToInventory = input.withInventoryMint
    ? (itemType: string, meta: Record<string, unknown>, reason: string, source: string) => {
      const minted = write({
        player_id: PLAYER_ID,
        action: 'item_minted',
        inputs: { item_type: itemType, meta, reason },
        result: 'ok',
      });
      const itemId = generateItemId(computeReceiptHash(minted));
      write({
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
    skillCooldowns: input.cooldowns,
    currentMap: input.map ?? 'Rookguard',
    inWorld: true,
    onwardRoutesAvailable: true,
    getOnwardRouteProgress: () => getOnwardRouteReceiptProgress(PLAYER_ID),
    nowMs: () => input.nowMs,
    audit: (receipt) => { write(receipt); },
    findPlayerOnline: () => null,
    issueTem: () => ({ outcome: 'none' }),
    getChronicle: () => [],
    send: (message) => input.sent.push(message),
    mintItemToInventory,
    syncInventory: input.withInventoryMint ? () => {} : undefined,
  };
}

async function main(): Promise<void> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'akalynth-fishing-caravan-'));
  const receiptDir = path.join(tmpDir, 'receipts');
  const receiptsPath = path.join(receiptDir, 'receipts.jsonl');
  const dbPath = path.join(tmpDir, 'akalynth.db');
  const markerPath = path.join(tmpDir, 'replay-marker.json');
  const keyPath = path.join(tmpDir, 'chronicle.key');

  fs.mkdirSync(receiptDir, { recursive: true });
  fs.writeFileSync(keyPath, randomBytes(32), { mode: 0o600 });
  clearOnwardRouteProjection();
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
    inputs: { source: 'fishing-caravan-event-proof', name: PLAYER_NAME },
    result: 'ok',
  });

  const cooldowns = new Map<string, number>();
  const mintedItemIds: string[] = [];

  const fishSent: unknown[] = [];
  await handleUseSkill(
    makeSkillContext({
      nowMs: BASE_NOW_MS,
      sent: fishSent,
      cooldowns,
      withInventoryMint: true,
      write: (receipt) => {
        const written = logger.write(receipt);
        if (receipt.action === 'item_added_to_inventory') {
          mintedItemIds.push(receipt.inputs.item_id as string);
        }
        return written;
      },
    }),
    androidFishMessage(),
  );
  assert.equal(skillResult(fishSent).success, true, 'fishing intent resolves through the shared use_skill path');
  assert.equal(mintedItemIds.length, 1, 'fishing mint is captured in inventory receipts');

  const blockedCaravanSent: unknown[] = [];
  await handleUseSkill(
    makeSkillContext({
      nowMs: BASE_NOW_MS,
      sent: blockedCaravanSent,
      cooldowns,
      write: (receipt) => logger.write(receipt),
    }),
    { type: 'use_skill', skill_id: 'route:evidence:caravan' },
  );
  assert.equal(skillResult(blockedCaravanSent).success, false, 'caravan requires prior milepost evidence');
  assert.equal(skillResult(blockedCaravanSent).reason, 'invalid_target');
  assert.equal(
    getOnwardRouteReceiptProgress(PLAYER_ID).forgeholdCaravanEvidenceRecovered,
    false,
    'rejected caravan intent has no route consequence',
  );

  for (const skillId of ['route:survey:forgehold', 'route:evidence:milepost', 'route:evidence:caravan']) {
    const sent: unknown[] = [];
    await handleUseSkill(
      makeSkillContext({
        nowMs: BASE_NOW_MS,
        sent,
        cooldowns,
        write: (receipt) => logger.write(receipt),
      }),
      { type: 'use_skill', skill_id: skillId },
    );
    assert.equal(skillResult(sent).success, true, `${skillId} resolves through the shared use_skill path`);
  }

  const routeStateBeforeMerchant = getOnwardRouteReceiptProgress(PLAYER_ID);
  assert.equal(routeStateBeforeMerchant.forgeholdSurveyed, true, 'survey state is receipt-derived');
  assert.equal(routeStateBeforeMerchant.forgeholdMilepostEvidenceRecovered, true, 'milepost state is receipt-derived');
  assert.equal(routeStateBeforeMerchant.forgeholdCaravanEvidenceRecovered, true, 'caravan state is receipt-derived');
  assert.equal(routeStateBeforeMerchant.forgeholdCaravanProtection.route_safety, 'monitored', 'caravan protection state includes NPC monitoring');
  assert.equal(routeStateBeforeMerchant.forgeholdCaravanProtection.merchant_access, 'open', 'caravan action keeps route access open');
  assert.equal(routeStateBeforeMerchant.forgeholdCaravanProtection.merchant_stock, 0, 'caravan guard updates stock reserve');
  assert.equal(routeStateBeforeMerchant.forgeholdCaravanProtection.bandit_pressure, 1, 'caravan guard lowers bandit pressure');
  assert.equal(routeStateBeforeMerchant.forgeholdCaravanProtection.player_trust, 2, 'player trust advances after NPC decision');
  const merchantDueAtMs = routeStateBeforeMerchant.forgeholdCaravanProtection.merchant_travel_due_at_ms;
  assert.equal(merchantDueAtMs, BASE_NOW_MS + FORGEHOLD_CARAVAN_MERCHANT_TRAVEL_MS, 'guard receipt schedules Merchant Lora from the world clock');
  const beforeMerchantAdvance = advanceForgeholdCaravanActor(
    live.getSharedWorldEvents(SHARED_WORLD_IDS.forgeholdCaravanRoute, 50),
    merchantDueAtMs - 1,
    (receipt) => logger.write(receipt),
  );
  assert.equal(beforeMerchantAdvance.emitted, false, 'Merchant Lora does not arrive before the deadline');
  const merchantAdvance = advanceForgeholdCaravanActor(
    live.getSharedWorldEvents(SHARED_WORLD_IDS.forgeholdCaravanRoute, 50),
    merchantDueAtMs,
    (receipt) => logger.write(receipt),
  );
  assert.equal(merchantAdvance.emitted, true, 'world time advances Merchant Lora autonomously');
  assert.equal(merchantAdvance.event_instance_id, `${FORGEHOLD_CARAVAN_EVENT_ID}:1:guard:merchant_arrived`);
  const repeatedMerchantAdvance = advanceForgeholdCaravanActor(
    live.getSharedWorldEvents(SHARED_WORLD_IDS.forgeholdCaravanRoute, 50),
    merchantDueAtMs,
    (receipt) => logger.write(receipt),
  );
  assert.equal(repeatedMerchantAdvance.emitted, false, 'repeated world scans do not emit a second arrival');
  const liveRouteState = getOnwardRouteReceiptProgress(PLAYER_ID);
  assert.equal(liveRouteState.forgeholdCaravanProtection.merchant_stock, 1, 'autonomous arrival restocks the route');
  assert.equal(liveRouteState.forgeholdCaravanProtection.merchant_travel_due_at_ms, null, 'arrival consumes the pending travel consequence');
  assert.equal(liveRouteState.forgeholdCaravanProtection.last_actor, FORGEHOLD_CARAVAN_MERCHANT_ID, 'route projection records the autonomous actor');
  const liveFishingState = getRookguardFishingState();
  assert.equal(liveFishingState.cast_count, 1, 'fishing state is receipt-derived');

  const liveWorldEvents = live.getChronicleForPlayer(PLAYER_ID, 50)
    .filter((row) => row.kind === 'world_event');
  assert.equal(liveWorldEvents.length, 5, 'fishing, merchant reaction, caravan evidence, guard decision, and autonomous arrival share world_event rows');
  const liveDetails = liveWorldEvents.map((row) => JSON.parse(row.details_json) as Record<string, unknown>);
  const receiptsForProof = readReceipts(receiptsPath);
  const causalEvents = liveWorldEvents.map((row) => {
    const details = JSON.parse(row.details_json) as Record<string, unknown>;
    const causal = details.causal as CausalParityEvent | undefined;
    assert.ok(causal, 'world-event Chronicle rows carry the shared causal parity contract');
    const sourceReceipt = receiptsForProof.find((receipt) => computeReceiptHash(receipt) === row.receipt_hash);
    assert.ok(sourceReceipt, 'causal Chronicle row resolves to its canonical receipt');
    assert.deepEqual(causal.player_view, causalPlayerViewForDetails(details));
    assert.equal(causal.actor_id, sourceReceipt.actor_id, 'actor parity');
    assert.equal(causal.receipt.hash, row.receipt_hash, 'receipt hash parity');
    assert.equal(causal.receipt.sequence, sourceReceipt.sequence, 'receipt sequence parity');
    assert.equal(causal.chronicle.event_id, row.id, 'Chronicle reference parity');
    return causal;
  });

  const fishingDetails = liveDetails.find((details) => details.event_id === 'rookguard_canal_fishing');
  assert.ok(fishingDetails, 'fishing event uses the shared event identity lane');
  assert.equal(fishingDetails.next_objective, 'Wait for the canal to settle, then fish again.');
  const fishState = fishingDetails.world_state as Record<string, unknown> | undefined;
  assert.equal(fishState?.minted_item && typeof fishState?.minted_item === 'object' ? (fishState?.minted_item as Record<string, unknown>).item_type : undefined, 'mark_token');
  assert.equal(fishState?.minted_item && typeof fishState?.minted_item === 'object' ? (fishState?.minted_item as Record<string, unknown>).item_id : undefined, mintedItemIds[0]);
  assert.equal(fishState?.canal_state, 'disturbed');
  assert.equal(fishState?.catch_state, 'nothing_tradeable');
  assert.equal(fishState?.cast_count, 1);
  assert.equal(fishState?.recovers_at_ms, BASE_NOW_MS + ROOKGUARD_FISHING_RECOVERY_MS);
  const merchantDetails = liveDetails.find((details) => details.event_id === 'rookguard_canal_merchant');
  assert.ok(merchantDetails, 'merchant reaction uses the shared event identity lane');
  assert.deepEqual(merchantDetails.world_state, {
    merchant_behavior: 'noticing_patience',
    merchant_respect: 1,
  });
  const caravanDetails = liveDetails.find((details) => details.event_type === 'caravan_evidence_recovered');
  assert.ok(caravanDetails, 'caravan event uses the shared event identity lane');
  assert.equal(caravanDetails.event_type, 'caravan_evidence_recovered');
  assert.equal(caravanDetails.evidence_object_id, 'charred_shipment_plate');
  assert.equal(caravanDetails.route_id, 'forgehold_route_slice_v1');
  assert.equal(caravanDetails.next_objective, 'Recover the Ashglass Shard at Ashglass Ravine.');
  const guardDetails = liveDetails.find((details) => details.event_type === 'caravan_guard_patrol_set');
  assert.ok(guardDetails, 'caravan guard decision writes the same world_event lane with causal linkage');
  assert.equal(guardDetails.parent_event_id, `${FORGEHOLD_CARAVAN_EVENT_ID}:1`);
  assert.equal(guardDetails.world_state?.merchant_stock, 0);
  assert.equal(guardDetails.world_state?.route_safety, 'monitored');
  assert.equal(guardDetails.next_objective, 'Recover the Ashglass Shard at Ashglass Ravine.');
  const fishingCausal = causalEvents.find((event) => event.event_id === fishingDetails.event_instance_id);
  const merchantCausal = causalEvents.find((event) => event.event_id === merchantDetails.event_instance_id);
  const caravanCausal = causalEvents.find((event) => event.event_id === caravanDetails.event_instance_id);
  const guardCausal = causalEvents.find((event) => event.event_id === guardDetails.event_instance_id);
  const arrivalDetails = liveDetails.find((details) => details.event_type === 'caravan_merchant_arrived');
  assert.ok(arrivalDetails, 'autonomous merchant arrival writes the same world_event lane');
  assert.equal(arrivalDetails.parent_event_id, guardDetails.event_instance_id);
  assert.equal(arrivalDetails.actor_id, undefined, 'actor identity remains in the normalized receipt, not duplicated in details');
  assert.equal(arrivalDetails.world_state?.merchant_stock, 1);
  assert.equal(arrivalDetails.world_state?.merchant_travel_due_at_ms, null);
  const arrivalCausal = causalEvents.find((event) => event.event_id === arrivalDetails.event_instance_id);
  assert.equal(arrivalCausal?.actor_id, FORGEHOLD_CARAVAN_MERCHANT_ID);
  assert.deepEqual(arrivalCausal?.parent_event_ids, [guardDetails.event_instance_id]);
  assert.deepEqual(fishingCausal?.downstream_event_ids, [merchantDetails.event_instance_id]);
  assert.deepEqual(merchantCausal?.parent_event_ids, [fishingDetails.event_instance_id]);
  assert.equal(caravanCausal?.intent.verb, 'recover_caravan_evidence');
  assert.deepEqual(caravanCausal?.downstream_event_ids, [guardDetails.event_instance_id]);
  assert.deepEqual(guardCausal?.parent_event_ids, [`${FORGEHOLD_CARAVAN_EVENT_ID}:1`]);
  assert.deepEqual(guardCausal?.downstream_event_ids, [arrivalDetails.event_instance_id]);

  const parityPacketPath = path.join(tmpDir, 'causal-parity-packet.json');
  fs.writeFileSync(parityPacketPath, JSON.stringify({
    schema_version: 'akalynth.causal-parity-packet/v1',
    authority: 'observed_runtime_evidence',
    events: causalEvents,
  }, null, 2));
  const codexProjector = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../../akalynth-codex/tools/project-causal-parity.mjs',
  );
  const codexResult = spawnSync(process.execPath, [codexProjector, '--input', parityPacketPath, '--stdout'], {
    encoding: 'utf8',
  });
  assert.equal(codexResult.status, 0, `Codex causal parity projection succeeds: ${codexResult.stderr}`);
  const codexProjection = JSON.parse(codexResult.stdout) as {
    authority: string;
    canon_status: string;
    approval_status: string;
    events: CausalParityEvent[];
  };
  assert.equal(codexProjection.authority, 'observed_runtime_evidence');
  assert.equal(codexProjection.canon_status, 'observed_not_canon');
  assert.equal(codexProjection.approval_status, 'not_established');
  assert.deepEqual(codexProjection.events, causalEvents, 'Codex copies the exact normalized causal records');

  const observerPlayerId = 'p:shared-world-observer';
  const observerRequest = parseClientMessage({
    type: 'get_shared_world_observation',
    world_id: SHARED_WORLD_IDS.forgeholdCaravanRoute,
  });
  assert.deepEqual(observerRequest, {
    type: 'get_shared_world_observation',
    world_id: SHARED_WORLD_IDS.forgeholdCaravanRoute,
    limit: undefined,
  }, 'second observer uses the explicit shared-world read lane');
  const sharedRows = live.getSharedWorldEvents(SHARED_WORLD_IDS.forgeholdCaravanRoute, 50);
  assert.equal(sharedRows.length, 3, 'shared-world query returns the caravan evidence, guard, and autonomous arrival chain');
  assert.ok(sharedRows.every((row) => row.player_id === PLAYER_ID), 'shared rows retain the originating actor custody');
  assert.equal(
    live.getChronicleForPlayer(observerPlayerId, 50).length,
    0,
    'second observer does not receive the originating actor private Chronicle rows',
  );
  const sharedObservation = sharedWorldObservationFromRows(
    observerPlayerId,
    SHARED_WORLD_IDS.forgeholdCaravanRoute,
    sharedRows,
  );
  assert.equal(sharedObservation.observer_player_id, observerPlayerId);
  assert.equal(sharedObservation.world_id, SHARED_WORLD_IDS.forgeholdCaravanRoute);
  assert.equal(sharedObservation.latest_event_id, arrivalCausal?.event_id);
  assert.equal(sharedObservation.latest_receipt_hash, arrivalCausal?.receipt.hash);
  assert.deepEqual(sharedObservation.state, arrivalCausal?.state_transition.after, 'observer receives the canonical latest route state');
  const observedCausal = sharedObservation.events
    .map((event) => event.causal)
    .filter((event): event is CausalParityEvent => event !== null && event !== undefined);
  assert.deepEqual(
    observedCausal,
    causalEvents.filter((event) => event.world_id === SHARED_WORLD_IDS.forgeholdCaravanRoute),
    'Player B observes the same normalized causal chain as Player A and Codex',
  );

  assert.equal(
    live.getPlayerInventory(PLAYER_ID).length,
    1,
    'fishing side effect persisted directly to inventory',
  );

  logger.close();
  live.close();

  const receipts = readReceipts(receiptsPath);
  verifySignedChain(receipts, keyPath);
  assert.ok(receipts.some((receipt) => receipt.action === 'skill_use_intent'), 'shared skill intent receipts are canonical');
  assert.equal(receipts.filter((receipt) => receipt.action === 'item_minted').length, 1, 'fish acceptance emits a mint receipt');
  assert.equal(receipts.filter((receipt) => receipt.action === 'item_added_to_inventory').length, 1, 'fish acceptance emits an inventory insertion receipt');
  assert.equal(
    receipts.filter((receipt) => receipt.action === ROOKGUARD_CANAL_FISHED_ACTION).length,
    1,
    'accepted fishing emits one world-resolution receipt',
  );
  assert.equal(
    receipts.filter((receipt) => receipt.action === FORGEHOLD_CARAVAN_EVIDENCE_RECOVERED_ACTION).length,
    1,
    'accepted caravan emits one world-resolution receipt',
  );
  assert.equal(
    receipts.filter((receipt) => receipt.action === FORGEHOLD_CARAVAN_GUARD_DECISION_ACTION).length,
    1,
    'accepted caravan triggers one guard-decision follow-up',
  );
  assert.equal(
    receipts.filter((receipt) => receipt.action === FORGEHOLD_CARAVAN_MERCHANT_ARRIVED_ACTION).length,
    1,
    'the due-time scan emits one autonomous merchant-arrival receipt',
  );
  const caravanReceipt = receipts.find((receipt) => receipt.action === FORGEHOLD_CARAVAN_EVIDENCE_RECOVERED_ACTION);
  const guardReceipt = receipts.find((receipt) => receipt.action === FORGEHOLD_CARAVAN_GUARD_DECISION_ACTION);
  const fishingReceipt = receipts.find((receipt) => receipt.action === ROOKGUARD_CANAL_FISHED_ACTION);
  const rejectedCaravanIntent = receipts.find((receipt) => (
    receipt.inputs.skill_id === 'route:evidence:caravan' && receipt.result !== 'ok'
  ));
  assert.ok(rejectedCaravanIntent, 'rejected caravan intent remains observable in the receipt chain');
  assert.equal(
    causalEvents.some((event) => event.receipt.hash === computeReceiptHash(rejectedCaravanIntent)),
    false,
    'rejected caravan intent has no completed player or Codex causal projection',
  );
  assert.equal(guardReceipt?.inputs?.parent_event_id, `${FORGEHOLD_CARAVAN_EVENT_ID}:1`);
  assert.deepEqual(caravanReceipt?.inputs?.downstream_event_ids, [guardReceipt?.inputs?.event_instance_id]);
  assert.deepEqual(
    fishingReceipt?.inputs?.downstream_event_ids,
    [`${fishingReceipt?.inputs?.event_id}:merchant`],
  );

  clearOnwardRouteProjection();
  clearRookguardFishingProjection();
  receipts.forEach((receipt) => {
    applyReceiptToOnwardRoutes(receipt);
    applyReceiptToRookguardFishing(receipt);
  });
  assert.deepEqual(getOnwardRouteReceiptProgress(PLAYER_ID), liveRouteState, 'restart replay restores caravan route memory');
  assert.deepEqual(getRookguardFishingState(), liveFishingState, 'restart replay restores fishing memory');

  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${dbPath}${suffix}`, { force: true });
  fs.rmSync(markerPath, { force: true });

  const rebuilt = createPersistenceLayer({ dbPath, markerPath, receiptsPath, replayMode: 'strict' });
  rebuilt.startup();
  assert.equal(
    getOnwardRouteReceiptProgress(PLAYER_ID).forgeholdCaravanEvidenceRecovered,
    true,
    'full SQLite restart replay restores caravan route memory',
  );
  assert.deepEqual(getRookguardFishingState(), liveFishingState, 'full SQLite restart replay restores fishing memory');
  const rebuiltWorldEvents = rebuilt.getChronicleForPlayer(PLAYER_ID, 50)
    .filter((row) => row.kind === 'world_event');
  assert.equal(rebuiltWorldEvents.length, 5, 'SQLite Chronicle rebuild preserves both activities, guard follow-up, and autonomous arrival');

  rebuilt.startup();
  assert.equal(
    rebuilt.getChronicleForPlayer(PLAYER_ID, 50).filter((row) => row.kind === 'world_event').length,
    5,
    'replay is idempotent and does not duplicate shared world_event rows',
  );
  rebuilt.close();

  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log('[verify-fishing-caravan-events] shared use_skill -> signed receipts -> shared-world observation -> Codex/player parity -> restart/replay/idempotence: PASS');
}

main().catch((error) => {
  console.error('[verify-fishing-caravan-events] FAIL', error);
  process.exit(1);
});
