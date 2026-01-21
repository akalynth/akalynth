package com.akalynth.client.actions

import java.util.UUID
import java.util.concurrent.atomic.AtomicLong

/**
 * Generator for action correlation IDs.
 *
 * Injectable interface enables:
 * - Deterministic IDs in tests
 * - UUID-based IDs in production
 */
fun interface ActionIdGenerator {
    fun nextId(): String
}

/**
 * Default UUID-based generator for production.
 */
class UuidActionIdGenerator : ActionIdGenerator {
    override fun nextId(): String = UUID.randomUUID().toString()
}

/**
 * Sequential generator for deterministic tests.
 *
 * Generates IDs in format: "a-0001", "a-0002", etc.
 */
class SequentialActionIdGenerator(
    private val prefix: String = "a"
) : ActionIdGenerator {
    private val counter = AtomicLong(0)

    override fun nextId(): String {
        val n = counter.incrementAndGet()
        return "$prefix-${n.toString().padStart(4, '0')}"
    }

    /** Reset counter (for test isolation) */
    fun reset() {
        counter.set(0)
    }
}
