package com.akalynth.client.explain

/**
 * Decision outcome for an explanation.
 */
enum class ExplainDecision {
    /** Action is pending server confirmation */
    PENDING,

    /** Action was confirmed by server */
    CONFIRMED,

    /** Action was rejected by server */
    REJECTED,

    /** Action was blocked by client (UI/stage/tier) */
    BLOCKED,

    /** Action was allowed (informational) */
    ALLOWED,

    /** Action was modified by server (partial success) */
    MODIFIED
}

/**
 * Deterministic explanation record.
 *
 * Every blocked, confirmed, or pending action yields an explanation
 * with at least 1 rule ID and 1 evidence ref.
 *
 * @property explanationId Unique ID for this explanation
 * @property subjectId The eventId, actionId, or synthetic ID being explained
 * @property decision The outcome decision
 * @property ruleIds List of applicable rule IDs (from RuleId)
 * @property reason Short human-readable reason
 * @property details Structured details for UI rendering
 * @property evidenceRefs List of evidence references (receipt IDs, proof IDs)
 * @property remediation Optional remediation hint for the user
 * @property timestampMs When this explanation was generated
 */
data class Explanation(
    val explanationId: String,
    val subjectId: String,
    val decision: ExplainDecision,
    val ruleIds: List<String>,
    val reason: String,
    val details: Map<String, Any?> = emptyMap(),
    val evidenceRefs: List<String> = emptyList(),
    val remediation: String? = null,
    val timestampMs: Long
) {
    init {
        require(ruleIds.isNotEmpty()) { "Explanation must have at least one rule ID" }
    }

    /**
     * Check if this explanation cites a specific rule.
     */
    fun citesRule(ruleId: String): Boolean = ruleIds.contains(ruleId)

    /**
     * Check if this explanation has any evidence.
     */
    fun hasEvidence(): Boolean = evidenceRefs.isNotEmpty()

    companion object {
        /**
         * Generate an explanation ID.
         */
        fun generateId(subjectId: String, timestampMs: Long): String =
            "exp_${subjectId}_$timestampMs"
    }
}
