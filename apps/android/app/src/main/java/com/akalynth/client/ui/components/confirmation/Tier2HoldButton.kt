package com.akalynth.client.ui.components.confirmation

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

/**
 * Tier 2 confirmation button requiring 1.5s hold to confirm.
 * Maps to UI_REGRESSION_MATRIX.md Section 3: D1-D2.
 *
 * Contract:
 * - Hold for [holdDurationMs] to trigger [onConfirm] exactly once
 * - Release before completion triggers [onCancel] exactly once and resets progress
 * - Once confirmed, release does NOT trigger cancel (confirmed latch)
 * - Progress is deterministic (driven by coroutine delay, not wall clock)
 *
 * @param label Accessibility label for the button
 * @param holdDurationMs Duration required to hold (default 1500ms per spec)
 * @param onConfirm Called exactly once when hold completes
 * @param onCancel Called exactly once when released before completion
 * @param modifier Modifier for the button
 * @param size Size of the circular button
 * @param progressColor Color of the progress ring
 * @param trackColor Color of the background ring
 * @param textColor Color of the HOLD/DONE text
 */
@Composable
fun Tier2HoldButton(
    label: String,
    holdDurationMs: Long = HOLD_DURATION_MS,
    onConfirm: () -> Unit,
    onCancel: () -> Unit = {},
    modifier: Modifier = Modifier,
    size: Dp = 80.dp,
    progressColor: Color = Color(0xFFE2B714), // AkalynthColors.Gold
    trackColor: Color = Color(0xFF0B1020),    // AkalynthColors.Background
    textColor: Color = Color(0xFFE5E7EB)      // AkalynthColors.TextPrimary
) {
    val haptics = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()

    // Progress animation (0f to 1f)
    val progress = remember { Animatable(0f) }

    // Confirmed latch: once true, release will NOT trigger cancel
    var confirmed by remember { mutableStateOf(false) }

    // Track the animation job so we can cancel it on release
    var animationJob by remember { mutableStateOf<Job?>(null) }

    Box(
        modifier = modifier
            .size(size)
            .background(Color(0xFF11182B), CircleShape) // AkalynthColors.Surface
            .semantics { contentDescription = label }
            .testTag("Tier2HoldButton")
            .pointerInput(Unit) {
                awaitEachGesture {
                    // Wait for press
                    awaitFirstDown(requireUnconsumed = false)

                    // Reset state for new gesture
                    confirmed = false

                    // Haptic feedback on press start
                    haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)

                    // Start progress animation
                    animationJob = scope.launch {
                        progress.snapTo(0f)
                        progress.animateTo(
                            targetValue = 1f,
                            animationSpec = tween(
                                durationMillis = holdDurationMs.toInt(),
                                easing = LinearEasing
                            )
                        )

                        // Animation completed = confirmed
                        if (progress.value >= 1f) {
                            confirmed = true
                            haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                            onConfirm()
                        }
                    }

                    // Wait for release or cancellation
                    val up = waitForUpOrCancellation()

                    // Cancel the animation job
                    animationJob?.cancel()
                    animationJob = null

                    // Handle release
                    if (!confirmed) {
                        // Released before completion - cancel
                        if (progress.value > 0f) {
                            onCancel()
                        }
                        // Reset progress
                        scope.launch {
                            progress.snapTo(0f)
                        }
                    }
                    // If confirmed, do nothing on release (no double-fire)
                }
            },
        contentAlignment = Alignment.Center
    ) {
        // Background ring (track)
        Canvas(
            modifier = Modifier
                .fillMaxSize()
                .padding(4.dp)
        ) {
            drawArc(
                color = trackColor,
                startAngle = 0f,
                sweepAngle = 360f,
                useCenter = false,
                style = Stroke(width = 4.dp.toPx())
            )
        }

        // Progress ring (fills as held)
        Canvas(
            modifier = Modifier
                .fillMaxSize()
                .padding(4.dp)
                .testTag("Tier2HoldButton_ProgressRing")
        ) {
            drawArc(
                color = progressColor,
                startAngle = -90f,
                sweepAngle = 360f * progress.value,
                useCenter = false,
                style = Stroke(width = 4.dp.toPx(), cap = StrokeCap.Round)
            )
        }

        // Text label
        Text(
            text = if (confirmed) "DONE" else "HOLD",
            color = textColor,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.testTag("Tier2HoldButton_Text")
        )
    }
}

/**
 * Canonical hold duration per UI_REGRESSION_MATRIX.md.
 * Tolerance: ±100ms
 */
const val HOLD_DURATION_MS = 1500L
