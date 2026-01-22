package com.akalynth.client.ui.components.death

import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.akalynth.client.ui.state.ChronicleEvent
import com.akalynth.client.ui.state.ChronicleEventKind

/**
 * Death recap sheet modal displaying death details.
 * Maps to UI_REGRESSION_MATRIX.md Section 5: Death Experience (X3-X4).
 *
 * Contract:
 * - X3: Displays killer, location (zone + coords), time, items lost
 * - X3: Handles null killer ("Environment" or "Unknown")
 * - X3: Handles empty items lost list cleanly
 * - X4: Copy Event ID button writes to clipboard via callback
 * - X4: Copy button disabled/hidden if no event ID
 *
 * @param event Chronicle event (must be DEATH kind) with all details
 * @param onCopyEventId Called with event ID when copy button is tapped
 * @param onDismiss Called when sheet should close
 * @param modifier Modifier for the sheet container
 */
@Composable
fun DeathRecapSheet(
    event: ChronicleEvent,
    onCopyEventId: (String) -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    val haptics = LocalHapticFeedback.current

    // Extract details from event
    val killerName = event.details.killerName
    val itemsLost = event.details.itemsLost ?: emptyList()
    val hasEventId = event.id.isNotBlank() && !event.id.startsWith("pending_")

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp))
            .background(Color(0xFF1A1A2E)) // Dark background
            .padding(16.dp)
            .testTag("DeathRecapSheet"),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Header row with close button
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Skull icon
            Text(
                text = "☠",
                fontSize = 24.sp,
                modifier = Modifier.testTag("DeathRecapSheet_Icon")
            )

            // Title
            Text(
                text = "DEATH RECAP",
                color = Color(0xFFE53935), // Red
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.testTag("DeathRecapSheet_Title")
            )

            // Close button
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color(0xFF2D2D44))
                    .clickable {
                        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        onDismiss()
                    }
                    .testTag("DeathRecapSheet_Close"),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "✕",
                    color = Color(0xFF9E9E9E),
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))
        HorizontalDivider(color = Color(0xFF3D3D5C))
        Spacer(modifier = Modifier.height(16.dp))

        // Killer info
        DetailRow(
            label = "Killed by:",
            value = killerName ?: "Environment",
            testTag = "DeathRecapSheet_Killer"
        )

        Spacer(modifier = Modifier.height(8.dp))

        // Location info
        DetailRow(
            label = "Location:",
            value = "${event.zone} (${event.x}, ${event.y})",
            testTag = "DeathRecapSheet_Location"
        )

        Spacer(modifier = Modifier.height(8.dp))

        // Time info
        DetailRow(
            label = "Time:",
            value = formatTimestamp(event.timestamp),
            testTag = "DeathRecapSheet_Time"
        )

        Spacer(modifier = Modifier.height(16.dp))
        HorizontalDivider(color = Color(0xFF3D3D5C))
        Spacer(modifier = Modifier.height(16.dp))

        // Items lost section
        if (itemsLost.isNotEmpty()) {
            Text(
                text = "ITEMS LOST (${itemsLost.size}):",
                color = Color(0xFFFFCDD2), // Light red
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("DeathRecapSheet_ItemsHeader")
            )

            Spacer(modifier = Modifier.height(8.dp))

            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .height((itemsLost.size.coerceAtMost(5) * 28).dp)
                    .testTag("DeathRecapSheet_ItemsList"),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                items(itemsLost) { item ->
                    ItemLostRow(item)
                }
            }
        } else {
            Text(
                text = "No items lost",
                color = Color(0xFF9E9E9E),
                fontSize = 14.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("DeathRecapSheet_NoItems")
            )
        }

        Spacer(modifier = Modifier.height(16.dp))
        HorizontalDivider(color = Color(0xFF3D3D5C))
        Spacer(modifier = Modifier.height(16.dp))

        // Copy Event ID button
        Button(
            onClick = {
                if (hasEventId) {
                    haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    onCopyEventId(event.id)
                }
            },
            enabled = hasEventId,
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFF3D3D5C),
                contentColor = Color(0xFFE5E7EB),
                disabledContainerColor = Color(0xFF2D2D44),
                disabledContentColor = Color(0xFF6E6E8A)
            ),
            modifier = Modifier
                .fillMaxWidth()
                .testTag("DeathRecapSheet_CopyButton")
        ) {
            Text(
                text = if (hasEventId) "COPY EVENT ID" else "EVENT ID PENDING",
                fontWeight = FontWeight.Medium
            )
        }

        // Event ID display (small, for reference)
        if (hasEventId) {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = event.id,
                color = Color(0xFF6E6E8A),
                fontSize = 10.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("DeathRecapSheet_EventId")
            )
        }
    }
}

/**
 * Detail row with label and value.
 */
@Composable
private fun DetailRow(
    label: String,
    value: String,
    testTag: String
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .testTag(testTag),
        horizontalArrangement = Arrangement.Start
    ) {
        Text(
            text = label,
            color = Color(0xFF9E9E9E),
            fontSize = 14.sp,
            modifier = Modifier.width(80.dp)
        )
        Text(
            text = value,
            color = Color(0xFFE5E7EB),
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium
        )
    }
}

/**
 * Single item lost row with bullet point.
 */
@Composable
private fun ItemLostRow(itemName: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 8.dp)
            .testTag("DeathRecapSheet_Item_$itemName"),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = "•",
            color = Color(0xFFE53935),
            fontSize = 14.sp
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = itemName,
            color = Color(0xFFFFCDD2),
            fontSize = 14.sp
        )
    }
}

/**
 * Format ISO 8601 timestamp to readable time.
 * Input: "2026-01-21T14:32:07Z"
 * Output: "14:32:07"
 */
private fun formatTimestamp(timestamp: String): String {
    return try {
        // Extract time portion from ISO 8601 timestamp
        val timePart = timestamp.substringAfter("T").substringBefore("Z").substringBefore("+")
        timePart
    } catch (e: Exception) {
        timestamp
    }
}

/**
 * Sheet open timing constraint per UI_REGRESSION_MATRIX.md.
 * Value: 300ms max
 */
const val SHEET_OPEN_MS = 300L
