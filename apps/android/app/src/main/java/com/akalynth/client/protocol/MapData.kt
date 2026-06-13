package com.akalynth.client.protocol

import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonObject

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
    @Serializable(with = LenientLandmarksSerializer::class)
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

/**
 * Tolerant deserializer for the `landmarks` map. The canonical maps carry a heterogeneous shape:
 * flat rects (`"plaza":{x,y,width,height}`) alongside nested groups (`"tutorial":{move,chat,tem}`).
 * Strict `Map<String, MapLandmark>` decoding throws on the nested group, which previously failed the
 * whole (display-only) MapData decode and blanked the tile grid. Keep only flat MapLandmark-shaped
 * entries; ignore the rest. Server authority is unaffected — this is render context only.
 */
private object LenientLandmarksSerializer : KSerializer<Map<String, MapLandmark>> {
    private val delegate = MapSerializer(String.serializer(), MapLandmark.serializer())
    override val descriptor: SerialDescriptor = delegate.descriptor

    override fun deserialize(decoder: Decoder): Map<String, MapLandmark> {
        val input = decoder as? JsonDecoder ?: return emptyMap()
        val obj = input.decodeJsonElement().jsonObject
        val result = LinkedHashMap<String, MapLandmark>()
        for ((key, value) in obj) {
            if (value is JsonObject && "x" in value && "y" in value && "width" in value && "height" in value) {
                result[key] = input.json.decodeFromJsonElement(MapLandmark.serializer(), value)
            }
        }
        return result
    }

    override fun serialize(encoder: Encoder, value: Map<String, MapLandmark>) =
        delegate.serialize(encoder, value)
}

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
