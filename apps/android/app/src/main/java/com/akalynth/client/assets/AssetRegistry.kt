package com.akalynth.client.assets

import android.content.Context
import android.graphics.BitmapFactory
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import com.akalynth.client.ui.render.WorldSprite
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement

/** Mirrors `packages/shared/assetRegistry.ts` — compiled loose-PNG registry (display-only). */
const val ASSET_REGISTRY_SCHEMA_VERSION = 1
const val WORLD_ASSET_ID_PREFIX = "akalynth_world_"
private const val REGISTRY_ASSET_PATH = "registry.json"
private const val NATIVE_TILE_PX = 32

@Serializable
data class AssetManifest(
    @SerialName("schema_version") val schemaVersion: Int,
    val entries: List<AssetRegistryEntry>,
)

@Serializable
data class AssetRegistryEntry(
    @SerialName("asset_id") val assetId: String,
    val source: String,
    @SerialName("asset_type") val assetType: String,
    val file: String,
    val frame: AssetFrame,
    @SerialName("style_contract") val styleContract: String,
    val mechanics: JsonElement? = null,
    val atlas: AtlasRect? = null,
    @SerialName("slice_px") val slicePx: Int? = null,
    val kind: String? = null,
    val rendering: WorldVisualRendering? = null,
    @SerialName("item_type") val itemType: String? = null,
    @SerialName("chronicle_kind") val chronicleKind: String? = null,
)

@Serializable
data class AssetFrame(val w: Int, val h: Int)

@Serializable
data class AtlasRect(
    val sheet: String,
    val x: Int,
    val y: Int,
    val w: Int,
    val h: Int,
)

@Serializable
data class WorldVisualRendering(
    val filtering: String,
    @SerialName("display_only") val displayOnly: Boolean,
    @SerialName("draw_scale") val drawScale: Double,
    val anchor: WorldVisualAnchor,
    val layer: String,
    @SerialName("z_policy") val zPolicy: String? = null,
)

@Serializable
data class WorldVisualAnchor(
    val type: String,
    @SerialName("source_pixels") val sourcePixels: List<Int>,
)

/**
 * Loads `assets/registry.json` (synced from `data/assets-built/registry.json`) and resolves
 * loose PNGs under `assets/`. Display-only — never gates movement, combat, or inventory truth.
 */
class AssetRegistry private constructor(
    private val context: Context,
    val manifest: AssetManifest,
    private val byAssetId: Map<String, AssetRegistryEntry>,
    private val byItemType: Map<String, AssetRegistryEntry>,
    private val bitmapCache: MutableMap<String, ImageBitmap?>,
) {
    fun entry(assetId: String): AssetRegistryEntry? = byAssetId[assetId]

    fun entryByItemType(itemType: String): AssetRegistryEntry? = byItemType[itemType]

    fun entriesByAssetType(assetType: String): List<AssetRegistryEntry> =
        manifest.entries.filter { it.assetType == assetType }

    /** UI pack entries use ids like `akalynth_ui_ui_panel_frame` for `ui/ui_panel_frame.png`. */
    fun uiEntry(stem: String): AssetRegistryEntry? =
        entry("akalynth_ui_$stem")

    fun loadBitmap(assetPath: String): ImageBitmap? {
        bitmapCache[assetPath]?.let { return it }
        if (bitmapCache.containsKey(assetPath)) return null

        val bitmap = try {
            val opts = BitmapFactory.Options().apply { inScaled = false }
            context.assets.open(assetPath).use { BitmapFactory.decodeStream(it, null, opts)?.asImageBitmap() }
        } catch (_: Exception) {
            null
        }
        bitmapCache[assetPath] = bitmap
        return bitmap
    }

    fun loadBitmapForEntry(entry: AssetRegistryEntry): ImageBitmap? = loadBitmap(entry.file)

    fun worldSprite(assetId: String): WorldSprite? {
        val entry = entry(assetId) ?: return null
        val image = loadBitmapForEntry(entry) ?: return null
        return WorldSprite(
            image = image,
            tilesWide = (entry.frame.w / NATIVE_TILE_PX).coerceAtLeast(1),
            tilesTall = (entry.frame.h / NATIVE_TILE_PX).coerceAtLeast(1),
        )
    }

    fun itemIcon(itemType: String): ImageBitmap? =
        entryByItemType(itemType)?.let { loadBitmapForEntry(it) }

    companion object {
        private val json = Json { ignoreUnknownKeys = true }

        @Volatile
        private var instance: AssetRegistry? = null

        fun load(context: Context): AssetRegistry? {
            instance?.let { return it }
            synchronized(this) {
                instance?.let { return it }
                val appContext = context.applicationContext
                val registry = runCatching { parseManifest(appContext) }
                    .getOrNull()
                    ?.let { manifest ->
                        AssetRegistry(
                            context = appContext,
                            manifest = manifest,
                            byAssetId = manifest.entries.associateBy { it.assetId },
                            byItemType = manifest.entries
                                .mapNotNull { entry -> entry.itemType?.let { it to entry } }
                                .associate { it.first to it.second },
                            bitmapCache = HashMap(),
                        )
                    }
                instance = registry
                return registry
            }
        }

        fun canonicalWorldAssetId(shortId: String): String =
            if (shortId.startsWith(WORLD_ASSET_ID_PREFIX)) shortId else "$WORLD_ASSET_ID_PREFIX$shortId"

        fun worldShortIdFromAssetId(assetId: String): String =
            if (assetId.startsWith(WORLD_ASSET_ID_PREFIX)) {
                assetId.removePrefix(WORLD_ASSET_ID_PREFIX)
            } else {
                assetId
            }

        private fun parseManifest(context: Context): AssetManifest {
            val raw = context.assets.open(REGISTRY_ASSET_PATH).bufferedReader().use { it.readText() }
            return json.decodeFromString<AssetManifest>(raw)
        }
    }
}

@Composable
fun rememberAssetRegistry(): AssetRegistry? {
    val context = LocalContext.current
    return remember(context) { AssetRegistry.load(context) }
}