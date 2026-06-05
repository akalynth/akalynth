package com.akalynth.client.actions

import com.akalynth.client.ui.components.character.CharacterSex
import com.akalynth.client.ui.components.hotbar.ItemRarity

object WorldEventSkillIds {
    const val WITNESS_MOTH_BLOOM = "witness_moth_bloom"
    const val VERIFY_TESTIMONY = "verify_testimony"
    const val CRAFT_LANTERN_FRAME = "craft_lantern_frame"
    const val DEFEND_SCRIBES = "defend_scribes"

    fun skillId(eventId: String, contributionId: String): String = "event:$eventId:$contributionId"
}

/**
 * Sealed interface for player action intents.
 *
 * Key design:
 * - actionId is stamped by ActionBus, NOT by UI
 * - UI emits intents (requests), not events
 * - Each intent maps to a pending ChronicleEvent
 *
 * The actionId enables:
 * - Correlation with server receipts
 * - Idempotent upsert in ChronicleStore
 * - Pending → Confirmed upgrade
 */
sealed interface ActionIntent {
    /** Correlation ID stamped by ActionBus */
    val actionId: String

    /**
     * Attack action (melee/ranged based on equipped weapon).
     * Chronicle kind: COMBAT_KILL (on success) or no event (on miss/fail)
     */
    data class Attack(
        override val actionId: String,
        val targetId: String? = null
    ) : ActionIntent

    /**
     * Use item from hotbar slot.
     * Chronicle kind: depends on item type (potion → no event, scroll → event, etc.)
     */
    data class UseHotbarSlot(
        override val actionId: String,
        val slotIndex: Int,
        val itemId: String
    ) : ActionIntent

    /**
     * Drop item from hotbar slot.
     * Chronicle kind: ITEM_DROP
     */
    data class DropHotbarSlot(
        override val actionId: String,
        val slotIndex: Int,
        val itemId: String,
        val itemName: String,
        val rarity: ItemRarity
    ) : ActionIntent

    /**
     * Pick up item from ground.
     * Chronicle kind: ITEM_PICKUP
     */
    data class PickupItem(
        override val actionId: String,
        val itemId: String,
        val itemName: String,
        val x: Int,
        val y: Int
    ) : ActionIntent

    /**
     * Create a new character.
     * Chronicle kind: CHARACTER_CREATED
     */
    data class CreateCharacter(
        override val actionId: String,
        val name: String,
        val sex: CharacterSex
    ) : ActionIntent

    /**
     * Contribute to a server-authoritative world event.
     * The client sends only an intent skill id; the server validates event state.
     * Chronicle rows are read back from server receipts, so this creates no
     * optimistic pending event.
     */
    data class WorldEventContribution(
        override val actionId: String,
        val eventId: String,
        val contributionId: String
    ) : ActionIntent {
        val skillId: String = WorldEventSkillIds.skillId(eventId, contributionId)
    }
}
