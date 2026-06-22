package com.akalynth.client.ui.components.hotbar

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.akalynth.client.assets.AssetRegistry
import com.akalynth.client.assets.AssetRegistryEntry
import com.akalynth.client.assets.rememberAssetRegistry

/** Native authored item icon size (Classic 32); display scales with nearest-neighbor filtering. */
const val ITEM_ICON_NATIVE_PX = 32

/** Default on-screen item icon size for hotbar and inventory slots. */
val ITEM_ICON_DEFAULT_SIZE = 32.dp

/** Sentinel [Item.spriteId] when no explicit sprite override is provided. */
const val ITEM_DEFAULT_SPRITE_ID = "item_default"

/**
 * Renders a 32×32 (nearest-neighbor) item icon for [item].
 *
 * Resolution chain (display-only, first hit wins):
 * 1. [Item.iconSpriteId] → registry asset_id lookup (PR-030 protocol field; optional today)
 * 2. [Item.itemType] → [AssetRegistry.itemIcon] registry index
 * 3. [Item.spriteId] → registry asset_id lookup
 * 4. [itemIconPlaceholderGlyph] text placeholder
 */
@Composable
fun ItemIcon(
    item: Item,
    modifier: Modifier = Modifier,
    size: Dp = ITEM_ICON_DEFAULT_SIZE,
    registry: AssetRegistry? = rememberAssetRegistry(),
    testTag: String? = null,
) {
    val density = LocalDensity.current
    val bitmap = remember(item.id, item.iconSpriteId, item.itemType, item.spriteId, registry) {
        ItemIconResolver.resolveBitmap(registry, item)
    }

    val iconModifier = modifier
        .size(size)
        .then(if (testTag != null) Modifier.testTag(testTag) else Modifier)

    if (bitmap != null) {
        Canvas(iconModifier) {
            drawItemIconBitmap(bitmap, size, density)
        }
    } else {
        ItemIconPlaceholder(
            item = item,
            modifier = iconModifier,
        )
    }
}

@Composable
private fun ItemIconPlaceholder(
    item: Item,
    modifier: Modifier = Modifier,
) {
    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        Text(
            text = itemIconPlaceholderGlyph(item),
            fontSize = 20.sp,
            textAlign = TextAlign.Center,
        )
    }
}

private fun DrawScope.drawItemIconBitmap(bitmap: ImageBitmap, size: Dp, density: Density) {
    val dstPx = with(density) { size.roundToPx() }
    drawImage(
        image = bitmap,
        dstOffset = IntOffset.Zero,
        dstSize = IntSize(dstPx, dstPx),
        filterQuality = FilterQuality.None,
    )
}

/** Display-only resolver for item icon bitmaps (testable without Compose). */
object ItemIconResolver {
    fun resolveEntry(
        iconSpriteId: String?,
        itemType: String,
        spriteId: String,
        lookupByAssetId: (String) -> AssetRegistryEntry?,
        lookupByItemType: (String) -> AssetRegistryEntry?,
    ): AssetRegistryEntry? {
        iconSpriteId
            ?.takeIf { it.isNotBlank() }
            ?.let(lookupByAssetId)
            ?.let { return it }

        lookupByItemType(itemType)?.let { return it }

        spriteId
            .takeIf { it.isNotBlank() && it != ITEM_DEFAULT_SPRITE_ID }
            ?.let(lookupByAssetId)
            ?.let { return it }

        return null
    }

    fun resolveBitmap(registry: AssetRegistry?, item: Item): ImageBitmap? {
        if (registry == null) return null
        val entry = resolveEntry(
            iconSpriteId = item.iconSpriteId,
            itemType = item.itemType,
            spriteId = item.spriteId,
            lookupByAssetId = registry::entry,
            lookupByItemType = registry::entryByItemType,
        ) ?: return null
        return registry.loadBitmapForEntry(entry)
    }
}

/**
 * Text glyph placeholder when no registry bitmap resolves.
 * Mirrors the prior hotbar emoji mapping until item art covers all MVP types.
 */
fun itemIconPlaceholderGlyph(item: Item): String = when {
    item.name.contains("sword", ignoreCase = true) -> "\u2694"
    item.name.contains("potion", ignoreCase = true) -> "\uD83E\uDDEA"
    item.name.contains("shield", ignoreCase = true) -> "\uD83D\uDEE1"
    item.name.contains("bow", ignoreCase = true) -> "\uD83C\uDFF9"
    item.name.contains("staff", ignoreCase = true) -> "\uD83E\uDE84"
    item.name.contains("ring", ignoreCase = true) -> "\uD83D\uDC8D"
    item.name.contains("gem", ignoreCase = true) -> "\uD83D\uDC8E"
    else -> "\uD83D\uDCE6"
}