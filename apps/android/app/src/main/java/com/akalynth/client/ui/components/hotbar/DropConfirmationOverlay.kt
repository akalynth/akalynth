package com.akalynth.client.ui.components.hotbar

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.akalynth.client.ui.components.confirmation.Tier2HoldButton
import com.akalynth.client.ui.components.confirmation.Tier3SlideConfirm

/**
 * Drop confirmation overlay that routes to Tier2 or Tier3 based on item rarity.
 *
 * Contracts (D1-D7):
 * - D1: Long-press slot opens confirmation overlay
 * - D2: Normal/rare items → Tier2HoldButton (hold to confirm)
 * - D3: Legendary items → Tier3SlideConfirm (slide to confirm)
 * - D4: Confirm triggers onConfirmDrop(slotIndex, itemId)
 * - D5: Cancel/dismiss returns to None state
 * - D6: Overlay prevents interaction with underlying UI
 * - D7: Item name and rarity displayed clearly
 *
 * @param slotIndex Index of the hotbar slot being dropped
 * @param itemId ID of the item being dropped
 * @param itemName Display name of the item
 * @param isLegendary Whether item requires Tier3 (slide) confirmation
 * @param onConfirmDrop Called when drop is confirmed
 * @param onCancel Called when drop is cancelled
 * @param modifier Optional modifier
 */
@Composable
fun DropConfirmationOverlay(
    slotIndex: Int,
    itemId: String,
    itemName: String,
    isLegendary: Boolean,
    onConfirmDrop: (slotIndex: Int, itemId: String) -> Unit,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier
) {
    // Scrim that blocks interaction and dismisses on tap
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.7f))
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onCancel
            )
            .testTag("DropConfirmationOverlay_Scrim"),
        contentAlignment = Alignment.Center
    ) {
        // Content card (doesn't propagate clicks to scrim)
        Column(
            modifier = Modifier
                .fillMaxWidth(0.85f)
                .background(Color(0xFF1A1A2E), RoundedCornerShape(16.dp))
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    onClick = {} // Consume click, don't propagate to scrim
                )
                .padding(24.dp)
                .testTag("DropConfirmationOverlay_Content"),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Warning icon
            Text(
                text = "⚠️",
                fontSize = 48.sp,
                modifier = Modifier.testTag("DropConfirmationOverlay_Icon")
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Title
            Text(
                text = "Drop Item?",
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White,
                modifier = Modifier.testTag("DropConfirmationOverlay_Title")
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Item name with rarity indicator
            Text(
                text = itemName,
                fontSize = 18.sp,
                fontWeight = FontWeight.Medium,
                color = if (isLegendary) Color(0xFFFF9800) else Color.White,
                textAlign = TextAlign.Center,
                modifier = Modifier.testTag("DropConfirmationOverlay_ItemName")
            )

            if (isLegendary) {
                Text(
                    text = "LEGENDARY",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFFFF9800),
                    modifier = Modifier
                        .padding(top = 4.dp)
                        .testTag("DropConfirmationOverlay_LegendaryBadge")
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Confirmation widget: T2 or T3 based on rarity
            if (isLegendary) {
                // Tier3: Slide to confirm for legendary items
                Tier3SlideConfirm(
                    label = "Slide to drop",
                    onConfirm = { onConfirmDrop(slotIndex, itemId) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("DropConfirmationOverlay_Tier3")
                )
            } else {
                // Tier2: Hold to confirm for normal/rare items
                Tier2HoldButton(
                    label = "Hold to drop",
                    onConfirm = { onConfirmDrop(slotIndex, itemId) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("DropConfirmationOverlay_Tier2")
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Cancel button
            Button(
                onClick = onCancel,
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF424242)
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("DropConfirmationOverlay_CancelButton")
            ) {
                Text(
                    text = "CANCEL",
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}
