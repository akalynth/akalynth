package com.akalynth.client.ui.state

import org.junit.Assert.*
import org.junit.Test

/**
 * Tests for canonical ChronicleEvent model (PR 5A-1).
 *
 * Contracts:
 * - E1: EventStatus lifecycle (Pending → Confirmed | Rejected)
 * - E2: EventSource discrimination (ServerReceipt vs ClientIntent)
 * - E3: Status/source extension functions
 * - E4: Event confirmation and rejection transforms
 */
class ChronicleEventModelTest {

    // =========================================================================
    // E1: EventStatus lifecycle
    // =========================================================================

    @Test
    fun `E1 - EventStatus has three values`() {
        val values = EventStatus.entries
        assertEquals(3, values.size)
        assertTrue(values.contains(EventStatus.PENDING))
        assertTrue(values.contains(EventStatus.CONFIRMED))
        assertTrue(values.contains(EventStatus.REJECTED))
    }

    @Test
    fun `E1 - default status is CONFIRMED`() {
        val event = createTestEvent()
        assertEquals(EventStatus.CONFIRMED, event.status)
    }

    @Test
    fun `E1 - pending event has PENDING status`() {
        val event = createTestEvent(status = EventStatus.PENDING)
        assertEquals(EventStatus.PENDING, event.status)
    }

    @Test
    fun `E1 - rejected event has REJECTED status`() {
        val event = createTestEvent(status = EventStatus.REJECTED)
        assertEquals(EventStatus.REJECTED, event.status)
    }

    // =========================================================================
    // E2: EventSource discrimination
    // =========================================================================

    @Test
    fun `E2 - EventSource has two values`() {
        val values = EventSource.entries
        assertEquals(2, values.size)
        assertTrue(values.contains(EventSource.SERVER_RECEIPT))
        assertTrue(values.contains(EventSource.CLIENT_INTENT))
    }

    @Test
    fun `E2 - default source is SERVER_RECEIPT`() {
        val event = createTestEvent()
        assertEquals(EventSource.SERVER_RECEIPT, event.source)
    }

    @Test
    fun `E2 - client intent source is CLIENT_INTENT`() {
        val event = createTestEvent(source = EventSource.CLIENT_INTENT)
        assertEquals(EventSource.CLIENT_INTENT, event.source)
    }

    @Test
    fun `E2 - actionId is null by default`() {
        val event = createTestEvent()
        assertNull(event.actionId)
    }

    @Test
    fun `E2 - actionId can be set for client intents`() {
        val event = createTestEvent(
            source = EventSource.CLIENT_INTENT,
            actionId = "action_123"
        )
        assertEquals("action_123", event.actionId)
    }

    // =========================================================================
    // E3: Status extension functions
    // =========================================================================

    @Test
    fun `E3 - isPending returns true for PENDING`() {
        val event = createTestEvent(status = EventStatus.PENDING)
        assertTrue(event.isPending())
        assertFalse(event.isConfirmed())
        assertFalse(event.isRejected())
    }

    @Test
    fun `E3 - isConfirmed returns true for CONFIRMED`() {
        val event = createTestEvent(status = EventStatus.CONFIRMED)
        assertFalse(event.isPending())
        assertTrue(event.isConfirmed())
        assertFalse(event.isRejected())
    }

    @Test
    fun `E3 - isRejected returns true for REJECTED`() {
        val event = createTestEvent(status = EventStatus.REJECTED)
        assertFalse(event.isPending())
        assertFalse(event.isConfirmed())
        assertTrue(event.isRejected())
    }

    @Test
    fun `E3 - isOptimistic returns true for CLIENT_INTENT`() {
        val event = createTestEvent(source = EventSource.CLIENT_INTENT)
        assertTrue(event.isOptimistic())
        assertFalse(event.isAuthoritative())
    }

    @Test
    fun `E3 - isAuthoritative returns true for SERVER_RECEIPT`() {
        val event = createTestEvent(source = EventSource.SERVER_RECEIPT)
        assertFalse(event.isOptimistic())
        assertTrue(event.isAuthoritative())
    }

    // =========================================================================
    // E4: Event confirmation and rejection transforms
    // =========================================================================

    @Test
    fun `E4 - confirm updates id and status`() {
        val pending = createTestEvent(
            id = "pending_123",
            status = EventStatus.PENDING,
            source = EventSource.CLIENT_INTENT
        )

        val confirmed = pending.confirm(serverId = "evt_server_456")

        assertEquals("evt_server_456", confirmed.id)
        assertEquals(EventStatus.CONFIRMED, confirmed.status)
        assertEquals(EventSource.SERVER_RECEIPT, confirmed.source)
    }

    @Test
    fun `E4 - confirm preserves other fields`() {
        val pending = createTestEvent(
            id = "pending_123",
            kind = ChronicleEventKind.ITEM_DROP,
            timestamp = "2026-01-21T10:00:00Z",
            zone = "Azura",
            x = 50,
            y = 60,
            status = EventStatus.PENDING,
            source = EventSource.CLIENT_INTENT,
            actionId = "action_abc"
        )

        val confirmed = pending.confirm(serverId = "evt_server_789")

        // Preserved fields
        assertEquals(ChronicleEventKind.ITEM_DROP, confirmed.kind)
        assertEquals("2026-01-21T10:00:00Z", confirmed.timestamp)
        assertEquals("Azura", confirmed.zone)
        assertEquals(50, confirmed.x)
        assertEquals(60, confirmed.y)
        assertEquals("action_abc", confirmed.actionId)

        // Updated fields
        assertEquals("evt_server_789", confirmed.id)
        assertEquals(EventStatus.CONFIRMED, confirmed.status)
        assertEquals(EventSource.SERVER_RECEIPT, confirmed.source)
    }

