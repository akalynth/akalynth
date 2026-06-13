package com.akalynth.client.ui.render

import androidx.compose.runtime.State
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.withFrameNanos
import kotlinx.coroutines.channels.Channel

/**
 * A Choreographer-paced render clock built on [withFrameNanos].
 *
 * It advances [frameTimeMs] at most [targetFps] times per second while motion is in flight, then
 * parks (suspends, requesting no further frames) once motion settles, so an idle world costs no
 * battery. Recomposition of anything that reads [frameTimeMs] is therefore capped to the target
 * frame rate and stops entirely when nothing is moving.
 *
 * It never produces or mutates game state — it only emits a monotonic timestamp for the
 * display-only [EntityInterpolator].
 */
class RenderClock(private val targetFps: () -> Int) {

    private val _frameTimeMs = mutableStateOf(0L)
    val frameTimeMs: State<Long> get() = _frameTimeMs

    // CONFLATED: one pending wake is enough; bursts of snapshots collapse to a single resume.
    private val wakeSignal = Channel<Unit>(Channel.CONFLATED)

    /** Monotonic time in ms, the same timebase as [withFrameNanos] frame times (CLOCK_MONOTONIC). */
    fun nowMs(): Long = System.nanoTime() / 1_000_000L

    /** Resume ticking after a park — call when a new snapshot arrives. */
    fun wake() {
        wakeSignal.trySend(Unit)
    }

    /**
     * Run the frame loop until the surrounding coroutine is cancelled. Emits a throttled
     * [frameTimeMs] while [isAnimating] holds, then parks until [wake] once motion has settled.
     */
    suspend fun run(isAnimating: (nowMs: Long) -> Boolean) {
        var lastEmitNanos = 0L
        var idleFrames = 0
        while (true) {
            withFrameNanos { frameNanos ->
                val minIntervalNanos = 1_000_000_000L / targetFps().coerceAtLeast(1)
                if (frameNanos - lastEmitNanos >= minIntervalNanos) {
                    lastEmitNanos = frameNanos
                    _frameTimeMs.value = frameNanos / 1_000_000L
                }
                idleFrames = if (isAnimating(frameNanos / 1_000_000L)) 0 else idleFrames + 1
            }
            if (idleFrames >= PARK_AFTER_IDLE_FRAMES) {
                // Land exactly on the settled positions, then suspend until the next snapshot.
                withFrameNanos { frameNanos -> _frameTimeMs.value = frameNanos / 1_000_000L }
                wakeSignal.receive()
                idleFrames = 0
                lastEmitNanos = 0L
            }
        }
    }

    private companion object {
        // Display frames of stillness before parking (~0.1s on a 60Hz panel). Small so we stop
        // burning frames quickly, but non-zero so we don't thrash park/wake at the tail of a glide.
        const val PARK_AFTER_IDLE_FRAMES = 6
    }
}
