// Akalynth Persistence Layer Types
// Phase 2: Identity, Death, Reputation, World Objects, Items, Inventory
// ============================================================================
// Receipt Taxonomy (Phase 1 + Phase 2)
// ============================================================================
// Canonical receipt actions
export const RECEIPT_ACTIONS = {
    // Player lifecycle
    PLAYER_CREATED: 'player_created',
    PLAYER_RENAMED: 'player_renamed',
    // Death
    DEATH: 'death',
    // Reputation
    REPUTATION_EVENT: 'reputation_event',
    // World objects
    WORLD_OBJECT_SPAWNED: 'world_object_spawned',
    WORLD_OBJECT_TRANSFERRED: 'world_object_transferred',
    WORLD_OBJECT_REMOVED: 'world_object_removed',
    // Phase 2: Items
    ITEM_MINTED: 'item_minted',
    ITEM_ADDED_TO_INVENTORY: 'item_added_to_inventory',
    ITEM_REMOVED_FROM_INVENTORY: 'item_removed_from_inventory',
    ITEM_DROPPED_TO_WORLD: 'item_dropped_to_world',
    ITEM_PICKED_UP_FROM_WORLD: 'item_picked_up_from_world',
    // Phase 3: Legendary heat
    LEGENDARY_HEAT_CHANGED: 'legendary_heat_changed',
    // Phase 3.2: Protected slots
    INVENTORY_SLOT_CHANGED: 'inventory_slot_changed',
    // Phase 3.5: Player heat
    PLAYER_HEAT_CHANGED: 'heat_changed',
    // Phase 3.5: Player heat (PR2)
    HEAT_PENALTY_APPLIED: 'heat_penalty_applied',
    HEAT_TEM_ESCALATION: 'heat_tem_escalation',
    TEM_CHALLENGE_FAILED: 'tem_challenge_failed',
    TEM_CHALLENGE_PASSED: 'tem_challenge_passed',
    THROTTLE: 'throttle',
    KICK: 'kick',
    WARN_ISSUED: 'warn_issued',
    // Origin Act: Player's first meaningful action
    ORIGIN_ACT_SEALED: 'origin_act_sealed',
    // Identity v0.1: Named character creation and token issuance
    CHARACTER_CREATE: 'character_create',
    AUTH_TOKEN_ISSUE: 'auth_token_issue',
    // Dialogue Contract v1: durable NPC talk counter (seeds dialogue variation)
    NPC_TALKED: 'npc_talked',
    // World Events v0: server-authoritative event signals and contributions
    WORLD_EVENT_STARTED: 'world_event_started',
    WORLD_EVENT_EVIDENCE_RECOVERED: 'world_event_evidence_recovered',
    WORLD_EVENT_CONTRIBUTION: 'world_event_contribution',
    WORLD_EVENT_RESOLVED: 'world_event_resolved',
    WORLD_EVENT_TEASER_UNLOCKED: 'world_event_teaser_unlocked',
    // Property Ownership v0: house registry
    PROPERTY_CREATED: 'property_created',
    PROPERTY_LISTED: 'property_listed',
    PROPERTY_UNLISTED: 'property_unlisted',
    PROPERTY_PURCHASED: 'property_purchased',
    PROPERTY_TRANSFERRED: 'property_transferred',
    // Property Auction Lane: durable auction projection
    PROPERTY_AUCTION_OPENED: 'property_auction_opened',
    PROPERTY_BID: 'property_bid',
    PROPERTY_BID_REFUNDED: 'property_bid_refunded',
    PROPERTY_AUCTION_SETTLED: 'property_auction_settled',
    PROPERTY_AUCTION_CANCELLED: 'property_auction_cancelled',
    // Account Platform v1 (E1): privacy-bounded account lifecycle. Receipts for
    // these events carry ONLY event type + opaque account_id + timestamp/sequence
    // + redacted metadata — NEVER email, password, or any verification/reset/
    // session token (plaintext or hash). See docs/account-portal/ +
    // RECEIPT_PRIVACY_BOUNDARY.md. Account rows themselves are written directly by
    // the account API (E2), not materialized from these receipts.
    ACCOUNT_CREATED: 'account_created',
    ACCOUNT_EMAIL_VERIFICATION_REQUESTED: 'account_email_verification_requested',
    ACCOUNT_EMAIL_VERIFIED: 'account_email_verified',
    ACCOUNT_LOGIN_SUCCEEDED: 'account_login_succeeded',
    ACCOUNT_LOGIN_FAILED: 'account_login_failed',
    ACCOUNT_PASSWORD_RESET_REQUESTED: 'account_password_reset_requested',
    ACCOUNT_PASSWORD_RESET_COMPLETED: 'account_password_reset_completed',
    ACCOUNT_SESSION_ISSUED: 'account_session_issued',
    ACCOUNT_SESSION_REVOKED: 'account_session_revoked',
    // Account Platform v1 (E4): character-under-account lifecycle. Privacy-bounded:
    // carry account_id + character_id + world_id + outfit_id + sex only.
    CHARACTER_CREATED: 'character_created',
    CHARACTER_SELECTED: 'character_selected',
    CHARACTER_WORLD_ASSIGNED: 'character_world_assigned',
    CHARACTER_OUTFIT_SELECTED: 'character_outfit_selected',
    // Identity Seal v1: privacy-light principal lifecycle. These receipts carry
    // opaque principal ids, public key fingerprints, proof mechanisms, and
    // server-derived capabilities only. They never carry private keys, raw
    // session tokens, signatures, recovery secrets, email, or legal identity.
    PRINCIPAL_CREATED: 'principal_created',
    PRINCIPAL_TERMS_ACCEPTED: 'principal_terms_accepted',
    PRINCIPAL_CHALLENGE_VERIFIED: 'principal_challenge_verified',
    PRINCIPAL_CHALLENGE_REJECTED: 'principal_challenge_rejected',
    PRINCIPAL_SESSION_ISSUED: 'principal_session_issued',
    PRINCIPAL_SESSION_REVOKED: 'principal_session_revoked',
    PRINCIPAL_PGP_BINDING_PENDING: 'principal_pgp_binding_pending',
    PRINCIPAL_BLOCKED: 'principal_blocked',
    PRINCIPAL_REPORTED: 'principal_reported',
    PRINCIPAL_MODERATION_ACTION: 'principal_moderation_action',
    PRINCIPAL_SEAL_RETIRED: 'principal_seal_retired',
    PRINCIPAL_DELETION_REQUESTED: 'principal_deletion_requested',
};
// Alias mapping for existing receipt actions
export const ACTION_ALIASES = {
    session_guest_minted: RECEIPT_ACTIONS.PLAYER_CREATED,
    // Legacy: old WS mint receipts used 'login' - treat as player_created for replay
    login: RECEIPT_ACTIONS.PLAYER_CREATED,
    death_penalty_applied: RECEIPT_ACTIONS.REPUTATION_EVENT,
    object_dropped: RECEIPT_ACTIONS.WORLD_OBJECT_SPAWNED,
    object_picked_up: RECEIPT_ACTIONS.WORLD_OBJECT_TRANSFERRED,
    object_decayed: RECEIPT_ACTIONS.WORLD_OBJECT_REMOVED,
};
