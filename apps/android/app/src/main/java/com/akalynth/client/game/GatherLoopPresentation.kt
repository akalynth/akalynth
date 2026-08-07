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
        /** Keystone count before applying this deliver (first-keystone closure). */
        priorKeystoneTokens: Int = 0,
    ): String {
        if (!ok) return "Deliver rejected: ${reason ?: "rejected"}"
        val item = heldItemLabel(itemType ?: "item")
        val rewardLabel = reward?.let { REWARD_LABELS[it] ?: it.replace('_', ' ') }
        val base = if (rewardLabel != null) {
            "Delivered $item → +1 $rewardLabel"
        } else {
            "Delivered $item"
        }
        if (refined && reward == "keystone_token" && priorKeystoneTokens == 0) {
            return "$base. The curation post accepts your first keystone — Azura remembers."
        }
        if (refined && rewardLabel != null) {
            return "$base. The chill loop is complete — tend another mote when you are ready."
        }
        return base
    }

    fun isKeystoneDeliverStatus(status: String?): Boolean =
        status != null && status.startsWith("Delivered") && status.contains("keystone")

    /** Compact single-line summary for tight HUD: "2/3 Attune · Held: Ley mote" */
    fun compactSummary(
        heldItemType: String?,
        loopCompleteHint: Boolean = false,
        keystoneTokens: Int = 0,
    ): String {
        val step = loopStep(heldItemType)
        if (loopCompleteHint) {
            return if (keystoneTokens > 0) {
                "Loop complete · Keystone $keystoneTokens"
            } else {
                "Loop complete · Held: —"
            }
        }
        val label = STEP_LABELS[step - 1]
        val key = if (keystoneTokens > 0) " · Keystone $keystoneTokens" else ""
        return "$step/3 $label · Held: ${heldItemLabel(heldItemType)}$key"
    }
}
