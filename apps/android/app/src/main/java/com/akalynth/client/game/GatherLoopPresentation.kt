package com.akalynth.client.game

/**
 * Display-only Azura chill-loop presentation helpers.
 * Mirrors apps/debug-client/src/data/gatherLabels.ts (contract §2.3.1).
 * No protocol authority — derives UI step/labels from server-backed held item only.
 */
object GatherLoopPresentation {
    val STEP_LABELS: List<String> = listOf("Gather", "Attune", "Deliver")

    private val HELD_ITEM_LABELS = mapOf(
        "ley_mote" to "Ley mote",
        "refined_ley_mote" to "Refined ley mote",
    )

    private val REWARD_LABELS = mapOf(
        "tending_token" to "tending token",
        "keystone_token" to "keystone",
    )

    /** 1 = Gather, 2 = Attune, 3 = Deliver */
    fun loopStep(heldItemType: String?): Int {
        if (heldItemType.isNullOrBlank()) return 1
        if (!isRefinedItemType(heldItemType)) return 2
        return 3
    }

    fun isRefinedItemType(itemType: String): Boolean = itemType.startsWith("refined_")

    fun heldItemLabel(itemType: String?): String {
        if (itemType.isNullOrBlank()) return "—"
        return HELD_ITEM_LABELS[itemType] ?: itemType.replace('_', ' ')
    }

    fun deliverStatusLine(
        ok: Boolean,
        itemType: String? = null,
        reward: String? = null,
        refined: Boolean = false,
        reason: String? = null,
    ): String {
        if (!ok) return "Deliver rejected: ${reason ?: "rejected"}"
        val item = heldItemLabel(itemType ?: "item")
        val rewardLabel = reward?.let { REWARD_LABELS[it] ?: it.replace('_', ' ') }
        return if (rewardLabel != null) {
            "Delivered $item → +1 $rewardLabel"
        } else {
            "Delivered $item"
        }
    }

    /** Compact single-line summary for tight HUD: "2/3 Attune · Held: Ley mote" */
    fun compactSummary(heldItemType: String?, loopCompleteHint: Boolean = false): String {
        val step = loopStep(heldItemType)
        if (loopCompleteHint) return "Loop complete · Held: —"
        val label = STEP_LABELS[step - 1]
        return "$step/3 $label · Held: ${heldItemLabel(heldItemType)}"
    }
}
