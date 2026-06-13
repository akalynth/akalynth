package com.akalynth.client.ui.components

import com.akalynth.client.protocol.MapName

/**
 * Player-facing lore for map points of interest.
 *
 * Display-only flavor. None of this is sent to the server and it changes no
 * mechanic. Spawn coordinates mirror the shared map JSON
 * (packages/shared/maps/<map>.json) and the debug client's SPAWN_LORE text.
 */
object MapLore {
    data class SpawnInfo(
        val x: Int,
        val y: Int,
        val title: String,
        val body: String,
    )

    fun spawn(map: MapName): SpawnInfo = when (map) {
        MapName.ROOKGUARD -> SpawnInfo(
            x = 2,
            y = 2,
            title = "Spawn",
            body = "Where every guest first wakes in Rookguard, at the head of the tutorial corridor.",
        )
        MapName.AZURA -> SpawnInfo(
            x = 32,
            y = 32,
            title = "Spawn",
            body = "The center of High City, where new arrivals appear after clearing Rookguard.",
        )
        MapName.HIGH_CITY -> SpawnInfo(
            x = 32,
            y = 32,
            title = "Spawn",
            body = "The center of High City, where new arrivals appear after clearing Rookguard.",
        )
        MapName.TILE_SHOWCASE -> SpawnInfo(
            x = 2,
            y = 2,
            title = "Spawn",
            body = "Debug tile-showcase map for art verification.",
        )
    }
}
