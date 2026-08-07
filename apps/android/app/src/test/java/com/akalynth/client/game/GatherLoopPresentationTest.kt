package com.akalynth.client.game

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Pure presentation helpers for Azura gather loop (mirrors web gatherLabels).
 */
class GatherLoopPresentationTest {

    @Test
    fun loopStep_nullHeldIsGather() {
        assertEquals(1, GatherLoopPresentation.loopStep(null))
        assertEquals(1, GatherLoopPresentation.loopStep(""))
    }

    @Test
    fun loopStep_rawHeldIsAttune() {
        assertEquals(2, GatherLoopPresentation.loopStep("ley_mote"))
    }

    @Test
    fun loopStep_refinedHeldIsDeliver() {
        assertEquals(3, GatherLoopPresentation.loopStep("refined_ley_mote"))
    }

    @Test
    fun isRefinedItemType() {
        assertTrue(GatherLoopPresentation.isRefinedItemType("refined_ley_mote"))
        assertFalse(GatherLoopPresentation.isRefinedItemType("ley_mote"))
    }

    @Test
    fun heldItemLabel_mapsKnownTypes() {
        assertEquals("—", GatherLoopPresentation.heldItemLabel(null))
        assertEquals("Ley mote", GatherLoopPresentation.heldItemLabel("ley_mote"))
        assertEquals("Refined ley mote", GatherLoopPresentation.heldItemLabel("refined_ley_mote"))
    }

    @Test
    fun deliverStatusLine_fromServerFieldsOnly() {
        val ok = GatherLoopPresentation.deliverStatusLine(
            ok = true,
            itemType = "refined_ley_mote",
            reward = "keystone_token",
            refined = true,
            priorKeystoneTokens = 1,
        )
        assertTrue(ok.contains("keystone"))
        assertTrue(ok.startsWith("Delivered"))
        assertTrue(ok.contains("chill loop is complete"))

        val reject = GatherLoopPresentation.deliverStatusLine(ok = false, reason = "out_of_range")
        assertTrue(reject.contains("out_of_range"))
    }

    @Test
    fun deliverStatusLine_firstKeystoneIsNonSilent() {
        val first = GatherLoopPresentation.deliverStatusLine(
            ok = true,
            itemType = "refined_ley_mote",
            reward = "keystone_token",
            refined = true,
            priorKeystoneTokens = 0,
        )
        assertTrue(first.contains("first keystone"))
        assertTrue(first.contains("Azura remembers"))
        // Line still includes server-derived reward language
        assertTrue(first.contains("keystone"))
        assertTrue(GatherLoopPresentation.isKeystoneDeliverStatus(first))
    }

    @Test
    fun compactSummary_includesStepAndHeld() {
        val s = GatherLoopPresentation.compactSummary("ley_mote")
        assertTrue(s.contains("2/3"))
        assertTrue(s.contains("Attune"))
        assertTrue(s.contains("Ley mote"))
    }

    @Test
    fun compactSummary_showsKeystoneCountWhenPresent() {
        val s = GatherLoopPresentation.compactSummary(null, loopCompleteHint = true, keystoneTokens = 2)
        assertTrue(s.contains("Keystone 2"))
    }
}
