package com.akalynth.client.store

import com.akalynth.client.action.ActionBus
import com.akalynth.client.action.ActionIntent
import com.akalynth.client.ui.state.ChronicleEvent
import com.akalynth.client.ui.state.ChronicleEventDetails
import com.akalynth.client.ui.state.ChronicleEventKind
import com.akalynth.client.ui.state.EventSource
import com.akalynth.client.ui.state.EventStatus
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Tests for ChronicleStore (PR 5A-3).
 *
 * Contracts:
 * - S1: Store manages event list
 * - S2: Optimistic events lifecycle
 * - S3: Receipt confirmation/rejection
 * - S4: ActionBus integration
 * - S5: Helper factories
 */
class ChronicleStoreTest {

    private lateinit var store: ChronicleStore
    private lateinit var actionBus: ActionBus

    @Before
    fun setup() {
        actionBus = ActionBus()
        store = ChronicleStore(actionBus)
    }

    // =========================================================================
    // S1: Store manages event list
    // =========================================================================

    @Test
    fun `S1 - store starts empty`() {
        assertEquals(0, store.count())
        assertTrue(store.events.value.isEmpty())
    }

    @Test
    fun `S1 - addFromReceipt adds event`() {
        val event = createServerEvent("evt_1")

        store.addFromReceipt(event)

        assertEquals(1, store.count())
        assertEquals(event, store.findById("evt_1"))
    }

    @Test
    fun `S1 - events are newest first`() {
        store.addFromReceipt(createServerEvent("evt_1", timestamp = "2026-01-21T10:00:00Z"))
        store.addFromReceipt(createServerEvent("evt_2", timestamp = "2026-01-21T11:00:00Z"))

        val events = store.events.value
        assertEquals("evt_2", events[0].id)
        assertEquals("evt_1", events[1].id)
    }

    @Test
    fun `S1 - maxEvents limits storage`() {
        store.maxEvents = 3

        store.addFromReceipt(createServerEvent("evt_1"))
        store.addFromReceipt(createServerEvent("evt_2"))
        store.addFromReceipt(createServerEvent("evt_3"))
        store.addFromReceipt(createServerEvent("evt_4"))

        assertEquals(3, store.count())
        assertNull(store.findById("evt_1"))  // Oldest removed
    }

    @Test
    fun `S1 - clear removes all events`() {
        store.addFromReceipt(createServerEvent("evt_1"))
        store.addFromReceipt(createServerEvent("evt_2"))

        store.clear()

        assertEquals(0, store.count())
    }

    @Test
    fun `S1 - replaceAll replaces events`() {
        store.addFromReceipt(createServerEvent("evt_old"))

        store.replaceAll(listOf(
            createServerEvent("evt_new_1"),
            createServerEvent("evt_new_2")
        ))

        assertEquals(2, store.count())
        assertNull(store.findById("evt_old"))
        assertNotNull(store.findById("evt_new_1"))
    }

    // =========================================================================
    // S2: Optimistic events lifecycle
    // =========================================================================

    @Test
    fun `S2 - addOptimistic adds pending event`() {
        val event = createOptimisticEvent("pending_1", "action_1")

        store.addOptimistic(event)

        assertEquals(1, store.count())
        assertEquals(1, store.pendingCount())
        assertEquals(event, store.findPendingByActionId("action_1"))
    }

    @Test
    fun `S2 - addOptimistic requires CLIENT_INTENT source`() {
        val event = createServerEvent("evt_1")

        assertThrows(IllegalArgumentException::class.java) {
            store.addOptimistic(event)
        }
    }

    @Test
    fun `S2 - addOptimistic requires PENDING status`() {
        val event = ChronicleEvent(
            id = "evt_1",
            kind = ChronicleEventKind.ITEM_DROP,
            timestamp = "2026-01-21T12:00:00Z",
            zone = "Rookguard",
            x = 10,
            y = 20,
            status = EventStatus.CONFIRMED,  // Wrong status
            source = EventSource.CLIENT_INTENT,
            actionId = "action_1"
        )

        assertThrows(IllegalArgumentException::class.java) {
            store.addOptimistic(event)
        }
    }

