package com.akalynth.client.explain

import com.akalynth.client.actions.ActionIntent
import com.akalynth.client.chronicle.ChronicleEvent
import com.akalynth.client.chronicle.ChronicleEventKind
import com.akalynth.client.chronicle.EventStatus
import com.akalynth.client.chronicle.Receipt
import com.akalynth.client.rules.RuleId
import com.akalynth.client.snapshot.SnapshotEvidenceAdapter
import com.akalynth.client.ui.state.UiOverlayState

/**
 * Pure explanation engine.
 *
 * No I/O, no UI state reads unless passed in via ExplainContext.
 * Deterministic: same inputs → same output.
 */
object ExplanationEngine {

    /**
     * Generate an explanation for a subject.
     *
     * @param subject What to explain (intent, receipt, event, or UI block)
     * @param ctx Context containing timestamp, overlay state, unlock stage
     * @return Deterministic explanation with rule citations and evidence
     */
    fun explain(subject: ExplainSubject, ctx: ExplainContext): Explanation {
        return when (subject) {
            is ExplainSubject.Intent -> explainIntent(subject.intent, ctx)
            is ExplainSubject.ReceiptSubject -> explainReceipt(subject.receipt, ctx)
            is ExplainSubject.Event -> explainEvent(subject.event, ctx)
            is ExplainSubject.UiBlock -> explainUiBlock(subject, ctx)
        }
    }

    // =========================================================================
    // Intent explanation (pending, no receipt yet)
    // =========================================================================

    private fun explainIntent(intent: ActionIntent, ctx: ExplainContext): Explanation {
        val subjectId = intent.actionId

        return Explanation(
            explanationId = Explanation.generateId(subjectId, ctx.nowMs),
            subjectId = subjectId,
            decision = ExplainDecision.PENDING,
            ruleIds = listOf(RuleId.RECEIPT_PENDING_AWAITING_CONFIRMATION),
            reason = "Awaiting server confirmation",
            details = mapOf(
                "intent_type" to intent::class.simpleName,
                "action_id" to intent.actionId
            ),
            evidenceRefs = listOf(intent.actionId, "pending:${intent.actionId}"),
            remediation = "Wait for server confirmation.",
            timestampMs = ctx.nowMs
        )
    }

    // =========================================================================
    // Receipt explanation (confirmed or rejected)
    // =========================================================================

    private fun explainReceipt(receipt: Receipt, ctx: ExplainContext): Explanation {
        val isRejected = receipt.payload["status"] == "rejected" ||
            receipt.payload["ok"] == false ||
            receipt.payload["rejected"] == true

        return if (isRejected) {
            explainRejectedReceipt(receipt, ctx)
        } else {
            explainConfirmedReceipt(receipt, ctx)
        }
    }

    private fun explainConfirmedReceipt(receipt: Receipt, ctx: ExplainContext): Explanation {
        val subjectId = receipt.receiptId
        val ruleIds = mutableListOf(RuleId.RECEIPT_CONFIRMED_BY_SERVER)
        val details = mutableMapOf<String, Any?>(
            "receipt_id" to receipt.receiptId,
            "type" to receipt.type
        )
        val evidenceRefs = mutableListOf(receipt.receiptId)

        // Add actionId if present
        receipt.actionId?.let {
            evidenceRefs.add(it)
            details["action_id"] = it
        }

        // Add domain-specific rules based on receipt type
        val (domainRules, domainDetails, reason) = getDomainRulesForType(receipt)
        ruleIds.addAll(domainRules)
        details.putAll(domainDetails)

        // Add payload evidence
        addPayloadEvidence(receipt.payload, details)

        // Add snapshot evidence for state-mutating events (death, drop, pickup)
        if (receipt.type.lowercase() in listOf("death", "item_drop", "item_pickup")) {
            val snapshotEvidence = SnapshotEvidenceAdapter.fromContext(ctx)
            if (snapshotEvidence.hasEvidence) {
                details.putAll(snapshotEvidence.toDetailsMap())
                evidenceRefs.addAll(snapshotEvidence.toEvidenceRefs())
            }
        }

        return Explanation(
            explanationId = Explanation.generateId(subjectId, ctx.nowMs),
            subjectId = subjectId,
            decision = ExplainDecision.CONFIRMED,
            ruleIds = ruleIds,
            reason = reason,
            details = details,
            evidenceRefs = evidenceRefs,
            remediation = null,
            timestampMs = ctx.nowMs
        )
    }

