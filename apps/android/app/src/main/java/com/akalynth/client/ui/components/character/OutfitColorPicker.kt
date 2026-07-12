package com.akalynth.client.ui.components.character

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun OutfitColorPicker(
    engine: OutfitEngineMeta,
    value: OutfitColorIndices,
    onChange: (OutfitColorIndices) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    var activeSlot by remember(engine) { mutableStateOf(engine.colorSlots.first().key) }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(Color(0xFF12121E))
            .border(1.dp, Color(0xFF3A3A5A), RoundedCornerShape(8.dp))
            .padding(12.dp)
            .testTag("CharacterCreateScreen_OutfitColorPicker"),
    ) {
        Text(
            text = "Outfit colors",
            color = Color.Gray,
            fontSize = 12.sp,
            modifier = Modifier.padding(bottom = 8.dp),
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            engine.colorSlots.forEach { slot ->
                val index = value.forSlot(slot.key)
                val selected = slot.key == activeSlot
                val background = if (selected) Color(0xFF3D5AFE) else Color(0xFF2A2A4A)
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(background)
                        .clickable(enabled = enabled) { activeSlot = slot.key }
                        .padding(horizontal = 8.dp, vertical = 6.dp)
                        .testTag("CharacterCreateScreen_ColorSlot_${slot.key}"),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .size(14.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(outfitPaletteColor(index))
                            .border(1.dp, Color.Black),
                    )
                    Text(
                        text = slot.label,
                        color = Color.White,
                        fontSize = 11.sp,
                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                    )
                    Text(
                        text = index.toString(),
                        color = Color.Gray,
                        fontSize = 10.sp,
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            for (rowStart in 0 until PALETTE_SIZE step 8) {
                Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                    for (index in rowStart until rowStart + 8) {
                        val selected = value.forSlot(activeSlot) == index
                        Box(
                            modifier = Modifier
                                .size(18.dp)
                                .clip(RoundedCornerShape(2.dp))
                                .background(outfitPaletteColor(index))
                                .border(
                                    width = if (selected) 2.dp else 1.dp,
                                    color = if (selected) Color(0xFFFFD54F) else Color.Black,
                                    shape = RoundedCornerShape(2.dp),
                                )
                                .clickable(enabled = enabled) {
                                    onChange(value.withSlot(activeSlot, index))
                                }
                                .testTag("CharacterCreateScreen_ColorSwatch_$index"),
                        )
                    }
                }
            }
        }
    }
}

private fun OutfitColorIndices.forSlot(key: String): Int = when (key) {
    "head" -> head
    "body" -> body
    "legs" -> legs
    "feet" -> feet
    else -> 0
}

private fun OutfitColorIndices.withSlot(key: String, index: Int): OutfitColorIndices = when (key) {
    "head" -> copy(head = index)
    "body" -> copy(body = index)
    "legs" -> copy(legs = index)
    "feet" -> copy(feet = index)
    else -> this
}