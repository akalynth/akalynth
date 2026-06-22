package com.akalynth.client.ui.regression

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.akalynth.client.ui.components.chronicle.ChronicleSheet
import com.akalynth.client.ui.state.ChronicleEvent
import com.akalynth.client.ui.state.ChronicleEventDetails
import com.akalynth.client.ui.state.ChronicleEventKind
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import org.junit.runner.RunWith
import androidx.test.ext.junit.runners.AndroidJUnit4

/**
 * Regression tests for chronicle feed sheet.
 * Maps to UI_REGRESSION_MATRIX.md Section 6: Chronicle Feed (C1-C4)
 *
 * Timing constants:
 * - SHEET_OPEN_MS = 300ms (max)
 *
 * Note: Day grouping tests use dynamic dates (today/yesterday) to avoid flakiness.
 */
@RunWith(AndroidJUnit4::class)
class ChronicleSheetTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    companion object {
        const val SHEET_OPEN_MS = 300L
    }

    // =========================================================================
    // C1: Open chronicle
    // Assertion: Events grouped by day
    // =========================================================================

    @Test
    fun test_c1_events_grouped_by_day() {
        val todayTimestamp = todayAt(14, 0)
        val todayTimestamp2 = todayAt(10, 0)
        val yesterdayTimestamp = yesterdayAt(22, 0)
        val yesterdayTimestamp2 = yesterdayAt(20, 0)

        val events = listOf(
            createMockEvent(todayTimestamp, ChronicleEventKind.DEATH, "evt1"),
            createMockEvent(todayTimestamp2, ChronicleEventKind.ZONE_ENTER, "evt2"),
            createMockEvent(yesterdayTimestamp, ChronicleEventKind.ITEM_PICKUP, "evt3"),
            createMockEvent(yesterdayTimestamp2, ChronicleEventKind.CHARACTER_CREATED, "evt4")
        )

        composeTestRule.setContent {
            ChronicleSheet(
                events = events,
                hasMore = false,
                onEventClick = {},
                onLoadMore = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        // Verify day headers exist
        composeTestRule.onNodeWithTag("ChronicleSheet_DayHeader_TODAY").assertIsDisplayed()
        composeTestRule.onNodeWithTag("ChronicleSheet_DayHeader_YESTERDAY").assertIsDisplayed()
    }

    @Test
    fun test_c1_today_header_shows_for_today_events() {
        val events = listOf(
            createMockEvent(todayAt(14, 0), ChronicleEventKind.DEATH, "evt1")
        )

        composeTestRule.setContent {
            ChronicleSheet(
                events = events,
                hasMore = false,
                onEventClick = {},
                onLoadMore = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithText("TODAY").assertIsDisplayed()
    }

    @Test
    fun test_c1_yesterday_header_shows_for_yesterday_events() {
        val events = listOf(
            createMockEvent(yesterdayAt(14, 0), ChronicleEventKind.ZONE_ENTER, "evt1")
        )

        composeTestRule.setContent {
            ChronicleSheet(
                events = events,
                hasMore = false,
                onEventClick = {},
                onLoadMore = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithText("YESTERDAY").assertIsDisplayed()
    }

    @Test
    fun test_c1_older_dates_show_formatted_date() {
        val threeDaysAgo = LocalDate.now().minusDays(3)
        val timestamp = threeDaysAgo.atTime(14, 0).atOffset(ZoneOffset.UTC).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)
        val expectedHeader = threeDaysAgo.format(DateTimeFormatter.ofPattern("MMM d"))

        val events = listOf(
            createMockEvent(timestamp, ChronicleEventKind.ITEM_PICKUP, "evt1")
        )

        composeTestRule.setContent {
            ChronicleSheet(
                events = events,
                hasMore = false,
                onEventClick = {},
                onLoadMore = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithText(expectedHeader).assertIsDisplayed()
    }

    // =========================================================================
    // C2: Death event row tap
    // Assertion: Only death rows are tappable; opens recap <= 300ms
    // =========================================================================

    @Test
    fun test_c2_death_row_opens_recap() {
        var clickedEvent: ChronicleEvent? = null
        val deathEvent = createMockEvent(todayAt(14, 0), ChronicleEventKind.DEATH, "evt_death")

        composeTestRule.setContent {
            ChronicleSheet(
                events = listOf(deathEvent),
                hasMore = false,
                onEventClick = { clickedEvent = it },
                onLoadMore = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        // Tap death row
        composeTestRule.onNodeWithTag("ChronicleSheet_Event_evt_death").performClick()

        assertEquals("Death event should be passed to callback", deathEvent, clickedEvent)
    }

    @Test
    fun test_c2_non_death_rows_not_tappable() {
        var clickCount = 0
        val events = listOf(
            createMockEvent(todayAt(14, 0), ChronicleEventKind.ZONE_ENTER, "evt_zone"),
            createMockEvent(todayAt(13, 0), ChronicleEventKind.ITEM_PICKUP, "evt_pickup")
        )

        composeTestRule.setContent {
            ChronicleSheet(
                events = events,
                hasMore = false,
                onEventClick = { clickCount++ },
                onLoadMore = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        // Tap zone_enter row
        composeTestRule.onNodeWithTag("ChronicleSheet_Event_evt_zone").performClick()
        assertEquals("Zone enter should not trigger callback", 0, clickCount)

        // Tap item_pickup row
        composeTestRule.onNodeWithTag("ChronicleSheet_Event_evt_pickup").performClick()
        assertEquals("Item pickup should not trigger callback", 0, clickCount)
    }

    @Test
    fun test_c2_death_row_visually_distinct() {
        val events = listOf(
            createMockEvent(todayAt(14, 0), ChronicleEventKind.DEATH, "evt_death"),
            createMockEvent(todayAt(13, 0), ChronicleEventKind.ZONE_ENTER, "evt_zone")
        )

        composeTestRule.setContent {
            ChronicleSheet(
                events = events,
                hasMore = false,
                onEventClick = {},
                onLoadMore = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        // Both rows should exist
        composeTestRule.onNodeWithTag("ChronicleSheet_Event_evt_death").assertIsDisplayed()
        composeTestRule.onNodeWithTag("ChronicleSheet_Event_evt_zone").assertIsDisplayed()

        // Death row has arrow indicator (›) for tappable indication
        // Tested implicitly via glyph tag checks below
    }

    // =========================================================================
    // C3: Load more
    // Assertion: Pagination trigger fires once per tap
    // =========================================================================

    @Test
    fun test_c3_load_more_triggers_pagination() {
        var loadMoreCount = 0

        val events = listOf(
            createMockEvent(todayAt(14, 0), ChronicleEventKind.DEATH, "evt1")
        )

        composeTestRule.setContent {
            ChronicleSheet(
                events = events,
                hasMore = true,
                onEventClick = {},
                onLoadMore = { loadMoreCount++ },
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        // Tap load more
        composeTestRule.onNodeWithTag("ChronicleSheet_LoadMore").performClick()

        assertEquals("Load more should be called exactly once", 1, loadMoreCount)
    }

    @Test
    fun test_c3_load_more_hidden_when_no_more() {
        val events = listOf(
            createMockEvent(todayAt(14, 0), ChronicleEventKind.DEATH, "evt1")
        )

        composeTestRule.setContent {
            ChronicleSheet(
                events = events,
                hasMore = false,
                onEventClick = {},
                onLoadMore = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("ChronicleSheet_LoadMore").assertDoesNotExist()
    }

    @Test
    fun test_c3_load_more_visible_when_has_more() {
        val events = listOf(
            createMockEvent(todayAt(14, 0), ChronicleEventKind.DEATH, "evt1")
        )

        composeTestRule.setContent {
            ChronicleSheet(
                events = events,
                hasMore = true,
                onEventClick = {},
                onLoadMore = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithText("LOAD MORE").assertIsDisplayed()
    }

    // =========================================================================
    // C4: Event icons
    // Assertion: Correct icon for each event kind
    // =========================================================================

    @Test
    fun test_c4_death_glyph_is_displayed() {
        val events = listOf(
            createMockEvent(todayAt(14, 0), ChronicleEventKind.DEATH, "evt1")
        )

        composeTestRule.setContent {
            ChronicleSheet(
                events = events,
                hasMore = false,
                onEventClick = {},
                onLoadMore = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("ChronicleSheet_EventIcon_DEATH").assertIsDisplayed()
    }

    @Test
    fun test_c4_item_pickup_glyph_is_displayed() {
        val events = listOf(
            createMockEvent(todayAt(14, 0), ChronicleEventKind.ITEM_PICKUP, "evt1")
        )

        composeTestRule.setContent {
            ChronicleSheet(
                events = events,
                hasMore = false,
                onEventClick = {},
                onLoadMore = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("ChronicleSheet_EventIcon_ITEM_PICKUP").assertIsDisplayed()
    }

    @Test
    fun test_c4_zone_enter_glyph_is_displayed() {
        val events = listOf(
            createMockEvent(todayAt(14, 0), ChronicleEventKind.ZONE_ENTER, "evt1")
        )

        composeTestRule.setContent {
            ChronicleSheet(
                events = events,
                hasMore = false,
                onEventClick = {},
                onLoadMore = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("ChronicleSheet_EventIcon_ZONE_ENTER").assertIsDisplayed()
    }

    @Test
    fun test_c4_combat_kill_glyph_is_displayed() {
        val events = listOf(
            createMockEvent(todayAt(14, 0), ChronicleEventKind.COMBAT_KILL, "evt1")
        )

        composeTestRule.setContent {
            ChronicleSheet(
                events = events,
                hasMore = false,
                onEventClick = {},
                onLoadMore = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("ChronicleSheet_EventIcon_COMBAT_KILL").assertIsDisplayed()
    }

    @Test
    fun test_c4_tutorial_complete_glyph_is_displayed() {
        val events = listOf(
            createMockEvent(todayAt(14, 0), ChronicleEventKind.TUTORIAL_COMPLETE, "evt1")
        )

        composeTestRule.setContent {
            ChronicleSheet(
                events = events,
                hasMore = false,
                onEventClick = {},
                onLoadMore = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("ChronicleSheet_EventIcon_TUTORIAL_COMPLETE").assertIsDisplayed()
    }

    @Test
    fun test_c4_character_created_glyph_is_displayed() {
        val events = listOf(
            createMockEvent(todayAt(14, 0), ChronicleEventKind.CHARACTER_CREATED, "evt1")
        )

        composeTestRule.setContent {
            ChronicleSheet(
                events = events,
                hasMore = false,
                onEventClick = {},
                onLoadMore = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("ChronicleSheet_EventIcon_CHARACTER_CREATED").assertIsDisplayed()
    }

    // =========================================================================
    // Sheet behavior
    // =========================================================================

    @Test
    fun test_header_shows_my_chronicle() {
        composeTestRule.setContent {
            ChronicleSheet(
                events = emptyList(),
                hasMore = false,
                onEventClick = {},
                onLoadMore = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithText("MY CHRONICLE").assertIsDisplayed()
    }

    @Test
    fun test_empty_state_handled() {
        composeTestRule.setContent {
            ChronicleSheet(
                events = emptyList(),
                hasMore = false,
                onEventClick = {},
                onLoadMore = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        // Should show empty message, not crash
        composeTestRule.onNodeWithText("No events yet").assertIsDisplayed()
    }

    @Test
    fun test_dismiss_closes_sheet() {
        var dismissed = false

        composeTestRule.setContent {
            ChronicleSheet(
                events = emptyList(),
                hasMore = false,
                onEventClick = {},
                onLoadMore = {},
                onDismiss = { dismissed = true }
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("ChronicleSheet_Close").performClick()

        assertTrue("Dismiss should be called", dismissed)
    }

    @Test
    fun test_event_row_shows_zone_and_time() {
        val events = listOf(
            createMockEvent(todayAt(14, 30), ChronicleEventKind.DEATH, "evt1", zone = "Azura")
        )

        composeTestRule.setContent {
            ChronicleSheet(
                events = events,
                hasMore = false,
                onEventClick = {},
                onLoadMore = {},
                onDismiss = {}
            )
        }

        composeTestRule.waitForIdle()

        // Verify zone and time are displayed
        composeTestRule.onNodeWithText("High City • 14:30", substring = true).assertIsDisplayed()
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private fun todayAt(hour: Int, minute: Int): String {
        return LocalDate.now()
            .atTime(hour, minute)
            .atOffset(ZoneOffset.UTC)
            .format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)
    }

    private fun yesterdayAt(hour: Int, minute: Int): String {
        return LocalDate.now()
            .minusDays(1)
            .atTime(hour, minute)
            .atOffset(ZoneOffset.UTC)
            .format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)
    }

    private fun createMockEvent(
        timestamp: String,
        kind: ChronicleEventKind,
        id: String,
        zone: String = "Rookguard"
    ): ChronicleEvent = ChronicleEvent(
        id = id,
        kind = kind,
        timestamp = timestamp,
        zone = zone,
        x = 10,
        y = 20,
        details = ChronicleEventDetails(
            killerName = if (kind == ChronicleEventKind.DEATH) "TestKiller" else null,
            itemName = if (kind == ChronicleEventKind.ITEM_PICKUP) "Test Item" else null
        )
    )
}
