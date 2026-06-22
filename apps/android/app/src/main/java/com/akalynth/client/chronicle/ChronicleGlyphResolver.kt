package com.akalynth.client.chronicle

import android.content.Context
import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Resolves chronicle event kinds to bundled glyph assets (PR-021 placeholders).
 *
 * Index key: [chronicleKindLabel] snake_case labels match registry `chronicle_kind`.
 * Fallback: every unmapped kind resolves to the `unknown` glyph asset.
 */
data class ChronicleGlyph(
    val kind: ChronicleEventKind,
    /** Registry chronicle_kind label (snake_case). */
    val chronicleKind: String,
    /** Asset path relative to app assets root. */
    val assetPath: String,
)

object ChronicleGlyphResolver {

    private const val UNKNOWN_CHRONICLE_KIND = "unknown"
    private const val UNKNOWN_ASSET_PATH = "sprites/effect__chronicle_unknown.png"

    private val KIND_TO_CHRONICLE_KIND = mapOf(
        ChronicleEventKind.DEATH to "death",
        ChronicleEventKind.ZONE_ENTER to "zone_enter",
        ChronicleEventKind.ITEM_PICKUP to "item_pickup",
        ChronicleEventKind.ITEM_DROP to "item_drop",
        ChronicleEventKind.COMBAT_KILL to "combat_kill",
        ChronicleEventKind.TUTORIAL_COMPLETE to "tutorial_complete",
        ChronicleEventKind.CHARACTER_CREATED to "character_created",
        ChronicleEventKind.WORLD_EVENT to "world_event",
        ChronicleEventKind.UNKNOWN to UNKNOWN_CHRONICLE_KIND,
    )

    private val CHRONICLE_KIND_TO_ASSET = mapOf(
        "death" to "sprites/effect__chronicle_death.png",
        "zone_enter" to "sprites/effect__chronicle_zone.png",
        "item_pickup" to "sprites/effect__chronicle_pickup.png",
        "item_drop" to "sprites/effect__chronicle_drop.png",
        "combat_kill" to "sprites/effect__chronicle_combat.png",
        "tutorial_complete" to "sprites/effect__chronicle_tutorial.png",
        "character_created" to "sprites/effect__chronicle_create.png",
        "world_event" to "sprites/effect__chronicle_world.png",
        UNKNOWN_CHRONICLE_KIND to UNKNOWN_ASSET_PATH,
    )

    /** Snake_case label indexed by registry `chronicle_kind`. */
    fun chronicleKindLabel(kind: ChronicleEventKind): String =
        KIND_TO_CHRONICLE_KIND[kind] ?: UNKNOWN_CHRONICLE_KIND

    /** Resolve glyph metadata; unmapped kinds fall back to UNKNOWN. */
    fun resolve(kind: ChronicleEventKind): ChronicleGlyph {
        val label = chronicleKindLabel(kind)
        val assetPath = CHRONICLE_KIND_TO_ASSET[label] ?: UNKNOWN_ASSET_PATH
        return ChronicleGlyph(
            kind = if (label == UNKNOWN_CHRONICLE_KIND && kind != ChronicleEventKind.UNKNOWN) {
                ChronicleEventKind.UNKNOWN
            } else {
                kind
            },
            chronicleKind = label,
            assetPath = assetPath,
        )
    }

    /** Whether this event kind opens a detail view on tap. */
    fun isTappable(kind: ChronicleEventKind): Boolean = kind == ChronicleEventKind.DEATH

    /** ASCII export label for proof bundles and logs (no emoji). */
    fun exportLabel(kind: ChronicleEventKind): String = "[${chronicleKindLabel(kind)}]"

    fun loadBitmap(context: Context, glyph: ChronicleGlyph): ImageBitmap? =
        loadBitmap(context, glyph.assetPath)

    fun loadBitmap(context: Context, kind: ChronicleEventKind): ImageBitmap? =
        loadBitmap(context, resolve(kind).assetPath)

    private fun loadBitmap(context: Context, assetPath: String): ImageBitmap? = try {
        val opts = BitmapFactory.Options().apply { inScaled = false }
        context.assets.open(assetPath).use { stream ->
            BitmapFactory.decodeStream(stream, null, opts)?.asImageBitmap()
        }
    } catch (_: Exception) {
        null
    }
}

/**
 * Chronicle feed glyph: bundled sprite when present, ASCII label fallback otherwise.
 */
@Composable
fun ChronicleGlyphIcon(
    kind: ChronicleEventKind,
    modifier: Modifier = Modifier,
    size: Dp = 20.dp,
    testTag: String = "ChronicleSheet_EventIcon_${kind.name}",
) {
    val context = LocalContext.current
    val glyph = remember(kind) { ChronicleGlyphResolver.resolve(kind) }
    val bitmap = remember(context, glyph.assetPath) {
        ChronicleGlyphResolver.loadBitmap(context, glyph)
    }

    if (bitmap != null) {
        Image(
            bitmap = bitmap,
            contentDescription = glyph.chronicleKind,
            modifier = modifier
                .size(size)
                .testTag(testTag),
            contentScale = ContentScale.Fit,
            filterQuality = FilterQuality.None,
        )
    } else {
        Text(
            text = ChronicleGlyphResolver.exportLabel(kind),
            fontSize = (size.value * 0.6f).sp,
            modifier = modifier
                .size(size)
                .testTag(testTag),
        )
    }
}