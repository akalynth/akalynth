package com.akalynth.client.protocol

import kotlinx.serialization.Serializable

/**
 * Canonical static map data, mirroring `packages/shared/maps/*.json` and the `MapData` shape in
 * `packages/shared/types.ts`. The server validates every map against this same JSON; bundling it as
 * a read-only client asset (the debug client does the same via `@shared/maps/*.json`) lets the
 * Android client render the real tile grid instead of a procedural placeholder.
 *
 * This is display-only. The server remains authoritative for walkability and collision — the client
 * never uses [tiles] to gate movement, only to draw the world it is told it is in.
 */
@Serializable
data class MapData(
    val name: String,
    val width: Int,
    val height: Int,
    val spawn: MapSpawn,
    /** Row-major tile codes; index = y * width + x. Values are [TileCode] ordinals. */
    val tiles: List<Int>
    // `landmarks` exists in the JSON but is a nested object irrelevant to rendering; it is skipped
    // via ignoreUnknownKeys at decode time.
) {
    /** Tile code at (x, y), or [TileCode.WALL] when out of bounds (rendered as a boundary). */
    fun tileAt(x: Int, y: Int): TileCode {
        if (x < 0 || y < 0 || x >= width || y >= height) return TileCode.WALL
        return TileCode.fromCode(tiles[y * width + x])
    }
}

@Serializable
data class MapSpawn(val x: Int, val y: Int)

/**
 * Tile codes, mirroring `TileCode` in `packages/shared/types.ts`.
 *
 * The numeric values are the wire/JSON contract and MUST NOT change without the server.
 */
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
        private val byCode = entries.associateBy(TileCode::code)

        /** Map a raw JSON tile value to a [TileCode], tolerating unknown future codes. */
        fun fromCode(code: Int): TileCode = byCode[code] ?: UNKNOWN
    }
}
