// Verify first onward-route survey skills.
//
// The survey path uses existing use_skill intent handling. Clients send only
// a skill id; the server emits skill intent/resolution receipts plus a
// route_surveyed receipt and returns read-only route payloads.

import type { WebSocket } from 'ws';
import type { AntiCheatState, Player } from '../../../packages/shared/types.js';
import { DREAM_GATE_INTERPRETED_ACTION, FORGEHOLD_SHIPMENT_INVESTIGATED_ACTION, ROUTE_SURVEYED_ACTION, SKILL_RESOLVED_ACTION, SKILL_USE_INTENT_ACTION, SOULSTEEL_STABILIZED_ACTION } from '../../../packages/shared/skills.js';
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

function context(options: { onwardRoutesAvailable?: boolean } = {}) {
  clearOnwardRouteProjection();
  const receipts: Array<{ actor_id: string; player_id: string; action: string; inputs: Record<string, unknown>; result: string }> = [];
  const sent: unknown[] = [];
  const resolvedSkills: string[] = [];
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
    onwardRoutesAvailable: options.onwardRoutesAvailable ?? true,
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
    onSkillResolved: (skillId) => {
      if (skillId.startsWith('route:')) resolvedSkills.push(skillId);
    },
  };
  return { ctx, receipts, sent, resolvedSkills };
}

function skillResultFor<T extends Record<string, unknown> = Record<string, unknown>>(sent: unknown[], skillId: string): {
  success?: boolean;
  reason?: string;
  payload?: T;
} | undefined {
  return sent.find((msg) =>
    typeof msg === 'object' &&
    msg !== null &&
    (msg as { type?: string }).type === 'skill_result' &&
    (msg as { skill_id?: string }).skill_id === skillId
  ) as { success?: boolean; reason?: string; payload?: T } | undefined;
}

const completedRookguard: RookguardQuestInput = {
  tutorial: { move: true, chat: true, tem: true, gate: true, complete: true },
  trainingComplete: true,
  vocation: 'warden',
};

test('route actions reject before Rookguard completion without route side effects', async () => {
  const { ctx, receipts, sent, resolvedSkills } = context({ onwardRoutesAvailable: false });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:quest:shipment' });

  assert(receipts.some((r) => r.action === SKILL_USE_INTENT_ACTION), 'locked route should still record skill intent');
  assert(receipts.some((r) => r.action === 'skill_rejected' && r.inputs.reason === 'invalid_target'), 'locked route should emit skill rejection');
  assert(!receipts.some((r) => r.action === FORGEHOLD_SHIPMENT_INVESTIGATED_ACTION), 'locked route must not emit quest receipt');
  assert(!receipts.some((r) => r.action === ROUTE_SURVEYED_ACTION), 'locked route must not emit route survey receipt');
  assert(!receipts.some((r) => r.action === SOULSTEEL_STABILIZED_ACTION), 'locked route must not emit Soulsteel receipt');
  assert(!receipts.some((r) => r.action === DREAM_GATE_INTERPRETED_ACTION), 'locked route must not emit Dream Gate receipt');

  const result = skillResultFor(sent, 'route:quest:shipment');
  assert(result?.success === false, 'locked route skill_result should fail');
  assert(result.reason === 'invalid_target', 'locked route skill_result should use invalid_target');
  assert(resolvedSkills.length === 0, 'locked route skill must not publish route progress');
});

test('route objective skills reject out of order without side effects', async () => {
  const { ctx, receipts, sent, resolvedSkills } = context();

  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:quest:shipment' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:soulsteel' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:dream:interpret' });

  const failedResults = sent.filter((msg) => typeof msg === 'object' && msg !== null && (msg as { type?: string }).type === 'skill_result') as Array<{
    success?: boolean;
    reason?: string;
  }>;
  assert(failedResults.length === 3, 'out-of-order route skills should each return a skill_result');
  assert(failedResults.every((result) => result.success === false), 'out-of-order route skills should fail');
  assert(failedResults.every((result) => result.reason === 'invalid_target'), 'out-of-order route skills should use invalid_target');
  assert(!receipts.some((r) => r.action === FORGEHOLD_SHIPMENT_INVESTIGATED_ACTION), 'out-of-order shipment must not emit quest receipt');
  assert(!receipts.some((r) => r.action === SOULSTEEL_STABILIZED_ACTION), 'out-of-order Soulsteel must not emit crafting receipt');
  assert(!receipts.some((r) => r.action === DREAM_GATE_INTERPRETED_ACTION), 'out-of-order Dream Gate must not emit interpretation receipt');
  assert(!receipts.some((r) => r.action === SKILL_RESOLVED_ACTION), 'out-of-order route skills must not resolve');
  assert(resolvedSkills.length === 0, 'out-of-order route skills must not publish route progress');
});

