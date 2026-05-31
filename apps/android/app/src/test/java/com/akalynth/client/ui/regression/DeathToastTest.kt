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
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

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
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class DeathToastTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    // =========================================================================
    // X1: Death toast appears
    // Assertion: Toast shown <= 500ms after death; contains items lost
    // =========================================================================

    @Test
    fun `X1 - appears when visible is true`() {
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
    fun `X1 - shows items lost list`() {
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
    fun `X1 - shows you died message`() {
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
    fun `X1 - shows skull icon`() {
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
        composeTestRule.onNodeWithText("☠").assertIsDisplayed()
    }

    @Test
    fun `X1 - handles empty items lost`() {
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
    fun `X1 - tap for details text shown`() {
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
    fun `X2 - auto dismisses at 5000ms`() {
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
    fun `X2 - does not dismiss before 4750ms`() {
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
    fun `X2 - dismisses by 5250ms`() {
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
    fun `X2 - disappears without interaction`() {
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
    fun `X3 - tap calls onTap callback`() {
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
    fun `X3 - tap triggers only onTap not onDismiss`() {
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
    fun `not displayed when visible is false`() {
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
    fun `visibility state controls display`() {
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
    fun `uses slide animation for enter`() {
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
    fun `timeout does not fire onDismiss after tap`() {
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
    fun `TOAST_APPEAR_MS matches spec`() {
        assertEquals("TOAST_APPEAR_MS should be 500", 500L, TOAST_APPEAR_MS)
    }

    @Test
    fun `TOAST_DURATION_MS matches spec`() {
        assertEquals("TOAST_DURATION_MS should be 5000", 5000L, TOAST_DURATION_MS)
    }

    @Test
    fun `TOAST_DURATION_TOLERANCE_MS matches spec`() {
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
