// Verify first onward-route survey skills.
//
// The survey path uses existing use_skill intent handling. Clients send only
// a skill id; the server emits skill intent/resolution receipts plus a
// route_surveyed receipt and returns read-only route payloads.

import type { WebSocket } from 'ws';
import type { AntiCheatState, Player } from '../../../packages/shared/types.js';
import { ASHGLASS_EVIDENCE_RECOVERED_ACTION, DREAM_FRAGMENT_ANCHORED_ACTION, DREAM_GATE_ARRIVAL_RECORDED_ACTION, DREAM_GATE_INTERPRETED_ACTION, DREAM_GATE_SEAL_PREPARED_ACTION, DREAM_GATE_TRAVERSAL_AUTHORIZED_ACTION, FORGEHOLD_COMPONENT_PAYOUT_CREDITED_ACTION, FORGEHOLD_COMPONENT_SETTLED_ACTION, FORGEHOLD_ECONOMY_QUOTED_ACTION, FORGEHOLD_SHIPMENT_INVESTIGATED_ACTION, HEARTFORGE_GATE_PREPARED_ACTION, ROUTE_ABUSE_NOTES_REVIEWED_ACTION, ROUTE_SURVEYED_ACTION, SKILL_RESOLVED_ACTION, SKILL_USE_INTENT_ACTION, SOULSTEEL_COMPONENT_MINTED_ACTION, SOULSTEEL_REFINEMENT_AUTHORIZED_ACTION, SOULSTEEL_STABILIZED_ACTION } from '../../../packages/shared/skills.js';
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
    mintItemToInventory: (itemType, meta, reason, source) => {
      const itemId = `test_${itemType}_1`;
      ctx.audit({
        player_id: ctx.playerId,
        action: 'item_minted',
        inputs: { item_type: itemType, meta, reason },
        result: 'ok',
      });
      ctx.audit({
        player_id: ctx.playerId,
        action: 'item_added_to_inventory',
        inputs: { item_id: itemId, slot: null, source },
        result: 'ok',
      });
      return { item_id: itemId, item_type: itemType };
    },
    syncInventory: () => sent.push({ type: 'inventory_snapshot', items: [{ item_id: 'test_refined_soulsteel_component_1', item_type: 'refined_soulsteel_component' }] }),
    creditWallet: (amount, reason) => {
      ctx.audit({
        player_id: ctx.playerId,
        action: 'wallet_credit',
        inputs: { amount, reason },
        result: 'ok',
      });
      sent.push({ type: 'wallet_snapshot', balance: amount });
      return { balance_gold: amount };
    },
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
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:economy:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:soulsteel' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:ashglass' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:refine' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:mint' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:economy:settle' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:economy:payout' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:dream:interpret' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:dream:fragment' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:dream:traverse' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:dream:arrive' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:safety:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:gate:heartforge' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:safety:moonspire' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:gate:moonspire' });

  const failedResults = sent.filter((msg) => typeof msg === 'object' && msg !== null && (msg as { type?: string }).type === 'skill_result') as Array<{
    success?: boolean;
    reason?: string;
  }>;
  assert(failedResults.length === 16, 'out-of-order route skills should each return a skill_result');
  assert(failedResults.every((result) => result.success === false), 'out-of-order route skills should fail');
  assert(failedResults.every((result) => result.reason === 'invalid_target'), 'out-of-order route skills should use invalid_target');
  assert(!receipts.some((r) => r.action === FORGEHOLD_SHIPMENT_INVESTIGATED_ACTION), 'out-of-order shipment must not emit quest receipt');
  assert(!receipts.some((r) => r.action === FORGEHOLD_ECONOMY_QUOTED_ACTION), 'out-of-order economy quote must not emit economy receipt');
  assert(!receipts.some((r) => r.action === SOULSTEEL_STABILIZED_ACTION), 'out-of-order Soulsteel must not emit crafting receipt');
  assert(!receipts.some((r) => r.action === ASHGLASS_EVIDENCE_RECOVERED_ACTION), 'out-of-order Ashglass evidence must not emit evidence receipt');
  assert(!receipts.some((r) => r.action === SOULSTEEL_REFINEMENT_AUTHORIZED_ACTION), 'out-of-order Soulsteel refinement must not emit authorization receipt');
  assert(!receipts.some((r) => r.action === SOULSTEEL_COMPONENT_MINTED_ACTION), 'out-of-order Soulsteel component mint must not emit route mint receipt');
  assert(!receipts.some((r) => r.action === FORGEHOLD_COMPONENT_SETTLED_ACTION), 'out-of-order Forgehold settlement must not emit economy receipt');
  assert(!receipts.some((r) => r.action === FORGEHOLD_COMPONENT_PAYOUT_CREDITED_ACTION), 'out-of-order Forgehold payout must not emit payout receipt');
  assert(!receipts.some((r) => r.action === 'item_minted'), 'out-of-order Soulsteel component mint must not emit item mint receipt');
  assert(!receipts.some((r) => r.action === DREAM_GATE_INTERPRETED_ACTION), 'out-of-order Dream Gate must not emit interpretation receipt');
  assert(!receipts.some((r) => r.action === DREAM_FRAGMENT_ANCHORED_ACTION), 'out-of-order Dream fragment must not emit evidence receipt');
  assert(!receipts.some((r) => r.action === DREAM_GATE_TRAVERSAL_AUTHORIZED_ACTION), 'out-of-order Dream Gate traversal must not emit traversal receipt');
  assert(!receipts.some((r) => r.action === DREAM_GATE_ARRIVAL_RECORDED_ACTION), 'out-of-order Dream Gate arrival must not emit arrival receipt');
  assert(!receipts.some((r) => r.action === ROUTE_ABUSE_NOTES_REVIEWED_ACTION), 'out-of-order safety review must not emit abuse-note receipt');
  assert(!receipts.some((r) => r.action === HEARTFORGE_GATE_PREPARED_ACTION), 'out-of-order Heartforge gate must not emit server gate receipt');
  assert(!receipts.some((r) => r.action === DREAM_GATE_SEAL_PREPARED_ACTION), 'out-of-order Dream Gate seal must not emit server seal receipt');
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
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:economy:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:soulsteel' });

  const craft = receipts.find((r) => r.action === SOULSTEEL_STABILIZED_ACTION);
  assert(craft, 'missing soulsteel_stabilized receipt');
  assert(craft.inputs.route_id === 'forgehold_route_slice_v1', 'Soulsteel route mismatch');
  assert(craft.inputs.quality === 'unstable', 'first Soulsteel quality should be unstable');
  assert(craft.inputs.economy_impact === 'none', 'Soulsteel prototype should not silently change economy');
  assert(craft.inputs.required_economy_quote === FORGEHOLD_ECONOMY_QUOTED_ACTION, 'Soulsteel should require the Forgehold economy quote');
  assert(!receipts.some((r) => r.action === 'wallet_debit'), 'Soulsteel prototype should not debit gold');
  assert(!receipts.some((r) => r.action === 'item_minted'), 'Soulsteel prototype should not mint an item');

  const result = skillResultFor<{ crafting_id?: string; quality?: string; economy_impact?: string; required_evidence?: string[]; required_economy_quote?: string }>(sent, 'route:craft:soulsteel');
  assert(result?.success === true, 'Soulsteel skill_result should succeed');
  assert(result.payload?.crafting_id === 'soulsteel_stabilization_v1', 'Soulsteel payload crafting id mismatch');
  assert(result.payload?.quality === 'unstable', 'Soulsteel payload quality mismatch');
  assert(result.payload?.economy_impact === 'none', 'Soulsteel payload economy impact mismatch');
  assert(result.payload?.required_economy_quote === FORGEHOLD_ECONOMY_QUOTED_ACTION, 'Soulsteel payload should name required economy quote');
  assert(result.payload?.required_evidence?.includes('ashglass_shard'), 'Soulsteel payload should name Ashglass Shard');
});

