package com.akalynth.client.game

import androidx.test.core.app.ApplicationProvider
import com.akalynth.client.protocol.MapName
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class WorldPlacementRepositoryTest {
    private val context = ApplicationProvider.getApplicationContext<android.content.Context>()

    @Test
    fun rookguardLoadsRegistryPlacementsFromBundledJson() {
        val placements = WorldPlacementRepository.registryPlacementsFor(context, MapName.ROOKGUARD)

        assertTrue(placements.isNotEmpty())
        assertEquals(162, placements.size)
        assertTrue(
            placements.any {
                it.assetId == "notice_board" && it.x == 9 && it.y == 5
            },
        )
        assertTrue(
            placements.any {
                it.assetId == "slime_pool" && it.x == 14 && it.y == 14
            },
        )
        assertTrue(
            placements.any {
                it.id == "rookguard:weapon_rack:12:17:1"
            },
        )
    }

    @Test
    fun azuraLoadsMergedRegistryPlacementsFromBundledJson() {
        val azura = WorldPlacementRepository.registryPlacementsFor(context, MapName.AZURA)
        val highCity = WorldPlacementRepository.registryPlacementsFor(context, MapName.HIGH_CITY)

        assertTrue("expected >=1500 Azura placements, got ${azura.size}", azura.size >= 1500)
        assertEquals(azura.size, highCity.size)
        assertTrue(
            azura.any {
                it.assetId == "high_city_crystal_fountain" && it.x == 32 && it.y == 33
            },
        )
        assertTrue(
            azura.any {
                it.assetId == "market_food_stall" && it.x == 44 && it.y == 26
            },
        )
        assertTrue(
            azura.any {
                it.assetId == "stone_column" && it.x == 14 && it.y == 9
            },
        )
        assertTrue(
            azura.any {
                it.assetId == "throne" && it.x == 60 && it.y == 7
            },
        )
        assertTrue(
            azura.any {
                it.assetId == "swamp_mud" && it.x == 2 && it.y == 58
            },
        )
        assertTrue(
            azura.any {
                it.id == "high-city-grove:prop_tree:3:44:0"
            },
        )
    }

    @Test
    fun rookguardPlacementAssetIdsAreMvpSubset() {
        val placements = WorldPlacementRepository.registryPlacementsFor(context, MapName.ROOKGUARD)
        val assetIds = placements.map { it.assetId }.toSet()

        assertFalse(assetIds.contains("prison_bars"))
        assertFalse(assetIds.contains("stone_column"))
        assertFalse(assetIds.contains("throne"))
        assertTrue(assetIds.contains("weapon_rack"))
        assertTrue(assetIds.contains("floor_cobble_01"))
    }
}