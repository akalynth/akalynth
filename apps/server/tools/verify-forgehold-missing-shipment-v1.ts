// Proof target: forgehold_missing_shipment_v1
// Authority: AKALYNTH_FORGEHOLD_NEXT_PACKET_V1

import type { WebSocket } from 'ws';
import type { AntiCheatState, Player } from '../../../packages/shared/types.js';
import {
  FORGEHOLD_ASHGLASS_RAVINE_EVIDENCE_RECOVERED_ACTION,
  FORGEHOLD_CARAVAN_EVIDENCE_RECOVERED_ACTION,
  FORGEHOLD_MILEPOST_EVIDENCE_RECOVERED_ACTION,
  FORGEHOLD_SHIPMENT_INVESTIGATED_ACTION,
} from '../../../packages/shared/skills.js';
import { handleUseSkill, type SkillContext } from '../src/skills/index.js';
import { applyReceiptToOnwardRoutes, clearOnwardRouteProjection, getOnwardRouteReceiptProgress } from '../src/world/onwardRoutes.js';

const PROOF_TARGET = 'forgehold_missing_shipment_v1';

function assert(condition: unknown, msg: string): asserts condition {
  if (!condition) throw new Error(msg);
}

function context() {
  clearOnwardRouteProjection();
  const receipts: Array<{ actor_id: string; player_id: string; action: string; inputs: Record<string, unknown>; result: string }> = [];
  const sent: unknown[] = [];
  const ctx: SkillContext = {
    playerId: 'p1',
    playerName: 'Tester',
    ws: {} as WebSocket,
    antiState: { signals: [], warnCount: 0, temChallengeActive: false, temChallengeId: null,
      temChallengeExpires: null, throttleUntil: null, kickCount: 0 } satisfies AntiCheatState,
    skillCooldowns: new Map(),
    onwardRoutesAvailable: true,
    getOnwardRouteProgress: () => getOnwardRouteReceiptProgress('p1'),
    audit: (receipt) => {
      const n = { ...receipt, actor_id: receipt.player_id };
      receipts.push(n);
      applyReceiptToOnwardRoutes(n as never);
    },
    findPlayerOnline: () => null,
    issueTem: () => ({ outcome: 'none' }),
    getChronicle: () => [],
    send: (msg) => sent.push(msg),
    mintItemToInventory: () => { throw new Error('no item mint'); },
    syncInventory: () => undefined,
    creditWallet: () => { throw new Error('no wallet credit'); },
    onSkillResolved: () => undefined,
  };
  return { ctx, receipts, sent };
}

function skillResultFor<T extends Record<string, unknown>>(sent: unknown[], skillId: string) {
  return sent.find((msg) => typeof msg === 'object' && msg !== null &&
    (msg as { type?: string }).type === 'skill_result' &&
    (msg as { skill_id?: string }).skill_id === skillId) as { success?: boolean; reason?: string; payload?: T } | undefined;
}

async function completeActII(ctx: SkillContext) {
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:evidence:milepost' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:evidence:caravan' });
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:evidence:ravine' });
}

async function run() {
  const { ctx, receipts, sent } = context();
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:survey:forgehold' });
  await completeActII(ctx);
  await handleUseSkill(ctx, { type: 'use_skill', skill_id: 'route:quest:shipment' });

  const inv = receipts.find((r) => r.action === FORGEHOLD_SHIPMENT_INVESTIGATED_ACTION);
  assert(inv, 'missing forgehold_shipment_investigated receipt');
  assert(inv.inputs.act_id === 'act_03_burned_caravan_investigation', 'act_id');
  assert(inv.inputs.travel_unlocked === false, 'no travel unlock');
  assert(inv.inputs.economy_impact === 'none', 'no economy');
  const evidence = inv.inputs.evidence_objects as string[];
  assert(evidence.includes('broken_route_seal'), 'broken_route_seal');
  assert(evidence.includes('charred_shipment_plate'), 'charred_shipment_plate');
  assert(evidence.includes('ashglass_shard'), 'ashglass_shard');

  const result = skillResultFor<{ quest_id?: string; contradiction?: string; travel_unlocked?: boolean }>(sent, 'route:quest:shipment');
  assert(result?.success === true, 'skill_result success');
  assert(result.payload?.quest_id === PROOF_TARGET, 'quest_id');
  assert(result.payload?.contradiction === 'departed / undeparted', 'contradiction');
  assert(result.payload?.travel_unlocked === false, 'payload travel_unlocked');

  assert(receipts.some((r) => r.action === FORGEHOLD_MILEPOST_EVIDENCE_RECOVERED_ACTION), 'act II milepost');
  assert(receipts.some((r) => r.action === FORGEHOLD_CARAVAN_EVIDENCE_RECOVERED_ACTION), 'act II caravan');
  assert(receipts.some((r) => r.action === FORGEHOLD_ASHGLASS_RAVINE_EVIDENCE_RECOVERED_ACTION), 'act II ravine');
  assert(!receipts.some((r) => r.action === 'wallet_debit' || r.action === 'item_minted'), 'no economy mutation');

  console.log(`✓ forgehold_missing_shipment_v1 proof OK (${PROOF_TARGET})`);
}

run().catch((err) => { console.error(err); process.exit(1); });