test('Forgehold economy quote records no-debit no-mint guard', async () => {
  const { ctx, receipts, sent } = context();
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:survey:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:quest:shipment' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:economy:forgehold' });

  const quote = receipts.find((r) => r.action === FORGEHOLD_ECONOMY_QUOTED_ACTION);
  assert(quote, 'missing forgehold_economy_quoted receipt');
  assert(quote.inputs.route_id === 'forgehold_route_slice_v1', 'Forgehold economy quote route mismatch');
  assert(quote.inputs.quote_id === 'forgehold_soulsteel_quote_v1', 'Forgehold economy quote id mismatch');
  assert(quote.inputs.economy_impact === 'none', 'Forgehold economy quote should record no economy impact');
  assert(!receipts.some((r) => r.action === 'wallet_debit'), 'Forgehold economy quote should not debit gold');
  assert(!receipts.some((r) => r.action === 'wallet_credit'), 'Forgehold economy quote should not credit gold');
  assert(!receipts.some((r) => r.action === 'item_minted'), 'Forgehold economy quote should not mint an item');

  const guard = quote.inputs.economy_guard as { wallet_debit_gold?: number; wallet_credit_gold?: number; item_mint?: boolean } | undefined;
  assert(guard?.wallet_debit_gold === 0, 'Forgehold economy quote should specify zero wallet debit');
  assert(guard.wallet_credit_gold === 0, 'Forgehold economy quote should specify zero wallet credit');
  assert(guard.item_mint === false, 'Forgehold economy quote should specify no item mint');

  const result = skillResultFor<{ quote_id?: string; economy_impact?: string; economy_guard?: { item_mint?: boolean } }>(sent, 'route:economy:forgehold');
  assert(result?.success === true, 'Forgehold economy quote skill_result should succeed');
  assert(result.payload?.quote_id === 'forgehold_soulsteel_quote_v1', 'Forgehold economy quote payload id mismatch');
  assert(result.payload?.economy_impact === 'none', 'Forgehold economy quote payload economy impact mismatch');
  assert(result.payload?.economy_guard?.item_mint === false, 'Forgehold economy quote payload should specify no item mint');
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

test('Dream fragment evidence anchors without traversal or economy authority', async () => {
  const { ctx, receipts, sent } = context();
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:survey:moonspire' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:dream:interpret' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:dream:fragment' });

  const fragment = receipts.find((r) => r.action === DREAM_FRAGMENT_ANCHORED_ACTION);
  assert(fragment, 'missing dream_fragment_anchored receipt');
  assert(fragment.inputs.route_id === 'moonspire_dream_gate_slice_v1', 'Dream fragment route mismatch');
  assert(fragment.inputs.fragment_id === 'moonspire_emotional_residue_fragment_v1', 'Dream fragment id mismatch');
  assert(fragment.inputs.traversal_granted === false, 'Dream fragment must not grant traversal');
  assert(fragment.inputs.economy_impact === 'none', 'Dream fragment should not change economy');
  assert(!receipts.some((r) => r.action === 'wallet_debit'), 'Dream fragment should not debit gold');
  assert(!receipts.some((r) => r.action === 'item_minted'), 'Dream fragment should not mint an item');

  const result = skillResultFor<{ fragment_id?: string; traversal_granted?: boolean; evidence_objects?: string[]; economy_impact?: string }>(sent, 'route:dream:fragment');
  assert(result?.success === true, 'Dream fragment skill_result should succeed');
  assert(result.payload?.fragment_id === 'moonspire_emotional_residue_fragment_v1', 'Dream fragment payload id mismatch');
  assert(result.payload?.traversal_granted === false, 'Dream fragment payload must not grant traversal');
  assert(result.payload?.economy_impact === 'none', 'Dream fragment payload economy impact mismatch');
  assert(result.payload?.evidence_objects?.includes('emotional_residue'), 'Dream fragment payload should name Emotional Residue');
});

