package com.akalynth.client.explain

import com.akalynth.client.actions.ActionIntent
import com.akalynth.client.chronicle.ChronicleEvent
import com.akalynth.client.chronicle.Receipt

/**
 * Subject of an explanation.
 *
 * The engine can explain:
 * - Pending intents (before receipt)
 * - Receipts (confirmed/rejected)
 * - Chronicle events (any status)
 * - UI blocks (stage/tier/overlay)
 */
sealed interface ExplainSubject {
    /**
     * Explain a pending action intent.
     * Use when the user asks "why is this not final yet?"
     */
    data class Intent(val intent: ActionIntent) : ExplainSubject

    /**
     * Explain a server receipt.
     * Use for "why did this happen?" after confirmation/rejection.
     */
    data class ReceiptSubject(val receipt: Receipt) : ExplainSubject

    /**
     * Explain a chronicle event.
     * Delegates to pending or receipt explanation based on status.
     */
    data class Event(val event: ChronicleEvent) : ExplainSubject

    /**
     * Explain a UI block.
     * Use when action was blocked client-side.
     */
    data class UiBlock(
        val action: UiAction,
        val reason: UiBlockReason,
        val context: Map<String, Any?> = emptyMap()
    ) : ExplainSubject
}

/**
 * UI actions that can be blocked.
 */
enum class UiAction {
    ATTACK,
    USE_HOTBAR_SLOT,
    DROP_HOTBAR_SLOT,
    PICKUP_ITEM,
    WHY_BUTTON,
    MENU_BUTTON,
    VIEW_HOTBAR,
    VIEW_REP_GOLD
}

/**
 * Reasons why a UI action was blocked.
 */
enum class UiBlockReason {
    /** Blocked due to insufficient stage progression */
    STAGE_LOCK,

    /** Blocked due to active overlay */
    OVERLAY_ACTIVE,

    /** Blocked due to incomplete tier confirmation */
    TIER_CONFIRMATION_INCOMPLETE,

    /** Blocked due to early release of tier confirmation */
    TIER_CONFIRMATION_CANCELLED,

    /** Blocked because legendary item requires higher tier */
    LEGENDARY_REQUIRES_TIER3,

    /** Generic block reason */
    OTHER
}
