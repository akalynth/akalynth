package com.akalynth.client.action

import com.akalynth.client.protocol.Direction
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Tests for ActionBus and ActionIntent (PR 5A-2).
 *
 * Contracts:
 * - A1: ActionIntent generates unique correlation IDs
 * - A2: ActionBus emits dispatched actions
 * - A3: ActionBus tracks pending actions
 * - A4: ActionBus completion/rejection lifecycle
 * - A5: ActionBus cleanup for expired actions
 */
class ActionBusTest {

    private lateinit var actionBus: ActionBus

    @Before
    fun setup() {
        actionBus = ActionBus()
    }

    // =========================================================================
    // A1: ActionIntent correlation IDs
    // =========================================================================

    @Test
    fun `A1 - move intent generates unique actionId`() {
        val intent1 = ActionIntent.Move(Direction.NORTH)
        val intent2 = ActionIntent.Move(Direction.NORTH)

        assertNotEquals(intent1.actionId, intent2.actionId)
        assertTrue(intent1.actionId.startsWith("action_"))
        assertTrue(intent2.actionId.startsWith("action_"))
    }

    @Test
    fun `A1 - drop intent generates unique actionId`() {
        val intent1 = ActionIntent.Drop(slotIndex = 0, itemId = "sword_1")
        val intent2 = ActionIntent.Drop(slotIndex = 0, itemId = "sword_1")

        assertNotEquals(intent1.actionId, intent2.actionId)
    }

    @Test
    fun `A1 - pickup intent generates unique actionId`() {
        val intent1 = ActionIntent.Pickup(itemId = "gold_1", x = 10, y = 20)
        val intent2 = ActionIntent.Pickup(itemId = "gold_1", x = 10, y = 20)

        assertNotEquals(intent1.actionId, intent2.actionId)
    }

    @Test
    fun `A1 - chat intent generates unique actionId`() {
        val intent1 = ActionIntent.Chat(message = "Hello")
        val intent2 = ActionIntent.Chat(message = "Hello")

        assertNotEquals(intent1.actionId, intent2.actionId)
    }

    @Test
    fun `A1 - use item intent generates unique actionId`() {
        val intent1 = ActionIntent.UseItem(slotIndex = 0, itemId = "potion_1")
        val intent2 = ActionIntent.UseItem(slotIndex = 0, itemId = "potion_1")

        assertNotEquals(intent1.actionId, intent2.actionId)
    }

    @Test
    fun `A1 - intent has timestamp`() {
        val intent = ActionIntent.Move(Direction.SOUTH)

        assertNotNull(intent.timestamp)
        assertTrue(intent.timestamp.isNotEmpty())
    }

    // =========================================================================
    // A2: ActionBus emission
    // =========================================================================

    @Test
    fun `A2 - dispatch emits action to flow`() = runTest {
        val intent = ActionIntent.Move(Direction.EAST)
        var receivedIntent: ActionIntent? = null

        val job = launch {
            receivedIntent = actionBus.actions.first()
        }

        actionBus.dispatch(intent)
        job.join()

        assertEquals(intent, receivedIntent)
    }

    @Test
    fun `A2 - dispatch returns actionId`() = runTest {
        val intent = ActionIntent.Drop(slotIndex = 1, itemId = "shield_1")

        val returnedId = actionBus.dispatch(intent)

        assertEquals(intent.actionId, returnedId)
    }

    @Test
    fun `A2 - dispatchBlocking returns actionId on success`() {
        val intent = ActionIntent.Move(Direction.WEST)

        val returnedId = actionBus.dispatchBlocking(intent)

        assertEquals(intent.actionId, returnedId)
    }

    // =========================================================================
    // A3: Pending action tracking
    // =========================================================================

    @Test
    fun `A3 - dispatch adds to pending`() = runTest {
        val intent = ActionIntent.Move(Direction.NORTH)

        actionBus.dispatch(intent)

        val pending = actionBus.getPending(intent.actionId)
        assertNotNull(pending)
        assertEquals(intent, pending?.intent)
    }

    @Test
    fun `A3 - dispatchBlocking adds to pending`() {
        val intent = ActionIntent.Drop(slotIndex = 0, itemId = "sword_1")

        actionBus.dispatchBlocking(intent)

        val pending = actionBus.getPending(intent.actionId)
        assertNotNull(pending)
        assertEquals(intent, pending?.intent)
    }

    @Test
    fun `A3 - pendingCount tracks count`() = runTest {
        assertEquals(0, actionBus.pendingCount())

        actionBus.dispatch(ActionIntent.Move(Direction.NORTH))
        assertEquals(1, actionBus.pendingCount())

        actionBus.dispatch(ActionIntent.Move(Direction.SOUTH))
        assertEquals(2, actionBus.pendingCount())
    }

    @Test
    fun `A3 - getAllPending returns all pending actions`() = runTest {
        val intent1 = ActionIntent.Move(Direction.NORTH)
        val intent2 = ActionIntent.Drop(slotIndex = 0, itemId = "sword_1")

        actionBus.dispatch(intent1)
        actionBus.dispatch(intent2)

        val allPending = actionBus.getAllPending()
        assertEquals(2, allPending.size)
        assertTrue(allPending.any { it.intent == intent1 })
        assertTrue(allPending.any { it.intent == intent2 })
    }

    @Test
    fun `A3 - pending action has dispatch timestamp`() = runTest {
        val beforeDispatch = System.currentTimeMillis()

        val intent = ActionIntent.Move(Direction.EAST)
        actionBus.dispatch(intent)

        val afterDispatch = System.currentTimeMillis()
        val pending = actionBus.getPending(intent.actionId)

        assertNotNull(pending)
        assertTrue(pending!!.dispatchedAt >= beforeDispatch)
        assertTrue(pending.dispatchedAt <= afterDispatch)
    }