    private fun explainRejectedReceipt(receipt: Receipt, ctx: ExplainContext): Explanation {
        val subjectId = receipt.receiptId
        val ruleIds = mutableListOf(RuleId.RECEIPT_REJECTED_BY_SERVER)
        val details = mutableMapOf<String, Any?>(
            "receipt_id" to receipt.receiptId,
            "type" to receipt.type
        )
        val evidenceRefs = mutableListOf(receipt.receiptId)

        receipt.actionId?.let {
            evidenceRefs.add(it)
            details["action_id"] = it
        }

        // Add rejection-specific rules based on reject_code
        val rejectCode = receipt.payload["reject_code"] as? String
        val (rejectRules, remediation) = getRejectRules(rejectCode)
        ruleIds.addAll(rejectRules)

        rejectCode?.let { details["reject_code"] = it }

        return Explanation(
            explanationId = Explanation.generateId(subjectId, ctx.nowMs),
            subjectId = subjectId,
            decision = ExplainDecision.REJECTED,
            ruleIds = ruleIds,
            reason = "Action rejected by server",
            details = details,
            evidenceRefs = evidenceRefs,
            remediation = remediation,
            timestampMs = ctx.nowMs
        )
    }

    private fun getDomainRulesForType(receipt: Receipt): Triple<List<String>, Map<String, Any?>, String> {
        return when (receipt.type.lowercase()) {
            "death" -> Triple(
                buildList {
                    add(RuleId.DEATH_LOCATION_RECORDED)
                    if (receipt.payload["killer_name"] != null) {
                        add(RuleId.DEATH_TRIGGERED_BY_COMBAT)
                    }
                    if (receipt.payload["items_lost"] != null) {
                        add(RuleId.DEATH_ITEMS_LOST_ON_DEATH)
                        add(RuleId.DROP_LOSS_DUE_TO_DEATH)
                    }
                },
                buildMap {
                    receipt.payload["killer_name"]?.let { put("killer_name", it) }
                    receipt.payload["zone"]?.let { put("zone", it) }
                    receipt.payload["items_lost"]?.let { put("items_lost", it) }
                },
                "Death recorded"
            )

            "item_drop" -> Triple(
                buildList {
                    add(RuleId.DROP_ITEM_REMOVED_FROM_INVENTORY)
                    add(RuleId.DROP_LOCATION_RECORDED)
                    add(RuleId.DROP_LOSS_DUE_TO_PLAYER_ACTION)
                    val rarity = receipt.payload["rarity"] as? String
                    if (rarity?.equals("legendary", ignoreCase = true) == true) {
                        add(RuleId.DROP_LEGENDARY_REQUIRES_TIER3)
                    }
                },
                buildMap {
                    receipt.payload["item_name"]?.let { put("item_name", it) }
                    receipt.payload["item_id"]?.let { put("item_id", it) }
                    receipt.payload["rarity"]?.let { put("rarity", it) }
                    receipt.payload["zone"]?.let { put("zone", it) }
                },
                "Item dropped"
            )

            "item_pickup" -> Triple(
                listOf(RuleId.DROP_ITEM_PLACED_IN_WORLD), // Pickup is inverse of drop
                buildMap {
                    receipt.payload["item_name"]?.let { put("item_name", it) }
                    receipt.payload["item_id"]?.let { put("item_id", it) }
                },
                "Item picked up"
            )

            "zone_enter" -> Triple(
                listOf(RuleId.STAGE_UI_ELEMENT_HIDDEN_UNTIL_UNLOCK), // Zone transitions may unlock
                buildMap {
                    receipt.payload["zone"]?.let { put("zone", it) }
                    receipt.payload["from_zone"]?.let { put("from_zone", it) }
                },
                "Entered zone"
            )

            "combat_kill" -> Triple(
                listOf(RuleId.DEATH_TRIGGERED_BY_COMBAT),
                buildMap {
                    receipt.payload["victim_name"]?.let { put("victim_name", it) }
                },
                "Combat kill recorded"
            )

            "character_created" -> Triple(
                listOf(RuleId.STAGE_UI_ELEMENT_HIDDEN_UNTIL_UNLOCK),
                buildMap {
                    receipt.payload["name"]?.let { put("character_name", it) }
                },
                "Character created"
            )

            else -> Triple(
                emptyList(),
                emptyMap(),
                "Action confirmed"
            )
        }
    }