    @Test
    fun `S2 - getPendingEvents returns only pending`() {
        store.addOptimistic(createOptimisticEvent("pending_1", "action_1"))
        store.addFromReceipt(createServerEvent("evt_1"))

        val pending = store.getPendingEvents()

        assertEquals(1, pending.size)
        assertEquals("pending_1", pending[0].id)
    }

    @Test
    fun `S2 - getConfirmedEvents returns only confirmed`() {
        store.addOptimistic(createOptimisticEvent("pending_1", "action_1"))
        store.addFromReceipt(createServerEvent("evt_1"))

        val confirmed = store.getConfirmedEvents()

        assertEquals(1, confirmed.size)
        assertEquals("evt_1", confirmed[0].id)
    }

    // =========================================================================
    // S3: Receipt confirmation/rejection
    // =========================================================================

    @Test
    fun `S3 - confirmEvent updates pending to confirmed`() {
        store.addOptimistic(createOptimisticEvent("pending_1", "action_1"))

        val confirmed = store.confirmEvent("pending_1", "evt_server_1")

        assertNotNull(confirmed)
        assertEquals("evt_server_1", confirmed?.id)
        assertEquals(EventStatus.CONFIRMED, confirmed?.status)
        assertEquals(0, store.pendingCount())
    }

    @Test
    fun `S3 - confirmEvent returns null for unknown id`() {
        val confirmed = store.confirmEvent("unknown", "evt_1")
        assertNull(confirmed)
    }

    @Test
    fun `S3 - rejectByActionId updates pending to rejected`() {
        store.addOptimistic(createOptimisticEvent("pending_1", "action_1"))

        val rejected = store.rejectByActionId("action_1")

        assertNotNull(rejected)
        assertEquals(EventStatus.REJECTED, rejected?.status)
        assertEquals(0, store.pendingCount())
    }

    @Test
    fun `S3 - rejectByActionId returns null for unknown actionId`() {
        val rejected = store.rejectByActionId("unknown_action")
        assertNull(rejected)
    }

    @Test
    fun `S3 - addFromReceipt confirms matching pending`() {
        store.addOptimistic(createOptimisticEvent("pending_1", "action_1"))

        val serverEvent = ChronicleEvent(
            id = "evt_server_1",
            kind = ChronicleEventKind.ITEM_DROP,
            timestamp = "2026-01-21T12:00:00Z",
            zone = "Rookguard",
            x = 10,
            y = 20,
            status = EventStatus.CONFIRMED,
            source = EventSource.SERVER_RECEIPT,
            actionId = "action_1"  // Matches pending
        )

        store.addFromReceipt(serverEvent)

        // Should have confirmed the pending, not added new
        assertEquals(1, store.count())
        assertEquals(0, store.pendingCount())
        assertNotNull(store.findById("evt_server_1"))
    }

    // =========================================================================
    // S4: ActionBus integration
    // =========================================================================

    @Test
    fun `S4 - addFromReceipt completes action in bus`() = runTest {
        val intent = ActionIntent.Drop(slotIndex = 0, itemId = "sword_1")
        actionBus.dispatch(intent)

        store.addOptimistic(createOptimisticEvent("pending_1", intent.actionId))

        val serverEvent = ChronicleEvent(
            id = "evt_server_1",
            kind = ChronicleEventKind.ITEM_DROP,
            timestamp = "2026-01-21T12:00:00Z",
            zone = "Rookguard",
            x = 10,
            y = 20,
            status = EventStatus.CONFIRMED,
            source = EventSource.SERVER_RECEIPT,
            actionId = intent.actionId
        )

        store.addFromReceipt(serverEvent)

        // ActionBus should have completed
        assertNull(actionBus.getPending(intent.actionId))
    }

