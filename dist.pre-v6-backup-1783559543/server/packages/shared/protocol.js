// Akalynth Protocol Messages
// All messages sent over WebSocket
import { ELEMENTS, SOVEREIGN_VOCATIONS, TEM_CHALLENGE_RESPONSE } from './types.js';
// ============================================================================
// Protocol Version
// ============================================================================
export const PROTOCOL_VERSION = '2.1.0';
// ============================================================================
// Message Factories
// ============================================================================
export const ServerMessages = {
    welcome: (version) => ({
        type: 'welcome',
        version,
    }),
    loginAck: (player_id, guest_token, name, ok = true, reason, options) => ({
        type: 'login_ack',
        ok,
        player_id,
        guest_token,
        name,
        reason,
        ...(options?.token && { token: options.token }),
        ...(options?.expires_at && { expires_at: options.expires_at }),
    }),
    worldState: (map, player, nearby_players, builder_preview) => ({
        type: 'world_state',
        map,
        player,
        nearby_players,
        ...(builder_preview ? { builder_preview } : {}),
    }),
    // Chill-Zone Gather v0 (Step 2)
    gatherSnapshot: (nodes, stations) => ({
        type: 'gather_snapshot',
        nodes,
        stations,
    }),
    gatherNodeUpdate: (node) => ({
        type: 'gather_node_update',
        node,
    }),
    gatherResult: (ok, node_id, complete_at_ms, reason) => ({
        type: 'gather_result',
        ok,
        node_id,
        complete_at_ms,
        reason,
    }),
    gatherProgress: (node_id, progress_pct) => ({
        type: 'gather_progress',
        node_id,
        progress_pct,
    }),
    gatherCompleted: (node_id, item_type) => ({
        type: 'gather_completed',
        node_id,
        item_type,
    }),
    deliverResult: (ok, station_id, item_type, source_node_id, reason, reward, refined) => ({
        type: 'deliver_result',
        ok,
        station_id,
        item_type,
        source_node_id,
        reward,
        refined,
        reason,
    }),
    refineResult: (ok, station_id, complete_at_ms, reason) => ({
        type: 'refine_result',
        ok,
        station_id,
        complete_at_ms,
        reason,
    }),
    refineProgress: (station_id, progress_pct) => ({
        type: 'refine_progress',
        station_id,
        progress_pct,
    }),
    refineCompleted: (station_id, item_type) => ({
        type: 'refine_completed',
        station_id,
        item_type,
    }),
    moveResult: (ok, x, y, reason = null, map) => ({
        type: 'move_result',
        ok,
        x,
        y,
        reason,
        map,
    }),
    loopUpdate: (event, loop) => ({
        type: 'loop_update',
        event,
        loop,
    }),
    playerMoved: (player_id, x, y) => ({
        type: 'player_moved',
        player_id,
        x,
        y,
    }),
    playerJoined: (player) => ({
        type: 'player_joined',
        player,
    }),
    playerLeft: (player_id) => ({
        type: 'player_left',
        player_id,
    }),
    chatBroadcast: (player_id, name, message) => ({
        type: 'chat_broadcast',
        player_id,
        name,
        message,
    }),
    temChallenge: (challenge_id, timeout_seconds) => ({
        type: 'tem_challenge',
        challenge_id,
        message: `Type ${TEM_CHALLENGE_RESPONSE} to confirm you are playing by hand. You have ${timeout_seconds} seconds.`,
        timeout_seconds,
    }),
    deathNotice: (respawn_in_ms, map, spawn, reason, extras) => ({
        type: 'death_notice',
        ok: true,
        respawn_in_ms,
        map,
        spawn,
        reason,
        ...(extras ?? {}),
    }),
    error: (code, message) => ({
        type: 'error',
        code,
        message,
    }),
    runestoneResult: (table_id, caster, face, whisper) => ({
        type: 'runestone_result',
        table_id,
        caster,
        face,
        whisper,
    }),
    runestoneDenied: (reason) => ({
        type: 'runestone_denied',
        reason,
    }),
    temWitnessRequest: (request_id, timestamp, map, target_actor, prompt, kind) => ({
        type: 'tem_witness_request',
        request_id,
        timestamp,
        map,
        target_actor,
        prompt,
        kind,
    }),
    // Phase 2: Item messages
    dropItemResult: (ok, item_id, reason = null) => ({
        type: 'drop_item_result',
        ok,
        item_id,
        reason,
    }),
    pickupItemResult: (ok, item_id, reason = null) => ({
        type: 'pickup_item_result',
        ok,
        item_id,
        reason,
    }),
    inventorySnapshot: (items, houseStorage) => ({
        type: 'inventory_snapshot',
        items,
        ...(houseStorage ? { houseStorage } : {}),
    }),
    worldItemAdded: (item_id, item_type, x, y) => ({
        type: 'world_item_added',
        item_id,
        item_type,
        x,
        y,
    }),
    worldItemRemoved: (item_id) => ({
        type: 'world_item_removed',
        item_id,
    }),
    // Phase 3: Combat messages
    combatResolved: (attacker_id, defender_id, outcome, map, x, y) => ({
        type: 'combat_resolved',
        attacker_id,
        defender_id,
        outcome,
        map,
        x,
        y,
    }),
    combatRejected: (reason) => ({
        type: 'combat_rejected',
        reason,
    }),
    // Phase 3.2: Protected slots
    protectedSlotSet: (player_id, item_id, prev_item_id) => ({
        type: 'protected_slot_set',
        player_id,
        item_id,
        prev_item_id,
    }),
    // Phase 4: Chronicle
    chronicleSnapshot: (player_id, events, has_more) => ({
        type: 'chronicle_snapshot',
        player_id,
        events,
        has_more,
    }),
    // Phase 4.4: Chronicle Evidence
    evidenceSnapshot: (status, player_id, opts) => ({
        type: 'evidence_snapshot',
        status,
        player_id,
        ...opts,
    }),
    // Phase 5: Pressure Metrics
    pressureMetricsSnapshot: (player_id, since, until, status, metrics, error_code) => ({
        type: 'pressure_metrics_snapshot',
        player_id,
        since,
        until,
        status,
        metrics,
        error_code,
    }),
    // Sovereign Vocations: Player inspect response
    playerInspect: (player_id, name, vocation, display_vocation, badges, mark, error) => ({
        type: 'player_inspect',
        player_id,
        name,
        vocation,
        display_vocation,
        badges,
        mark,
        error,
    }),
    // Treasury Kernel v0
    walletSnapshot: (gold) => ({
        type: 'wallet_snapshot',
        gold,
    }),
    titheResult: (success, new_balance, error) => ({
        type: 'tithe_result',
        success,
        new_balance,
        error,
    }),
    // Work Contract Faucet v0
    workContractStarted: (contract_id, contract_type, payout_gold, cooldown_seconds, min_duration_ms) => ({
        type: 'work_contract_started',
        contract_id,
        contract_type,
        payout_gold,
        cooldown_seconds,
        min_duration_ms,
    }),
    workProgress: (contract_id, ticks_observed, ticks_required, remaining_ms) => ({
        type: 'work_progress',
        contract_id,
        ticks_observed,
        ticks_required,
        remaining_ms,
    }),
    workContractResult: (contract_id, success, credited_gold, error) => ({
        type: 'work_contract_result',
        contract_id,
        success,
        credited_gold,
        error,
    }),
    // NPC Recognition v0
    npcDialogue: (npc_id, place_id, tier, line) => ({
        type: 'npc_dialogue',
        npc_id,
        place_id,
        tier,
        line,
    }),
    npcDialogueError: (npc_id, error) => ({
        type: 'npc_dialogue_error',
        npc_id,
        error,
    }),
    // Skills v0
    skillResult: (skill_id, success, opts) => ({
        type: 'skill_result',
        skill_id,
        success,
        ...opts,
    }),
    // Moderation v1
    modReportsSnapshot: (reports, has_more) => ({
        type: 'mod_reports_snapshot',
        reports,
        has_more,
    }),
    modResolveResult: (case_id, success, error) => ({
        type: 'mod_resolve_result',
        success,
        case_id,
        error,
    }),
    // Property Ownership v0
    propertySnapshot: (properties) => ({
        type: 'property_snapshot',
        properties,
    }),
    propertyState: (property) => ({
        type: 'property_state',
        property,
    }),
    houseSold: (property_id, plot_id, zone, buyer_name, seller_name, price, sale_count) => ({
        type: 'house_sold',
        property_id,
        plot_id,
        zone,
        buyer_name,
        seller_name,
        price,
        sale_count,
    }),
    propertyResult: (action, success, property_id, reason) => ({
        type: 'property_result',
        action,
        success,
        property_id,
        reason,
    }),
    propertyAuctionState: (property_id, kind, current_high, high_bidder_name, min_next, scheduled_close) => ({
        type: 'property_auction_state',
        property_id,
        kind,
        current_high,
        high_bidder_name,
        min_next,
        scheduled_close,
    }),
    houseAuctionSettled: (property_id, plot_id, zone, winner_name, seller_name, price, sale_count) => ({
        type: 'house_auction_settled',
        property_id,
        plot_id,
        zone,
        winner_name,
        seller_name,
        price,
        sale_count,
    }),
    propertyLedger: (property_id, owner_history, sale_count) => ({
        type: 'property_ledger',
        property_id,
        owner_history,
        sale_count,
    }),
};
// ============================================================================
// Type Guards
// ============================================================================
export function isValidDirection(d) {
    return d === 'north' || d === 'south' || d === 'east' || d === 'west';
}
export function parseClientMessage(data) {
    if (typeof data !== 'object' || data === null)
        return null;
    const msg = data;
    if (typeof msg.type !== 'string')
        return null;
    switch (msg.type) {
        case 'connect':
            return { type: 'connect' };
        case 'login':
            return {
                type: 'login',
                guest_token: typeof msg.guest_token === 'string' ? msg.guest_token : null,
                token: typeof msg.token === 'string' ? msg.token : undefined,
            };
        case 'enter_world':
            return { type: 'enter_world' };
        case 'move_intent':
            if (!isValidDirection(msg.direction))
                return null;
            return { type: 'move_intent', direction: msg.direction };
        case 'chat':
            if (typeof msg.message !== 'string')
                return null;
            return { type: 'chat', message: msg.message };
        case 'tem_response':
            if (typeof msg.response !== 'string')
                return null;
            return { type: 'tem_response', response: msg.response };
        case 'kill_self':
            return { type: 'kill_self' };
        case 'runestone_cast': {
            if (typeof msg.table_id !== 'string')
                return null;
            const guess = typeof msg.guess === 'string' && ELEMENTS.includes(msg.guess)
                ? msg.guess
                : null;
            return { type: 'runestone_cast', table_id: msg.table_id, guess };
        }
        case 'tem_witness_response': {
            const request_id = typeof msg.request_id === 'string' ? msg.request_id : null;
            const response = msg.response;
            if (!request_id)
                return null;
            if (response !== 'confirm' && response !== 'deny' && response !== 'uncertain')
                return null;
            return {
                type: 'tem_witness_response',
                request_id,
                response,
            };
        }
        // Phase 2: Item messages
        case 'drop_item': {
            if (typeof msg.item_id !== 'string')
                return null;
            return { type: 'drop_item', item_id: msg.item_id };
        }
        case 'pickup_item': {
            if (typeof msg.item_id !== 'string')
                return null;
            return { type: 'pickup_item', item_id: msg.item_id };
        }
        // Phase 3: Combat messages
        case 'attack_intent': {
            const target = typeof msg.target_id === 'string'
                ? msg.target_id
                : typeof msg.target_player_id === 'string'
                    ? msg.target_player_id
                    : null;
            if (!target)
                return null;
            return { type: 'attack_intent', target_id: target };
        }
        // Dev-only: Legendary minting
        case 'mint_legendary': {
            const item_type = typeof msg.item_type === 'string' ? msg.item_type : undefined;
            const tier = typeof msg.tier === 'number' && msg.tier >= 1 && msg.tier <= 5 ? msg.tier : undefined;
            return { type: 'mint_legendary', item_type, tier };
        }
        // Phase 3.2: Protected slots
        case 'set_protected_slot': {
            if (typeof msg.item_id !== 'string')
                return null;
            return { type: 'set_protected_slot', item_id: msg.item_id };
        }
        // Phase 4: Chronicle
        case 'get_chronicle': {
            const player_id = typeof msg.player_id === 'string' ? msg.player_id : undefined;
            const limit = typeof msg.limit === 'number' ? msg.limit : undefined;
            const before = typeof msg.before === 'string' ? msg.before : undefined;
            return { type: 'get_chronicle', player_id, limit, before };
        }
        // Phase 4.4: Chronicle Evidence
        case 'get_evidence': {
            const chronicle_event_id = typeof msg.chronicle_event_id === 'number' ? msg.chronicle_event_id : undefined;
            const receipt_hash = typeof msg.receipt_hash === 'string' ? msg.receipt_hash : undefined;
            const kind = typeof msg.kind === 'string' ? msg.kind : undefined;
            // Require at least one anchor
            if (!chronicle_event_id && !receipt_hash)
                return null;
            return { type: 'get_evidence', chronicle_event_id, receipt_hash, kind };
        }
        // Phase 5: Pressure Metrics
        case 'get_pressure_metrics': {
            const since = typeof msg.since === 'string' ? msg.since : undefined;
            const until = typeof msg.until === 'string' ? msg.until : undefined;
            return { type: 'get_pressure_metrics', since, until };
        }
        // Sovereign Vocations
        case 'declare_vocation': {
            const vocation = msg.vocation;
            if (typeof vocation !== 'string')
                return null;
            if (!SOVEREIGN_VOCATIONS.includes(vocation))
                return null;
            return { type: 'declare_vocation', vocation: vocation };
        }
        case 'inspect_player': {
            if (typeof msg.target_player_id !== 'string')
                return null;
            return { type: 'inspect_player', target_player_id: msg.target_player_id };
        }
        case 'grant_sovereign_prefix': {
            if (typeof msg.target_player_id !== 'string')
                return null;
            if (typeof msg.grant !== 'boolean')
                return null;
            return { type: 'grant_sovereign_prefix', target_player_id: msg.target_player_id, grant: msg.grant };
        }
        // Treasury Kernel v0
        case 'inspect_wallet':
            return { type: 'inspect_wallet' };
        case 'pay_tithe': {
            if (typeof msg.amount !== 'number')
                return null;
            return { type: 'pay_tithe', amount: msg.amount };
        }
        case 'grant_gold': {
            if (typeof msg.target_player_id !== 'string')
                return null;
            if (typeof msg.amount !== 'number')
                return null;
            return { type: 'grant_gold', target_player_id: msg.target_player_id, amount: msg.amount };
        }
        // Work Contract Faucet v0
        case 'start_work_contract': {
            if (msg.contract_type !== 'temple_sweep')
                return null;
            return { type: 'start_work_contract', contract_type: msg.contract_type };
        }
        case 'work_tick': {
            if (typeof msg.contract_id !== 'string')
                return null;
            return { type: 'work_tick', contract_id: msg.contract_id };
        }
        // NPC Recognition v0
        case 'talk_to_npc': {
            if (typeof msg.npc_id !== 'string')
                return null;
            return { type: 'talk_to_npc', npc_id: msg.npc_id };
        }
        // Skills v0
        case 'use_skill': {
            if (typeof msg.skill_id !== 'string')
                return null;
            const target_id = typeof msg.target_id === 'string' ? msg.target_id : undefined;
            return { type: 'use_skill', skill_id: msg.skill_id, target_id };
        }
        // Moderation v1
        case 'get_mod_reports': {
            const rawStatus = msg.status;
            const status = rawStatus === undefined ? undefined :
                rawStatus === 'open' ? 'open' :
                    rawStatus === 'resolved' ? 'resolved' :
                        rawStatus === 'all' ? 'all' :
                            null;
            if (status === null)
                return null;
            const limit = typeof msg.limit === 'number' ? msg.limit : undefined;
            return { type: 'get_mod_reports', status, limit };
        }
        case 'mod_resolve': {
            const case_id = typeof msg.case_id === 'string' ? msg.case_id : undefined;
            const receipt_hash = typeof msg.receipt_hash === 'string' ? msg.receipt_hash : undefined;
            // Require at least one lookup key
            if (!case_id && !receipt_hash)
                return null;
            const resolution = msg.resolution;
            if (resolution !== 'no_action' && resolution !== 'warning' && resolution !== 'temp_mute') {
                return null;
            }
            const reason = typeof msg.reason === 'string' ? msg.reason : undefined;
            return { type: 'mod_resolve', case_id, receipt_hash, resolution, reason };
        }
        // Property Ownership v0
        case 'buy_house': {
            if (typeof msg.property_id !== 'string')
                return null;
            return { type: 'buy_house', property_id: msg.property_id };
        }
        case 'list_house': {
            if (typeof msg.property_id !== 'string')
                return null;
            if (typeof msg.price !== 'number')
                return null;
            return { type: 'list_house', property_id: msg.property_id, price: msg.price };
        }
        case 'unlist_house': {
            if (typeof msg.property_id !== 'string')
                return null;
            return { type: 'unlist_house', property_id: msg.property_id };
        }
        case 'get_property_ledger': {
            if (typeof msg.property_id !== 'string')
                return null;
            return { type: 'get_property_ledger', property_id: msg.property_id };
        }
        case 'open_house_auction': {
            if (typeof msg.property_id !== 'string')
                return null;
            if (typeof msg.min_bid !== 'number')
                return null;
            if (typeof msg.min_increment_gold !== 'number')
                return null;
            if (typeof msg.duration_s !== 'number')
                return null;
            return {
                type: 'open_house_auction',
                property_id: msg.property_id,
                min_bid: msg.min_bid,
                min_increment_gold: msg.min_increment_gold,
                duration_s: msg.duration_s,
            };
        }
        case 'place_house_bid': {
            if (typeof msg.property_id !== 'string')
                return null;
            if (typeof msg.amount !== 'number')
                return null;
            return { type: 'place_house_bid', property_id: msg.property_id, amount: msg.amount };
        }
        case 'cancel_house_auction': {
            if (typeof msg.property_id !== 'string')
                return null;
            return { type: 'cancel_house_auction', property_id: msg.property_id };
        }
        // Chill-Zone Gather v0 (Step 2)
        case 'gather_intent': {
            if (typeof msg.node_id !== 'string')
                return null;
            return { type: 'gather_intent', node_id: msg.node_id };
        }
        case 'deliver_intent': {
            if (typeof msg.station_id !== 'string')
                return null;
            return { type: 'deliver_intent', station_id: msg.station_id };
        }
        case 'refine_intent': {
            if (typeof msg.station_id !== 'string')
                return null;
            return { type: 'refine_intent', station_id: msg.station_id };
        }
        default:
            return null;
    }
}
