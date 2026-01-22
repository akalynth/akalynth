package com.akalynth.client.ui.components.hotbar

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Hotbar component for quick item access.
 *
 * Contracts:
 * - 4 slots, 48dp each, 10dp gap between slots
 * - Tap slot → onSlotTap(index) for use/equip
 * - Long press slot → onSlotLongPress(index) for drop confirmation
 *
 * @param slots Array of 4 items (null for empty slot)
 * @param onSlotTap Called when slot is tapped (use item, equip, etc.)
 * @param onSlotLongPress Called when slot is long-pressed (opens drop confirmation)
 * @param modifier Modifier for the hotbar container
 */
@Composable
fun Hotbar(
    slots: List<Item?>,
    onSlotTap: (index: Int) -> Unit,
    onSlotLongPress: (index: Int) -> Unit,
    modifier: Modifier = Modifier
) {
    require(slots.size == HOTBAR_SLOT_COUNT) {
        "Hotbar requires exactly $HOTBAR_SLOT_COUNT slots, got ${slots.size}"
    }

    Row(
        modifier = modifier
            .testTag("Hotbar"),
        horizontalArrangement = Arrangement.spacedBy(HOTBAR_SLOT_GAP),
        verticalAlignment = Alignment.CenterVertically
    ) {
        slots.forEachIndexed { index, item ->
            HotbarSlot(
                index = index,
                item = item,
                onTap = { onSlotTap(index) },
                onLongPress = { onSlotLongPress(index) },
                modifier = Modifier.testTag("Hotbar_Slot_$index")
            )
        }
    }
}

/**
 * Individual hotbar slot.
 *
 * @param index Slot index (0-3)
 * @param item Item in slot (null if empty)
 * @param onTap Called on tap (use/equip)
 * @param onLongPress Called on long press (drop confirmation)
 * @param modifier Modifier for the slot
 */
@Composable
fun HotbarSlot(
    index: Int,
    item: Item?,
    onTap: () -> Unit,
    onLongPress: () -> Unit,
    modifier: Modifier = Modifier
) {
    val scope = rememberCoroutineScope()
    var pressJob by remember { mutableStateOf<Job?>(null) }
    var isPressed by remember { mutableStateOf(false) }

    val backgroundColor = if (item != null) {
        Color(item.rarity.colorHex).copy(alpha = 0.2f)
    } else {
        Color(0xFF2A2A4A)
    }

    val borderColor = if (item != null) {
        Color(item.rarity.colorHex)
    } else {
        Color(0xFF3A3A5A)
    }

    Box(
        modifier = modifier
            .size(HOTBAR_SLOT_SIZE)
            .background(backgroundColor, RoundedCornerShape(8.dp))
            .border(2.dp, borderColor, RoundedCornerShape(8.dp))
            .pointerInput(item) {
                awaitEachGesture {
                    val down = awaitFirstDown(requireUnconsumed = false)
                    isPressed = true

                    // Start long press timer
                    pressJob = scope.launch {
                        delay(LONG_PRESS_THRESHOLD_MS)
                        if (item != null) {
                            onLongPress()
                        }
                    }

                    val up = waitForUpOrCancellation()
                    isPressed = false

                    // Cancel long press if released early
                    val wasLongPress = pressJob?.isCompleted == true
                    pressJob?.cancel()
                    pressJob = null

                    // Only fire tap if not a long press and pointer was released (not cancelled)
                    if (up != null && !wasLongPress && item != null) {
                        onTap()
                    }
                }
            },
        contentAlignment = Alignment.Center
    ) {
        if (item != null) {
            // Item display
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.fillMaxSize().padding(4.dp)
            ) {
                // Icon placeholder
                Text(
                    text = getItemIcon(item),
                    fontSize = 20.sp,
                    modifier = Modifier.testTag("Hotbar_Slot_${index}_Icon")
                )

                // Stack count (if stackable)
                if (item.isStackable) {
                    Text(
                        text = "${item.stackCount}",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        modifier = Modifier.testTag("Hotbar_Slot_${index}_Count")
                    )
                }
            }
        } else {
            // Empty slot indicator
            Text(
                text = "${index + 1}",
                fontSize = 12.sp,
                color = Color.Gray.copy(alpha = 0.5f),
                textAlign = TextAlign.Center,
                modifier = Modifier.testTag("Hotbar_Slot_${index}_Empty")
            )
        }
    }
}

/**
 * Get placeholder icon for item.
 * In production, this would load actual sprite assets.
 */
private fun getItemIcon(item: Item): String {
    return when {
        item.name.contains("sword", ignoreCase = true) -> "⚔"
        item.name.contains("potion", ignoreCase = true) -> "🧪"
        item.name.contains("shield", ignoreCase = true) -> "🛡"
        item.name.contains("bow", ignoreCase = true) -> "🏹"
        item.name.contains("staff", ignoreCase = true) -> "🪄"
        item.name.contains("ring", ignoreCase = true) -> "💍"
        item.name.contains("gem", ignoreCase = true) -> "💎"
        else -> "📦"
    }
}

/**
 * Number of slots in the hotbar.
 */
const val HOTBAR_SLOT_COUNT = 4

/**
 * Size of each hotbar slot.
 */
val HOTBAR_SLOT_SIZE = 48.dp

/**
 * Gap between hotbar slots.
 */
val HOTBAR_SLOT_GAP = 10.dp

/**
 * Long press threshold in milliseconds.
 */
const val LONG_PRESS_THRESHOLD_MS = 500L
