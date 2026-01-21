package com.akalynth.client.explain

import com.akalynth.client.ui.state.UiOverlayState

/**
 * Context for explanation generation.
 *
 * Contains all state needed to produce deterministic explanations.
 * No I/O, no side effects - just data.
 *
 * @property nowMs Current timestamp for explanation generation
 * @property overlay Current UI overlay state (for contention explanations)
 * @property unlockStage Current player unlock stage (for stage gate explanations)
 */
data class ExplainContext(
    val nowMs: Long,
    val overlay: UiOverlayState? = null,
    val unlockStage: Int? = null
) {
    companion object {
        /**
         * Create a minimal context with just timestamp.
         */
        fun now(): ExplainContext = ExplainContext(
            nowMs = System.currentTimeMillis()
        )

        /**
         * Create a context for testing with fixed timestamp.
         */
        fun forTest(
            nowMs: Long = 1705838400000,
            overlay: UiOverlayState? = null,
            unlockStage: Int? = null
        ): ExplainContext = ExplainContext(
            nowMs = nowMs,
            overlay = overlay,
            unlockStage = unlockStage
        )
    }
}
