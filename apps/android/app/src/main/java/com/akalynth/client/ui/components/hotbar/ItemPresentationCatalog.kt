package com.akalynth.client.ui.components.hotbar

/**
 * Static client-side presentation metadata for MVP item types.
 *
 * Rarity is presentation-only for drop-confirmation routing — not server authority.
 * Unknown types default to [ItemRarity.COMMON] (Tier2 hold confirm per UI regression matrix).
 */
data class ItemPresentation(
    val name: String,
    val rarity: ItemRarity,
)

object ItemPresentationCatalog {
    /** MVP item types targeted by PR-015/016 icon batches (20 entries). */
    val MVP_ITEM_TYPES: Set<String> = setOf(
        "torch",
        "ration",
        "mark_token",
        "training_slime_goo",
        "ley_mote",
        "refined_ley_mote",
        "keystone_token",
        "refined_soulsteel_component",
        "healing_herb",
        "city_rat_goo",
        "pilgrim_mark",
        "rookguard_training_blade",
        "rookguard_threadbare_cloak",
        "rookguard_patience_charm",
        "stabilized_soulsteel_component",
        "slime",
        "tending_token",
        "ashglass_shard",
        "charred_shipment_plate",
        "soulsteel_frame",
    )

    private val BY_TYPE: Map<String, ItemPresentation> = mapOf(
        // P0 — drop policy + Rookguard loop fixtures
        "torch" to ItemPresentation("Torch", ItemRarity.COMMON),
        "ration" to ItemPresentation("Ration", ItemRarity.COMMON),
        "mark_token" to ItemPresentation("Mark Token", ItemRarity.UNCOMMON),
        "training_slime_goo" to ItemPresentation("Slime Goo", ItemRarity.COMMON),
        "ley_mote" to ItemPresentation("Ley Mote", ItemRarity.UNCOMMON),
        "refined_ley_mote" to ItemPresentation("Refined Ley Mote", ItemRarity.UNCOMMON),
        // P1 — gather/route survey rewards
        "keystone_token" to ItemPresentation("Keystone Token", ItemRarity.RARE),
        "refined_soulsteel_component" to ItemPresentation("Refined Soulsteel", ItemRarity.RARE),
        // P1–P2 — starter gear, consumables, route evidence
        "healing_herb" to ItemPresentation("Healing Herb", ItemRarity.COMMON),
        "city_rat_goo" to ItemPresentation("Rat Goo", ItemRarity.COMMON),
        "pilgrim_mark" to ItemPresentation("Pilgrim Mark", ItemRarity.UNCOMMON),
        "rookguard_training_blade" to ItemPresentation("Training Blade", ItemRarity.COMMON),
        "rookguard_threadbare_cloak" to ItemPresentation("Threadbare Cloak", ItemRarity.COMMON),
        "rookguard_patience_charm" to ItemPresentation("Patience Charm", ItemRarity.UNCOMMON),
        "stabilized_soulsteel_component" to ItemPresentation("Stabilized Soulsteel", ItemRarity.UNCOMMON),
        "slime" to ItemPresentation("Slime Trophy", ItemRarity.COMMON),
        "tending_token" to ItemPresentation("Tending Token", ItemRarity.COMMON),
        "ashglass_shard" to ItemPresentation("Ashglass Shard", ItemRarity.UNCOMMON),
        "charred_shipment_plate" to ItemPresentation("Charred Plate", ItemRarity.UNCOMMON),
        "soulsteel_frame" to ItemPresentation("Soulsteel Frame", ItemRarity.RARE),
        // Test/fixture entry for Tier3 drop-confirm wiring (not in live Rookguard loot tables)
        "legendary_sword" to ItemPresentation("Dragon Slayer", ItemRarity.LEGENDARY),
    )

    fun resolve(itemType: String): ItemPresentation =
        BY_TYPE[itemType] ?: ItemPresentation(
            name = itemType
                .replace('_', ' ')
                .replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() },
            rarity = ItemRarity.COMMON,
        )
}