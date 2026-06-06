package com.akalynth.client.game

import com.akalynth.client.BuildConfig
import org.junit.Assert.assertEquals
import org.junit.Test

class GameStateDefaultsTest {
    @Test
    fun defaultServerUrlComesFromBuildConfig() {
        assertEquals(BuildConfig.WS_BASE_URL, GameState.INITIAL.session.serverUrl)
        assertEquals(BuildConfig.WS_BASE_URL, SessionState().serverUrl)
    }
}
