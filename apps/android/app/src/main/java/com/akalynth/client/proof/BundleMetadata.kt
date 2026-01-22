package com.akalynth.client.proof

/**
 * Metadata about a proof bundle.
 *
 * Captures provenance, creation context, and versioning information.
 * All fields are immutable and deterministically serializable.
 *
 * @property version Bundle schema version (for forward compatibility)
 * @property createdAtMs When this bundle was assembled (epoch ms)
 * @property createdBy Entity that created the bundle (playerId, "client", etc.)
 * @property bundleType Classification of what this bundle proves
 * @property label Optional human-readable label
 */
data class BundleMetadata(
    val version: Int,
    val createdAtMs: Long,
    val createdBy: String,
    val bundleType: BundleType,
    val label: String? = null
) {
    companion object {
        /** Current bundle schema version */
        const val CURRENT_VERSION = 1

        /**
         * Create metadata with current version and timestamp.
         */
        fun create(
            createdBy: String,
            bundleType: BundleType,
            label: String? = null,
            createdAtMs: Long = System.currentTimeMillis()
        ) = BundleMetadata(
            version = CURRENT_VERSION,
            createdAtMs = createdAtMs,
            createdBy = createdBy,
            bundleType = bundleType,
            label = label
        )
    }
}

/**
 * Classification of proof bundle types.
 *
 * Determines expected content and verification rules.
 */
enum class BundleType {
    /** Death event with items lost, killer info */
    DEATH_PROOF,

    /** Item drop with reason chain */
    DROP_PROOF,

    /** Zone transition with entry/exit receipts */
    ZONE_TRANSITION_PROOF,

    /** Combat kill with damage chain */
    COMBAT_PROOF,

    /** Item pickup with ownership transfer */
    PICKUP_PROOF,

    /** Generic event proof */
    EVENT_PROOF
}
