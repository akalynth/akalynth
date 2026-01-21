package com.akalynth.client.progression

import kotlinx.serialization.Serializable

/**
 * Progressive disclosure state for UI unlocks.
 * Maps to UI_REGRESSION_MATRIX.md Section 4 (U1-U5).
 *
 * Stage calculation:
 * - Stage 0: Default (no flags set)
 * - Stage 1: hasEngagedCombat = true
 * - Stage 2: hasPickedUpItem = true
 * - Stage 3: hasDied = true
 *
 * Stage is the MAXIMUM unlocked by ANY flag (not additive).
 * Once a flag is true, it cannot be reset (monotonic progression).
 */
@Serializable
data class UnlockState(
    val hasEngagedCombat: Boolean = false,
    val hasPickedUpItem: Boolean = false,
    val hasDied: Boolean = false
) {
    /**
     * Current unlock stage (0-3).
     *
     * Stage determines UI visibility:
     * - 0: D-pad + HP + Chat only
     * - 1: + Attack + Menu
     * - 2: + Hotbar + Why button
     * - 3: + Rep/Gold + Nearby players
     */
    val stage: Int
        get() = when {
            hasDied -> 3
            hasPickedUpItem -> 2
            hasEngagedCombat -> 1
            else -> 0
        }

    /**
     * Create new state with combat engaged.
     * Idempotent: calling multiple times has no additional effect.
     */
    fun withCombatEngaged(): UnlockState = copy(hasEngagedCombat = true)

    /**
     * Create new state with item picked up.
     * Idempotent: calling multiple times has no additional effect.
     */
    fun withItemPickedUp(): UnlockState = copy(hasPickedUpItem = true)

    /**
     * Create new state with death recorded.
     * Idempotent: calling multiple times has no additional effect.
     */
    fun withDeath(): UnlockState = copy(hasDied = true)

    companion object {
        /** Default state for new players (Stage 0) */
        val DEFAULT = UnlockState()
    }
}
