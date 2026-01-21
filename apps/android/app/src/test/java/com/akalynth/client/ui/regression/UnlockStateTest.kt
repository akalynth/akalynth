package com.akalynth.client.ui.regression

import com.akalynth.client.progression.UnlockState
import org.junit.Test
import org.junit.Assert.*

/**
 * Regression tests for UnlockState and progressive disclosure.
 * Maps to UI_REGRESSION_MATRIX.md Section 4: Progressive Disclosure (U1-U5)
 */
class UnlockStateTest {

    // =========================================================================
    // U1: Fresh install
    // Assertion: Default state is Stage 0
    // =========================================================================

    @Test
    fun `U1 - fresh install is stage 0`() {
        val state = UnlockState()

        assertEquals(0, state.stage)
        assertFalse(state.hasEngagedCombat)
        assertFalse(state.hasPickedUpItem)
        assertFalse(state.hasDied)
    }

    @Test
    fun `U1 - default state has all flags false`() {
        val state = UnlockState.DEFAULT

        assertFalse(state.hasEngagedCombat)
        assertFalse(state.hasPickedUpItem)
        assertFalse(state.hasDied)
        assertEquals(0, state.stage)
    }

    // =========================================================================
    // U2: First combat triggers Stage 1
    // =========================================================================

    @Test
    fun `U2 - combat triggers stage 1`() {
        val state = UnlockState().withCombatEngaged()

        assertEquals(1, state.stage)
        assertTrue(state.hasEngagedCombat)
    }

    @Test
    fun `U2 - combat alone sets stage 1`() {
        val state = UnlockState(hasEngagedCombat = true)

        assertEquals(1, state.stage)
    }

    // =========================================================================
    // U3: First item pickup triggers Stage 2
    // =========================================================================

    @Test
    fun `U3 - item pickup triggers stage 2`() {
        val state = UnlockState(hasEngagedCombat = true).withItemPickedUp()

        assertEquals(2, state.stage)
        assertTrue(state.hasPickedUpItem)
    }

    @Test
    fun `U3 - item pickup without combat still triggers stage 2`() {
        // Edge case: player picks up item before combat
        val state = UnlockState().withItemPickedUp()

        assertEquals(2, state.stage)
        assertTrue(state.hasPickedUpItem)
        assertFalse(state.hasEngagedCombat)
    }

    @Test
    fun `U3 - item pickup alone sets stage 2`() {
        val state = UnlockState(hasPickedUpItem = true)

        assertEquals(2, state.stage)
    }

    // =========================================================================
    // U4: First death triggers Stage 3
    // =========================================================================

    @Test
    fun `U4 - death triggers stage 3`() {
        val state = UnlockState(
            hasEngagedCombat = true,
            hasPickedUpItem = true
        ).withDeath()

        assertEquals(3, state.stage)
        assertTrue(state.hasDied)
    }

    @Test
    fun `U4 - death alone triggers stage 3`() {
        // Edge case: death without combat or item pickup
        val state = UnlockState().withDeath()

        assertEquals(3, state.stage)
        assertTrue(state.hasDied)
        assertFalse(state.hasEngagedCombat)
        assertFalse(state.hasPickedUpItem)
    }

    @Test
    fun `U4 - death alone sets stage 3`() {
        val state = UnlockState(hasDied = true)

        assertEquals(3, state.stage)
    }

    // =========================================================================
    // U5: Stage monotonicity
    // Assertion: Stage never decreases
    // =========================================================================

    @Test
    fun `U5 - stage never decreases`() {
        // Start at stage 3 (all flags true)
        val state = UnlockState(
            hasEngagedCombat = true,
            hasPickedUpItem = true,
            hasDied = true
        )

        assertEquals(3, state.stage)

        // The data class is immutable - you can't "reset" a flag
        // Calling with* methods only sets flags to true (idempotent)
        val afterCombat = state.withCombatEngaged()
        val afterItem = state.withItemPickedUp()
        val afterDeath = state.withDeath()

        assertEquals(3, afterCombat.stage)
        assertEquals(3, afterItem.stage)
        assertEquals(3, afterDeath.stage)
    }

    @Test
    fun `U5 - multiple flag sets are idempotent`() {
        val state = UnlockState()
            .withCombatEngaged()
            .withCombatEngaged()
            .withCombatEngaged()

        assertEquals(1, state.stage)
        assertTrue(state.hasEngagedCombat)
    }

    @Test
    fun `U5 - with methods do not decrease flags`() {
        val state = UnlockState(
            hasEngagedCombat = true,
            hasPickedUpItem = true,
            hasDied = true
        )

        // Even creating new states, all flags remain true
        val newState = state.withCombatEngaged()
        assertTrue(newState.hasEngagedCombat)
        assertTrue(newState.hasPickedUpItem)
        assertTrue(newState.hasDied)
    }

    // =========================================================================
    // Stage calculation
    // =========================================================================

    @Test
    fun `stage calculation is deterministic`() {
        // Test all flag combinations
        val testCases = listOf(
            Triple(false, false, false) to 0,
            Triple(true, false, false) to 1,
            Triple(false, true, false) to 2,
            Triple(true, true, false) to 2,
            Triple(false, false, true) to 3,
            Triple(true, false, true) to 3,
            Triple(false, true, true) to 3,
            Triple(true, true, true) to 3
        )

        for ((flags, expectedStage) in testCases) {
            val (combat, item, death) = flags
            val state = UnlockState(
                hasEngagedCombat = combat,
                hasPickedUpItem = item,
                hasDied = death
            )
            assertEquals(
                "Flags ($combat, $item, $death) should be stage $expectedStage",
                expectedStage,
                state.stage
            )
        }
    }

    @Test
    fun `stage is highest unlocked by any flag`() {
        // Death flag alone should give stage 3
        val deathOnly = UnlockState(hasDied = true)
        assertEquals(3, deathOnly.stage)

        // Item flag alone should give stage 2
        val itemOnly = UnlockState(hasPickedUpItem = true)
        assertEquals(2, itemOnly.stage)

        // Combat flag alone should give stage 1
        val combatOnly = UnlockState(hasEngagedCombat = true)
        assertEquals(1, combatOnly.stage)
    }

    @Test
    fun `stage priority is death over item over combat`() {
        // Even with combat and item, death wins
        val state = UnlockState(
            hasEngagedCombat = true,
            hasPickedUpItem = true,
            hasDied = true
        )
        assertEquals(3, state.stage)

        // With combat and item but no death, item wins
        val noDeathState = UnlockState(
            hasEngagedCombat = true,
            hasPickedUpItem = true,
            hasDied = false
        )
        assertEquals(2, noDeathState.stage)
    }
}
