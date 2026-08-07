package com.akalynth.client.game

/**
 * Outfit → world sprite identity lock (mirrors apps/server character/catalog.ts
 * and apps/debug-client/src/data/outfitIdentity.ts).
 *
 * Contract: CLIENT_PLAY_SURFACE_CONTRACT_V1 §2.6
 */
object OutfitIdentity {
    data class Entry(
        val outfitId: String,
        val sex: String,
        val name: String,
        /** Protocol/world sprite_id; null = art pending (female E7). */
        val protocolSpriteId: String?,
        /** Client draw fallback when protocol sprite is null. */
        val bundledSpriteId: String,
        val fallbackArt: Boolean,
    )

    val TABLE: List<Entry> = listOf(
        Entry("male_wanderer", "male", "Wanderer", "base_human_male_01", "base_human_male_01", false),
        Entry("male_guard", "male", "City Guard", "guard_city_01", "guard_city_01", false),
        Entry("male_mage", "male", "Apprentice Mage", "mage_apprentice_01", "mage_apprentice_01", false),
        Entry("female_wanderer", "female", "Wanderer", null, "base_human_male_01", true),
        Entry("female_guard", "female", "City Guard", null, "guard_city_01", true),
        Entry("female_mage", "female", "Apprentice Mage", null, "mage_apprentice_01", true),
    )

    fun byOutfitId(outfitId: String): Entry? = TABLE.find { it.outfitId == outfitId }

    fun expectedWorldSpriteId(outfitId: String): String? = byOutfitId(outfitId)?.protocolSpriteId

    fun identityLabel(name: String?, outfitId: String?, spriteId: String?): String {
        val parts = mutableListOf<String>()
        if (!name.isNullOrBlank()) parts.add(name.trim())
        if (!outfitId.isNullOrBlank()) {
            val e = byOutfitId(outfitId)
            if (e != null) {
                parts.add(if (e.fallbackArt) "${e.name} (preview art)" else e.name)
            } else {
                parts.add(outfitId)
            }
        } else if (!spriteId.isNullOrBlank()) {
            val e = TABLE.find { it.protocolSpriteId == spriteId || it.bundledSpriteId == spriteId }
            parts.add(e?.name ?: spriteId)
        }
        return if (parts.isEmpty()) "Adventurer" else parts.joinToString(" · ")
    }

    /**
     * After create/select, world self sprite should match catalog for male outfits.
     * Female catalog protocol sprite is null until E7 — server may send null/default.
     */
    fun worldSpriteMatchesCatalog(outfitId: String, worldSpriteId: String?): Boolean {
        val expected = expectedWorldSpriteId(outfitId)
        if (expected == null) {
            // Art pending: accept null or any fallback bundled id, never a conflicting male-only swap check fail.
            return worldSpriteId == null ||
                worldSpriteId == byOutfitId(outfitId)?.bundledSpriteId ||
                worldSpriteId.isBlank()
        }
        return worldSpriteId == expected
    }
}
