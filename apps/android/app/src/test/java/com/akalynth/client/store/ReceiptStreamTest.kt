package com.akalynth.client.store

import com.akalynth.client.ui.state.ChronicleEventKind
import com.akalynth.client.ui.state.EventSource
import com.akalynth.client.ui.state.EventStatus
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Tests for ReceiptStream (PR 5A-3).
 *
 * Contracts:
 * - R1: Parse chronicle_event messages
 * - R2: Parse chronicle_snapshot messages
 * - R3: Parse receipt_ack messages
 * - R4: Parse receipt_reject messages
 * - R5: Emit parsed messages to flow
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ReceiptStreamTest {

    private lateinit var stream: ReceiptStream

    @Before
    fun setup() {
        stream = ReceiptStream()
    }

    // =========================================================================
    // R1: Parse chronicle_event messages
    // =========================================================================

    @Test
    fun `R1 - parse death event`() = runTest {
        val json = """
            {
                "type": "chronicle_event",
                "payload": {
                    "id": "evt_death_123",
                    "kind": "death",
                    "timestamp": "2026-01-21T12:00:00Z",
                    "zone": "Rookguard",
                    "x": 10,
                    "y": 20,
                    "details": {
                        "killer_name": "TestKiller",
                        "items_lost": ["Sword", "Shield"]
                    }
                }
            }
        """.trimIndent()

        val message = stream.process(json)

        assertTrue(message is ReceiptMessage.Event)
        val event = (message as ReceiptMessage.Event).event
        assertEquals("evt_death_123", event.id)
        assertEquals(ChronicleEventKind.DEATH, event.kind)
        assertEquals("Rookguard", event.zone)
        assertEquals(10, event.x)
        assertEquals(20, event.y)
        assertEquals("TestKiller", event.details.killerName)
        assertEquals(listOf("Sword", "Shield"), event.details.itemsLost)
        assertEquals(EventStatus.CONFIRMED, event.status)
        assertEquals(EventSource.SERVER_RECEIPT, event.source)
    }

    @Test
    fun `R1 - parse zone enter event`() = runTest {
        val json = """
            {
                "type": "chronicle_event",
                "payload": {
                    "id": "evt_zone_123",
                    "kind": "zone_enter",
                    "timestamp": "2026-01-21T12:00:00Z",
                    "zone": "Azura",
                    "x": 32,
                    "y": 32,
                    "details": {
                        "from_zone": "Rookguard"
                    }
                }
            }
        """.trimIndent()

        val message = stream.process(json)

        assertTrue(message is ReceiptMessage.Event)
        val event = (message as ReceiptMessage.Event).event
        assertEquals(ChronicleEventKind.ZONE_ENTER, event.kind)
        assertEquals("Azura", event.zone)
        assertEquals("Rookguard", event.details.fromZone)
    }

    @Test
    fun `R1 - parse item pickup event`() = runTest {
        val json = """
            {
                "type": "chronicle_event",
                "payload": {
                    "id": "evt_pickup_123",
                    "kind": "item_pickup",
                    "timestamp": "2026-01-21T12:00:00Z",
                    "zone": "Rookguard",
                    "x": 15,
                    "y": 25,
                    "details": {
                        "item_name": "Gold Coin"
                    }
                }
            }
        """.trimIndent()

        val message = stream.process(json)

        assertTrue(message is ReceiptMessage.Event)
        val event = (message as ReceiptMessage.Event).event
        assertEquals(ChronicleEventKind.ITEM_PICKUP, event.kind)
        assertEquals("Gold Coin", event.details.itemName)
    }

    @Test
    fun `R1 - parse item drop event with actionId`() = runTest {
        val json = """
            {
                "type": "chronicle_event",
                "payload": {
                    "id": "evt_drop_123",
                    "kind": "item_drop",
                    "timestamp": "2026-01-21T12:00:00Z",
                    "zone": "Rookguard",
                    "x": 15,
                    "y": 25,
                    "action_id": "action_client_456",
                    "details": {
                        "item_name": "Iron Sword"
                    }
                }
            }
        """.trimIndent()

        val message = stream.process(json)

        assertTrue(message is ReceiptMessage.Event)
        val event = (message as ReceiptMessage.Event).event
        assertEquals(ChronicleEventKind.ITEM_DROP, event.kind)
        assertEquals("action_client_456", event.actionId)
    }

    @Test
    fun `R1 - parse combat kill event`() = runTest {
        val json = """
            {
                "type": "chronicle_event",
                "payload": {
                    "id": "evt_kill_123",
                    "kind": "combat_kill",
                    "timestamp": "2026-01-21T12:00:00Z",
                    "zone": "Azura",
                    "x": 50,
                    "y": 60,
                    "details": {
                        "victim_name": "EnemyPlayer"
                    }
                }
            }
        """.trimIndent()

        val message = stream.process(json)

        assertTrue(message is ReceiptMessage.Event)
        val event = (message as ReceiptMessage.Event).event
        assertEquals(ChronicleEventKind.COMBAT_KILL, event.kind)
        assertEquals("EnemyPlayer", event.details.victimName)
    }

    @Test
    fun `R1 - unknown kind becomes UNKNOWN`() = runTest {
        val json = """
            {
                "type": "chronicle_event",
                "payload": {
                    "id": "evt_unknown_123",
                    "kind": "some_future_kind",
                    "timestamp": "2026-01-21T12:00:00Z",
                    "zone": "Rookguard",
                    "x": 10,
                    "y": 20
                }
            }
        """.trimIndent()

        val message = stream.process(json)

        assertTrue(message is ReceiptMessage.Event)
        val event = (message as ReceiptMessage.Event).event
        assertEquals(ChronicleEventKind.UNKNOWN, event.kind)
    }

    // =========================================================================
    // R2: Parse chronicle_snapshot messages
    // =========================================================================

    @Test
    fun `R2 - parse snapshot with multiple events`() = runTest {
        val json = """
            {
                "type": "chronicle_snapshot",
                "payload": {
                    "events": [
                        {
                            "id": "evt_1",
                            "kind": "death",
                            "timestamp": "2026-01-21T12:00:00Z",
                            "zone": "Rookguard",
                            "x": 10,
                            "y": 20
                        },
                        {
                            "id": "evt_2",
                            "kind": "zone_enter",
                            "timestamp": "2026-01-21T11:00:00Z",
                            "zone": "Azura",
                            "x": 32,
                            "y": 32
                        }
                    ],
                    "has_more": true
                }
            }
        """.trimIndent()

        val message = stream.process(json)

        assertTrue(message is ReceiptMessage.Snapshot)
        val snapshot = message as ReceiptMessage.Snapshot
        assertEquals(2, snapshot.events.size)
        assertEquals("evt_1", snapshot.events[0].id)
        assertEquals("evt_2", snapshot.events[1].id)
        assertTrue(snapshot.hasMore)
    }

    @Test
    fun `R2 - parse snapshot with no more`() = runTest {
        val json = """
            {
                "type": "chronicle_snapshot",
                "payload": {
                    "events": [
                        {
                            "id": "evt_1",
                            "kind": "death",
                            "timestamp": "2026-01-21T12:00:00Z",
                            "zone": "Rookguard",
                            "x": 10,
                            "y": 20
                        }
                    ],
                    "has_more": false
                }
            }
        """.trimIndent()

        val message = stream.process(json)

        assertTrue(message is ReceiptMessage.Snapshot)
        assertFalse((message as ReceiptMessage.Snapshot).hasMore)
    }

    @Test
    fun `R2 - parse empty snapshot`() = runTest {
        val json = """
            {
                "type": "chronicle_snapshot",
                "payload": {
                    "events": [],
                    "has_more": false
                }
            }
        """.trimIndent()

        val message = stream.process(json)

        assertTrue(message is ReceiptMessage.Snapshot)
        assertTrue((message as ReceiptMessage.Snapshot).events.isEmpty())
    }

    // =========================================================================
    // R3: Parse receipt_ack messages
    // =========================================================================

    @Test
    fun `R3 - parse receipt ack`() = runTest {
        val json = """
            {
                "type": "receipt_ack",
                "payload": {
                    "action_id": "action_client_123",
                    "event_id": "evt_server_456"
                }
            }
        """.trimIndent()

        val message = stream.process(json)

        assertTrue(message is ReceiptMessage.Ack)
        val ack = message as ReceiptMessage.Ack
        assertEquals("action_client_123", ack.actionId)
        assertEquals("evt_server_456", ack.eventId)
    }

    // =========================================================================
    // R4: Parse receipt_reject messages
    // =========================================================================

    @Test
    fun `R4 - parse receipt reject`() = runTest {
        val json = """
            {
                "type": "receipt_reject",
                "payload": {
                    "action_id": "action_client_123",
                    "reason": "invalid_position"
                }
            }
        """.trimIndent()

        val message = stream.process(json)

        assertTrue(message is ReceiptMessage.Reject)
        val reject = message as ReceiptMessage.Reject
        assertEquals("action_client_123", reject.actionId)
        assertEquals("invalid_position", reject.reason)
    }

    @Test
    fun `R4 - reject with missing reason defaults to unknown`() = runTest {
        val json = """
            {
                "type": "receipt_reject",
                "payload": {
                    "action_id": "action_client_123"
                }
            }
        """.trimIndent()

        val message = stream.process(json)

        assertTrue(message is ReceiptMessage.Reject)
        assertEquals("unknown", (message as ReceiptMessage.Reject).reason)
    }

    // =========================================================================
    // R5: Emit to flow
    // =========================================================================

    @Test
    fun `R5 - process emits to flow`() = runTest {
        val json = """
            {
                "type": "chronicle_event",
                "payload": {
                    "id": "evt_1",
                    "kind": "death",
                    "timestamp": "2026-01-21T12:00:00Z",
                    "zone": "Rookguard",
                    "x": 10,
                    "y": 20
                }
            }
        """.trimIndent()

        val receivedMessage = backgroundScope.async { stream.messages.first() }
        runCurrent()

        stream.process(json)

        assertTrue(receivedMessage.await() is ReceiptMessage.Event)
    }

    @Test
    fun `R5 - processBlocking emits to flow`() {
        val json = """
            {
                "type": "receipt_ack",
                "payload": {
                    "action_id": "action_1",
                    "event_id": "evt_1"
                }
            }
        """.trimIndent()

        val message = stream.processBlocking(json)

        assertNotNull(message)
        assertTrue(message is ReceiptMessage.Ack)
    }

    // =========================================================================
    // Error handling
    // =========================================================================

    @Test
    fun `invalid JSON returns null`() = runTest {
        val message = stream.process("not valid json")
        assertNull(message)
    }

    @Test
    fun `unknown type returns null`() = runTest {
        val json = """{"type": "unknown_type", "payload": {}}"""
        val message = stream.process(json)
        assertNull(message)
    }

    @Test
    fun `missing required fields returns null`() = runTest {
        val json = """
            {
                "type": "chronicle_event",
                "payload": {
                    "id": "evt_1"
                }
            }
        """.trimIndent()

        val message = stream.process(json)
        assertNull(message)
    }

    @Test
    fun `empty details handled gracefully`() = runTest {
        val json = """
            {
                "type": "chronicle_event",
                "payload": {
                    "id": "evt_1",
                    "kind": "death",
                    "timestamp": "2026-01-21T12:00:00Z",
                    "zone": "Rookguard",
                    "x": 10,
                    "y": 20
                }
            }
        """.trimIndent()

        val message = stream.process(json)

        assertTrue(message is ReceiptMessage.Event)
        val event = (message as ReceiptMessage.Event).event
        assertNull(event.details.killerName)
        assertNull(event.details.itemsLost)
    }
}
