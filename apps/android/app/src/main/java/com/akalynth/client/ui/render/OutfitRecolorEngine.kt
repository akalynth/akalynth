package com.akalynth.client.ui.render

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.graphics.asImageBitmap
import com.akalynth.client.protocol.OutfitColors

/**
 * Tibia-style mask recolor for in-game character sheets (display-only).
 * Applies south-facing mask tints to every 64×64 frame in a 4×4 walk sheet.
 */
object OutfitRecolorEngine {
    private const val FRAME_PX = 64
    private const val FRAMES_PER_AXIS = 4
    private const val MASK_ROOT = "outfits/guard_city_01/masks/front"

    private val RECOLOR_SPRITE_IDS = setOf("guard_city_01")

    private val SLOT_MASKS = listOf(
        SlotMask({ it.head }, "hair"),
        SlotMask({ it.body }, "primary_cloth"),
        SlotMask({ it.legs }, "secondary_cloth"),
        SlotMask({ it.feet }, "boots"),
    )

    private data class SlotMask(
        val index: (OutfitColors) -> Int,
        val assetName: String,
    )

    private val paletteRgb = intArrayOf(
        0xFFFFFF, 0xFFD4BF, 0xDEB887, 0xC8A882, 0xA08060, 0x806040, 0x604020, 0x402010,
        0xFF6060, 0xE03030, 0xB01010, 0x801010, 0xFF9040, 0xE07020, 0xB05010, 0xFFD040,
        0xE0B020, 0xB08010, 0x90D040, 0x60B030, 0x308020, 0x206010, 0x40C080, 0x2080C0,
        0x1060A0, 0x104080, 0x2040A0, 0x6060C0, 0x8040C0, 0x6020A0, 0x402080, 0xC060C0,
        0xE080C0, 0xC04080, 0xA02060, 0x808080, 0x606060, 0x404040, 0x202020, 0x101010,
        0xC0C0C0, 0xA0A0B0, 0x8090A0, 0x607080, 0xD0B090, 0xB09070, 0x907050, 0x705030,
        0xF0E8D8, 0xE8D8C0, 0xD8C8A8, 0xC0A878, 0x90C8E8, 0x60A8D8, 0x4088B8, 0x286898,
        0x68D8A8, 0x48B888, 0x88E868, 0xE8C848, 0xD8A030, 0xC87820, 0xA85818, 0xE5B75C,
    )

    private val maskCache = mutableMapOf<String, Bitmap>()

    fun supports(spriteId: String?): Boolean = spriteId != null && spriteId in RECOLOR_SPRITE_IDS

    fun recolorSheet(
        context: Context,
        spriteId: String,
        base: WorldSprite,
        colors: OutfitColors,
    ): WorldSprite? {
        if (!supports(spriteId)) return null
        val src = base.image.toBitmap() ?: return null
        val out = src.copy(Bitmap.Config.ARGB_8888, true) ?: return null
        val masks = loadMasks(context) ?: return null

        for (row in 0 until FRAMES_PER_AXIS) {
            for (col in 0 until FRAMES_PER_AXIS) {
                applyFrameTint(out, col * FRAME_PX, row * FRAME_PX, colors, masks)
            }
        }

        val image = out.asImageBitmap()
        return WorldSprite(image = image, tilesWide = base.tilesWide, tilesTall = base.tilesTall)
    }

    private fun loadMasks(context: Context): Map<String, Bitmap>? {
        val loaded = mutableMapOf<String, Bitmap>()
        for (slot in SLOT_MASKS) {
            val path = "$MASK_ROOT/${slot.assetName}.png"
            val cached = maskCache[path]
            if (cached != null) {
                loaded[slot.assetName] = cached
            } else {
                val bitmap = loadAssetBitmap(context, path) ?: return null
                maskCache[path] = bitmap
                loaded[slot.assetName] = bitmap
            }
        }
        return loaded
    }

    private fun loadAssetBitmap(context: Context, path: String): Bitmap? = try {
        val opts = BitmapFactory.Options().apply { inScaled = false }
        context.assets.open(path).use { BitmapFactory.decodeStream(it, null, opts) }
    } catch (_: Exception) {
        null
    }

    private fun applyFrameTint(
        target: Bitmap,
        offsetX: Int,
        offsetY: Int,
        colors: OutfitColors,
        masks: Map<String, Bitmap>,
    ) {
        val w = FRAME_PX
        val h = FRAME_PX
        val pixels = IntArray(w * h)
        target.getPixels(pixels, 0, w, offsetX, offsetY, w, h)

        for (slot in SLOT_MASKS) {
            val mask = masks[slot.assetName] ?: continue
            val maskPixels = IntArray(w * h)
            mask.getPixels(maskPixels, 0, w, 0, 0, w, h)
            val colorIndex = slot.index(colors).coerceIn(0, paletteRgb.lastIndex)
            val rgb = paletteRgb[colorIndex]
            val tr = (rgb shr 16) and 0xFF
            val tg = (rgb shr 8) and 0xFF
            val tb = rgb and 0xFF
            applyMaskTint(pixels, maskPixels, w, h, tr, tg, tb)
        }

        target.setPixels(pixels, 0, w, offsetX, offsetY, w, h)
    }

    private fun applyMaskTint(
        data: IntArray,
        maskData: IntArray,
        w: Int,
        h: Int,
        tr: Int,
        tg: Int,
        tb: Int,
    ) {
        for (y in 0 until h) {
            for (x in 0 until w) {
                val i = y * w + x
                val ma = (maskData[i] ushr 24) and 0xFF
                if (ma < 24) continue
                val mr = (maskData[i] shr 16) and 0xFF
                val mg = (maskData[i] shr 8) and 0xFF
                val mb = maskData[i] and 0xFF
                val maskLum = (mr + mg + mb) / (3f * 255f)
                if (maskLum < 0.08f && ma < 128) continue

                val r = (data[i] shr 16) and 0xFF
                val g = (data[i] shr 8) and 0xFF
                val b = data[i] and 0xFF
                val lum = (0.299f * r + 0.587f * g + 0.114f * b) / 255f
                val shade = (lum * 0.85f + maskLum * 0.35f).coerceIn(0.15f, 1f)
                val weight = (ma / 255f).coerceAtMost(1f)

                val nr = (r * (1f - weight) + tr * shade * weight).toInt().coerceIn(0, 255)
                val ng = (g * (1f - weight) + tg * shade * weight).toInt().coerceIn(0, 255)
                val nb = (b * (1f - weight) + tb * shade * weight).toInt().coerceIn(0, 255)
                data[i] = (0xFF shl 24) or (nr shl 16) or (ng shl 8) or nb
            }
        }
    }
}

private fun ImageBitmap.toBitmap(): Bitmap? = try {
    asAndroidBitmap()
} catch (_: Exception) {
    null
}