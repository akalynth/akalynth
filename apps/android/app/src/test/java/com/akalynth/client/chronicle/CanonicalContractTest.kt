package com.akalynth.client.chronicle

import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Canonical contract tests for PR 5A-1.
 *
 * Test groups:
 * A) Mapping tests - Receipt → ChronicleEvent
 * B) Idempotency tests - Same receipt twice = 1 event
 * C) Pending upgrade test - Core lifecycle
 */
class CanonicalContractTest {

    private lateinit var store: ChronicleStore

    @Before
    fun setup() {
        store = ChronicleStore()
    }

    // =========================================================================
    // A) Mapping tests
    // =========================================================================

    @Test
    fun `A - death receipt maps to DEATH kind with CONFIRMED status`() {
        val receipt = Receipt(
            receiptId = "receipt_death_123",
            actionId = null,
            type = "death",
            timestampMs = 1705838400000,
            payload = mapOf(
                "zone" to "Rookguard",
                "x" to 10,
                "y" to 20,
                "killer_name" to "TestKiller",
                "items_lost" to listOf("Sword", "Shield")
            )
        )

        val event = ReceiptToChronicleEvent.map(receipt)

        assertEquals("receipt_death_123", event.eventId)
        assertEquals(ChronicleEventKind.DEATH, event.kind)
        assertEquals(EventStatus.CONFIRMED, event.status)
        assertEquals(EventSource.SERVER_RECEIPT, event.source)
        assertEquals("Rookguard", event.zone)
        assertEquals(10, event.x)
        assertEquals(20, event.y)
        assertEquals("TestKiller", event.killerName)
        assertEquals(listOf("Sword", "Shield"), event.itemsLost)
    }

    @Test
    fun `A - item_drop receipt maps to ITEM_DROP kind`() {
        val receipt = Receipt(
            receiptId = "receipt_drop_456",
            actionId = "action_client_123",
            type = "item_drop",
            timestampMs = 1705838400000,
            payload = mapOf(
                "zone" to "Azura",
                "x" to 50,
                "y" to 60,
                "item_name" to "Iron Sword"
            )
        )

        val event = ReceiptToChronicleEvent.map(receipt)

        assertEquals(ChronicleEventKind.ITEM_DROP, event.kind)
        assertEquals("action_client_123", event.actionId)
        assertEquals("Iron Sword", event.itemName)
    }

    @Test
    fun `A - zone_enter receipt maps to ZONE_ENTER kind`() {
        val receipt = Receipt(
            receiptId = "receipt_zone_789",
            actionId = null,
            type = "zone_enter",
            timestampMs = 1705838400000,
            payload = mapOf(
                "zone" to "Azura",
                "x" to 32,
                "y" to 32,
                "from_zone" to "Rookguard"
            )
        )

        val event = ReceiptToChronicleEvent.map(receipt)

        assertEquals(ChronicleEventKind.ZONE_ENTER, event.kind)
        assertEquals("Rookguard", event.fromZone)
    }

    @Test
    fun `A - unknown type maps to UNKNOWN kind but still CONFIRMED`() {
        val receipt = Receipt(
            receiptId = "receipt_unknown_999",
            actionId = null,
            type = "some_future_event_type",
            timestampMs = 1705838400000,
            payload = emptyMap()
        )

        val event = ReceiptToChronicleEvent.map(receipt)

        assertEquals(ChronicleEventKind.UNKNOWN, event.kind)
        assertEquals(EventStatus.CONFIRMED, event.status)
        assertEquals(EventSource.SERVER_RECEIPT, event.source)
    }

    @Test
    fun `A - world event receipt maps to WORLD_EVENT kind`() {
        val receipt = Receipt(
            receiptId = "receipt_world_event",
            actionId = null,
            type = "world_event_resolved",
            timestampMs = 1705838400000,
            payload = mapOf(
                "zone" to "Azura",
                "event_id" to "witness_moth_bloom",
                "phase" to "resolved",
                "outcome" to "controlled_release"
            )
        )

        val event = ReceiptToChronicleEvent.map(receipt)

        assertEquals(ChronicleEventKind.WORLD_EVENT, event.kind)
        assertEquals("witness_moth_bloom", event.worldEventId)
        assertEquals("resolved", event.worldEventPhase)
        assertEquals("controlled_release", event.worldEventOutcome)
    }