    @Test
    fun `E4 - reject updates status only`() {
        val pending = createTestEvent(
            id = "pending_123",
            status = EventStatus.PENDING,
            source = EventSource.CLIENT_INTENT
        )

        val rejected = pending.reject()

        assertEquals("pending_123", rejected.id)  // ID preserved
        assertEquals(EventStatus.REJECTED, rejected.status)
        assertEquals(EventSource.CLIENT_INTENT, rejected.source)  // Source preserved
    }

    @Test
    fun `E4 - reject preserves all other fields`() {
        val pending = createTestEvent(
            id = "pending_456",
            kind = ChronicleEventKind.ITEM_PICKUP,
            timestamp = "2026-01-21T11:00:00Z",
            zone = "Rookguard",
            x = 20,
            y = 30,
            status = EventStatus.PENDING,
            source = EventSource.CLIENT_INTENT,
            actionId = "action_xyz"
        )

        val rejected = pending.reject()

        assertEquals("pending_456", rejected.id)
        assertEquals(ChronicleEventKind.ITEM_PICKUP, rejected.kind)
        assertEquals("2026-01-21T11:00:00Z", rejected.timestamp)
        assertEquals("Rookguard", rejected.zone)
        assertEquals(20, rejected.x)
        assertEquals(30, rejected.y)
        assertEquals("action_xyz", rejected.actionId)
        assertEquals(EventStatus.REJECTED, rejected.status)
    }

    // =========================================================================
    // DeathNotice.toChronicleEvent() integration
    // =========================================================================

    @Test
    fun `DeathNotice toChronicleEvent sets CONFIRMED status`() {
        val notice = DeathNotice(
            killerName = "TestKiller",
            zone = "Rookguard",
            x = 10,
            y = 20,
            timestamp = "2026-01-21T12:00:00Z",
            chronicleEventId = "evt_death_123"
        )

        val event = notice.toChronicleEvent()

        assertEquals(EventStatus.CONFIRMED, event.status)
    }

    @Test
    fun `DeathNotice toChronicleEvent sets SERVER_RECEIPT source`() {
        val notice = DeathNotice(
            killerName = "TestKiller",
            zone = "Rookguard",
            x = 10,
            y = 20,
            timestamp = "2026-01-21T12:00:00Z"
        )

        val event = notice.toChronicleEvent()

        assertEquals(EventSource.SERVER_RECEIPT, event.source)
    }

    @Test
    fun `DeathNotice toChronicleEvent has null actionId`() {
        val notice = DeathNotice(
            killerName = "TestKiller",
            zone = "Rookguard",
            x = 10,
            y = 20,
            timestamp = "2026-01-21T12:00:00Z"
        )

        val event = notice.toChronicleEvent()

        assertNull(event.actionId)
    }

    @Test
    fun `DeathNotice toChronicleEvent uses chronicleEventId when present`() {
        val notice = DeathNotice(
            killerName = "TestKiller",
            zone = "Rookguard",
            x = 10,
            y = 20,
            timestamp = "2026-01-21T12:00:00Z",
            chronicleEventId = "evt_death_server_id"
        )

        val event = notice.toChronicleEvent()

        assertEquals("evt_death_server_id", event.id)
    }

    @Test
    fun `DeathNotice toChronicleEvent uses pending prefix when no chronicleEventId`() {
        val notice = DeathNotice(
            killerName = "TestKiller",
            zone = "Rookguard",
            x = 10,
            y = 20,
            timestamp = "2026-01-21T12:00:00Z",
            chronicleEventId = null
        )

        val event = notice.toChronicleEvent()

        assertTrue(event.id.startsWith("pending_"))
    }

    // =========================================================================
    // Optimistic event creation helper
    // =========================================================================

    @Test
    fun `can create optimistic pending event`() {
        val optimistic = ChronicleEvent(
            id = "pending_client_123",
            kind = ChronicleEventKind.ITEM_DROP,
            timestamp = "2026-01-21T13:00:00Z",
            zone = "Rookguard",
            x = 15,
            y = 25,
            status = EventStatus.PENDING,
            source = EventSource.CLIENT_INTENT,
            actionId = "drop_action_456"
        )

        assertTrue(optimistic.isPending())
        assertTrue(optimistic.isOptimistic())
        assertEquals("drop_action_456", optimistic.actionId)
    }

    @Test
    fun `optimistic event becomes authoritative on confirm`() {
        val optimistic = ChronicleEvent(
            id = "pending_client_123",
            kind = ChronicleEventKind.ITEM_DROP,
            timestamp = "2026-01-21T13:00:00Z",
            zone = "Rookguard",
            x = 15,
            y = 25,
            status = EventStatus.PENDING,
            source = EventSource.CLIENT_INTENT,
            actionId = "drop_action_456"
        )

        val confirmed = optimistic.confirm(serverId = "evt_drop_server_789")

        assertFalse(confirmed.isPending())
        assertTrue(confirmed.isConfirmed())
        assertFalse(confirmed.isOptimistic())
        assertTrue(confirmed.isAuthoritative())
        assertEquals("evt_drop_server_789", confirmed.id)
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private fun createTestEvent(
        id: String = "evt_test",
        kind: ChronicleEventKind = ChronicleEventKind.DEATH,
        timestamp: String = "2026-01-21T12:00:00Z",
        zone: String = "Rookguard",
        x: Int = 10,
        y: Int = 20,
        status: EventStatus = EventStatus.CONFIRMED,
        source: EventSource = EventSource.SERVER_RECEIPT,
        actionId: String? = null
    ) = ChronicleEvent(
        id = id,
        kind = kind,
        timestamp = timestamp,
        zone = zone,
        x = x,
        y = y,
        status = status,
        source = source,
        actionId = actionId
    )
}
