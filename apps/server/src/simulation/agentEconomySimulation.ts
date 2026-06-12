import {
  computeEventHash,
  computeInputsHash,
  computeOutputsHash,
  GENESIS_MARKER,
} from '@akalynth/coordination-kernel';
import type {
  AuditReceipt,
  Direction,
  HousePlot,
  MapData,
  Player,
  PlaceId,
  WalletCreditReason,
  WalletDebitReason,
  WorkContractType,
} from '../../../../packages/shared/types.js';
import {
  ACTION_GOLD_COST,
  PRESENCE_ENTERED_ACTION,
  PRESENCE_LINGERED_ACTION,
  PRESENCE_LINGER_THRESHOLD_MS,
  PRESENCE_OBSERVED_ACTION,
  PRESENCE_OBSERVE_THRESHOLD_MS,
  PROPERTY_AUCTION_OPENED_ACTION,
  PROPERTY_AUCTION_SETTLED_ACTION,
  PROPERTY_BID_ACTION,
  PROPERTY_BID_REFUNDED_ACTION,
  PROPERTY_CREATED_ACTION,
  PROPERTY_LISTED_ACTION,
  PROPERTY_PURCHASED_ACTION,
  PROPERTY_TRANSFERRED_ACTION,
  WALLET_CREDIT_ACTION,
  WALLET_DEBIT_ACTION,
  WORK_CONTRACT_SCHEDULE,
} from '../../../../packages/shared/types.js';
import { computeReceiptHash, generateItemId } from '../persist/index.js';
import { RECEIPT_ACTIONS, type ItemRow } from '../persist/types.js';
import { settleDueAuctions } from '../world/auction-loop.js';
import { handleAttackIntent, type WorldItem } from '../world/combat.js';
import { applyDeath } from '../world/death.js';
import { tryMove } from '../world/movement.js';
import { spawnMobLoot, type MobLootSpawn, type MobLootWriteInput } from '../world/mobs.js';
import { buildNpcDialogue, getNpcDef, getNpcIntent, resolveDialogueTier } from '../world/npcs.js';
import {
  applyReceiptToProperty,
  clearPropertyProjection,
  ensurePropertiesSeeded,
  getAllProperties,
  getMarketListings,
} from '../world/property.js';
import {
  applyReceiptToTreasury,
  canAfford,
  clearTreasuryProjection,
  debitForAction,
  getGoldBalance,
} from '../world/treasury.js';
import {
  applyReceiptToWorkContracts,
  clearWorkContractsProjection,
  completeContract,
  recordTick,
  startContract,
} from '../world/work_contracts.js';
import {
  applyReceiptToPresence,
  clearPresenceProjection,
  getCurrentPlace,
  onPlayerMoved,
  onPresenceTick,
  registerMapPlaces,
} from '../world/presence.js';
import {
  WITNESS_MOTH_BLOOM_EVIDENCE_PREFIX,
  WITNESS_MOTH_BLOOM_SKILL_PREFIX,
  createWitnessMothBloomRuntime,
  handleWitnessMothBloomSkillIntent,
  startWitnessMothBloom,
} from '../world/world-events.js';

export type AgentTrainingRole = 'worker' | 'homesteader' | 'merchant';

export interface AgentNpcDialogueSample {
  agent_id: string;
  npc_id: string;
  place_id: PlaceId;
  tier: string;
  intent_id: string;
  text: string;
}

export interface AgentSimulationInput {
  maps: Record<'Rookguard' | 'Azura', MapData>;
  seed?: number;
  days?: number;
  agents?: Array<{
    id: string;
    name: string;
    role: AgentTrainingRole;
    startingGold?: number;
  }>;
}

export interface AgentTrainingStep {
  step: number;
  tick_ms: number;
  agent_id: string;
  role: AgentTrainingRole;
  map: 'Rookguard' | 'Azura';
  observation: {
    x: number;
    y: number;
    place_id: PlaceId | null;
    gold: number;
    owned_property_count: number;
    market_listing_count: number;
    inventory_count: number;
    loot_event_count: number;
  };
  action: string;
  reward_gold_delta: number;
  accepted: boolean;
  loot_item_id: string | null;
}