    @Test
    fun `S4 - rejectByActionId rejects in bus`() = runTest {
        val intent = ActionIntent.Drop(slotIndex = 0, itemId = "sword_1")
        actionBus.dispatch(intent)

        store.addOptimistic(createOptimisticEvent("pending_1", intent.actionId))
        store.rejectByActionId(intent.actionId)

        // ActionBus should have rejected
        assertNull(actionBus.getPending(intent.actionId))
    }

    // =========================================================================
    // S5: Helper factories
    // =========================================================================

    @Test
    fun `S5 - createOptimisticDrop creates correct event`() {
        val intent = ActionIntent.Drop(slotIndex = 0, itemId = "sword_1")

        val event = ChronicleStore.createOptimisticDrop(
            intent = intent,
            zone = "Rookguard",
            x = 10,
            y = 20,
            itemName = "Iron Sword"
        )

        assertTrue(event.id.startsWith("pending_"))
        assertEquals(ChronicleEventKind.ITEM_DROP, event.kind)
        assertEquals("Rookguard", event.zone)
        assertEquals(10, event.x)
        assertEquals(20, event.y)
        assertEquals("Iron Sword", event.details.itemName)
        assertEquals(EventStatus.PENDING, event.status)
        assertEquals(EventSource.CLIENT_INTENT, event.source)
        assertEquals(intent.actionId, event.actionId)
    }

    @Test
    fun `S5 - createOptimisticPickup creates correct event`() {
        val intent = ActionIntent.Pickup(itemId = "gold_1", x = 15, y = 25)

        val event = ChronicleStore.createOptimisticPickup(
            intent = intent,
            zone = "Azura",
            itemName = "Gold Coin"
        )

        assertTrue(event.id.startsWith("pending_"))
        assertEquals(ChronicleEventKind.ITEM_PICKUP, event.kind)
        assertEquals("Azura", event.zone)
        assertEquals(15, event.x)
        assertEquals(25, event.y)
        assertEquals("Gold Coin", event.details.itemName)
        assertEquals(EventStatus.PENDING, event.status)
        assertEquals(EventSource.CLIENT_INTENT, event.source)
        assertEquals(intent.actionId, event.actionId)
    }

    // =========================================================================
    // Query helpers
    // =========================================================================

    @Test
    fun `getEventsByKind filters correctly`() {
        store.addFromReceipt(createServerEvent("evt_1", kind = ChronicleEventKind.DEATH))
        store.addFromReceipt(createServerEvent("evt_2", kind = ChronicleEventKind.ITEM_DROP))
        store.addFromReceipt(createServerEvent("evt_3", kind = ChronicleEventKind.DEATH))

        val deaths = store.getEventsByKind(ChronicleEventKind.DEATH)

        assertEquals(2, deaths.size)
        assertTrue(deaths.all { it.kind == ChronicleEventKind.DEATH })
    }

    @Test
    fun `getRecentEvents returns limited count`() {
        store.addFromReceipt(createServerEvent("evt_1"))
        store.addFromReceipt(createServerEvent("evt_2"))
        store.addFromReceipt(createServerEvent("evt_3"))

        val recent = store.getRecentEvents(2)

        assertEquals(2, recent.size)
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private fun createServerEvent(
        id: String,
        kind: ChronicleEventKind = ChronicleEventKind.DEATH,
        timestamp: String = "2026-01-21T12:00:00Z"
    ) = ChronicleEvent(
        id = id,
        kind = kind,
        timestamp = timestamp,
        zone = "Rookguard",
        x = 10,
        y = 20,
        status = EventStatus.CONFIRMED,
        source = EventSource.SERVER_RECEIPT
    )

    private fun createOptimisticEvent(
        id: String,
        actionId: String
    ) = ChronicleEvent(
        id = id,
        kind = ChronicleEventKind.ITEM_DROP,
        timestamp = "2026-01-21T12:00:00Z",
        zone = "Rookguard",
        x = 10,
        y = 20,
        status = EventStatus.PENDING,
        source = EventSource.CLIENT_INTENT,
        actionId = actionId
    )
}
