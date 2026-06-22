package com.akalynth.client.ui.render

import android.content.Context
import android.graphics.BitmapFactory
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import com.akalynth.client.assets.AssetRegistry
import com.akalynth.client.assets.rememberAssetRegistry
import com.akalynth.client.protocol.TileCode

/** A loaded pixel-art sprite plus its footprint in 32px tiles (a 32x64 wall = 1 wide x 2 tall). */
data class WorldSprite(val image: ImageBitmap, val tilesWide: Int, val tilesTall: Int)

/**
 * Display-only sprite set resolved via [AssetRegistry] where indexed, with legacy loose PNG
 * fallbacks for character outfits not yet in the compiled registry. Any key without a sprite falls
 * back to the procedural shapes in GameCanvas.
 *
 * Lockstep: the server stays authoritative — these images never gate movement, and the TileCode
 * link here is display-only, never authority.
 */
class WorldSprites(
    val tiles: Map<TileCode, WorldSprite>,
    val creatures: Map<String, WorldSprite>,
    val characters: Map<String, WorldSprite>,
)

private const val NATIVE_TILE_PX = 32

/** Registry-backed tile codes (factory `asset_type: tile` + stone wall structure). */
private val TILE_ASSET_IDS = mapOf(
    TileCode.GRASS to "akalynth_tile_grass_001",
    TileCode.STONE to "akalynth_tile_stone_ground_001",
    TileCode.WALL to "akalynth_structure_stone_wall_001",
    TileCode.WATER to "akalynth_tile_water_001",
    TileCode.TUTORIAL_MOVE to "akalynth_tile_tutorial_move_001",
    TileCode.TUTORIAL_CHAT to "akalynth_tile_tutorial_chat_001",
    TileCode.TUTORIAL_TEM to "akalynth_tile_tutorial_tem_001",
    TileCode.GATE_TO_AZURA to "akalynth_tile_gate_to_azura_001",
)

/** Character sprites not yet unified into the compiled registry (see NORMALIZATION.md). */
private val CHARACTER_ASSET_PATHS = mapOf(
    "base_human_male_01" to "sprites/characters/base_human_male_01.png",
    "guard_city_01" to "sprites/characters/guard_city_01.png",
    "mage_apprentice_01" to "sprites/characters/mage_apprentice_01.png",
)

@Composable
fun rememberWorldSprites(): WorldSprites {
    val context = LocalContext.current
    val registry = rememberAssetRegistry()
    return remember(context, registry) { loadWorldSprites(context, registry) }
}

private fun loadWorldSprites(context: Context, registry: AssetRegistry?): WorldSprites {
    val tiles = buildMap {
        if (registry != null) {
            TILE_ASSET_IDS.forEach { (tileCode, assetId) ->
                registry.worldSprite(assetId)?.let { put(tileCode, it) }
            }
        } else {
            loadLegacyTiles(context).forEach { (tileCode, sprite) -> put(tileCode, sprite) }
        }
    }

    val creatures = buildMap {
        if (registry != null) {
            registry.entriesByAssetType("creature").forEach { entry ->
                registry.worldSprite(entry.assetId)?.let { put(entry.assetId, it) }
            }
        } else {
            registryFallbackCreature(context)?.let { (id, sprite) -> put(id, sprite) }
        }
    }

    val characters = buildMap {
        CHARACTER_ASSET_PATHS.forEach { (spriteId, path) ->
            val bitmap = registry?.loadBitmap(path) ?: loadLooseBitmap(context, path)
            bitmap?.let {
                put(
                    spriteId,
                    WorldSprite(
                        image = it,
                        tilesWide = (it.width / NATIVE_TILE_PX).coerceAtLeast(1),
                        tilesTall = (it.height / NATIVE_TILE_PX).coerceAtLeast(1),
                    ),
                )
            }
        }
    }

    return WorldSprites(tiles, creatures, characters)
}

private fun loadLegacyTiles(context: Context): Map<TileCode, WorldSprite> = buildMap {
    loadLooseSprite(context, "sprites/tile_grass.png")?.let { put(TileCode.GRASS, it) }
    loadLooseSprite(context, "sprites/tile_water.png")?.let { put(TileCode.WATER, it) }
    loadLooseSprite(context, "sprites/tile_stone.png")?.let { put(TileCode.STONE, it) }
    loadLooseSprite(context, "sprites/tile_wall.png")?.let { put(TileCode.WALL, it) }
}

private fun registryFallbackCreature(context: Context): Pair<String, WorldSprite>? {
    val spriteId = "akalynth_creature_rookguard_training_slime_001"
    val sprite = loadLooseSprite(context, "sprites/creature_bog_slime.png") ?: return null
    return spriteId to sprite
}

private fun loadLooseSprite(context: Context, assetPath: String): WorldSprite? =
    loadLooseBitmap(context, assetPath)?.let { bitmap ->
        WorldSprite(
            image = bitmap,
            tilesWide = (bitmap.width / NATIVE_TILE_PX).coerceAtLeast(1),
            tilesTall = (bitmap.height / NATIVE_TILE_PX).coerceAtLeast(1),
        )
    }

private fun loadLooseBitmap(context: Context, assetPath: String): ImageBitmap? = try {
    val opts = BitmapFactory.Options().apply { inScaled = false }
    context.assets.open(assetPath).use { BitmapFactory.decodeStream(it, null, opts)?.asImageBitmap() }
} catch (_: Exception) {
    null
}