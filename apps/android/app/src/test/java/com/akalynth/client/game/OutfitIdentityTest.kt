package com.akalynth.client.game

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OutfitIdentityTest {

    @Test
    fun maleWandererMapsToBaseHuman() {
        assertEquals("base_human_male_01", OutfitIdentity.expectedWorldSpriteId("male_wanderer"))
        assertTrue(OutfitIdentity.worldSpriteMatchesCatalog("male_wanderer", "base_human_male_01"))
        assertFalse(OutfitIdentity.worldSpriteMatchesCatalog("male_wanderer", "guard_city_01"))
    }

    @Test
    fun femaleCatalogArtPending_nullProtocolSprite() {
        assertNull(OutfitIdentity.expectedWorldSpriteId("female_wanderer"))
        assertTrue(OutfitIdentity.worldSpriteMatchesCatalog("female_wanderer", null))
        assertTrue(OutfitIdentity.worldSpriteMatchesCatalog("female_wanderer", "base_human_male_01"))
    }

    @Test
    fun identityLabelUsesOutfitName() {
        val label = OutfitIdentity.identityLabel("Ada", "male_guard", null)
        assertTrue(label.contains("Ada"))
        assertTrue(label.contains("City Guard"))
    }

    @Test
    fun identityLabelFromWorldSprite() {
        val label = OutfitIdentity.identityLabel(null, null, "mage_apprentice_01")
        assertEquals("Apprentice Mage", label)
    }
}