    @Test
    fun `A - optional fields extracted correctly when present`() {
        val receipt = Receipt(
            receiptId = "receipt_full",
            actionId = null,
            type = "death",
            timestampMs = 1705838400000,
            payload = mapOf(
                "zone" to "Rookguard",
                "x" to 15,
                "y" to 25
            )
        )

        val event = ReceiptToChronicleEvent.map(receipt)

        assertEquals("Rookguard", event.zone)
        assertEquals(15, event.x)
        assertEquals(25, event.y)
    }

    @Test
    fun `A - optional fields null when missing`() {
        val receipt = Receipt(
            receiptId = "receipt_minimal",
            actionId = null,
            type = "death",
            timestampMs = 1705838400000,
            payload = emptyMap()
        )

        val event = ReceiptToChronicleEvent.map(receipt)

        assertNull(event.zone)
        assertNull(event.x)
        assertNull(event.y)
    }

    // =========================================================================
    // B) Idempotency tests
    // =========================================================================

    @Test
    fun `B - same receipt twice results in 1 event only`() = runTest {
        val receipt = Receipt(
            receiptId = "receipt_dup",
            actionId = null,
            type = "death",
            timestampMs = 1705838400000,
            payload = mapOf("zone" to "Rookguard")
        )

        store.upsertReceipt(receipt)
        store.upsertReceipt(receipt)

        assertEquals(1, store.count())
    }

    @Test
    fun `B - receipt without actionId keyed by receiptId`() = runTest {
        val receipt = Receipt(
            receiptId = "receipt_no_action",
            actionId = null,
            type = "zone_enter",
            timestampMs = 1705838400000,
            payload = emptyMap()
        )

        store.upsertReceipt(receipt)

        // Key should be "e:receipt_no_action"
        val event = store.getByKey("e:receipt_no_action")
        assertNotNull(event)
        assertEquals("receipt_no_action", event?.eventId)
    }

    @Test
    fun `B - receipt with actionId keyed by actionId`() = runTest {
        val receipt = Receipt(
            receiptId = "receipt_with_action",
            actionId = "action_xyz",
            type = "item_drop",
            timestampMs = 1705838400000,
            payload = emptyMap()
        )

        store.upsertReceipt(receipt)

        // Key should be "a:action_xyz"
        val event = store.getByKey("a:action_xyz")
        assertNotNull(event)
        assertEquals("receipt_with_action", event?.eventId)
    }

    @Test
    fun `B - two different receipts create two events`() = runTest {
        val receipt1 = Receipt(
            receiptId = "receipt_1",
            actionId = null,
            type = "death",
            timestampMs = 1705838400000,
            payload = emptyMap()
        )
        val receipt2 = Receipt(
            receiptId = "receipt_2",
            actionId = null,
            type = "zone_enter",
            timestampMs = 1705838500000,
            payload = emptyMap()
        )

        store.upsertReceipt(receipt1)
        store.upsertReceipt(receipt2)

        assertEquals(2, store.count())
    }

    // =========================================================================
    // C) Pending upgrade test (CORE)
    // =========================================================================

