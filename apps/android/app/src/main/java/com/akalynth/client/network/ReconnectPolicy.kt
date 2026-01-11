package com.akalynth.client.network

import kotlin.math.min
import kotlin.random.Random

class ReconnectPolicy(
    private val baseDelayMs: Long = 1000L,
    private val maxDelayMs: Long = 30000L,
    private val jitterFactor: Double = 0.3
) {
    private var attempt = 0

    fun nextDelay(): Long {
        val exponentialDelay = baseDelayMs * (1 shl min(attempt, 10))
        val cappedDelay = min(exponentialDelay, maxDelayMs)
        val jitter = (Random.nextDouble() - 0.5) * 2 * jitterFactor * cappedDelay
        attempt++
        return (cappedDelay + jitter).toLong().coerceAtLeast(baseDelayMs)
    }

    fun reset() {
        attempt = 0
    }
}