    private fun getRejectRules(rejectCode: String?): Pair<List<String>, String> {
        return when (rejectCode) {
            "stage_lock", "stage_blocked" -> Pair(
                listOf(RuleId.STAGE_ACTION_BLOCKED_IN_EARLY_STAGE),
                "Progress further to unlock this action."
            )
            "tier_incomplete", "confirmation_required" -> Pair(
                listOf(RuleId.TIER_ACTION_BLOCKED_INSUFFICIENT_CONFIRMATION),
                "Complete the required confirmation gesture."
            )
            "legendary_requires_tier3" -> Pair(
                listOf(
                    RuleId.TIER_ACTION_BLOCKED_INSUFFICIENT_CONFIRMATION,
                    RuleId.DROP_LEGENDARY_REQUIRES_TIER3
                ),
                "Use slide gesture to confirm legendary drop."
            )
            else -> Pair(emptyList(), "Try again.")
        }
    }

    private fun addPayloadEvidence(payload: Map<String, Any?>, details: MutableMap<String, Any?>) {
        payload["x"]?.let { details["x"] = it }
        payload["y"]?.let { details["y"] = it }
        payload["zone"]?.let { details["zone"] = it }
    }

    // =========================================================================
    // Event explanation (delegates based on status)
    // =========================================================================

    private fun explainEvent(event: ChronicleEvent, ctx: ExplainContext): Explanation {
        return when (event.status) {
            EventStatus.PENDING -> explainPendingEvent(event, ctx)
            EventStatus.CONFIRMED -> explainConfirmedEvent(event, ctx)
            EventStatus.REJECTED -> explainRejectedEvent(event, ctx)
        }
    }

    private fun explainPendingEvent(event: ChronicleEvent, ctx: ExplainContext): Explanation {
        val subjectId = event.eventId

        return Explanation(
            explanationId = Explanation.generateId(subjectId, ctx.nowMs),
            subjectId = subjectId,
            decision = ExplainDecision.PENDING,
            ruleIds = listOf(RuleId.RECEIPT_PENDING_AWAITING_CONFIRMATION),
            reason = "Awaiting server confirmation",
            details = mapOf(
                "event_id" to event.eventId,
                "kind" to event.kind.name,
                "action_id" to event.actionId
            ),
            evidenceRefs = buildList {
                add(event.eventId)
                event.actionId?.let { add(it) }
            },
            remediation = "Wait for server confirmation.",
            timestampMs = ctx.nowMs
        )
    }

    private fun explainConfirmedEvent(event: ChronicleEvent, ctx: ExplainContext): Explanation {
        val subjectId = event.eventId
        val ruleIds = mutableListOf(RuleId.RECEIPT_CONFIRMED_BY_SERVER)
        val details = mutableMapOf<String, Any?>(
            "event_id" to event.eventId,
            "kind" to event.kind.name
        )
        val evidenceRefs = mutableListOf<String>()

        // If event has actionId, it was upgraded from pending (intent → receipt)
        if (event.actionId != null) {
            ruleIds.add(RuleId.RECEIPT_UPGRADED_FROM_PENDING)
        }

        // Add domain rules based on kind
        val (domainRules, reason) = getDomainRulesForKind(event)
        ruleIds.addAll(domainRules)

        // Add event details
        event.zone?.let { details["zone"] = it }
        event.x?.let { details["x"] = it }
        event.y?.let { details["y"] = it }
        event.actionId?.let { details["action_id"] = it }

        // Add kind-specific details
        event.killerName?.let { details["killer_name"] = it }
        event.itemsLost?.let { details["items_lost"] = it }
        event.itemName?.let { details["item_name"] = it }

        // Build evidence refs
        evidenceRefs.add(event.eventId)
        event.actionId?.let { evidenceRefs.add(it) }

        // Add snapshot evidence for state-mutating events (death, drop, pickup)
        if (event.kind in listOf(
                ChronicleEventKind.DEATH,
                ChronicleEventKind.ITEM_DROP,
                ChronicleEventKind.ITEM_PICKUP
            )
        ) {
            val snapshotEvidence = SnapshotEvidenceAdapter.fromContext(ctx)
            if (snapshotEvidence.hasEvidence) {
                details.putAll(snapshotEvidence.toDetailsMap())
                evidenceRefs.addAll(snapshotEvidence.toEvidenceRefs())
            }
        }

        return Explanation(
            explanationId = Explanation.generateId(subjectId, ctx.nowMs),
            subjectId = subjectId,
            decision = ExplainDecision.CONFIRMED,
            ruleIds = ruleIds,
            reason = reason,
            details = details,
            evidenceRefs = evidenceRefs,
            timestampMs = ctx.nowMs
        )
    }

