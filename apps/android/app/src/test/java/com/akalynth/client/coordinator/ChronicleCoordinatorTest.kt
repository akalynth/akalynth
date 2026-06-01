package com.akalynth.client.coordinator

import com.akalynth.client.action.ActionIntent
import com.akalynth.client.protocol.Direction
import com.akalynth.client.ui.state.ChronicleEventKind
import com.akalynth.client.ui.state.EventSource
import com.akalynth.client.ui.state.EventStatus
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Tests for ChronicleCoordinator (PR 5A-4).
 *
 * Contracts:
 * - W1: Wires store, bus, and stream
 * - W2: Dispatch creates optimistic events
 * - W3: Processes receipt messages
 * - W4: Emits death notices
 * - W5: Handles snapshots and pagination
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ChronicleCoordinatorTest {

    private lateinit var testScope: TestScope
    private lateinit var coordinator: ChronicleCoordinator

    @Before
    fun setup() {
        testScope = TestScope(UnconfinedTestDispatcher())
        coordinator = ChronicleCoordinator(testScope)
    }

    // =========================================================================
    // W1: Wires store, bus, and stream
    // =========================================================================

    @Test
    fun `W1 - coordinator has action bus`() {
        assertNotNull(coordinator.actionBus)
    }

    @Test
    fun `W1 - coordinator has chronicle store`() {
        assertNotNull(coordinator.chronicleStore)
    }

    @Test
    fun `W1 - coordinator has receipt stream`() {
        assertNotNull(coordinator.receiptStream)
    }

    @Test
    fun `W1 - events flow reflects store state`() = runTest {
        val json = """
            {
                "type": "chronicle_event",
                "payload": {
                    "id": "evt_1",
                    "kind": "zone_enter",
                    "timestamp": "2026-01-21T12:00:00Z",
                    "zone": "Rookguard",
                    "x": 10,
                    "y": 20
                }
            }
        """.trimIndent()

        coordinator.processMessage(json)

        assertEquals(1, coordinator.events.value.size)
        assertEquals("evt_1", coordinator.events.value[0].id)
    }

    // =========================================================================
    // W2: Dispatch creates optimistic events
    // =========================================================================

    @Test
    fun `W2 - dispatch Drop creates optimistic event`() = runTest {
        coordinator.updatePosition("Rookguard", 10, 20)

        val intent = ActionIntent.Drop(slotIndex = 0, itemId = "sword_1")
        coordinator.dispatch(intent)

        assertEquals(1, coordinator.chronicleStore.count())
        val event = coordinator.chronicleStore.events.value[0]
        assertEquals(ChronicleEventKind.ITEM_DROP, event.kind)
        assertEquals(EventStatus.PENDING, event.status)
        assertEquals(EventSource.CLIENT_INTENT, event.source)
        assertEquals(intent.actionId, event.actionId)
    }

    @Test
    fun `W2 - dispatch Pickup creates optimistic event`() = runTest {
        coordinator.updatePosition("Azura", 30, 40)

        val intent = ActionIntent.Pickup(itemId = "gold_1", x = 30, y = 40)
        coordinator.dispatch(intent)

        assertEquals(1, coordinator.chronicleStore.count())
        val event = coordinator.chronicleStore.events.value[0]
        assertEquals(ChronicleEventKind.ITEM_PICKUP, event.kind)
        assertEquals(EventStatus.PENDING, event.status)
    }

    @Test
    fun `W2 - dispatch Move does not create chronicle event`() = runTest {
        val intent = ActionIntent.Move(
            direction = Direction.NORTH
        )
        coordinator.dispatch(intent)

        assertEquals(0, coordinator.chronicleStore.count())
    }

    @Test
    fun `W2 - dispatch adds to action bus`() = runTest {
        val intent = ActionIntent.Drop(slotIndex = 0, itemId = "sword_1")
        coordinator.dispatch(intent)

        assertNotNull(coordinator.actionBus.getPending(intent.actionId))
    }

    // =========================================================================
    // W3: Processes receipt messages
    // =========================================================================

    @Test
    fun `W3 - processMessage adds event to store`() = runTest {
        val json = """
            {
                "type": "chronicle_event",
                "payload": {
                    "id": "evt_death_1",
                    "kind": "death",
                    "timestamp": "2026-01-21T12:00:00Z",
                    "zone": "Rookguard",
                    "x": 10,
                    "y": 20,
                    "details": {
                        "killer_name": "TestKiller"
                    }
                }
            }
        """.trimIndent()

        coordinator.processMessage(json)

        assertEquals(1, coordinator.chronicleStore.count())
        assertEquals("evt_death_1", coordinator.chronicleStore.findById("evt_death_1")?.id)
    }

    @Test
    fun `W3 - processMessage confirms pending on matching actionId`() = runTest {
        // Create pending event
        coordinator.updatePosition("Rookguard", 10, 20)
        val intent = ActionIntent.Drop(slotIndex = 0, itemId = "sword_1")
        coordinator.dispatch(intent)

        assertEquals(1, coordinator.chronicleStore.pendingCount())

        // Receive ack from server
        val json = """
            {
                "type": "receipt_ack",
                "payload": {
                    "action_id": "${intent.actionId}",
                    "event_id": "evt_server_1"
                }
            }
        """.trimIndent()

        coordinator.processMessage(json)

        assertEquals(0, coordinator.chronicleStore.pendingCount())
    }

    @Test
    fun `W3 - processMessage rejects pending on reject message`() = runTest {
        // Create pending event
        coordinator.updatePosition("Rookguard", 10, 20)
        val intent = ActionIntent.Drop(slotIndex = 0, itemId = "sword_1")
        coordinator.dispatch(intent)

        // Receive reject from server
        val json = """
            {
                "type": "receipt_reject",
                "payload": {
                    "action_id": "${intent.actionId}",
                    "reason": "inventory_full"
                }
            }
        """.trimIndent()

        coordinator.processMessage(json)

        assertEquals(0, coordinator.chronicleStore.pendingCount())
        val event = coordinator.chronicleStore.events.value[0]
        assertEquals(EventStatus.REJECTED, event.status)
    }

    // =========================================================================
    // W4: Emits death notices
    // =========================================================================

    @Test
    fun `W4 - death event emits notice`() = runTest {
        var receivedNotice: com.akalynth.client.ui.state.DeathNotice? = null
        val job = launch {
            receivedNotice = coordinator.deathNotices.first()
        }

        val json = """
            {
                "type": "chronicle_event",
                "payload": {
                    "id": "evt_death_1",
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

        coordinator.processMessage(json)
        job.join()

        assertNotNull(receivedNotice)
        assertEquals("TestKiller", receivedNotice?.killerName)
        assertEquals("Rookguard", receivedNotice?.zone)
        assertEquals(listOf("Sword", "Shield"), receivedNotice?.itemsLost)
        assertEquals("evt_death_1", receivedNotice?.chronicleEventId)
    }

    @Test
    fun `W4 - non-death event does not emit notice`() = runTest {
        var noticeCount = 0
        val job = launch {
            coordinator.deathNotices.collect { noticeCount++ }
        }

        val json = """
            {
                "type": "chronicle_event",
                "payload": {
                    "id": "evt_zone_1",
                    "kind": "zone_enter",
                    "timestamp": "2026-01-21T12:00:00Z",
                    "zone": "Azura",
                    "x": 32,
                    "y": 32
                }
            }
        """.trimIndent()

        coordinator.processMessage(json)

        // Give time for any emissions
        testScope.testScheduler.advanceUntilIdle()

        assertEquals(0, noticeCount)
        job.cancel()
    }

    // =========================================================================
    // W5: Handles snapshots and pagination
    // =========================================================================

    @Test
    fun `W5 - snapshot replaces all on initial load`() = runTest {
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

        coordinator.processMessage(json)

        assertEquals(2, coordinator.chronicleStore.count())
        assertTrue(coordinator.hasMore.value)
    }

    @Test
    fun `W5 - snapshot updates hasMore`() = runTest {
        val json = """
            {
                "type": "chronicle_snapshot",
                "payload": {
                    "events": [],
                    "has_more": false
                }
            }
        """.trimIndent()

        coordinator.processMessage(json)

        assertFalse(coordinator.hasMore.value)
    }

    // =========================================================================
    // Position updates
    // =========================================================================

    @Test
    fun `updatePosition sets zone and coords`() = runTest {
        coordinator.updatePosition("Azura", 50, 60)

        // Verify by dispatching and checking event
        val intent = ActionIntent.Drop(slotIndex = 0, itemId = "sword_1")
        coordinator.dispatch(intent)

        val event = coordinator.chronicleStore.events.value[0]
        assertEquals("Azura", event.zone)
        assertEquals(50, event.x)
        assertEquals(60, event.y)
    }

    // =========================================================================
    // Cleanup
    // =========================================================================

    @Test
    fun `cleanup removes expired actions`() = runTest {
        val intent = ActionIntent.Drop(slotIndex = 0, itemId = "sword_1")
        coordinator.dispatch(intent)

        // Force cleanup with 0ms age (everything expired)
        coordinator.actionBus.cleanupExpired(0)

        assertEquals(0, coordinator.actionBus.pendingCount())
    }
}