test('Forgehold survey emits server-owned route payload and receipts', async () => {
  const { ctx, receipts, sent, resolvedSkills } = context();
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:survey:forgehold' });

  assert(receipts.some((r) => r.action === SKILL_USE_INTENT_ACTION), 'missing skill intent receipt');
  assert(receipts.some((r) => r.action === SKILL_RESOLVED_ACTION), 'missing skill resolved receipt');
  const survey = receipts.find((r) => r.action === ROUTE_SURVEYED_ACTION);
  assert(survey, 'missing route_surveyed receipt');
  assert(survey.inputs.route_id === 'forgehold_route_slice_v1', 'wrong Forgehold route id');
  assert(Array.isArray(survey.inputs.systems), 'Forgehold systems should be recorded');

  const result = skillResultFor<{ route_id?: string; systems?: string[] }>(sent, 'route:survey:forgehold');
  assert(result?.success === true, 'Forgehold skill_result should succeed');
  assert(result.payload?.route_id === 'forgehold_route_slice_v1', 'Forgehold payload route mismatch');
  assert(result.payload?.systems?.includes('crafting'), 'Forgehold payload should include crafting');
  assert(result.payload?.systems?.includes('anti_cheat'), 'Forgehold payload should include anti_cheat');
  assert(resolvedSkills.includes('route:survey:forgehold'), 'Forgehold survey should publish route progress after success');
});

test('Moonspire survey emits Dream Gate payload without client traversal truth', async () => {
  const { ctx, receipts, sent } = context();
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:survey:moonspire' });

  const survey = receipts.find((r) => r.action === ROUTE_SURVEYED_ACTION);
  assert(survey, 'missing route_surveyed receipt');
  assert(survey.inputs.route_id === 'moonspire_dream_gate_slice_v1', 'wrong Moonspire route id');

  const result = skillResultFor<{ route_id?: string; systems?: string[]; next_objective?: string }>(sent, 'route:survey:moonspire');
  assert(result?.success === true, 'Moonspire skill_result should succeed');
  assert(result.payload?.route_id === 'moonspire_dream_gate_slice_v1', 'Moonspire payload route mismatch');
  assert(result.payload?.systems?.includes('dream_gate'), 'Moonspire payload should include dream_gate');
  assert(result.payload?.systems?.includes('anti_cheat'), 'Moonspire payload should include anti_cheat');
  assert(
    result.payload?.next_objective?.includes('server-owned dream traversal'),
    'Moonspire payload must not grant client-owned dream traversal'
  );
});

test('Soulsteel stabilization emits crafting receipt without wallet or item authority', async () => {
  const { ctx, receipts, sent } = context();
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:survey:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:quest:shipment' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:soulsteel' });

  const craft = receipts.find((r) => r.action === SOULSTEEL_STABILIZED_ACTION);
  assert(craft, 'missing soulsteel_stabilized receipt');
  assert(craft.inputs.route_id === 'forgehold_route_slice_v1', 'Soulsteel route mismatch');
  assert(craft.inputs.quality === 'unstable', 'first Soulsteel quality should be unstable');
  assert(craft.inputs.economy_impact === 'none', 'Soulsteel prototype should not silently change economy');
  assert(!receipts.some((r) => r.action === 'wallet_debit'), 'Soulsteel prototype should not debit gold');
  assert(!receipts.some((r) => r.action === 'item_minted'), 'Soulsteel prototype should not mint an item');

  const result = skillResultFor<{ crafting_id?: string; quality?: string; economy_impact?: string; required_evidence?: string[] }>(sent, 'route:craft:soulsteel');
  assert(result?.success === true, 'Soulsteel skill_result should succeed');
  assert(result.payload?.crafting_id === 'soulsteel_stabilization_v1', 'Soulsteel payload crafting id mismatch');
  assert(result.payload?.quality === 'unstable', 'Soulsteel payload quality mismatch');
  assert(result.payload?.economy_impact === 'none', 'Soulsteel payload economy impact mismatch');
  assert(result.payload?.required_evidence?.includes('ashglass_shard'), 'Soulsteel payload should name Ashglass Shard');
});