export interface AgentEconomySimulationResult {
  seed: number;
  days: number;
  steps: AgentTrainingStep[];
  npc_dialogues: AgentNpcDialogueSample[];
  receipts: AuditReceipt[];
  summary: {
    agent_count: number;
    receipt_count: number;
    wallet_credit_total: number;
    wallet_debit_total: number;
    work_contract_completions: number;
    presence_enters: number;
    presence_lingers: number;
    presence_observations: number;
    loot_mints: number;
    inventory_pickups: number;
    property_sales: number;
    auction_opens: number;
    auction_bids: number;
    auction_refunds: number;
    auction_settlements: number;
    auction_sale_gold: number;
    combat_resolutions: number;
    deaths: number;
    death_item_drops: number;
    world_item_drops: number;
    npc_dialogues: number;
    world_events_started: number;
    world_event_evidence_recovered: number;
    world_event_contributions: number;
    world_events_resolved: number;
    world_event_teasers_unlocked: number;
    listed_properties: number;
    final_gold_by_agent: Record<string, number>;
    owned_properties_by_agent: Record<string, string[]>;
    inventory_by_agent: Record<string, string[]>;
    full_world_maps_touched: string[];
  };
}

interface SimAgent {
  id: string;
  name: string;
  role: AgentTrainingRole;
  map: 'Rookguard' | 'Azura';
  player: Player;
}

interface ReceiptState {
  lastEventHash: string | null;
  sequence: number;
}

const DEFAULT_AGENTS = [
  { id: 'sim:worker:1', name: 'Sim Worker 1', role: 'worker' as const, startingGold: 0 },
  { id: 'sim:homesteader:1', name: 'Sim Homesteader 1', role: 'homesteader' as const, startingGold: 520 },
  { id: 'sim:merchant:1', name: 'Sim Merchant 1', role: 'merchant' as const, startingGold: 1600 },
  { id: 'sim:merchant:2', name: 'Sim Merchant 2', role: 'merchant' as const, startingGold: 4000 },
];

export function runAgentEconomySimulation(input: AgentSimulationInput): AgentEconomySimulationResult {
  const seed = input.seed ?? 1;
  const days = input.days ?? 2;
  const receiptState: ReceiptState = { lastEventHash: null, sequence: 0 };
  const receipts: AuditReceipt[] = [];
  const steps: AgentTrainingStep[] = [];
  const npcDialogues: AgentNpcDialogueSample[] = [];
  const inventoryByAgent = new Map<string, string[]>();
  const itemById = new Map<string, { item_type: string; meta: Record<string, unknown> }>();
  const worldLoot: MobLootSpawn[] = [];
  const worldItems = new Map<'Rookguard' | 'Azura', Map<string, WorldItem>>();
  const reputationByAgent = new Map<string, number>();
  let stepNo = 0;
  let nowMs = Date.UTC(2026, 0, 1, 0, 0, 0);

  clearTreasuryProjection();
  clearWorkContractsProjection();
  clearPropertyProjection();
  clearPresenceProjection();
  registerMapPlaces(input.maps.Rookguard, 'Rookguard');
  registerMapPlaces(input.maps.Azura, 'Azura');

  const emit = makeReceiptEmitter(receiptState, receipts, (receipt) => {
    applyReceiptToTreasury(receipt);
    applyReceiptToWorkContracts(receipt);
    applyReceiptToProperty(receipt);
    applyReceiptToPresence(receipt);
  });

  const agents = (input.agents ?? DEFAULT_AGENTS).map<SimAgent>((a, idx) => {
    const map = idx === 0 ? 'Rookguard' : 'Azura';
    const spawn = input.maps[map].spawn;
    return {
      id: a.id,
      name: a.name,
      role: a.role,
      map,
      player: {
        id: a.id,
        name: a.name,
        x: spawn.x,
        y: spawn.y,
        state: 'in_world',
        status: 'alive',
        hp: 10,
        max_hp: 10,
        reputation: 0,
      },
    };
  });

  seedProperties(input.maps.Azura, emit);
  for (const agent of agents) {
    const startingGold = input.agents?.find((a) => a.id === agent.id)?.startingGold
      ?? DEFAULT_AGENTS.find((a) => a.id === agent.id)?.startingGold
      ?? 0;
    if (startingGold > 0) {
      emit(agent.id, WALLET_CREDIT_ACTION, { amount: startingGold, reason: 'debug_grant' satisfies WalletCreditReason }, nowMs);
    }
  }

  for (let day = 0; day < days; day += 1) {
    for (const agent of agents) {
      moveAgentAcrossWorld(agent, input.maps, seed + day + stepNo);
      onPlayerMoved(agent.id, agent.map, agent.player.x, agent.player.y, nowMs, (r) => emit(r.actor_id, r.action, r.inputs, nowMs));
    }
    for (const agent of agents) {
      onPresenceTick(agent.id, nowMs + 1_000, (r) => emit(r.actor_id, r.action, r.inputs, nowMs + 1_000));
    }
    for (const agent of agents) {
      onPresenceTick(agent.id, nowMs + PRESENCE_OBSERVE_THRESHOLD_MS + 2_000, (r) => emit(r.actor_id, r.action, r.inputs, nowMs + PRESENCE_OBSERVE_THRESHOLD_MS + 2_000));
      onPresenceTick(agent.id, nowMs + PRESENCE_LINGER_THRESHOLD_MS + 2_000, (r) => emit(r.actor_id, r.action, r.inputs, nowMs + PRESENCE_LINGER_THRESHOLD_MS + 2_000));
    }

    for (const agent of agents) {
      const beforeGold = getGoldBalance(agent.id);
      let action = 'idle';
      let accepted = true;
      let loot: MobLootSpawn | null = null;

      if (agent.role === 'worker') {
        action = completeWorkLoop(agent.id, 'temple_sweep', nowMs, emit);
        loot = mintAndPickupLoot(agent, 'training_slime_goo', nowMs + 2, emit, worldLoot, inventoryByAgent, itemById);
      } else if (agent.role === 'homesteader') {
        action = buyFirstAffordableProperty(agent.id, emit, nowMs) ? 'buy_property' : completeWorkLoop(agent.id, 'temple_sweep', nowMs, emit);
        accepted = action !== 'idle';
      } else {
        const marketResult = runMerchantAction(agent.id, emit, nowMs);
        action = marketResult.action;
        accepted = marketResult.accepted;
        if (agent.id.endsWith(':2')) {
          loot = mintAndPickupLoot(agent, 'city_rat_goo', nowMs + 2, emit, worldLoot, inventoryByAgent, itemById);
        }
      }

      const inspect = debitForAction(agent.id, 'inspect_player', (r) => emit(r.actor_id, r.action, r.inputs, nowMs + 1));
      if (inspect.ok) action = `${action}+inspect_player`;
      if (loot) action = `${action}+loot_pickup`;

      steps.push({
        step: stepNo,
        tick_ms: nowMs,
        agent_id: agent.id,
        role: agent.role,
        map: agent.map,
        observation: {
          x: agent.player.x,
          y: agent.player.y,
          place_id: getCurrentPlace(agent.id),
          gold: getGoldBalance(agent.id),
          owned_property_count: getAllProperties().filter((p) => p.owner_player_id === agent.id).length,
          market_listing_count: getMarketListings().length,
          inventory_count: inventoryByAgent.get(agent.id)?.length ?? 0,
          loot_event_count: worldLoot.length,
        },
        action,
        reward_gold_delta: getGoldBalance(agent.id) - beforeGold,
        accepted,
        loot_item_id: loot?.itemId ?? null,
      });
      stepNo += 1;
      nowMs += WORK_CONTRACT_SCHEDULE.temple_sweep.cooldown_ms + 60_000;
    }
  }

  npcDialogues.push(...runNpcDialogueTrainingPhase(agents));
  runWorldEventTrainingPhase(emit, nowMs + 60_000);
  runAuctionTrainingPhase(emit, nowMs);
  runCombatTrainingPhase(agents, nowMs + 120_000, emit, inventoryByAgent, itemById, worldItems, reputationByAgent);

  return {
    seed,
    days,
    steps,
    npc_dialogues: npcDialogues,
    receipts,
    summary: summarizeSimulation(agents, steps, receipts, inventoryByAgent, npcDialogues),
  };
}

