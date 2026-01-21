package com.akalynth.client.chronicle

/**
 * Canonical key selection for idempotent upsert.
 *
 * Key priority:
 * 1. If actionId != null → key by actionId (prefixed "a:")
 * 2. Else → key by eventId (prefixed "e:")
 *
 * This guarantees:
 * - A pending client-intent event gets upgraded by the receipt
 * - Duplicate receipts don't duplicate rows
 */
object ChronicleKey {

    /**
     * Get the canonical key for a chronicle event.
     */
    fun keyFor(e: ChronicleEvent): String =
        e.actionId?.let { "a:$it" } ?: "e:${e.eventId}"

    /**
     * Get the canonical key for a receipt.
     */
    fun keyFor(r: Receipt): String =
        r.actionId?.let { "a:$it" } ?: "e:${r.receiptId}"
}
