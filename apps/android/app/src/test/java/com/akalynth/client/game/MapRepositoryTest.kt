package com.akalynth.client.game

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.akalynth.client.protocol.MapName
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class MapRepositoryTest {
    @Test
    fun highCityAliasLoadsCurrentFirstCityAsset() {
        val context = ApplicationProvider.getApplicationContext<Context>()

        val highCity = MapRepository.load(context, MapName.HIGH_CITY)
        val legacy = MapRepository.load(context, MapName.AZURA)

        assertNotNull(highCity)
        assertNotNull(legacy)
        assertEquals(legacy!!.width, highCity!!.width)
        assertEquals(legacy.height, highCity.height)
        assertEquals("Azura", highCity.name)
        assertEquals("High City", MapName.HIGH_CITY.displayName)
    }
}