function runNpcDialogueTrainingPhase(agents: SimAgent[]): AgentNpcDialogueSample[] {
  const samples: AgentNpcDialogueSample[] = [];
  const configs = [
    { agentId: 'sim:worker:1', npcId: 'rookguard_guide', placeId: 'rookguard:plaza' as PlaceId },
    { agentId: 'sim:merchant:1', npcId: 'azura_herald', placeId: 'azura' as PlaceId },
    { agentId: 'sim:merchant:2', npcId: 'azura_steward', placeId: 'azura' as PlaceId },
  ];
  for (let i = 0; i < configs.length; i += 1) {
    const config = configs[i];
    const agent = agents.find((a) => a.id === config.agentId);
    const npc = getNpcDef(config.npcId);
    if (!agent || !npc) continue;
    const tier = resolveDialogueTier(agent.id, config.placeId);
    samples.push({
      agent_id: agent.id,
      npc_id: npc.npc_id,
      place_id: config.placeId,
      tier,
      intent_id: getNpcIntent(npc, tier),
      text: buildNpcDialogue(npc, tier, { playerId: agent.id, nonce: i }),
    });
  }
  return samples;
}

function runWorldEventTrainingPhase(
  emit: ReturnType<typeof makeReceiptEmitter>,
  nowMs: number
): void {
  const runtime = createWitnessMothBloomRuntime();
  const actor = 'sim:merchant:2';
  const write = (r: { player_id: string; action: string; inputs: Record<string, unknown>; result: string }) => {
    emit(r.player_id, r.action, r.inputs, nowMs);
  };

  startWitnessMothBloom(runtime, { player_id: actor, map: 'Azura', now_ms: nowMs }, write);

  const skillIds = [
    `${WITNESS_MOTH_BLOOM_EVIDENCE_PREFIX}testimony_shard`,
    `${WITNESS_MOTH_BLOOM_EVIDENCE_PREFIX}damaged_ledger`,
    `${WITNESS_MOTH_BLOOM_EVIDENCE_PREFIX}moth_residue`,
    `${WITNESS_MOTH_BLOOM_SKILL_PREFIX}verify_testimony`,
    `${WITNESS_MOTH_BLOOM_SKILL_PREFIX}craft_lantern_frame`,
    `${WITNESS_MOTH_BLOOM_SKILL_PREFIX}defend_scribes`,
  ];
  for (let i = 0; i < skillIds.length; i += 1) {
    handleWitnessMothBloomSkillIntent(
      runtime,
      { player_id: actor, map: 'Azura', skill_id: skillIds[i], now_ms: nowMs + i + 1 },
      write
    );
  }
}

