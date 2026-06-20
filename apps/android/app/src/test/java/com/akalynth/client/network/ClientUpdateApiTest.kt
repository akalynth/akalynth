package com.akalynth.client.network

import com.akalynth.client.BuildConfig
import org.junit.Assert.assertTrue
import org.junit.Test

class ClientUpdateApiTest {
    @Test
    fun `beta unit tests run on beta build type`() {
        assertTrue(BuildConfig.BUILD_TYPE == "beta")
    }

    @Test
    fun `beta lane uses https api base for update manifest`() {
        assertTrue(BuildConfig.HTTP_BASE_URL.startsWith("https://"))
        assertTrue(BuildConfig.HTTP_BASE_URL.contains("beta-api.akalynth.com"))
    }
}