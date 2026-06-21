// Akalynth Skills v0 - Utility/Admin Skills
// No HP, no combat, no buffs - just utility actions with receipts

// ============================================================================
// Skill Types
// ============================================================================

export type SkillId =
  | 'skill_inspect'
  | 'skill_ping_tem'
  | 'skill_request_recap'
  | 'skill_report'
  | 'social:gift:gold'
  | 'route:survey:forgehold'
  | 'route:survey:moonspire'
  | 'route:safety:forgehold'
  | 'route:safety:moonspire'
  | 'route:economy:forgehold'
  | 'route:economy:settle'
  | 'route:economy:payout'
  | 'route:craft:soulsteel'
  | 'route:craft:ashglass'
  | 'route:craft:refine'
  | 'route:craft:mint'
  | 'route:gate:heartforge'
  | 'route:gate:moonspire'
  | 'route:dream:traverse'
  | 'route:dream:arrive'
  | 'route:dream:interpret'
  | 'route:dream:fragment'
  | 'route:evidence:milepost'
  | 'route:evidence:caravan'
  | 'route:evidence:ravine'
  | 'route:quest:shipment'
  | 'activity:fishing:rookguard';

export type SkillTarget = 'self' | 'player' | 'none';

export interface SkillDefinition {
  id: SkillId;
  name: string;
  cooldown_ms: number;
  target: SkillTarget;
  gold_cost: number;
  debug_only: boolean;
}

// ============================================================================
// Skill Registry
// ============================================================================

export const SKILL_REGISTRY: Record<SkillId, SkillDefinition> = {
  skill_inspect: {
    id: 'skill_inspect',
    name: 'Inspect',
    cooldown_ms: 5_000,
    target: 'player',
    gold_cost: 0, // v0: no gold cost yet
    debug_only: false,
  },
  skill_ping_tem: {
    id: 'skill_ping_tem',
    name: 'Ping Tem',
    cooldown_ms: 60_000,
    target: 'self',
    gold_cost: 0,
    debug_only: true,
  },
  skill_request_recap: {
    id: 'skill_request_recap',
    name: 'Request Recap',
    cooldown_ms: 30_000,
    target: 'self',
    gold_cost: 0,
    debug_only: false,
  },
  skill_report: {
    id: 'skill_report',
    name: 'Report Player',
    cooldown_ms: 300_000, // 5 minutes
    target: 'player',
    gold_cost: 0,
    debug_only: false,
  },
  'social:gift:gold': {
    id: 'social:gift:gold',
    name: 'Gift 1 Gold',
    cooldown_ms: 10_000,
    target: 'player',
    gold_cost: 1,
    debug_only: false,
  },
  'route:survey:forgehold': {
    id: 'route:survey:forgehold',
    name: 'Survey Forgehold Route',
    cooldown_ms: 30_000,
    target: 'none',
    gold_cost: 0,
    debug_only: false,
  },
  'route:survey:moonspire': {
    id: 'route:survey:moonspire',
    name: 'Survey Moonspire Dream Gate',
    cooldown_ms: 30_000,
    target: 'none',
    gold_cost: 0,
    debug_only: false,
  },
  'route:safety:forgehold': {
    id: 'route:safety:forgehold',
    name: 'Review Forgehold Safety',
    cooldown_ms: 45_000,
    target: 'none',
    gold_cost: 0,
    debug_only: false,
  },
  'route:safety:moonspire': {
    id: 'route:safety:moonspire',
    name: 'Review Dream Gate Safety',
    cooldown_ms: 45_000,
    target: 'none',
    gold_cost: 0,
    debug_only: false,
  },
  'route:economy:forgehold': {
    id: 'route:economy:forgehold',
    name: 'Quote Forgehold Economy',
    cooldown_ms: 45_000,
    target: 'none',
    gold_cost: 0,
    debug_only: false,
  },
  'route:economy:settle': {
    id: 'route:economy:settle',
    name: 'Settle Forgehold Ledger',
    cooldown_ms: 45_000,
    target: 'none',
    gold_cost: 0,
    debug_only: false,
  },
  'route:economy:payout': {
    id: 'route:economy:payout',
    name: 'Credit Forgehold Payout',
    cooldown_ms: 45_000,
    target: 'none',
    gold_cost: 0,
    debug_only: false,
  },
  'route:craft:soulsteel': {
    id: 'route:craft:soulsteel',
    name: 'Stabilize Soulsteel',
    cooldown_ms: 45_000,
    target: 'none',
    gold_cost: 0,
    debug_only: false,
  },
  'route:craft:ashglass': {
    id: 'route:craft:ashglass',
    name: 'Recover Ashglass Evidence',
    cooldown_ms: 45_000,
    target: 'none',
    gold_cost: 0,
    debug_only: false,
  },
  'route:craft:refine': {
    id: 'route:craft:refine',
    name: 'Authorize Soulsteel Refinement',
    cooldown_ms: 45_000,
    target: 'none',
    gold_cost: 0,
    debug_only: false,
  },
  'route:craft:mint': {
    id: 'route:craft:mint',
    name: 'Mint Soulsteel Component',
    cooldown_ms: 45_000,
    target: 'none',
    gold_cost: 0,
    debug_only: false,
  },
  'route:gate:heartforge': {
    id: 'route:gate:heartforge',
    name: 'Prepare Heartforge Gate',
    cooldown_ms: 45_000,
    target: 'none',
    gold_cost: 0,
    debug_only: false,
  },
  'route:gate:moonspire': {
    id: 'route:gate:moonspire',
    name: 'Prepare Dream Gate Seal',
    cooldown_ms: 45_000,
    target: 'none',
    gold_cost: 0,
    debug_only: false,
  },
  'route:dream:traverse': {
    id: 'route:dream:traverse',
    name: 'Authorize Dream Gate Traversal',
    cooldown_ms: 45_000,
    target: 'none',
    gold_cost: 0,
    debug_only: false,
  },
  'route:dream:arrive': {
    id: 'route:dream:arrive',
    name: 'Record Dream Gate Arrival',
    cooldown_ms: 45_000,
    target: 'none',
    gold_cost: 0,
    debug_only: false,
  },
  'route:dream:interpret': {
    id: 'route:dream:interpret',
    name: 'Interpret Dream Gate',
    cooldown_ms: 45_000,
    target: 'none',
    gold_cost: 0,
    debug_only: false,
  },
  'route:dream:fragment': {
    id: 'route:dream:fragment',
    name: 'Anchor Dream Fragment',
    cooldown_ms: 45_000,
    target: 'none',
    gold_cost: 0,
    debug_only: false,
  },
  'route:evidence:milepost': {
    id: 'route:evidence:milepost',
    name: 'Recover Milepost Route Seal',
    cooldown_ms: 45_000,
    target: 'none',
    gold_cost: 0,
    debug_only: false,
  },
  'route:evidence:caravan': {
    id: 'route:evidence:caravan',
    name: 'Recover Caravan Shipment Plate',
    cooldown_ms: 45_000,
    target: 'none',
    gold_cost: 0,
    debug_only: false,
  },
  'route:evidence:ravine': {
    id: 'route:evidence:ravine',
    name: 'Recover Ashglass Ravine Shard',
    cooldown_ms: 45_000,
    target: 'none',
    gold_cost: 0,
    debug_only: false,
  },
  'route:quest:shipment': {
    id: 'route:quest:shipment',
    name: 'Investigate Missing Shipment',
    cooldown_ms: 45_000,
    target: 'none',
    gold_cost: 0,
    debug_only: false,
  },
  'activity:fishing:rookguard': {
    id: 'activity:fishing:rookguard',
    name: 'Fish the Rookguard canal',
    cooldown_ms: 20_000,
    target: 'none',
    gold_cost: 0,
    debug_only: false,
  },
};