function runCombatTrainingPhase(
  agents: SimAgent[],
  nowMs: number,
  emit: ReturnType<typeof makeReceiptEmitter>,
  inventoryByAgent: Map<string, string[]>,
  itemById: Map<string, { item_type: string; meta: Record<string, unknown> }>,
  worldItems: Map<'Rookguard' | 'Azura', Map<string, WorldItem>>,
  reputationByAgent: Map<string, number>
): void {
  const attacker = agents.find((a) => a.id === 'sim:merchant:2');
  const defender = agents.find((a) => a.id === 'sim:worker:1');
  if (!attacker || !defender) return;

  attacker.map = 'Azura';
  defender.map = 'Azura';
  attacker.player.x = 32;
  attacker.player.y = 32;
  defender.player.x = 33;
  defender.player.y = 32;
  attacker.player.status = 'alive';
  defender.player.status = 'alive';
  defender.player.dead_until_ms = null;

  ensureCombatInventory(defender, nowMs, emit, inventoryByAgent, itemById);

  const sessions = new Map<string, { player?: Player | null; currentMap: 'Rookguard' | 'Azura'; inWorld: boolean }>([
    ['attacker', { player: attacker.player, currentMap: 'Azura', inWorld: true }],
    ['defender', { player: defender.player, currentMap: 'Azura', inWorld: true }],
  ]);
  const inventory = new Map<string, Set<string>>();
  for (const [agentId, items] of inventoryByAgent) inventory.set(agentId, new Set(items));

  handleAttackIntent({
    attackerId: attacker.id,
    targetId: defender.id,
    now: nowMs,
    audit: {
      write: (r) => emit(r.actor_id ?? r.player_id ?? attacker.id, r.action, r.inputs, nowMs),
      close: () => undefined,
    },
    persist: {
      getItem: (itemId: string) => {
        const item = itemById.get(itemId);
        if (!item) return null;
        return {
          item_id: itemId,
          item_type: item.item_type,
          created_at: new Date(nowMs).toISOString(),
          genesis_receipt: `sim:${itemId}`,
          meta_json: JSON.stringify(item.meta),
        } satisfies ItemRow;
      },
    } as never,
    inventory,
    worldItems,
    lastAttackAt: new Map(),
    sessions,
    applyDeathFn: (opts) => applyDeath(opts),
    respawnDelayMs: 30_000,
    adjustReputation: (playerId, delta) => reputationByAgent.set(playerId, (reputationByAgent.get(playerId) ?? 0) + delta),
    setDead: (playerId, deadUntilMs) => {
      const agent = agents.find((a) => a.id === playerId);
      if (agent) {
        agent.player.status = 'dead';
        agent.player.dead_until_ms = deadUntilMs;
      }
    },
    getReputation: (playerId) => reputationByAgent.get(playerId) ?? 0,
    computeReceiptHash,
    getProtectedItemId: () => undefined,
    getRngCommitV1: () => undefined,
    getInventoryCommitSalt: (targetId, seedHash) => computeReceiptHash({ targetId, seedHash, domain: 'agent_sim_inventory_commit_salt' }).replace(/^blake3:/, ''),
  });

  for (const [agentId, items] of inventory) inventoryByAgent.set(agentId, [...items]);
}

function ensureCombatInventory(
  defender: SimAgent,
  nowMs: number,
  emit: ReturnType<typeof makeReceiptEmitter>,
  inventoryByAgent: Map<string, string[]>,
  itemById: Map<string, { item_type: string; meta: Record<string, unknown> }>
): void {
  while ((inventoryByAgent.get(defender.id)?.length ?? 0) < 4) {
    mintAndPickupLoot(defender, 'slime', nowMs + (inventoryByAgent.get(defender.id)?.length ?? 0), emit, [], inventoryByAgent, itemById);
  }
}

