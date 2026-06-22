package com.akalynth.client.ui.components

import com.akalynth.client.protocol.MapName
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HighCityVisualLandmarksTest {
    @Test
    fun onlyHighCityCompatibleMapsRenderVisualLandmarks() {
        assertTrue(highCityVisualLandmarksFor(MapName.AZURA).isNotEmpty())
        assertTrue(highCityVisualLandmarksFor(MapName.HIGH_CITY).isNotEmpty())
        assertTrue(highCityVisualLandmarksFor(MapName.ROOKGUARD).isEmpty())
    }

    @Test
    fun visualLandmarksIncludeCoreHighCityIdentityAnchors() {
        val landmarks = highCityVisualLandmarksFor(MapName.AZURA)

        assertTrue(landmarks.contains(HighCityVisualLandmark(HighCityVisualKind.CLOSED_DOOR, 20, 18)))
        assertTrue(landmarks.contains(HighCityVisualLandmark(HighCityVisualKind.FOUNTAIN, 32, 33)))
        assertTrue(landmarks.contains(HighCityVisualLandmark(HighCityVisualKind.FOUNTAIN, 32, 53)))
        assertTrue(landmarks.contains(HighCityVisualLandmark(HighCityVisualKind.NOTICE_BOARD, 10, 34)))
        assertTrue(landmarks.contains(HighCityVisualLandmark(HighCityVisualKind.BANNER_BLUE, 26, 32)))
        assertTrue(landmarks.contains(HighCityVisualLandmark(HighCityVisualKind.BANNER_RED, 38, 32)))
    }

    @Test
    fun visualKindsMapToCanonicalRegistryAssetIds() {
        assertEquals("akalynth_world_fountain", HighCityVisualKind.FOUNTAIN.registryAssetId)
        assertEquals("akalynth_world_floor_cobble_01", HighCityVisualKind.COBBLE_FLOOR.registryAssetId)
        assertEquals("akalynth_world_door_wood_closed_south", HighCityVisualKind.CLOSED_DOOR.registryAssetId)
        assertEquals("akalynth_world_wall_stone_south", HighCityVisualKind.STONE_WALL.registryAssetId)
    }

    @Test
    fun visualLandmarksSeparateFloorAndObjectLayers() {
        val landmarks = highCityVisualLandmarksFor(MapName.AZURA)

        assertTrue(landmarks.any { it.isFloor })
        assertTrue(landmarks.any { !it.isFloor })
        assertFalse(HighCityVisualLandmark(HighCityVisualKind.FOUNTAIN, 32, 33).isFloor)
        assertTrue(HighCityVisualLandmark(HighCityVisualKind.COBBLE_FLOOR, 32, 33).isFloor)
    }
}
