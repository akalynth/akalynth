package com.akalynth.client.ui.render

/** A position in tile-space, expressed as floats so a glide can land between tiles. */
data class TilePos(val x: Float, val y: Float)

/**
 * Display-only smoothing for entity positions.
 *
 * The server remains fully authoritative: callers feed in confirmed integer tile positions
 * via [setTarget], and the renderer reads softened float positions via [positionOf]. Nothing
 * computed here is ever sent back to the server or treated as truth — it only changes how an
 * already-confirmed position is *drawn*, gliding from the previous position to the latest
 * confirmed one over [interpMs] ("render-behind" interpolation). This removes the one-tile
 * teleport that direct snapping produces.
 *
 * Not thread-safe: drive it from the render/UI thread only (it is).
 */
class EntityInterpolator(private val interpMs: Long = DEFAULT_INTERP_MS) {

    private data class Track(
        val fromX: Float,
        val fromY: Float,
        val toX: Float,
        val toY: Float,
        val startMs: Long,
    )

    private val tracks = HashMap<String, Track>()

    /**
     * Record the authoritative [x],[y] tile for [id] as of [nowMs]. The first sighting lands
     * exactly (no prior position to glide from); a changed target starts a fresh glide from
     * wherever the entity is being drawn right now, so mid-glide updates stay smooth.
     */
    fun setTarget(id: String, x: Int, y: Int, nowMs: Long) {
        val tx = x.toFloat()
        val ty = y.toFloat()
        val existing = tracks[id]
        if (existing == null) {
            tracks[id] = Track(tx, ty, tx, ty, nowMs)
            return
        }
        if (existing.toX == tx && existing.toY == ty) return
        val current = positionOf(id, nowMs) ?: TilePos(tx, ty)
        tracks[id] = Track(current.x, current.y, tx, ty, nowMs)
    }

    /** The softened position of [id] at [nowMs], or null if [id] has never been seen. */
    fun positionOf(id: String, nowMs: Long): TilePos? {
        val t = tracks[id] ?: return null
        val alpha = alphaAt(t, nowMs)
        return TilePos(
            x = t.fromX + (t.toX - t.fromX) * alpha,
            y = t.fromY + (t.toY - t.fromY) * alpha,
        )
    }

    /** True while any tracked entity is still mid-glide at [nowMs] (used to pace/park the clock). */
    fun isAnimating(nowMs: Long): Boolean = tracks.values.any { t ->
        (t.fromX != t.toX || t.fromY != t.toY) && alphaAt(t, nowMs) < 1f
    }

    /** Drop tracks for entities no longer present (left view / disconnected). */
    fun retain(ids: Set<String>) {
        tracks.keys.retainAll(ids)
    }

    private fun alphaAt(t: Track, nowMs: Long): Float {
        if (interpMs <= 0L) return 1f
        return ((nowMs - t.startMs).toFloat() / interpMs).coerceIn(0f, 1f)
    }

    companion object {
        /**
         * Glide duration ≈ "render-behind" delay. ~180 ms sits in the researched 150–250 ms band
         * for a 10–20 Hz authoritative-snapshot stream over WebSocket/TCP, long enough to absorb
         * a single retransmit stall without the world freezing.
         */
        const val DEFAULT_INTERP_MS = 180L
    }
}
