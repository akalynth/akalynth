package com.akalynth.client.ui.components.confirmation

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

/**
 * Tier 3 confirmation slider requiring 90% slide to confirm.
 * Maps to UI_REGRESSION_MATRIX.md Section 3: D3-D5.
 *
 * Contract:
 * - Slide to [SLIDE_THRESHOLD] (90%) to trigger [onConfirm] exactly once
 * - Release below threshold triggers snap-back animation to 0
 * - Snap-back completes within [SNAP_BACK_MS] (200ms)
 * - Once confirmed, no further callbacks fire (confirmed latch)
 * - Track width measured at runtime (not hardcoded)
 *
 * @param label Accessibility label for the slider
 * @param onConfirm Called exactly once when slide completes
 * @param onDismiss Optional callback when dismissed without confirming
 * @param modifier Modifier for the slider
 * @param trackHeight Height of the track
 * @param thumbSize Size of the draggable thumb
 * @param trackColor Color of the unfilled track
 * @param fillColor Color of the filled track (progress)
 * @param thumbColor Color of the thumb
 * @param textColor Color of the instruction text
 */
@Composable
fun Tier3SlideConfirm(
    label: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit = {},
    modifier: Modifier = Modifier,
    trackHeight: Dp = 56.dp,
    thumbSize: Dp = 48.dp,
    trackColor: Color = Color(0xFF0B1020),     // AkalynthColors.Background
    fillColor: Color = Color(0xFFE2B714),      // AkalynthColors.Gold
    thumbColor: Color = Color(0xFFE2B714),     // AkalynthColors.Gold
    textColor: Color = Color(0xFFE5E7EB)       // AkalynthColors.TextPrimary
) {
    val haptics = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()
    val density = LocalDensity.current

    // Track dimensions measured at runtime (in px)
    var trackWidthPx by remember { mutableIntStateOf(0) }
    val thumbSizePx = with(density) { thumbSize.toPx() }

    // Maximum X offset for thumb (track width minus thumb width minus padding)
    val paddingPx = with(density) { 4.dp.toPx() }
    val maxOffsetPx = remember(trackWidthPx, thumbSizePx, paddingPx) {
        (trackWidthPx - thumbSizePx - paddingPx * 2).coerceAtLeast(0f)
    }

    // Current offset in pixels (Animatable for deterministic animations)
    val offsetPx = remember { Animatable(0f) }

    // Progress as fraction (0f to 1f)
    val progress = if (maxOffsetPx > 0f) {
        (offsetPx.value / maxOffsetPx).coerceIn(0f, 1f)
    } else {
        0f
    }

    // Confirmed latch: once true, no further callbacks
    var confirmed by remember { mutableStateOf(false) }

    // Track if user is currently dragging
    var isDragging by remember { mutableStateOf(false) }

    // Check for confirmation when progress reaches threshold
    LaunchedEffect(progress, isDragging) {
        if (!confirmed && progress >= SLIDE_THRESHOLD && isDragging) {
            // Reached threshold while dragging - prepare for confirm on release
        }
    }

    // Draggable state
    val draggableState = rememberDraggableState { delta ->
        if (!confirmed) {
            scope.launch {
                val newOffset = (offsetPx.value + delta).coerceIn(0f, maxOffsetPx)
                offsetPx.snapTo(newOffset)
            }
        }
    }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(trackHeight)
            .clip(RoundedCornerShape(trackHeight / 2))
            .background(trackColor)
            .onSizeChanged { size ->
                trackWidthPx = size.width
            }
            .semantics { contentDescription = label }
            .testTag("Tier3SlideConfirm"),
        contentAlignment = Alignment.CenterStart
    ) {
        // Fill track (shows progress)
        Box(
            modifier = Modifier
                .fillMaxWidth(progress)
                .height(trackHeight)
                .clip(RoundedCornerShape(trackHeight / 2))
                .background(fillColor.copy(alpha = 0.3f))
                .testTag("Tier3SlideConfirm_Fill")
        )

        // Instruction text (centered)
        Text(
            text = when {
                confirmed -> "Confirmed"
                progress >= SLIDE_THRESHOLD -> "Release to confirm"
                else -> "Slide to confirm"
            },
            color = textColor,
            fontWeight = FontWeight.Medium,
            fontSize = 14.sp,
            modifier = Modifier
                .align(Alignment.Center)
                .testTag("Tier3SlideConfirm_Text")
        )

        // Thumb (draggable)
        Box(
            modifier = Modifier
                .padding(horizontal = 4.dp)
                .offset { IntOffset(offsetPx.value.roundToInt(), 0) }
                .size(thumbSize)
                .clip(CircleShape)
                .background(if (confirmed) fillColor else thumbColor)
                .draggable(
                    state = draggableState,
                    orientation = Orientation.Horizontal,
                    enabled = !confirmed,
                    onDragStarted = {
                        isDragging = true
                        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    },
                    onDragStopped = {
                        isDragging = false

                        if (!confirmed) {
                            if (progress >= SLIDE_THRESHOLD) {
                                // Reached threshold - confirm
                                confirmed = true
                                haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                                onConfirm()
                            } else {
                                // Below threshold - snap back to 0
                                scope.launch {
                                    offsetPx.animateTo(
                                        targetValue = 0f,
                                        animationSpec = tween(
                                            durationMillis = SNAP_BACK_MS.toInt(),
                                            easing = LinearEasing
                                        )
                                    )
                                }
                            }
                        }
                    }
                )
                .testTag("Tier3SlideConfirm_Thumb"),
            contentAlignment = Alignment.Center
        ) {
            // Arrow icon inside thumb
            Text(
                text = if (confirmed) "✓" else "→",
                color = trackColor,
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp
            )
        }
    }
}

/**
 * Canonical slide threshold per UI_REGRESSION_MATRIX.md.
 * Exact value: 0.9 (90%)
 */
const val SLIDE_THRESHOLD = 0.9f

/**
 * Maximum snap-back animation duration per UI_REGRESSION_MATRIX.md.
 * Max value: 200ms
 */
const val SNAP_BACK_MS = 200L
