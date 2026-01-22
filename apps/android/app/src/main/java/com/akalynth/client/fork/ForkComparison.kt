package com.akalynth.client.fork

import com.akalynth.client.snapshot.SnapshotV0
import com.akalynth.client.snapshot.diff.SnapshotDiff
import com.akalynth.client.snapshot.diff.SnapshotDiffAdapter
import com.akalynth.client.timeline.TimelineEntry
import com.akalynth.client.timeline.TimelineIndex

/**
 * Comparison between baseline (authoritative) and forked timelines.
 *
 * Allows answering questions like:
 * - "What would have been different if X?"
 * - "How did the fork diverge from reality?"
 * - "What items would I still have if I hadn't died?"
 *
 * @property forkId The fork being compared
 * @property baselineEndSequence Where the baseline ends
 * @property forkEndSequence Where the fork ends
 * @property divergencePoint Where fork differs from baseline
 * @property baselineOutcome Final state in baseline (if available)
 * @property forkOutcome Final state in fork (if available)
 * @property outcomeDiff Diff between baseline and fork outcomes
 * @property eventCountDelta Difference in event count
 */
data class ForkComparison(
    val forkId: String,
    val baselineEndSequence: Long?,
    val forkEndSequence: Long?,
    val divergencePoint: Long,
    val baselineOutcome: SnapshotV0?,
    val forkOutcome: SnapshotV0?,
    val outcomeDiff: SnapshotDiff?,
    val eventCountDelta: Int,
    val baselineEventCount: Int,
    val forkEventCount: Int
) {
    /**
     * True if fork has diverged from baseline.
     */
    val hasDiverged: Boolean get() = forkEndSequence != null &&
        forkEndSequence > divergencePoint

    /**
     * True if outcomes differ.
     */
    val outcomesAreDifferent: Boolean get() =
        outcomeDiff != null && outcomeDiff.hasChanges

    /**
     * Number of simulated events in fork.
     */
    val simulatedEventCount: Int get() = forkEventCount - baselineEventCount.coerceAtMost(
        divergencePoint.toInt()
    )

    /**
     * Summary text for the comparison.
     */
    fun toSummary(): String = buildString {
        appendLine("Fork Comparison: $forkId")
        appendLine("─────────────────────────────────────")
        appendLine("Baseline events: $baselineEventCount")
        appendLine("Fork events:     $forkEventCount (${if (eventCountDelta >= 0) "+" else ""}$eventCountDelta)")
        appendLine("Divergence at:   sequence $divergencePoint")

        if (hasDiverged) {
            appendLine("Status:          DIVERGED")
        } else {
            appendLine("Status:          MATCHES BASELINE")
        }

        if (outcomesAreDifferent) {
            appendLine()
            appendLine("Outcome differs:")
            outcomeDiff?.toText()?.let { append(it) }
        }
    }

    companion object {
        /**
         * Compare a fork to a baseline timeline index.
         */
        fun compare(
            fork: ForkTimeline,
            baseline: TimelineIndex
        ): ForkComparison {
            // Get baseline info
            val baselineEnd = baseline.maxSequence
            val baselineLast = baseline.last()

            // Get fork info
            val forkEnd = fork.maxSequence
            val forkLast = fork.last()

            // Find divergence point (where fork starts having simulated entries)
            val divergencePoint = fork.branchSequence

            // Get outcomes
            val baselineOutcome = baselineLast?.snapshot
            val forkOutcome = forkLast?.snapshot

            // Compute outcome diff
            val outcomeDiff = if (baselineOutcome != null || forkOutcome != null) {
                SnapshotDiffAdapter.diff(baselineOutcome, forkOutcome)
            } else null

            return ForkComparison(
                forkId = fork.forkId,
                baselineEndSequence = baselineEnd,
                forkEndSequence = forkEnd,
                divergencePoint = divergencePoint,
                baselineOutcome = baselineOutcome,
                forkOutcome = forkOutcome,
                outcomeDiff = outcomeDiff,
                eventCountDelta = fork.size - baseline.size,
                baselineEventCount = baseline.size,
                forkEventCount = fork.size
            )
        }

        /**
         * Compare a fork to a specific baseline entry.
         */
        fun compareToEntry(
            fork: ForkTimeline,
            baselineEntry: TimelineEntry
        ): ForkComparison {
            val forkLast = fork.last()

            val outcomeDiff = if (baselineEntry.snapshot != null || forkLast?.snapshot != null) {
                SnapshotDiffAdapter.diff(baselineEntry.snapshot, forkLast?.snapshot)
            } else null

            return ForkComparison(
                forkId = fork.forkId,
                baselineEndSequence = baselineEntry.sequence,
                forkEndSequence = fork.maxSequence,
                divergencePoint = fork.branchSequence,
                baselineOutcome = baselineEntry.snapshot,
                forkOutcome = forkLast?.snapshot,
                outcomeDiff = outcomeDiff,
                eventCountDelta = fork.size - 1,
                baselineEventCount = 1,
                forkEventCount = fork.size
            )
        }
    }
}

/**
 * Detailed entry-by-entry comparison for debugging.
 */
data class ForkEntryComparison(
    val sequence: Long,
    val baselineEntry: TimelineEntry?,
    val forkEntry: ForkEntry?,
    val status: ComparisonStatus
) {
    /**
     * True if entries match.
     */
    val matches: Boolean get() = status == ComparisonStatus.MATCH

    /**
     * True if this is a divergence point.
     */
    val isDivergence: Boolean get() = status == ComparisonStatus.DIVERGED
}

/**
 * Status of entry comparison.
 */
enum class ComparisonStatus {
    /** Entries match exactly */
    MATCH,

    /** Baseline has entry, fork doesn't */
    BASELINE_ONLY,

    /** Fork has entry (simulated), baseline doesn't */
    FORK_ONLY,

    /** Both have entries but they differ */
    DIVERGED
}

/**
 * Compare entries at a specific sequence.
 */
fun compareEntryAt(
    sequence: Long,
    baseline: TimelineIndex,
    fork: ForkTimeline
): ForkEntryComparison {
    val baselineEntry = baseline.getAtSequence(sequence)
    val forkEntry = fork.getAtSequence(sequence)

    val status = when {
        baselineEntry == null && forkEntry == null -> ComparisonStatus.MATCH
        baselineEntry != null && forkEntry == null -> ComparisonStatus.BASELINE_ONLY
        baselineEntry == null && forkEntry != null -> ComparisonStatus.FORK_ONLY
        forkEntry?.isSimulated == true -> ComparisonStatus.DIVERGED
        else -> ComparisonStatus.MATCH
    }

    return ForkEntryComparison(
        sequence = sequence,
        baselineEntry = baselineEntry,
        forkEntry = forkEntry,
        status = status
    )
}
