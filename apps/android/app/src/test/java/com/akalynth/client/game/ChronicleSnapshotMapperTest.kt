package com.akalynth.client.game

import com.akalynth.client.protocol.ChronicleEvent as WireChronicleEvent
import com.akalynth.client.protocol.ChronicleSnapshotMessage
import com.akalynth.client.protocol.EvidenceRef
import com.akalynth.client.ui.state.ChronicleEventKind
import com.akalynth.client.ui.state.EventSource
import com.akalynth.client.ui.state.EventStatus
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ChronicleSnapshotMapperTest {
    @Test
    fun mapsSnapshotEventsAsServerReceipts() {
        val snapshot = ChronicleSnapshotMessage(
            playerId = "player-1",
            hasMore = true,
            events = listOf(
                WireChronicleEvent(
                    kind = "world_event_contribution",
                    timestamp = "2026-06-06T08:00:00Z",
                    zone = "Azura",
                    x = 12,
                    y = 34,
                    details = buildJsonObject {
                        put("event_id", "witness_moth_bloom")
                        put("phase", "active")
                        put("contribution_id", "verify_testimony")
                        put("outcome", "accepted")
                    },
                    evidenceRef = EvidenceRef(
                        chronicleEventId = 42,
                        receiptHash = "receipt-hash"
                    )
                )
            )
        )

        val mapped = ChronicleSnapshotMapper.map(snapshot)
        val event = mapped.events.single()

        assertEquals(true, mapped.hasMore)
        assertEquals("42", event.id)
        assertEquals(ChronicleEventKind.WORLD_EVENT, event.kind)
        assertEquals(EventStatus.CONFIRMED, event.status)
        assertEquals(EventSource.SERVER_RECEIPT, event.source)
        assertEquals("Azura", event.zone)
        assertEquals(12, event.x)
        assertEquals(34, event.y)
        assertEquals("witness_moth_bloom", event.details.eventId)
        assertEquals("active", event.details.phase)
        assertEquals("verify_testimony", event.details.contributionId)
        assertEquals("accepted", event.details.outcome)
    }

    @Test
    fun mapsDeathDetailsAndListPayloads() {
        val event = ChronicleSnapshotMapper.mapEvent(
            WireChronicleEvent(
                kind = "death",
                timestamp = "2026-06-06T08:10:00Z",
                zone = "HighCity",
                x = 4,
                y = 5,
                details = buildJsonObject {
                    put("killer_name", "Glassfang")
                    put("items_lost", buildJsonArray {
                        add("Lantern frame")
                        add("Field note")
                    })
                }
            )
        )

        assertEquals(ChronicleEventKind.DEATH, event.kind)
        assertEquals("Glassfang", event.details.killerName)
        assertEquals(listOf("Lantern frame", "Field note"), event.details.itemsLost)
        assertEquals(EventSource.SERVER_RECEIPT, event.source)
    }

    @Test
    fun missingOptionalFieldsUseHonestFallbacks() {
        val event = ChronicleSnapshotMapper.mapEvent(
            WireChronicleEvent(
                kind = "unexpected_server_kind",
                timestamp = "2026-06-06T08:20:00Z"
            ),
            index = 7
        )

        assertEquals("unexpected_server_kind_2026-06-06T08:20:00Z_7", event.id)
        assertEquals(ChronicleEventKind.UNKNOWN, event.kind)
        assertEquals("Unknown", event.zone)
        assertEquals(0, event.x)
        assertEquals(0, event.y)
        assertNull(event.details.eventId)
        assertEquals(EventStatus.CONFIRMED, event.status)
        assertEquals(EventSource.SERVER_RECEIPT, event.source)
    }
}
