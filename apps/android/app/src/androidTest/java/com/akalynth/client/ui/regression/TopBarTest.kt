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
    fun test_l1_stage_0_shows_hp_bar() {
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
    fun test_l1_stage_0_shows_chat_button() {
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
    fun test_l1_stage_0_hides_menu() {
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
    fun test_l1_stage_0_hides_why() {
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
    fun test_l1_stage_0_hides_rep_gold_nearby() {
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
    fun test_l2_stage_1_shows_menu() {
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
    fun test_l2_stage_1_still_hides_why() {
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
    fun test_l3_stage_2_shows_why() {
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
    fun test_l3_stage_2_still_hides_rep_gold_nearby() {
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
    fun test_l4_stage_3_shows_rep() {
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
    fun test_l4_stage_3_shows_gold() {
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
    fun test_l4_stage_3_shows_nearby_when_count_is_positive() {
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
    fun test_l4_stage_3_hides_nearby_when_count_is_0() {
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
    fun test_hp_bar_shows_correct_text() {
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
    fun test_hp_bar_handles_zero_max() {
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
    fun test_menu_button_fires_callback() {
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
    fun test_why_button_fires_callback() {
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
    fun test_chat_button_fires_callback() {
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
    fun test_nearby_chip_fires_callback() {
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
    fun test_menu_reserved_slot_exists_at_stage_0() {
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
    fun test_why_reserved_slot_exists_at_stage_0() {
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
    fun test_top_bar_height_is_56dp() {
        assertEquals(56.dp, TOP_BAR_HEIGHT)
    }

    @Test
    fun test_min_touch_target_is_44dp() {
        assertEquals(44.dp, MIN_TOUCH_TARGET)
    }

    @Test
    fun test_hp_bar_width_is_100dp() {
        assertEquals(100.dp, HP_BAR_WIDTH)
    }

    @Test
    fun test_hp_bar_height_is_20dp() {
        assertEquals(20.dp, HP_BAR_HEIGHT)
    }
}
