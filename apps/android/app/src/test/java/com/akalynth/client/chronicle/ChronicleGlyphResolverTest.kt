package com.akalynth.client.chronicle

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ChronicleGlyphResolverTest {

    @Test
    fun `resolve maps death to death glyph asset`() {
        val glyph = ChronicleGlyphResolver.resolve(ChronicleEventKind.DEATH)

        assertEquals("death", glyph.chronicleKind)
        assertEquals("sprites/effect__chronicle_death.png", glyph.assetPath)
    }

    @Test
    fun `resolve maps world event to world glyph asset`() {
        val glyph = ChronicleGlyphResolver.resolve(ChronicleEventKind.WORLD_EVENT)

        assertEquals("world_event", glyph.chronicleKind)
        assertEquals("sprites/effect__chronicle_world.png", glyph.assetPath)
    }

    @Test
    fun `unknown kind uses unknown fallback asset`() {
        val glyph = ChronicleGlyphResolver.resolve(ChronicleEventKind.UNKNOWN)

        assertEquals("unknown", glyph.chronicleKind)
        assertEquals("sprites/effect__chronicle_unknown.png", glyph.assetPath)
    }

    @Test
    fun `export label is ASCII bracketed chronicle kind`() {
        assertEquals("[death]", ChronicleGlyphResolver.exportLabel(ChronicleEventKind.DEATH))
        assertEquals("[item_pickup]", ChronicleGlyphResolver.exportLabel(ChronicleEventKind.ITEM_PICKUP))
        assertEquals("[unknown]", ChronicleGlyphResolver.exportLabel(ChronicleEventKind.UNKNOWN))
    }

    @Test
    fun `only death rows are tappable`() {
        assertTrue(ChronicleGlyphResolver.isTappable(ChronicleEventKind.DEATH))
        assertFalse(ChronicleGlyphResolver.isTappable(ChronicleEventKind.ZONE_ENTER))
        assertFalse(ChronicleGlyphResolver.isTappable(ChronicleEventKind.UNKNOWN))
    }
}