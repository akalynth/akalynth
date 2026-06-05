package com.akalynth.client.ui.components.why

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.akalynth.client.ui.state.ChronicleEvent
import com.akalynth.client.ui.state.WhyContext

/**
 * Why explanation sheet for contextual help.
 *
 * Displays:
 * - Current zone context
 * - Recent events with explanations
 * - Actionable tips based on game state
 *
 * Contracts (M1-M4):
 * - M1: Only opens from None state (overlay contention)
 * - M2: Shows zone-specific context
 * - M3: Lists recent events with explanations
 * - M4: Dismiss returns to None state
 *
 * @param context Why context with zone and recent events
 * @param onDismiss Called when sheet is dismissed
 * @param onEventClick Called when an event is clicked for details
 * @param modifier Optional modifier
 */
@Composable
fun WhyExplanationSheet(
    context: WhyContext,
    onDismiss: () -> Unit,
    onEventClick: (ChronicleEvent) -> Unit = {},
    modifier: Modifier = Modifier
) {
    // Scrim that dismisses on tap
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.7f))
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onDismiss
            )
            .testTag("WhyExplanationSheet_Scrim"),
        contentAlignment = Alignment.Center
    ) {
        // Content card
        Column(
            modifier = Modifier
                .fillMaxWidth(0.9f)
                .background(Color(0xFF1A1A2E), RoundedCornerShape(16.dp))
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    onClick = {} // Consume click
                )
                .padding(24.dp)
                .testTag("WhyExplanationSheet_Content"),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Header
            Text(
                text = "?",
                fontSize = 36.sp,
                color = Color(0xFF4CAF50),
                fontWeight = FontWeight.Bold,
                modifier = Modifier.testTag("WhyExplanationSheet_Icon")
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "Why did this happen?",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White,
                modifier = Modifier.testTag("WhyExplanationSheet_Title")
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Zone context
            ZoneContextSection(
                zone = context.zone,
                modifier = Modifier.testTag("WhyExplanationSheet_ZoneContext")
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Recent events with explanations
            if (context.recentEvents.isNotEmpty()) {
                Text(
                    text = "Recent Events",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color.Gray,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("WhyExplanationSheet_EventsHeader")
                )

                Spacer(modifier = Modifier.height(8.dp))

                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp)
                        .testTag("WhyExplanationSheet_EventsList"),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(context.recentEvents) { event ->
                        EventExplanationRow(
                            event = event,
                            onClick = { onEventClick(event) },
                            modifier = Modifier.testTag("WhyExplanationSheet_Event_${event.id}")
                        )
                    }
                }
            } else {
                // No recent events
                Text(
                    text = "No recent events to explain.\nKeep playing to see what happens!",
                    fontSize = 14.sp,
                    color = Color.Gray,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .padding(vertical = 24.dp)
                        .testTag("WhyExplanationSheet_NoEvents")
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Topic-specific help (if provided)
            context.topic?.let { topic ->
                TopicHelpSection(
                    topic = topic,
                    modifier = Modifier.testTag("WhyExplanationSheet_Topic")
                )
                Spacer(modifier = Modifier.height(16.dp))
            }

            // Dismiss button
            Button(
                onClick = onDismiss,
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF424242)
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("WhyExplanationSheet_DismissButton")
            ) {
                Text(
                    text = "GOT IT",
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

/**
 * Zone context section.
 */
@Composable
private fun ZoneContextSection(
    zone: String,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(Color(0xFF0B1020), RoundedCornerShape(8.dp))
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(
            text = "\uD83D\uDDFA",  // Map emoji
            fontSize = 20.sp
        )
        Column {
            Text(
                text = "Current Zone",
                fontSize = 12.sp,
                color = Color.Gray
            )
            Text(
                text = zone,
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium,
                color = Color.White
            )
        }
    }
}

/**
 * Event explanation row.
 */
@Composable
private fun EventExplanationRow(
    event: ChronicleEvent,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(Color(0xFF0B1020), RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Event icon
        Text(
            text = event.kind.icon,
            fontSize = 24.sp,
            modifier = Modifier.size(32.dp)
        )

        // Event details
        Column(
            modifier = Modifier.weight(1f)
        ) {
            Text(
                text = getEventTitle(event),
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = Color.White
            )
            Text(
                text = getEventExplanation(event),
                fontSize = 12.sp,
                color = Color.Gray
            )
        }

        // Arrow indicator if tappable
        if (event.kind.isTappable) {
            Text(
                text = "\u203A",  // Right arrow
                fontSize = 20.sp,
                color = Color.Gray
            )
        }
    }
}

/**
 * Topic-specific help section.
 */
@Composable
private fun TopicHelpSection(
    topic: String,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(Color(0xFF2E7D32).copy(alpha = 0.2f), RoundedCornerShape(8.dp))
            .padding(12.dp)
    ) {
        Text(
            text = "\uD83D\uDCA1 Tip",  // Lightbulb
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            color = Color(0xFF4CAF50)
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = getTopicHelp(topic),
            fontSize = 14.sp,
            color = Color.White
        )
    }
}

/**
 * Get event title for display.
 */
private fun getEventTitle(event: ChronicleEvent): String {
    return when (event.kind) {
        com.akalynth.client.ui.state.ChronicleEventKind.DEATH -> {
            val killer = event.details.killerName ?: "the environment"
            "Died to $killer"
        }
        com.akalynth.client.ui.state.ChronicleEventKind.ZONE_ENTER -> "Entered ${event.zone}"
        com.akalynth.client.ui.state.ChronicleEventKind.ITEM_PICKUP -> "Picked up ${event.details.itemName ?: "an item"}"
        com.akalynth.client.ui.state.ChronicleEventKind.ITEM_DROP -> "Dropped ${event.details.itemName ?: "an item"}"
        com.akalynth.client.ui.state.ChronicleEventKind.COMBAT_KILL -> "Defeated ${event.details.victimName ?: "an enemy"}"
        com.akalynth.client.ui.state.ChronicleEventKind.TUTORIAL_COMPLETE -> "Completed tutorial"
        com.akalynth.client.ui.state.ChronicleEventKind.CHARACTER_CREATED -> "Character created"
        com.akalynth.client.ui.state.ChronicleEventKind.WORLD_EVENT -> "World event recorded"
        com.akalynth.client.ui.state.ChronicleEventKind.UNKNOWN -> "Unknown event"
    }
}

/**
 * Get event explanation.
 */
private fun getEventExplanation(event: ChronicleEvent): String {
    return when (event.kind) {
        com.akalynth.client.ui.state.ChronicleEventKind.DEATH -> {
            val itemCount = event.details.itemsLost?.size ?: 0
            if (itemCount > 0) "Lost $itemCount item(s) on death" else "No items lost"
        }
        com.akalynth.client.ui.state.ChronicleEventKind.ZONE_ENTER -> {
            event.details.fromZone?.let { "Came from $it" } ?: "Entered a new area"
        }
        com.akalynth.client.ui.state.ChronicleEventKind.ITEM_PICKUP -> "Added to inventory"
        com.akalynth.client.ui.state.ChronicleEventKind.ITEM_DROP -> "Removed from inventory"
        com.akalynth.client.ui.state.ChronicleEventKind.COMBAT_KILL -> "Victory in combat"
        com.akalynth.client.ui.state.ChronicleEventKind.TUTORIAL_COMPLETE -> "Ready for the real game"
        com.akalynth.client.ui.state.ChronicleEventKind.CHARACTER_CREATED -> "Your journey begins"
        com.akalynth.client.ui.state.ChronicleEventKind.WORLD_EVENT -> {
            event.details.outcome?.let { "Outcome: ${it.replace("_", " ")}" }
                ?: event.details.contributionId?.let { "Contribution: ${it.replace("_", " ")}" }
                ?: "The server recorded this world event step"
        }
        com.akalynth.client.ui.state.ChronicleEventKind.UNKNOWN -> "Something happened"
    }
}

/**
 * Get topic-specific help text.
 */
private fun getTopicHelp(topic: String): String {
    return when (topic.lowercase()) {
        "death" -> "When you die, you may lose some items. Rare items are less likely to drop. Check your Chronicle for details."
        "combat" -> "Combat is turn-based. Higher level players deal more damage. Use potions to heal during battle."
        "inventory" -> "Long-press items in your hotbar to drop them. Legendary items require a slide to confirm."
        "zones" -> "Different zones have different dangers. Rookguard is safe for beginners. Azura is more challenging."
        else -> "Check your Chronicle for a history of events. Tap death events for detailed explanations."
    }
}
