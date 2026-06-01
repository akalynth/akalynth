package com.akalynth.client.ui.regression

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.performTouchInput
import com.akalynth.client.ui.components.confirmation.HOLD_DURATION_MS
import com.akalynth.client.ui.components.confirmation.Tier2HoldButton
import org.junit.Rule
import org.junit.Test
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Regression tests for Tier 2 (hold 1.5s) confirmation button.
 * Maps to UI_REGRESSION_MATRIX.md Section 3: Inventory Safety (D1-D2)
 *
 * Timing constants:
 * - HOLD_DURATION_MS = 1500ms (±100ms tolerance)
 *
 * Note: These tests use Compose's test clock for deterministic timing.
 * mainClock.advanceTimeBy() controls the animation progress.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class Tier2HoldButtonTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    companion object {
        const val HOLD_TOLERANCE_MS = 100L
    }

    // =========================================================================
    // D1: Drop normal item (hold)
    // Assertion: Release <1500ms cancels; >=1500ms confirms once
    // =========================================================================

    @Test
    fun `D1 - hold full duration confirms`() {
        var confirmed = false
        var cancelled = false

        composeTestRule.setContent {
            Tier2HoldButton(
                label = "Test",
                onConfirm = { confirmed = true },
                onCancel = { cancelled = true }
            )
        }

        // Press and hold
        composeTestRule.onNodeWithTag("Tier2HoldButton").performTouchInput {
            down(center)
        }

        // Advance past hold duration
        composeTestRule.mainClock.advanceTimeBy(HOLD_DURATION_MS + 50)

        // Release
        composeTestRule.onNodeWithTag("Tier2HoldButton").performTouchInput {
            up()
        }

        // Verify
        assertTrue("Should have confirmed", confirmed)
        assertFalse("Should NOT have cancelled", cancelled)
    }

    @Test
    fun `D1 - hold duration is 1500ms within tolerance`() {
        var confirmed = false

        composeTestRule.setContent {
            Tier2HoldButton(
                label = "Test",
                onConfirm = { confirmed = true },
                onCancel = {}
            )
        }

        // Press
        composeTestRule.onNodeWithTag("Tier2HoldButton").performTouchInput {
            down(center)
        }

        // Advance to just before threshold (within tolerance)
        composeTestRule.mainClock.advanceTimeBy(HOLD_DURATION_MS - HOLD_TOLERANCE_MS - 50)
        assertFalse("Should NOT confirm before threshold", confirmed)

        // Advance past threshold
        composeTestRule.mainClock.advanceTimeBy(HOLD_TOLERANCE_MS + 100)

        // Release
        composeTestRule.onNodeWithTag("Tier2HoldButton").performTouchInput {
            up()
        }

        assertTrue("Should confirm after threshold", confirmed)
    }

    @Test
    fun `D1 - confirm callback fires exactly once`() {
        var confirmCount = 0

        composeTestRule.setContent {
            Tier2HoldButton(
                label = "Test",
                onConfirm = { confirmCount++ },
                onCancel = {}
            )
        }

        // Press and hold well past threshold
        composeTestRule.onNodeWithTag("Tier2HoldButton").performTouchInput {
            down(center)
        }

        composeTestRule.mainClock.advanceTimeBy(HOLD_DURATION_MS + 500)

        // Release
        composeTestRule.onNodeWithTag("Tier2HoldButton").performTouchInput {
            up()
        }

        assertEquals("Confirm should fire exactly once", 1, confirmCount)
    }

    // =========================================================================
    // D2: Release during hold
    // Assertion: onCancel invoked; progress resets to 0
    // =========================================================================

    @Test
    fun `D2 - release before completion cancels`() {
        var confirmed = false
        var cancelled = false

        composeTestRule.setContent {
            Tier2HoldButton(
                label = "Test",
                onConfirm = { confirmed = true },
                onCancel = { cancelled = true }
            )
        }

        // Press
        composeTestRule.onNodeWithTag("Tier2HoldButton").performTouchInput {
            down(center)
        }

        // Advance to half duration
        composeTestRule.mainClock.advanceTimeBy(HOLD_DURATION_MS / 2)

        // Release early
        composeTestRule.onNodeWithTag("Tier2HoldButton").performTouchInput {
            up()
        }

        // Verify
        assertFalse("Should NOT have confirmed", confirmed)
        assertTrue("Should have cancelled", cancelled)
    }

    @Test
    fun `D2 - progress resets on cancel`() {
        var cancelCount = 0

        composeTestRule.setContent {
            Tier2HoldButton(
                label = "Test",
                onConfirm = {},
                onCancel = { cancelCount++ }
            )
        }

        // First gesture: cancel at 50%
        composeTestRule.onNodeWithTag("Tier2HoldButton").performTouchInput {
            down(center)
        }
        composeTestRule.mainClock.advanceTimeBy(HOLD_DURATION_MS / 2)
        composeTestRule.onNodeWithTag("Tier2HoldButton").performTouchInput {
            up()
        }

        assertEquals(1, cancelCount)

        // Second gesture: should start from 0, not 50%
        // If progress didn't reset, we'd confirm after only 750ms more
        composeTestRule.onNodeWithTag("Tier2HoldButton").performTouchInput {
            down(center)
        }
        composeTestRule.mainClock.advanceTimeBy(HOLD_DURATION_MS / 2)
        composeTestRule.onNodeWithTag("Tier2HoldButton").performTouchInput {
            up()
        }

        // Should cancel again (progress reset to 0, only held for 750ms)
        assertEquals("Progress should reset - second gesture also cancels", 2, cancelCount)
    }

    @Test
    fun `D2 - release at 99 percent does not confirm`() {
        var confirmed = false
        var cancelled = false

        composeTestRule.setContent {
            Tier2HoldButton(
                label = "Test",
                onConfirm = { confirmed = true },
                onCancel = { cancelled = true }
            )
        }

        // Press
        composeTestRule.onNodeWithTag("Tier2HoldButton").performTouchInput {
            down(center)
        }

        // Advance to 99% of duration (just before completion)
        composeTestRule.mainClock.advanceTimeBy((HOLD_DURATION_MS * 0.99).toLong())

        // Release
        composeTestRule.onNodeWithTag("Tier2HoldButton").performTouchInput {
            up()
        }

        assertFalse("Should NOT confirm at 99%", confirmed)
        assertTrue("Should cancel at 99%", cancelled)
    }

    // =========================================================================
    // Confirmed latch (no double-fire)
    // =========================================================================

    @Test
    fun `confirmed latch prevents cancel after confirm`() {
        var confirmCount = 0
        var cancelCount = 0

        composeTestRule.setContent {
            Tier2HoldButton(
                label = "Test",
                onConfirm = { confirmCount++ },
                onCancel = { cancelCount++ }
            )
        }

        // Press and hold to completion
        composeTestRule.onNodeWithTag("Tier2HoldButton").performTouchInput {
            down(center)
        }

        composeTestRule.mainClock.advanceTimeBy(HOLD_DURATION_MS + 100)

        // Confirm should have fired
        assertEquals(1, confirmCount)

        // Now release
        composeTestRule.onNodeWithTag("Tier2HoldButton").performTouchInput {
            up()
        }

        // Cancel should NOT fire after confirm
        assertEquals("Confirm should still be 1", 1, confirmCount)
        assertEquals("Cancel should NOT fire after confirm", 0, cancelCount)
    }

    // =========================================================================
    // Visual feedback verification
    // =========================================================================

    @Test
    fun `text shows HOLD initially`() {
        composeTestRule.setContent {
            Tier2HoldButton(
                label = "Test",
                onConfirm = {},
                onCancel = {}
            )
        }

        composeTestRule.onNodeWithText("HOLD").assertIsDisplayed()
    }

    @Test
    fun `text changes from HOLD to DONE on completion`() {
        composeTestRule.setContent {
            Tier2HoldButton(
                label = "Test",
                onConfirm = {},
                onCancel = {}
            )
        }

        // Initially shows HOLD
        composeTestRule.onNodeWithText("HOLD").assertIsDisplayed()

        // Press and hold to completion
        composeTestRule.onNodeWithTag("Tier2HoldButton").performTouchInput {
            down(center)
        }
        composeTestRule.mainClock.advanceTimeBy(HOLD_DURATION_MS + 100)

        // Should show DONE
        composeTestRule.onNodeWithText("DONE").assertIsDisplayed()
    }

    // =========================================================================
    // Multiple gesture cycles
    // =========================================================================

    @Test
    fun `can confirm after previous cancel`() {
        var confirmCount = 0
        var cancelCount = 0

        composeTestRule.setContent {
            Tier2HoldButton(
                label = "Test",
                onConfirm = { confirmCount++ },
                onCancel = { cancelCount++ }
            )
        }

        // First gesture: cancel
        composeTestRule.onNodeWithTag("Tier2HoldButton").performTouchInput {
            down(center)
        }
        composeTestRule.mainClock.advanceTimeBy(500)
        composeTestRule.onNodeWithTag("Tier2HoldButton").performTouchInput {
            up()
        }

        assertEquals(0, confirmCount)
        assertEquals(1, cancelCount)

        // Second gesture: confirm
        composeTestRule.onNodeWithTag("Tier2HoldButton").performTouchInput {
            down(center)
        }
        composeTestRule.mainClock.advanceTimeBy(HOLD_DURATION_MS + 100)
        composeTestRule.onNodeWithTag("Tier2HoldButton").performTouchInput {
            up()
        }

        assertEquals(1, confirmCount)
        assertEquals(1, cancelCount) // Still 1, not 2
    }

    // =========================================================================
    // Edge cases
    // =========================================================================

    @Test
    fun `immediate release does not fire cancel`() {
        var cancelCount = 0

        composeTestRule.setContent {
            Tier2HoldButton(
                label = "Test",
                onConfirm = {},
                onCancel = { cancelCount++ }
            )
        }

        // Press and immediately release (no time advancement)
        composeTestRule.onNodeWithTag("Tier2HoldButton").performTouchInput {
            down(center)
            up()
        }

        // Progress was 0, so cancel should NOT fire
        // (only fires if progress > 0)
        assertEquals("Cancel should not fire for zero progress", 0, cancelCount)
    }

    @Test
    fun `very short hold fires cancel`() {
        var cancelCount = 0

        composeTestRule.setContent {
            Tier2HoldButton(
                label = "Test",
                onConfirm = {},
                onCancel = { cancelCount++ }
            )
        }

        // Press, advance tiny amount, release
        composeTestRule.onNodeWithTag("Tier2HoldButton").performTouchInput {
            down(center)
        }
        composeTestRule.mainClock.advanceTimeBy(50) // 50ms
        composeTestRule.onNodeWithTag("Tier2HoldButton").performTouchInput {
            up()
        }

        // Progress > 0, so cancel fires
        assertEquals(1, cancelCount)
    }
}