export const SKILL_IDS = Object.keys(SKILL_REGISTRY) as SkillId[];

// ============================================================================
// Helpers
// ============================================================================

export function isValidSkillId(id: unknown): id is SkillId {
  return typeof id === 'string' && SKILL_IDS.includes(id as SkillId);
}

export function getSkill(id: SkillId): SkillDefinition {
  return SKILL_REGISTRY[id];
}

// ============================================================================
// Receipt Actions
// ============================================================================

export const SKILL_USE_INTENT_ACTION = 'skill_use_intent';
export const SKILL_RESOLVED_ACTION = 'skill_resolved';
export const SKILL_REJECTED_ACTION = 'skill_rejected';
export const PLAYER_REPORTED_ACTION = 'player_reported';
export const ROUTE_SURVEYED_ACTION = 'route_surveyed';
export const ROUTE_ABUSE_NOTES_REVIEWED_ACTION = 'route_abuse_notes_reviewed';
export const FORGEHOLD_ECONOMY_QUOTED_ACTION = 'forgehold_economy_quoted';
export const FORGEHOLD_COMPONENT_SETTLED_ACTION = 'forgehold_component_settled';
export const FORGEHOLD_COMPONENT_PAYOUT_CREDITED_ACTION = 'forgehold_component_payout_credited';
export const SOULSTEEL_STABILIZED_ACTION = 'soulsteel_stabilized';
export const ASHGLASS_EVIDENCE_RECOVERED_ACTION = 'ashglass_evidence_recovered';
export const SOULSTEEL_REFINEMENT_AUTHORIZED_ACTION = 'soulsteel_refinement_authorized';
export const SOULSTEEL_COMPONENT_MINTED_ACTION = 'soulsteel_component_minted';
export const HEARTFORGE_GATE_PREPARED_ACTION = 'heartforge_gate_prepared';
export const DREAM_GATE_SEAL_PREPARED_ACTION = 'dream_gate_seal_prepared';
export const DREAM_GATE_TRAVERSAL_AUTHORIZED_ACTION = 'dream_gate_traversal_authorized';
export const DREAM_GATE_ARRIVAL_RECORDED_ACTION = 'dream_gate_arrival_recorded';
export const DREAM_GATE_INTERPRETED_ACTION = 'dream_gate_interpreted';
export const DREAM_FRAGMENT_ANCHORED_ACTION = 'dream_fragment_anchored';
export const FORGEHOLD_MILEPOST_EVIDENCE_RECOVERED_ACTION = 'forgehold_milepost_evidence_recovered';
export const FORGEHOLD_CARAVAN_EVIDENCE_RECOVERED_ACTION = 'forgehold_caravan_evidence_recovered';
export const FORGEHOLD_ASHGLASS_RAVINE_EVIDENCE_RECOVERED_ACTION = 'forgehold_ashglass_ravine_evidence_recovered';
export const FORGEHOLD_SHIPMENT_INVESTIGATED_ACTION = 'forgehold_shipment_investigated';
export const ROOKGUARD_CANAL_FISHED_ACTION = 'rookguard_canal_fished';

// Moderation v1: Resolution receipt action
export const MODERATION_RESOLVED_ACTION = 'moderation_resolved';
