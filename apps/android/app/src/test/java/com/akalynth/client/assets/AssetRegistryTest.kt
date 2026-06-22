package com.akalynth.client.assets

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
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
    fun loadsBundledRegistryAndResolvesUiEntry() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val registry = AssetRegistry.load(context)

        assertNotNull(registry)
        assertEquals(ASSET_REGISTRY_SCHEMA_VERSION, registry!!.manifest.schemaVersion)
        assertTrue(registry.manifest.entries.isNotEmpty())

        val panel = registry.uiEntry("ui_panel_frame")
        assertNotNull(panel)
        assertEquals("ui/ui_panel_frame.png", panel!!.file)
        assertEquals(8, panel.slicePx)

        val bitmap = registry.loadBitmapForEntry(panel)
        assertNotNull(bitmap)
        assertEquals(panel.frame.w, bitmap!!.width)
        assertEquals(panel.frame.h, bitmap.height)
    }

    @Test
    fun worldIdHelpersMatchSharedContract() {
        assertEquals(
            "akalynth_world_grass_01",
            AssetRegistry.canonicalWorldAssetId("grass_01"),
        )
        assertEquals(
            "akalynth_world_grass_01",
            AssetRegistry.canonicalWorldAssetId("akalynth_world_grass_01"),
        )
        assertEquals(
            "notice_board",
            AssetRegistry.worldShortIdFromAssetId("akalynth_world_notice_board"),
        )
        assertEquals(
            "akalynth_prop_tree_001",
            AssetRegistry.worldShortIdFromAssetId("akalynth_prop_tree_001"),
        )
    }

    @Test
    fun resolvesRegistryBackedTileAndCreatureSprites() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val registry = AssetRegistry.load(context)!!

        val grass = registry.worldSprite("akalynth_tile_grass_001")
        assertNotNull(grass)
        assertEquals(1, grass!!.tilesWide)
        assertEquals(1, grass.tilesTall)

        val slime = registry.worldSprite("akalynth_creature_rookguard_training_slime_001")
        assertNotNull(slime)
    }
}