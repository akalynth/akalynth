package com.akalynth.client.game

import androidx.test.core.app.ApplicationProvider
import com.akalynth.client.protocol.MapName
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
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
    fun highCityMapsHaveNoRegistryPlacementsYet() {
        assertTrue(WorldPlacementRepository.registryPlacementsFor(context, MapName.AZURA).isEmpty())
        assertTrue(WorldPlacementRepository.registryPlacementsFor(context, MapName.HIGH_CITY).isEmpty())
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