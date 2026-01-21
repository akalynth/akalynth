package com.akalynth.client.rules

/**
 * Rule severity levels.
 *
 * - INFO: Explanatory, no action required
 * - WARNING: User-actionable, not blocking
 * - ENFORCEMENT: Blocking, action prevented
 */
enum class RuleSeverity {
    /** Explanatory information, no action required */
    INFO,

    /** User-actionable warning, not blocking */
    WARNING,

    /** Enforcement, action is blocked */
    ENFORCEMENT
}

/**
 * Rule definition with human-readable metadata.
 *
 * @property id Canonical rule ID (from RuleId)
 * @property title Short human-readable title
 * @property description Precise factual description
 * @property severity Severity level
 * @property remediation Optional remediation hint for the user
 */
data class RuleDefinition(
    val id: String,
    val title: String,
    val description: String,
    val severity: RuleSeverity,
    val remediation: String? = null
) {
    init {
        require(id.isNotBlank()) { "Rule ID cannot be blank" }
        require(title.isNotBlank()) { "Rule title cannot be blank" }
        require(description.isNotBlank()) { "Rule description cannot be blank" }
    }
}
