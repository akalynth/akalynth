package com.akalynth.client.snapshot

/**
 * State attestation (v0).
 *
 * A snapshot answers: "What was true about the world at sequence N?"
 *
 * Architectural distinction:
 * - Intent answers: "What was attempted?"
 * - Receipt answers: "What happened?"
 * - Explanation answers: "Why did it happen?"
 * - Snapshot answers: "What state resulted?"
 *
 * Snapshots are evidence, not law. They prove that rules were enforced,
 * but they don't define the rules.
 *
 * Versioned (V0) to allow schema evolution without invalidating old explanations.
 *
 * @property sequence Monotonic sequence number (state version)
 * @property stateHash Deterministic hash of state at this sequence
 */
data class SnapshotV0(
    val sequence: Long,
    val stateHash: String
) {
    companion object {
        /**
         * Create a snapshot for testing with known values.
         */
        fun forTest(
            sequence: Long = 1,
            stateHash: String = "hash_test_0"
        ): SnapshotV0 = SnapshotV0(
            sequence = sequence,
            stateHash = stateHash
        )
    }
}
