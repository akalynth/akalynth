package com.akalynth.client.rules

/**
 * Canonical rule IDs for the explanation engine.
 *
 * Naming convention: PREFIX_DOMAIN_ACTION_REASON
 * - Stable forever once published
 * - Never encode UI text in the ID
 * - Human text lives in RuleRegistry metadata
 *
 * Domains:
 * - STAGE: Progression gates
 * - TIER: Destructive action safety
 * - OVERLAY: Attention contention
 * - RECEIPT: Truth lifecycle
 * - DEATH: Death mechanics
 * - DROP: Item drop mechanics
 */
object RuleId {

    // =========================================================================
    // 1. Stage Gates (progression law)
    // =========================================================================

    /** Stage visibility: attack button unlocks after first combat */
    const val STAGE_ATTACK_UNLOCKED_AFTER_COMBAT = "STAGE_ATTACK_UNLOCKED_AFTER_COMBAT"

    /** Stage visibility: hotbar unlocks after first item pickup */
    const val STAGE_HOTBAR_UNLOCKED_AFTER_ITEM_PICKUP = "STAGE_HOTBAR_UNLOCKED_AFTER_ITEM_PICKUP"

    /** Stage visibility: Why button unlocks at stage 2 */
    const val STAGE_WHY_UNLOCKED_AFTER_STAGE_2 = "STAGE_WHY_UNLOCKED_AFTER_STAGE_2"

    /** Stage visibility: Rep/Gold display unlocks after first death */
    const val STAGE_REP_GOLD_UNLOCKED_AFTER_DEATH = "STAGE_REP_GOLD_UNLOCKED_AFTER_DEATH"

    /** Stage visibility: Menu button unlocks at stage 1 */
    const val STAGE_MENU_UNLOCKED_AFTER_STAGE_1 = "STAGE_MENU_UNLOCKED_AFTER_STAGE_1"

    /** Stage enforcement: action blocked due to insufficient progression */
    const val STAGE_ACTION_BLOCKED_IN_EARLY_STAGE = "STAGE_ACTION_BLOCKED_IN_EARLY_STAGE"

    /** Stage enforcement: UI element hidden until unlock condition met */
    const val STAGE_UI_ELEMENT_HIDDEN_UNTIL_UNLOCK = "STAGE_UI_ELEMENT_HIDDEN_UNTIL_UNLOCK"

    // =========================================================================
    // 2. Tier Safety (destructive action law)
    // =========================================================================

    /** Tier requirement: hold confirmation required for item drop */
    const val TIER2_HOLD_REQUIRED_FOR_ITEM_DROP = "TIER2_HOLD_REQUIRED_FOR_ITEM_DROP"

    /** Tier requirement: slide confirmation required for legendary drop */
    const val TIER3_SLIDE_REQUIRED_FOR_LEGENDARY_DROP = "TIER3_SLIDE_REQUIRED_FOR_LEGENDARY_DROP"

    /** Tier requirement: confirmation gesture not completed */
    const val TIER_CONFIRMATION_NOT_COMPLETED = "TIER_CONFIRMATION_NOT_COMPLETED"

    /** Tier enforcement: action blocked due to insufficient confirmation */
    const val TIER_ACTION_BLOCKED_INSUFFICIENT_CONFIRMATION = "TIER_ACTION_BLOCKED_INSUFFICIENT_CONFIRMATION"

    /** Tier enforcement: confirmation cancelled by early release */
    const val TIER_CONFIRMATION_CANCELLED_BY_RELEASE = "TIER_CONFIRMATION_CANCELLED_BY_RELEASE"

    // =========================================================================
    // 3. Overlay Contention (attention law)
    // =========================================================================

    /** Overlay exclusivity: action blocked due to active overlay */
    const val OVERLAY_ACTION_BLOCKED_DUE_TO_ACTIVE_OVERLAY = "OVERLAY_ACTION_BLOCKED_DUE_TO_ACTIVE_OVERLAY"

    /** Overlay exclusivity: Why blocked during critical flow */
    const val OVERLAY_WHY_BLOCKED_DURING_CRITICAL_FLOW = "OVERLAY_WHY_BLOCKED_DURING_CRITICAL_FLOW"

    /** Overlay exclusivity: input ignored while confirmation active */
    const val OVERLAY_INPUT_IGNORED_WHILE_CONFIRMATION_ACTIVE = "OVERLAY_INPUT_IGNORED_WHILE_CONFIRMATION_ACTIVE"

    /** Overlay priority: confirmation has priority over Why */
    const val OVERLAY_CONFIRMATION_HAS_PRIORITY_OVER_WHY = "OVERLAY_CONFIRMATION_HAS_PRIORITY_OVER_WHY"

    /** Overlay priority: death flow has priority over Why */
    const val OVERLAY_DEATH_FLOW_HAS_PRIORITY_OVER_WHY = "OVERLAY_DEATH_FLOW_HAS_PRIORITY_OVER_WHY"

    // =========================================================================
    // 4. Receipt Lifecycle (truth law)
    // =========================================================================

    /** Receipt state: pending, awaiting server confirmation */
    const val RECEIPT_PENDING_AWAITING_CONFIRMATION = "RECEIPT_PENDING_AWAITING_CONFIRMATION"

