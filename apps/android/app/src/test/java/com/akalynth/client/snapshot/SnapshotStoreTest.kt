package com.akalynth.client.snapshot

import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Tests for SnapshotStore (PR 6C-1).
 */
class SnapshotStoreTest {

    private lateinit var store: SnapshotStore

    @Before
    fun setup() {
        store = SnapshotStore()
    }

    @Test
    fun `put and get snapshot`() = runTest {
        val snapshot = SnapshotV0(sequence = 1, stateHash = "hash_1")

        store.put(snapshot)
        val retrieved = store.get(1L)

        assertEquals(snapshot, retrieved)
    }

    @Test
    fun `get returns null for missing sequence`() = runTest {
        assertNull(store.get(999L))
    }

    @Test
    fun `latest tracks most recent snapshot`() = runTest {
        store.put(SnapshotV0(sequence = 1, stateHash = "hash_1"))
        assertEquals(1L, store.latest.value?.sequence)

        store.put(SnapshotV0(sequence = 5, stateHash = "hash_5"))
        assertEquals(5L, store.latest.value?.sequence)

        // Earlier sequence doesn't update latest
        store.put(SnapshotV0(sequence = 3, stateHash = "hash_3"))
        assertEquals(5L, store.latest.value?.sequence)
    }

    @Test
    fun `getPair returns prev and current`() = runTest {
        store.put(SnapshotV0(sequence = 1, stateHash = "hash_1"))
        store.put(SnapshotV0(sequence = 2, stateHash = "hash_2"))
        store.put(SnapshotV0(sequence = 3, stateHash = "hash_3"))

        val (prev, curr) = store.getPair(2L)

        assertEquals(1L, prev?.sequence)
        assertEquals(2L, curr?.sequence)
    }

    @Test
    fun `getPair at first sequence has no prev`() = runTest {
        store.put(SnapshotV0(sequence = 1, stateHash = "hash_1"))
        store.put(SnapshotV0(sequence = 2, stateHash = "hash_2"))

        val (prev, curr) = store.getPair(1L)

        assertNull(prev)
        assertEquals(1L, curr?.sequence)
    }

    @Test
    fun `getPrevious returns previous snapshot`() = runTest {
        store.put(SnapshotV0(sequence = 10, stateHash = "hash_10"))
        store.put(SnapshotV0(sequence = 20, stateHash = "hash_20"))
        store.put(SnapshotV0(sequence = 30, stateHash = "hash_30"))

        val prev = store.getPrevious(25L)

        assertEquals(20L, prev?.sequence)
    }

    @Test
    fun `getNext returns next snapshot`() = runTest {
        store.put(SnapshotV0(sequence = 10, stateHash = "hash_10"))
        store.put(SnapshotV0(sequence = 20, stateHash = "hash_20"))
        store.put(SnapshotV0(sequence = 30, stateHash = "hash_30"))

        val next = store.getNext(15L)

        assertEquals(20L, next?.sequence)
    }

    @Test
    fun `getAll returns snapshots in order`() = runTest {
        store.put(SnapshotV0(sequence = 3, stateHash = "hash_3"))
        store.put(SnapshotV0(sequence = 1, stateHash = "hash_1"))
        store.put(SnapshotV0(sequence = 2, stateHash = "hash_2"))

        val all = store.getAll()

        assertEquals(3, all.size)
        assertEquals(1L, all[0].sequence)
        assertEquals(2L, all[1].sequence)
        assertEquals(3L, all[2].sequence)
    }

    @Test
    fun `toMap returns map keyed by sequence`() = runTest {
        store.put(SnapshotV0(sequence = 1, stateHash = "hash_1"))
        store.put(SnapshotV0(sequence = 2, stateHash = "hash_2"))

        val map = store.toMap()

        assertEquals(2, map.size)
        assertEquals("hash_1", map[1L]?.stateHash)
        assertEquals("hash_2", map[2L]?.stateHash)
    }

    @Test
    fun `minSequence and maxSequence`() = runTest {
        store.put(SnapshotV0(sequence = 5, stateHash = "hash_5"))
        store.put(SnapshotV0(sequence = 10, stateHash = "hash_10"))
        store.put(SnapshotV0(sequence = 3, stateHash = "hash_3"))

        assertEquals(3L, store.minSequence())
        assertEquals(10L, store.maxSequence())
    }

    @Test
    fun `clear removes all snapshots`() = runTest {
        store.put(SnapshotV0(sequence = 1, stateHash = "hash_1"))
        store.put(SnapshotV0(sequence = 2, stateHash = "hash_2"))

        store.clear()

        assertEquals(0, store.count())
        assertNull(store.latest.value)
        assertNull(store.minSequence())
    }

    @Test
    fun `trim keeps N most recent`() = runTest {
        store.put(SnapshotV0(sequence = 1, stateHash = "hash_1"))
        store.put(SnapshotV0(sequence = 2, stateHash = "hash_2"))
        store.put(SnapshotV0(sequence = 3, stateHash = "hash_3"))
        store.put(SnapshotV0(sequence = 4, stateHash = "hash_4"))
        store.put(SnapshotV0(sequence = 5, stateHash = "hash_5"))

        val removed = store.trim(3)

        assertEquals(2, removed)
        assertEquals(3, store.count())
        assertEquals(3L, store.minSequence()) // 1 and 2 removed
        assertEquals(5L, store.maxSequence())
    }

    @Test
    fun `trim with keep greater than count does nothing`() = runTest {
        store.put(SnapshotV0(sequence = 1, stateHash = "hash_1"))
        store.put(SnapshotV0(sequence = 2, stateHash = "hash_2"))

        val removed = store.trim(10)

        assertEquals(0, removed)
        assertEquals(2, store.count())
    }

    @Test
    fun `count returns correct number`() = runTest {
        assertEquals(0, store.count())

        store.put(SnapshotV0(sequence = 1, stateHash = "hash_1"))
        assertEquals(1, store.count())

        store.put(SnapshotV0(sequence = 2, stateHash = "hash_2"))
        assertEquals(2, store.count())
    }
}
