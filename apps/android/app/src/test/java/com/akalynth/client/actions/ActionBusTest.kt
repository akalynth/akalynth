package com.akalynth.client.actions

import com.akalynth.client.chronicle.ChronicleEventKind
import com.akalynth.client.chronicle.ChronicleKey
import com.akalynth.client.chronicle.ChronicleStore
import com.akalynth.client.chronicle.EventSource
import com.akalynth.client.chronicle.EventStatus
import com.akalynth.client.chronicle.Receipt
import com.akalynth.client.ui.components.hotbar.ItemRarity
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Test suite for PR 5A-2: ActionBus + ActionIntent + actionId generation.
 *
 * Test groups:
 * A) actionId stamping & determinism
 * B) "single ingress" guarantee
 * C) pending event emission
 * D) correlation upgrade (integration with 5A-1 store)
 */
class ActionBusTest {

    private lateinit var ids: SequentialActionIdGenerator
    private lateinit var chronicle: ChronicleStore
    private lateinit var transport: NoopTransport
    private lateinit var clock: FixedClock
    private lateinit var bus: ActionBus

    @Before
    fun setup() {
        ids = SequentialActionIdGenerator()
        chronicle = ChronicleStore()
        transport = NoopTransport()
        clock = FixedClock(1705838400000) // Fixed timestamp
        bus = ActionBus(ids, chronicle, transport, clock)
        bus.updatePosition("Rookguard", 10, 20)
    }

    // =========================================================================
    // A) actionId stamping & determinism
    // =========================================================================

    @Test
    fun `A - dispatch 2 actions yields different actionIds`() = runTest {
        val intent1 = bus.dispatchAttack()
        val intent2 = bus.dispatchAttack()

        assertNotEquals(intent1.actionId, intent2.actionId)
    }

    @Test
    fun `A - with sequential generator IDs match expected sequence`() = runTest {
        val intent1 = bus.dispatchAttack()
        val intent2 = bus.dispatchDropHotbarSlot(0, "sword", "Sword", ItemRarity.COMMON)
        val intent3 = bus.dispatchPickupItem("gold", "Gold", 15, 25)

        assertEquals("a-0001", intent1.actionId)
        assertEquals("a-0002", intent2.actionId)
        assertEquals("a-0003", intent3.actionId)
    }

    @Test
    fun `A - actionId stamped by bus not by UI`() = runTest {
        // UI cannot construct ActionIntent directly with actionId
        // All intents come from bus dispatch methods
        val intent = bus.dispatchAttack()

        assertTrue(intent.actionId.isNotEmpty())
        assertTrue(intent.actionId.startsWith("a-"))
    }

    @Test
    fun `A - UUID generator produces different IDs`() = runTest {
        val uuidGenerator = UuidActionIdGenerator()
        val id1 = uuidGenerator.nextId()
        val id2 = uuidGenerator.nextId()

        assertNotEquals(id1, id2)
        assertTrue(id1.contains("-")) // UUID format
    }

    // =========================================================================
    // B) "single ingress" guarantee
    // =========================================================================

    @Test
    fun `B - UI calls bus once transport sees exactly one intent`() = runTest {
        bus.dispatchAttack()

        assertEquals(1, transport.sentCount)
    }

    @Test
    fun `B - multiple dispatches each send exactly once`() = runTest {
        bus.dispatchAttack()
        bus.dispatchDropHotbarSlot(0, "sword", "Sword", ItemRarity.COMMON)
        bus.dispatchPickupItem("gold", "Gold", 15, 25)

        assertEquals(3, transport.sentCount)
    }

    @Test
    fun `B - transport receives correct intent type`() = runTest {
        bus.dispatchDropHotbarSlot(1, "shield", "Shield", ItemRarity.RARE)

        assertTrue(transport.lastSent is ActionIntent.DropHotbarSlot)
        val drop = transport.lastSent as ActionIntent.DropHotbarSlot
        assertEquals(1, drop.slotIndex)
        assertEquals("shield", drop.itemId)
        assertEquals("Shield", drop.itemName)
        assertEquals(ItemRarity.RARE, drop.rarity)
    }

    // =========================================================================
    // C) pending event emission
    // =========================================================================

    @Test
    fun `C - dispatch drop creates 1 pending event keyed by actionId`() = runTest {
        val intent = bus.dispatchDropHotbarSlot(0, "sword", "Iron Sword", ItemRarity.COMMON)

        assertEquals(1, chronicle.count())

        val event = chronicle.getByActionId(intent.actionId)
        assertNotNull(event)
        assertEquals(EventStatus.PENDING, event?.status)
        assertEquals(EventSource.CLIENT_INTENT, event?.source)
        assertEquals(ChronicleEventKind.ITEM_DROP, event?.kind)
    }

