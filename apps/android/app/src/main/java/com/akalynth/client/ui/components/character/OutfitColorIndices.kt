package com.akalynth.client.ui.components.character

import androidx.compose.ui.graphics.Color
import org.json.JSONObject

data class OutfitColorIndices(
    val head: Int,
    val body: Int,
    val legs: Int,
    val feet: Int,
) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("head", head)
        put("body", body)
        put("legs", legs)
        put("feet", feet)
    }

    companion object {
        val DEFAULT = OutfitColorIndices(head = 5, body = 24, legs = 36, feet = 38)

        fun fromJson(obj: JSONObject?): OutfitColorIndices? {
            if (obj == null) return null
            return OutfitColorIndices(
                head = obj.optInt("head", -1),
                body = obj.optInt("body", -1),
                legs = obj.optInt("legs", -1),
                feet = obj.optInt("feet", -1),
            ).takeIf { it.isValid() }
        }

        private fun OutfitColorIndices.isValid(): Boolean =
            head in 0 until PALETTE_SIZE &&
                body in 0 until PALETTE_SIZE &&
                legs in 0 until PALETTE_SIZE &&
                feet in 0 until PALETTE_SIZE
    }
}

data class OutfitColorSlot(
    val key: String,
    val label: String,
)

data class OutfitEngineMeta(
    val paletteSize: Int,
    val defaultColors: OutfitColorIndices,
    val colorSlots: List<OutfitColorSlot>,
    val recolorSpriteIds: List<String>,
) {
    companion object {
        val FALLBACK = OutfitEngineMeta(
            paletteSize = PALETTE_SIZE,
            defaultColors = OutfitColorIndices.DEFAULT,
            colorSlots = listOf(
                OutfitColorSlot("head", "Head"),
                OutfitColorSlot("body", "Body"),
                OutfitColorSlot("legs", "Legs"),
                OutfitColorSlot("feet", "Feet"),
            ),
            recolorSpriteIds = listOf("guard_city_01"),
        )

        fun fromJson(obj: JSONObject?): OutfitEngineMeta? {
            if (obj == null) return null
            val defaults = OutfitColorIndices.fromJson(obj.optJSONObject("default_colors")) ?: return null
            val slots = obj.optJSONArray("color_slots") ?: return null
            val parsedSlots = buildList {
                for (i in 0 until slots.length()) {
                    val entry = slots.optJSONObject(i) ?: continue
                    val key = entry.optString("key")
                    val label = entry.optString("label")
                    if (key.isNotBlank() && label.isNotBlank()) {
                        add(OutfitColorSlot(key = key, label = label))
                    }
                }
            }
            if (parsedSlots.size != 4) return null
            val recolor = obj.optJSONArray("recolor_sprite_ids") ?: return null
            val recolorIds = buildList {
                for (i in 0 until recolor.length()) {
                    val id = recolor.optString(i)
                    if (id.isNotBlank()) add(id)
                }
            }
            return OutfitEngineMeta(
                paletteSize = obj.optInt("palette_size", PALETTE_SIZE),
                defaultColors = defaults,
                colorSlots = parsedSlots,
                recolorSpriteIds = recolorIds,
            )
        }
    }
}

const val PALETTE_SIZE = 64

val OUTFIT_PALETTE_HEX: List<Color> = listOf(
    Color(0xFFFFFFFF), Color(0xFFFFD4BF), Color(0xFFDEB887), Color(0xFFC8A882),
    Color(0xFFA08060), Color(0xFF806040), Color(0xFF604020), Color(0xFF402010),
    Color(0xFFFF6060), Color(0xFFE03030), Color(0xFFB01010), Color(0xFF801010),
    Color(0xFFFF9040), Color(0xFFE07020), Color(0xFFB05010), Color(0xFFFFD040),
    Color(0xFFE0B020), Color(0xFFB08010), Color(0xFF90D040), Color(0xFF60B030),
    Color(0xFF308020), Color(0xFF206010), Color(0xFF40C080), Color(0xFF2080C0),
    Color(0xFF1060A0), Color(0xFF104080), Color(0xFF2040A0), Color(0xFF6060C0),
    Color(0xFF8040C0), Color(0xFF6020A0), Color(0xFF402080), Color(0xFFC060C0),
    Color(0xFFE080C0), Color(0xFFC04080), Color(0xFFA02060), Color(0xFF808080),
    Color(0xFF606060), Color(0xFF404040), Color(0xFF202020), Color(0xFF101010),
    Color(0xFFC0C0C0), Color(0xFFA0A0B0), Color(0xFF8090A0), Color(0xFF607080),
    Color(0xFFD0B090), Color(0xFFB09070), Color(0xFF907050), Color(0xFF705030),
    Color(0xFFF0E8D8), Color(0xFFE8D8C0), Color(0xFFD8C8A8), Color(0xFFC0A878),
    Color(0xFF90C8E8), Color(0xFF60A8D8), Color(0xFF4088B8), Color(0xFF286898),
    Color(0xFF68D8A8), Color(0xFF48B888), Color(0xFF88E868), Color(0xFFE8C848),
    Color(0xFFD8A030), Color(0xFFC87820), Color(0xFFA85818), Color(0xFFE5B75C),
)

fun outfitPaletteColor(index: Int): Color =
    OUTFIT_PALETTE_HEX.getOrElse(index) { Color(0xFF808080) }