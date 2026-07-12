package com.akalynth.client.ui.render

import android.content.Context
import android.util.LruCache
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import com.akalynth.client.protocol.OutfitColors

class OutfitRecolorCache(
    maxEntries: Int = 48,
) {
    private val cache = LruCache<String, WorldSprite>(maxEntries)

    fun resolve(
        context: Context,
        spriteId: String?,
        base: WorldSprite?,
        colors: OutfitColors?,
    ): WorldSprite? {
        if (base == null || spriteId == null || colors == null) return base
        if (colors.isDefault() || !OutfitRecolorEngine.supports(spriteId)) return base
        val key = "$spriteId:${colors.cacheKey()}"
        cache.get(key)?.let { return it }
        val tinted = OutfitRecolorEngine.recolorSheet(context, spriteId, base, colors) ?: return base
        cache.put(key, tinted)
        return tinted
    }
}

@Composable
fun rememberOutfitRecolorCache(): OutfitRecolorCache = remember { OutfitRecolorCache() }