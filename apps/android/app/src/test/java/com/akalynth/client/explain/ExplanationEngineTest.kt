package com.akalynth.client.explain

import com.akalynth.client.actions.ActionIntent
import com.akalynth.client.chronicle.ChronicleEvent
import com.akalynth.client.chronicle.ChronicleEventKind
import com.akalynth.client.chronicle.EventSource
import com.akalynth.client.chronicle.EventStatus
import com.akalynth.client.chronicle.Receipt
import com.akalynth.client.rules.RuleId
import com.akalynth.client.ui.components.character.CharacterSex
import com.akalynth.client.ui.components.hotbar.ItemRarity
import com.akalynth.client.ui.state.ChronicleEventDetails
import com.akalynth.client.ui.state.DeathNotice
import com.akalynth.client.ui.state.UiOverlayState
import org.junit.Assert.*
import org.junit.Test

/**
 * Tests for ExplanationEngine (PR 6B-2).
 *
 * Test groups:
 * A) Intent → Pending explanation
 * B) Receipt → Confirmed explanation
 * C) Receipt → Rejected explanation
 * D) Event → Status-based explanation
 * E) UiBlock → Stage gate explanation
 * F) UiBlock → Overlay contention explanation
 * G) UiBlock → Tier safety explanation
 */
class ExplanationEngineTest {

    private val ctx = ExplainContext.forTest()

    // =========================================================================
    // A) Intent → Pending explanation
    // =========================================================================

    @Test
    fun `A - intent yields PENDING decision`() {
        val intent = ActionIntent.DropHotbarSlot(
            actionId = "action_123",
            slotIndex = 0,
            itemId = "sword",
            itemName = "Sword",
            rarity = ItemRarity.COMMON
        )

        val explanation = ExplanationEngine.explain(
            ExplainSubject.Intent(intent),
            ctx
        )

        assertEquals(ExplainDecision.PENDING, explanation.decision)
    }

    @Test
    fun `A - intent cites RECEIPT_PENDING_AWAITING_CONFIRMATION`() {
        val intent = ActionIntent.Attack(actionId = "action_456")

        val explanation = ExplanationEngine.explain(
            ExplainSubject.Intent(intent),
            ctx
        )

        assertTrue(explanation.citesRule(RuleId.RECEIPT_PENDING_AWAITING_CONFIRMATION))
    }

    @Test
    fun `A - intent has actionId in evidence`() {
        val intent = ActionIntent.PickupItem(
            actionId = "action_789",
            itemId = "gold",
            itemName = "Gold",
            x = 10,
            y = 20
        )

        val explanation = ExplanationEngine.explain(
            ExplainSubject.Intent(intent),
            ctx
        )

        assertTrue(explanation.evidenceRefs.contains("action_789"))
    }

    @Test
    fun `A - intent has remediation`() {
        val intent = ActionIntent.CreateCharacter(
            actionId = "action_abc",
            name = "Hero",
            sex = CharacterSex.MALE
        )

        val explanation = ExplanationEngine.explain(
            ExplainSubject.Intent(intent),
            ctx
        )

        assertNotNull(explanation.remediation)
        assertTrue(explanation.remediation!!.contains("Wait"))
    }

    // =========================================================================
    // B) Receipt → Confirmed explanation
    // =========================================================================

    @Test
    fun `B - confirmed death receipt cites RECEIPT_CONFIRMED + DEATH_LOCATION_RECORDED`() {
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

        val explanation = ExplanationEngine.explain(
            ExplainSubject.ReceiptSubject(receipt),
            ctx
        )

        assertEquals(ExplainDecision.CONFIRMED, explanation.decision)
        assertTrue(explanation.citesRule(RuleId.RECEIPT_CONFIRMED_BY_SERVER))
        assertTrue(explanation.citesRule(RuleId.DEATH_LOCATION_RECORDED))
    }

