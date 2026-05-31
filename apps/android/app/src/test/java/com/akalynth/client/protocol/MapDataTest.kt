package com.akalynth.client.protocol

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

// Verifies the canonical map model parses the real bundled assets and that tile lookup matches the
// row-major contract in `packages/shared/types.ts` / `maps/*.json`.
class MapDataTest {

    private val json = Json { ignoreUnknownKeys = true }

    private fun loadAsset(name: String): String {
        // Unit tests run from the module dir; read the same bundled asset the app ships.
        val candidates = listOf(
            File("src/main/assets/maps/$name"),
            File("app/src/main/assets/maps/$name"),
        )
        val file = candidates.firstOrNull { it.exists() }
        assertNotNull("bundled asset maps/$name not found from ${File(".").absolutePath}", file)
        return file!!.readText()
    }

    @Test
    fun rookguardAssetParsesWithExpectedDimensions() {
        val map = json.decodeFromString<MapData>(loadAsset("rookguard.json"))
        assertEquals("Rookguard", map.name)
        assertEquals(32, map.width)
        assertEquals(32, map.height)
        assertEquals(map.width * map.height, map.tiles.size)
    }

    @Test
    fun azuraAssetParsesWithExpectedDimensions() {
        val map = json.decodeFromString<MapData>(loadAsset("azura.json"))
        assertEquals("Azura", map.name)
        assertEquals(64, map.width)
        assertEquals(64, map.height)
        assertEquals(map.width * map.height, map.tiles.size)
    }

    @Test
    fun tileAtIsRowMajorAndBoundsAreWall() {
        val map = json.decodeFromString<MapData>(loadAsset("rookguard.json"))
        val (sx, sy) = map.spawn.x to map.spawn.y
        val expected = TileCode.fromCode(map.tiles[sy * map.width + sx])
        assertEquals(expected, map.tileAt(sx, sy))

        // Out-of-bounds renders as a boundary wall.
        assertEquals(TileCode.WALL, map.tileAt(-1, 0))
        assertEquals(TileCode.WALL, map.tileAt(map.width, 0))
        assertEquals(TileCode.WALL, map.tileAt(0, map.height))
    }

    @Test
    fun tileCodeMappingMatchesContract() {
        assertEquals(TileCode.GRASS, TileCode.fromCode(0))
        assertEquals(TileCode.STONE, TileCode.fromCode(1))
        assertEquals(TileCode.WALL, TileCode.fromCode(2))
        assertEquals(TileCode.WATER, TileCode.fromCode(3))
        assertEquals(TileCode.DOOR, TileCode.fromCode(4))
        assertEquals(TileCode.TUTORIAL_MOVE, TileCode.fromCode(5))
        assertEquals(TileCode.TUTORIAL_CHAT, TileCode.fromCode(6))
        assertEquals(TileCode.TUTORIAL_TEM, TileCode.fromCode(7))
        assertEquals(TileCode.GATE_TO_AZURA, TileCode.fromCode(8))
        // Unknown future codes degrade gracefully.
        assertEquals(TileCode.UNKNOWN, TileCode.fromCode(99))
    }

    @Test
    fun spawnTileIsWalkable() {
        val map = json.decodeFromString<MapData>(loadAsset("rookguard.json"))
        val spawnTile = map.tileAt(map.spawn.x, map.spawn.y)
        // Spawn must be on walkable terrain (server invariant); never a wall/water.
        assertTrue(spawnTile != TileCode.WALL && spawnTile != TileCode.WATER)
    }
}
