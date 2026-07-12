package com.akalynth.client.network

import com.akalynth.client.actions.ActionBus
import com.akalynth.client.actions.FixedClock
import com.akalynth.client.actions.SequentialActionIdGenerator
import com.akalynth.client.chronicle.ChronicleEventKind
import com.akalynth.client.chronicle.ChronicleStore
import com.akalynth.client.chronicle.EventSource
import com.akalynth.client.chronicle.EventStatus
import com.akalynth.client.chronicle.Receipt
import com.akalynth.client.ui.components.hotbar.ItemRarity
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Test suite for PR 5A-3: ReceiptStream + Ingestion + Transport.
 *
 * Test groups:
 * A) Transport tests (Action → send)
 * B) Receipt ingestion tests (Replay + Live)
 * C) Pending upgrade integration
 * D) Ordering stability
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ReceiptIngestionTest {

    private lateinit var chronicle: ChronicleStore
    private lateinit var testScope: TestScope

    @Before
    fun setup() {
        chronicle = ChronicleStore()
        testScope = TestScope(UnconfinedTestDispatcher())
    }

    // =========================================================================
    // A) Transport tests (Action → send)
    // =========================================================================

    @Test
    fun `A - transport sends intent with correct actionId`() = runTest {
        val connection = FakeWebSocketConnection()
        connection.connect()
        val transport = WebSocketActionTransport(connection)

        val ids = SequentialActionIdGenerator()
        val actionBus = ActionBus(ids, chronicle, transport)

        actionBus.dispatchDropHotbarSlot(0, "sword", "Sword", ItemRarity.COMMON)

        assertEquals(1, connection.sentCount)
        val sent = connection.lastSent!!
        assertTrue(sent.contains("\"action_id\":\"a-0001\""))
        assertTrue(sent.contains("\"type\":\"drop_item\""))
    }

    @Test
    fun `A - transport sends correct payload for drop`() = runTest {
        val connection = FakeWebSocketConnection()
        connection.connect()
        val transport = WebSocketActionTransport(connection)

        val ids = SequentialActionIdGenerator()
        val actionBus = ActionBus(ids, chronicle, transport)

        actionBus.dispatchDropHotbarSlot(2, "legendary_sword", "Dragon Slayer", ItemRarity.LEGENDARY)

        val sent = connection.lastSent!!
        assertTrue(sent.contains("\"item_id\":\"legendary_sword\""))
    }

    @Test
    fun `A - no double send per dispatch`() = runTest {
        val connection = FakeWebSocketConnection()
        connection.connect()
        val transport = WebSocketActionTransport(connection)

        val ids = SequentialActionIdGenerator()
        val actionBus = ActionBus(ids, chronicle, transport)

        actionBus.dispatchAttack()

        assertEquals(1, connection.sentCount)
    }

    @Test
    fun `A - multiple dispatches send multiple times`() = runTest {
        val connection = FakeWebSocketConnection()
        connection.connect()
        val transport = WebSocketActionTransport(connection)

        val ids = SequentialActionIdGenerator()
        val actionBus = ActionBus(ids, chronicle, transport)

        actionBus.dispatchAttack()
        actionBus.dispatchDropHotbarSlot(0, "sword", "Sword", ItemRarity.COMMON)
        actionBus.dispatchPickupItem("gold", "Gold", 10, 20)

        assertEquals(3, connection.sentCount)
    }

    // =========================================================================
    // B) Receipt ingestion tests (Replay + Live)
    // =========================================================================

    @Test
    fun `B - replay loads confirmed events`() = runTest {
        val replayReceipts = listOf(
            Receipt("r1", null, "death", 1705838400000, mapOf("zone" to "Rookguard")),
            Receipt("r2", null, "zone_enter", 1705838500000, mapOf("zone" to "Azura")),
            Receipt("r3", null, "item_pickup", 1705838600000, mapOf("item_name" to "Gold"))
        )
        val stream = FakeReceiptStream(replayReceipts)
        val service = ReceiptIngestionService(stream, chronicle)

        service.start(testScope)

        assertEquals(3, chronicle.count())
        assertEquals(0, chronicle.pendingCount())

        val events = chronicle.events.value
        assertTrue(events.all { it.status == EventStatus.CONFIRMED })
        assertTrue(events.all { it.source == EventSource.SERVER_RECEIPT })
    }

    @Test
    fun `B - live receipts upsert`() = runTest {
        val stream = FakeReceiptStream()
        val service = ReceiptIngestionService(stream, chronicle)

        service.start(testScope)

        // Emit live receipt
        stream.emit(Receipt("r1", null, "death", 1705838400000, emptyMap()))
        testScope.advanceUntilIdle()

        assertEquals(1, chronicle.count())
    }

    @Test
    fun `B - duplicate receipts dont duplicate rows`() = runTest {
        val stream = FakeReceiptStream()
        val service = ReceiptIngestionService(stream, chronicle)

        service.start(testScope)

        // Emit same receipt twice
        val receipt = Receipt("r1", null, "death", 1705838400000, emptyMap())
        stream.emit(receipt)
        testScope.advanceUntilIdle()
        stream.emit(receipt)
        testScope.advanceUntilIdle()

        assertEquals(1, chronicle.count())
    }

    @Test
    fun `B - replay then live both work`() = runTest {
        val replayReceipts = listOf(
            Receipt("replay_1", null, "death", 1705838400000, emptyMap())
        )
        val stream = FakeReceiptStream(replayReceipts)
        val service = ReceiptIngestionService(stream, chronicle)

        service.start(testScope)

        assertEquals(1, chronicle.count())

        // Now live receipt
        stream.emit(Receipt("live_1", null, "zone_enter", 1705838500000, emptyMap()))
        testScope.advanceUntilIdle()

        assertEquals(2, chronicle.count())
    }

    // =========================================================================
    // C) Pending upgrade integration
    // =========================================================================

    @Test
    fun `C - pending event upgraded by receipt with same actionId`() = runTest {
        val stream = FakeReceiptStream()
        val transport = object : com.akalynth.client.actions.ActionTransport {
            override suspend fun send(intent: com.akalynth.client.actions.ActionIntent) {}
        }

        val ids = SequentialActionIdGenerator()
        val clock = FixedClock(1705838300000)
        val actionBus = ActionBus(ids, chronicle, transport, clock)
        actionBus.updatePosition("Rookguard", 10, 20)

        // Start ingestion service
        val service = ReceiptIngestionService(stream, chronicle)
        service.start(testScope)

        // 1. Dispatch action via ActionBus (creates pending)
        val intent = actionBus.dispatchDropHotbarSlot(0, "sword", "Iron Sword", ItemRarity.COMMON)

        assertEquals(1, chronicle.count())
        assertEquals(1, chronicle.pendingCount())

        // 2. Server sends receipt with same actionId
        stream.emit(Receipt(
            receiptId = "server_receipt_123",
            actionId = intent.actionId,
            type = "item_drop",
            timestampMs = 1705838400000,
            payload = mapOf("zone" to "Rookguard", "item_name" to "Iron Sword")
        ))
        testScope.advanceUntilIdle()

        // 3. Assert: single row, upgraded to CONFIRMED
        assertEquals(1, chronicle.count())
        assertEquals(0, chronicle.pendingCount())

        val event = chronicle.getByActionId(intent.actionId)
        assertNotNull(event)
        assertEquals(EventStatus.CONFIRMED, event?.status)
        assertEquals(EventSource.SERVER_RECEIPT, event?.source)
        assertEquals("server_receipt_123", event?.eventId)
    }

    @Test
    fun `C - multiple pending events upgraded correctly`() = runTest {
        val stream = FakeReceiptStream()
        val transport = object : com.akalynth.client.actions.ActionTransport {
            override suspend fun send(intent: com.akalynth.client.actions.ActionIntent) {}
        }

        val ids = SequentialActionIdGenerator()
        val actionBus = ActionBus(ids, chronicle, transport)
        actionBus.updatePosition("Rookguard", 10, 20)

        val service = ReceiptIngestionService(stream, chronicle)
        service.start(testScope)

        // Dispatch 3 actions
        val intent1 = actionBus.dispatchDropHotbarSlot(0, "sword", "Sword", ItemRarity.COMMON)
        val intent2 = actionBus.dispatchPickupItem("gold", "Gold", 15, 25)
        val intent3 = actionBus.dispatchAttack()

        assertEquals(3, chronicle.count())
        assertEquals(3, chronicle.pendingCount())

        // Confirm only intent1 and intent3
        stream.emit(Receipt("receipt_1", intent1.actionId, "item_drop", 1705838400000, emptyMap()))
        testScope.advanceUntilIdle()
        stream.emit(Receipt("receipt_3", intent3.actionId, "combat_kill", 1705838500000, emptyMap()))
        testScope.advanceUntilIdle()

        assertEquals(3, chronicle.count())
        assertEquals(1, chronicle.pendingCount())

        assertEquals(EventStatus.CONFIRMED, chronicle.getByActionId(intent1.actionId)?.status)
        assertEquals(EventStatus.PENDING, chronicle.getByActionId(intent2.actionId)?.status)
        assertEquals(EventStatus.CONFIRMED, chronicle.getByActionId(intent3.actionId)?.status)
    }

    @Test
    fun `C - replay confirms pending events`() = runTest {
        val transport = object : com.akalynth.client.actions.ActionTransport {
            override suspend fun send(intent: com.akalynth.client.actions.ActionIntent) {}
        }

        val ids = SequentialActionIdGenerator()
        val actionBus = ActionBus(ids, chronicle, transport)

        // Create pending event
        val intent = actionBus.dispatchDropHotbarSlot(0, "sword", "Sword", ItemRarity.COMMON)
        assertEquals(1, chronicle.pendingCount())

        // Replay with matching receipt
        val replayReceipts = listOf(
            Receipt("server_123", intent.actionId, "item_drop", 1705838400000, emptyMap())
        )
        val stream = FakeReceiptStream(replayReceipts)
        val service = ReceiptIngestionService(stream, chronicle)

        service.start(testScope)

        assertEquals(1, chronicle.count())
        assertEquals(0, chronicle.pendingCount())
        assertEquals(EventStatus.CONFIRMED, chronicle.getByActionId(intent.actionId)?.status)
    }

    // =========================================================================
    // D) Ordering stability
    // =========================================================================

    @Test
    fun `D - receipts out of order maintain deterministic sort`() = runTest {
        val stream = FakeReceiptStream()
        val service = ReceiptIngestionService(stream, chronicle)

        service.start(testScope)

        // Emit receipts out of timestamp order
        stream.emit(Receipt("r3", null, "death", 1705838600000, emptyMap())) // newest
        testScope.advanceUntilIdle()
        stream.emit(Receipt("r1", null, "death", 1705838400000, emptyMap())) // oldest
        testScope.advanceUntilIdle()
        stream.emit(Receipt("r2", null, "death", 1705838500000, emptyMap())) // middle
        testScope.advanceUntilIdle()

        val events = chronicle.events.value

        // Should be sorted by timestamp descending
        assertEquals("r3", events[0].eventId)
        assertEquals("r2", events[1].eventId)
        assertEquals("r1", events[2].eventId)
    }

    @Test
    fun `D - same timestamp sorts by eventId`() = runTest {
        val stream = FakeReceiptStream()
        val service = ReceiptIngestionService(stream, chronicle)

        service.start(testScope)

        // Emit receipts with same timestamp
        stream.emit(Receipt("r_c", null, "death", 1705838400000, emptyMap()))
        testScope.advanceUntilIdle()
        stream.emit(Receipt("r_a", null, "zone_enter", 1705838400000, emptyMap()))
        testScope.advanceUntilIdle()
        stream.emit(Receipt("r_b", null, "item_pickup", 1705838400000, emptyMap()))
        testScope.advanceUntilIdle()

        val events = chronicle.events.value

        // Same timestamp → sorted by eventId ascending
        assertEquals("r_a", events[0].eventId)
        assertEquals("r_b", events[1].eventId)
        assertEquals("r_c", events[2].eventId)
    }

    // =========================================================================
    // Service lifecycle tests
    // =========================================================================

    @Test
    fun `service isRunning reflects state`() = runTest {
        val stream = FakeReceiptStream()
        val service = ReceiptIngestionService(stream, chronicle)

        assertFalse(service.isRunning())

        service.start(testScope)
        assertTrue(service.isRunning())

        service.stop()
        assertFalse(service.isRunning())
    }

    @Test
    fun `service stop cancels live subscription`() = runTest {
        val stream = FakeReceiptStream()
        val service = ReceiptIngestionService(stream, chronicle)

        service.start(testScope)
        service.stop()

        // Emit after stop - should not be ingested
        stream.tryEmit(Receipt("r1", null, "death", 1705838400000, emptyMap()))
        testScope.advanceUntilIdle()

        assertEquals(0, chronicle.count())
    }
}