function runAuctionTrainingPhase(
  emit: ReturnType<typeof makeReceiptEmitter>,
  nowMs: number
): void {
  const sellerId = 'sim:merchant:2';
  const firstBidderId = 'sim:merchant:1';
  const secondBidderId = 'sim:homesteader:1';
  const property = getAllProperties()
    .filter((p) => p.owner_player_id === sellerId && p.status === 'owned')
    .sort((a, b) => a.property_id.localeCompare(b.property_id))[0];
  if (!property) return;

  const minBid = Math.max(700, property.primary_price_gold + 100);
  const winningBid = minBid + 200;
  const closeMs = nowMs + 60_000;

  ensureGoldForAuctionBid(firstBidderId, minBid, nowMs, emit);
  ensureGoldForAuctionBid(secondBidderId, winningBid, nowMs, emit);

  emit(sellerId, PROPERTY_AUCTION_OPENED_ACTION, {
    property_id: property.property_id,
    kind: 'resale',
    seller_id: sellerId,
    min_bid: minBid,
    min_increment_gold: 100,
    duration_s: 60,
    scheduled_close_ms: closeMs,
  }, nowMs + 1);

  emit(firstBidderId, WALLET_DEBIT_ACTION, {
    amount: minBid,
    reason: `auction_escrow:${property.property_id}` satisfies WalletDebitReason,
  }, nowMs + 2);
  emit(firstBidderId, PROPERTY_BID_ACTION, {
    property_id: property.property_id,
    amount: minBid,
  }, nowMs + 3);

  emit(secondBidderId, WALLET_DEBIT_ACTION, {
    amount: winningBid,
    reason: `auction_escrow:${property.property_id}` satisfies WalletDebitReason,
  }, nowMs + 4);
  emit(firstBidderId, WALLET_CREDIT_ACTION, {
    amount: minBid,
    reason: `auction_refund:${property.property_id}` satisfies WalletCreditReason,
  }, nowMs + 5);
  emit('system', PROPERTY_BID_REFUNDED_ACTION, {
    property_id: property.property_id,
    refunded_player_id: firstBidderId,
    amount: minBid,
  }, nowMs + 6);
  emit(secondBidderId, PROPERTY_BID_ACTION, {
    property_id: property.property_id,
    amount: winningBid,
  }, nowMs + 7);

  settleDueAuctions(closeMs + 1, (r) => emit(r.actor_id, r.action, r.inputs, closeMs + 1));
}

function ensureGoldForAuctionBid(
  agentId: string,
  amount: number,
  nowMs: number,
  emit: ReturnType<typeof makeReceiptEmitter>
): void {
  const balance = getGoldBalance(agentId);
  if (balance >= amount) return;
  emit(agentId, WALLET_CREDIT_ACTION, {
    amount: amount - balance,
    reason: 'debug_grant' satisfies WalletCreditReason,
  }, nowMs);
}

function makeReceiptEmitter(
  state: ReceiptState,
  receipts: AuditReceipt[],
  apply: (receipt: AuditReceipt) => void
) {
  return (actorId: string, action: string, inputs: Record<string, unknown>, nowMs: number): AuditReceipt => {
    const sequence = state.sequence + 1;
    const timestamp = new Date(nowMs).toISOString();
    const prev_hash = state.lastEventHash ?? GENESIS_MARKER;
    const body = {
      sequence,
      timestamp,
      prev_hash,
      actor_id: actorId,
      action,
      inputs,
      result: 'ok',
      inputs_hash: computeInputsHash(inputs),
      outputs_hash: computeOutputsHash('ok'),
    };
    const receipt: AuditReceipt = {
      ...body,
      event_hash: computeEventHash(body),
      signature: 'agent-simulation-fixture',
    };
    state.sequence = sequence;
    state.lastEventHash = receipt.event_hash;
    receipts.push(receipt);
    apply(receipt);
    return receipt;
  };
}

function seedProperties(map: MapData, emit: ReturnType<typeof makeReceiptEmitter>): void {
  const plots = (map.landmarks.house_plots ?? []) as HousePlot[];
  ensurePropertiesSeeded(plots, 'Azura', (r) => emit(r.actor_id, r.action, r.inputs, Date.UTC(2026, 0, 1, 0, 0, 0)));
}