    private fun explainRejectedEvent(event: ChronicleEvent, ctx: ExplainContext): Explanation {
        val subjectId = event.eventId

        return Explanation(
            explanationId = Explanation.generateId(subjectId, ctx.nowMs),
            subjectId = subjectId,
            decision = ExplainDecision.REJECTED,
            ruleIds = listOf(RuleId.RECEIPT_REJECTED_BY_SERVER),
            reason = "Action rejected by server",
            details = mapOf(
                "event_id" to event.eventId,
                "kind" to event.kind.name,
                "action_id" to event.actionId
            ),
            evidenceRefs = buildList {
                add(event.eventId)
                event.actionId?.let { add(it) }
            },
            remediation = "Try again.",
            timestampMs = ctx.nowMs
        )
    }

    private fun getDomainRulesForKind(event: ChronicleEvent): Pair<List<String>, String> {
        return when (event.kind) {
            ChronicleEventKind.DEATH -> Pair(
                buildList {
                    add(RuleId.DEATH_LOCATION_RECORDED)
                    if (event.killerName != null) add(RuleId.DEATH_TRIGGERED_BY_COMBAT)
                    if (!event.itemsLost.isNullOrEmpty()) {
                        add(RuleId.DEATH_ITEMS_LOST_ON_DEATH)
                        add(RuleId.DROP_LOSS_DUE_TO_DEATH)
                    }
                },
                "Death recorded"
            )

            ChronicleEventKind.ITEM_DROP -> Pair(
                listOf(
                    RuleId.DROP_ITEM_REMOVED_FROM_INVENTORY,
                    RuleId.DROP_LOCATION_RECORDED,
                    RuleId.DROP_LOSS_DUE_TO_PLAYER_ACTION
                ),
                "Item dropped"
            )

            ChronicleEventKind.ITEM_PICKUP -> Pair(
                listOf(RuleId.DROP_ITEM_PLACED_IN_WORLD),
                "Item picked up"
            )

            ChronicleEventKind.ZONE_ENTER -> Pair(
                emptyList(),
                "Entered zone"
            )

            ChronicleEventKind.COMBAT_KILL -> Pair(
                listOf(RuleId.DEATH_TRIGGERED_BY_COMBAT),
                "Combat kill recorded"
            )

            ChronicleEventKind.TUTORIAL_COMPLETE -> Pair(
                emptyList(),
                "Tutorial completed"
            )

            ChronicleEventKind.CHARACTER_CREATED -> Pair(
                emptyList(),
                "Character created"
            )

            ChronicleEventKind.WORLD_EVENT -> Pair(
                emptyList(),
                "World event recorded"
            )

            ChronicleEventKind.UNKNOWN -> Pair(
                emptyList(),
                "Event recorded"
            )
        }
    }

    // =========================================================================
    // UI Block explanation (stage/tier/overlay)
    // =========================================================================

