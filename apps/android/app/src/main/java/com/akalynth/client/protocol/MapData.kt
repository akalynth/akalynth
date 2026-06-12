package com.akalynth.client.protocol

import kotlinx.serialization.Serializable

// Canonical static map data, mirroring packages/shared/maps/*.json and the MapData shape in
// packages/shared/types.ts. Bundled as a read-only client asset so the Android client renders
// the real tile grid. Display-only: the server stays authoritative for walkability and collision.
@Serializable
data class MapData(
    val name: String,
    val width: Int,
    val height: Int,
    val spawn: MapSpawn,
    // Row-major tile codes; index = y * width + x. Values are TileCode ordinals.
    val tiles: List<Int>,
    // Display/context landmarks from the shared map JSON. UI may use these to show contextual
    // controls, but server authority still owns movement, collision, and action acceptance.
    val landmarks: Map<String, MapLandmark> = emptyMap()
) {
    // Tile code at (x, y), or TileCode.WALL when out of bounds.
    fun tileAt(x: Int, y: Int): TileCode {
        if (x < 0 || y < 0 || x >= width || y >= height) return TileCode.WALL
        return TileCode.fromCode(tiles[y * width + x])
    }
}

@Serializable
data class MapSpawn(val x: Int, val y: Int)

@Serializable
data class MapLandmark(
    val x: Int,
    val y: Int,
    val width: Int,
    val height: Int
) {
    fun contains(px: Int, py: Int): Boolean =
        px >= x && py >= y && px < x + width && py < y + height
}

// Tile codes, mirroring TileCode in packages/shared/types.ts.
// The numeric values are the wire/JSON contract and MUST NOT change without the server.
enum class TileCode(val code: Int) {
    GRASS(0),
    STONE(1),
    WALL(2),
    WATER(3),
    DOOR(4),
    TUTORIAL_MOVE(5),
    TUTORIAL_CHAT(6),
    TUTORIAL_TEM(7),
    GATE_TO_AZURA(8),
    UNKNOWN(-1);

    companion object {
        private val byCode = values().associateBy { it.code }

        // Maps a raw JSON tile value to a TileCode, tolerating unknown future codes.
        fun fromCode(code: Int): TileCode = byCode[code] ?: UNKNOWN
    }
}