function completeWorkLoop(
  agentId: string,
  contractType: WorkContractType,
  nowMs: number,
  emit: ReturnType<typeof makeReceiptEmitter>
): string {
  const deterministicContractId = `wc_sim_${agentId.replace(/[^a-zA-Z0-9]/g, '_')}_${nowMs}`;
  const started = startContract(agentId, contractType, nowMs, (r) => emit(r.actor_id, r.action, r.inputs, nowMs), deterministicContractId);
  if (!started.ok) return 'idle';

  const schedule = WORK_CONTRACT_SCHEDULE[contractType];
  for (let i = 0; i < schedule.required_ticks; i += 1) {
    const tickAt = nowMs + (i + 1) * schedule.tick_min_interval_ms;
    recordTick(agentId, started.contract_id, tickAt, (r) => emit(r.actor_id, r.action, r.inputs, tickAt));
  }
  const completeAt = nowMs + schedule.min_duration_ms;
  const complete = completeContract(agentId, started.contract_id, completeAt, (r) => emit(r.actor_id, r.action, r.inputs, completeAt));
  return complete.ok ? 'complete_work_contract' : 'work_contract_rejected';
}

function buyFirstAffordableProperty(
  agentId: string,
  emit: ReturnType<typeof makeReceiptEmitter>,
  nowMs: number
): boolean {
  const property = getAllProperties()
    .filter((p) => p.status === 'unowned')
    .sort((a, b) => a.primary_price_gold - b.primary_price_gold)[0];
  if (!property || property.primary_price_gold <= 0 || !canAfford(agentId, property.primary_price_gold)) return false;

  emit(agentId, WALLET_DEBIT_ACTION, {
    amount: property.primary_price_gold,
    reason: `property_purchase:${property.property_id}` satisfies WalletDebitReason,
  }, nowMs);
  emit(agentId, PROPERTY_PURCHASED_ACTION, {
    property_id: property.property_id,
    price: property.primary_price_gold,
  }, nowMs + 1);
  return true;
}

function runMerchantAction(
  agentId: string,
  emit: ReturnType<typeof makeReceiptEmitter>,
  nowMs: number
): { action: string; accepted: boolean } {
  const listing = getMarketListings()
    .filter((p) => p.status === 'listed' && p.owner_player_id !== agentId && p.listed_price_gold !== null)
    .sort((a, b) => (a.listed_price_gold ?? 0) - (b.listed_price_gold ?? 0))[0];
  if (listing?.listed_price_gold !== null && listing?.owner_player_id && canAfford(agentId, listing.listed_price_gold)) {
    emit(agentId, WALLET_DEBIT_ACTION, {
      amount: listing.listed_price_gold,
      reason: `property_transfer:${listing.property_id}` satisfies WalletDebitReason,
    }, nowMs);
    emit(listing.owner_player_id, WALLET_CREDIT_ACTION, {
      amount: listing.listed_price_gold,
      reason: `property_sale:${listing.property_id}` satisfies WalletCreditReason,
    }, nowMs + 1);
    emit(agentId, PROPERTY_TRANSFERRED_ACTION, {
      property_id: listing.property_id,
      seller_id: listing.owner_player_id,
      price: listing.listed_price_gold,
    }, nowMs + 2);
    return { action: 'buy_listed_property', accepted: true };
  }

  const owned = getAllProperties().find((p) => p.owner_player_id === agentId);
  if (!owned && buyFirstAffordableProperty(agentId, emit, nowMs)) return { action: 'buy_property', accepted: true };
  if (owned && owned.status === 'owned') {
    const price = Math.max(owned.primary_price_gold + 100, 700);
    emit(agentId, PROPERTY_LISTED_ACTION, { property_id: owned.property_id, price }, nowMs);
    return { action: 'list_property', accepted: true };
  }

  return { action: 'scan_market', accepted: true };
}

function mintAndPickupLoot(
  agent: SimAgent,
  itemType: string,
  nowMs: number,
  emit: ReturnType<typeof makeReceiptEmitter>,
  worldLoot: MobLootSpawn[],
  inventoryByAgent: Map<string, string[]>,
  itemById: Map<string, { item_type: string; meta: Record<string, unknown> }>
): MobLootSpawn {
  const meta = { source: 'agent_training_simulation', role: agent.role };
  const loot = spawnMobLoot(agent.id, itemType, agent.map, agent.player.x, agent.player.y, {
    writeReceipt: (input: MobLootWriteInput) => emit(input.actor_id ?? input.player_id ?? agent.id, input.action, input.inputs, nowMs),
    computeReceiptHash,
    generateItemId,
    meta,
  });
  worldLoot.push(loot);
  itemById.set(loot.itemId, { item_type: loot.itemType, meta });
  emit(agent.id, 'item_added_to_inventory', {
    item_id: loot.itemId,
    item_type: loot.itemType,
    slot: null,
    source: 'agent_training_simulation_pickup',
  }, nowMs + 1);
  const existing = inventoryByAgent.get(agent.id) ?? [];
  existing.push(loot.itemId);
  inventoryByAgent.set(agent.id, existing);
  return loot;
}