    @Test
    fun `B - death receipt with killer cites DEATH_TRIGGERED_BY_COMBAT`() {
        val receipt = Receipt(
            receiptId = "receipt_death_456",
            actionId = null,
            type = "death",
            timestampMs = 1705838400000,
            payload = mapOf("killer_name" to "PvPKiller")
        )

        val explanation = ExplanationEngine.explain(
            ExplainSubject.ReceiptSubject(receipt),
            ctx
        )

        assertTrue(explanation.citesRule(RuleId.DEATH_TRIGGERED_BY_COMBAT))
    }

    @Test
    fun `B - death receipt with items_lost cites DEATH_ITEMS_LOST_ON_DEATH`() {
        val receipt = Receipt(
            receiptId = "receipt_death_789",
            actionId = null,
            type = "death",
            timestampMs = 1705838400000,
            payload = mapOf("items_lost" to listOf("Sword"))
        )

        val explanation = ExplanationEngine.explain(
            ExplainSubject.ReceiptSubject(receipt),
            ctx
        )

        assertTrue(explanation.citesRule(RuleId.DEATH_ITEMS_LOST_ON_DEATH))
        assertTrue(explanation.citesRule(RuleId.DROP_LOSS_DUE_TO_DEATH))
    }

    @Test
    fun `B - confirmed drop receipt with legendary cites DROP_LEGENDARY_REQUIRES_TIER3`() {
        val receipt = Receipt(
            receiptId = "receipt_drop_123",
            actionId = "action_drop_1",
            type = "item_drop",
            timestampMs = 1705838400000,
            payload = mapOf(
                "item_name" to "Dragon Slayer",
                "rarity" to "legendary",
                "zone" to "Azura"
            )
        )

        val explanation = ExplanationEngine.explain(
            ExplainSubject.ReceiptSubject(receipt),
            ctx
        )

        assertEquals(ExplainDecision.CONFIRMED, explanation.decision)
        assertTrue(explanation.citesRule(RuleId.DROP_LEGENDARY_REQUIRES_TIER3))
        assertTrue(explanation.citesRule(RuleId.DROP_ITEM_REMOVED_FROM_INVENTORY))
        assertTrue(explanation.citesRule(RuleId.DROP_LOCATION_RECORDED))
    }

    @Test
    fun `B - confirmed receipt has receiptId in evidence`() {
        val receipt = Receipt(
            receiptId = "receipt_abc",
            actionId = "action_xyz",
            type = "item_pickup",
            timestampMs = 1705838400000,
            payload = emptyMap()
        )

        val explanation = ExplanationEngine.explain(
            ExplainSubject.ReceiptSubject(receipt),
            ctx
        )

        assertTrue(explanation.evidenceRefs.contains("receipt_abc"))
        assertTrue(explanation.evidenceRefs.contains("action_xyz"))
    }

    // =========================================================================
    // C) Receipt → Rejected explanation
    // =========================================================================

    @Test
    fun `C - rejected receipt cites RECEIPT_REJECTED_BY_SERVER`() {
        val receipt = Receipt(
            receiptId = "receipt_reject_1",
            actionId = "action_bad",
            type = "item_drop",
            timestampMs = 1705838400000,
            payload = mapOf("status" to "rejected")
        )

        val explanation = ExplanationEngine.explain(
            ExplainSubject.ReceiptSubject(receipt),
            ctx
        )

        assertEquals(ExplainDecision.REJECTED, explanation.decision)
        assertTrue(explanation.citesRule(RuleId.RECEIPT_REJECTED_BY_SERVER))
    }

    @Test
    fun `C - rejected with stage_lock code cites STAGE_ACTION_BLOCKED`() {
        val receipt = Receipt(
            receiptId = "receipt_reject_2",
            actionId = "action_stage",
            type = "attack",
            timestampMs = 1705838400000,
            payload = mapOf(
                "status" to "rejected",
                "reject_code" to "stage_lock"
            )
        )

        val explanation = ExplanationEngine.explain(
            ExplainSubject.ReceiptSubject(receipt),
            ctx
        )

        assertTrue(explanation.citesRule(RuleId.STAGE_ACTION_BLOCKED_IN_EARLY_STAGE))
    }

