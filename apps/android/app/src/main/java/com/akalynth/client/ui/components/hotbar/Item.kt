package com.akalynth.client.ui.components.hotbar

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Item rarity for display and drop confirmation routing.
 *
 * Determines which confirmation tier to use on drop:
 * - COMMON/UNCOMMON/RARE → Tier2HoldButton (hold to confirm)
 * - LEGENDARY → Tier3SlideConfirm (slide to confirm)
 */
@Serializable
enum class ItemRarity {
    @SerialName("common") COMMON,
    @SerialName("uncommon") UNCOMMON,
    @SerialName("rare") RARE,
    @SerialName("legendary") LEGENDARY;

    /**
     * Display color hex for UI rendering.
     */
    val colorHex: Long get() = when (this) {
        COMMON -> 0xFFB0B0B0     // Gray
        UNCOMMON -> 0xFF4CAF50   // Green
        RARE -> 0xFF2196F3       // Blue
        LEGENDARY -> 0xFFFF9800  // Orange
    }

    /**
     * Whether this rarity requires Tier3 (slide) confirmation for drops.
     */
    val requiresTier3Confirm: Boolean get() = this == LEGENDARY

    /**
     * Display name for UI.
     */
    val displayName: String get() = name.lowercase().replaceFirstChar { it.uppercase() }
}

/**
 * Item for hotbar slot display and interaction.
 *
 * This is a UI model - actual item state is managed server-side.
 * UI only renders display properties and emits intent callbacks.
 */
@Serializable
data class Item(
    /** Unique item instance ID */
    val id: String,

    /** Server item_type key (authoritative identity for icon/presentation mapping). */
    val itemType: String,

    /** Item display name */
    val name: String,

    /** Item rarity (determines confirmation tier on drop) */
    val rarity: ItemRarity,

    /**
     * Optional protocol override for icon asset_id (PR-030 `icon_sprite_id`).
     * When null, [itemType] registry lookup is used.
     */
    val iconSpriteId: String? = null,

    /** Sprite/icon identifier (registry asset_id or legacy stem). */
    val spriteId: String = ITEM_DEFAULT_SPRITE_ID,

    /** Current stack count (1 for non-stackable) */
    val stackCount: Int = 1,

    /** Whether item is currently equipped */
    val isEquipped: Boolean = false
) {
    /**
     * Whether this is a stackable item (count > 1 possible).
     */
    val isStackable: Boolean get() = stackCount > 1
}