test('route safety reviews explain boundaries without heat or penalties', async () => {
  const { ctx, receipts, sent } = context();
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:survey:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:quest:shipment' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:economy:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:soulsteel' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:safety:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:survey:moonspire' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:dream:interpret' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:dream:fragment' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:safety:moonspire' });

  const reviews = receipts.filter((r) => r.action === ROUTE_ABUSE_NOTES_REVIEWED_ACTION);
  assert(reviews.length === 2, 'both route safety reviews should emit abuse-note receipts');
  assert(reviews.some((r) => r.inputs.route_id === 'forgehold_route_slice_v1'), 'Forgehold safety receipt missing');
  assert(reviews.some((r) => r.inputs.route_id === 'moonspire_dream_gate_slice_v1'), 'Dream Gate safety receipt missing');
  assert(reviews.every((r) => r.inputs.heat_changed === false), 'safety review must not change heat');
  assert(reviews.every((r) => r.inputs.penalty_applied === false), 'safety review must not apply penalties');

  const forgeholdResult = skillResultFor<{ boundaries?: string[]; heat_changed?: boolean; penalty_applied?: boolean }>(sent, 'route:safety:forgehold');
  const moonspireResult = skillResultFor<{ boundaries?: string[]; heat_changed?: boolean; penalty_applied?: boolean }>(sent, 'route:safety:moonspire');
  assert(forgeholdResult?.success === true, 'Forgehold safety skill_result should succeed');
  assert(moonspireResult?.success === true, 'Dream Gate safety skill_result should succeed');
  assert(forgeholdResult.payload?.boundaries?.includes('server owns crafting results'), 'Forgehold safety should explain crafting authority');
  assert(moonspireResult.payload?.boundaries?.includes('server owns dream traversal'), 'Dream Gate safety should explain traversal authority');
  assert(forgeholdResult.payload?.heat_changed === false, 'Forgehold safety payload must not change heat');
  assert(moonspireResult.payload?.penalty_applied === false, 'Dream Gate safety payload must not apply penalty');
});

test('Heartforge gate preparation records server gate without travel or economy authority', async () => {
  const { ctx, receipts, sent } = context();
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:survey:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:quest:shipment' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:economy:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:soulsteel' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:safety:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:gate:heartforge' });

  const gate = receipts.find((r) => r.action === HEARTFORGE_GATE_PREPARED_ACTION);
  assert(gate, 'missing heartforge_gate_prepared receipt');
  assert(gate.inputs.route_id === 'forgehold_route_slice_v1', 'Heartforge gate route mismatch');
  assert(gate.inputs.gate_id === 'heartforge_trial_server_gate_v1', 'Heartforge gate id mismatch');
  assert(gate.inputs.travel_unlocked === false, 'Heartforge gate preparation must not unlock travel');
  assert(gate.inputs.economy_impact === 'none', 'Heartforge gate preparation should not change economy');
  assert(!receipts.some((r) => r.action === 'wallet_debit'), 'Heartforge gate preparation should not debit gold');
  assert(!receipts.some((r) => r.action === 'item_minted'), 'Heartforge gate preparation should not mint an item');

  const result = skillResultFor<{ gate_id?: string; travel_unlocked?: boolean; economy_impact?: string; required_proofs?: string[] }>(sent, 'route:gate:heartforge');
  assert(result?.success === true, 'Heartforge gate skill_result should succeed');
  assert(result.payload?.gate_id === 'heartforge_trial_server_gate_v1', 'Heartforge gate payload id mismatch');
  assert(result.payload?.travel_unlocked === false, 'Heartforge gate payload must not unlock travel');
  assert(result.payload?.economy_impact === 'none', 'Heartforge gate payload economy impact mismatch');
  assert(result.payload?.required_proofs?.includes('route_abuse_notes_reviewed'), 'Heartforge gate payload should require safety review');
});

test('Ashglass evidence recovery records crafting evidence without item or economy authority', async () => {
  const { ctx, receipts, sent } = context();
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:survey:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:quest:shipment' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:economy:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:soulsteel' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:safety:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:gate:heartforge' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:ashglass' });

  const ashglass = receipts.find((r) => r.action === ASHGLASS_EVIDENCE_RECOVERED_ACTION);
  assert(ashglass, 'missing ashglass_evidence_recovered receipt');
  assert(ashglass.inputs.route_id === 'forgehold_route_slice_v1', 'Ashglass evidence route mismatch');
  assert(ashglass.inputs.evidence_id === 'heartforge_ashglass_evidence_v1', 'Ashglass evidence id mismatch');
  assert(ashglass.inputs.required_gate === HEARTFORGE_GATE_PREPARED_ACTION, 'Ashglass evidence should require Heartforge gate');
  assert(ashglass.inputs.travel_unlocked === false, 'Ashglass evidence recovery must not unlock travel');
  assert(ashglass.inputs.economy_impact === 'none', 'Ashglass evidence recovery should not change economy');
  assert(!receipts.some((r) => r.action === 'wallet_debit'), 'Ashglass evidence recovery should not debit gold');
  assert(!receipts.some((r) => r.action === 'wallet_credit'), 'Ashglass evidence recovery should not credit gold');
  assert(!receipts.some((r) => r.action === 'item_minted'), 'Ashglass evidence recovery should not mint an item');

  const result = skillResultFor<{ evidence_id?: string; evidence_objects?: string[]; travel_unlocked?: boolean; economy_impact?: string; refinement_guard?: { item_mint?: boolean } }>(sent, 'route:craft:ashglass');
  assert(result?.success === true, 'Ashglass evidence skill_result should succeed');
  assert(result.payload?.evidence_id === 'heartforge_ashglass_evidence_v1', 'Ashglass payload evidence id mismatch');
  assert(result.payload?.evidence_objects?.includes('ashglass_shard'), 'Ashglass payload should name Ashglass Shard');
  assert(result.payload?.travel_unlocked === false, 'Ashglass payload must not unlock travel');
  assert(result.payload?.economy_impact === 'none', 'Ashglass payload economy impact mismatch');
  assert(result.payload?.refinement_guard?.item_mint === false, 'Ashglass payload must not mint refinement item');
});

test('Ashglass evidence recovery is idempotent after receipt-derived evidence', async () => {
  const { ctx, receipts, sent } = context();
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:survey:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:quest:shipment' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:economy:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:soulsteel' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:safety:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:gate:heartforge' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:ashglass' });
  ctx.skillCooldowns.set('route:craft:ashglass', 0);
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:ashglass' });

  const recoveries = receipts.filter((r) => r.action === ASHGLASS_EVIDENCE_RECOVERED_ACTION);
  const ashglassResults = sent.filter((msg) =>
    typeof msg === 'object' &&
    msg !== null &&
    (msg as { type?: string }).type === 'skill_result' &&
    (msg as { skill_id?: string }).skill_id === 'route:craft:ashglass'
  ) as Array<{ success?: boolean; reason?: string }>;

  assert(recoveries.length === 1, 'repeat Ashglass recovery must not emit a second evidence receipt');
  assert(ashglassResults.length === 2, 'repeat Ashglass recovery should return two skill results');
  assert(ashglassResults[0]?.success === true, 'first Ashglass recovery should succeed');
  assert(ashglassResults[1]?.success === false, 'second Ashglass recovery should fail');
  assert(ashglassResults[1]?.reason === 'invalid_target', 'second Ashglass recovery should be rejected as invalid target');
});