    @Test
    fun `C - rejected with tier_incomplete code cites TIER_ACTION_BLOCKED`() {
        val receipt = Receipt(
            receiptId = "receipt_reject_3",
            actionId = "action_tier",
            type = "item_drop",
            timestampMs = 1705838400000,
            payload = mapOf(
                "rejected" to true,
                "reject_code" to "tier_incomplete"
            )
        )

        val explanation = ExplanationEngine.explain(
            ExplainSubject.ReceiptSubject(receipt),
            ctx
        )

        assertTrue(explanation.citesRule(RuleId.TIER_ACTION_BLOCKED_INSUFFICIENT_CONFIRMATION))
    }

    @Test
    fun `C - rejected receipt has remediation`() {
        val receipt = Receipt(
            receiptId = "receipt_reject_4",
            actionId = "action_xyz",
            type = "item_drop",
            timestampMs = 1705838400000,
            payload = mapOf("ok" to false)
        )

        val explanation = ExplanationEngine.explain(
            ExplainSubject.ReceiptSubject(receipt),
            ctx
        )

        assertNotNull(explanation.remediation)
    }

    // =========================================================================
    // D) Event → Status-based explanation
    // =========================================================================

    @Test
    fun `D - pending event cites RECEIPT_PENDING`() {
        val event = ChronicleEvent(
            eventId = "pending:action_123",
            actionId = "action_123",
            kind = ChronicleEventKind.ITEM_DROP,
            timestampMs = 1705838400000,
            status = EventStatus.PENDING,
            source = EventSource.CLIENT_INTENT
        )

        val explanation = ExplanationEngine.explain(
            ExplainSubject.Event(event),
            ctx
        )

        assertEquals(ExplainDecision.PENDING, explanation.decision)
        assertTrue(explanation.citesRule(RuleId.RECEIPT_PENDING_AWAITING_CONFIRMATION))
    }

    @Test
    fun `D - confirmed event cites RECEIPT_CONFIRMED + domain rules`() {
        val event = ChronicleEvent(
            eventId = "evt_death_123",
            kind = ChronicleEventKind.DEATH,
            timestampMs = 1705838400000,
            zone = "Rookguard",
            x = 10,
            y = 20,
            details = mapOf("killer_name" to "TestKiller"),
            status = EventStatus.CONFIRMED,
            source = EventSource.SERVER_RECEIPT
        )

        val explanation = ExplanationEngine.explain(
            ExplainSubject.Event(event),
            ctx
        )

        assertEquals(ExplainDecision.CONFIRMED, explanation.decision)
        assertTrue(explanation.citesRule(RuleId.RECEIPT_CONFIRMED_BY_SERVER))
        assertTrue(explanation.citesRule(RuleId.DEATH_LOCATION_RECORDED))
    }

    @Test
    fun `D - rejected event cites RECEIPT_REJECTED`() {
        val event = ChronicleEvent(
            eventId = "evt_reject_123",
            actionId = "action_123",
            kind = ChronicleEventKind.ITEM_DROP,
            timestampMs = 1705838400000,
            status = EventStatus.REJECTED,
            source = EventSource.CLIENT_INTENT
        )

        val explanation = ExplanationEngine.explain(
            ExplainSubject.Event(event),
            ctx
        )

        assertEquals(ExplainDecision.REJECTED, explanation.decision)
        assertTrue(explanation.citesRule(RuleId.RECEIPT_REJECTED_BY_SERVER))
    }

    // =========================================================================
    // E) UiBlock → Stage gate explanation
    // =========================================================================

    @Test
    fun `E - hotbar stage block cites STAGE_HOTBAR_UNLOCKED`() {
        val block = ExplainSubject.UiBlock(
            action = UiAction.VIEW_HOTBAR,
            reason = UiBlockReason.STAGE_LOCK
        )

        val explanation = ExplanationEngine.explain(block, ctx.copy(unlockStage = 1))

        assertEquals(ExplainDecision.BLOCKED, explanation.decision)
        assertTrue(explanation.citesRule(RuleId.STAGE_HOTBAR_UNLOCKED_AFTER_ITEM_PICKUP))
        assertTrue(explanation.citesRule(RuleId.STAGE_ACTION_BLOCKED_IN_EARLY_STAGE))
    }

