package com.akalynth.client.game

import android.content.Context
import com.akalynth.client.protocol.MapName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/** Display-only world overlay instance from compiled placement JSON (PR-008). */
data class RegistryPlacement(
    val id: String,
    val assetId: String,
    val x: Int,
    val y: Int,
    val visibility: String? = null,
)

/**
 * Loads map overlay placements from bundled assets/placements JSON files.
 * Placements are display-only; mechanics must be null in the manifest.
 */
object WorldPlacementRepository {
    private val json = Json { ignoreUnknownKeys = true }
    private val cache = HashMap<MapName, List<RegistryPlacement>>()

    fun registryPlacementsFor(context: Context, map: MapName): List<RegistryPlacement> {
        cache[map]?.let { return it }
        val assetPath = assetPathFor(map)
        if (assetPath == null) {
            cache[map] = emptyList()
            return emptyList()
        }

        val placements = try {
            val raw = context.assets.open(assetPath).bufferedReader().use { it.readText() }
            val manifest = json.decodeFromString<WorldPlacementManifest>(raw)
            if (manifest.mechanics != null) {
                emptyList()
            } else {
                manifest.placements.map { entry ->
                    RegistryPlacement(
                        id = entry.id,
                        assetId = entry.asset_id,
                        x = entry.x,
                        y = entry.y,
                        visibility = entry.visibility,
                    )
                }
            }
        } catch (_: Exception) {
            emptyList()
        }
        cache[map] = placements
        return placements
    }

    private fun assetPathFor(map: MapName): String? = when (map) {
        MapName.ROOKGUARD -> "placements/rookguard-overlays.json"
        MapName.AZURA, MapName.HIGH_CITY -> "placements/azura-all-overlays.json"
        else -> null
    }
}

@Serializable
private data class WorldPlacementManifest(
    val map: String,
    val schema_version: Int,
    val mechanics: String? = null,
    val placements: List<WorldPlacementEntry> = emptyList(),
)

@Serializable
private data class WorldPlacementEntry(
    val id: String,
    val asset_id: String,
    val x: Int,
    val y: Int,
    val visibility: String? = null,
)