test('Soulsteel refinement authorization records no item mint or economy authority', async () => {
  const { ctx, receipts, sent } = context();
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:survey:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:quest:shipment' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:economy:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:soulsteel' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:safety:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:gate:heartforge' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:ashglass' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:refine' });

  const refinement = receipts.find((r) => r.action === SOULSTEEL_REFINEMENT_AUTHORIZED_ACTION);
  assert(refinement, 'missing soulsteel_refinement_authorized receipt');
  assert(refinement.inputs.route_id === 'forgehold_route_slice_v1', 'Soulsteel refinement route mismatch');
  assert(refinement.inputs.refinement_id === 'soulsteel_refinement_authorization_v1', 'Soulsteel refinement id mismatch');
  assert(refinement.inputs.item_minted === false, 'Soulsteel refinement authorization must not mint an item');
  assert(refinement.inputs.travel_unlocked === false, 'Soulsteel refinement authorization must not unlock travel');
  assert(refinement.inputs.economy_impact === 'none', 'Soulsteel refinement authorization should not change economy');
  assert(!receipts.some((r) => r.action === 'wallet_debit'), 'Soulsteel refinement authorization should not debit gold');
  assert(!receipts.some((r) => r.action === 'wallet_credit'), 'Soulsteel refinement authorization should not credit gold');
  assert(!receipts.some((r) => r.action === 'item_minted'), 'Soulsteel refinement authorization should not emit item_minted');

  const result = skillResultFor<{ refinement_id?: string; item_minted?: boolean; travel_unlocked?: boolean; economy_impact?: string; refinement_guard?: { item_mint?: boolean } }>(sent, 'route:craft:refine');
  assert(result?.success === true, 'Soulsteel refinement skill_result should succeed');
  assert(result.payload?.refinement_id === 'soulsteel_refinement_authorization_v1', 'Soulsteel refinement payload id mismatch');
  assert(result.payload?.item_minted === false, 'Soulsteel refinement payload must not mint item');
  assert(result.payload?.travel_unlocked === false, 'Soulsteel refinement payload must not unlock travel');
  assert(result.payload?.economy_impact === 'none', 'Soulsteel refinement payload economy impact mismatch');
  assert(result.payload?.refinement_guard?.item_mint === false, 'Soulsteel refinement payload guard must block item mint');
});

test('Soulsteel component mint records item and inventory receipts without wallet or travel authority', async () => {
  const { ctx, receipts, sent } = context();
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:survey:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:quest:shipment' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:economy:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:soulsteel' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:safety:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:gate:heartforge' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:ashglass' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:refine' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:mint' });

  const itemMint = receipts.find((r) => r.action === 'item_minted' && r.inputs.item_type === 'refined_soulsteel_component');
  const inventoryAdd = receipts.find((r) => r.action === 'item_added_to_inventory' && r.inputs.item_id === 'test_refined_soulsteel_component_1');
  const routeMint = receipts.find((r) => r.action === SOULSTEEL_COMPONENT_MINTED_ACTION);
  assert(itemMint, 'missing item_minted receipt for Soulsteel component');
  assert(inventoryAdd, 'missing item_added_to_inventory receipt for Soulsteel component');
  assert(routeMint, 'missing soulsteel_component_minted route receipt');
  assert(itemMint.inputs.reason === 'forgehold_soulsteel_refinement', 'Soulsteel item mint reason mismatch');
  assert(inventoryAdd.inputs.source === 'forgehold_route', 'Soulsteel inventory source mismatch');
  assert(routeMint.inputs.item_id === 'test_refined_soulsteel_component_1', 'Soulsteel route mint item id mismatch');
  assert(routeMint.inputs.item_type === 'refined_soulsteel_component', 'Soulsteel route mint item type mismatch');
  assert(routeMint.inputs.wallet_debit_gold === 0, 'Soulsteel mint should specify zero wallet debit');
  assert(routeMint.inputs.wallet_credit_gold === 0, 'Soulsteel mint should specify zero wallet credit');
  assert(routeMint.inputs.travel_unlocked === false, 'Soulsteel mint should not unlock travel');
  assert(routeMint.inputs.economy_impact === 'item_mint_only', 'Soulsteel mint should record item-mint-only economy impact');
  assert(!receipts.some((r) => r.action === 'wallet_debit'), 'Soulsteel mint should not debit gold');
  assert(!receipts.some((r) => r.action === 'wallet_credit'), 'Soulsteel mint should not credit gold');
  assert(sent.some((msg) => typeof msg === 'object' && msg !== null && (msg as { type?: string }).type === 'inventory_snapshot'), 'Soulsteel mint should sync inventory');

  const result = skillResultFor<{ item_id?: string; item_type?: string; travel_unlocked?: boolean; economy_impact?: string }>(sent, 'route:craft:mint');
  assert(result?.success === true, 'Soulsteel mint skill_result should succeed');
  assert(result.payload?.item_id === 'test_refined_soulsteel_component_1', 'Soulsteel mint payload item id mismatch');
  assert(result.payload?.item_type === 'refined_soulsteel_component', 'Soulsteel mint payload item type mismatch');
  assert(result.payload?.travel_unlocked === false, 'Soulsteel mint payload must not unlock travel');
  assert(result.payload?.economy_impact === 'item_mint_only', 'Soulsteel mint payload economy impact mismatch');
});

