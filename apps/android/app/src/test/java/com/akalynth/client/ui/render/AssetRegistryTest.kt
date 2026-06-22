package com.akalynth.client.ui.render

import androidx.compose.ui.geometry.Offset
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class AssetRegistryTest {

    @Test
    fun canonicalWorldAssetIdPrefixesShortIds() {
        assertEquals("akalynth_world_fountain", canonicalWorldAssetId("fountain"))
        assertEquals("akalynth_world_fountain", canonicalWorldAssetId("akalynth_world_fountain"))
    }

    @Test
    fun loadAssetRegistryResolvesHighCityOverlaySprites() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val registry = loadAssetRegistry(context)

        assertFalse(registry.isEmpty)

        val fountain = registry.sprite("akalynth_world_fountain")
        assertNotNull(fountain)
        assertEquals("object_overlay", fountain!!.layer)
        assertEquals("bottom_center", fountain.anchorType)

        val cobble = registry.spriteForShortId("floor_cobble_01")
        assertNotNull(cobble)
        assertEquals("terrain", cobble!!.layer)
        assertEquals("tile_top_left", cobble.anchorType)

        val door = registry.sprite("akalynth_world_door_wood_closed_south")
        assertNotNull(door)
    }

    @Test
    fun registryWorldAnchorMapsTileTopLeftToCellOrigin() {
        val anchor = registryWorldAnchor(Offset(100f, 200f), tileSize = 36f, anchorType = "tile_top_left")
        assertEquals(100f, anchor.x)
        assertEquals(200f, anchor.y)
    }

    @Test
    fun registryWorldAnchorMapsBottomCenterToTileFeet() {
        val anchor = registryWorldAnchor(Offset(100f, 200f), tileSize = 36f, anchorType = "bottom_center")
        assertEquals(118f, anchor.x)
        assertEquals(236f, anchor.y)
    }
}