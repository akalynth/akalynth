package com.akalynth.client.fork

import com.akalynth.client.chronicle.EventSource
import com.akalynth.client.chronicle.EventStatus

/**
 * Fork isolation utilities.
 *
 * Enforces the invariant: **Forks never contaminate authoritative timeline.**
 *
 * This is achieved by:
 * 1. Simulated entries can never have CONFIRMED status
 * 2. Simulated events always have CLIENT_INTENT source
 * 3. Fork IDs are distinct from receipt IDs
 * 4. Fork entries are explicitly marked by origin
 */
object ForkIsolation {

    /**
     * Validate that a fork entry maintains isolation.
     *
     * @throws ForkIsolationViolation if entry violates isolation rules
     */
    fun validateEntry(entry: ForkEntry) {
        if (entry.isSimulated) {
            // Simulated entries can never be confirmed
            entry.event?.let { event ->
                if (event.status == EventStatus.CONFIRMED) {
                    throw ForkIsolationViolation(
                        "Simulated entry cannot have CONFIRMED status: ${entry.eventId}"
                    )
                }

                if (event.source != EventSource.CLIENT_INTENT) {
                    throw ForkIsolationViolation(
                        "Simulated entry must have CLIENT_INTENT source: ${entry.eventId}"
                    )
                }

                if (!event.eventId.startsWith("sim_")) {
                    throw ForkIsolationViolation(
                        "Simulated event ID must start with 'sim_': ${event.eventId}"
                    )
                }
            }

            // Simulated explanations can never be confirmed
            entry.explanation?.let { exp ->
                if (exp.decision == com.akalynth.client.explain.ExplainDecision.CONFIRMED) {
                    throw ForkIsolationViolation(
                        "Simulated explanation cannot have CONFIRMED decision: ${exp.explanationId}"
                    )
                }

                if (!exp.reason.contains("[SIMULATED]")) {
                    throw ForkIsolationViolation(
                        "Simulated explanation must be marked: ${exp.explanationId}"
                    )
                }
            }
        }
    }

    /**
     * Validate an entire fork timeline.
     *
     * @throws ForkIsolationViolation if any entry violates isolation
     */
    fun validateFork(fork: ForkTimeline) {
        // Fork ID must be distinct
        if (!fork.forkId.startsWith("fork_")) {
            throw ForkIsolationViolation(
                "Fork ID must start with 'fork_': ${fork.forkId}"
            )
        }

        // Validate all entries
        fork.allEntries().forEach { entry ->
            validateEntry(entry)
        }

        // Inherited entries must precede simulated entries
        var sawSimulated = false
        fork.allEntries().forEach { entry ->
            if (entry.isSimulated) {
                sawSimulated = true
            } else if (sawSimulated) {
                throw ForkIsolationViolation(
                    "Inherited entry found after simulated entries at sequence ${entry.sequence}"
                )
            }
        }
    }

    /**
     * Check if an event ID looks like a fork simulation.
     */
    fun isSimulatedEventId(eventId: String): Boolean =
        eventId.startsWith("sim_") || eventId.startsWith("fork_")

    /**
     * Check if a fork ID is valid format.
     */
    fun isValidForkId(forkId: String): Boolean =
        forkId.startsWith("fork_") && forkId.length > 5

    /**
     * Extract fork ID from a simulated event ID.
     */
    fun extractForkId(eventId: String): String? {
        if (!eventId.startsWith("sim_")) return null
        val parts = eventId.removePrefix("sim_").split("_")
        return if (parts.size >= 2) "fork_${parts[0]}_${parts[1]}" else null
    }
}

/**
 * Exception thrown when fork isolation is violated.
 */
class ForkIsolationViolation(message: String) : RuntimeException(message)
