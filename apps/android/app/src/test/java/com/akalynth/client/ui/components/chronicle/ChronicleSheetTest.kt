package com.akalynth.client.ui.components.chronicle

import androidx.compose.foundation.layout.height
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.dp
import com.akalynth.client.ui.state.ChronicleEvent
import com.akalynth.client.ui.state.ChronicleEventKind
import com.akalynth.client.ui.state.EventSource
import com.akalynth.client.ui.state.EventStatus
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ChronicleSheetTest {
    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun chronicleRowsExposeReceiptStatus() {
        composeTestRule.setContent {
            ChronicleSheet(
                events = listOf(
                    event("pending", EventStatus.PENDING, EventSource.CLIENT_INTENT),
                    event("confirmed", EventStatus.CONFIRMED, EventSource.SERVER_RECEIPT),
                    event("rejected", EventStatus.REJECTED, EventSource.CLIENT_INTENT)
                ),
                hasMore = false,
                onEventClick = {},
                onLoadMore = {},
                onDismiss = {},
                modifier = Modifier.height(420.dp)
            )
        }

        composeTestRule.onNodeWithTag("ChronicleSheet_EventStatus_pending")
            .assertTextEquals("Pending")
        composeTestRule.onNodeWithTag("ChronicleSheet_EventStatus_confirmed")
            .assertTextEquals("Server receipt")
        composeTestRule.onNodeWithTag("ChronicleSheet_EventStatus_rejected")
            .assertTextEquals("Rejected")
    }

    private fun event(
        id: String,
        status: EventStatus,
        source: EventSource
    ) = ChronicleEvent(
        id = id,
        kind = ChronicleEventKind.WORLD_EVENT,
        timestamp = "2026-06-06T08:00:00Z",
        zone = "Azura",
        x = 10,
        y = 20,
        status = status,
        source = source
    )
}
