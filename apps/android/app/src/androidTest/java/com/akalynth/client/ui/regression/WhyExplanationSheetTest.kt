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
import androidx.test.ext.junit.runners.AndroidJUnit4

/**
 * Regression tests for Why explanation sheet and overlay contention.
 *
 * Contracts (M1-M4):
 * - M1: Only opens from None state (overlay contention)
 * - M2: Shows zone-specific context
 * - M3: Lists recent events with explanations
 * - M4: Dismiss returns to None state
 */
@RunWith(AndroidJUnit4::class)
class WhyExplanationSheetTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    // =========================================================================
    // M1: Overlay contention
    // =========================================================================

    @Test
    fun test_m1_canopenwhy_returns_true_for_none_state() {
        val state: UiOverlayState = UiOverlayState.None
        assertTrue("Should be able to open Why from None", state.canOpenWhy())
    }

    @Test
    fun test_m1_canopenwhy_returns_false_for_toast_state() {
        val state: UiOverlayState = UiOverlayState.Toast(
            createTestDeathNotice()
        )
        assertFalse("Should NOT be able to open Why from Toast", state.canOpenWhy())
    }

    @Test
    fun test_m1_canopenwhy_returns_false_for_recap_state() {
        val state: UiOverlayState = UiOverlayState.Recap(
            createTestChronicleEvent()
        )
        assertFalse("Should NOT be able to open Why from Recap", state.canOpenWhy())
    }

    @Test
    fun test_m1_canopenwhy_returns_false_for_confirmdrop_state() {
        val state: UiOverlayState = UiOverlayState.ConfirmDrop(
            slotIndex = 0,
            itemId = "item_1",
            itemName = "Sword",
            isLegendary = false
        )
        assertFalse("Should NOT be able to open Why from ConfirmDrop", state.canOpenWhy())
    }

    @Test
    fun test_m1_canopenwhy_returns_false_for_why_state() {
        val state: UiOverlayState = UiOverlayState.Why(
            WhyContext(zone = "Rookguard")
        )
        assertFalse("Should NOT be able to open Why from Why", state.canOpenWhy())
    }

    // =========================================================================
    // Priority ordering
    // =========================================================================

    @Test
    fun test_priority_ordering_is_correct() {
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
    fun test_m2_displays_zone_context() {
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
    fun test_m2_displays_current_zone_label() {
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
    fun test_m3_displays_recent_events_header() {
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
    fun test_m3_displays_event_list() {
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
    fun test_m3_shows_no_events_message_when_empty() {
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
    fun test_m3_event_click_fires_callback() {
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
    fun test_m4_dismiss_button_fires_callback() {
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
    fun test_m4_scrim_tap_fires_dismiss_callback() {
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
    fun test_topic_help_shown_when_provided() {
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
    fun test_topic_help_hidden_when_not_provided() {
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
    fun test_displays_title() {
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
    fun test_displays_icon() {
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
    fun test_why_state_holds_correct_data() {
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
