// Verify Forgehold Act II — Ember Road Recovery evidence ordering.
//
// Proof target: forgehold_ashglass_evidence_v1
// Three server-owned evidence objects must be recovered in sequence before Act III
// shipment contradiction investigation. No travel unlock, wallet, or item authority.

import type { WebSocket } from 'ws';
import type { AntiCheatState, Player } from '../../../packages/shared/types.js';
import {
  FORGEHOLD_ASHGLASS_RAVINE_EVIDENCE_RECOVERED_ACTION,
  FORGEHOLD_CARAVAN_EVIDENCE_RECOVERED_ACTION,
  FORGEHOLD_MILEPOST_EVIDENCE_RECOVERED_ACTION,
  FORGEHOLD_SHIPMENT_INVESTIGATED_ACTION,
  ROUTE_SURVEYED_ACTION,
  SKILL_RESOLVED_ACTION,
} from '../../../packages/shared/skills.js';
import { handleUseSkill, type SkillContext } from '../src/skills/index.js';
import { buildOnwardRouteProgress, type RookguardQuestInput } from '../src/world/rookguardQuest.js';
import { applyReceiptToOnwardRoutes, clearOnwardRouteProjection, getOnwardRouteReceiptProgress } from '../src/world/onwardRoutes.js';

function assert(condition: unknown, msg: string): asserts condition {
  if (!condition) throw new Error(msg);
}

const tests: Array<{ name: string; fn: () => Promise<void> }> = [];

function test(name: string, fn: () => Promise<void>) {
  tests.push({ name, fn });
}

function context() {
  clearOnwardRouteProjection();
  const receipts: Array<{ actor_id: string; player_id: string; action: string; inputs: Record<string, unknown>; result: string }> = [];
  const sent: unknown[] = [];
  const ctx: SkillContext = {
    playerId: 'p1',
    playerName: 'Tester',
    ws: {} as WebSocket,
    antiState: {
      signals: [],
      warnCount: 0,
      temChallengeActive: false,
      temChallengeId: null,
      temChallengeExpires: null,
      throttleUntil: null,
      kickCount: 0,
    } satisfies AntiCheatState,
    skillCooldowns: new Map(),
    onwardRoutesAvailable: true,
    getOnwardRouteProgress: () => getOnwardRouteReceiptProgress('p1'),
    audit: (receipt) => {
      const normalized = { ...receipt, actor_id: receipt.player_id };
      receipts.push(normalized);
      applyReceiptToOnwardRoutes(normalized as never);
    },
    findPlayerOnline: (_id: string): Player | null => null,
    issueTem: () => ({ outcome: 'none' }),
    getChronicle: () => [],
    send: (msg) => sent.push(msg),
    mintItemToInventory: () => {
      throw new Error('Act II evidence must not mint items');
    },
    syncInventory: () => undefined,
    creditWallet: () => {
      throw new Error('Act II evidence must not credit wallet');
    },
    onSkillResolved: () => undefined,
  };
  return { ctx, receipts, sent };
}

function skillResultFor<T extends Record<string, unknown> = Record<string, unknown>>(sent: unknown[], skillId: string) {
  return sent.find((msg) =>
    typeof msg === 'object' &&
    msg !== null &&
    (msg as { type?: string }).type === 'skill_result' &&
    (msg as { skill_id?: string }).skill_id === skillId
  ) as { success?: boolean; reason?: string; payload?: T } | undefined;
}

async function completeForgeholdActII(ctx: SkillContext): Promise<void> {
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:evidence:milepost' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:evidence:caravan' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:evidence:ravine' });
}

const completedRookguard: RookguardQuestInput = {
  tutorial: { move: true, chat: true, tem: true, gate: true, complete: true },
  trainingComplete: true,
  vocation: 'warden',
};