    /** Receipt state: confirmed by server authority */
    const val RECEIPT_CONFIRMED_BY_SERVER = "RECEIPT_CONFIRMED_BY_SERVER"

    /** Receipt state: rejected by server authority */
    const val RECEIPT_REJECTED_BY_SERVER = "RECEIPT_REJECTED_BY_SERVER"

    /** Receipt correlation: pending event upgraded to confirmed */
    const val RECEIPT_UPGRADED_FROM_PENDING = "RECEIPT_UPGRADED_FROM_PENDING"

    /** Receipt idempotency: duplicate receipt ignored */
    const val RECEIPT_DUPLICATE_IGNORED = "RECEIPT_DUPLICATE_IGNORED"

    /** Receipt replay: out-of-order receipt replayed correctly */
    const val RECEIPT_OUT_OF_ORDER_REPLAYED = "RECEIPT_OUT_OF_ORDER_REPLAYED"

    // =========================================================================
    // 5. Death Mechanics (world law)
    // =========================================================================

    /** Death trigger: death caused by combat */
    const val DEATH_TRIGGERED_BY_COMBAT = "DEATH_TRIGGERED_BY_COMBAT"

    /** Death consequence: items lost on death */
    const val DEATH_ITEMS_LOST_ON_DEATH = "DEATH_ITEMS_LOST_ON_DEATH"

    /** Death record: death location recorded */
    const val DEATH_LOCATION_RECORDED = "DEATH_LOCATION_RECORDED"

    // =========================================================================
    // 6. Drop Mechanics (world law)
    // =========================================================================

    /** Drop action: item removed from inventory */
    const val DROP_ITEM_REMOVED_FROM_INVENTORY = "DROP_ITEM_REMOVED_FROM_INVENTORY"

    /** Drop action: item placed in world */
    const val DROP_ITEM_PLACED_IN_WORLD = "DROP_ITEM_PLACED_IN_WORLD"

    /** Drop record: drop location recorded */
    const val DROP_LOCATION_RECORDED = "DROP_LOCATION_RECORDED"

    /** Drop requirement: legendary items require Tier3 confirmation */
    const val DROP_LEGENDARY_REQUIRES_TIER3 = "DROP_LEGENDARY_REQUIRES_TIER3"

    /** Drop attribution: loss due to death */
    const val DROP_LOSS_DUE_TO_DEATH = "DROP_LOSS_DUE_TO_DEATH"

    /** Drop attribution: loss due to player action */
    const val DROP_LOSS_DUE_TO_PLAYER_ACTION = "DROP_LOSS_DUE_TO_PLAYER_ACTION"

    /**
     * All rule IDs for validation.
     */
    val ALL: Set<String> = setOf(
        // Stage
        STAGE_ATTACK_UNLOCKED_AFTER_COMBAT,
        STAGE_HOTBAR_UNLOCKED_AFTER_ITEM_PICKUP,
        STAGE_WHY_UNLOCKED_AFTER_STAGE_2,
        STAGE_REP_GOLD_UNLOCKED_AFTER_DEATH,
        STAGE_MENU_UNLOCKED_AFTER_STAGE_1,
        STAGE_ACTION_BLOCKED_IN_EARLY_STAGE,
        STAGE_UI_ELEMENT_HIDDEN_UNTIL_UNLOCK,
        // Tier
        TIER2_HOLD_REQUIRED_FOR_ITEM_DROP,
        TIER3_SLIDE_REQUIRED_FOR_LEGENDARY_DROP,
        TIER_CONFIRMATION_NOT_COMPLETED,
        TIER_ACTION_BLOCKED_INSUFFICIENT_CONFIRMATION,
        TIER_CONFIRMATION_CANCELLED_BY_RELEASE,
        // Overlay
        OVERLAY_ACTION_BLOCKED_DUE_TO_ACTIVE_OVERLAY,
        OVERLAY_WHY_BLOCKED_DURING_CRITICAL_FLOW,
        OVERLAY_INPUT_IGNORED_WHILE_CONFIRMATION_ACTIVE,
        OVERLAY_CONFIRMATION_HAS_PRIORITY_OVER_WHY,
        OVERLAY_DEATH_FLOW_HAS_PRIORITY_OVER_WHY,
        // Receipt
        RECEIPT_PENDING_AWAITING_CONFIRMATION,
        RECEIPT_CONFIRMED_BY_SERVER,
        RECEIPT_REJECTED_BY_SERVER,
        RECEIPT_UPGRADED_FROM_PENDING,
        RECEIPT_DUPLICATE_IGNORED,
        RECEIPT_OUT_OF_ORDER_REPLAYED,
        // Death
        DEATH_TRIGGERED_BY_COMBAT,
        DEATH_ITEMS_LOST_ON_DEATH,
        DEATH_LOCATION_RECORDED,
        // Drop
        DROP_ITEM_REMOVED_FROM_INVENTORY,
        DROP_ITEM_PLACED_IN_WORLD,
        DROP_LOCATION_RECORDED,
        DROP_LEGENDARY_REQUIRES_TIER3,
        DROP_LOSS_DUE_TO_DEATH,
        DROP_LOSS_DUE_TO_PLAYER_ACTION
    )
}
