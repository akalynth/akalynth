package com.akalynth.client.ui.components.movement

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.akalynth.client.protocol.Direction

/**
 * 8-direction D-pad for movement input.
 * Maps to UI_REGRESSION_MATRIX.md Section 1: M1-M3.
 *
 * Contract:
 * - M1: All 8 directions map correctly (N, NE, E, SE, S, SW, W, NW)
 * - M2: Release emits once; no stuck movement (waitForUpOrCancellation)
 * - M3: Each button hitbox >= 44dp
 *
 * Uses [awaitEachGesture] pattern for proper press/release semantics:
 * - Press emits [onDirection] exactly once
 * - Release or cancel emits [onRelease] exactly once
 *
 * @param modifier Modifier for the D-pad container
 * @param onDirection Called once when a direction button is pressed
 * @param onRelease Called once when the button is released or cancelled
 * @param buttonSize Minimum size of each direction button (must be >= 44dp)
 * @param buttonGap Gap between buttons
 * @param buttonColor Background color for direction buttons
 * @param textColor Color for direction labels
 */
@Composable
fun DPad(
    modifier: Modifier = Modifier,
    onDirection: (Direction) -> Unit,
    onRelease: () -> Unit,
    buttonSize: Dp = MIN_HITBOX_DP,
    buttonGap: Dp = 2.dp,
    buttonColor: Color = Color(0xFF1F2937),  // AkalynthColors.Surface
    textColor: Color = Color(0xFFE5E7EB)     // AkalynthColors.TextPrimary
) {
    Column(
        modifier = modifier.testTag("DPad"),
        verticalArrangement = Arrangement.spacedBy(buttonGap)
    ) {
        // Top row: NW, N, NE
        Row(horizontalArrangement = Arrangement.spacedBy(buttonGap)) {
            DPadButton(
                label = "↖",
                direction = Direction.NORTHWEST,
                minSize = buttonSize,
                backgroundColor = buttonColor,
                textColor = textColor,
                onDirection = onDirection,
                onRelease = onRelease
            )
            DPadButton(
                label = "↑",
                direction = Direction.NORTH,
                minSize = buttonSize,
                backgroundColor = buttonColor,
                textColor = textColor,
                onDirection = onDirection,
                onRelease = onRelease
            )
            DPadButton(
                label = "↗",
                direction = Direction.NORTHEAST,
                minSize = buttonSize,
                backgroundColor = buttonColor,
                textColor = textColor,
                onDirection = onDirection,
                onRelease = onRelease
            )
        }

        // Middle row: W, (dead center), E
        Row(horizontalArrangement = Arrangement.spacedBy(buttonGap)) {
            DPadButton(
                label = "←",
                direction = Direction.WEST,
                minSize = buttonSize,
                backgroundColor = buttonColor,
                textColor = textColor,
                onDirection = onDirection,
                onRelease = onRelease
            )
            // Dead center: no input capture
            Spacer(
                modifier = Modifier
                    .size(buttonSize)
                    .testTag("DPad_Center")
            )
            DPadButton(
                label = "→",
                direction = Direction.EAST,
                minSize = buttonSize,
                backgroundColor = buttonColor,
                textColor = textColor,
                onDirection = onDirection,
                onRelease = onRelease
            )
        }

        // Bottom row: SW, S, SE
        Row(horizontalArrangement = Arrangement.spacedBy(buttonGap)) {
            DPadButton(
                label = "↙",
                direction = Direction.SOUTHWEST,
                minSize = buttonSize,
                backgroundColor = buttonColor,
                textColor = textColor,
                onDirection = onDirection,
                onRelease = onRelease
            )
            DPadButton(
                label = "↓",
                direction = Direction.SOUTH,
                minSize = buttonSize,
                backgroundColor = buttonColor,
                textColor = textColor,
                onDirection = onDirection,
                onRelease = onRelease
            )
            DPadButton(
                label = "↘",
                direction = Direction.SOUTHEAST,
                minSize = buttonSize,
                backgroundColor = buttonColor,
                textColor = textColor,
                onDirection = onDirection,
                onRelease = onRelease
            )
        }
    }
}

/**
 * Individual D-pad button with awaitEachGesture for proper press/release.
 *
 * Gesture flow:
 * 1. awaitFirstDown -> onDirection(direction)
 * 2. waitForUpOrCancellation -> onRelease()
 *
 * This ensures:
 * - Press always emits exactly once
 * - Release/cancel always emits exactly once
 * - Balanced start/end callbacks (no stuck movement)
 */
@Composable
private fun DPadButton(
    label: String,
    direction: Direction,
    minSize: Dp,
    backgroundColor: Color,
    textColor: Color,
    onDirection: (Direction) -> Unit,
    onRelease: () -> Unit
) {
    val haptics = LocalHapticFeedback.current

    Box(
        modifier = Modifier
            .sizeIn(minWidth = minSize, minHeight = minSize)
            .size(minSize)
            .clip(RoundedCornerShape(8.dp))
            .background(backgroundColor)
            .pointerInput(direction) {
                awaitEachGesture {
                    awaitFirstDown(requireUnconsumed = false)
                    haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    onDirection(direction)
                    waitForUpOrCancellation()
                    onRelease()
                }
            }
            .semantics { contentDescription = "Move ${direction.name.lowercase()}" }
            .testTag("DPad_${direction.name}"),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            color = textColor,
            fontWeight = FontWeight.Bold,
            fontSize = 18.sp
        )
    }
}

/**
 * Minimum hitbox size per UI_REGRESSION_MATRIX.md.
 * Value: 44dp
 */
val MIN_HITBOX_DP = 44.dp

/**
 * Dead zone separation per UI_REGRESSION_MATRIX.md.
 * Value: 100dp minimum between D-pad and action panel.
 */
val DEAD_ZONE_DP = 100.dp
