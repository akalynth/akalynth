package com.akalynth.client.network

import com.akalynth.client.BuildConfig
import org.junit.Assert.assertEquals
import org.junit.Test

class EndpointInfoTest {
    @Test
    fun betaEndpointIsLabeledAndMappedToHttpsHealthBase() {
        val endpoint = EndpointInfo.fromWsUrl("wss://beta-api.akalynth.com")

        assertEquals("Beta", endpoint.lane)
        assertEquals("beta-api.akalynth.com", endpoint.host)
        assertEquals("https://beta-api.akalynth.com", endpoint.httpBaseUrl)
    }

    @Test
    fun localEndpointIsLabeledAndMappedToHttpHealthBase() {
        val endpoint = EndpointInfo.fromWsUrl("ws://10.0.2.2:3000")

        assertEquals("Local", endpoint.lane)
        assertEquals("10.0.2.2:3000", endpoint.host)
        assertEquals("http://10.0.2.2:3000", endpoint.httpBaseUrl)
    }

    @Test
    fun endpointCarriesAppBuildMetadata() {
        val endpoint = EndpointInfo.fromWsUrl(BuildConfig.WS_BASE_URL)

        assertEquals(BuildConfig.VERSION_NAME, endpoint.appVersion)
        assertEquals(BuildConfig.BUILD_TYPE, endpoint.buildType)
    }
}
