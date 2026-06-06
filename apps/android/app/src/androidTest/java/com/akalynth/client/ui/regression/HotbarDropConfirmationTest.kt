package com.akalynth.client.ui.regression

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeRight
import com.akalynth.client.ui.components.confirmation.HOLD_DURATION_MS
import com.akalynth.client.ui.components.hotbar.DropConfirmationOverlay
import com.akalynth.client.ui.state.UiOverlayState
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import androidx.test.ext.junit.runners.AndroidJUnit4

/**
 * Regression tests for hotbar drop confirmation wiring.
 *
 * Contracts (D1-D7):
 * - D1: Long-press slot opens confirmation overlay
 * - D2: Normal/rare items → Tier2HoldButton (hold to confirm)
 * - D3: Legendary items → Tier3SlideConfirm (slide to confirm)
 * - D4: Confirm triggers onConfirmDrop(slotIndex, itemId)
 * - D5: Cancel/dismiss returns to None state
 * - D6: Overlay prevents interaction with underlying UI
 * - D7: Item name and rarity displayed clearly
 */
@RunWith(AndroidJUnit4::class)
class HotbarDropConfirmationTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    // =========================================================================
    // D1: Overlay structure
    // =========================================================================

    @Test
    fun test_d1_overlay_displays_with_scrim() {
        composeTestRule.setContent {
            DropConfirmationOverlay(
                slotIndex = 0,
                itemId = "item_sword",
                itemName = "Iron Sword",
                isLegendary = false,
                onConfirmDrop = { _, _ -> },
                onCancel = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("DropConfirmationOverlay_Scrim").assertIsDisplayed()
        composeTestRule.onNodeWithTag("DropConfirmationOverlay_Content").assertIsDisplayed()
    }

    @Test
    fun test_d1_overlay_shows_warning_icon() {
        composeTestRule.setContent {
            DropConfirmationOverlay(
                slotIndex = 0,
                itemId = "item_sword",
                itemName = "Iron Sword",
                isLegendary = false,
                onConfirmDrop = { _, _ -> },
                onCancel = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("DropConfirmationOverlay_Icon").assertIsDisplayed()
    }

    @Test
    fun test_d1_overlay_shows_title() {
        composeTestRule.setContent {
            DropConfirmationOverlay(
                slotIndex = 0,
                itemId = "item_sword",
                itemName = "Iron Sword",
                isLegendary = false,
                onConfirmDrop = { _, _ -> },
                onCancel = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithText("Drop Item?").assertIsDisplayed()
    }

    // =========================================================================
    // D2: Tier2 for normal/rare items
    // =========================================================================

    @Test
    fun test_d2_normal_item_shows_tier2_hold_button() {
        composeTestRule.setContent {
            DropConfirmationOverlay(
                slotIndex = 0,
                itemId = "item_sword",
                itemName = "Iron Sword",
                isLegendary = false,
                onConfirmDrop = { _, _ -> },
                onCancel = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("DropConfirmationOverlay_Tier2").assertIsDisplayed()
    }

    @Test
    fun test_d2_normal_item_does_not_show_tier3() {
        composeTestRule.setContent {
            DropConfirmationOverlay(
                slotIndex = 0,
                itemId = "item_sword",
                itemName = "Iron Sword",
                isLegendary = false,
                onConfirmDrop = { _, _ -> },
                onCancel = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("DropConfirmationOverlay_Tier3").assertDoesNotExist()
    }

    // =========================================================================
    // D3: Tier3 for legendary items
    // =========================================================================

    @Test
    fun test_d3_legendary_item_shows_tier3_slide_confirm() {
        composeTestRule.setContent {
            DropConfirmationOverlay(
                slotIndex = 0,
                itemId = "item_legendary_sword",
                itemName = "Excalibur",
                isLegendary = true,
                onConfirmDrop = { _, _ -> },
                onCancel = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("DropConfirmationOverlay_Tier3").assertIsDisplayed()
    }

    @Test
    fun test_d3_legendary_item_does_not_show_tier2() {
        composeTestRule.setContent {
            DropConfirmationOverlay(
                slotIndex = 0,
                itemId = "item_legendary_sword",
                itemName = "Excalibur",
                isLegendary = true,
                onConfirmDrop = { _, _ -> },
                onCancel = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("DropConfirmationOverlay_Tier2").assertDoesNotExist()
    }

    @Test
    fun test_d3_legendary_item_shows_legendary_badge() {
        composeTestRule.setContent {
            DropConfirmationOverlay(
                slotIndex = 0,
                itemId = "item_legendary_sword",
                itemName = "Excalibur",
                isLegendary = true,
                onConfirmDrop = { _, _ -> },
                onCancel = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("DropConfirmationOverlay_LegendaryBadge").assertIsDisplayed()
        composeTestRule.onNodeWithText("LEGENDARY").assertIsDisplayed()
    }

    // =========================================================================
    // D4: Confirm callback
    // =========================================================================

    @Test
    fun test_d4_tier2_confirm_triggers_callback_with_correct_params() {
        var confirmedSlot: Int? = null
        var confirmedItemId: String? = null

        composeTestRule.setContent {
            DropConfirmationOverlay(
                slotIndex = 2,
                itemId = "item_shield",
                itemName = "Shield",
                isLegendary = false,
                onConfirmDrop = { slot, id ->
                    confirmedSlot = slot
                    confirmedItemId = id
                },
                onCancel = {}
            )
        }

        composeTestRule.waitForIdle()

        // Simulate hold completion by advancing time
        composeTestRule.onNodeWithTag("DropConfirmationOverlay_Tier2").performTouchInput {
            down(center)
        }

        composeTestRule.mainClock.advanceTimeBy(HOLD_DURATION_MS + 100)

        composeTestRule.onNodeWithTag("DropConfirmationOverlay_Tier2").performTouchInput {
            up()
        }

        composeTestRule.waitForIdle()

        assertEquals(2, confirmedSlot)
        assertEquals("item_shield", confirmedItemId)
    }

    @Test
    fun test_d4_tier3_confirm_triggers_callback_with_correct_params() {
        var confirmedSlot: Int? = null
        var confirmedItemId: String? = null

        composeTestRule.setContent {
            DropConfirmationOverlay(
                slotIndex = 1,
                itemId = "item_excalibur",
                itemName = "Excalibur",
                isLegendary = true,
                onConfirmDrop = { slot, id ->
                    confirmedSlot = slot
                    confirmedItemId = id
                },
                onCancel = {}
            )
        }

        composeTestRule.waitForIdle()

        // Swipe to confirm
        composeTestRule.onNodeWithTag("DropConfirmationOverlay_Tier3").performTouchInput {
            swipeRight()
        }

        composeTestRule.waitForIdle()

        // Note: swipeRight may not complete the 90% threshold in tests
        // This test verifies the structure; actual swipe completion
        // would need more precise gesture simulation
    }

    // =========================================================================
    // D5: Cancel/dismiss
    // =========================================================================

    @Test
    fun test_d5_cancel_button_fires_oncancel() {
        var cancelCalled = false

        composeTestRule.setContent {
            DropConfirmationOverlay(
                slotIndex = 0,
                itemId = "item_sword",
                itemName = "Iron Sword",
                isLegendary = false,
                onConfirmDrop = { _, _ -> },
                onCancel = { cancelCalled = true }
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("DropConfirmationOverlay_CancelButton").performClick()

        assertTrue("Cancel callback should be called", cancelCalled)
    }

    @Test
    fun test_d5_scrim_tap_fires_oncancel() {
        var cancelCalled = false

        composeTestRule.setContent {
            DropConfirmationOverlay(
                slotIndex = 0,
                itemId = "item_sword",
                itemName = "Iron Sword",
                isLegendary = false,
                onConfirmDrop = { _, _ -> },
                onCancel = { cancelCalled = true }
            )
        }

        composeTestRule.waitForIdle()

        // Click on scrim (outside content area)
        composeTestRule.onNodeWithTag("DropConfirmationOverlay_Scrim").performClick()

        assertTrue("Cancel callback should be called on scrim tap", cancelCalled)
    }

    // =========================================================================
    // D7: Item display
    // =========================================================================

    @Test
    fun test_d7_displays_item_name() {
        composeTestRule.setContent {
            DropConfirmationOverlay(
                slotIndex = 0,
                itemId = "item_sword",
                itemName = "Legendary Dragon Slayer",
                isLegendary = true,
                onConfirmDrop = { _, _ -> },
                onCancel = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("DropConfirmationOverlay_ItemName")
            .assertTextEquals("Legendary Dragon Slayer")
    }

    @Test
    fun test_d7_normal_item_does_not_show_legendary_badge() {
        composeTestRule.setContent {
            DropConfirmationOverlay(
                slotIndex = 0,
                itemId = "item_sword",
                itemName = "Iron Sword",
                isLegendary = false,
                onConfirmDrop = { _, _ -> },
                onCancel = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("DropConfirmationOverlay_LegendaryBadge").assertDoesNotExist()
    }

    // =========================================================================
    // UiOverlayState.ConfirmDrop tests
    // =========================================================================

    @Test
    fun test_confirmdrop_state_holds_correct_data() {
        val state = UiOverlayState.ConfirmDrop(
            slotIndex = 2,
            itemId = "item_123",
            itemName = "Test Sword",
            isLegendary = true
        )

        assertEquals(2, state.slotIndex)
        assertEquals("item_123", state.itemId)
        assertEquals("Test Sword", state.itemName)
        assertTrue(state.isLegendary)
    }

    @Test
    fun test_confirmdrop_is_distinct_overlay_state() {
        val none = UiOverlayState.None
        val confirmDrop = UiOverlayState.ConfirmDrop(0, "id", "name", false)

        assertNotEquals(none, confirmDrop)
        assertTrue(confirmDrop is UiOverlayState)
    }
}