test('Soulsteel refinement authorization is idempotent after receipt-derived authorization', async () => {
  const { ctx, receipts, sent } = context();
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:survey:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:quest:shipment' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:economy:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:soulsteel' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:safety:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:gate:heartforge' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:ashglass' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:refine' });
  ctx.skillCooldowns.set('route:craft:refine', 0);
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:refine' });

  const refinements = receipts.filter((r) => r.action === SOULSTEEL_REFINEMENT_AUTHORIZED_ACTION);
  const refineResults = sent.filter((msg) =>
    typeof msg === 'object' &&
    msg !== null &&
    (msg as { type?: string }).type === 'skill_result' &&
    (msg as { skill_id?: string }).skill_id === 'route:craft:refine'
  ) as Array<{ success?: boolean; reason?: string }>;

  assert(refinements.length === 1, 'repeat Soulsteel refinement must not emit a second authorization receipt');
  assert(refineResults.length === 2, 'repeat Soulsteel refinement should return two skill results');
  assert(refineResults[0]?.success === true, 'first Soulsteel refinement should succeed');
  assert(refineResults[1]?.success === false, 'second Soulsteel refinement should fail');
  assert(refineResults[1]?.reason === 'invalid_target', 'second Soulsteel refinement should be rejected as invalid target');
});

test('Soulsteel component mint is idempotent after receipt-derived item mint', async () => {
  const { ctx, receipts, sent } = context();
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:survey:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:quest:shipment' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:economy:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:soulsteel' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:safety:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:gate:heartforge' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:ashglass' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:refine' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:mint' });
  ctx.skillCooldowns.set('route:craft:mint', 0);
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:mint' });

  const routeMints = receipts.filter((r) => r.action === SOULSTEEL_COMPONENT_MINTED_ACTION);
  const itemMints = receipts.filter((r) => r.action === 'item_minted' && r.inputs.item_type === 'refined_soulsteel_component');
  const inventoryAdds = receipts.filter((r) => r.action === 'item_added_to_inventory' && r.inputs.source === 'forgehold_route');
  const mintResults = sent.filter((msg) =>
    typeof msg === 'object' &&
    msg !== null &&
    (msg as { type?: string }).type === 'skill_result' &&
    (msg as { skill_id?: string }).skill_id === 'route:craft:mint'
  ) as Array<{ success?: boolean; reason?: string }>;

  assert(routeMints.length === 1, 'repeat Soulsteel mint must not emit a second route mint receipt');
  assert(itemMints.length === 1, 'repeat Soulsteel mint must not emit a second item_minted receipt');
  assert(inventoryAdds.length === 1, 'repeat Soulsteel mint must not add a second inventory item');
  assert(mintResults.length === 2, 'repeat Soulsteel mint should return two skill results');
  assert(mintResults[0]?.success === true, 'first Soulsteel mint should succeed');
  assert(mintResults[1]?.success === false, 'second Soulsteel mint should fail');
  assert(mintResults[1]?.reason === 'invalid_target', 'second Soulsteel mint should be rejected as invalid target');
});

test('Forgehold component settlement records valuation without wallet, item transfer, travel, heat, or penalty authority', async () => {
  const { ctx, receipts, sent } = context();
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:survey:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:quest:shipment' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:economy:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:soulsteel' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:safety:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:gate:heartforge' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:ashglass' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:refine' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:mint' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:economy:settle' });

  const settlement = receipts.find((r) => r.action === FORGEHOLD_COMPONENT_SETTLED_ACTION);
  assert(settlement, 'missing forgehold_component_settled receipt');
  assert(settlement.inputs.route_id === 'forgehold_route_slice_v1', 'Forgehold settlement route mismatch');
  assert(settlement.inputs.settlement_id === 'forgehold_soulsteel_component_settlement_v1', 'Forgehold settlement id mismatch');
  assert(settlement.inputs.item_type === 'refined_soulsteel_component', 'Forgehold settlement item type mismatch');
  assert(settlement.inputs.required_component === SOULSTEEL_COMPONENT_MINTED_ACTION, 'Forgehold settlement should require component mint');
  assert(settlement.inputs.appraised_value_gold === 25, 'Forgehold settlement should record appraised value');
  assert(settlement.inputs.settlement_state === 'ledgered', 'Forgehold settlement state mismatch');
  assert(settlement.inputs.economy_impact === 'valuation_only', 'Forgehold settlement should be valuation-only');
  const guard = settlement.inputs.settlement_guard as { wallet_debit_gold?: number; wallet_credit_gold?: number; direct_wallet_mutation?: boolean; item_transfer?: boolean; travel_unlocked?: boolean; heat_changed?: boolean; penalty_applied?: boolean } | undefined;
  assert(guard?.wallet_debit_gold === 0, 'Forgehold settlement should not debit gold');
  assert(guard.wallet_credit_gold === 0, 'Forgehold settlement should not credit gold');
  assert(guard.direct_wallet_mutation === false, 'Forgehold settlement must not directly mutate wallet');
  assert(guard.item_transfer === false, 'Forgehold settlement must not transfer items');
  assert(guard.travel_unlocked === false, 'Forgehold settlement must not unlock travel');
  assert(guard.heat_changed === false, 'Forgehold settlement must not change heat');
  assert(guard.penalty_applied === false, 'Forgehold settlement must not apply penalties');
  assert(!receipts.some((r) => r.action === 'wallet_debit'), 'Forgehold settlement should not emit wallet debit');
  assert(!receipts.some((r) => r.action === 'wallet_credit'), 'Forgehold settlement should not emit wallet credit');

  const result = skillResultFor<{ settlement_id?: string; appraised_value_gold?: number; settlement_state?: string; economy_impact?: string; settlement_guard?: { direct_wallet_mutation?: boolean; item_transfer?: boolean } }>(sent, 'route:economy:settle');
  assert(result?.success === true, 'Forgehold settlement skill_result should succeed');
  assert(result.payload?.settlement_id === 'forgehold_soulsteel_component_settlement_v1', 'Forgehold settlement payload id mismatch');
  assert(result.payload?.appraised_value_gold === 25, 'Forgehold settlement payload should carry value');
  assert(result.payload?.settlement_state === 'ledgered', 'Forgehold settlement payload state mismatch');
  assert(result.payload?.economy_impact === 'valuation_only', 'Forgehold settlement payload economy impact mismatch');
  assert(result.payload?.settlement_guard?.direct_wallet_mutation === false, 'Forgehold settlement payload must not mutate wallet');
  assert(result.payload?.settlement_guard?.item_transfer === false, 'Forgehold settlement payload must not transfer item');
});

