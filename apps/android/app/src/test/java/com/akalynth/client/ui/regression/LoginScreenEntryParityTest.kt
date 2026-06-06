package com.akalynth.client.ui.regression

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.akalynth.client.game.ConnectionDiagnostics
import com.akalynth.client.game.GameEvent
import com.akalynth.client.game.GameState
import com.akalynth.client.game.HealthCheckState
import com.akalynth.client.game.SessionState
import com.akalynth.client.game.UiState
import com.akalynth.client.ui.screens.LoginScreen
import com.akalynth.client.ui.theme.AkalynthTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class LoginScreenEntryParityTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun `cold start exposes create character and connect paths`() {
        var createTapped = false
        val events = mutableListOf<GameEvent>()

        composeTestRule.setContent {
            AkalynthTheme(darkTheme = true) {
                LoginScreen(
                    state = GameState.INITIAL,
                    onEvent = { events.add(it) },
                    onCreateCharacter = { createTapped = true }
                )
            }
        }

        composeTestRule.onNodeWithTag("LoginScreen_EntryHint")
            .assertTextEquals("Start in Rookguard, then step into High City")
        composeTestRule.onNodeWithTag("LoginScreen_CreateCharacter")
            .assertIsDisplayed()
            .performClick()
        composeTestRule.onNodeWithTag("LoginScreen_Connect")
            .assertIsDisplayed()
            .performClick()

        assertTrue("Create character callback should fire", createTapped)
        assertEquals(listOf(GameEvent.Connect), events)
    }

    @Test
    fun `saved character entry labels connect as enter play`() {
        val state = GameState.INITIAL.copy(
            session = SessionState(savedCharacterName = "AuditHero")
        )

        composeTestRule.setContent {
            AkalynthTheme(darkTheme = true) {
                LoginScreen(
                    state = state,
                    onEvent = {},
                    onCreateCharacter = {}
                )
            }
        }

        composeTestRule.onNodeWithTag("LoginScreen_EntryHint")
            .assertTextEquals("Saved character: AuditHero")
        composeTestRule.onNodeWithTag("LoginScreen_Connect")
            .assertTextEquals("Enter Play")
            .assertIsDisplayed()
    }

    @Test
    fun `beta status panel shows lane health and emits health check`() {
        val events = mutableListOf<GameEvent>()
        val state = GameState.INITIAL.copy(
            session = SessionState(serverUrl = "wss://beta-api.akalynth.com"),
            ui = UiState(
                healthCheck = HealthCheckState.Reachable(
                    version = "0.1.0",
                    tickMs = 100,
                    checkedAtMs = 1L
                )
            )
        )

        composeTestRule.setContent {
            AkalynthTheme(darkTheme = true) {
                LoginScreen(
                    state = state,
                    onEvent = { events.add(it) },
                    onCreateCharacter = {}
                )
            }
        }

        composeTestRule.onNodeWithTag("LoginScreen_StatusPanel").assertIsDisplayed()
        composeTestRule.onNodeWithTag("LoginScreen_Lane").assertTextEquals("Beta lane")
        composeTestRule.onNodeWithTag("LoginScreen_ServerHost").assertTextEquals("beta-api.akalynth.com")
        composeTestRule.onNodeWithTag("LoginScreen_BetaBuildBadge").assertTextEquals("BETA BUILD")
        composeTestRule.onNodeWithTag("LoginScreen_HealthState")
            .assertTextEquals("Reachable v0.1.0 tick=100ms")
        composeTestRule.onNodeWithTag("LoginScreen_HealthCheckedAt")
            .performScrollTo()
            .assertIsDisplayed()
        composeTestRule.onNodeWithTag("LoginScreen_ReportIssue")
            .performScrollTo()
            .assertIsDisplayed()
        composeTestRule.onNodeWithTag("LoginScreen_CheckHealth").performClick()
        composeTestRule.onNodeWithTag("LoginScreen_ResetServer")
            .performScrollTo()
            .performClick()

        assertEquals(listOf(GameEvent.CheckHealth, GameEvent.ResetServerUrl), events)
    }

    @Test
    fun `status panel surfaces reconnect countdown`() {
        val state = GameState.INITIAL.copy(
            ui = UiState(
                connectionDiagnostics = ConnectionDiagnostics(
                    reconnectAttempts = 3,
                    nextBackoffMs = 5000,
                    nextReconnectAtMs = System.currentTimeMillis() + 5000
                )
            )
        )

        composeTestRule.setContent {
            AkalynthTheme(darkTheme = true) {
                LoginScreen(
                    state = state,
                    onEvent = {},
                    onCreateCharacter = {}
                )
            }
        }

        composeTestRule.onNodeWithTag("LoginScreen_ReconnectDiagnostics")
            .performScrollTo()
            .assertIsDisplayed()
    }
}
