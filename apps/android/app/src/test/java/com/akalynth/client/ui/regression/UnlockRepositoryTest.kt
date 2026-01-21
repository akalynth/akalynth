package com.akalynth.client.ui.regression

import com.akalynth.client.progression.UnlockRepository
import com.akalynth.client.progression.UnlockState
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.launch
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import org.junit.Before
import org.junit.Test
import org.junit.Assert.*

/**
 * Regression tests for UnlockRepository persistence.
 * Maps to UI_REGRESSION_MATRIX.md Section 4: U6 (DataStore write verification)
 */
class UnlockRepositoryTest {

    private lateinit var fakeDataStore: FakeDataStore
    private lateinit var repository: UnlockRepository

    @Before
    fun setup() {
        fakeDataStore = FakeDataStore()
        repository = UnlockRepository(fakeDataStore)
    }

    // =========================================================================
    // U6: DataStore write verification
    // Assertion: Write confirmed before state change acknowledged
    // =========================================================================

    @Test
    fun `U6 - write confirmed before state change`() = runTest {
        // Record combat - function suspends until write completes
        repository.recordCombat()

        // Immediately read - should see the change
        val state = repository.unlockState.first()
        assertTrue("State should reflect combat after recordCombat returns", state.hasEngagedCombat)
        assertEquals(1, state.stage)
    }

    @Test
    fun `U6 - recordItemPickup persists immediately`() = runTest {
        repository.recordItemPickup()

        val state = repository.unlockState.first()
        assertTrue(state.hasPickedUpItem)
        assertEquals(2, state.stage)
    }

    @Test
    fun `U6 - recordDeath persists immediately`() = runTest {
        repository.recordDeath()

        val state = repository.unlockState.first()
        assertTrue(state.hasDied)
        assertEquals(3, state.stage)
    }

    @Test
    fun `read reflects latest write`() = runTest {
        // Write combat
        repository.recordCombat()
        var state = repository.unlockState.first()
        assertEquals(1, state.stage)

        // Write item pickup
        repository.recordItemPickup()
        state = repository.unlockState.first()
        assertEquals(2, state.stage)

        // Write death
        repository.recordDeath()
        state = repository.unlockState.first()
        assertEquals(3, state.stage)
    }

    @Test
    fun `concurrent writes are serialized`() = runTest {
        // Launch all three writes concurrently
        val jobs = listOf(
            async { repository.recordCombat() },
            async { repository.recordItemPickup() },
            async { repository.recordDeath() }
        )
        jobs.awaitAll()

        // Final state should have all flags true
        val state = repository.unlockState.first()
        assertTrue(state.hasEngagedCombat)
        assertTrue(state.hasPickedUpItem)
        assertTrue(state.hasDied)
        assertEquals(3, state.stage)
    }

    // =========================================================================
    // Flow emission
    // =========================================================================

    @Test
    fun `unlockState flow emits on change`() = runTest {
        val emissions = mutableListOf<UnlockState>()
        val job = launch {
            repository.unlockState.collect { emissions.add(it) }
        }

        // Initial emission - use advanceUntilIdle() which is a TestScope method
        advanceUntilIdle()
        assertTrue("Should have initial emission", emissions.isNotEmpty())
        assertEquals(0, emissions.last().stage)

        // Record combat
        repository.recordCombat()
        advanceUntilIdle()
        assertTrue("Should have stage 1 after combat", emissions.any { it.stage == 1 })

        job.cancel()
    }

    @Test
    fun `unlockState flow emits initial value`() = runTest {
        val state = repository.unlockState.first()

        assertEquals(UnlockState.DEFAULT, state)
        assertEquals(0, state.stage)
    }

    @Test
    fun `unlockState flow emits default for fresh datastore`() = runTest {
        val freshStore = FakeDataStore()
        val freshRepo = UnlockRepository(freshStore)

        val state = freshRepo.unlockState.first()
        assertFalse(state.hasEngagedCombat)
        assertFalse(state.hasPickedUpItem)
        assertFalse(state.hasDied)
    }

    // =========================================================================
    // Persistence across "restarts"
    // =========================================================================

    @Test
    fun `state survives repository recreation`() = runTest {
        // Write state
        repository.recordCombat()
        repository.recordItemPickup()

        // Create new repository with same DataStore (simulates restart)
        val newRepository = UnlockRepository(fakeDataStore)

        // Read from new repository
        val state = newRepository.unlockState.first()
        assertTrue("Combat should persist", state.hasEngagedCombat)
        assertTrue("Item pickup should persist", state.hasPickedUpItem)
        assertFalse("Death should not be set", state.hasDied)
        assertEquals(2, state.stage)
    }

    @Test
    fun `U2 - stage 1 persists after restart`() = runTest {
        repository.recordCombat()

        // Simulate restart
        val newRepository = UnlockRepository(fakeDataStore)
        val state = newRepository.unlockState.first()

        assertEquals(1, state.stage)
    }

    @Test
    fun `U3 - stage 2 persists after restart`() = runTest {
        repository.recordItemPickup()

        // Simulate restart
        val newRepository = UnlockRepository(fakeDataStore)
        val state = newRepository.unlockState.first()

        assertEquals(2, state.stage)
    }

    @Test
    fun `U4 - stage 3 persists after restart`() = runTest {
        repository.recordDeath()

        // Simulate restart
        val newRepository = UnlockRepository(fakeDataStore)
        val state = newRepository.unlockState.first()

        assertEquals(3, state.stage)
    }

    // =========================================================================
    // Idempotency
    // =========================================================================

    @Test
    fun `recordCombat is idempotent`() = runTest {
        repository.recordCombat()
        repository.recordCombat()
        repository.recordCombat()

        val state = repository.unlockState.first()
        assertTrue(state.hasEngagedCombat)
        assertEquals(1, state.stage)
    }

    @Test
    fun `recordItemPickup is idempotent`() = runTest {
        repository.recordItemPickup()
        repository.recordItemPickup()

        val state = repository.unlockState.first()
        assertTrue(state.hasPickedUpItem)
    }

    @Test
    fun `recordDeath is idempotent`() = runTest {
        repository.recordDeath()
        repository.recordDeath()

        val state = repository.unlockState.first()
        assertTrue(state.hasDied)
    }
}