test('Forgehold component settlement is idempotent after receipt-derived valuation', async () => {
  const { ctx, receipts, sent } = context();
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:survey:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:quest:shipment' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:economy:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:soulsteel' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:safety:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:gate:heartforge' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:ashglass' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:refine' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:mint' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:economy:settle' });
  ctx.skillCooldowns.set('route:economy:settle', 0);
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:economy:settle' });

  const settlements = receipts.filter((r) => r.action === FORGEHOLD_COMPONENT_SETTLED_ACTION);
  const settleResults = sent.filter((msg) =>
    typeof msg === 'object' &&
    msg !== null &&
    (msg as { type?: string }).type === 'skill_result' &&
    (msg as { skill_id?: string }).skill_id === 'route:economy:settle'
  ) as Array<{ success?: boolean; reason?: string }>;

  assert(settlements.length === 1, 'repeat Forgehold settlement must not emit a second settlement receipt');
  assert(settleResults.length === 2, 'repeat Forgehold settlement should return two skill results');
  assert(settleResults[0]?.success === true, 'first Forgehold settlement should succeed');
  assert(settleResults[1]?.success === false, 'second Forgehold settlement should fail');
  assert(settleResults[1]?.reason === 'invalid_target', 'second Forgehold settlement should be rejected as invalid target');
});

test('Forgehold component payout credits wallet by receipt after settlement', async () => {
  const { ctx, receipts, sent } = context();
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:survey:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:quest:shipment' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:economy:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:soulsteel' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:safety:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:gate:heartforge' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:ashglass' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:refine' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:mint' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:economy:settle' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:economy:payout' });

  const payout = receipts.find((r) => r.action === FORGEHOLD_COMPONENT_PAYOUT_CREDITED_ACTION);
  const credit = receipts.find((r) => r.action === 'wallet_credit' && r.inputs.reason === 'forgehold_payout:forgehold_soulsteel_component_settlement_v1');
  assert(payout, 'missing forgehold_component_payout_credited receipt');
  assert(credit, 'missing wallet_credit receipt for Forgehold payout');
  assert(payout.inputs.route_id === 'forgehold_route_slice_v1', 'Forgehold payout route mismatch');
  assert(payout.inputs.payout_id === 'forgehold_soulsteel_component_payout_v1', 'Forgehold payout id mismatch');
  assert(payout.inputs.required_settlement === FORGEHOLD_COMPONENT_SETTLED_ACTION, 'Forgehold payout should require settlement');
  assert(payout.inputs.wallet_credit_gold === 25, 'Forgehold payout should credit 25 gold');
  assert(payout.inputs.wallet_credit_reason === 'forgehold_payout:forgehold_soulsteel_component_settlement_v1', 'Forgehold payout reason mismatch');
  assert(payout.inputs.balance_gold === 25, 'Forgehold payout should report post-credit balance');
  assert(payout.inputs.economy_impact === 'wallet_credit', 'Forgehold payout should report wallet credit impact');
  assert(credit.inputs.amount === 25, 'Forgehold payout wallet_credit amount mismatch');
  const guard = payout.inputs.payout_guard as { wallet_debit_gold?: number; wallet_credit_gold?: number; direct_wallet_mutation?: boolean; item_transfer?: boolean; travel_unlocked?: boolean; heat_changed?: boolean; penalty_applied?: boolean } | undefined;
  assert(guard?.wallet_debit_gold === 0, 'Forgehold payout should not debit wallet');
  assert(guard.wallet_credit_gold === 25, 'Forgehold payout guard should name credit amount');
  assert(guard.direct_wallet_mutation === false, 'Forgehold payout must not bypass wallet receipts');
  assert(guard.item_transfer === false, 'Forgehold payout must not transfer items');
  assert(guard.travel_unlocked === false, 'Forgehold payout must not unlock travel');
  assert(guard.heat_changed === false, 'Forgehold payout must not change heat');
  assert(guard.penalty_applied === false, 'Forgehold payout must not apply penalties');
  assert(sent.some((msg) => typeof msg === 'object' && msg !== null && (msg as { type?: string }).type === 'wallet_snapshot'), 'Forgehold payout should sync wallet snapshot');

  const result = skillResultFor<{ payout_id?: string; wallet_credit_gold?: number; balance_gold?: number; economy_impact?: string; payout_guard?: { direct_wallet_mutation?: boolean; item_transfer?: boolean } }>(sent, 'route:economy:payout');
  assert(result?.success === true, 'Forgehold payout skill_result should succeed');
  assert(result.payload?.payout_id === 'forgehold_soulsteel_component_payout_v1', 'Forgehold payout payload id mismatch');
  assert(result.payload?.wallet_credit_gold === 25, 'Forgehold payout payload credit mismatch');
  assert(result.payload?.balance_gold === 25, 'Forgehold payout payload balance mismatch');
  assert(result.payload?.economy_impact === 'wallet_credit', 'Forgehold payout payload economy impact mismatch');
  assert(result.payload?.payout_guard?.direct_wallet_mutation === false, 'Forgehold payout payload must not bypass wallet receipts');
  assert(result.payload?.payout_guard?.item_transfer === false, 'Forgehold payout payload must not transfer item');
});

test('Forgehold component payout is idempotent after receipt-derived credit', async () => {
  const { ctx, receipts, sent } = context();
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:survey:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:quest:shipment' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:economy:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:soulsteel' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:safety:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:gate:heartforge' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:ashglass' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:refine' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:mint' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:economy:settle' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:economy:payout' });
  ctx.skillCooldowns.set('route:economy:payout', 0);
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:economy:payout' });

  const payouts = receipts.filter((r) => r.action === FORGEHOLD_COMPONENT_PAYOUT_CREDITED_ACTION);
  const credits = receipts.filter((r) => r.action === 'wallet_credit' && r.inputs.reason === 'forgehold_payout:forgehold_soulsteel_component_settlement_v1');
  const payoutResults = sent.filter((msg) =>
    typeof msg === 'object' &&
    msg !== null &&
    (msg as { type?: string }).type === 'skill_result' &&
    (msg as { skill_id?: string }).skill_id === 'route:economy:payout'
  ) as Array<{ success?: boolean; reason?: string }>;

  assert(payouts.length === 1, 'repeat Forgehold payout must not emit a second payout receipt');
  assert(credits.length === 1, 'repeat Forgehold payout must not emit a second wallet credit');
  assert(payoutResults.length === 2, 'repeat Forgehold payout should return two skill results');
  assert(payoutResults[0]?.success === true, 'first Forgehold payout should succeed');
  assert(payoutResults[1]?.success === false, 'second Forgehold payout should fail');
  assert(payoutResults[1]?.reason === 'invalid_target', 'second Forgehold payout should be rejected as invalid target');
});