function moveAgentAcrossWorld(agent: SimAgent, maps: AgentSimulationInput['maps'], seed: number): void {
  const directions: Direction[] = ['east', 'south', 'west', 'north'];
  const map = maps[agent.map];
  for (let i = 0; i < 4; i += 1) {
    tryMove(map, agent.player, directions[(seed + i) % directions.length]);
  }
  if (agent.role !== 'worker') {
    agent.map = 'Azura';
  }
}

function summarizeSimulation(
  agents: SimAgent[],
  steps: AgentTrainingStep[],
  receipts: AuditReceipt[],
  inventoryByAgent: Map<string, string[]>,
  npcDialogues: AgentNpcDialogueSample[]
): AgentEconomySimulationResult['summary'] {
  const finalGold: Record<string, number> = {};
  const owned: Record<string, string[]> = {};
  const inventory: Record<string, string[]> = {};
  for (const agent of agents) {
    finalGold[agent.id] = getGoldBalance(agent.id);
    owned[agent.id] = getAllProperties()
      .filter((p) => p.owner_player_id === agent.id)
      .map((p) => p.property_id)
      .sort();
    inventory[agent.id] = [...(inventoryByAgent.get(agent.id) ?? [])].sort();
  }
  return {
    agent_count: agents.length,
    receipt_count: receipts.length,
    wallet_credit_total: sumReceiptAmounts(receipts, WALLET_CREDIT_ACTION),
    wallet_debit_total: sumReceiptAmounts(receipts, WALLET_DEBIT_ACTION),
    work_contract_completions: receipts.filter((r) => r.action === 'work_contract_completed').length,
    presence_enters: receipts.filter((r) => r.action === PRESENCE_ENTERED_ACTION).length,
    presence_lingers: receipts.filter((r) => r.action === PRESENCE_LINGERED_ACTION).length,
    presence_observations: receipts.filter((r) => r.action === PRESENCE_OBSERVED_ACTION).length,
    loot_mints: receipts.filter((r) => r.action === 'item_minted').length,
    inventory_pickups: receipts.filter((r) => r.action === 'item_added_to_inventory').length,
    property_sales: receipts.filter((r) => r.action === PROPERTY_PURCHASED_ACTION || r.action === PROPERTY_TRANSFERRED_ACTION).length,
    auction_opens: receipts.filter((r) => r.action === PROPERTY_AUCTION_OPENED_ACTION).length,
    auction_bids: receipts.filter((r) => r.action === PROPERTY_BID_ACTION).length,
    auction_refunds: receipts.filter((r) => r.action === PROPERTY_BID_REFUNDED_ACTION).length,
    auction_settlements: receipts.filter((r) => r.action === PROPERTY_AUCTION_SETTLED_ACTION).length,
    auction_sale_gold: receipts
      .filter((r) => r.action === WALLET_CREDIT_ACTION && typeof r.inputs.reason === 'string' && r.inputs.reason.startsWith('auction_sale:'))
      .reduce((sum, r) => sum + (typeof r.inputs.amount === 'number' ? r.inputs.amount : 0), 0),
    combat_resolutions: receipts.filter((r) => r.action === 'combat_resolved').length,
    deaths: receipts.filter((r) => r.action === 'death').length,
    death_item_drops: receipts.filter((r) => r.action === 'item_removed_from_inventory' && r.inputs.reason === 'death').length,
    world_item_drops: receipts.filter((r) => r.action === 'item_dropped_to_world').length,
    npc_dialogues: npcDialogues.length,
    world_events_started: receipts.filter((r) => r.action === RECEIPT_ACTIONS.WORLD_EVENT_STARTED).length,
    world_event_evidence_recovered: receipts.filter((r) => r.action === RECEIPT_ACTIONS.WORLD_EVENT_EVIDENCE_RECOVERED).length,
    world_event_contributions: receipts.filter((r) => r.action === RECEIPT_ACTIONS.WORLD_EVENT_CONTRIBUTION).length,
    world_events_resolved: receipts.filter((r) => r.action === RECEIPT_ACTIONS.WORLD_EVENT_RESOLVED).length,
    world_event_teasers_unlocked: receipts.filter((r) => r.action === RECEIPT_ACTIONS.WORLD_EVENT_TEASER_UNLOCKED).length,
    listed_properties: getAllProperties().filter((p) => p.status === 'listed').length,
    final_gold_by_agent: finalGold,
    owned_properties_by_agent: owned,
    inventory_by_agent: inventory,
    full_world_maps_touched: [...new Set(steps.map((s) => s.map))].sort(),
  };
}