    @Test
    fun `C - pending intent upgraded by receipt with matching actionId`() = runTest {
        // 1. Insert pending intent
        val pending = ChronicleEvent(
            eventId = "synthetic_pending",
            actionId = "abc",
            kind = ChronicleEventKind.ITEM_DROP,
            timestampMs = 1705838300000,  // Earlier local timestamp
            zone = "Rookguard",
            x = 10,
            y = 20,
            details = mapOf("item_name" to "Sword"),
            status = EventStatus.PENDING,
            source = EventSource.CLIENT_INTENT
        )
        store.upsert(pending)

        // Verify pending is stored
        assertEquals(1, store.count())
        assertEquals(1, store.pendingCount())

        // 2. Ingest receipt with actionId="abc"
        val receipt = Receipt(
            receiptId = "server_receipt_123",
            actionId = "abc",
            type = "item_drop",
            timestampMs = 1705838400000,  // Server timestamp
            payload = mapOf(
                "zone" to "Rookguard",
                "x" to 10,
                "y" to 20,
                "item_name" to "Sword"
            )
        )
        store.upsertReceipt(receipt)

        // 3. Assert store has exactly one event
        assertEquals(1, store.count())
        assertEquals(0, store.pendingCount())

        // 4. Assert the event was upgraded
        val event = store.getByActionId("abc")
        assertNotNull(event)
        assertEquals(EventStatus.CONFIRMED, event?.status)
        assertEquals(EventSource.SERVER_RECEIPT, event?.source)
        assertEquals("server_receipt_123", event?.eventId)  // eventId becomes receiptId
        assertEquals(1705838400000, event?.timestampMs)      // timestamp becomes server timestamp
    }

    @Test
    fun `C - pending event stays pending if receipt has different actionId`() = runTest {
        val pending = ChronicleEvent(
            eventId = "synthetic_1",
            actionId = "action_A",
            kind = ChronicleEventKind.ITEM_DROP,
            timestampMs = 1705838300000,
            status = EventStatus.PENDING,
            source = EventSource.CLIENT_INTENT
        )
        store.upsert(pending)

        val receipt = Receipt(
            receiptId = "receipt_different",
            actionId = "action_B",  // Different actionId
            type = "item_drop",
            timestampMs = 1705838400000,
            payload = emptyMap()
        )
        store.upsertReceipt(receipt)

        // Should have 2 events now
        assertEquals(2, store.count())
        assertEquals(1, store.pendingCount())

        // Original pending still exists
        val originalPending = store.getByActionId("action_A")
        assertNotNull(originalPending)
        assertEquals(EventStatus.PENDING, originalPending?.status)
    }

    @Test
    fun `C - confirmed event not overwritten by pending`() = runTest {
        // First, add confirmed event
        val confirmed = ChronicleEvent(
            eventId = "confirmed_123",
            actionId = "action_X",
            kind = ChronicleEventKind.ITEM_DROP,
            timestampMs = 1705838400000,
            status = EventStatus.CONFIRMED,
            source = EventSource.SERVER_RECEIPT
        )
        store.upsert(confirmed)

        // Try to add pending with same actionId
        val pending = ChronicleEvent(
            eventId = "synthetic_later",
            actionId = "action_X",
            kind = ChronicleEventKind.ITEM_DROP,
            timestampMs = 1705838500000,  // Later timestamp
            status = EventStatus.PENDING,
            source = EventSource.CLIENT_INTENT
        )
        store.upsert(pending)

        // Should still have 1 event, confirmed wins
        assertEquals(1, store.count())
        val event = store.getByActionId("action_X")
        assertEquals(EventStatus.CONFIRMED, event?.status)
        assertEquals("confirmed_123", event?.eventId)
    }

    // =========================================================================
    // ChronicleKey tests
    // =========================================================================

    @Test
    fun `ChronicleKey - event with actionId keyed by actionId`() {
        val event = ChronicleEvent(
            eventId = "evt_123",
            actionId = "action_abc",
            kind = ChronicleEventKind.DEATH,
            timestampMs = 1705838400000
        )

        assertEquals("a:action_abc", ChronicleKey.keyFor(event))
    }

    @Test
    fun `ChronicleKey - event without actionId keyed by eventId`() {
        val event = ChronicleEvent(
            eventId = "evt_456",
            actionId = null,
            kind = ChronicleEventKind.DEATH,
            timestampMs = 1705838400000
        )

        assertEquals("e:evt_456", ChronicleKey.keyFor(event))
    }

    @Test
    fun `ChronicleKey - receipt with actionId keyed by actionId`() {
        val receipt = Receipt(
            receiptId = "receipt_789",
            actionId = "action_xyz",
            type = "death",
            timestampMs = 1705838400000,
            payload = emptyMap()
        )

        assertEquals("a:action_xyz", ChronicleKey.keyFor(receipt))
    }