test('Act II evidence chain emits ordered receipts with act_02 guard', async () => {
  const { ctx, receipts, sent } = context();
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:survey:forgehold' });
  await completeForgeholdActII(ctx);

  const milepost = receipts.find((r) => r.action === FORGEHOLD_MILEPOST_EVIDENCE_RECOVERED_ACTION);
  const caravan = receipts.find((r) => r.action === FORGEHOLD_CARAVAN_EVIDENCE_RECOVERED_ACTION);
  const ravine = receipts.find((r) => r.action === FORGEHOLD_ASHGLASS_RAVINE_EVIDENCE_RECOVERED_ACTION);

  assert(milepost, 'missing milepost evidence receipt');
  assert(caravan, 'missing caravan evidence receipt');
  assert(ravine, 'missing ravine evidence receipt');

  assert(milepost.inputs.act_id === 'act_02_ember_road_recovery', 'milepost act_id mismatch');
  assert(caravan.inputs.act_id === 'act_02_ember_road_recovery', 'caravan act_id mismatch');
  assert(ravine.inputs.act_id === 'act_02_ember_road_recovery', 'ravine act_id mismatch');

  assert(milepost.inputs.evidence_object_id === 'broken_route_seal', 'milepost evidence object mismatch');
  assert(caravan.inputs.evidence_object_id === 'charred_shipment_plate', 'caravan evidence object mismatch');
  assert(ravine.inputs.evidence_object_id === 'ashglass_shard', 'ravine evidence object mismatch');
  assert(ravine.inputs.evidence_id === 'forgehold_ashglass_evidence_v1', 'ravine proof target mismatch');

  for (const receipt of [milepost, caravan, ravine]) {
    const guard = receipt.inputs.authority_guard as { travel_unlocked?: boolean; economy_impact?: string; item_mint?: boolean } | undefined;
    assert(guard?.economy_impact === 'none', `${receipt.action} must not change economy`);
    assert(guard?.item_mint === false, `${receipt.action} must not mint items`);
  }

  const ravineResult = skillResultFor<{ evidence_id?: string; evidence_object_id?: string }>(sent, 'route:evidence:ravine');
  assert(ravineResult?.success === true, 'ravine skill_result should succeed');
  assert(ravineResult.payload?.evidence_id === 'forgehold_ashglass_evidence_v1', 'ravine payload proof target mismatch');
  assert(ravineResult.payload?.evidence_object_id === 'ashglass_shard', 'ravine payload evidence object mismatch');
  assert(!receipts.some((r) => r.action === 'wallet_credit' || r.action === 'wallet_debit'), 'Act II must not touch wallet');
  assert(!receipts.some((r) => r.action === 'item_minted'), 'Act II must not mint items');
});

test('Act II evidence rejects out-of-order and repeat recovery', async () => {
  const { ctx, receipts, sent } = context();
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:survey:forgehold' });

  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:evidence:caravan' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:evidence:ravine' });
  assert(!receipts.some((r) => r.action === FORGEHOLD_CARAVAN_EVIDENCE_RECOVERED_ACTION), 'caravan before milepost must not emit receipt');
  assert(!receipts.some((r) => r.action === FORGEHOLD_ASHGLASS_RAVINE_EVIDENCE_RECOVERED_ACTION), 'ravine before milepost must not emit receipt');

  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:evidence:milepost' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:evidence:ravine' });
  assert(receipts.filter((r) => r.action === FORGEHOLD_MILEPOST_EVIDENCE_RECOVERED_ACTION).length === 1, 'milepost should emit once');
  assert(!receipts.some((r) => r.action === FORGEHOLD_ASHGLASS_RAVINE_EVIDENCE_RECOVERED_ACTION), 'ravine before caravan must not emit receipt');

  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:evidence:caravan' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:evidence:ravine' });
  assert(receipts.filter((r) => r.action === FORGEHOLD_ASHGLASS_RAVINE_EVIDENCE_RECOVERED_ACTION).length === 1, 'ravine should emit once');

  ctx.skillCooldowns.set('route:evidence:ravine', 0);
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:evidence:ravine' });
  const repeat = skillResultFor(sent, 'route:evidence:ravine');
  assert(repeat?.success === false, 'repeat ravine recovery should fail');
  assert(repeat?.reason === 'invalid_target', 'repeat ravine recovery should use invalid_target');
});

