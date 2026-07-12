// Akalynth Shared Types
// Used by both server and client
export const DIRECTION_OFFSETS = {
    north: { x: 0, y: -1 },
    south: { x: 0, y: 1 },
    east: { x: 1, y: 0 },
    west: { x: -1, y: 0 },
};
export var TileType;
(function (TileType) {
    TileType[TileType["Grass"] = 0] = "Grass";
    TileType[TileType["Stone"] = 1] = "Stone";
    TileType[TileType["Wall"] = 2] = "Wall";
    TileType[TileType["Water"] = 3] = "Water";
    TileType[TileType["Door"] = 4] = "Door";
})(TileType || (TileType = {}));
export var TileCode;
(function (TileCode) {
    TileCode[TileCode["Grass"] = 0] = "Grass";
    TileCode[TileCode["Stone"] = 1] = "Stone";
    TileCode[TileCode["Wall"] = 2] = "Wall";
    TileCode[TileCode["Water"] = 3] = "Water";
    TileCode[TileCode["Door"] = 4] = "Door";
    TileCode[TileCode["TutorialMove"] = 5] = "TutorialMove";
    TileCode[TileCode["TutorialChat"] = 6] = "TutorialChat";
    TileCode[TileCode["TutorialTem"] = 7] = "TutorialTem";
    TileCode[TileCode["GateToAzura"] = 8] = "GateToAzura";
})(TileCode || (TileCode = {}));
export const WALKABLE_TILES = new Set([
    TileCode.Grass,
    TileCode.Stone,
    TileCode.TutorialMove,
    TileCode.TutorialChat,
    TileCode.TutorialTem,
    TileCode.GateToAzura,
]);
export function respectRankForReputation(reputation) {
    const value = Number.isFinite(reputation) ? Number(reputation) : 0;
    if (value <= -5)
        return 'Frayed';
    if (value < 3)
        return 'Unproven';
    if (value < 10)
        return 'Known';
    if (value < 25)
        return 'Trusted';
    return 'Honored';
}
export const LEDGER_HESITATION_ACTION = 'ledger_hesitation';
export const RUMOR_SEEDED_ACTION = 'rumor_seeded';
export const LEDGER_MARKED_ACTION = 'ledger_marked';
export const LEGEND_SIGHTED_ACTION = 'legend_sighted';
export const LEGEND_ATTEMPTED_ACTION = 'legend_attempted';
export const LEGEND_REFUSED_ACTION = 'legend_refused';
export const FIRST_ATTEMPT_STONE_ACTION = 'first_attempt_stone_cannot_obtain';
export const HEAT_CHANGED_ACTION = 'heat_changed';
export const HEAT_TEM_ESCALATION_ACTION = 'heat_tem_escalation';
export const HEAT_PENALTY_APPLIED_ACTION = 'heat_penalty_applied';
export const WITNESS_REQUESTED_ACTION = 'witness_requested';
export const WITNESS_RESPONSE_ACTION = 'witness_response';
export const WITNESS_QUORUM_ACTION = 'witness_quorum';
export const WITNESS_QUORUM_RESOLVED_ACTION = 'witness_quorum_resolved';
// Sovereign presence (cosmetic only)
export const SOVEREIGN_DECLARED_ACTION = 'sovereign_declared';
export const SOVEREIGN_PRESENCE_ACTION = 'sovereign_presence';
export const SOVEREIGN_MARKED_ACTION = 'sovereign_marked';
export const SOVEREIGN_ECHO_SPAWNED_ACTION = 'sovereign_echo_spawned';
export const SOVEREIGN_ECHO_DESPAWNED_ACTION = 'sovereign_echo_despawned';
// ============================================================================
// Capabilities (enforcement gates, server-only)
// ============================================================================
export const CAP_HOUSE_BUY = 'house:buy';
export const CAP_ECHO_SPAWN = 'echo:spawn';
export const CAP_MAP_ACCESS_PREFIX = 'map:access:';
// Capability receipt actions (private-only, never in PUBLIC_RECEIPTS_ALLOW)
export const CAPABILITY_GRANTED_ACTION = 'capability_granted';
export const CAPABILITY_REVOKED_ACTION = 'capability_revoked';
export const CAPABILITY_GATED_ACTION = 'capability_gated';
export const TEM_CHALLENGE_RESPONSE = 'AKALYNTH';
export const THROTTLE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
export const SIGNAL_DECAY_MS = 60 * 1000; // 60 seconds
export const ELEMENTS = ['fire', 'water', 'earth', 'air', 'light', 'shadow'];
// Runestone receipt actions
export const RUNESTONE_CAST_ACTION = 'runestone_cast';
export const RUNESTONE_RESULT_ACTION = 'runestone_result';
export const RUNESTONE_DENIED_ACTION = 'runestone_denied';
export const TRINITY_OF_SHADOW_ACTION = 'trinity_of_shadow';
// Combat receipt actions (Phase 3)
export const ATTACK_INTENT_ACTION = 'attack_intent';
export const COMBAT_RESOLVED_ACTION = 'combat_resolved';
export const SOVEREIGN_VOCATIONS = [
    'warden',
    'cantor',
    'hexer',
    'reaver',
];
// Explicit label mapping (no ad-hoc capitalize)
export const VOCATION_LABEL = {
    warden: 'Warden',
    cantor: 'Cantor',
    hexer: 'Hexer',
    reaver: 'Reaver',
};
export const VOCATION_COSMETICS = {
    warden: { badge: 'vocation_warden', mark: 'warden_shield' },
    cantor: { badge: 'vocation_cantor', mark: 'cantor_rings' },
    hexer: { badge: 'vocation_hexer', mark: 'hexer_sigil' },
    reaver: { badge: 'vocation_reaver', mark: 'reaver_ember' },
};
// Receipt actions (ALL private in v0)
export const VOCATION_DECLARED_ACTION = 'vocation_declared';
export const SOVEREIGN_PREFIX_GRANTED_ACTION = 'sovereign_prefix_granted';
export const SOVEREIGN_PREFIX_REVOKED_ACTION = 'sovereign_prefix_revoked';
// ============================================================================
// Treasury Kernel v0 (Gold)
// ============================================================================
// Receipt actions (ALL private in v0)
export const WALLET_CREDIT_ACTION = 'wallet_credit';
export const WALLET_DEBIT_ACTION = 'wallet_debit';
// Amount bounds (prevent integer blowups / DoS)
export const MAX_GOLD_AMOUNT = 1_000_000;
// ============================================================================
// Property Registry v0 (House Ownership)
// ============================================================================
// Receipt actions. property_created is system-emitted at boot (seed); the rest
// carry player ids and are surfaced publicly only via anonymized endpoints.
export const PROPERTY_CREATED_ACTION = 'property_created';
export const PROPERTY_LISTED_ACTION = 'property_listed';
export const PROPERTY_UNLISTED_ACTION = 'property_unlisted';
export const PROPERTY_PURCHASED_ACTION = 'property_purchased'; // primary sale (treasury → player, gold sink)
export const PROPERTY_TRANSFERRED_ACTION = 'property_transferred'; // resale (player → player, conserved)
// Reserved receipt action names (NOT emitted by any code path in this change).
export const PROPERTY_AUCTION_OPENED_ACTION = 'property_auction_opened';
export const PROPERTY_BID_ACTION = 'property_bid';
export const PROPERTY_BID_REFUNDED_ACTION = 'property_bid_refunded';
export const PROPERTY_AUCTION_SETTLED_ACTION = 'property_auction_settled';
export const PROPERTY_AUCTION_CANCELLED_ACTION = 'property_auction_cancelled';
// Receipt actions (private-only by default; never in PUBLIC_RECEIPTS_ALLOW)
export const SUPPORT_CREDIT_GRANTED_ACTION = 'support_credit_granted';
export const SUPPORT_CREDIT_SPENT_ACTION = 'support_credit_spent';
export const SUPPORT_ENTITLEMENT_GRANTED_ACTION = 'support_entitlement_granted';
export const SUPPORT_ENTITLEMENT_REVOKED_ACTION = 'support_entitlement_revoked';
export const SUPPORT_REFUND_ISSUED_ACTION = 'support_refund_issued';
// ============================================================================
// Costed Actions v0 (Gold Pressure)
// ============================================================================
// Fixed cost schedule (no dynamic pricing in v0)
// Keys must match protocol message `type` strings exactly
export const ACTION_GOLD_COST = {
    inspect_player: 1,
    // Future costed actions:
    // echo_spawn: 1,
    // world_patch: 1,
};
// ============================================================================
// Work Contract Faucet v0
// ============================================================================
// Receipt actions (ALL private in v0)
export const WORK_CONTRACT_STARTED_ACTION = 'work_contract_started';
export const WORK_CONTRACT_TICK_RECORDED_ACTION = 'work_contract_tick_recorded';
export const WORK_CONTRACT_COMPLETED_ACTION = 'work_contract_completed';
export const WORK_CONTRACT_FAILED_ACTION = 'work_contract_failed';
export const WORK_CONTRACT_TYPES = ['temple_sweep'];
// Fixed schedule (no dynamic tuning in v0)
export const WORK_CONTRACT_SCHEDULE = {
    temple_sweep: {
        payout: 10,
        cooldown_ms: 10 * 60 * 1000, // 10 minutes
        min_duration_ms: 30 * 1000, // 30 seconds
        required_ticks: 6,
        tick_min_interval_ms: 3 * 1000, // 3 seconds
        tick_max_interval_ms: 8 * 1000, // 8 seconds
    },
};
// ============================================================================
// World Presence v0
// ============================================================================
// Receipt actions (ALL private in v0)
export const PRESENCE_ENTERED_ACTION = 'presence_entered';
export const PRESENCE_LINGERED_ACTION = 'presence_lingered';
export const PRESENCE_OBSERVED_ACTION = 'presence_observed';
// Presence thresholds (server-side enforcement)
export const PRESENCE_LINGER_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes to linger
export const PRESENCE_OBSERVE_THRESHOLD_MS = 30 * 1000; // 30 seconds to observe
