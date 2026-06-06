package com.akalynth.client.ui.components.chronicle

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.akalynth.client.ui.components.displayOptionalZoneName
import com.akalynth.client.ui.components.displayZoneName
import com.akalynth.client.ui.state.ChronicleEvent
import com.akalynth.client.ui.state.ChronicleEventKind
import com.akalynth.client.ui.state.EventSource
import com.akalynth.client.ui.state.EventStatus
import java.time.LocalDate
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException

/**
 * Chronicle sheet displaying player event history.
 * Maps to UI_REGRESSION_MATRIX.md Section 6: Chronicle Feed (C1-C4).
 *
 * Contract:
 * - C1: Events grouped by day (TODAY, YESTERDAY, or formatted date)
 * - C2: Death rows are tappable (opens recap); others are not
 * - C3: Load more button fires pagination once per tap
 * - C4: Event icons match event kind (☠📦🏛⚔🎓✨)
 *
 * @param events List of chronicle events to display
 * @param hasMore Whether more events are available for loading
 * @param onEventClick Called when a tappable event (death) is clicked
 * @param onLoadMore Called when load more is requested
 * @param onDismiss Called when sheet should close
 * @param modifier Modifier for the sheet container
 */
@Composable
fun ChronicleSheet(
    events: List<ChronicleEvent>,
    hasMore: Boolean,
    onEventClick: (ChronicleEvent) -> Unit,
    onLoadMore: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    val haptics = LocalHapticFeedback.current

    // Group events by day
    val groupedEvents = remember(events) {
        groupEventsByDay(events)
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp))
            .background(Color(0xFF1A1A2E))
            .padding(16.dp)
            .testTag("ChronicleSheet")
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "📜",
                fontSize = 24.sp
            )

            Text(
                text = "MY CHRONICLE",
                color = Color(0xFFE5E7EB),
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.testTag("ChronicleSheet_Title")
            )

            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color(0xFF2D2D44))
                    .clickable {
                        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        onDismiss()
                    }
                    .testTag("ChronicleSheet_Close"),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "✕",
                    color = Color(0xFF9E9E9E),
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))
        HorizontalDivider(color = Color(0xFF3D3D5C))
        Spacer(modifier = Modifier.height(8.dp))

        if (events.isEmpty()) {
            // Empty state
            Text(
                text = "No events yet",
                color = Color(0xFF9E9E9E),
                fontSize = 14.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 32.dp)
                    .testTag("ChronicleSheet_Empty")
            )
        } else {
            // Event list with day grouping
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .testTag("ChronicleSheet_List"),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                groupedEvents.forEach { (dayHeader, dayEvents) ->
                    // Day header
                    item(key = "header_$dayHeader") {
                        DayHeader(dayHeader)
                    }

                    // Events for this day
                    items(
                        items = dayEvents,
                        key = { it.id }
                    ) { event ->
                        EventRow(
                            event = event,
                            onClick = if (event.kind.isTappable) {
                                {
                                    haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                    onEventClick(event)
                                }
                            } else null
                        )
                    }
                }

                // Load more button
                if (hasMore) {
                    item(key = "load_more") {
                        Spacer(modifier = Modifier.height(8.dp))
                        Button(
                            onClick = {
                                haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                onLoadMore()
                            },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFF3D3D5C),
                                contentColor = Color(0xFFE5E7EB)
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("ChronicleSheet_LoadMore")
                        ) {
                            Text(
                                text = "LOAD MORE",
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Day header for event grouping.
 */
@Composable
private fun DayHeader(header: String) {
    Text(
        text = header,
        color = Color(0xFF6E6E8A),
        fontSize = 12.sp,
        fontWeight = FontWeight.Bold,
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp)
            .testTag("ChronicleSheet_DayHeader_$header")
    )
}

/**
 * Single event row with icon and details.
 */
@Composable
private fun EventRow(
    event: ChronicleEvent,
    onClick: (() -> Unit)?
) {
    val backgroundColor = if (event.kind == ChronicleEventKind.DEATH) {
        Color(0xFF2D1A1A) // Slightly red tint for death
    } else {
        Color(0xFF2D2D44)
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(backgroundColor)
            .then(
                if (onClick != null) {
                    Modifier.clickable { onClick() }
                } else {
                    Modifier
                }
            )
            .padding(12.dp)
            .testTag("ChronicleSheet_Event_${event.id}"),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Event icon
        Text(
            text = event.kind.icon,
            fontSize = 20.sp,
            modifier = Modifier.testTag("ChronicleSheet_EventIcon_${event.kind.name}")
        )

        Spacer(modifier = Modifier.width(12.dp))

        // Event details
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = getEventTitle(event),
                color = Color(0xFFE5E7EB),
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium
            )

            Text(
                text = "${displayZoneName(event.zone)} • ${formatTime(event.timestamp)}",
                color = Color(0xFF9E9E9E),
                fontSize = 12.sp
            )

            StatusBadge(event)
        }

        // Tap indicator for death events
        if (event.kind.isTappable) {
            Text(
                text = "›",
                color = Color(0xFF6E6E8A),
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
private fun StatusBadge(event: ChronicleEvent) {
    val (label, color) = when (event.status) {
        EventStatus.PENDING -> "Pending" to Color(0xFFFFD166)
        EventStatus.REJECTED -> "Rejected" to Color(0xFFFF5D4D)
        EventStatus.CONFIRMED -> {
            if (event.source == EventSource.SERVER_RECEIPT) {
                "Server receipt" to Color(0xFF42E66B)
            } else {
                "Confirmed" to Color(0xFF8FD3D6)
            }
        }
    }
    Text(
        text = label,
        color = color,
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.testTag("ChronicleSheet_EventStatus_${event.id}")
    )
}

/**
 * Get display title for event based on kind.
 */
private fun getEventTitle(event: ChronicleEvent): String = when (event.kind) {
    ChronicleEventKind.DEATH -> {
        val killer = event.details.killerName ?: "environment"
        "Killed by $killer"
    }
    ChronicleEventKind.ZONE_ENTER -> {
        val from = displayOptionalZoneName(event.details.fromZone)
        if (from != null) "Entered from $from" else "Entered zone"
    }
    ChronicleEventKind.ITEM_PICKUP -> {
        val item = event.details.itemName ?: "item"
        "Picked up $item"
    }
    ChronicleEventKind.ITEM_DROP -> {
        val item = event.details.itemName ?: "item"
        "Dropped $item"
    }
    ChronicleEventKind.COMBAT_KILL -> {
        val victim = event.details.victimName ?: "enemy"
        "Killed $victim"
    }
    ChronicleEventKind.TUTORIAL_COMPLETE -> "Completed tutorial"
    ChronicleEventKind.CHARACTER_CREATED -> "Character created"
    ChronicleEventKind.WORLD_EVENT -> {
        val eventId = event.details.eventId?.replace("_", " ") ?: "world event"
        val outcome = event.details.outcome?.replace("_", " ")
        if (outcome != null) "$eventId resolved: $outcome" else eventId
    }
    ChronicleEventKind.UNKNOWN -> "Unknown event"
}

/**
 * Group events by day with friendly headers.
 */
private fun groupEventsByDay(events: List<ChronicleEvent>): List<Pair<String, List<ChronicleEvent>>> {
    val today = LocalDate.now()
    val yesterday = today.minusDays(1)

    return events
        .groupBy { event -> parseDate(event.timestamp) }
        .toSortedMap(compareByDescending { it })
        .map { (date, dayEvents) ->
            val header = when (date) {
                today -> "TODAY"
                yesterday -> "YESTERDAY"
                else -> date.format(DateTimeFormatter.ofPattern("MMM d"))
            }
            header to dayEvents.sortedByDescending { it.timestamp }
        }
}

/**
 * Parse ISO 8601 timestamp to LocalDate.
 */
private fun parseDate(timestamp: String): LocalDate {
    return try {
        ZonedDateTime.parse(timestamp).toLocalDate()
    } catch (e: DateTimeParseException) {
        // Fallback: try parsing just the date portion
        try {
            LocalDate.parse(timestamp.substringBefore("T"))
        } catch (e2: Exception) {
            LocalDate.now()
        }
    }
}

/**
 * Format timestamp to time string.
 */
private fun formatTime(timestamp: String): String {
    return try {
        val zdt = ZonedDateTime.parse(timestamp)
        zdt.format(DateTimeFormatter.ofPattern("HH:mm"))
    } catch (e: DateTimeParseException) {
        timestamp.substringAfter("T").substringBefore("Z").take(5)
    }
}