test('Dream Gate seal preparation records server gate without traversal or economy authority', async () => {
  const { ctx, receipts, sent } = context();
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:survey:moonspire' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:dream:interpret' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:dream:fragment' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:safety:moonspire' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:gate:moonspire' });

  const seal = receipts.find((r) => r.action === DREAM_GATE_SEAL_PREPARED_ACTION);
  assert(seal, 'missing dream_gate_seal_prepared receipt');
  assert(seal.inputs.route_id === 'moonspire_dream_gate_slice_v1', 'Dream Gate seal route mismatch');
  assert(seal.inputs.seal_id === 'moonspire_dream_gate_server_seal_v1', 'Dream Gate seal id mismatch');
  assert(seal.inputs.traversal_granted === false, 'Dream Gate seal preparation must not grant traversal');
  assert(seal.inputs.economy_impact === 'none', 'Dream Gate seal preparation should not change economy');
  assert(!receipts.some((r) => r.action === 'wallet_debit'), 'Dream Gate seal preparation should not debit gold');
  assert(!receipts.some((r) => r.action === 'item_minted'), 'Dream Gate seal preparation should not mint an item');

  const result = skillResultFor<{ seal_id?: string; traversal_granted?: boolean; economy_impact?: string; required_proofs?: string[] }>(sent, 'route:gate:moonspire');
  assert(result?.success === true, 'Dream Gate seal skill_result should succeed');
  assert(result.payload?.seal_id === 'moonspire_dream_gate_server_seal_v1', 'Dream Gate seal payload id mismatch');
  assert(result.payload?.traversal_granted === false, 'Dream Gate seal payload must not grant traversal');
  assert(result.payload?.economy_impact === 'none', 'Dream Gate seal payload economy impact mismatch');
  assert(result.payload?.required_proofs?.includes('route_abuse_notes_reviewed'), 'Dream Gate seal payload should require safety review');
});

test('Dream Gate traversal authorization records server authority without client position or economy authority', async () => {
  const { ctx, receipts, sent } = context();
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:survey:moonspire' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:dream:interpret' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:dream:fragment' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:safety:moonspire' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:gate:moonspire' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:dream:traverse' });

  const traversal = receipts.find((r) => r.action === DREAM_GATE_TRAVERSAL_AUTHORIZED_ACTION);
  assert(traversal, 'missing dream_gate_traversal_authorized receipt');
  assert(traversal.inputs.route_id === 'moonspire_dream_gate_slice_v1', 'Dream Gate traversal route mismatch');
  assert(traversal.inputs.traversal_id === 'moonspire_dream_gate_traversal_authorization_v1', 'Dream Gate traversal id mismatch');
  assert(traversal.inputs.required_seal === DREAM_GATE_SEAL_PREPARED_ACTION, 'Dream Gate traversal should require seal receipt');
  assert(traversal.inputs.traversal_authorized === true, 'Dream Gate traversal should be server-authorized');
  assert(traversal.inputs.economy_impact === 'none', 'Dream Gate traversal should not change economy');
  const guard = traversal.inputs.authority_guard as { client_position_authority?: boolean; client_map_transition?: boolean; heat_changed?: boolean; penalty_applied?: boolean; item_mint?: boolean } | undefined;
  assert(guard?.client_position_authority === false, 'Dream Gate traversal must not grant client position authority');
  assert(guard.client_map_transition === false, 'Dream Gate traversal must not grant client map transition');
  assert(guard.heat_changed === false, 'Dream Gate traversal must not change heat');
  assert(guard.penalty_applied === false, 'Dream Gate traversal must not apply penalties');
  assert(guard.item_mint === false, 'Dream Gate traversal must not mint items');
  assert(!receipts.some((r) => r.action === 'wallet_debit'), 'Dream Gate traversal should not debit gold');
  assert(!receipts.some((r) => r.action === 'wallet_credit'), 'Dream Gate traversal should not credit gold');
  assert(!receipts.some((r) => r.action === 'item_minted'), 'Dream Gate traversal should not mint an item');

  const result = skillResultFor<{ traversal_id?: string; traversal_authorized?: boolean; economy_impact?: string; authority_guard?: { client_position_authority?: boolean; client_map_transition?: boolean } }>(sent, 'route:dream:traverse');
  assert(result?.success === true, 'Dream Gate traversal skill_result should succeed');
  assert(result.payload?.traversal_id === 'moonspire_dream_gate_traversal_authorization_v1', 'Dream Gate traversal payload id mismatch');
  assert(result.payload?.traversal_authorized === true, 'Dream Gate traversal payload should authorize traversal');
  assert(result.payload?.economy_impact === 'none', 'Dream Gate traversal payload economy impact mismatch');
  assert(result.payload?.authority_guard?.client_position_authority === false, 'Dream Gate traversal payload must not grant client position authority');
  assert(result.payload?.authority_guard?.client_map_transition === false, 'Dream Gate traversal payload must not grant client map transition');
});