    @Test
    fun `C - pending event has synthetic eventId format`() = runTest {
        val intent = bus.dispatchDropHotbarSlot(0, "sword", "Sword", ItemRarity.COMMON)

        val event = chronicle.getByActionId(intent.actionId)
        assertTrue(event?.eventId?.startsWith("pending:") == true)
        assertEquals("pending:${intent.actionId}", event?.eventId)
    }

    @Test
    fun `C - pending event uses bus position`() = runTest {
        bus.updatePosition("Azura", 50, 60)
        val intent = bus.dispatchDropHotbarSlot(0, "sword", "Sword", ItemRarity.COMMON)

        val event = chronicle.getByActionId(intent.actionId)
        assertEquals("Azura", event?.zone)
        assertEquals(50, event?.x)
        assertEquals(60, event?.y)
    }

    @Test
    fun `C - pending event uses clock timestamp`() = runTest {
        clock.timeMs = 1705900000000
        val intent = bus.dispatchDropHotbarSlot(0, "sword", "Sword", ItemRarity.COMMON)

        val event = chronicle.getByActionId(intent.actionId)
        assertEquals(1705900000000, event?.timestampMs)
    }

    @Test
    fun `C - drop maps to ITEM_DROP kind`() = runTest {
        bus.dispatchDropHotbarSlot(0, "sword", "Sword", ItemRarity.COMMON)

        val event = chronicle.events.value.first()
        assertEquals(ChronicleEventKind.ITEM_DROP, event.kind)
    }

    @Test
    fun `C - pickup maps to ITEM_PICKUP kind`() = runTest {
        bus.dispatchPickupItem("gold", "Gold Coin", 15, 25)

        val event = chronicle.events.value.first()
        assertEquals(ChronicleEventKind.ITEM_PICKUP, event.kind)
    }

    @Test
    fun `C - attack maps to COMBAT_KILL kind`() = runTest {
        bus.dispatchAttack("enemy_123")

        val event = chronicle.events.value.first()
        assertEquals(ChronicleEventKind.COMBAT_KILL, event.kind)
    }

    @Test
    fun `C - use hotbar slot does NOT create chronicle event`() = runTest {
        bus.dispatchUseHotbarSlot(0, "potion_1")

        assertEquals(0, chronicle.count())
    }

    @Test
    fun `C - world event contribution sends intent but does NOT create chronicle event`() = runTest {
        val intent = bus.dispatchWorldEventContribution(
            WorldEventSkillIds.WITNESS_MOTH_BLOOM,
            WorldEventSkillIds.VERIFY_TESTIMONY
        )

        assertEquals("a-0001", intent.actionId)
        assertTrue(transport.lastSent is ActionIntent.WorldEventContribution)
        assertEquals(0, chronicle.count())
        assertEquals("event:witness_moth_bloom:verify_testimony", intent.skillId)
    }

    @Test
    fun `C - pending event keyed by actionId prefix`() = runTest {
        val intent = bus.dispatchDropHotbarSlot(0, "sword", "Sword", ItemRarity.COMMON)

        val key = "a:${intent.actionId}"
        val event = chronicle.getByKey(key)
        assertNotNull(event)
    }

    // =========================================================================
    // D) correlation upgrade (integration with 5A-1 store)
    // =========================================================================

    @Test
    fun `D - insert pending via bus then receipt upgrades to CONFIRMED`() = runTest {
        // 1. Dispatch action via bus (creates pending)
        val intent = bus.dispatchDropHotbarSlot(0, "sword", "Iron Sword", ItemRarity.COMMON)

        // Verify pending
        assertEquals(1, chronicle.count())
        assertEquals(1, chronicle.pendingCount())

        // 2. Server sends receipt with same actionId
        val receipt = Receipt(
            receiptId = "server_receipt_456",
            actionId = intent.actionId,
            type = "item_drop",
            timestampMs = 1705838500000,
            payload = mapOf(
                "zone" to "Rookguard",
                "x" to 10,
                "y" to 20,
                "item_name" to "Iron Sword"
            )
        )
        chronicle.upsertReceipt(receipt)

        // 3. Assert: single row, upgraded to CONFIRMED
        assertEquals(1, chronicle.count())
        assertEquals(0, chronicle.pendingCount())

        val event = chronicle.getByActionId(intent.actionId)
        assertNotNull(event)
        assertEquals(EventStatus.CONFIRMED, event?.status)
        assertEquals(EventSource.SERVER_RECEIPT, event?.source)
        assertEquals("server_receipt_456", event?.eventId)
        assertEquals(1705838500000, event?.timestampMs)
    }

