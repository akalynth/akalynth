package com.akalynth.client.fork

import com.akalynth.client.timeline.TimelineCursor
import com.akalynth.client.timeline.TimelineEntry
import com.akalynth.client.timeline.TimelineIndex
import com.akalynth.client.timeline.TimeTravelDebugger
import java.util.TreeMap

/**
 * Builder for creating forks from authoritative timelines.
 *
 * Design principles:
 * - Pure function (no side effects)
 * - Never modifies source timeline
 * - Explicitly marks all entries by origin
 * - Validates branch points
 */
object ForkBuilder {

    /**
     * Create a fork from a timeline at a specific cursor.
     *
     * The fork will:
     * - Inherit all entries up to and including the cursor
     * - Mark inherited entries as INHERITED
     * - Be ready to accept simulated entries after the branch point
     *
     * @param debugger The authoritative timeline debugger
     * @param cursor Where to branch from
     * @param label Human-readable label for the fork
     * @param createdBy Who is creating the fork
     * @param purpose Why this fork exists
     * @param description Optional longer description
     */
    fun forkAt(
        debugger: TimeTravelDebugger,
        cursor: TimelineCursor,
        label: String,
        createdBy: String,
        purpose: ForkPurpose = ForkPurpose.WHAT_IF,
        description: String? = null,
        createdAtMs: Long = System.currentTimeMillis()
    ): ForkTimeline? {
        // Navigate to the branch point
        val branchEntry = debugger.goToSequence(cursor.sequence) ?: return null

        // Create branch point
        val branchPoint = ForkPoint.from(branchEntry, createdAtMs)

        // Create metadata
        val metadata = ForkMetadata.create(
            label = label,
            createdBy = createdBy,
            purpose = purpose,
            description = description,
            createdAtMs = createdAtMs
        )

        // Collect inherited entries (up to and including branch point)
        val inheritedEntries = TreeMap<Long, ForkEntry>()
        val allEntries = debugger.allEntries()

        for (entry in allEntries) {
            if (entry.sequence <= cursor.sequence) {
                inheritedEntries[entry.sequence] = ForkEntry.inherited(
                    sequence = entry.sequence,
                    cursor = entry.cursor,
                    event = entry.event,
                    prevSnapshot = entry.prevSnapshot,
                    snapshot = entry.snapshot,
                    snapshotEvidence = entry.snapshotEvidence,
                    snapshotDiff = entry.snapshotDiff,
                    explanation = entry.explanation
                )
            }
        }

        return ForkTimeline(
            metadata = metadata,
            branchPoint = branchPoint,
            entries = inheritedEntries
        )
    }

    /**
     * Create a fork from a timeline index at a specific sequence.
     *
     * @param index The authoritative timeline index
     * @param sequence Where to branch from
     * @param label Human-readable label
     * @param createdBy Who is creating the fork
     * @param purpose Why this fork exists
     */
    fun forkAtSequence(
        index: TimelineIndex,
        sequence: Long,
        label: String,
        createdBy: String,
        purpose: ForkPurpose = ForkPurpose.WHAT_IF,
        createdAtMs: Long = System.currentTimeMillis()
    ): ForkTimeline? {
        // Get branch entry
        val branchEntry = index.getAtSequence(sequence) ?: return null

        // Create branch point
        val branchPoint = ForkPoint.from(branchEntry, createdAtMs)

        // Create metadata
        val metadata = ForkMetadata.create(
            label = label,
            createdBy = createdBy,
            purpose = purpose,
            createdAtMs = createdAtMs
        )

        // Collect inherited entries
        val inheritedEntries = TreeMap<Long, ForkEntry>()

        index.bySequence.headMap(sequence, true).forEach { (seq, entry) ->
            inheritedEntries[seq] = ForkEntry.inherited(
                sequence = entry.sequence,
                cursor = entry.cursor,
                event = entry.event,
                prevSnapshot = entry.prevSnapshot,
                snapshot = entry.snapshot,
                snapshotEvidence = entry.snapshotEvidence,
                snapshotDiff = entry.snapshotDiff,
                explanation = entry.explanation
            )
        }

        return ForkTimeline(
            metadata = metadata,
            branchPoint = branchPoint,
            entries = inheritedEntries
        )
    }

    /**
     * Create a fork from a single entry (minimal fork for testing).
     */
    fun forkFromEntry(
        entry: TimelineEntry,
        label: String,
        createdBy: String,
        purpose: ForkPurpose = ForkPurpose.DEBUG,
        createdAtMs: Long = System.currentTimeMillis()
    ): ForkTimeline {
        val branchPoint = ForkPoint.from(entry, createdAtMs)

        val metadata = ForkMetadata.create(
            label = label,
            createdBy = createdBy,
            purpose = purpose,
            createdAtMs = createdAtMs
        )

        val entries = TreeMap<Long, ForkEntry>()
        entries[entry.sequence] = ForkEntry.inherited(
            sequence = entry.sequence,
            cursor = entry.cursor,
            event = entry.event,
            prevSnapshot = entry.prevSnapshot,
            snapshot = entry.snapshot,
            snapshotEvidence = entry.snapshotEvidence,
            snapshotDiff = entry.snapshotDiff,
            explanation = entry.explanation
        )

        return ForkTimeline(
            metadata = metadata,
            branchPoint = branchPoint,
            entries = entries
        )
    }
}