function sumReceiptAmounts(receipts: AuditReceipt[], action: string): number {
  return receipts
    .filter((r) => r.action === action)
    .reduce((sum, r) => sum + (typeof r.inputs.amount === 'number' ? r.inputs.amount : 0), 0);
}

export function assertAgentEconomySimulationInvariants(result: AgentEconomySimulationResult): void {
  const actions = new Set(result.receipts.map((r) => r.action));
  const requiredActions = [
    PROPERTY_CREATED_ACTION,
    WALLET_CREDIT_ACTION,
    WALLET_DEBIT_ACTION,
    'work_contract_started',
    'work_contract_tick_recorded',
    'work_contract_completed',
    PROPERTY_PURCHASED_ACTION,
    PROPERTY_LISTED_ACTION,
    PROPERTY_TRANSFERRED_ACTION,
    PROPERTY_AUCTION_OPENED_ACTION,
    PROPERTY_BID_ACTION,
    PROPERTY_BID_REFUNDED_ACTION,
    PROPERTY_AUCTION_SETTLED_ACTION,
    'attack_intent',
    'combat_resolved',
    'death',
    'death_penalty_applied',
    'item_removed_from_inventory',
    'item_dropped_to_world',
    RECEIPT_ACTIONS.WORLD_EVENT_STARTED,
    RECEIPT_ACTIONS.WORLD_EVENT_EVIDENCE_RECOVERED,
    RECEIPT_ACTIONS.WORLD_EVENT_CONTRIBUTION,
    RECEIPT_ACTIONS.WORLD_EVENT_RESOLVED,
    RECEIPT_ACTIONS.WORLD_EVENT_TEASER_UNLOCKED,
    PRESENCE_ENTERED_ACTION,
    PRESENCE_LINGERED_ACTION,
    PRESENCE_OBSERVED_ACTION,
    'item_minted',
    'item_added_to_inventory',
  ];
  for (const action of requiredActions) {
    if (!actions.has(action)) throw new Error(`missing receipt action in simulation: ${action}`);
  }
  if (result.steps.length === 0) throw new Error('simulation produced no training steps');
  if (!result.summary.full_world_maps_touched.includes('Rookguard') || !result.summary.full_world_maps_touched.includes('Azura')) {
    throw new Error('simulation did not touch both full-world maps');
  }
  if (result.summary.wallet_debit_total < ACTION_GOLD_COST.inspect_player) {
    throw new Error('simulation did not exercise costed action gold pressure');
  }
  if (Object.keys(result.summary.owned_properties_by_agent).every((id) => result.summary.owned_properties_by_agent[id].length === 0)) {
    throw new Error('simulation ended with no property ownership');
  }
  if (result.summary.loot_mints < 2 || result.summary.inventory_pickups !== result.summary.loot_mints) {
    throw new Error('simulation did not mint and pick up loot consistently');
  }
  if (Object.values(result.summary.inventory_by_agent).every((items) => items.length === 0)) {
    throw new Error('simulation ended with no inventory items');
  }
  if (result.summary.presence_lingers === 0 || result.summary.presence_observations === 0) {
    throw new Error('simulation did not exercise linger and co-presence receipts');
  }
  if (result.summary.auction_opens === 0 || result.summary.auction_bids < 2 || result.summary.auction_refunds === 0 || result.summary.auction_settlements === 0) {
    throw new Error('simulation did not exercise resale auction open/bid/refund/settle receipts');
  }
  if (result.summary.auction_sale_gold <= 0) {
    throw new Error('simulation did not credit seller from resale auction settlement');
  }
  if (result.summary.combat_resolutions === 0 || result.summary.deaths === 0) {
    throw new Error('simulation did not exercise PvP combat and death receipts');
  }
  if (result.summary.death_item_drops === 0 || result.summary.world_item_drops !== result.summary.death_item_drops) {
    throw new Error('simulation did not drop death loot into world consistently');
  }
  if (result.summary.npc_dialogues < 3 || result.npc_dialogues.some((sample) => sample.intent_id.length === 0 || sample.text.length === 0)) {
    throw new Error('simulation did not produce NPC dialogue training samples');
  }
  if (
    result.summary.world_events_started !== 1 ||
    result.summary.world_event_evidence_recovered !== 3 ||
    result.summary.world_event_contributions !== 3 ||
    result.summary.world_events_resolved !== 1 ||
    result.summary.world_event_teasers_unlocked !== 1
  ) {
    throw new Error('simulation did not complete the Witness Moth Bloom world event path');
  }
}
