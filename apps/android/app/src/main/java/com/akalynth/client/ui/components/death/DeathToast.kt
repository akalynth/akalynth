package com.akalynth.client.ui.components.death

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
import com.akalynth.client.ui.state.DeathNotice
import kotlinx.coroutines.delay

/**
 * Death toast notification with auto-dismiss.
 * Maps to UI_REGRESSION_MATRIX.md Section 5: Death Experience (X1-X3).
 *
 * Contract:
 * - X1: Appears within 500ms of death event (caller responsibility)
 * - X1: Shows "You died" + items lost list
 * - X2: Auto-dismisses at [TOAST_DURATION_MS] (5000ms ±250ms)
 * - X3: Tap opens recap sheet via [onTap]
 *
 * Timing is driven by coroutine delay, which integrates with Compose test clock
 * via `mainClock.advanceTimeBy()` for deterministic testing.
 *
 * @param notice Death notice payload with items lost and location
 * @param visible Whether toast is currently visible (controls animation)
 * @param onTap Called when toast is tapped (should transition to recap)
 * @param onDismiss Called when toast auto-dismisses (timeout elapsed)
 * @param modifier Modifier for positioning
 */
@Composable
fun DeathToast(
    notice: DeathNotice,
    visible: Boolean,
    onTap: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    val haptics = LocalHapticFeedback.current

    // Auto-dismiss timer
    LaunchedEffect(visible) {
        if (visible) {
            delay(TOAST_DURATION_MS)
            onDismiss()
        }
    }

    AnimatedVisibility(
        visible = visible,
        enter = slideInVertically(initialOffsetY = { -it }),
        exit = slideOutVertically(targetOffsetY = { -it }),
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .testTag("DeathToast")
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(Color(0xDD1A0A0A)) // Dark red-tinted background
                .clickable {
                    haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    onTap()
                }
                .padding(16.dp)
                .testTag("DeathToast_Content"),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Death icon and message
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = "☠",
                    fontSize = 28.sp,
                    modifier = Modifier.testTag("DeathToast_Icon")
                )
                Spacer(modifier = Modifier.size(8.dp))
                Text(
                    text = "You died",
                    color = Color(0xFFE53935), // Red death color
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.testTag("DeathToast_Title")
                )
            }

            // Items lost section (only if items present)
            if (notice.itemsLost.isNotEmpty()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Lost: ${notice.itemsLost.joinToString(", ")}",
                    color = Color(0xFFFFCDD2), // Light red
                    fontSize = 14.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("DeathToast_ItemsLost")
                )
            } else {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "No items lost",
                    color = Color(0xFF9E9E9E), // Gray
                    fontSize = 14.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("DeathToast_NoItems")
                )
            }

            // Tap for details hint
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = "[TAP FOR DETAILS]",
                color = Color(0xFF757575), // Muted gray
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.testTag("DeathToast_TapHint")
            )
        }
    }
}

/**
 * Standalone DeathToast that manages its own visibility state.
 * Useful for direct composition without external state management.
 *
 * @param notice Death notice payload
 * @param onTap Called when tapped (usually transitions to recap)
 * @param onDismiss Called when auto-dismissed or manually closed
 */
@Composable
fun DeathToastSelfManaged(
    notice: DeathNotice,
    onTap: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    var visible by remember { mutableStateOf(true) }

    DeathToast(
        notice = notice,
        visible = visible,
        onTap = {
            visible = false
            onTap()
        },
        onDismiss = {
            visible = false
            onDismiss()
        },
        modifier = modifier
    )
}

/**
 * Toast appearance deadline per UI_REGRESSION_MATRIX.md.
 * Value: 500ms max from death event to toast visible.
 */
const val TOAST_APPEAR_MS = 500L

/**
 * Toast auto-dismiss duration per UI_REGRESSION_MATRIX.md.
 * Value: 5000ms ±250ms tolerance.
 */
const val TOAST_DURATION_MS = 5000L

/**
 * Toast duration tolerance for test assertions.
 */
const val TOAST_DURATION_TOLERANCE_MS = 250L