    @Test
    fun `E - why button stage block cites STAGE_WHY_UNLOCKED`() {
        val block = ExplainSubject.UiBlock(
            action = UiAction.WHY_BUTTON,
            reason = UiBlockReason.STAGE_LOCK
        )

        val explanation = ExplanationEngine.explain(block, ctx.copy(unlockStage = 1))

        assertTrue(explanation.citesRule(RuleId.STAGE_WHY_UNLOCKED_AFTER_STAGE_2))
    }

    @Test
    fun `E - rep gold stage block cites STAGE_REP_GOLD_UNLOCKED`() {
        val block = ExplainSubject.UiBlock(
            action = UiAction.VIEW_REP_GOLD,
            reason = UiBlockReason.STAGE_LOCK
        )

        val explanation = ExplanationEngine.explain(block, ctx.copy(unlockStage = 2))

        assertTrue(explanation.citesRule(RuleId.STAGE_REP_GOLD_UNLOCKED_AFTER_DEATH))
    }

    @Test
    fun `E - stage block has remediation`() {
        val block = ExplainSubject.UiBlock(
            action = UiAction.ATTACK,
            reason = UiBlockReason.STAGE_LOCK
        )

        val explanation = ExplanationEngine.explain(block, ctx)

        assertNotNull(explanation.remediation)
        assertTrue(explanation.remediation!!.contains("combat") || explanation.remediation!!.contains("Combat"))
    }

    // =========================================================================
    // F) UiBlock → Overlay contention explanation
    // =========================================================================

    @Test
    fun `F - why blocked during Recap cites OVERLAY_DEATH_FLOW_HAS_PRIORITY`() {
        val recapEvent = ChronicleEvent(
            eventId = "evt_death_recap",
            kind = ChronicleEventKind.DEATH,
            timestampMs = 1705838400000,
            status = EventStatus.CONFIRMED,
            source = EventSource.SERVER_RECEIPT
        )

        val block = ExplainSubject.UiBlock(
            action = UiAction.WHY_BUTTON,
            reason = UiBlockReason.OVERLAY_ACTIVE
        )

        val ctxWithOverlay = ctx.copy(
            overlay = UiOverlayState.Recap(
                com.akalynth.client.ui.state.ChronicleEvent(
                    id = "evt_death_recap",
                    kind = com.akalynth.client.ui.state.ChronicleEventKind.DEATH,
                    timestamp = "2026-01-21T12:00:00Z",
                    zone = "Rookguard",
                    x = 10,
                    y = 20
                )
            )
        )

        val explanation = ExplanationEngine.explain(block, ctxWithOverlay)

        assertEquals(ExplainDecision.BLOCKED, explanation.decision)
        assertTrue(explanation.citesRule(RuleId.OVERLAY_ACTION_BLOCKED_DUE_TO_ACTIVE_OVERLAY))
        assertTrue(explanation.citesRule(RuleId.OVERLAY_DEATH_FLOW_HAS_PRIORITY_OVER_WHY))
    }

    @Test
    fun `F - why blocked during ConfirmDrop cites OVERLAY_CONFIRMATION_HAS_PRIORITY`() {
        val block = ExplainSubject.UiBlock(
            action = UiAction.WHY_BUTTON,
            reason = UiBlockReason.OVERLAY_ACTIVE
        )

        val ctxWithOverlay = ctx.copy(
            overlay = UiOverlayState.ConfirmDrop(
                slotIndex = 0,
                itemId = "sword",
                itemName = "Sword",
                isLegendary = false
            )
        )

        val explanation = ExplanationEngine.explain(block, ctxWithOverlay)

        assertTrue(explanation.citesRule(RuleId.OVERLAY_CONFIRMATION_HAS_PRIORITY_OVER_WHY))
    }

    @Test
    fun `F - overlay block has evidence from overlay`() {
        val block = ExplainSubject.UiBlock(
            action = UiAction.WHY_BUTTON,
            reason = UiBlockReason.OVERLAY_ACTIVE
        )

        val ctxWithOverlay = ctx.copy(
            overlay = UiOverlayState.ConfirmDrop(
                slotIndex = 0,
                itemId = "legendary_sword",
                itemName = "Dragon Slayer",
                isLegendary = true
            )
        )

        val explanation = ExplanationEngine.explain(block, ctxWithOverlay)

        assertTrue(explanation.evidenceRefs.any { it.contains("legendary_sword") })
    }