    private fun explainUiBlock(block: ExplainSubject.UiBlock, ctx: ExplainContext): Explanation {
        return when (block.reason) {
            UiBlockReason.STAGE_LOCK -> explainStageBlock(block, ctx)
            UiBlockReason.OVERLAY_ACTIVE -> explainOverlayBlock(block, ctx)
            UiBlockReason.TIER_CONFIRMATION_INCOMPLETE -> explainTierBlock(block, ctx, cancelled = false)
            UiBlockReason.TIER_CONFIRMATION_CANCELLED -> explainTierBlock(block, ctx, cancelled = true)
            UiBlockReason.LEGENDARY_REQUIRES_TIER3 -> explainLegendaryBlock(block, ctx)
            UiBlockReason.OTHER -> explainGenericBlock(block, ctx)
        }
    }

    private fun explainStageBlock(block: ExplainSubject.UiBlock, ctx: ExplainContext): Explanation {
        val subjectId = "block_${block.action.name}_${ctx.nowMs}"
        val (ruleIds, remediation) = getStageRulesForAction(block.action)

        return Explanation(
            explanationId = Explanation.generateId(subjectId, ctx.nowMs),
            subjectId = subjectId,
            decision = ExplainDecision.BLOCKED,
            ruleIds = ruleIds,
            reason = "Feature locked at current stage",
            details = buildMap {
                put("action", block.action.name)
                put("reason", block.reason.name)
                ctx.unlockStage?.let { put("current_stage", it) }
                putAll(block.context)
            },
            evidenceRefs = buildList {
                ctx.unlockStage?.let { add("stage:$it") }
            },
            remediation = remediation,
            timestampMs = ctx.nowMs
        )
    }

    private fun getStageRulesForAction(action: UiAction): Pair<List<String>, String> {
        return when (action) {
            UiAction.ATTACK -> Pair(
                listOf(RuleId.STAGE_ACTION_BLOCKED_IN_EARLY_STAGE, RuleId.STAGE_ATTACK_UNLOCKED_AFTER_COMBAT),
                "Engage in combat to unlock Attack."
            )
            UiAction.VIEW_HOTBAR, UiAction.USE_HOTBAR_SLOT, UiAction.DROP_HOTBAR_SLOT -> Pair(
                listOf(RuleId.STAGE_ACTION_BLOCKED_IN_EARLY_STAGE, RuleId.STAGE_HOTBAR_UNLOCKED_AFTER_ITEM_PICKUP),
                "Pick up an item to unlock the hotbar."
            )
            UiAction.WHY_BUTTON -> Pair(
                listOf(RuleId.STAGE_ACTION_BLOCKED_IN_EARLY_STAGE, RuleId.STAGE_WHY_UNLOCKED_AFTER_STAGE_2),
                "Progress to Stage 2 to unlock explanations."
            )
            UiAction.VIEW_REP_GOLD -> Pair(
                listOf(RuleId.STAGE_ACTION_BLOCKED_IN_EARLY_STAGE, RuleId.STAGE_REP_GOLD_UNLOCKED_AFTER_DEATH),
                "These appear after your first death."
            )
            UiAction.MENU_BUTTON -> Pair(
                listOf(RuleId.STAGE_ACTION_BLOCKED_IN_EARLY_STAGE, RuleId.STAGE_MENU_UNLOCKED_AFTER_STAGE_1),
                "Progress to Stage 1 to unlock the menu."
            )
            UiAction.PICKUP_ITEM -> Pair(
                listOf(RuleId.STAGE_ACTION_BLOCKED_IN_EARLY_STAGE),
                "Progress further to unlock this action."
            )
        }
    }

