package com.akalynth.client.game

import android.content.Context
import com.akalynth.client.protocol.MapData
import com.akalynth.client.protocol.MapName
import kotlinx.serialization.json.Json

/**
 * Loads and caches the canonical static map data bundled under `assets/maps/`.
 *
 * The JSON files are byte-for-byte copies of `packages/shared/maps/*.json` — the same maps the
 * server validates against — so the client renders the real world grid rather than a procedural
 * stand-in. Display-only: the server stays authoritative for movement and collision.
 */
object MapRepository {
    private val json = Json { ignoreUnknownKeys = true }
    private val cache = HashMap<MapName, MapData?>()

    private fun assetPath(map: MapName): String = when (map) {
        MapName.ROOKGUARD -> "maps/rookguard.json"
        MapName.AZURA -> "maps/azura.json"
    }

    /**
     * Return the [MapData] for [map], or null if the asset is missing/unreadable. Cached per map
     * (including negative results) so repeated frames do not re-read assets.
     */
    fun load(context: Context, map: MapName): MapData? {
        cache[map]?.let { return it }
        if (cache.containsKey(map)) return null // cached miss

        val data = try {
            val raw = context.assets.open(assetPath(map)).bufferedReader().use { it.readText() }
            json.decodeFromString<MapData>(raw)
        } catch (e: Exception) {
            null
        }
        cache[map] = data
        return data
    }
}
