package com.akalynth.client.snapshot

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.util.TreeMap

/**
 * Store for SnapshotV0 instances keyed by sequence.
 *
 * Provides:
 * - Ordered storage by sequence (NavigableMap)
 * - Latest snapshot tracking
 * - Snapshot pair retrieval (for evidence)
 * - Thread-safe operations
 *
 * Snapshots are immutable once stored.
 */
class SnapshotStore {

    private val mutex = Mutex()
    private val snapshots = TreeMap<Long, SnapshotV0>()
    private val _latest = MutableStateFlow<SnapshotV0?>(null)

    /**
     * Observable latest snapshot.
     */
    val latest: StateFlow<SnapshotV0?> = _latest.asStateFlow()

    /**
     * Store a snapshot.
     *
     * @param snapshot The snapshot to store
     */
    suspend fun put(snapshot: SnapshotV0) = mutex.withLock {
        snapshots[snapshot.sequence] = snapshot

        // Update latest if this is newer
        val current = _latest.value
        if (current == null || snapshot.sequence > current.sequence) {
            _latest.value = snapshot
        }
    }

    /**
     * Get a snapshot by sequence.
     *
     * @param sequence The sequence to look up
     * @return The snapshot at that sequence, or null
     */
    suspend fun get(sequence: Long): SnapshotV0? = mutex.withLock {
        snapshots[sequence]
    }

    /**
     * Get the snapshot pair at a sequence (prev, current).
     *
     * @param sequence The current sequence
     * @return Pair of (previous, current) snapshots
     */
    suspend fun getPair(sequence: Long): Pair<SnapshotV0?, SnapshotV0?> = mutex.withLock {
        val current = snapshots[sequence]
        val prev = snapshots.lowerEntry(sequence)?.value
        Pair(prev, current)
    }

    /**
     * Get snapshot immediately before the given sequence.
     *
     * @param sequence The reference sequence
     * @return The previous snapshot, or null
     */
    suspend fun getPrevious(sequence: Long): SnapshotV0? = mutex.withLock {
        snapshots.lowerEntry(sequence)?.value
    }

    /**
     * Get snapshot immediately after the given sequence.
     *
     * @param sequence The reference sequence
     * @return The next snapshot, or null
     */
    suspend fun getNext(sequence: Long): SnapshotV0? = mutex.withLock {
        snapshots.higherEntry(sequence)?.value
    }

    /**
     * Get all snapshots in sequence order.
     */
    suspend fun getAll(): List<SnapshotV0> = mutex.withLock {
        snapshots.values.toList()
    }

    /**
     * Get all snapshots as a map (for TimelineIndex building).
     */
    suspend fun toMap(): Map<Long, SnapshotV0> = mutex.withLock {
        snapshots.toMap()
    }

    /**
     * Get the minimum sequence.
     */
    suspend fun minSequence(): Long? = mutex.withLock {
        if (snapshots.isEmpty()) null else snapshots.firstKey()
    }

    /**
     * Get the maximum sequence.
     */
    suspend fun maxSequence(): Long? = mutex.withLock {
        if (snapshots.isEmpty()) null else snapshots.lastKey()
    }

    /**
     * Count of stored snapshots.
     */
    suspend fun count(): Int = mutex.withLock {
        snapshots.size
    }

    /**
     * Clear all snapshots.
     */
    suspend fun clear() = mutex.withLock {
        snapshots.clear()
        _latest.value = null
    }

    /**
     * Keep only the N most recent snapshots (for memory management).
     *
     * @param keep Number of snapshots to keep
     * @return Number of snapshots removed
     */
    suspend fun trim(keep: Int): Int = mutex.withLock {
        if (snapshots.size <= keep) return@withLock 0

        val toRemove = snapshots.size - keep
        repeat(toRemove) {
            snapshots.pollFirstEntry()
        }
        toRemove
    }
}
