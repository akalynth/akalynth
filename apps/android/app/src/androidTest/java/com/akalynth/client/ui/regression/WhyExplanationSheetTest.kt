package com.akalynth.client.ui.regression

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.akalynth.client.ui.components.why.WhyExplanationSheet
import com.akalynth.client.ui.state.ChronicleEvent
import com.akalynth.client.ui.state.ChronicleEventDetails
import com.akalynth.client.ui.state.ChronicleEventKind
import com.akalynth.client.ui.state.UiOverlayState
import com.akalynth.client.ui.state.WhyContext
import com.akalynth.client.ui.state.canOpenWhy
import com.akalynth.client.ui.state.priority
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Regression tests for Why explanation sheet and overlay contention.
 *
 * Contracts (M1-M4):
 * - M1: Only opens from None state (overlay contention)
 * - M2: Shows zone-specific context
 * - M3: Lists recent events with explanations
 * - M4: Dismiss returns to None state
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class WhyExplanationSheetTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    // =========================================================================
    // M1: Overlay contention
    // =========================================================================

    @Test
    fun `M1 - canOpenWhy returns true for None state`() {
        val state: UiOverlayState = UiOverlayState.None
        assertTrue("Should be able to open Why from None", state.canOpenWhy())
    }

    @Test
    fun `M1 - canOpenWhy returns false for Toast state`() {
        val state: UiOverlayState = UiOverlayState.Toast(
            createTestDeathNotice()
        )
        assertFalse("Should NOT be able to open Why from Toast", state.canOpenWhy())
    }

    @Test
    fun `M1 - canOpenWhy returns false for Recap state`() {
        val state: UiOverlayState = UiOverlayState.Recap(
            createTestChronicleEvent()
        )
        assertFalse("Should NOT be able to open Why from Recap", state.canOpenWhy())
    }

    @Test
    fun `M1 - canOpenWhy returns false for ConfirmDrop state`() {
        val state: UiOverlayState = UiOverlayState.ConfirmDrop(
            slotIndex = 0,
            itemId = "item_1",
            itemName = "Sword",
            isLegendary = false
        )
        assertFalse("Should NOT be able to open Why from ConfirmDrop", state.canOpenWhy())
    }

    @Test
    fun `M1 - canOpenWhy returns false for Why state`() {
        val state: UiOverlayState = UiOverlayState.Why(
            WhyContext(zone = "Rookguard")
        )
        assertFalse("Should NOT be able to open Why from Why", state.canOpenWhy())
    }

    // =========================================================================
    // Priority ordering
    // =========================================================================

    @Test
    fun `priority ordering is correct`() {
        val none = UiOverlayState.None
        val why = UiOverlayState.Why(WhyContext(zone = "Test"))
        val toast = UiOverlayState.Toast(createTestDeathNotice())
        val recap = UiOverlayState.Recap(createTestChronicleEvent())
        val confirmDrop = UiOverlayState.ConfirmDrop(0, "id", "name", false)

        assertTrue("None should have lowest priority", none.priority < why.priority)
        assertTrue("Why should have lower priority than Toast", why.priority < toast.priority)
        assertTrue("Toast should have lower priority than Recap", toast.priority < recap.priority)
        assertTrue("Recap should have lower priority than ConfirmDrop", recap.priority < confirmDrop.priority)
    }

    // =========================================================================
    // M2: Zone context
    // =========================================================================

    @Test
    fun `M2 - displays zone context`() {
        val context = WhyContext(zone = "Rookguard")

        composeTestRule.setContent {
            WhyExplanationSheet(
                context = context,
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("WhyExplanationSheet_ZoneContext").assertIsDisplayed()
        composeTestRule.onNodeWithText("Rookguard").assertIsDisplayed()
    }

    @Test
    fun `M2 - displays current zone label`() {
        val context = WhyContext(zone = "Azura")

        composeTestRule.setContent {
            WhyExplanationSheet(
                context = context,
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithText("Current Zone").assertIsDisplayed()
        composeTestRule.onNodeWithText("High City").assertIsDisplayed()
    }

    // =========================================================================
    // M3: Recent events
    // =========================================================================

    @Test
    fun `M3 - displays recent events header`() {
        val context = WhyContext(
            zone = "Rookguard",
            recentEvents = listOf(createTestChronicleEvent())
        )

        composeTestRule.setContent {
            WhyExplanationSheet(
                context = context,
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("WhyExplanationSheet_EventsHeader").assertIsDisplayed()
        composeTestRule.onNodeWithText("Recent Events").assertIsDisplayed()
    }

    @Test
    fun `M3 - displays event list`() {
        val event = createTestChronicleEvent()
        val context = WhyContext(
            zone = "Rookguard",
            recentEvents = listOf(event)
        )

        composeTestRule.setContent {
            WhyExplanationSheet(
                context = context,
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("WhyExplanationSheet_EventsList").assertIsDisplayed()
        composeTestRule.onNodeWithTag("WhyExplanationSheet_Event_${event.id}").assertIsDisplayed()
    }

    @Test
    fun `M3 - shows no events message when empty`() {
        val context = WhyContext(
            zone = "Rookguard",
            recentEvents = emptyList()
        )

        composeTestRule.setContent {
            WhyExplanationSheet(
                context = context,
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("WhyExplanationSheet_NoEvents").assertIsDisplayed()
    }

    @Test
    fun `M3 - event click fires callback`() {
        var clickedEvent: ChronicleEvent? = null
        val event = createTestChronicleEvent()
        val context = WhyContext(
            zone = "Rookguard",
            recentEvents = listOf(event)
        )

        composeTestRule.setContent {
            WhyExplanationSheet(
                context = context,
                onDismiss = {},
                onEventClick = { clickedEvent = it }
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("WhyExplanationSheet_Event_${event.id}").performClick()

        assertEquals(event, clickedEvent)
    }

    // =========================================================================
    // M4: Dismiss behavior
    // =========================================================================

    @Test
    fun `M4 - dismiss button fires callback`() {
        var dismissed = false
        val context = WhyContext(zone = "Rookguard")

        composeTestRule.setContent {
            WhyExplanationSheet(
                context = context,
                onDismiss = { dismissed = true }
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("WhyExplanationSheet_DismissButton").performClick()

        assertTrue("Dismiss callback should fire", dismissed)
    }

    @Test
    fun `M4 - scrim tap fires dismiss callback`() {
        var dismissed = false
        val context = WhyContext(zone = "Rookguard")

        composeTestRule.setContent {
            WhyExplanationSheet(
                context = context,
                onDismiss = { dismissed = true }
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("WhyExplanationSheet_Scrim").performClick()

        assertTrue("Dismiss callback should fire on scrim tap", dismissed)
    }

    // =========================================================================
    // Topic help
    // =========================================================================

    @Test
    fun `topic help shown when provided`() {
        val context = WhyContext(
            zone = "Rookguard",
            topic = "death"
        )

        composeTestRule.setContent {
            WhyExplanationSheet(
                context = context,
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("WhyExplanationSheet_Topic").assertIsDisplayed()
    }

    @Test
    fun `topic help hidden when not provided`() {
        val context = WhyContext(zone = "Rookguard")

        composeTestRule.setContent {
            WhyExplanationSheet(
                context = context,
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("WhyExplanationSheet_Topic").assertDoesNotExist()
    }

    // =========================================================================
    // Structure
    // =========================================================================

    @Test
    fun `displays title`() {
        val context = WhyContext(zone = "Rookguard")

        composeTestRule.setContent {
            WhyExplanationSheet(
                context = context,
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("WhyExplanationSheet_Title").assertIsDisplayed()
        composeTestRule.onNodeWithText("Why did this happen?").assertIsDisplayed()
    }

    @Test
    fun `displays icon`() {
        val context = WhyContext(zone = "Rookguard")

        composeTestRule.setContent {
            WhyExplanationSheet(
                context = context,
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("WhyExplanationSheet_Icon").assertIsDisplayed()
    }

    // =========================================================================
    // UiOverlayState.Why tests
    // =========================================================================

    @Test
    fun `Why state holds correct data`() {
        val context = WhyContext(
            zone = "Rookguard",
            recentEvents = listOf(createTestChronicleEvent()),
            topic = "death"
        )
        val state = UiOverlayState.Why(context)

        assertEquals("Rookguard", state.context.zone)
        assertEquals(1, state.context.recentEvents.size)
        assertEquals("death", state.context.topic)
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private fun createTestDeathNotice() = com.akalynth.client.ui.state.DeathNotice(
        killerName = "TestKiller",
        zone = "Rookguard",
        x = 10,
        y = 20,
        timestamp = "2026-01-21T12:00:00Z",
        itemsLost = listOf("Sword"),
        chronicleEventId = "evt_test"
    )

    private fun createTestChronicleEvent() = ChronicleEvent(
        id = "evt_test_death",
        kind = ChronicleEventKind.DEATH,
        timestamp = "2026-01-21T12:00:00Z",
        zone = "Rookguard",
        x = 10,
        y = 20,
        details = ChronicleEventDetails(
            killerName = "TestKiller",
            itemsLost = listOf("Sword")
        )
    )
}
