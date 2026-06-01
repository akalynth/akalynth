package com.akalynth.client.ui.regression

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import com.akalynth.client.ui.components.topbar.HP_BAR_HEIGHT
import com.akalynth.client.ui.components.topbar.HP_BAR_WIDTH
import com.akalynth.client.ui.components.topbar.MIN_TOUCH_TARGET
import com.akalynth.client.ui.components.topbar.TOP_BAR_HEIGHT
import com.akalynth.client.ui.components.topbar.TopBar
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

/**
 * Regression tests for TopBar component.
 *
 * Stage visibility:
 * - Stage 0: HP + Chat only
 * - Stage >= 1: Menu visible
 * - Stage >= 2: Why visible
 * - Stage >= 3: Rep + Gold + Nearby visible
 */
class TopBarTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    // =========================================================================
    // Stage 0: HP + Chat only
    // =========================================================================

    @Test
    fun `L1 - stage 0 shows HP bar`() {
        composeTestRule.setContent {
            TopBar(
                stage = 0,
                hp = 80,
                maxHp = 100
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("TopBar_HP").assertIsDisplayed()
    }

    @Test
    fun `L1 - stage 0 shows chat button`() {
        composeTestRule.setContent {
            TopBar(
                stage = 0,
                hp = 80,
                maxHp = 100
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("TopBar_Chat").assertIsDisplayed()
    }

    @Test
    fun `L1 - stage 0 hides menu`() {
        composeTestRule.setContent {
            TopBar(
                stage = 0,
                hp = 80,
                maxHp = 100
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("TopBar_Menu").assertDoesNotExist()
    }

    @Test
    fun `L1 - stage 0 hides why`() {
        composeTestRule.setContent {
            TopBar(
                stage = 0,
                hp = 80,
                maxHp = 100
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("TopBar_Why").assertDoesNotExist()
    }

    @Test
    fun `L1 - stage 0 hides rep gold nearby`() {
        composeTestRule.setContent {
            TopBar(
                stage = 0,
                hp = 80,
                maxHp = 100,
                gold = 1000,
                rep = 50,
                nearbyCount = 3
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("TopBar_Rep").assertDoesNotExist()
        composeTestRule.onNodeWithTag("TopBar_Gold").assertDoesNotExist()
        composeTestRule.onNodeWithTag("TopBar_Nearby").assertDoesNotExist()
    }

    // =========================================================================
    // Stage 1: Menu visible
    // =========================================================================

    @Test
    fun `L2 - stage 1 shows menu`() {
        composeTestRule.setContent {
            TopBar(
                stage = 1,
                hp = 80,
                maxHp = 100
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("TopBar_Menu").assertIsDisplayed()
    }

    @Test
    fun `L2 - stage 1 still hides why`() {
        composeTestRule.setContent {
            TopBar(
                stage = 1,
                hp = 80,
                maxHp = 100
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("TopBar_Why").assertDoesNotExist()
    }

    // =========================================================================
    // Stage 2: Why visible
    // =========================================================================

    @Test
    fun `L3 - stage 2 shows why`() {
        composeTestRule.setContent {
            TopBar(
                stage = 2,
                hp = 80,
                maxHp = 100
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("TopBar_Why").assertIsDisplayed()
    }

    @Test
    fun `L3 - stage 2 still hides rep gold nearby`() {
        composeTestRule.setContent {
            TopBar(
                stage = 2,
                hp = 80,
                maxHp = 100,
                gold = 1000,
                rep = 50,
                nearbyCount = 3
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("TopBar_Rep").assertDoesNotExist()
        composeTestRule.onNodeWithTag("TopBar_Gold").assertDoesNotExist()
        composeTestRule.onNodeWithTag("TopBar_Nearby").assertDoesNotExist()
    }

    // =========================================================================
    // Stage 3: Rep + Gold + Nearby visible
    // =========================================================================

    @Test
    fun `L4 - stage 3 shows rep`() {
        composeTestRule.setContent {
            TopBar(
                stage = 3,
                hp = 80,
                maxHp = 100,
                rep = 50
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("TopBar_Rep").assertIsDisplayed()
    }

    @Test
    fun `L4 - stage 3 shows gold`() {
        composeTestRule.setContent {
            TopBar(
                stage = 3,
                hp = 80,
                maxHp = 100,
                gold = 1000
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("TopBar_Gold").assertIsDisplayed()
    }

    @Test
    fun `L4 - stage 3 shows nearby when count is positive`() {
        composeTestRule.setContent {
            TopBar(
                stage = 3,
                hp = 80,
                maxHp = 100,
                nearbyCount = 5
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("TopBar_Nearby").assertIsDisplayed()
    }

    @Test
    fun `L4 - stage 3 hides nearby when count is 0`() {
        composeTestRule.setContent {
            TopBar(
                stage = 3,
                hp = 80,
                maxHp = 100,
                nearbyCount = 0
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("TopBar_Nearby").assertDoesNotExist()
    }

    // =========================================================================
    // HP display
    // =========================================================================

    @Test
    fun `HP bar shows correct text`() {
        composeTestRule.setContent {
            TopBar(
                stage = 0,
                hp = 75,
                maxHp = 100
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("TopBar_HP_Text").assertTextEquals("75/100")
    }

    @Test
    fun `HP bar handles zero max`() {
        composeTestRule.setContent {
            TopBar(
                stage = 0,
                hp = 0,
                maxHp = 0
            )
        }

        composeTestRule.waitForIdle()

        // Should not crash with division by zero
        composeTestRule.onNodeWithTag("TopBar_HP").assertIsDisplayed()
    }

    // =========================================================================
    // Button callbacks
    // =========================================================================

    @Test
    fun `menu button fires callback`() {
        var clicked = false

        composeTestRule.setContent {
            TopBar(
                stage = 1,
                hp = 80,
                maxHp = 100,
                onMenuClick = { clicked = true }
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("TopBar_Menu").performClick()

        assertTrue("Menu callback should fire", clicked)
    }

    @Test
    fun `why button fires callback`() {
        var clicked = false

        composeTestRule.setContent {
            TopBar(
                stage = 2,
                hp = 80,
                maxHp = 100,
                onWhyClick = { clicked = true }
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("TopBar_Why").performClick()

        assertTrue("Why callback should fire", clicked)
    }

    @Test
    fun `chat button fires callback`() {
        var clicked = false

        composeTestRule.setContent {
            TopBar(
                stage = 0,
                hp = 80,
                maxHp = 100,
                onChatClick = { clicked = true }
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("TopBar_Chat").performClick()

        assertTrue("Chat callback should fire", clicked)
    }

    @Test
    fun `nearby chip fires callback`() {
        var clicked = false

        composeTestRule.setContent {
            TopBar(
                stage = 3,
                hp = 80,
                maxHp = 100,
                nearbyCount = 3,
                onNearbyClick = { clicked = true }
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("TopBar_Nearby").performClick()

        assertTrue("Nearby callback should fire", clicked)
    }

    // =========================================================================
    // Reserved slots for layout stability
    // =========================================================================

    @Test
    fun `menu reserved slot exists at stage 0`() {
        composeTestRule.setContent {
            TopBar(
                stage = 0,
                hp = 80,
                maxHp = 100
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("TopBar_Menu_Reserved").assertExists()
    }

    @Test
    fun `why reserved slot exists at stage 0`() {
        composeTestRule.setContent {
            TopBar(
                stage = 0,
                hp = 80,
                maxHp = 100
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("TopBar_Why_Reserved").assertExists()
    }

    // =========================================================================
    // Constants validation
    // =========================================================================

    @Test
    fun `TOP_BAR_HEIGHT is 56dp`() {
        assertEquals(56.dp, TOP_BAR_HEIGHT)
    }

    @Test
    fun `MIN_TOUCH_TARGET is 44dp`() {
        assertEquals(44.dp, MIN_TOUCH_TARGET)
    }

    @Test
    fun `HP_BAR_WIDTH is 100dp`() {
        assertEquals(100.dp, HP_BAR_WIDTH)
    }

    @Test
    fun `HP_BAR_HEIGHT is 20dp`() {
        assertEquals(20.dp, HP_BAR_HEIGHT)
    }
}