test('Dream Gate interpretation records symbolic state without traversal or economy authority', async () => {
  const { ctx, receipts, sent } = context();
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:survey:moonspire' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:dream:interpret' });

  const interpretation = receipts.find((r) => r.action === DREAM_GATE_INTERPRETED_ACTION);
  assert(interpretation, 'missing dream_gate_interpreted receipt');
  assert(interpretation.inputs.route_id === 'moonspire_dream_gate_slice_v1', 'Dream Gate route mismatch');
  assert(interpretation.inputs.gate_state === 'interpreted', 'Dream Gate state should be interpreted');
  assert(interpretation.inputs.traversal_granted === false, 'Dream Gate interpretation must not grant traversal');
  assert(interpretation.inputs.economy_impact === 'none', 'Dream Gate interpretation should not change economy');
  assert(!receipts.some((r) => r.action === 'wallet_debit'), 'Dream Gate interpretation should not debit gold');
  assert(!receipts.some((r) => r.action === 'item_minted'), 'Dream Gate interpretation should not mint an item');

  const result = skillResultFor<{ gate_state?: string; traversal_granted?: boolean; meanings?: string[]; required_fragments?: string[] }>(sent, 'route:dream:interpret');
  assert(result?.success === true, 'Dream Gate skill_result should succeed');
  assert(result.payload?.gate_state === 'interpreted', 'Dream Gate payload state mismatch');
  assert(result.payload?.traversal_granted === false, 'Dream Gate payload must not grant traversal');
  assert(result.payload?.meanings?.includes('hidden memory'), 'Dream Gate payload should include hidden memory meaning');
  assert(result.payload?.required_fragments?.includes('emotional_residue'), 'Dream Gate payload should name Emotional Residue');
});

test('Forgehold shipment investigation records quest progress without travel or economy authority', async () => {
  const { ctx, receipts, sent } = context();
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:survey:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:quest:shipment' });

  const investigation = receipts.find((r) => r.action === FORGEHOLD_SHIPMENT_INVESTIGATED_ACTION);
  assert(investigation, 'missing forgehold_shipment_investigated receipt');
  assert(investigation.inputs.route_id === 'forgehold_route_slice_v1', 'Forgehold investigation route mismatch');
  assert(investigation.inputs.route_state === 'investigating', 'Forgehold route state should be investigating');
  assert(investigation.inputs.travel_unlocked === false, 'Forgehold investigation must not unlock travel');
  assert(investigation.inputs.economy_impact === 'none', 'Forgehold investigation should not change economy');
  assert(!receipts.some((r) => r.action === 'wallet_debit'), 'Forgehold investigation should not debit gold');
  assert(!receipts.some((r) => r.action === 'item_minted'), 'Forgehold investigation should not mint an item');

  const result = skillResultFor<{ quest_id?: string; route_state?: string; travel_unlocked?: boolean; evidence_objects?: string[]; contradiction?: string }>(sent, 'route:quest:shipment');
  assert(result?.success === true, 'Forgehold investigation skill_result should succeed');
  assert(result.payload?.quest_id === 'forgehold_missing_shipment_v1', 'Forgehold investigation quest id mismatch');
  assert(result.payload?.route_state === 'investigating', 'Forgehold investigation payload state mismatch');
  assert(result.payload?.travel_unlocked === false, 'Forgehold investigation payload must not unlock travel');
  assert(result.payload?.evidence_objects?.includes('charred_shipment_plate'), 'Forgehold investigation payload should name Charred Shipment Plate');
  assert(result.payload?.contradiction === 'departed / undeparted', 'Forgehold investigation payload should name contradiction');
});

test('onward route projection is derived from route receipts', async () => {
  const { ctx } = context();
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:survey:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:quest:shipment' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:soulsteel' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:survey:moonspire' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:dream:interpret' });

  const progress = getOnwardRouteReceiptProgress('p1');
  const routes = buildOnwardRouteProgress(completedRookguard, progress);
  const forgehold = routes.find((route) => route.route_id === 'forgehold_route_slice_v1');
  const moonspire = routes.find((route) => route.route_id === 'moonspire_dream_gate_slice_v1');

  assert(forgehold, 'Forgehold route projection missing');
  assert(moonspire, 'Moonspire route projection missing');
  assert(forgehold.completed_objective_ids.includes('forgehold_route_survey'), 'Forgehold survey should project complete');
  assert(forgehold.completed_objective_ids.includes('forgehold_missing_shipment'), 'Forgehold shipment should project complete');
  assert(forgehold.completed_objective_ids.includes('soulsteel_stabilization'), 'Soulsteel should project complete');
  assert(moonspire.completed_objective_ids.includes('dream_gate_rumor'), 'Moonspire survey should project complete');
  assert(moonspire.completed_objective_ids.includes('symbolic_puzzle_projection'), 'Dream interpretation should project complete');
  assert(forgehold.next_objective.includes('Heartforge Trial'), 'Forgehold next objective should advance after Soulsteel');
  assert(moonspire.next_objective.includes('Anchor the interpreted symbols'), 'Moonspire next objective should advance after interpretation');
});

for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(`  ${err}`);
    process.exit(1);
  }
}

console.log('\n✓ all route survey checks passed');
