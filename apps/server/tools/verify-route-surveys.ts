// Verify first onward-route survey skills.
//
// The survey path uses existing use_skill intent handling. Clients send only
// a skill id; the server emits skill intent/resolution receipts plus a
// route_surveyed receipt and returns read-only route payloads.

import type { WebSocket } from 'ws';
import type { AntiCheatState, Player } from '../../../packages/shared/types.js';
import { ROUTE_SURVEYED_ACTION, SKILL_RESOLVED_ACTION, SKILL_USE_INTENT_ACTION, SOULSTEEL_STABILIZED_ACTION } from '../../../packages/shared/skills.js';
import { handleUseSkill, type SkillContext } from '../src/skills/index.js';

function assert(condition: unknown, msg: string): asserts condition {
  if (!condition) throw new Error(msg);
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(`  ${err}`);
    process.exit(1);
  }
}

function context() {
  const receipts: Array<{ player_id: string; action: string; inputs: Record<string, unknown>; result: string }> = [];
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
    audit: (receipt) => receipts.push(receipt),
    findPlayerOnline: (_id: string): Player | null => null,
    issueTem: () => ({ outcome: 'none' }),
    getChronicle: () => [],
    send: (msg) => sent.push(msg),
  };
  return { ctx, receipts, sent };
}

test('Forgehold survey emits server-owned route payload and receipts', async () => {
  const { ctx, receipts, sent } = context();
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:survey:forgehold' });

  assert(receipts.some((r) => r.action === SKILL_USE_INTENT_ACTION), 'missing skill intent receipt');
  assert(receipts.some((r) => r.action === SKILL_RESOLVED_ACTION), 'missing skill resolved receipt');
  const survey = receipts.find((r) => r.action === ROUTE_SURVEYED_ACTION);
  assert(survey, 'missing route_surveyed receipt');
  assert(survey.inputs.route_id === 'forgehold_route_slice_v1', 'wrong Forgehold route id');
  assert(Array.isArray(survey.inputs.systems), 'Forgehold systems should be recorded');

  const result = sent.find((msg) => typeof msg === 'object' && msg !== null && (msg as { type?: string }).type === 'skill_result') as {
    success?: boolean;
    payload?: { route_id?: string; systems?: string[] };
  } | undefined;
  assert(result?.success === true, 'Forgehold skill_result should succeed');
  assert(result.payload?.route_id === 'forgehold_route_slice_v1', 'Forgehold payload route mismatch');
  assert(result.payload?.systems?.includes('crafting'), 'Forgehold payload should include crafting');
  assert(result.payload?.systems?.includes('anti_cheat'), 'Forgehold payload should include anti_cheat');
});

test('Moonspire survey emits Dream Gate payload without client traversal truth', async () => {
  const { ctx, receipts, sent } = context();
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:survey:moonspire' });

  const survey = receipts.find((r) => r.action === ROUTE_SURVEYED_ACTION);
  assert(survey, 'missing route_surveyed receipt');
  assert(survey.inputs.route_id === 'moonspire_dream_gate_slice_v1', 'wrong Moonspire route id');

  const result = sent.find((msg) => typeof msg === 'object' && msg !== null && (msg as { type?: string }).type === 'skill_result') as {
    success?: boolean;
    payload?: { route_id?: string; systems?: string[]; next_objective?: string };
  } | undefined;
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
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:craft:soulsteel' });

  const craft = receipts.find((r) => r.action === SOULSTEEL_STABILIZED_ACTION);
  assert(craft, 'missing soulsteel_stabilized receipt');
  assert(craft.inputs.route_id === 'forgehold_route_slice_v1', 'Soulsteel route mismatch');
  assert(craft.inputs.quality === 'unstable', 'first Soulsteel quality should be unstable');
  assert(craft.inputs.economy_impact === 'none', 'Soulsteel prototype should not silently change economy');
  assert(!receipts.some((r) => r.action === 'wallet_debit'), 'Soulsteel prototype should not debit gold');
  assert(!receipts.some((r) => r.action === 'item_minted'), 'Soulsteel prototype should not mint an item');

  const result = sent.find((msg) => typeof msg === 'object' && msg !== null && (msg as { type?: string }).type === 'skill_result') as {
    success?: boolean;
    payload?: { crafting_id?: string; quality?: string; economy_impact?: string; required_evidence?: string[] };
  } | undefined;
  assert(result?.success === true, 'Soulsteel skill_result should succeed');
  assert(result.payload?.crafting_id === 'soulsteel_stabilization_v1', 'Soulsteel payload crafting id mismatch');
  assert(result.payload?.quality === 'unstable', 'Soulsteel payload quality mismatch');
  assert(result.payload?.economy_impact === 'none', 'Soulsteel payload economy impact mismatch');
  assert(result.payload?.required_evidence?.includes('ashglass_shard'), 'Soulsteel payload should name Ashglass Shard');
});

console.log('\n✓ all route survey checks passed');
