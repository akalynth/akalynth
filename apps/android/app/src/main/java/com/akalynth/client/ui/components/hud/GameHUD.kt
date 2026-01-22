package com.akalynth.client.ui.components.hud

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.constraintlayout.compose.ConstraintLayout
import com.akalynth.client.ui.components.movement.DEAD_ZONE_DP

/**
 * Game HUD with layout-enforced dead zone between D-pad and action panel.
 * Maps to UI_REGRESSION_MATRIX.md Section 1: M4 (Dead zone separation).
 *
 * Contract:
 * - M4: Minimum distance D-pad ↔ action >= 100dp in all layouts
 * - Dead zone enforced via explicit ConstraintLayout spacer barrier
 * - Works on small screens (360dp+) with deterministic layout
 *
 * The [deadZone] spacer is the enforcement mechanism:
 * - D-pad anchored to bottom-start
 * - Spacer fixed-width anchored to D-pad end
 * - Actions anchored to spacer end (guarantees >= deadZone separation)
 *
 * @param modifier Modifier for the HUD container
 * @param stage Current unlock stage (0-3) for progressive disclosure
 * @param deadZone Minimum separation between D-pad and actions (default 100dp)
 * @param dpad Composable slot for D-pad (receives positioning Modifier)
 * @param actions Composable slot for action panel (receives positioning Modifier)
 * @param healthBar Optional composable slot for HP bar
 * @param chatToggle Optional composable slot for chat toggle
 * @param menu Optional composable slot for menu button
 * @param hotbar Optional composable slot for hotbar
 * @param why Optional composable slot for "Why" button
 * @param repGold Optional composable slot for reputation/gold display
 * @param nearby Optional composable slot for nearby players
 */