test('Dream Gate arrival records threshold phase without client map, economy, heat, or item authority', async () => {
  const { ctx, receipts, sent } = context();
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:survey:moonspire' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:dream:interpret' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:dream:fragment' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:safety:moonspire' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:gate:moonspire' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:dream:traverse' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:dream:arrive' });

  const arrival = receipts.find((r) => r.action === DREAM_GATE_ARRIVAL_RECORDED_ACTION);
  assert(arrival, 'missing dream_gate_arrival_recorded receipt');
  assert(arrival.inputs.route_id === 'moonspire_dream_gate_slice_v1', 'Dream Gate arrival route mismatch');
  assert(arrival.inputs.arrival_id === 'moonspire_dream_gate_threshold_arrival_v1', 'Dream Gate arrival id mismatch');
  assert(arrival.inputs.dream_phase === 'threshold', 'Dream Gate arrival should record threshold phase');
  assert(arrival.inputs.arrival_state === 'witnessed', 'Dream Gate arrival state mismatch');
  assert(arrival.inputs.required_traversal === DREAM_GATE_TRAVERSAL_AUTHORIZED_ACTION, 'Dream Gate arrival should require traversal authorization');
  assert(arrival.inputs.server_transition_recorded === true, 'Dream Gate arrival should record server transition evidence');
  assert(arrival.inputs.economy_impact === 'none', 'Dream Gate arrival should not change economy');
  const guard = arrival.inputs.authority_guard as { client_position_authority?: boolean; client_map_transition?: boolean; heat_changed?: boolean; penalty_applied?: boolean; item_mint?: boolean } | undefined;
  assert(guard?.client_position_authority === false, 'Dream Gate arrival must not grant client position authority');
  assert(guard.client_map_transition === false, 'Dream Gate arrival must not grant client map transition');
  assert(guard.heat_changed === false, 'Dream Gate arrival must not change heat');
  assert(guard.penalty_applied === false, 'Dream Gate arrival must not apply penalties');
  assert(guard.item_mint === false, 'Dream Gate arrival must not mint items');
  assert(!receipts.some((r) => r.action === 'wallet_debit'), 'Dream Gate arrival should not debit gold');
  assert(!receipts.some((r) => r.action === 'wallet_credit'), 'Dream Gate arrival should not credit gold');
  assert(!receipts.some((r) => r.action === 'item_minted'), 'Dream Gate arrival should not mint an item');

  const result = skillResultFor<{ arrival_id?: string; dream_phase?: string; arrival_state?: string; server_transition_recorded?: boolean; economy_impact?: string; authority_guard?: { client_position_authority?: boolean; client_map_transition?: boolean } }>(sent, 'route:dream:arrive');
  assert(result?.success === true, 'Dream Gate arrival skill_result should succeed');
  assert(result.payload?.arrival_id === 'moonspire_dream_gate_threshold_arrival_v1', 'Dream Gate arrival payload id mismatch');
  assert(result.payload?.dream_phase === 'threshold', 'Dream Gate arrival payload phase mismatch');
  assert(result.payload?.arrival_state === 'witnessed', 'Dream Gate arrival payload state mismatch');
  assert(result.payload?.server_transition_recorded === true, 'Dream Gate arrival payload should record server transition');
  assert(result.payload?.economy_impact === 'none', 'Dream Gate arrival payload economy impact mismatch');
  assert(result.payload?.authority_guard?.client_position_authority === false, 'Dream Gate arrival payload must not grant client position authority');
  assert(result.payload?.authority_guard?.client_map_transition === false, 'Dream Gate arrival payload must not grant client map transition');
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
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:economy:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:soulsteel' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:safety:forgehold' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:gate:heartforge' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:ashglass' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:refine' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:mint' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:economy:settle' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:economy:payout' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:survey:moonspire' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:dream:interpret' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:dream:fragment' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:safety:moonspire' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:gate:moonspire' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:dream:traverse' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:dream:arrive' });

  const progress = getOnwardRouteReceiptProgress('p1');
  const routes = buildOnwardRouteProgress(completedRookguard, progress);
  const forgehold = routes.find((route) => route.route_id === 'forgehold_route_slice_v1');
  const moonspire = routes.find((route) => route.route_id === 'moonspire_dream_gate_slice_v1');

  assert(forgehold, 'Forgehold route projection missing');
  assert(moonspire, 'Moonspire route projection missing');
  assert(forgehold.completed_objective_ids.includes('forgehold_route_survey'), 'Forgehold survey should project complete');
  assert(forgehold.completed_objective_ids.includes('forgehold_missing_shipment'), 'Forgehold shipment should project complete');
  assert(forgehold.completed_objective_ids.includes('forgehold_economy_receipts'), 'Forgehold economy quote should project complete');
  assert(forgehold.completed_objective_ids.includes('soulsteel_stabilization'), 'Soulsteel should project complete');
  assert(forgehold.completed_objective_ids.includes('forgehold_abuse_notes'), 'Forgehold safety review should project complete');
  assert(forgehold.completed_objective_ids.includes('heartforge_trial_server_gate'), 'Heartforge gate should project complete');
  assert(forgehold.completed_objective_ids.includes('ashglass_evidence_recovery'), 'Ashglass evidence should project complete');
  assert(forgehold.completed_objective_ids.includes('soulsteel_refinement_authorization'), 'Soulsteel refinement authorization should project complete');
  assert(forgehold.completed_objective_ids.includes('soulsteel_component_mint'), 'Soulsteel component mint should project complete');
  assert(forgehold.completed_objective_ids.includes('forgehold_component_settlement'), 'Forgehold component settlement should project complete');
  assert(forgehold.completed_objective_ids.includes('forgehold_component_payout'), 'Forgehold component payout should project complete');
  assert(moonspire.completed_objective_ids.includes('dream_gate_rumor'), 'Moonspire survey should project complete');
  assert(moonspire.completed_objective_ids.includes('symbolic_puzzle_projection'), 'Dream interpretation should project complete');
  assert(moonspire.completed_objective_ids.includes('dream_fragment_evidence'), 'Dream fragment should project complete');
  assert(moonspire.completed_objective_ids.includes('dream_gate_abuse_notes'), 'Dream Gate safety review should project complete');
  assert(moonspire.completed_objective_ids.includes('dream_gate_server_seal'), 'Dream Gate server seal should project complete');
  assert(moonspire.completed_objective_ids.includes('dream_gate_traversal_authorization'), 'Dream Gate traversal authorization should project complete');
  assert(moonspire.completed_objective_ids.includes('dream_gate_arrival_record'), 'Dream Gate arrival should project complete');
  assert(forgehold.next_objective.includes('Forgehold payout is credited'), 'Forgehold next objective should advance after component payout');
  assert(moonspire.next_objective.includes('Dream Gate threshold arrival is recorded'), 'Moonspire next objective should advance after Dream Gate arrival');
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
