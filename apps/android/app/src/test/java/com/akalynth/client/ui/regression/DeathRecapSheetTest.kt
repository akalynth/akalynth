package com.akalynth.client.ui.regression

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.akalynth.client.ui.components.death.DeathRecapSheet
import com.akalynth.client.ui.components.death.SHEET_OPEN_MS
import com.akalynth.client.ui.state.ChronicleEvent
import com.akalynth.client.ui.state.ChronicleEventDetails
import com.akalynth.client.ui.state.ChronicleEventKind
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

/**
 * Regression tests for death recap sheet.
 * Maps to UI_REGRESSION_MATRIX.md Section 5: Death Experience (X3-X4)
 *
 * Timing constants:
 * - SHEET_OPEN_MS = 300ms (max)
 */
class DeathRecapSheetTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    // =========================================================================
    // X3: Recap displays correct details
    // =========================================================================

    @Test
    fun `X3 - displays killer name`() {
        val deathEvent = createMockDeathEvent(
            killerName = "DarkMage_99"
        )

        composeTestRule.setContent {
            DeathRecapSheet(
                event = deathEvent,
                onCopyEventId = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        // Verify killer name is displayed
        composeTestRule.onNodeWithText("DarkMage_99").assertIsDisplayed()
        composeTestRule.onNodeWithText("Killed by:").assertIsDisplayed()
    }

    @Test
    fun `X3 - displays location`() {
        val deathEvent = createMockDeathEvent(
            zone = "Azura",
            x = 12,
            y = 45
        )

        composeTestRule.setContent {
            DeathRecapSheet(
                event = deathEvent,
                onCopyEventId = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        // Verify location is displayed
        composeTestRule.onNodeWithText("Location:").assertIsDisplayed()
        composeTestRule.onNodeWithText("Azura (12, 45)").assertIsDisplayed()
    }

    @Test
    fun `X3 - displays time`() {
        val deathEvent = createMockDeathEvent(
            timestamp = "2026-01-21T14:32:07Z"
        )

        composeTestRule.setContent {
            DeathRecapSheet(
                event = deathEvent,
                onCopyEventId = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        // Verify time is displayed in readable format
        composeTestRule.onNodeWithText("Time:").assertIsDisplayed()
        composeTestRule.onNodeWithText("14:32:07").assertIsDisplayed()
    }

    @Test
    fun `X3 - displays items lost`() {
        val deathEvent = createMockDeathEvent(
            itemsLost = listOf("Flame Sword", "Ration", "Ration")
        )

        composeTestRule.setContent {
            DeathRecapSheet(
                event = deathEvent,
                onCopyEventId = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        // Verify items lost header
        composeTestRule.onNodeWithText("ITEMS LOST (3):").assertIsDisplayed()

        // Verify each item is listed
        composeTestRule.onNodeWithText("Flame Sword").assertIsDisplayed()
        // Note: "Ration" appears twice but we only check existence
        composeTestRule.onNodeWithText("Ration").assertIsDisplayed()
    }

    @Test
    fun `X3 - handles unknown killer`() {
        val deathEvent = createMockDeathEvent(
            killerName = null
        )

        composeTestRule.setContent {
            DeathRecapSheet(
                event = deathEvent,
                onCopyEventId = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        // Verify environment/unknown placeholder
        composeTestRule.onNodeWithText("Environment").assertIsDisplayed()
    }

    @Test
    fun `X3 - handles no items lost`() {
        val deathEvent = createMockDeathEvent(
            itemsLost = emptyList()
        )

        composeTestRule.setContent {
            DeathRecapSheet(
                event = deathEvent,
                onCopyEventId = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        // Verify "No items lost" message
        composeTestRule.onNodeWithText("No items lost").assertIsDisplayed()
    }

    // =========================================================================
    // X4: Copy event ID
    // Assertion: Clipboard set <= 300ms
    // =========================================================================

    @Test
    fun `X4 - copy event id works`() {
        val eventId = "evt_12345"
        var copiedId: String? = null

        val deathEvent = createMockDeathEvent(
            chronicleEventId = eventId
        )

        composeTestRule.setContent {
            DeathRecapSheet(
                event = deathEvent,
                onCopyEventId = { copiedId = it },
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        // Click copy button
        composeTestRule.onNodeWithTag("DeathRecapSheet_CopyButton").performClick()

        assertEquals("Copy should receive event ID", eventId, copiedId)
    }

    @Test
    fun `X4 - copy button is displayed`() {
        val deathEvent = createMockDeathEvent()

        composeTestRule.setContent {
            DeathRecapSheet(
                event = deathEvent,
                onCopyEventId = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithText("COPY EVENT ID").assertIsDisplayed()
    }

    @Test
    fun `X4 - copy button disabled if no event id`() {
        val deathEvent = createMockDeathEvent(
            chronicleEventId = null
        )

        composeTestRule.setContent {
            DeathRecapSheet(
                event = deathEvent,
                onCopyEventId = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        // Button should be disabled (shows "EVENT ID PENDING")
        composeTestRule.onNodeWithText("EVENT ID PENDING").assertIsDisplayed()
        composeTestRule.onNodeWithTag("DeathRecapSheet_CopyButton").assertIsNotEnabled()
    }

    @Test
    fun `X4 - copy button enabled with valid event id`() {
        val deathEvent = createMockDeathEvent(
            chronicleEventId = "evt_valid_123"
        )

        composeTestRule.setContent {
            DeathRecapSheet(
                event = deathEvent,
                onCopyEventId = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("DeathRecapSheet_CopyButton").assertIsEnabled()
    }

    @Test
    fun `X4 - copy button does not crash on null id click`() {
        var callbackInvoked = false
        val deathEvent = createMockDeathEvent(
            chronicleEventId = null
        )

        composeTestRule.setContent {
            DeathRecapSheet(
                event = deathEvent,
                onCopyEventId = { callbackInvoked = true },
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        // Try to click disabled button - should not crash
        composeTestRule.onNodeWithTag("DeathRecapSheet_CopyButton").performClick()

        assertFalse("Callback should not be invoked when disabled", callbackInvoked)
    }

    // =========================================================================
    // Sheet behavior
    // =========================================================================

    @Test
    fun `dismiss closes sheet`() {
        var dismissed = false
        val deathEvent = createMockDeathEvent()

        composeTestRule.setContent {
            DeathRecapSheet(
                event = deathEvent,
                onCopyEventId = {},
                onDismiss = { dismissed = true }
            )
        }

        composeTestRule.waitForIdle()

        // Click close button
        composeTestRule.onNodeWithTag("DeathRecapSheet_Close").performClick()

        assertTrue("Dismiss should be called", dismissed)
    }

    @Test
    fun `header shows DEATH RECAP`() {
        val deathEvent = createMockDeathEvent()

        composeTestRule.setContent {
            DeathRecapSheet(
                event = deathEvent,
                onCopyEventId = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithText("DEATH RECAP").assertIsDisplayed()
    }

    @Test
    fun `skull icon is displayed`() {
        val deathEvent = createMockDeathEvent()

        composeTestRule.setContent {
            DeathRecapSheet(
                event = deathEvent,
                onCopyEventId = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithText("☠").assertIsDisplayed()
    }

    @Test
    fun `event id is displayed when present`() {
        val eventId = "evt_display_test"
        val deathEvent = createMockDeathEvent(chronicleEventId = eventId)

        composeTestRule.setContent {
            DeathRecapSheet(
                event = deathEvent,
                onCopyEventId = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithText(eventId).assertIsDisplayed()
    }

    // =========================================================================
    // Constants validation
    // =========================================================================

    @Test
    fun `SHEET_OPEN_MS matches spec`() {
        assertEquals("SHEET_OPEN_MS should be 300", 300L, SHEET_OPEN_MS)
    }

    // =========================================================================
    // Helper
    // =========================================================================

    private fun createMockDeathEvent(
        killerName: String? = "TestKiller",
        zone: String = "Rookguard",
        x: Int = 10,
        y: Int = 20,
        timestamp: String = "2026-01-21T12:00:00Z",
        itemsLost: List<String> = listOf("Test Item"),
        chronicleEventId: String? = "evt_mock"
    ): ChronicleEvent = ChronicleEvent(
        id = chronicleEventId ?: "pending_$timestamp",
        kind = ChronicleEventKind.DEATH,
        timestamp = timestamp,
        zone = zone,
        x = x,
        y = y,
        details = ChronicleEventDetails(
            killerName = killerName,
            itemsLost = itemsLost.ifEmpty { null }
        )
    )
}
