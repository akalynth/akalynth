package com.akalynth.client.network

import kotlin.math.min
import kotlin.random.Random

class ReconnectPolicy(
    private val baseDelayMs: Long = 1000L,
    private val maxDelayMs: Long = 30000L,
    private val jitterFactor: Double = 0.3
) {
    private var _attempt = 0
    private var _lastDelay = 0L

    val attempt: Int get() = _attempt
    val lastDelay: Long get() = _lastDelay

    fun nextDelay(): Long {
        val exponentialDelay = baseDelayMs * (1 shl min(_attempt, 10))
        val cappedDelay = min(exponentialDelay, maxDelayMs)
        val jitter = (Random.nextDouble() - 0.5) * 2 * jitterFactor * cappedDelay
        _attempt++
        _lastDelay = (cappedDelay + jitter).toLong().coerceAtLeast(baseDelayMs)
        return _lastDelay
    }

    fun reset() {
        _attempt = 0
        _lastDelay = 0L
    }
}
