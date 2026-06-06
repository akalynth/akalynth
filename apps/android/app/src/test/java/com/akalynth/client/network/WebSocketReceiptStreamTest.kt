package com.akalynth.client.network

import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Tests for WebSocketReceiptStream parsing.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class WebSocketReceiptStreamTest {

    private lateinit var connection: FakeWebSocketConnection
    private lateinit var stream: WebSocketReceiptStream

    @Before
    fun setup() {
        connection = FakeWebSocketConnection()
        stream = WebSocketReceiptStream(connection)
    }

    private fun TestScope.captureNextReceipt() =
        backgroundScope.async { stream.receipts().first() }.also { runCurrent() }

    // =========================================================================
    // chronicle_event parsing
    // =========================================================================

    @Test
    fun `parses death event`() = runTest {
        connection.connect()

        val receipt = captureNextReceipt()

        connection.receiveFromServer("""
            {
                "type": "chronicle_event",
                "payload": {
                    "id": "evt_death_123",
                    "kind": "death",
                    "timestamp": "2026-01-21T12:00:00Z",
                    "zone": "Rookguard",
                    "x": 10,
                    "y": 20
                }
            }
        """.trimIndent())

        val actual = receipt.await()
        assertEquals("evt_death_123", actual.receiptId)
        assertEquals("death", actual.type)
        assertEquals("Rookguard", actual.payload["zone"])
        assertEquals(10, actual.payload["x"])
        assertEquals(20, actual.payload["y"])
    }

    @Test
    fun `parses event with actionId`() = runTest {
        connection.connect()

        val receipt = captureNextReceipt()

        connection.receiveFromServer("""
            {
                "type": "chronicle_event",
                "payload": {
                    "id": "evt_drop_123",
                    "kind": "item_drop",
                    "timestamp": "2026-01-21T12:00:00Z",
                    "action_id": "action_client_456",
                    "zone": "Rookguard",
                    "x": 10,
                    "y": 20
                }
            }
        """.trimIndent())

        assertEquals("action_client_456", receipt.await().actionId)
    }

    @Test
    fun `parses event without actionId`() = runTest {
        connection.connect()

        val receipt = captureNextReceipt()

        connection.receiveFromServer("""
            {
                "type": "chronicle_event",
                "payload": {
                    "id": "evt_zone_123",
                    "kind": "zone_enter",
                    "timestamp": "2026-01-21T12:00:00Z",
                    "zone": "Azura",
                    "x": 32,
                    "y": 32
                }
            }
        """.trimIndent())

        assertNull(receipt.await().actionId)
    }

    @Test
    fun `parses timestamp_ms field`() = runTest {
        connection.connect()

        val receipt = captureNextReceipt()

        connection.receiveFromServer("""
            {
                "type": "chronicle_event",
                "payload": {
                    "id": "evt_1",
                    "kind": "death",
                    "timestamp_ms": 1705838400000
                }
            }
        """.trimIndent())

        assertEquals(1705838400000L, receipt.await().timestampMs)
    }

    @Test
    fun `parses ISO timestamp string`() = runTest {
        connection.connect()

        val receipt = captureNextReceipt()

        connection.receiveFromServer("""
            {
                "type": "chronicle_event",
                "payload": {
                    "id": "evt_1",
                    "kind": "death",
                    "timestamp": "2026-01-21T12:00:00Z"
                }
            }
        """.trimIndent())

        // 2026-01-21T12:00:00Z = 1769083200000
        assertTrue(receipt.await().timestampMs > 0)
    }

    // =========================================================================
    // chronicle_snapshot parsing
    // =========================================================================

    @Test
    fun `parseSnapshot extracts multiple receipts`() {
        val json = """
            {
                "type": "chronicle_snapshot",
                "payload": {
                    "events": [
                        {
                            "id": "evt_1",
                            "kind": "death",
                            "timestamp_ms": 1705838400000,
                            "zone": "Rookguard",
                            "x": 10,
                            "y": 20
                        },
                        {
                            "id": "evt_2",
                            "kind": "zone_enter",
                            "timestamp_ms": 1705838500000,
                            "zone": "Azura",
                            "x": 32,
                            "y": 32
                        }
                    ],
                    "has_more": false
                }
            }
        """.trimIndent()

        val receipts = WebSocketReceiptStream.parseSnapshot(json)

        assertEquals(2, receipts.size)
        assertEquals("evt_1", receipts[0].receiptId)
        assertEquals("death", receipts[0].type)
        assertEquals("evt_2", receipts[1].receiptId)
        assertEquals("zone_enter", receipts[1].type)
    }

    @Test
    fun `parseSnapshot with empty events`() {
        val json = """
            {
                "type": "chronicle_snapshot",
                "payload": {
                    "events": [],
                    "has_more": false
                }
            }
        """.trimIndent()

        val receipts = WebSocketReceiptStream.parseSnapshot(json)

        assertTrue(receipts.isEmpty())
    }

    @Test
    fun `parseSnapshot ignores non-snapshot messages`() {
        val json = """
            {
                "type": "chronicle_event",
                "payload": {
                    "id": "evt_1",
                    "kind": "death"
                }
            }
        """.trimIndent()

        val receipts = WebSocketReceiptStream.parseSnapshot(json)

        assertTrue(receipts.isEmpty())
    }

    // =========================================================================
    // Ignored message types
    // =========================================================================

    @Test
    fun `receipt_ack not emitted`() = runTest {
        connection.connect()

        var receiptCount = 0
        val job = backgroundScope.launch {
            stream.receipts().collect { receiptCount++ }
        }
        runCurrent()

        connection.receiveFromServer("""
            {
                "type": "receipt_ack",
                "payload": {
                    "action_id": "abc",
                    "event_id": "evt_1"
                }
            }
        """.trimIndent())

        runCurrent()

        assertEquals(0, receiptCount)
        job.cancel()
    }

    @Test
    fun `unknown message type not emitted`() = runTest {
        connection.connect()

        var receiptCount = 0
        val job = backgroundScope.launch {
            stream.receipts().collect { receiptCount++ }
        }
        runCurrent()

        connection.receiveFromServer("""
            {
                "type": "some_other_message",
                "payload": {}
            }
        """.trimIndent())

        runCurrent()

        assertEquals(0, receiptCount)
        job.cancel()
    }

    @Test
    fun `invalid JSON not emitted`() = runTest {
        connection.connect()

        var receiptCount = 0
        val job = backgroundScope.launch {
            stream.receipts().collect { receiptCount++ }
        }
        runCurrent()

        connection.receiveFromServer("not valid json")

        runCurrent()

        assertEquals(0, receiptCount)
        job.cancel()
    }

    // =========================================================================
    // Replay provider
    // =========================================================================

    @Test
    fun `replay returns from provider`() = runTest {
        val replayReceipts = listOf(
            com.akalynth.client.chronicle.Receipt("r1", null, "death", 1705838400000, emptyMap()),
            com.akalynth.client.chronicle.Receipt("r2", null, "zone_enter", 1705838500000, emptyMap())
        )

        val stream = WebSocketReceiptStream(
            connection = connection,
            replayProvider = { replayReceipts }
        )

        val result = stream.replay()

        assertEquals(2, result.size)
        assertEquals("r1", result[0].receiptId)
        assertEquals("r2", result[1].receiptId)
    }

    @Test
    fun `default replay returns empty`() = runTest {
        val result = stream.replay()
        assertTrue(result.isEmpty())
    }
}
