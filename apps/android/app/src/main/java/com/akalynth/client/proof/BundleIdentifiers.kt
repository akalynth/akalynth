package com.akalynth.client.proof

/**
 * All identifying information for a proof bundle.
 *
 * Bundles together the various IDs that link to external records.
 * Any ID may be null if not applicable (e.g., no actionId for server-initiated events).
 *
 * @property bundleId Unique ID for this bundle
 * @property eventId Chronicle event ID (authoritative when confirmed)
 * @property actionId Client action correlation ID (if user-initiated)
 * @property receiptId Server receipt ID (if confirmed)
 * @property playerId Player this bundle relates to
 * @property sessionId Session in which this occurred (optional)
 * @property sequence Chronicle sequence number at this point
 */
data class BundleIdentifiers(
    val bundleId: String,
    val eventId: String,
    val actionId: String? = null,
    val receiptId: String? = null,
    val playerId: String,
    val sessionId: String? = null,
    val sequence: Long? = null
) {
    /**
     * Check if this bundle is linked to a confirmed receipt.
     */
    val isReceipted: Boolean get() = receiptId != null

    /**
     * Check if this bundle has an action correlation.
     */
    val hasActionCorrelation: Boolean get() = actionId != null

    companion object {
        /**
         * Generate a unique bundle ID.
         */
        fun generateBundleId(eventId: String, timestampMs: Long): String =
            "bundle_${eventId}_$timestampMs"

        /**
         * Generate bundle ID from receipt.
         */
        fun generateBundleId(receiptId: String): String =
            "bundle_$receiptId"
    }
}
