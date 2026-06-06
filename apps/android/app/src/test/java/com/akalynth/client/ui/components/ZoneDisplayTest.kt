package com.akalynth.client.ui.components

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ZoneDisplayTest {
    @Test
    fun legacyAzuraDisplaysAsHighCity() {
        assertEquals("High City", displayZoneName("Azura"))
        assertEquals("High City", displayZoneName("HighCity"))
    }

    @Test
    fun nonFirstCityZonesAreUnchanged() {
        assertEquals("Rookguard", displayZoneName("Rookguard"))
        assertEquals("deep_archive", displayZoneName("deep_archive"))
    }

    @Test
    fun optionalZoneDisplayPreservesNull() {
        assertEquals("High City", displayOptionalZoneName("Azura"))
        assertNull(displayOptionalZoneName(null))
    }
}
