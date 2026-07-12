package com.akalynth.client.ui.render

import com.akalynth.client.protocol.OutfitColors
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OutfitRecolorEngineTest {
    @Test
    fun supports_guard_city_sprite_id() {
        assertTrue(OutfitRecolorEngine.supports("guard_city_01"))
        assertFalse(OutfitRecolorEngine.supports("mage_apprentice_01"))
        assertFalse(OutfitRecolorEngine.supports(null))
    }

    @Test
    fun outfit_colors_cache_key_is_stable() {
        val colors = OutfitColors(head = 9, body = 26, legs = 20, feet = 38)
        assertTrue(colors.cacheKey().contains("26"))
        assertFalse(colors.isDefault())
        assertTrue(OutfitColors(5, 24, 36, 38).isDefault())
    }
}