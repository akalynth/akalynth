package com.akalynth.client.chronicle

/**
 * Normalized receipt model.
 *
 * Even if the real server receipt is richer, normalize it to this
 * internal shape at the edge. The UI/domain never sees raw JSON.
 *
 * @property receiptId Authoritative server-assigned ID
 * @property actionId Correlation ID if this receipt acknowledges a client action
 * @property type Receipt type string (e.g., "death", "item_drop")
 * @property timestampMs Server timestamp in epoch milliseconds
 * @property payload Raw details from receipt
 */
data class Receipt(
    val receiptId: String,
    val actionId: String?,
    val type: String,
    val timestampMs: Long,
    val payload: Map<String, Any?>
)
