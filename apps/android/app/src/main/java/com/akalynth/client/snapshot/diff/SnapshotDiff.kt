package com.akalynth.client.snapshot.diff

import com.akalynth.client.snapshot.SnapshotV0

/**
 * Represents the difference between two snapshots.
 *
 * A diff is a complete, human-legible record of what changed between
 * two points in time. It does not infer causality—only reports facts.
 *
 * @property prevSequence Sequence of the "before" snapshot (null if none)
 * @property currSequence Sequence of the "after" snapshot (null if none)
 * @property prevHash State hash before (null if none)
 * @property currHash State hash after (null if none)
 * @property entries List of individual changes, sorted by category then key
 * @property summary Human-readable summary of changes
 */
data class SnapshotDiff(
    val prevSequence: Long?,
    val currSequence: Long?,
    val prevHash: String?,
    val currHash: String?,
    val entries: List<DiffEntry>,
    val summary: DiffSummary
) {
    /**
     * True if there are any changes.
     */
    val hasChanges: Boolean get() = entries.isNotEmpty()

    /**
     * True if this represents a state transition (both snapshots present).
     */
    val isTransition: Boolean get() = prevSequence != null && currSequence != null

    /**
     * Get entries by category.
     */
    fun entriesByCategory(category: DiffCategory): List<DiffEntry> {
        return entries.filter { it.category == category }
    }

    /**
     * Get entries by change type.
     */
    fun entriesByType(changeType: ChangeType): List<DiffEntry> {
        return entries.filter { it.changeType == changeType }
    }

    /**
     * Get all added entries.
     */
    val added: List<DiffEntry> get() = entriesByType(ChangeType.ADDED)

    /**
     * Get all removed entries.
     */
    val removed: List<DiffEntry> get() = entriesByType(ChangeType.REMOVED)

    /**
     * Get all modified entries.
     */
    val modified: List<DiffEntry> get() = entriesByType(ChangeType.MODIFIED)

    /**
     * Format as human-readable text.
     */
    fun toText(): String = buildString {
        if (isTransition) {
            appendLine("State: $prevSequence → $currSequence")
        } else if (currSequence != null) {
            appendLine("State: $currSequence")
        }

        if (entries.isEmpty()) {
            appendLine("No changes.")
        } else {
            appendLine(summary.toText())
            appendLine()
            entries.groupBy { it.category }.forEach { (category, categoryEntries) ->
                appendLine("${category.displayName}:")
                categoryEntries.forEach { entry ->
                    appendLine("  ${entry.toText()}")
                }
            }
        }
    }

    companion object {
        /**
         * Empty diff (no snapshots).
         */
        val EMPTY = SnapshotDiff(
            prevSequence = null,
            currSequence = null,
            prevHash = null,
            currHash = null,
            entries = emptyList(),
            summary = DiffSummary.EMPTY
        )

        /**
         * Create a no-op diff (same state).
         */
        fun noOp(snapshot: SnapshotV0) = SnapshotDiff(
            prevSequence = snapshot.sequence,
            currSequence = snapshot.sequence,
            prevHash = snapshot.stateHash,
            currHash = snapshot.stateHash,
            entries = emptyList(),
            summary = DiffSummary.EMPTY
        )
    }
}

/**
 * Summary of changes in a diff.
 */
data class DiffSummary(
    val addedCount: Int,
    val removedCount: Int,
    val modifiedCount: Int,
    val categoryCounts: Map<DiffCategory, Int>
) {
    val totalChanges: Int get() = addedCount + removedCount + modifiedCount

    fun toText(): String = buildString {
        append("Changes: ")
        val parts = mutableListOf<String>()
        if (addedCount > 0) parts.add("+$addedCount added")
        if (removedCount > 0) parts.add("-$removedCount removed")
        if (modifiedCount > 0) parts.add("~$modifiedCount modified")
        append(parts.joinToString(", ").ifEmpty { "none" })
    }

    companion object {
        val EMPTY = DiffSummary(
            addedCount = 0,
            removedCount = 0,
            modifiedCount = 0,
            categoryCounts = emptyMap()
        )

        fun from(entries: List<DiffEntry>): DiffSummary {
            val addedCount = entries.count { it.changeType == ChangeType.ADDED }
            val removedCount = entries.count { it.changeType == ChangeType.REMOVED }
            val modifiedCount = entries.count { it.changeType == ChangeType.MODIFIED }
            val categoryCounts = entries.groupingBy { it.category }.eachCount()

            return DiffSummary(
                addedCount = addedCount,
                removedCount = removedCount,
                modifiedCount = modifiedCount,
                categoryCounts = categoryCounts
            )
        }
    }
}

/**
 * Categories of state changes.
 */
enum class DiffCategory(val displayName: String) {
    /** Inventory item changes */
    INVENTORY("Inventory"),

    /** Player stat changes (health, mana, etc.) */
    STATS("Stats"),

    /** Position/zone changes */
    POSITION("Position"),

    /** Gold/currency changes */
    CURRENCY("Currency"),

    /** Equipment changes */
    EQUIPMENT("Equipment"),

    /** Status effect changes */
    STATUS("Status Effects"),

    /** World state changes */
    WORLD("World"),

    /** Metadata changes (hash, timestamps) */
    META("Metadata"),

    /** Uncategorized changes */
    OTHER("Other")
}

/**
 * Type of change.
 */
enum class ChangeType(val symbol: String) {
    /** New entry that didn't exist before */
    ADDED("+"),

    /** Entry that was removed */
    REMOVED("-"),

    /** Entry that existed but changed value */
    MODIFIED("~"),

    /** No change (for completeness) */
    UNCHANGED("=")
}
