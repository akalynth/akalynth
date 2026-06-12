package com.akalynth.client.config

import com.akalynth.client.BuildConfig
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BuildConfigPortalTest {
    @Test
    fun `account portal url targets static account page`() {
        val portalUrl = BuildConfig.PORTAL_ACCOUNT_URL

        assertTrue(portalUrl.startsWith("http://") || portalUrl.startsWith("https://"))
        assertTrue(portalUrl.endsWith("/account.html"))
        assertNotEquals(BuildConfig.HTTP_BASE_URL, portalUrl)
        assertFalse(portalUrl.contains("api.akalynth.com"))
        assertFalse(portalUrl.contains("beta-api.akalynth.com"))
        assertFalse(portalUrl.contains("staging-api.akalynth.com"))
        assertFalse(portalUrl.contains("/api/"))
    }
}
