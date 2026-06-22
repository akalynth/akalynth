package com.akalynth.client.game

import com.akalynth.client.BuildConfig
import com.akalynth.client.progression.UnlockState
import org.junit.Assert.assertEquals
import org.junit.Test

class GameStateDefaultsTest {
    @Test
    fun defaultServerUrlComesFromBuildConfig() {
        assertEquals(BuildConfig.WS_BASE_URL, GameState.INITIAL.session.serverUrl)
        assertEquals(BuildConfig.WS_BASE_URL, SessionState().serverUrl)
    }

    @Test
    fun defaultUnlockStateIsStage0() {
        assertEquals(UnlockState.DEFAULT, GameState.INITIAL.unlock)
        assertEquals(0, GameState.INITIAL.unlock.stage)
    }
}