    private fun explainOverlayBlock(block: ExplainSubject.UiBlock, ctx: ExplainContext): Explanation {
        val subjectId = "block_${block.action.name}_${ctx.nowMs}"
        val ruleIds = mutableListOf(RuleId.OVERLAY_ACTION_BLOCKED_DUE_TO_ACTIVE_OVERLAY)
        val evidenceRefs = mutableListOf<String>()

        // Add specific overlay priority rules
        when (ctx.overlay) {
            is UiOverlayState.Toast, is UiOverlayState.Recap -> {
                ruleIds.add(RuleId.OVERLAY_DEATH_FLOW_HAS_PRIORITY_OVER_WHY)
            }
            is UiOverlayState.ConfirmDrop -> {
                ruleIds.add(RuleId.OVERLAY_CONFIRMATION_HAS_PRIORITY_OVER_WHY)
            }
            else -> {
                ruleIds.add(RuleId.OVERLAY_WHY_BLOCKED_DURING_CRITICAL_FLOW)
            }
        }

        // Add evidence from overlay
        when (val overlay = ctx.overlay) {
            is UiOverlayState.Toast -> {
                overlay.notice.chronicleEventId?.let { evidenceRefs.add(it) }
            }
            is UiOverlayState.Recap -> {
                evidenceRefs.add(overlay.event.id)
            }
            is UiOverlayState.ConfirmDrop -> {
                evidenceRefs.add("confirm:${overlay.itemId}")
            }
            else -> {}
        }

        return Explanation(
            explanationId = Explanation.generateId(subjectId, ctx.nowMs),
            subjectId = subjectId,
            decision = ExplainDecision.BLOCKED,
            ruleIds = ruleIds,
            reason = "Blocked by active overlay",
            details = buildMap {
                put("action", block.action.name)
                put("reason", block.reason.name)
                ctx.overlay?.let { put("overlay_type", it::class.simpleName) }
                putAll(block.context)
            },
            evidenceRefs = evidenceRefs,
            remediation = "Close the current panel to continue.",
            timestampMs = ctx.nowMs
        )
    }

    private fun explainTierBlock(block: ExplainSubject.UiBlock, ctx: ExplainContext, cancelled: Boolean): Explanation {
        val subjectId = "block_${block.action.name}_${ctx.nowMs}"
        val ruleIds = mutableListOf(RuleId.TIER2_HOLD_REQUIRED_FOR_ITEM_DROP)

        if (cancelled) {
            ruleIds.add(RuleId.TIER_CONFIRMATION_CANCELLED_BY_RELEASE)
        } else {
            ruleIds.add(RuleId.TIER_CONFIRMATION_NOT_COMPLETED)
        }

        return Explanation(
            explanationId = Explanation.generateId(subjectId, ctx.nowMs),
            subjectId = subjectId,
            decision = ExplainDecision.BLOCKED,
            ruleIds = ruleIds,
            reason = if (cancelled) "Confirmation cancelled" else "Confirmation incomplete",
            details = buildMap {
                put("action", block.action.name)
                put("reason", block.reason.name)
                put("cancelled", cancelled)
                putAll(block.context)
            },
            evidenceRefs = emptyList(),
            remediation = "Hold for 1.5s to confirm.",
            timestampMs = ctx.nowMs
        )
    }

    private fun explainLegendaryBlock(block: ExplainSubject.UiBlock, ctx: ExplainContext): Explanation {
        val subjectId = "block_${block.action.name}_${ctx.nowMs}"

        return Explanation(
            explanationId = Explanation.generateId(subjectId, ctx.nowMs),
            subjectId = subjectId,
            decision = ExplainDecision.BLOCKED,
            ruleIds = listOf(
                RuleId.TIER3_SLIDE_REQUIRED_FOR_LEGENDARY_DROP,
                RuleId.DROP_LEGENDARY_REQUIRES_TIER3,
                RuleId.TIER_CONFIRMATION_NOT_COMPLETED
            ),
            reason = "Legendary items require slide confirmation",
            details = buildMap {
                put("action", block.action.name)
                put("reason", block.reason.name)
                putAll(block.context)
            },
            evidenceRefs = emptyList(),
            remediation = "Slide to 90% to confirm.",
            timestampMs = ctx.nowMs
        )
    }

    private fun explainGenericBlock(block: ExplainSubject.UiBlock, ctx: ExplainContext): Explanation {
        val subjectId = "block_${block.action.name}_${ctx.nowMs}"

        return Explanation(
            explanationId = Explanation.generateId(subjectId, ctx.nowMs),
            subjectId = subjectId,
            decision = ExplainDecision.BLOCKED,
            ruleIds = listOf(RuleId.OVERLAY_ACTION_BLOCKED_DUE_TO_ACTIVE_OVERLAY),
            reason = "Action blocked",
            details = buildMap {
                put("action", block.action.name)
                put("reason", block.reason.name)
                putAll(block.context)
            },
            evidenceRefs = emptyList(),
            remediation = "Try again later.",
            timestampMs = ctx.nowMs
        )
    }
}
