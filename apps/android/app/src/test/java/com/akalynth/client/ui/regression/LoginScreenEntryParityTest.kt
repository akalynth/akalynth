package com.akalynth.client.ui.regression

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.akalynth.client.game.GameEvent
import com.akalynth.client.game.GameState
import com.akalynth.client.game.SessionState
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
            .assertTextEquals("Connect as guest or create a character")
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
}