test('shipment investigation gates on full Act II evidence chain', async () => {
  const { ctx, receipts, sent } = context();
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:survey:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:quest:shipment' });

  assert(!receipts.some((r) => r.action === FORGEHOLD_SHIPMENT_INVESTIGATED_ACTION), 'shipment without Act II must not emit investigation receipt');
  const blocked = skillResultFor(sent, 'route:quest:shipment');
  assert(blocked?.success === false, 'shipment without Act II should fail');
  assert(blocked?.reason === 'invalid_target', 'shipment without Act II should use invalid_target');

  await completeForgeholdActII(ctx);
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:quest:shipment' });

  const investigation = receipts.find((r) => r.action === FORGEHOLD_SHIPMENT_INVESTIGATED_ACTION);
  assert(investigation, 'shipment after Act II should emit investigation receipt');
  assert(investigation.inputs.act_id === 'act_03_burned_caravan_investigation', 'shipment act_id should be act_03');
  assert(investigation.inputs.travel_unlocked === false, 'shipment must not unlock travel');

  const evidenceObjects = investigation.inputs.evidence_objects as string[] | undefined;
  assert(evidenceObjects?.includes('broken_route_seal'), 'investigation should reference broken_route_seal');
  assert(evidenceObjects?.includes('charred_shipment_plate'), 'investigation should reference charred_shipment_plate');
  assert(evidenceObjects?.includes('ashglass_shard'), 'investigation should reference ashglass_shard');

  const shipmentResults = sent.filter((msg) =>
    typeof msg === 'object' &&
    msg !== null &&
    (msg as { type?: string }).type === 'skill_result' &&
    (msg as { skill_id?: string }).skill_id === 'route:quest:shipment'
  ) as Array<{ success?: boolean; payload?: { act_id?: string; evidence_objects?: string[]; travel_unlocked?: boolean } }>;
  assert(shipmentResults.length === 2, 'shipment should return two skill results (blocked then success)');
  assert(shipmentResults[1]?.success === true, 'shipment skill_result should succeed after Act II');
  assert(shipmentResults[1]?.payload?.act_id === 'act_03_burned_caravan_investigation', 'shipment payload act_id mismatch');
  assert(shipmentResults[1]?.payload?.travel_unlocked === false, 'shipment payload must not unlock travel');
});

test('Act II evidence projects into onward route objectives', async () => {
  const { ctx } = context();
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:survey:forgehold' });

  let progress = getOnwardRouteReceiptProgress('p1');
  let routes = buildOnwardRouteProgress(completedRookguard, progress);
  let forgehold = routes.find((route) => route.route_id === 'forgehold_route_slice_v1');
  assert(forgehold?.next_objective.includes('Broken Route Seal'), 'post-survey objective should name milepost evidence');

  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:evidence:milepost' });
  progress = getOnwardRouteReceiptProgress('p1');
  routes = buildOnwardRouteProgress(completedRookguard, progress);
  forgehold = routes.find((route) => route.route_id === 'forgehold_route_slice_v1');
  assert(forgehold?.completed_objective_ids.includes('forgehold_milepost_evidence'), 'milepost objective should project complete');
  assert(forgehold?.next_objective.includes('Charred Shipment Plate'), 'post-milepost objective should name caravan evidence');

  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:evidence:caravan' });
  progress = getOnwardRouteReceiptProgress('p1');
  routes = buildOnwardRouteProgress(completedRookguard, progress);
  forgehold = routes.find((route) => route.route_id === 'forgehold_route_slice_v1');
  assert(forgehold?.completed_objective_ids.includes('forgehold_caravan_evidence'), 'caravan objective should project complete');
  assert(forgehold?.next_objective.includes('Ashglass Shard'), 'post-caravan objective should name ravine evidence');

  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:evidence:ravine' });
  progress = getOnwardRouteReceiptProgress('p1');
  routes = buildOnwardRouteProgress(completedRookguard, progress);
  forgehold = routes.find((route) => route.route_id === 'forgehold_route_slice_v1');
  assert(forgehold?.completed_objective_ids.includes('forgehold_ashglass_ravine_evidence'), 'ravine objective should project complete');
  assert(forgehold?.next_objective.includes('missing shipment contradiction'), 'post-ravine objective should name shipment investigation');
});

test('Forgehold survey remains prerequisite for Act II evidence', async () => {
  const { ctx, receipts } = context();
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:evidence:milepost' });
  assert(!receipts.some((r) => r.action === FORGEHOLD_MILEPOST_EVIDENCE_RECOVERED_ACTION), 'milepost without survey must not emit receipt');
  assert(receipts.some((r) => r.action === ROUTE_SURVEYED_ACTION) === false, 'no survey should mean no route_surveyed');

  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:survey:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:evidence:milepost' });
  assert(receipts.some((r) => r.action === FORGEHOLD_MILEPOST_EVIDENCE_RECOVERED_ACTION), 'milepost after survey should emit receipt');
  assert(receipts.some((r) => r.action === SKILL_RESOLVED_ACTION), 'milepost after survey should resolve skill');
});

for (const { name, fn } of tests) {
  try {
    await fn();
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(`  ${err}`);
    process.exit(1);
  }
  console.log(`✓ ${name}`);
}

console.log('\n✓ forgehold_ashglass_evidence_v1 checks passed');