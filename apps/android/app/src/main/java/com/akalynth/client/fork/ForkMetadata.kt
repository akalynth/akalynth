package com.akalynth.client.fork

/**
 * Metadata about a fork.
 *
 * Captures provenance and labeling for the fork.
 * All forks are explicitly non-authoritative.
 *
 * @property forkId Unique identifier for this fork
 * @property label Human-readable label (e.g., "What if I had armor?")
 * @property description Optional longer description
 * @property createdAtMs When the fork was created
 * @property createdBy Who created the fork (playerId or "debug")
 * @property purpose Classification of why this fork exists
 */
data class ForkMetadata(
    val forkId: String,
    val label: String,
    val description: String? = null,
    val createdAtMs: Long,
    val createdBy: String,
    val purpose: ForkPurpose
) {
    companion object {
        /**
         * Generate a unique fork ID.
         */
        fun generateForkId(createdAtMs: Long): String =
            "fork_${createdAtMs}_${(1000..9999).random()}"

        /**
         * Create metadata with generated ID.
         */
        fun create(
            label: String,
            createdBy: String,
            purpose: ForkPurpose = ForkPurpose.WHAT_IF,
            description: String? = null,
            createdAtMs: Long = System.currentTimeMillis()
        ) = ForkMetadata(
            forkId = generateForkId(createdAtMs),
            label = label,
            description = description,
            createdAtMs = createdAtMs,
            createdBy = createdBy,
            purpose = purpose
        )
    }
}

/**
 * Classification of fork purpose.
 *
 * Determines how the fork should be treated and displayed.
 */
enum class ForkPurpose {
    /** "What if X?" exploration */
    WHAT_IF,

    /** Replay with different rules */
    RULE_VARIANT,

    /** Debug/inspection fork */
    DEBUG,

    /** Automatic system fork (e.g., rollback testing) */
    SYSTEM,

    /** User-initiated undo exploration */
    UNDO_EXPLORATION
}
