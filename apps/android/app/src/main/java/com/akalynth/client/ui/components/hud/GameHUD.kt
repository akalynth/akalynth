package com.akalynth.client.ui.components.hud

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
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

        // Menu: visible at stage >= 1
        if (stage >= 1) {
            menu?.invoke(
                Modifier
                    .testTag("GameHUD_Menu")
                    .constrainAs(menuRef) {
                        end.linkTo(chatRef.start, margin = 8.dp)
                        top.linkTo(parent.top, margin = 16.dp)
                    }
            )
        }

        // Hotbar: visible at stage >= 2
        if (stage >= 2) {
            hotbar?.invoke(
                Modifier
                    .testTag("GameHUD_Hotbar")
                    .constrainAs(hotbarRef) {
                        start.linkTo(parent.start)
                        end.linkTo(parent.end)
                        bottom.linkTo(dpadRef.top, margin = 16.dp)
                    }
            )

            // Why button: visible at stage >= 2
            why?.invoke(
                Modifier
                    .testTag("GameHUD_Why")
                    .constrainAs(whyRef) {
                        end.linkTo(parent.end, margin = 16.dp)
                        bottom.linkTo(actionsRef.top, margin = 8.dp)
                    }
            )
        }

        // Rep/Gold and Nearby: visible at stage >= 3
        if (stage >= 3) {
            repGold?.invoke(
                Modifier
                    .testTag("GameHUD_RepGold")
                    .constrainAs(repGoldRef) {
                        start.linkTo(healthRef.end, margin = 16.dp)
                        top.linkTo(parent.top, margin = 16.dp)
                    }
            )

            nearby?.invoke(
                Modifier
                    .testTag("GameHUD_Nearby")
                    .constrainAs(nearbyRef) {
                        start.linkTo(parent.start, margin = 16.dp)
                        top.linkTo(healthRef.bottom, margin = 8.dp)
                    }
            )
        }
    }
}

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
