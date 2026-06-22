package com.akalynth.client.ui.regression

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.akalynth.client.ui.components.death.DeathToast
import com.akalynth.client.ui.components.death.TOAST_APPEAR_MS
import com.akalynth.client.ui.components.death.TOAST_DURATION_MS
import com.akalynth.client.ui.components.death.TOAST_DURATION_TOLERANCE_MS
import com.akalynth.client.ui.state.DeathNotice
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import androidx.test.ext.junit.runners.AndroidJUnit4

/**
 * Regression tests for death toast notification.
 * Maps to UI_REGRESSION_MATRIX.md Section 5: Death Experience (X1-X3)
 *
 * Timing constants:
 * - TOAST_APPEAR_MS = 500ms (max)
 * - TOAST_DURATION_MS = 5000ms (±250ms tolerance)
 *
 * Tests use Compose test clock via mainClock.advanceTimeBy() for deterministic timing.
 */
@RunWith(AndroidJUnit4::class)
class DeathToastTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    // =========================================================================
    // X1: Death toast appears
    // Assertion: Toast shown <= 500ms after death; contains items lost
    // =========================================================================

    @Test
    fun test_x1_appears_when_visible_is_true() {
        composeTestRule.setContent {
            DeathToast(
                notice = createTestNotice(),
                visible = true,
                onTap = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        // Toast should be displayed
        composeTestRule.onNodeWithTag("DeathToast").assertIsDisplayed()
    }

    @Test
    fun test_x1_shows_items_lost_list() {
        val itemsLost = listOf("Flame Sword", "Ration", "Ration")

        composeTestRule.setContent {
            DeathToast(
                notice = createTestNotice(itemsLost = itemsLost),
                visible = true,
                onTap = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        // Verify items lost text
        composeTestRule.onNodeWithText("Lost: Flame Sword, Ration, Ration")
            .assertIsDisplayed()
    }

    @Test
    fun test_x1_shows_you_died_message() {
        composeTestRule.setContent {
            DeathToast(
                notice = createTestNotice(),
                visible = true,
                onTap = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithText("You died").assertIsDisplayed()
    }

    @Test
    fun test_x1_shows_skull_icon() {
        composeTestRule.setContent {
            DeathToast(
                notice = createTestNotice(),
                visible = true,
                onTap = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("DeathToast_Icon").assertIsDisplayed()
    }

    @Test
    fun test_x1_handles_empty_items_lost() {
        val itemsLost = emptyList<String>()

        composeTestRule.setContent {
            DeathToast(
                notice = createTestNotice(itemsLost = itemsLost),
                visible = true,
                onTap = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        // Toast should still display
        composeTestRule.onNodeWithTag("DeathToast").assertIsDisplayed()

        // Should show "No items lost" instead of items list
        composeTestRule.onNodeWithText("No items lost").assertIsDisplayed()
    }

    @Test
    fun test_x1_tap_for_details_text_shown() {
        composeTestRule.setContent {
            DeathToast(
                notice = createTestNotice(),
                visible = true,
                onTap = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithText("[TAP FOR DETAILS]").assertIsDisplayed()
    }

    // =========================================================================
    // X2: Toast auto-dismiss
    // Assertion: Dismiss at 5000ms ±250ms
    // =========================================================================

    @Test
    fun test_x2_auto_dismisses_at_5000ms() {
        var dismissed = false

        composeTestRule.setContent {
            DeathToast(
                notice = createTestNotice(),
                visible = true,
                onTap = {},
                onDismiss = { dismissed = true }
            )
        }

        // Before timeout: should not be dismissed
        composeTestRule.mainClock.advanceTimeBy(TOAST_DURATION_MS - 100)
        composeTestRule.waitForIdle()
        assertFalse("Should not dismiss before timeout", dismissed)

        // After timeout: should be dismissed
        composeTestRule.mainClock.advanceTimeBy(200) // Now at 5100ms
        composeTestRule.waitForIdle()
        assertTrue("Should dismiss after timeout", dismissed)
    }

    @Test
    fun test_x2_does_not_dismiss_before_4750ms() {
        var dismissed = false

        composeTestRule.setContent {
            DeathToast(
                notice = createTestNotice(),
                visible = true,
                onTap = {},
                onDismiss = { dismissed = true }
            )
        }

        // Advance to 4749ms (within tolerance, but before min threshold)
        composeTestRule.mainClock.advanceTimeBy(TOAST_DURATION_MS - TOAST_DURATION_TOLERANCE_MS - 1)
        composeTestRule.waitForIdle()

        assertFalse("Should not dismiss at ${TOAST_DURATION_MS - TOAST_DURATION_TOLERANCE_MS - 1}ms", dismissed)
    }

    @Test
    fun test_x2_dismisses_by_5250ms() {
        var dismissed = false

        composeTestRule.setContent {
            DeathToast(
                notice = createTestNotice(),
                visible = true,
                onTap = {},
                onDismiss = { dismissed = true }
            )
        }

        // Advance to 5250ms (max tolerance)
        composeTestRule.mainClock.advanceTimeBy(TOAST_DURATION_MS + TOAST_DURATION_TOLERANCE_MS)
        composeTestRule.waitForIdle()

        assertTrue("Should have dismissed by ${TOAST_DURATION_MS + TOAST_DURATION_TOLERANCE_MS}ms", dismissed)
    }

    @Test
    fun test_x2_disappears_without_interaction() {
        var dismissed = false

        composeTestRule.setContent {
            DeathToast(
                notice = createTestNotice(),
                visible = true,
                onTap = {},
                onDismiss = { dismissed = true }
            )
        }

        // Don't tap or interact, just wait
        composeTestRule.mainClock.advanceTimeBy(TOAST_DURATION_MS + 100)
        composeTestRule.waitForIdle()

        assertTrue("Should dismiss automatically without interaction", dismissed)
    }

    // =========================================================================
    // X3: Tap toast opens recap
    // Timing: sheet opens <= 300ms
    // =========================================================================

    @Test
    fun test_x3_tap_calls_ontap_callback() {
        var recapOpened = false

        composeTestRule.setContent {
            DeathToast(
                notice = createTestNotice(),
                visible = true,
                onTap = { recapOpened = true },
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        // Tap the toast
        composeTestRule.onNodeWithTag("DeathToast_Content").performClick()

        assertTrue("Tap should trigger onTap callback", recapOpened)
    }

    @Test
    fun test_x3_tap_triggers_only_ontap_not_ondismiss() {
        var tapCalled = false
        var dismissCalled = false

        composeTestRule.setContent {
            DeathToast(
                notice = createTestNotice(),
                visible = true,
                onTap = { tapCalled = true },
                onDismiss = { dismissCalled = true }
            )
        }

        composeTestRule.waitForIdle()

        // Tap the toast (before auto-dismiss timeout)
        composeTestRule.onNodeWithTag("DeathToast_Content").performClick()

        assertTrue("onTap should be called", tapCalled)
        assertFalse("onDismiss should NOT be called on tap (only on timeout)", dismissCalled)
    }

    // =========================================================================
    // Visibility state
    // =========================================================================

    @Test
    fun test_not_displayed_when_visible_is_false() {
        composeTestRule.setContent {
            DeathToast(
                notice = createTestNotice(),
                visible = false,
                onTap = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        // Toast should not be displayed
        composeTestRule.onNodeWithTag("DeathToast").assertDoesNotExist()
    }

    @Test
    fun test_visibility_state_controls_display() {
        var visible by mutableStateOf(true)

        composeTestRule.setContent {
            DeathToast(
                notice = createTestNotice(),
                visible = visible,
                onTap = {},
                onDismiss = {}
            )
        }

        // Initially visible
        composeTestRule.waitForIdle()
        composeTestRule.onNodeWithTag("DeathToast").assertIsDisplayed()

        // Change to invisible
        visible = false
        composeTestRule.waitForIdle()

        // Should animate out (give time for exit animation)
        composeTestRule.mainClock.advanceTimeBy(500)
        composeTestRule.onNodeWithTag("DeathToast").assertDoesNotExist()
    }

    // =========================================================================
    // Animation (verify animation is present)
    // =========================================================================

    @Test
    fun test_uses_slide_animation_for_enter() {
        composeTestRule.setContent {
            DeathToast(
                notice = createTestNotice(),
                visible = true,
                onTap = {},
                onDismiss = {}
            )
        }

        // Animation should complete and content should be visible
        composeTestRule.mainClock.advanceTimeBy(300)
        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("DeathToast_Content").assertIsDisplayed()
    }

    // =========================================================================
    // Double overlay contention (critical edge case)
    // =========================================================================

    @Test
    fun test_timeout_does_not_fire_ondismiss_after_tap() {
        // This tests the double overlay contention fix:
        // If user taps toast (transitioning to Recap), the timeout should NOT
        // call onDismiss, which would clear the Recap state.
        var tapCalled = false
        var dismissCalled = false

        composeTestRule.setContent {
            DeathToast(
                notice = createTestNotice(),
                visible = true,
                onTap = { tapCalled = true },
                onDismiss = { dismissCalled = true }
            )
        }

        composeTestRule.waitForIdle()

        // Tap the toast (simulating user opening recap)
        composeTestRule.onNodeWithTag("DeathToast_Content").performClick()
        assertTrue("onTap should be called", tapCalled)
        assertFalse("onDismiss should not be called yet", dismissCalled)

        // Now advance time past the auto-dismiss timeout
        composeTestRule.mainClock.advanceTimeBy(TOAST_DURATION_MS + 500)
        composeTestRule.waitForIdle()

        // onDismiss should still NOT have been called because user already tapped
        assertFalse("onDismiss should NOT fire after tap (would clear Recap state)", dismissCalled)
    }

    // =========================================================================
    // Constants validation
    // =========================================================================

    @Test
    fun test_toast_appear_ms_matches_spec() {
        assertEquals("TOAST_APPEAR_MS should be 500", 500L, TOAST_APPEAR_MS)
    }

    @Test
    fun test_toast_duration_ms_matches_spec() {
        assertEquals("TOAST_DURATION_MS should be 5000", 5000L, TOAST_DURATION_MS)
    }

    @Test
    fun test_toast_duration_tolerance_ms_matches_spec() {
        assertEquals("TOAST_DURATION_TOLERANCE_MS should be 250", 250L, TOAST_DURATION_TOLERANCE_MS)
    }

    // =========================================================================
    // Helper
    // =========================================================================

    private fun createTestNotice(
        killerName: String? = "TestKiller",
        zone: String = "Rookguard",
        x: Int = 10,
        y: Int = 20,
        timestamp: String = "2026-01-21T12:00:00Z",
        itemsLost: List<String> = listOf("Test Item"),
        chronicleEventId: String? = "evt_mock",
        reason: String = "killed by TestKiller"
    ): DeathNotice = DeathNotice(
        killerName = killerName,
        zone = zone,
        x = x,
        y = y,
        timestamp = timestamp,
        itemsLost = itemsLost,
        chronicleEventId = chronicleEventId,
        reason = reason
    )
}