    @Test
    fun `ChronicleKey - receipt without actionId keyed by receiptId`() {
        val receipt = Receipt(
            receiptId = "receipt_999",
            actionId = null,
            type = "death",
            timestampMs = 1705838400000,
            payload = emptyMap()
        )

        assertEquals("e:receipt_999", ChronicleKey.keyFor(receipt))
    }

    // =========================================================================
    // Merge policy tests
    // =========================================================================

    @Test
    fun `merge - null existing returns incoming`() {
        val incoming = ChronicleEvent(
            eventId = "evt_1",
            kind = ChronicleEventKind.DEATH,
            timestampMs = 1705838400000,
            status = EventStatus.PENDING
        )

        val result = ChronicleStore.merge(null, incoming)

        assertEquals(incoming, result)
    }

    @Test
    fun `merge - confirmed wins over pending`() {
        val pending = ChronicleEvent(
            eventId = "pending_1",
            kind = ChronicleEventKind.DEATH,
            timestampMs = 1705838300000,
            status = EventStatus.PENDING
        )
        val confirmed = ChronicleEvent(
            eventId = "confirmed_1",
            kind = ChronicleEventKind.DEATH,
            timestampMs = 1705838400000,
            status = EventStatus.CONFIRMED
        )

        val result = ChronicleStore.merge(pending, confirmed)

        assertEquals(confirmed, result)
    }

    @Test
    fun `merge - pending does not overwrite confirmed`() {
        val confirmed = ChronicleEvent(
            eventId = "confirmed_1",
            kind = ChronicleEventKind.DEATH,
            timestampMs = 1705838400000,
            status = EventStatus.CONFIRMED
        )
        val pending = ChronicleEvent(
            eventId = "pending_1",
            kind = ChronicleEventKind.DEATH,
            timestampMs = 1705838500000,  // Later
            status = EventStatus.PENDING
        )

        val result = ChronicleStore.merge(confirmed, pending)

        assertEquals(confirmed, result)
    }

    @Test
    fun `merge - both confirmed keeps newer`() {
        val older = ChronicleEvent(
            eventId = "older",
            kind = ChronicleEventKind.DEATH,
            timestampMs = 1705838400000,
            status = EventStatus.CONFIRMED
        )
        val newer = ChronicleEvent(
            eventId = "newer",
            kind = ChronicleEventKind.DEATH,
            timestampMs = 1705838500000,
            status = EventStatus.CONFIRMED
        )

        val result = ChronicleStore.merge(older, newer)

        assertEquals(newer, result)
    }

    @Test
    fun `merge - both pending keeps earlier`() {
        val earlier = ChronicleEvent(
            eventId = "earlier",
            kind = ChronicleEventKind.DEATH,
            timestampMs = 1705838400000,
            status = EventStatus.PENDING
        )
        val later = ChronicleEvent(
            eventId = "later",
            kind = ChronicleEventKind.DEATH,
            timestampMs = 1705838500000,
            status = EventStatus.PENDING
        )

        val result = ChronicleStore.merge(earlier, later)

        assertEquals(earlier, result)
    }

    // =========================================================================
    // Store ordering tests
    // =========================================================================

    @Test
    fun `store orders events by timestamp descending`() = runTest {
        val event1 = ChronicleEvent(
            eventId = "evt_old",
            kind = ChronicleEventKind.DEATH,
            timestampMs = 1705838300000,
            status = EventStatus.CONFIRMED,
            source = EventSource.SERVER_RECEIPT
        )
        val event2 = ChronicleEvent(
            eventId = "evt_new",
            kind = ChronicleEventKind.ZONE_ENTER,
            timestampMs = 1705838400000,
            status = EventStatus.CONFIRMED,
            source = EventSource.SERVER_RECEIPT
        )

        store.upsert(event1)
        store.upsert(event2)

        val events = store.events.value
        assertEquals("evt_new", events[0].eventId)
        assertEquals("evt_old", events[1].eventId)
    }
}
