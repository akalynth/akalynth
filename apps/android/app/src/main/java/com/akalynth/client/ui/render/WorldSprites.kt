package com.akalynth.client.ui.render

import android.content.Context
import android.graphics.BitmapFactory
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import com.akalynth.client.protocol.TileCode

/** A loaded pixel-art sprite plus its footprint in 32px tiles (a 32x64 wall = 1 wide x 2 tall). */
data class WorldSprite(val image: ImageBitmap, val tilesWide: Int, val tilesTall: Int)

/**
 * Display-only sprite set bundled under app `assets/sprites/`. Maps a display [TileCode] or a
 * creature `spriteId` to original Akalynth pixel art; any key without a sprite falls back to the
 * procedural shapes in GameCanvas.
 *
 * Lockstep: the server stays authoritative — these images never gate movement, and the TileCode
 * link here is display-only, never authority. (Proof-of-concept set: the atlas builder and the
 * full tile/overlay art are not in place yet, so coverage is intentionally partial.)
 */
class WorldSprites(
    val tiles: Map<TileCode, WorldSprite>,
    val creatures: Map<String, WorldSprite>,
)

private const val NATIVE_TILE_PX = 32

/** Rookguard training-slime spriteId (mirrors GameCanvas); rendered with bog-slime art for now. */
private const val TRAINING_SLIME_SPRITE_ID = "akalynth_creature_rookguard_training_slime_001"

@Composable
fun rememberWorldSprites(): WorldSprites {
    val context = LocalContext.current
    return remember(context) { loadWorldSprites(context) }
}

private fun loadWorldSprites(context: Context): WorldSprites {
    val tiles = buildMap {
        loadSprite(context, "sprites/tile_grass.png")?.let { put(TileCode.GRASS, it) }
        loadSprite(context, "sprites/tile_water.png")?.let { put(TileCode.WATER, it) }
        loadSprite(context, "sprites/tile_stone.png")?.let { put(TileCode.STONE, it) }
        loadSprite(context, "sprites/tile_wall.png")?.let { put(TileCode.WALL, it) }
    }
    val creatures = buildMap {
        loadSprite(context, "sprites/creature_bog_slime.png")?.let { put(TRAINING_SLIME_SPRITE_ID, it) }
    }
    return WorldSprites(tiles, creatures)
}

private fun loadSprite(context: Context, assetPath: String): WorldSprite? = try {
    // inScaled=false keeps the source pixels 1:1 (no density rescale) for crisp pixel art.
    val opts = BitmapFactory.Options().apply { inScaled = false }
    val bitmap = context.assets.open(assetPath).use { BitmapFactory.decodeStream(it, null, opts) }
    bitmap?.let {
        WorldSprite(
            image = it.asImageBitmap(),
            tilesWide = (it.width / NATIVE_TILE_PX).coerceAtLeast(1),
            tilesTall = (it.height / NATIVE_TILE_PX).coerceAtLeast(1),
        )
    }
} catch (_: Exception) {
    null
}
