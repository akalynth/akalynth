package com.akalynth.client.snapshot

import org.junit.Assert.*
import org.junit.Test

/**
 * Tests for SnapshotV0 (state attestation).
 */
class SnapshotV0Test {

    @Test
    fun `snapshot holds sequence and hash`() {
        val snapshot = SnapshotV0(
            sequence = 418,
            stateHash = "hash_abc123"
        )

        assertEquals(418L, snapshot.sequence)
        assertEquals("hash_abc123", snapshot.stateHash)
    }

    @Test
    fun `forTest creates with defaults`() {
        val snapshot = SnapshotV0.forTest()

        assertEquals(1L, snapshot.sequence)
        assertEquals("hash_test_0", snapshot.stateHash)
    }

    @Test
    fun `forTest allows custom values`() {
        val snapshot = SnapshotV0.forTest(
            sequence = 999,
            stateHash = "custom_hash"
        )

        assertEquals(999L, snapshot.sequence)
        assertEquals("custom_hash", snapshot.stateHash)
    }

    @Test
    fun `data class equality works`() {
        val snap1 = SnapshotV0(sequence = 100, stateHash = "hash")
        val snap2 = SnapshotV0(sequence = 100, stateHash = "hash")

        assertEquals(snap1, snap2)
    }

    @Test
    fun `different sequences are not equal`() {
        val snap1 = SnapshotV0(sequence = 100, stateHash = "hash")
        val snap2 = SnapshotV0(sequence = 101, stateHash = "hash")

        assertNotEquals(snap1, snap2)
    }
}