@Composable
fun GameHUD(
    modifier: Modifier = Modifier,
    stage: Int = 0,
    deadZone: Dp = DEAD_ZONE_DP,
    dpad: @Composable (Modifier) -> Unit,
    actions: @Composable (Modifier) -> Unit,
    healthBar: @Composable ((Modifier) -> Unit)? = null,
    chatToggle: @Composable ((Modifier) -> Unit)? = null,
    menu: @Composable ((Modifier) -> Unit)? = null,
    hotbar: @Composable ((Modifier) -> Unit)? = null,
    why: @Composable ((Modifier) -> Unit)? = null,
    repGold: @Composable ((Modifier) -> Unit)? = null,
    nearby: @Composable ((Modifier) -> Unit)? = null
) {
    ConstraintLayout(
        modifier = modifier
            .fillMaxSize()
            .testTag("GameHUD")
    ) {
        val (dpadRef, spacerRef, actionsRef, healthRef, chatRef, menuRef, hotbarRef, whyRef, repGoldRef, nearbyRef) = createRefs()

        // D-pad: anchored to bottom-start
        dpad(
            Modifier.constrainAs(dpadRef) {
                start.linkTo(parent.start, margin = 16.dp)
                bottom.linkTo(parent.bottom, margin = 32.dp)
            }
        )

        // Dead-zone spacer: the enforcement mechanism
        // This guarantees >= deadZone separation between D-pad and actions
        Spacer(
            modifier = Modifier
                .width(deadZone)
                .testTag("GameHUD_DeadZone")
                .constrainAs(spacerRef) {
                    start.linkTo(dpadRef.end)
                    bottom.linkTo(dpadRef.bottom)
                }
        )

        // Actions: anchored to spacer end (guarantees >= deadZone from D-pad)
        actions(
            Modifier.constrainAs(actionsRef) {
                start.linkTo(spacerRef.end)
                end.linkTo(parent.end, margin = 16.dp)
                bottom.linkTo(parent.bottom, margin = 32.dp)
            }
        )

        // Health bar: always visible (all stages)
        healthBar?.invoke(
            Modifier
                .testTag("GameHUD_Health")
                .constrainAs(healthRef) {
                    start.linkTo(parent.start, margin = 16.dp)
                    top.linkTo(parent.top, margin = 16.dp)
                }
        )

        // Chat toggle: always visible (all stages)
        chatToggle?.invoke(
            Modifier
                .testTag("GameHUD_Chat")
                .constrainAs(chatRef) {
                    end.linkTo(parent.end, margin = 16.dp)
                    top.linkTo(parent.top, margin = 16.dp)
                }
        )

        // Menu: visible at stage >= 1 with animation
        // Reserved slot ensures layout stability
        Box(
            modifier = Modifier
                .constrainAs(menuRef) {
                    end.linkTo(chatRef.start, margin = 8.dp)
                    top.linkTo(parent.top, margin = 16.dp)
                }
        ) {
            // Reserved spacer for layout stability when menu hidden
            Spacer(
                modifier = Modifier
                    .size(MIN_TOUCH_TARGET)
                    .testTag("GameHUD_Menu_Reserved")
            )

            AnimatedVisibility(
                visible = stage >= 1 && menu != null,
                enter = fadeIn() + scaleIn(initialScale = 0.8f),
                exit = fadeOut() + scaleOut(targetScale = 0.8f)
            ) {
                menu?.invoke(Modifier.testTag("GameHUD_Menu"))
            }
        }

        // Hotbar: visible at stage >= 2 with slide animation
        Box(
            modifier = Modifier
                .constrainAs(hotbarRef) {
                    start.linkTo(parent.start)
                    end.linkTo(parent.end)
                    bottom.linkTo(dpadRef.top, margin = 16.dp)
                }
        ) {
            AnimatedVisibility(
                visible = stage >= 2 && hotbar != null,
                enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
                exit = slideOutVertically(targetOffsetY = { it }) + fadeOut()
            ) {
                hotbar?.invoke(Modifier.testTag("GameHUD_Hotbar"))
            }
        }

        // Why button: visible at stage >= 2 with animation
        Box(
            modifier = Modifier
                .constrainAs(whyRef) {
                    end.linkTo(parent.end, margin = 16.dp)
                    bottom.linkTo(actionsRef.top, margin = 8.dp)
                }
        ) {
            // Reserved spacer for layout stability
            Spacer(
                modifier = Modifier
                    .size(MIN_TOUCH_TARGET)
                    .testTag("GameHUD_Why_Reserved")
            )

            AnimatedVisibility(
                visible = stage >= 2 && why != null,
                enter = fadeIn() + scaleIn(initialScale = 0.8f),
                exit = fadeOut() + scaleOut(targetScale = 0.8f)
            ) {
                why?.invoke(Modifier.testTag("GameHUD_Why"))
            }
        }

        // Rep/Gold: visible at stage >= 3 with animation
        Box(
            modifier = Modifier
                .constrainAs(repGoldRef) {
                    start.linkTo(healthRef.end, margin = 16.dp)
                    top.linkTo(parent.top, margin = 16.dp)
                }
        ) {
            AnimatedVisibility(
                visible = stage >= 3 && repGold != null,
                enter = fadeIn() + scaleIn(initialScale = 0.9f),
                exit = fadeOut() + scaleOut(targetScale = 0.9f)
            ) {
                repGold?.invoke(Modifier.testTag("GameHUD_RepGold"))
            }
        }

        // Nearby: visible at stage >= 3 with animation
        Box(
            modifier = Modifier
                .constrainAs(nearbyRef) {
                    start.linkTo(parent.start, margin = 16.dp)
                    top.linkTo(healthRef.bottom, margin = 8.dp)
                }
        ) {
            AnimatedVisibility(
                visible = stage >= 3 && nearby != null,
                enter = fadeIn() + scaleIn(initialScale = 0.9f),
                exit = fadeOut() + scaleOut(targetScale = 0.9f)
            ) {
                nearby?.invoke(Modifier.testTag("GameHUD_Nearby"))
            }
        }
    }
}

/**
 * Minimum touch target size per accessibility guidelines.
 */
val MIN_TOUCH_TARGET = 44.dp

/**
 * Simplified GameHUD for tests that only need D-pad and actions with dead zone.
 * Matches the skeleton provided in PR D spec.
 */
@Composable
fun GameHUDSimple(
    modifier: Modifier = Modifier,
    deadZone: Dp = DEAD_ZONE_DP,
    dpad: @Composable (Modifier) -> Unit,
    actions: @Composable (Modifier) -> Unit
) {
    ConstraintLayout(
        modifier = modifier
            .fillMaxSize()
            .testTag("GameHUD")
    ) {
        val (dpadRef, spacerRef, actionsRef) = createRefs()

        dpad(
            Modifier.constrainAs(dpadRef) {
                start.linkTo(parent.start, margin = 16.dp)
                bottom.linkTo(parent.bottom, margin = 32.dp)
            }
        )

        // The dead-zone spacer is the enforcement mechanism.
        Spacer(
            modifier = Modifier
                .width(deadZone)
                .testTag("GameHUD_DeadZone")
                .constrainAs(spacerRef) {
                    start.linkTo(dpadRef.end)
                    bottom.linkTo(dpadRef.bottom)
                }
        )

        actions(
            Modifier.constrainAs(actionsRef) {
                start.linkTo(spacerRef.end)     // guarantees >= deadZone separation
                end.linkTo(parent.end, margin = 16.dp)
                bottom.linkTo(parent.bottom, margin = 32.dp)
            }
        )
    }
}
