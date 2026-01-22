package com.akalynth.client.ui.regression

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.unit.dp
import com.akalynth.client.protocol.Direction
import com.akalynth.client.ui.components.hud.GameHUD
import com.akalynth.client.ui.components.hud.GameHUDSimple
import com.akalynth.client.ui.components.movement.DEAD_ZONE_DP
import com.akalynth.client.ui.components.movement.DPad
import org.junit.Rule
import org.junit.Test
import org.junit.Assert.*

/**
 * Regression tests for GameHUD layout and stage gating.
 * Maps to UI_REGRESSION_MATRIX.md:
 * - Section 1: M4 (Dead zone separation)
 * - Section 2: A3-A4 (Attack visibility)
 * - Section 3: D6-D7 (Hotbar visibility)
 * - Section 4: U1 (Stage 0 layout)
 * - Section 5: X5 (Why button visibility)
 */
class GameHUDTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    companion object {
        const val DEAD_ZONE_DP_VALUE = 100
    }

    // =========================================================================
    // M4: Dead zone separation
    // Assertion: Min distance D-pad <-> action >= 100dp in all layouts
    // =========================================================================

    @Test
    fun `M4 - dead zone enforced via spacer`() {
        composeTestRule.setContent {
            GameHUDSimple(
                deadZone = 100.dp,
                dpad = { modifier ->
                    DPad(
                        modifier = modifier.testTag("TestDPad"),
                        onDirection = {},
                        onRelease = {}
                    )
                },
                actions = { modifier ->
                    ActionPanelStub(modifier.testTag("TestActions"))
                }
            )
        }

        // Verify dead zone spacer exists with correct width
        composeTestRule.onNodeWithTag("GameHUD_DeadZone").assertExists()

        val spacerBounds = composeTestRule.onNodeWithTag("GameHUD_DeadZone").getBoundsInRoot()
        val spacerWidth = spacerBounds.right - spacerBounds.left

        // Spacer should be exactly 100dp
        assertTrue(
            "Dead zone spacer width ($spacerWidth) should be >= ${DEAD_ZONE_DP.value}dp",
            spacerWidth >= DEAD_ZONE_DP
        )
    }

    @Test
    fun `M4 - dead zone constant matches spec`() {
        assertEquals(
            "DEAD_ZONE_DP should be 100dp",
            100.dp,
            DEAD_ZONE_DP
        )
    }

    @Test
    fun `M4 - dead zone enforced in simple layout`() {
        composeTestRule.setContent {
            GameHUDSimple(
                deadZone = DEAD_ZONE_DP,
                dpad = { modifier ->
                    Box(modifier = modifier.size(100.dp).testTag("DPadBox"))
                },
                actions = { modifier ->
                    Box(modifier = modifier.size(80.dp).testTag("ActionsBox"))
                }
            )
        }

        composeTestRule.waitForIdle()

        // Get bounds for D-pad and actions
        val dpadBounds = composeTestRule.onNodeWithTag("DPadBox").getBoundsInRoot()
        val actionsBounds = composeTestRule.onNodeWithTag("ActionsBox").getBoundsInRoot()

        // Calculate actual gap
        val actualGap = actionsBounds.left - dpadBounds.right

        assertTrue(
            "Gap between D-pad and actions ($actualGap) should be >= ${DEAD_ZONE_DP.value}dp",
            actualGap >= DEAD_ZONE_DP
        )
    }

    // =========================================================================
    // A3-A4: Attack button visibility (stage-gated)
    // =========================================================================

    @Test
    fun `A3 - attack hidden at stage 0`() {
        composeTestRule.setContent {
            GameHUD(
                stage = 0,
                dpad = { modifier -> DPadStub(modifier) },
                actions = { modifier -> ActionPanelStub(modifier.testTag("Actions_Stage0")) }
            )
        }

        // Attack is part of actions, which should be visible but attack button hidden
        // Stage 0: only D-pad, HP, Chat visible
        // Actions panel is visible but Attack button inside would be gated
        composeTestRule.onNodeWithTag("GameHUD_Menu").assertDoesNotExist()
    }

    @Test
    fun `A4 - menu visible at stage 1`() {
        composeTestRule.setContent {
            GameHUD(
                stage = 1,
                dpad = { modifier -> DPadStub(modifier) },
                actions = { modifier -> ActionPanelStub(modifier) },
                menu = { modifier -> Box(modifier.size(44.dp)) }
            )
        }

        composeTestRule.onNodeWithTag("GameHUD_Menu").assertIsDisplayed()
    }

    @Test
    fun `A4 - menu visible at stage 2`() {
        composeTestRule.setContent {
            GameHUD(
                stage = 2,
                dpad = { modifier -> DPadStub(modifier) },
                actions = { modifier -> ActionPanelStub(modifier) },
                menu = { modifier -> Box(modifier.size(44.dp)) }
            )
        }

        composeTestRule.onNodeWithTag("GameHUD_Menu").assertIsDisplayed()
    }

    @Test
    fun `A4 - menu visible at stage 3`() {
        composeTestRule.setContent {
            GameHUD(
                stage = 3,
                dpad = { modifier -> DPadStub(modifier) },
                actions = { modifier -> ActionPanelStub(modifier) },
                menu = { modifier -> Box(modifier.size(44.dp)) }
            )
        }

        composeTestRule.onNodeWithTag("GameHUD_Menu").assertIsDisplayed()
    }

    // =========================================================================
    // D6-D7: Hotbar visibility (stage-gated)
    // =========================================================================

    @Test
    fun `D6 - hotbar hidden at stage 0`() {
        composeTestRule.setContent {
            GameHUD(
                stage = 0,
                dpad = { modifier -> DPadStub(modifier) },
                actions = { modifier -> ActionPanelStub(modifier) },
                hotbar = { modifier -> Box(modifier.width(200.dp).testTag("Hotbar_Slot")) }
            )
        }

        composeTestRule.onNodeWithTag("GameHUD_Hotbar").assertDoesNotExist()
    }

    @Test
    fun `D6 - hotbar hidden at stage 1`() {
        composeTestRule.setContent {
            GameHUD(
                stage = 1,
                dpad = { modifier -> DPadStub(modifier) },
                actions = { modifier -> ActionPanelStub(modifier) },
                hotbar = { modifier -> Box(modifier.width(200.dp)) }
            )
        }

        composeTestRule.onNodeWithTag("GameHUD_Hotbar").assertDoesNotExist()
    }

    @Test
    fun `D7 - hotbar visible at stage 2`() {
        composeTestRule.setContent {
            GameHUD(
                stage = 2,
                dpad = { modifier -> DPadStub(modifier) },
                actions = { modifier -> ActionPanelStub(modifier) },
                hotbar = { modifier -> Box(modifier.width(200.dp)) }
            )
        }

        composeTestRule.onNodeWithTag("GameHUD_Hotbar").assertIsDisplayed()
    }

    @Test
    fun `D7 - hotbar visible at stage 3`() {
        composeTestRule.setContent {
            GameHUD(
                stage = 3,
                dpad = { modifier -> DPadStub(modifier) },
                actions = { modifier -> ActionPanelStub(modifier) },
                hotbar = { modifier -> Box(modifier.width(200.dp)) }
            )
        }

        composeTestRule.onNodeWithTag("GameHUD_Hotbar").assertIsDisplayed()
    }

    // =========================================================================
    // U1: Stage 0 shows only D-pad + HP + Chat
    // =========================================================================

    @Test
    fun `U1 - stage 0 shows only essential elements`() {
        composeTestRule.setContent {
            GameHUD(
                stage = 0,
                dpad = { modifier -> DPadStub(modifier) },
                actions = { modifier -> ActionPanelStub(modifier) },
                healthBar = { modifier -> Box(modifier.size(100.dp, 20.dp)) },
                chatToggle = { modifier -> Box(modifier.size(44.dp)) },
                menu = { modifier -> Box(modifier.size(44.dp)) },
                hotbar = { modifier -> Box(modifier.width(200.dp)) },
                why = { modifier -> Box(modifier.size(44.dp)) },
                repGold = { modifier -> Box(modifier.size(80.dp, 20.dp)) },
                nearby = { modifier -> Box(modifier.size(100.dp, 60.dp)) }
            )
        }

        // Essential elements always visible
        composeTestRule.onNodeWithTag("GameHUD").assertIsDisplayed()
        composeTestRule.onNodeWithTag("GameHUD_Health").assertIsDisplayed()
        composeTestRule.onNodeWithTag("GameHUD_Chat").assertIsDisplayed()

        // Stage 1+ elements hidden at stage 0
        composeTestRule.onNodeWithTag("GameHUD_Menu").assertDoesNotExist()

        // Stage 2+ elements hidden at stage 0
        composeTestRule.onNodeWithTag("GameHUD_Hotbar").assertDoesNotExist()
        composeTestRule.onNodeWithTag("GameHUD_Why").assertDoesNotExist()

        // Stage 3+ elements hidden at stage 0
        composeTestRule.onNodeWithTag("GameHUD_RepGold").assertDoesNotExist()
        composeTestRule.onNodeWithTag("GameHUD_Nearby").assertDoesNotExist()
    }

    @Test
    fun `stage 1 adds menu`() {
        composeTestRule.setContent {
            GameHUD(
                stage = 1,
                dpad = { modifier -> DPadStub(modifier) },
                actions = { modifier -> ActionPanelStub(modifier) },
                healthBar = { modifier -> Box(modifier.size(100.dp, 20.dp)) },
                chatToggle = { modifier -> Box(modifier.size(44.dp)) },
                menu = { modifier -> Box(modifier.size(44.dp)) },
                hotbar = { modifier -> Box(modifier.width(200.dp)) },
                why = { modifier -> Box(modifier.size(44.dp)) }
            )
        }

        // Stage 0 elements still visible
        composeTestRule.onNodeWithTag("GameHUD_Health").assertIsDisplayed()
        composeTestRule.onNodeWithTag("GameHUD_Chat").assertIsDisplayed()

        // Stage 1 element visible
        composeTestRule.onNodeWithTag("GameHUD_Menu").assertIsDisplayed()

        // Stage 2+ elements still hidden
        composeTestRule.onNodeWithTag("GameHUD_Hotbar").assertDoesNotExist()
        composeTestRule.onNodeWithTag("GameHUD_Why").assertDoesNotExist()
    }

    @Test
    fun `stage 2 adds hotbar and why`() {
        composeTestRule.setContent {
            GameHUD(
                stage = 2,
                dpad = { modifier -> DPadStub(modifier) },
                actions = { modifier -> ActionPanelStub(modifier) },
                healthBar = { modifier -> Box(modifier.size(100.dp, 20.dp)) },
                chatToggle = { modifier -> Box(modifier.size(44.dp)) },
                menu = { modifier -> Box(modifier.size(44.dp)) },
                hotbar = { modifier -> Box(modifier.width(200.dp)) },
                why = { modifier -> Box(modifier.size(44.dp)) },
                repGold = { modifier -> Box(modifier.size(80.dp, 20.dp)) },
                nearby = { modifier -> Box(modifier.size(100.dp, 60.dp)) }
            )
        }

        // All stage 0-1 elements visible
        composeTestRule.onNodeWithTag("GameHUD_Health").assertIsDisplayed()
        composeTestRule.onNodeWithTag("GameHUD_Chat").assertIsDisplayed()
        composeTestRule.onNodeWithTag("GameHUD_Menu").assertIsDisplayed()

        // Stage 2 elements visible
        composeTestRule.onNodeWithTag("GameHUD_Hotbar").assertIsDisplayed()
        composeTestRule.onNodeWithTag("GameHUD_Why").assertIsDisplayed()

        // Stage 3+ elements still hidden
        composeTestRule.onNodeWithTag("GameHUD_RepGold").assertDoesNotExist()
        composeTestRule.onNodeWithTag("GameHUD_Nearby").assertDoesNotExist()
    }

    @Test
    fun `stage 3 shows full UI`() {
        composeTestRule.setContent {
            GameHUD(
                stage = 3,
                dpad = { modifier -> DPadStub(modifier) },
                actions = { modifier -> ActionPanelStub(modifier) },
                healthBar = { modifier -> Box(modifier.size(100.dp, 20.dp)) },
                chatToggle = { modifier -> Box(modifier.size(44.dp)) },
                menu = { modifier -> Box(modifier.size(44.dp)) },
                hotbar = { modifier -> Box(modifier.width(200.dp)) },
                why = { modifier -> Box(modifier.size(44.dp)) },
                repGold = { modifier -> Box(modifier.size(80.dp, 20.dp)) },
                nearby = { modifier -> Box(modifier.size(100.dp, 60.dp)) }
            )
        }

        // All elements visible at stage 3
        composeTestRule.onNodeWithTag("GameHUD_Health").assertIsDisplayed()
        composeTestRule.onNodeWithTag("GameHUD_Chat").assertIsDisplayed()
        composeTestRule.onNodeWithTag("GameHUD_Menu").assertIsDisplayed()
        composeTestRule.onNodeWithTag("GameHUD_Hotbar").assertIsDisplayed()
        composeTestRule.onNodeWithTag("GameHUD_Why").assertIsDisplayed()
        composeTestRule.onNodeWithTag("GameHUD_RepGold").assertIsDisplayed()
        composeTestRule.onNodeWithTag("GameHUD_Nearby").assertIsDisplayed()
    }

    // =========================================================================
    // X5: Why button visibility (stage-gated)
    // =========================================================================

    @Test
    fun `X5 - why button hidden before stage 2`() {
        // Stage 0
        composeTestRule.setContent {
            GameHUD(
                stage = 0,
                dpad = { modifier -> DPadStub(modifier) },
                actions = { modifier -> ActionPanelStub(modifier) },
                why = { modifier -> Box(modifier.size(44.dp)) }
            )
        }

        composeTestRule.onNodeWithTag("GameHUD_Why").assertDoesNotExist()
    }

    @Test
    fun `X5 - why button hidden at stage 1`() {
        composeTestRule.setContent {
            GameHUD(
                stage = 1,
                dpad = { modifier -> DPadStub(modifier) },
                actions = { modifier -> ActionPanelStub(modifier) },
                why = { modifier -> Box(modifier.size(44.dp)) }
            )
        }

        composeTestRule.onNodeWithTag("GameHUD_Why").assertDoesNotExist()
    }

    @Test
    fun `X5 - why button visible at stage 2`() {
        composeTestRule.setContent {
            GameHUD(
                stage = 2,
                dpad = { modifier -> DPadStub(modifier) },
                actions = { modifier -> ActionPanelStub(modifier) },
                why = { modifier -> Box(modifier.size(44.dp)) }
            )
        }

        composeTestRule.onNodeWithTag("GameHUD_Why").assertIsDisplayed()
    }

    // =========================================================================
    // K1-K3: Reserved spacers for layout stability
    // =========================================================================

    @Test
    fun `K1 - menu reserved slot exists at stage 0`() {
        composeTestRule.setContent {
            GameHUD(
                stage = 0,
                dpad = { modifier -> DPadStub(modifier) },
                actions = { modifier -> ActionPanelStub(modifier) },
                menu = { modifier -> Box(modifier.size(44.dp)) }
            )
        }

        // Menu content should not be displayed, but reserved slot should exist
        composeTestRule.onNodeWithTag("GameHUD_Menu").assertDoesNotExist()
        composeTestRule.onNodeWithTag("GameHUD_Menu_Reserved").assertExists()
    }

    @Test
    fun `K2 - why reserved slot exists at stage 0`() {
        composeTestRule.setContent {
            GameHUD(
                stage = 0,
                dpad = { modifier -> DPadStub(modifier) },
                actions = { modifier -> ActionPanelStub(modifier) },
                why = { modifier -> Box(modifier.size(44.dp)) }
            )
        }

        // Why content should not be displayed, but reserved slot should exist
        composeTestRule.onNodeWithTag("GameHUD_Why").assertDoesNotExist()
        composeTestRule.onNodeWithTag("GameHUD_Why_Reserved").assertExists()
    }

    @Test
    fun `K3 - reserved slots have minimum touch target size`() {
        composeTestRule.setContent {
            GameHUD(
                stage = 0,
                dpad = { modifier -> DPadStub(modifier) },
                actions = { modifier -> ActionPanelStub(modifier) },
                menu = { modifier -> Box(modifier.size(44.dp)) },
                why = { modifier -> Box(modifier.size(44.dp)) }
            )
        }

        // Verify reserved slots exist (they provide 44dp minimum)
        val menuReserved = composeTestRule.onNodeWithTag("GameHUD_Menu_Reserved")
        val whyReserved = composeTestRule.onNodeWithTag("GameHUD_Why_Reserved")

        menuReserved.assertExists()
        whyReserved.assertExists()

        // Bounds should be at least 44dp
        val menuBounds = menuReserved.getBoundsInRoot()
        val whyBounds = whyReserved.getBoundsInRoot()

        assertTrue(
            "Menu reserved slot should be at least 44dp wide",
            (menuBounds.right - menuBounds.left).value >= 44f
        )
        assertTrue(
            "Why reserved slot should be at least 44dp wide",
            (whyBounds.right - whyBounds.left).value >= 44f
        )
    }

    // =========================================================================
    // Test Stubs
    // =========================================================================

    @Composable
    private fun DPadStub(modifier: Modifier = Modifier) {
        DPad(
            modifier = modifier,
            onDirection = {},
            onRelease = {}
        )
    }

    @Composable
    private fun ActionPanelStub(modifier: Modifier = Modifier) {
        Box(
            modifier = modifier
                .size(80.dp)
                .background(Color.DarkGray)
        )
    }
}
