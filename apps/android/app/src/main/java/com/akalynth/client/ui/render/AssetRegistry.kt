package com.akalynth.client.ui.render

import android.content.Context
import android.graphics.BitmapFactory
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlin.math.roundToInt

const val WORLD_ASSET_ID_PREFIX = "akalynth_world_"
private const val NATIVE_TILE_PX = 32

/** Loaded world overlay sprite plus registry rendering metadata (display-only). */
data class RegistryWorldSprite(
    val image: ImageBitmap,
    val frameW: Int,
    val frameH: Int,
    val drawScale: Float,
    val anchorType: String,
    val sourceAnchorX: Int,
    val sourceAnchorY: Int,
    val layer: String,
)

/**
 * Display-only sprite lookup from compiled `assets/registry.json`.
 * World overlays resolve by canonical `asset_id` (e.g. `akalynth_world_fountain`).
 * Missing keys fall back to procedural shapes in [com.akalynth.client.ui.components.GameCanvas].
 */
class AssetRegistry internal constructor(
    private val sprites: Map<String, RegistryWorldSprite>,
) {
    fun sprite(assetId: String): RegistryWorldSprite? = sprites[assetId]

    fun spriteForShortId(shortId: String): RegistryWorldSprite? =
        sprite(canonicalWorldAssetId(shortId))

    val isEmpty: Boolean get() = sprites.isEmpty()
}

fun canonicalWorldAssetId(shortId: String): String =
    if (shortId.startsWith(WORLD_ASSET_ID_PREFIX)) shortId else "$WORLD_ASSET_ID_PREFIX$shortId"

@Composable
fun rememberAssetRegistry(): AssetRegistry {
    val context = LocalContext.current
    return remember(context) { loadAssetRegistry(context) }
}

private val registryJson = Json { ignoreUnknownKeys = true }

internal fun loadAssetRegistry(context: Context): AssetRegistry {
    val manifest = try {
        val raw = context.assets.open("registry.json").bufferedReader().use { it.readText() }
        registryJson.decodeFromString<AssetManifest>(raw)
    } catch (_: Exception) {
        return AssetRegistry(emptyMap())
    }

    val sprites = buildMap {
        for (entry in manifest.entries) {
            val rendering = entry.rendering ?: continue
            val sprite = loadRegistrySprite(context, entry, rendering) ?: continue
            put(entry.asset_id, sprite)
        }
    }
    return AssetRegistry(sprites)
}

private fun loadRegistrySprite(
    context: Context,
    entry: AssetRegistryEntry,
    rendering: WorldVisualRendering,
): RegistryWorldSprite? = try {
    val opts = BitmapFactory.Options().apply { inScaled = false }
    val bitmap = context.assets.open(entry.file).use { BitmapFactory.decodeStream(it, null, opts) }
        ?: return null
    val anchor = rendering.anchor
    RegistryWorldSprite(
        image = bitmap.asImageBitmap(),
        frameW = entry.frame.w,
        frameH = entry.frame.h,
        drawScale = rendering.draw_scale,
        anchorType = anchor.type,
        sourceAnchorX = anchor.source_pixels.getOrElse(0) { 0 },
        sourceAnchorY = anchor.source_pixels.getOrElse(1) { 0 },
        layer = rendering.layer,
    )
} catch (_: Exception) {
    null
}

/** Anchor in screen space for a tile whose top-left is [tileTopLeft]. */
internal fun registryWorldAnchor(
    tileTopLeft: Offset,
    tileSize: Float,
    anchorType: String,
): Offset {
    val tileLeft = tileTopLeft.x
    val tileTop = tileTopLeft.y
    return when (anchorType) {
        "tile_top_left" -> Offset(tileLeft, tileTop)
        "bottom_left" -> Offset(tileLeft, tileTop + tileSize)
        "center" -> Offset(tileLeft + tileSize / 2f, tileTop + tileSize / 2f)
        else -> Offset(tileLeft + tileSize / 2f, tileTop + tileSize) // bottom_center default
    }
}

/**
 * Draw a registry world overlay into the canvas. Scales authored 32px-tile metadata to the
 * runtime [tileSize] (GameCanvas uses 36dp cells). Nearest-neighbor keeps pixel art crisp.
 */
fun DrawScope.drawRegistryWorldOverlay(
    sprite: RegistryWorldSprite,
    tileTopLeft: Offset,
    tileSize: Float,
) {
    val tileScale = tileSize / NATIVE_TILE_PX
    val effectiveScale = sprite.drawScale * tileScale
    val anchor = registryWorldAnchor(tileTopLeft, tileSize, sprite.anchorType)
    val left = anchor.x - sprite.sourceAnchorX * effectiveScale
    val top = anchor.y - sprite.sourceAnchorY * effectiveScale
    val width = sprite.frameW * effectiveScale
    val height = sprite.frameH * effectiveScale
    drawImage(
        image = sprite.image,
        srcOffset = IntOffset.Zero,
        srcSize = IntSize(sprite.image.width, sprite.image.height),
        dstOffset = IntOffset(left.roundToInt(), top.roundToInt()),
        dstSize = IntSize(width.roundToInt(), height.roundToInt()),
        filterQuality = FilterQuality.None,
    )
}

@Serializable
internal data class AssetManifest(
    val schema_version: Int,
    val entries: List<AssetRegistryEntry>,
)

@Serializable
internal data class AssetRegistryEntry(
    val asset_id: String,
    val file: String,
    val frame: AssetFrame,
    val rendering: WorldVisualRendering? = null,
)

@Serializable
internal data class AssetFrame(
    val w: Int,
    val h: Int,
)

@Serializable
internal data class WorldVisualRendering(
    val draw_scale: Float,
    val anchor: WorldVisualAnchor,
    val layer: String,
)

@Serializable
internal data class WorldVisualAnchor(
    val type: String,
    val source_pixels: List<Int>,
)