    @Test
    fun `D - multiple actions with receipts maintain 1 to 1 mapping`() = runTest {
        // Dispatch 3 actions
        val intent1 = bus.dispatchDropHotbarSlot(0, "sword", "Sword", ItemRarity.COMMON)
        val intent2 = bus.dispatchPickupItem("gold", "Gold", 15, 25)
        val intent3 = bus.dispatchAttack("enemy_1")

        assertEquals(3, chronicle.count())
        assertEquals(3, chronicle.pendingCount())

        // Confirm 2 of them
        chronicle.upsertReceipt(Receipt(
            receiptId = "receipt_1",
            actionId = intent1.actionId,
            type = "item_drop",
            timestampMs = clock.nowMs(),
            payload = emptyMap()
        ))
        chronicle.upsertReceipt(Receipt(
            receiptId = "receipt_3",
            actionId = intent3.actionId,
            type = "combat_kill",
            timestampMs = clock.nowMs(),
            payload = emptyMap()
        ))

        assertEquals(3, chronicle.count())
        assertEquals(1, chronicle.pendingCount())

        // Verify states
        assertEquals(EventStatus.CONFIRMED, chronicle.getByActionId(intent1.actionId)?.status)
        assertEquals(EventStatus.PENDING, chronicle.getByActionId(intent2.actionId)?.status)
        assertEquals(EventStatus.CONFIRMED, chronicle.getByActionId(intent3.actionId)?.status)
    }

    @Test
    fun `D - receipt without matching actionId creates new event`() = runTest {
        // Dispatch action
        bus.dispatchDropHotbarSlot(0, "sword", "Sword", ItemRarity.COMMON)

        // Server sends unrelated receipt (no actionId match)
        val receipt = Receipt(
            receiptId = "server_only_receipt",
            actionId = null, // No correlation
            type = "zone_enter",
            timestampMs = clock.nowMs(),
            payload = mapOf("zone" to "Azura")
        )
        chronicle.upsertReceipt(receipt)

        // Should have 2 events now
        assertEquals(2, chronicle.count())
    }

    // =========================================================================
    // PendingEventMapper tests
    // =========================================================================

    @Test
    fun `PendingEventMapper - drop includes item details`() {
        val intent = ActionIntent.DropHotbarSlot(
            actionId = "test-001",
            slotIndex = 2,
            itemId = "legendary_sword",
            itemName = "Dragon Slayer",
            rarity = ItemRarity.LEGENDARY
        )

        val event = PendingEventMapper.map(intent, clock, "Rookguard", 10, 20)

        assertNotNull(event)
        assertEquals("legendary_sword", event?.details?.get("item_id"))
        assertEquals("Dragon Slayer", event?.details?.get("item_name"))
        assertEquals(2, event?.details?.get("slot_index"))
        assertEquals("LEGENDARY", event?.details?.get("rarity"))
    }

    @Test
    fun `PendingEventMapper - pickup uses intent coordinates`() {
        val intent = ActionIntent.PickupItem(
            actionId = "test-002",
            itemId = "gold_pile",
            itemName = "Gold Pile",
            x = 30,
            y = 40
        )

        val event = PendingEventMapper.map(intent, clock, "Azura", 10, 20)

        assertNotNull(event)
        assertEquals(30, event?.x) // Uses intent coords, not player coords
        assertEquals(40, event?.y)
    }

    @Test
    fun `PendingEventMapper - use hotbar returns null`() {
        val intent = ActionIntent.UseHotbarSlot(
            actionId = "test-004",
            slotIndex = 0,
            itemId = "health_potion"
        )

        val event = PendingEventMapper.map(intent, clock, "Rookguard", 10, 20)

        assertNull(event)
    }

    @Test
    fun `PendingEventMapper - world event contribution returns null`() {
        val intent = ActionIntent.WorldEventContribution(
            actionId = "test-005",
            eventId = WorldEventSkillIds.WITNESS_MOTH_BLOOM,
            contributionId = WorldEventSkillIds.DEFEND_SCRIBES
        )

        val event = PendingEventMapper.map(intent, clock, "Azura", 10, 20)

        assertNull(event)
    }

    // =========================================================================
    // ActionIdGenerator tests
    // =========================================================================

    @Test
    fun `SequentialActionIdGenerator produces predictable sequence`() {
        val gen = SequentialActionIdGenerator("test")

        assertEquals("test-0001", gen.nextId())
        assertEquals("test-0002", gen.nextId())
        assertEquals("test-0003", gen.nextId())
    }

    @Test
    fun `SequentialActionIdGenerator reset restarts sequence`() {
        val gen = SequentialActionIdGenerator()
        gen.nextId()
        gen.nextId()
        gen.reset()

        assertEquals("a-0001", gen.nextId())
    }

    // =========================================================================
    // NoopTransport tests
    // =========================================================================

    @Test
    fun `NoopTransport records all sent intents`() = runTest {
        val transport = NoopTransport()

        val intent1 = ActionIntent.Attack("id1")
        val intent2 = ActionIntent.Attack("id2")

        transport.send(intent1)
        transport.send(intent2)

        assertEquals(2, transport.sentCount)
        assertEquals(listOf(intent1, intent2), transport.sent)
    }

    @Test
    fun `NoopTransport clear resets state`() = runTest {
        val transport = NoopTransport()
        transport.send(ActionIntent.Attack("id1"))
        transport.clear()

        assertEquals(0, transport.sentCount)
        assertNull(transport.lastSent)
    }
}