    // =========================================================================
    // G) UiBlock → Tier safety explanation
    // =========================================================================

    @Test
    fun `G - tier incomplete cites TIER2_HOLD_REQUIRED + TIER_CONFIRMATION_NOT_COMPLETED`() {
        val block = ExplainSubject.UiBlock(
            action = UiAction.DROP_HOTBAR_SLOT,
            reason = UiBlockReason.TIER_CONFIRMATION_INCOMPLETE
        )

        val explanation = ExplanationEngine.explain(block, ctx)

        assertEquals(ExplainDecision.BLOCKED, explanation.decision)
        assertTrue(explanation.citesRule(RuleId.TIER2_HOLD_REQUIRED_FOR_ITEM_DROP))
        assertTrue(explanation.citesRule(RuleId.TIER_CONFIRMATION_NOT_COMPLETED))
    }

    @Test
    fun `G - tier cancelled cites TIER_CONFIRMATION_CANCELLED_BY_RELEASE`() {
        val block = ExplainSubject.UiBlock(
            action = UiAction.DROP_HOTBAR_SLOT,
            reason = UiBlockReason.TIER_CONFIRMATION_CANCELLED
        )

        val explanation = ExplanationEngine.explain(block, ctx)

        assertTrue(explanation.citesRule(RuleId.TIER_CONFIRMATION_CANCELLED_BY_RELEASE))
    }

    @Test
    fun `G - legendary requires tier3 cites correct rules`() {
        val block = ExplainSubject.UiBlock(
            action = UiAction.DROP_HOTBAR_SLOT,
            reason = UiBlockReason.LEGENDARY_REQUIRES_TIER3,
            context = mapOf("item_name" to "Dragon Slayer")
        )

        val explanation = ExplanationEngine.explain(block, ctx)

        assertTrue(explanation.citesRule(RuleId.TIER3_SLIDE_REQUIRED_FOR_LEGENDARY_DROP))
        assertTrue(explanation.citesRule(RuleId.DROP_LEGENDARY_REQUIRES_TIER3))
        assertTrue(explanation.citesRule(RuleId.TIER_CONFIRMATION_NOT_COMPLETED))
    }

    @Test
    fun `G - tier block has remediation with hold duration`() {
        val block = ExplainSubject.UiBlock(
            action = UiAction.DROP_HOTBAR_SLOT,
            reason = UiBlockReason.TIER_CONFIRMATION_INCOMPLETE
        )

        val explanation = ExplanationEngine.explain(block, ctx)

        assertNotNull(explanation.remediation)
        assertTrue(explanation.remediation!!.contains("Hold") || explanation.remediation!!.contains("1.5"))
    }

    // =========================================================================
    // General requirements
    // =========================================================================

    @Test
    fun `every explanation has at least one rule`() {
        val subjects = listOf(
            ExplainSubject.Intent(ActionIntent.Attack("a1")),
            ExplainSubject.ReceiptSubject(Receipt("r1", null, "death", 0, emptyMap())),
            ExplainSubject.UiBlock(UiAction.WHY_BUTTON, UiBlockReason.STAGE_LOCK)
        )

        subjects.forEach { subject ->
            val explanation = ExplanationEngine.explain(subject, ctx)
            assertTrue(
                "Explanation for $subject should have at least one rule",
                explanation.ruleIds.isNotEmpty()
            )
        }
    }

    @Test
    fun `explanation IDs are deterministic`() {
        val intent = ActionIntent.Attack("action_deterministic")
        val fixedCtx = ExplainContext.forTest(nowMs = 1705838400000)

        val exp1 = ExplanationEngine.explain(ExplainSubject.Intent(intent), fixedCtx)
        val exp2 = ExplanationEngine.explain(ExplainSubject.Intent(intent), fixedCtx)

        assertEquals(exp1.explanationId, exp2.explanationId)
    }
}
