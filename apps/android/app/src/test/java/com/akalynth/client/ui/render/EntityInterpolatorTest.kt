package com.akalynth.client.ui.render

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class EntityInterpolatorTest {

    private fun interp() = EntityInterpolator(interpMs = 100L)

    @Test
    fun unknownEntityHasNoPosition() {
        assertNull(interp().positionOf("ghost", nowMs = 0L))
    }

    @Test
    fun firstSightingLandsExactlyAndDoesNotAnimate() {
        val i = interp()
        i.setTarget("p", x = 5, y = 7, nowMs = 0L)

        val pos = i.positionOf("p", nowMs = 0L)!!
        assertEquals(5f, pos.x, 0f)
        assertEquals(7f, pos.y, 0f)
        // No prior position to glide from -> nothing to animate.
        assertFalse(i.isAnimating(nowMs = 0L))
    }

    @Test
    fun changedTargetGlidesFromPrevToTargetOverInterpWindow() {
        val i = interp()
        i.setTarget("p", x = 0, y = 0, nowMs = 0L)
        i.setTarget("p", x = 10, y = 0, nowMs = 0L) // start glide at t=0

        // alpha = 0 -> still at the previous tile.
        assertEquals(0f, i.positionOf("p", 0L)!!.x, 0.001f)
        // alpha = 0.5 -> halfway.
        assertEquals(5f, i.positionOf("p", 50L)!!.x, 0.001f)
        // alpha >= 1 -> landed and clamped (does not overshoot past the window).
        assertEquals(10f, i.positionOf("p", 100L)!!.x, 0.001f)
        assertEquals(10f, i.positionOf("p", 250L)!!.x, 0.001f)
    }

    @Test
    fun isAnimatingTracksTheGlideWindow() {
        val i = interp()
        i.setTarget("p", 0, 0, 0L)
        i.setTarget("p", 4, 0, 0L)

        assertTrue(i.isAnimating(50L))
        assertFalse(i.isAnimating(100L)) // settled exactly at the window end
    }

    @Test
    fun retargetingMidGlideStartsFromCurrentRenderedPosition() {
        val i = interp()
        i.setTarget("p", 0, 0, 0L)
        i.setTarget("p", 10, 0, 0L)

        // Retarget at the halfway point: should glide from ~5 (current) to the new target, not 0.
        i.setTarget("p", 10, 10, 50L)
        assertEquals(5f, i.positionOf("p", 50L)!!.x, 0.001f)
        assertEquals(0f, i.positionOf("p", 50L)!!.y, 0.001f)

        val landed = i.positionOf("p", 150L)!!
        assertEquals(10f, landed.x, 0.001f)
        assertEquals(10f, landed.y, 0.001f)
    }

    @Test
    fun retainDropsEntitiesNoLongerPresent() {
        val i = interp()
        i.setTarget("a", 1, 1, 0L)
        i.setTarget("b", 2, 2, 0L)

        i.retain(setOf("a"))

        assertNull(i.positionOf("b", 0L))
        assertEquals(1f, i.positionOf("a", 0L)!!.x, 0f)
    }
}