    // =========================================================================
    // A4: Completion and rejection lifecycle
    // =========================================================================

    @Test
    fun `A4 - complete removes from pending`() = runTest {
        val intent = ActionIntent.Move(Direction.NORTH)
        actionBus.dispatch(intent)

        val completed = actionBus.complete(intent.actionId)

        assertEquals(intent, completed)
        assertNull(actionBus.getPending(intent.actionId))
        assertEquals(0, actionBus.pendingCount())
    }

    @Test
    fun `A4 - complete returns null for unknown actionId`() {
        val completed = actionBus.complete("unknown_action_id")

        assertNull(completed)
    }

    @Test
    fun `A4 - reject removes from pending`() = runTest {
        val intent = ActionIntent.Drop(slotIndex = 0, itemId = "sword_1")
        actionBus.dispatch(intent)

        val rejected = actionBus.reject(intent.actionId)

        assertEquals(intent, rejected)
        assertNull(actionBus.getPending(intent.actionId))
        assertEquals(0, actionBus.pendingCount())
    }

    @Test
    fun `A4 - reject returns null for unknown actionId`() {
        val rejected = actionBus.reject("unknown_action_id")

        assertNull(rejected)
    }

    @Test
    fun `A4 - clearPending removes all pending`() = runTest {
        actionBus.dispatch(ActionIntent.Move(Direction.NORTH))
        actionBus.dispatch(ActionIntent.Move(Direction.SOUTH))
        actionBus.dispatch(ActionIntent.Move(Direction.EAST))

        assertEquals(3, actionBus.pendingCount())

        actionBus.clearPending()

        assertEquals(0, actionBus.pendingCount())
    }

    // =========================================================================
    // A5: Cleanup expired actions
    // =========================================================================

    @Test
    fun `A5 - cleanupExpired removes old actions`() = runTest {
        val intent = ActionIntent.Move(Direction.NORTH)
        actionBus.dispatch(intent)

        // Cleanup with 0ms max age (everything expired)
        val removed = actionBus.cleanupExpired(maxAgeMs = 0)

        assertEquals(1, removed)
        assertEquals(0, actionBus.pendingCount())
    }

    @Test
    fun `A5 - cleanupExpired keeps recent actions`() = runTest {
        val intent = ActionIntent.Move(Direction.NORTH)
        actionBus.dispatch(intent)

        // Cleanup with 1 hour max age (nothing expired)
        val removed = actionBus.cleanupExpired(maxAgeMs = 3_600_000)

        assertEquals(0, removed)
        assertEquals(1, actionBus.pendingCount())
    }

    @Test
    fun `A5 - PendingAction isExpired works correctly`() {
        val recentAction = PendingAction(
            intent = ActionIntent.Move(Direction.NORTH),
            dispatchedAt = System.currentTimeMillis()
        )

        val oldAction = PendingAction(
            intent = ActionIntent.Move(Direction.SOUTH),
            dispatchedAt = System.currentTimeMillis() - 60_000 // 1 minute ago
        )

        assertFalse(recentAction.isExpired(maxAgeMs = 30_000))
        assertTrue(oldAction.isExpired(maxAgeMs = 30_000))
    }

    @Test
    fun `A5 - PendingAction ageMs returns correct age`() {
        val dispatchTime = System.currentTimeMillis() - 5_000 // 5 seconds ago
        val action = PendingAction(
            intent = ActionIntent.Move(Direction.NORTH),
            dispatchedAt = dispatchTime
        )

        val age = action.ageMs()
        assertTrue("Age should be approximately 5 seconds", age >= 4_900 && age <= 5_500)
    }

    // =========================================================================
    // Direction and ChatChannel enums
    // =========================================================================

    @Test
    fun `Direction enum has 8 values`() {
        val values = Direction.entries
        assertEquals(8, values.size)
        assertTrue(values.contains(Direction.NORTH))
        assertTrue(values.contains(Direction.SOUTH))
        assertTrue(values.contains(Direction.EAST))
        assertTrue(values.contains(Direction.WEST))
        assertTrue(values.contains(Direction.NORTHEAST))
        assertTrue(values.contains(Direction.NORTHWEST))
        assertTrue(values.contains(Direction.SOUTHEAST))
        assertTrue(values.contains(Direction.SOUTHWEST))
    }

    @Test
    fun `ChatChannel enum has 4 values`() {
        val values = ChatChannel.entries
        assertEquals(4, values.size)
        assertTrue(values.contains(ChatChannel.LOCAL))
        assertTrue(values.contains(ChatChannel.GLOBAL))
        assertTrue(values.contains(ChatChannel.PARTY))
        assertTrue(values.contains(ChatChannel.WHISPER))
    }

    @Test
    fun `Chat intent default channel is LOCAL`() {
        val intent = ActionIntent.Chat(message = "Hello")
        assertEquals(ChatChannel.LOCAL, intent.channel)
    }

    @Test
    fun `Chat intent can specify channel`() {
        val intent = ActionIntent.Chat(message = "Hello", channel = ChatChannel.GLOBAL)
        assertEquals(ChatChannel.GLOBAL, intent.channel)
    }

    // =========================================================================
    // UseItem intent
    // =========================================================================

    @Test
    fun `UseItem intent has optional target`() {
        val withoutTarget = ActionIntent.UseItem(slotIndex = 0, itemId = "potion_1")
        assertNull(withoutTarget.targetX)
        assertNull(withoutTarget.targetY)

        val withTarget = ActionIntent.UseItem(slotIndex = 0, itemId = "spell_1", targetX = 10, targetY = 20)
        assertEquals(10, withTarget.targetX)
        assertEquals(20, withTarget.targetY)
    }
}
