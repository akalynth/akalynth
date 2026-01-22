package com.akalynth.client.rules

/**
 * Registry of all rule definitions.
 *
 * Single source of truth for rule metadata.
 * Every RuleId constant must have a corresponding entry here.
 */
object RuleRegistry {

    private val definitions: Map<String, RuleDefinition> = buildMap {
        // =====================================================================
        // Stage Gates
        // =====================================================================

        put(RuleId.STAGE_ATTACK_UNLOCKED_AFTER_COMBAT, RuleDefinition(
            id = RuleId.STAGE_ATTACK_UNLOCKED_AFTER_COMBAT,
            title = "Attack Unlocked",
            description = "The attack button becomes available after your first combat encounter.",
            severity = RuleSeverity.INFO,
            remediation = "Engage in combat to unlock this feature."
        ))

        put(RuleId.STAGE_HOTBAR_UNLOCKED_AFTER_ITEM_PICKUP, RuleDefinition(
            id = RuleId.STAGE_HOTBAR_UNLOCKED_AFTER_ITEM_PICKUP,
            title = "Hotbar Unlocked",
            description = "The hotbar becomes available after picking up your first item.",
            severity = RuleSeverity.INFO,
            remediation = "Pick up an item to unlock the hotbar."
        ))

        put(RuleId.STAGE_WHY_UNLOCKED_AFTER_STAGE_2, RuleDefinition(
            id = RuleId.STAGE_WHY_UNLOCKED_AFTER_STAGE_2,
            title = "Why Button Unlocked",
            description = "The Why button becomes available at Stage 2.",
            severity = RuleSeverity.INFO,
            remediation = "Progress to Stage 2 to unlock explanations."
        ))

        put(RuleId.STAGE_REP_GOLD_UNLOCKED_AFTER_DEATH, RuleDefinition(
            id = RuleId.STAGE_REP_GOLD_UNLOCKED_AFTER_DEATH,
            title = "Reputation & Gold Display Unlocked",
            description = "Reputation and gold displays become available after your first death.",
            severity = RuleSeverity.INFO,
            remediation = "Experience death to unlock these displays."
        ))

        put(RuleId.STAGE_MENU_UNLOCKED_AFTER_STAGE_1, RuleDefinition(
            id = RuleId.STAGE_MENU_UNLOCKED_AFTER_STAGE_1,
            title = "Menu Unlocked",
            description = "The menu button becomes available at Stage 1.",
            severity = RuleSeverity.INFO,
            remediation = "Progress to Stage 1 to unlock the menu."
        ))

        put(RuleId.STAGE_ACTION_BLOCKED_IN_EARLY_STAGE, RuleDefinition(
            id = RuleId.STAGE_ACTION_BLOCKED_IN_EARLY_STAGE,
            title = "Action Locked",
            description = "This action is not available at your current progression stage.",
            severity = RuleSeverity.ENFORCEMENT,
            remediation = "Progress further to unlock this action."
        ))

        put(RuleId.STAGE_UI_ELEMENT_HIDDEN_UNTIL_UNLOCK, RuleDefinition(
            id = RuleId.STAGE_UI_ELEMENT_HIDDEN_UNTIL_UNLOCK,
            title = "Feature Hidden",
            description = "This UI element is hidden until its unlock condition is met.",
            severity = RuleSeverity.INFO,
            remediation = "Complete the required progression to reveal this feature."
        ))

        // =====================================================================
        // Tier Safety
        // =====================================================================

        put(RuleId.TIER2_HOLD_REQUIRED_FOR_ITEM_DROP, RuleDefinition(
            id = RuleId.TIER2_HOLD_REQUIRED_FOR_ITEM_DROP,
            title = "Hold to Drop",
            description = "Dropping items requires holding the confirmation button.",
            severity = RuleSeverity.WARNING,
            remediation = "Hold the button for the required duration to confirm."
        ))

        put(RuleId.TIER3_SLIDE_REQUIRED_FOR_LEGENDARY_DROP, RuleDefinition(
            id = RuleId.TIER3_SLIDE_REQUIRED_FOR_LEGENDARY_DROP,
            title = "Slide to Drop Legendary",
            description = "Dropping legendary items requires a slide confirmation gesture.",
            severity = RuleSeverity.WARNING,
            remediation = "Slide to confirm dropping this valuable item."
        ))

        put(RuleId.TIER_CONFIRMATION_NOT_COMPLETED, RuleDefinition(
            id = RuleId.TIER_CONFIRMATION_NOT_COMPLETED,
            title = "Confirmation Incomplete",
            description = "The required confirmation gesture was not completed.",
            severity = RuleSeverity.ENFORCEMENT,
            remediation = "Complete the full confirmation gesture."
        ))

        put(RuleId.TIER_ACTION_BLOCKED_INSUFFICIENT_CONFIRMATION, RuleDefinition(
            id = RuleId.TIER_ACTION_BLOCKED_INSUFFICIENT_CONFIRMATION,
            title = "Action Blocked",
            description = "This action requires additional confirmation that was not provided.",
            severity = RuleSeverity.ENFORCEMENT,
            remediation = "Provide the required confirmation to proceed."
        ))

        put(RuleId.TIER_CONFIRMATION_CANCELLED_BY_RELEASE, RuleDefinition(
            id = RuleId.TIER_CONFIRMATION_CANCELLED_BY_RELEASE,
            title = "Confirmation Cancelled",
            description = "The confirmation was cancelled because the gesture was released early.",
            severity = RuleSeverity.INFO,
            remediation = "Hold or slide for the full duration to confirm."
        ))

        // =====================================================================
        // Overlay Contention
        // =====================================================================

        put(RuleId.OVERLAY_ACTION_BLOCKED_DUE_TO_ACTIVE_OVERLAY, RuleDefinition(
            id = RuleId.OVERLAY_ACTION_BLOCKED_DUE_TO_ACTIVE_OVERLAY,
            title = "Action Blocked by Overlay",
            description = "This action cannot be performed while another overlay is active.",
            severity = RuleSeverity.ENFORCEMENT,
            remediation = "Dismiss the current overlay first."
        ))

        put(RuleId.OVERLAY_WHY_BLOCKED_DURING_CRITICAL_FLOW, RuleDefinition(
            id = RuleId.OVERLAY_WHY_BLOCKED_DURING_CRITICAL_FLOW,
            title = "Why Unavailable",
            description = "The Why button is unavailable during critical flows like death or confirmation.",
            severity = RuleSeverity.INFO,
            remediation = "Complete or dismiss the current flow to access Why."
        ))

        put(RuleId.OVERLAY_INPUT_IGNORED_WHILE_CONFIRMATION_ACTIVE, RuleDefinition(
            id = RuleId.OVERLAY_INPUT_IGNORED_WHILE_CONFIRMATION_ACTIVE,
            title = "Input Ignored",
            description = "Inputs outside the confirmation area are ignored during confirmation.",
            severity = RuleSeverity.INFO,
            remediation = "Complete or cancel the confirmation first."
        ))

        put(RuleId.OVERLAY_CONFIRMATION_HAS_PRIORITY_OVER_WHY, RuleDefinition(
            id = RuleId.OVERLAY_CONFIRMATION_HAS_PRIORITY_OVER_WHY,
            title = "Confirmation Priority",
            description = "Confirmation overlays have priority over the Why explanation.",
            severity = RuleSeverity.INFO
        ))

        put(RuleId.OVERLAY_DEATH_FLOW_HAS_PRIORITY_OVER_WHY, RuleDefinition(
            id = RuleId.OVERLAY_DEATH_FLOW_HAS_PRIORITY_OVER_WHY,
            title = "Death Flow Priority",
            description = "Death notifications and recaps have priority over the Why explanation.",
            severity = RuleSeverity.INFO
        ))

        // =====================================================================
        // Receipt Lifecycle
        // =====================================================================

        put(RuleId.RECEIPT_PENDING_AWAITING_CONFIRMATION, RuleDefinition(
            id = RuleId.RECEIPT_PENDING_AWAITING_CONFIRMATION,
            title = "Awaiting Confirmation",
            description = "This action is pending confirmation from the server.",
            severity = RuleSeverity.INFO,
            remediation = "Wait for server confirmation."
        ))

        put(RuleId.RECEIPT_CONFIRMED_BY_SERVER, RuleDefinition(
            id = RuleId.RECEIPT_CONFIRMED_BY_SERVER,
            title = "Confirmed",
            description = "This action has been confirmed by the server authority.",
            severity = RuleSeverity.INFO
        ))

        put(RuleId.RECEIPT_REJECTED_BY_SERVER, RuleDefinition(
            id = RuleId.RECEIPT_REJECTED_BY_SERVER,
            title = "Rejected",
            description = "This action was rejected by the server authority.",
            severity = RuleSeverity.ENFORCEMENT
        ))

        put(RuleId.RECEIPT_UPGRADED_FROM_PENDING, RuleDefinition(
            id = RuleId.RECEIPT_UPGRADED_FROM_PENDING,
            title = "Confirmed from Pending",
            description = "This pending action has been upgraded to confirmed status.",
            severity = RuleSeverity.INFO
        ))

        put(RuleId.RECEIPT_DUPLICATE_IGNORED, RuleDefinition(
            id = RuleId.RECEIPT_DUPLICATE_IGNORED,
            title = "Duplicate Ignored",
            description = "A duplicate receipt was received and ignored (idempotent).",
            severity = RuleSeverity.INFO
        ))

        put(RuleId.RECEIPT_OUT_OF_ORDER_REPLAYED, RuleDefinition(
            id = RuleId.RECEIPT_OUT_OF_ORDER_REPLAYED,
            title = "Receipt Replayed",
            description = "An out-of-order receipt was replayed into the correct position.",
            severity = RuleSeverity.INFO
        ))

        // =====================================================================
        // Death Mechanics
        // =====================================================================

        put(RuleId.DEATH_TRIGGERED_BY_COMBAT, RuleDefinition(
            id = RuleId.DEATH_TRIGGERED_BY_COMBAT,
            title = "Death by Combat",
            description = "Death was triggered by combat damage.",
            severity = RuleSeverity.INFO
        ))

        put(RuleId.DEATH_ITEMS_LOST_ON_DEATH, RuleDefinition(
            id = RuleId.DEATH_ITEMS_LOST_ON_DEATH,
            title = "Items Lost",
            description = "Items were lost as a consequence of death.",
            severity = RuleSeverity.WARNING
        ))

        put(RuleId.DEATH_LOCATION_RECORDED, RuleDefinition(
            id = RuleId.DEATH_LOCATION_RECORDED,
            title = "Death Location Recorded",
            description = "The location of death has been recorded in your chronicle.",
            severity = RuleSeverity.INFO
        ))

        // =====================================================================
        // Drop Mechanics
        // =====================================================================

        put(RuleId.DROP_ITEM_REMOVED_FROM_INVENTORY, RuleDefinition(
            id = RuleId.DROP_ITEM_REMOVED_FROM_INVENTORY,
            title = "Item Removed",
            description = "The item has been removed from your inventory.",
            severity = RuleSeverity.INFO
        ))

        put(RuleId.DROP_ITEM_PLACED_IN_WORLD, RuleDefinition(
            id = RuleId.DROP_ITEM_PLACED_IN_WORLD,
            title = "Item Placed",
            description = "The item has been placed in the world at your location.",
            severity = RuleSeverity.INFO
        ))

        put(RuleId.DROP_LOCATION_RECORDED, RuleDefinition(
            id = RuleId.DROP_LOCATION_RECORDED,
            title = "Drop Location Recorded",
            description = "The drop location has been recorded in your chronicle.",
            severity = RuleSeverity.INFO
        ))

        put(RuleId.DROP_LEGENDARY_REQUIRES_TIER3, RuleDefinition(
            id = RuleId.DROP_LEGENDARY_REQUIRES_TIER3,
            title = "Legendary Drop Protection",
            description = "Legendary items require Tier 3 (slide) confirmation to drop.",
            severity = RuleSeverity.WARNING,
            remediation = "Use the slide gesture to confirm dropping this legendary item."
        ))

        put(RuleId.DROP_LOSS_DUE_TO_DEATH, RuleDefinition(
            id = RuleId.DROP_LOSS_DUE_TO_DEATH,
            title = "Lost on Death",
            description = "This item was lost as a consequence of death.",
            severity = RuleSeverity.INFO
        ))

        put(RuleId.DROP_LOSS_DUE_TO_PLAYER_ACTION, RuleDefinition(
            id = RuleId.DROP_LOSS_DUE_TO_PLAYER_ACTION,
            title = "Dropped by Player",
            description = "This item was dropped by intentional player action.",
            severity = RuleSeverity.INFO
        ))
    }

    /**
     * Get a rule definition by ID.
     *
     * @param id The rule ID
     * @return The rule definition, or null if not found
     */
    fun get(id: String): RuleDefinition? = definitions[id]

    /**
     * Get a rule definition by ID, throwing if not found.
     *
     * @param id The rule ID
     * @return The rule definition
     * @throws IllegalArgumentException if rule not found
     */
    fun require(id: String): RuleDefinition =
        definitions[id] ?: throw IllegalArgumentException("Unknown rule ID: $id")

    /**
     * Get all registered rule IDs.
     */
    fun allIds(): Set<String> = definitions.keys

    /**
     * Get all rule definitions.
     */
    fun all(): Collection<RuleDefinition> = definitions.values

    /**
     * Check if a rule ID is registered.
     */
    fun contains(id: String): Boolean = definitions.containsKey(id)

    /**
     * Get rules by severity.
     */
    fun bySeverity(severity: RuleSeverity): List<RuleDefinition> =
        definitions.values.filter { it.severity == severity }

    /**
     * Get rules by domain prefix.
     */
    fun byDomain(domain: String): List<RuleDefinition> =
        definitions.values.filter { it.id.startsWith(domain) }
}
